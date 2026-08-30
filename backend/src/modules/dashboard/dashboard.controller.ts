import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Invoice } from '../../database/models/Invoice';
import { Payment } from '../../database/models/Payment';
import { resolveDateRange } from '../../utils/date-range';

/**
 * GET /api/dashboard/overview
 * Comprehensive dashboard metrics, adaptive sales/received charts,
 * payment methods, top customers, best sellers, and outstanding dues.
 */
export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const bId = new mongoose.Types.ObjectId(req.businessId);
    const range = resolveDateRange({
      preset: req.query.preset as string,
      from: req.query.from as string,
      to: req.query.to as string,
      groupBy: req.query.groupBy as string,
    });

    const { startDate, endDate, groupBy } = range;

    // 1. Finalized Invoices in Date Range (Sales / Turnover)
    const invoiceFilter = {
      businessId: bId,
      status: 'FINALIZED',
      invoiceDate: { $gte: startDate, $lte: endDate },
    };

    const invoiceOverviewPromise = Invoice.aggregate([
      { $match: invoiceFilter },
      {
        $group: {
          _id: null,
          salesMinor: { $sum: '$totals.grandTotalMinor' },
          invoiceCount: { $sum: 1 },
          outstandingInPeriodMinor: { $sum: '$paymentSummary.dueAmountMinor' },
        },
      },
    ]);

    // 2. Payments Received in Date Range (Authoritative from Payment collection)
    const paymentFilter = {
      businessId: bId,
      status: 'CONFIRMED',
      paidAt: { $gte: startDate, $lte: endDate },
    };

    const paymentOverviewPromise = Payment.aggregate([
      { $match: paymentFilter },
      {
        $group: {
          _id: null,
          moneyReceivedMinor: { $sum: '$amountMinor' },
          paymentCount: { $sum: 1 },
        },
      },
    ]);

    // 3. Current Total Outstanding Dues across all active finalized bills
    const totalOutstandingPromise = Invoice.aggregate([
      {
        $match: {
          businessId: bId,
          status: 'FINALIZED',
          'paymentSummary.dueAmountMinor': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalOutstandingMinor: { $sum: '$paymentSummary.dueAmountMinor' },
          outstandingInvoiceCount: { $sum: 1 },
        },
      },
    ]);

    // 4. Time-Series Aggregation for Sales (by invoiceDate)
    let dateGroupFormat = '%Y-%m-%d';
    if (groupBy === 'hour') dateGroupFormat = '%Y-%m-%d %H:00';
    else if (groupBy === 'month') dateGroupFormat = '%Y-%m';
    else if (groupBy === 'week') dateGroupFormat = '%Y-W%V';

    const salesTimelinePromise = Invoice.aggregate([
      { $match: invoiceFilter },
      {
        $group: {
          _id: { $dateToString: { format: dateGroupFormat, date: '$invoiceDate' } },
          salesMinor: { $sum: '$totals.grandTotalMinor' },
          invoiceCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 5. Time-Series Aggregation for Payments (by paidAt)
    const paymentsTimelinePromise = Payment.aggregate([
      { $match: paymentFilter },
      {
        $group: {
          _id: { $dateToString: { format: dateGroupFormat, date: '$paidAt' } },
          receivedMinor: { $sum: '$amountMinor' },
          paymentCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 6. Payment Methods Breakdown
    const paymentMethodsPromise = Payment.aggregate([
      { $match: paymentFilter },
      {
        $group: {
          _id: '$method',
          amountMinor: { $sum: '$amountMinor' },
          count: { $sum: 1 },
        },
      },
      { $sort: { amountMinor: -1 } },
    ]);

    // 7. Payment Accounts Breakdown
    const paymentAccountsPromise = Payment.aggregate([
      { $match: paymentFilter },
      {
        $group: {
          _id: {
            id: { $ifNull: ['$paymentAccountId', null] },
            name: { $ifNull: ['$paymentAccountSnapshot.displayName', { $ifNull: ['$paymentAccountSnapshot.name', 'Counter Cash / Direct'] }] },
            type: { $ifNull: ['$paymentAccountSnapshot.type', '$method'] },
          },
          amountMinor: { $sum: '$amountMinor' },
          count: { $sum: 1 },
        },
      },
      { $sort: { amountMinor: -1 } },
    ]);

    // 8. Top 5 Customers in Period
    const topCustomersPromise = Invoice.aggregate([
      { $match: invoiceFilter },
      {
        $group: {
          _id: { $ifNull: ['$customerId', '$customerSnapshot.name'] },
          customerName: { $first: { $ifNull: ['$customerSnapshot.name', 'Unnamed Customer'] } },
          orderCount: { $sum: 1 },
          salesMinor: { $sum: '$totals.grandTotalMinor' },
          paidMinor: { $sum: '$paymentSummary.paidAmountMinor' },
          outstandingMinor: { $sum: '$paymentSummary.dueAmountMinor' },
        },
      },
      { $sort: { salesMinor: -1, orderCount: -1 } },
      { $limit: 5 },
    ]);

    // 9. Best Selling Items (from finalized line-items)
    const bestSellingPromise = Invoice.aggregate([
      { $match: invoiceFilter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.description',
          description: { $first: '$items.description' },
          type: { $first: '$items.type' },
          quantitySold: { $sum: '$items.quantity' },
          orderCount: { $sum: 1 },
          revenueMinor: { $sum: '$items.lineTotalMinor' },
        },
      },
      { $sort: { revenueMinor: -1, quantitySold: -1 } },
      { $limit: 5 },
    ]);

    // 10. Top Outstanding Invoices for Quick Action
    const topOutstandingInvoicesPromise = Invoice.find({
      businessId: bId,
      status: 'FINALIZED',
      'paymentSummary.dueAmountMinor': { $gt: 0 },
    })
      .sort({ 'paymentSummary.dueAmountMinor': -1, invoiceDate: -1 })
      .limit(6)
      .select('invoiceNumber customerSnapshot totals paymentSummary invoiceDate');

    // Execute all aggregations in parallel
    const [
      invoiceOverview,
      paymentOverview,
      totalOutstanding,
      salesTimeline,
      paymentsTimeline,
      paymentMethodsResult,
      paymentAccountsResult,
      topCustomersResult,
      bestSellingResult,
      topOutstandingInvoices,
    ] = await Promise.all([
      invoiceOverviewPromise,
      paymentOverviewPromise,
      totalOutstandingPromise,
      salesTimelinePromise,
      paymentsTimelinePromise,
      paymentMethodsPromise,
      paymentAccountsPromise,
      topCustomersPromise,
      bestSellingPromise,
      topOutstandingInvoicesPromise,
    ]);

    // Extract core KPIs
    const invData = invoiceOverview[0] || { salesMinor: 0, invoiceCount: 0, outstandingInPeriodMinor: 0 };
    const payData = paymentOverview[0] || { moneyReceivedMinor: 0, paymentCount: 0 };
    const outData = totalOutstanding[0] || { totalOutstandingMinor: 0, outstandingInvoiceCount: 0 };

    const salesMinor = invData.salesMinor;
    const invoiceCount = invData.invoiceCount;
    const moneyReceivedMinor = payData.moneyReceivedMinor;
    const outstandingMinor = outData.totalOutstandingMinor;
    const averageInvoiceMinor = invoiceCount > 0 ? Math.round(salesMinor / invoiceCount) : 0;
    const paidRatePercentage = salesMinor > 0 ? Math.min(100, Math.round((moneyReceivedMinor / salesMinor) * 1000) / 10) : 0;

    // Merge Sales and Payments timeline
    const timelineMap: Record<string, { period: string; dateLabel: string; salesMinor: number; receivedMinor: number; invoiceCount: number }> = {};

    salesTimeline.forEach((item) => {
      timelineMap[item._id] = {
        period: item._id,
        dateLabel: item._id,
        salesMinor: item.salesMinor,
        receivedMinor: 0,
        invoiceCount: item.invoiceCount,
      };
    });

    paymentsTimeline.forEach((item) => {
      if (!timelineMap[item._id]) {
        timelineMap[item._id] = {
          period: item._id,
          dateLabel: item._id,
          salesMinor: 0,
          receivedMinor: item.receivedMinor,
          invoiceCount: 0,
        };
      } else {
        timelineMap[item._id].receivedMinor = item.receivedMinor;
      }
    });

    const series = Object.values(timelineMap).sort((a, b) => a.period.localeCompare(b.period));

    // Payment Methods Breakdown
    const totalReceivedSum = paymentMethodsResult.reduce((sum, m) => sum + m.amountMinor, 0);
    const paymentMethods = paymentMethodsResult.map((m) => ({
      method: m._id,
      label: m._id ? m._id.replace('_', ' ') : 'CASH',
      amountMinor: m.amountMinor,
      count: m.count,
      percentage: totalReceivedSum > 0 ? Math.round((m.amountMinor / totalReceivedSum) * 1000) / 10 : 0,
    }));

    // Payment Accounts Breakdown
    const paymentAccounts = paymentAccountsResult.map((a) => ({
      accountId: a._id.id ? a._id.id.toString() : null,
      accountName: a._id.name || 'Counter Cash',
      type: a._id.type || 'CASH',
      amountReceivedMinor: a.amountMinor,
      paymentCount: a.count,
      percentage: totalReceivedSum > 0 ? Math.round((a.amountMinor / totalReceivedSum) * 1000) / 10 : 0,
    }));

    // Top Customers
    const topCustomers = topCustomersResult.map((c) => ({
      customerId: c._id ? c._id.toString() : 'anonymous',
      customerName: c.customerName,
      orders: c.orderCount,
      salesMinor: c.salesMinor,
      paidMinor: c.paidMinor,
      outstandingMinor: c.outstandingMinor,
    }));

    // Best Selling
    const bestSelling = bestSellingResult.map((b) => ({
      description: b.description,
      type: b.type,
      quantitySold: b.quantitySold,
      orders: b.orderCount,
      revenueMinor: b.revenueMinor,
    }));

    // Outstanding invoices
    const outstandingInvoices = topOutstandingInvoices.map((inv: any) => ({
      id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.customerSnapshot?.name || 'Customer',
      dueAmountMinor: inv.paymentSummary?.dueAmountMinor || 0,
      grandTotalMinor: inv.totals?.grandTotalMinor || 0,
      invoiceDate: inv.invoiceDate,
    }));

    res.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        dateRange: {
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0],
          preset: range.preset,
          groupBy,
        },
        kpis: {
          salesMinor,
          moneyReceivedMinor,
          outstandingMinor,
          invoiceCount,
          averageInvoiceMinor,
          paidRatePercentage,
        },
        salesOverviewSeries: series,
        paymentMethods,
        paymentAccounts,
        topCustomers,
        bestSelling,
        outstandingInvoices,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/dashboard/recent-invoices
 * Lists recent 5-10 invoices for dashboard quick view.
 */
export async function getRecentInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string) || 5));

    const invoices = await Invoice.find({ businessId: req.businessId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('customerId', 'name');

    const formattedInvoices = invoices.map((inv: any) => {
      let customerName = inv.customerSnapshot?.name || '';
      if (!customerName && inv.customerId) {
        customerName = inv.customerId.name || '';
      }
      return {
        id: inv._id,
        invoiceNumber: inv.invoiceNumber || 'DRAFT',
        invoiceDate: inv.invoiceDate,
        customerName: customerName || 'Walk-in Customer',
        grandTotalMinor: inv.totals?.grandTotalMinor || 0,
        currency: inv.currency || 'INR',
        status: inv.status,
        paymentStatus: inv.paymentSummary?.status || 'UNPAID',
        paidAmountMinor: inv.paymentSummary?.paidAmountMinor || 0,
        dueAmountMinor: inv.paymentSummary?.dueAmountMinor || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        invoices: formattedInvoices,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/dashboard/recent-activity
 * Returns combined timeline of recent invoice creations and payment receipts.
 */
export async function getRecentActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const bId = new mongoose.Types.ObjectId(req.businessId);

    const [recentInvoices, recentPayments] = await Promise.all([
      Invoice.find({ businessId: bId, status: 'FINALIZED' })
        .sort({ finalizedAt: -1, createdAt: -1 })
        .limit(5)
        .select('invoiceNumber customerSnapshot totals finalizedAt createdAt'),
      Payment.find({ businessId: bId, status: 'CONFIRMED' })
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(5)
        .populate('invoiceId', 'invoiceNumber')
        .select('invoiceId amountMinor method paidAt referenceNumber'),
    ]);

    const activities: Array<{
      id: string;
      type: 'INVOICE_FINALIZED' | 'PAYMENT_RECEIVED';
      title: string;
      description: string;
      amountMinor: number;
      timestamp: Date;
    }> = [];

    recentInvoices.forEach((inv: any) => {
      activities.push({
        id: `inv_${inv._id}`,
        type: 'INVOICE_FINALIZED',
        title: `Invoice ${inv.invoiceNumber} finalized`,
        description: `Billed to ${inv.customerSnapshot?.name || 'Customer'}`,
        amountMinor: inv.totals?.grandTotalMinor || 0,
        timestamp: inv.finalizedAt || inv.createdAt,
      });
    });

    recentPayments.forEach((pay: any) => {
      const invNum = pay.invoiceId?.invoiceNumber || 'Invoice';
      activities.push({
        id: `pay_${pay._id}`,
        type: 'PAYMENT_RECEIVED',
        title: `Payment received via ${pay.method}`,
        description: `Associated with ${invNum}`,
        amountMinor: pay.amountMinor || 0,
        timestamp: pay.paidAt,
      });
    });

    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.status(200).json({
      success: true,
      data: {
        activities: activities.slice(0, 6),
      },
    });
  } catch (err: any) {
    next(err);
  }
}
