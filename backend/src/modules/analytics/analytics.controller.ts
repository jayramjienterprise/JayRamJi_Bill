import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Invoice } from '../../database/models/Invoice';
import { Payment } from '../../database/models/Payment';
import { Customer } from '../../database/models/Customer';
import { resolveDateRange } from '../../utils/date-range';

/**
 * GET /api/analytics/overview
 * Authoritative high-level KPIs and previous period comparisons.
 */
export async function getAnalyticsOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const bId = new mongoose.Types.ObjectId(req.businessId);
    const range = resolveDateRange({
      preset: req.query.preset as string,
      from: req.query.from as string,
      to: req.query.to as string,
      groupBy: req.query.groupBy as string,
    });

    const { startDate, endDate, previousStartDate, previousEndDate } = range;

    // 1. Current Period Sales (Turnover & Orders)
    const currentSalesPromise = Invoice.aggregate([
      {
        $match: {
          businessId: bId,
          status: 'FINALIZED',
          invoiceDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          turnoverMinor: { $sum: '$totals.grandTotalMinor' },
          totalOrders: { $sum: 1 },
          uniqueCustomers: { $addToSet: { $ifNull: ['$customerId', '$customerSnapshot.name'] } },
        },
      },
    ]);

    // 2. Current Period Payments (Received)
    const currentPaymentsPromise = Payment.aggregate([
      {
        $match: {
          businessId: bId,
          status: 'CONFIRMED',
          paidAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalReceivedMinor: { $sum: '$amountMinor' },
          paymentCount: { $sum: 1 },
        },
      },
    ]);

    // 3. Current Outstanding across all finalized invoices
    const outstandingPromise = Invoice.aggregate([
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
          outstandingMinor: { $sum: '$paymentSummary.dueAmountMinor' },
        },
      },
    ]);

    // 4. Previous Comparison Period Sales
    const previousSalesPromise = previousStartDate && previousEndDate
      ? Invoice.aggregate([
          {
            $match: {
              businessId: bId,
              status: 'FINALIZED',
              invoiceDate: { $gte: previousStartDate, $lte: previousEndDate },
            },
          },
          {
            $group: {
              _id: null,
              turnoverMinor: { $sum: '$totals.grandTotalMinor' },
              totalOrders: { $sum: 1 },
            },
          },
        ])
      : Promise.resolve([]);

    // 5. Previous Comparison Period Payments
    const previousPaymentsPromise = previousStartDate && previousEndDate
      ? Payment.aggregate([
          {
            $match: {
              businessId: bId,
              status: 'CONFIRMED',
              paidAt: { $gte: previousStartDate, $lte: previousEndDate },
            },
          },
          {
            $group: {
              _id: null,
              totalReceivedMinor: { $sum: '$amountMinor' },
            },
          },
        ])
      : Promise.resolve([]);

    const [
      currentSales,
      currentPayments,
      outstandingResult,
      previousSales,
      previousPayments,
    ] = await Promise.all([
      currentSalesPromise,
      currentPaymentsPromise,
      outstandingPromise,
      previousSalesPromise,
      previousPaymentsPromise,
    ]);

    const salesData = currentSales[0] || { turnoverMinor: 0, totalOrders: 0, uniqueCustomers: [] };
    const payData = currentPayments[0] || { totalReceivedMinor: 0, paymentCount: 0 };
    const outData = outstandingResult[0] || { outstandingMinor: 0 };

    const turnoverMinor = salesData.turnoverMinor;
    const totalOrders = salesData.totalOrders;
    const uniqueCustomers = salesData.uniqueCustomers.length;
    const totalReceivedMinor = payData.totalReceivedMinor;
    const outstandingMinor = outData.outstandingMinor;
    const averageOrderValueMinor = totalOrders > 0 ? Math.round(turnoverMinor / totalOrders) : 0;
    const collectionRate = turnoverMinor > 0 ? Math.min(100, Math.round((totalReceivedMinor / turnoverMinor) * 1000) / 10) : 0;

    // Previous period comparisons
    const prevSalesData = previousSales[0] || { turnoverMinor: 0, totalOrders: 0 };
    const prevPayData = previousPayments[0] || { totalReceivedMinor: 0 };

    function calcGrowth(curr: number, prev: number): number | null {
      if (prev <= 0) return null;
      return Math.round(((curr - prev) / prev) * 1000) / 10;
    }

    const turnoverGrowthPercent = calcGrowth(turnoverMinor, prevSalesData.turnoverMinor);
    const receivedGrowthPercent = calcGrowth(totalReceivedMinor, prevPayData.totalReceivedMinor);
    const ordersGrowthPercent = calcGrowth(totalOrders, prevSalesData.totalOrders);

    res.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        dateRange: {
          from: startDate.toISOString().split('T')[0],
          to: endDate.toISOString().split('T')[0],
          preset: range.preset,
          groupBy: range.groupBy,
        },
        kpis: {
          turnoverMinor,
          totalReceivedMinor,
          outstandingMinor,
          totalOrders,
          uniqueCustomers,
          averageOrderValueMinor,
          collectionRate,
        },
        comparison: {
          hasPreviousData: Boolean(previousStartDate && prevSalesData.turnoverMinor > 0),
          prevTurnoverMinor: prevSalesData.turnoverMinor,
          prevReceivedMinor: prevPayData.totalReceivedMinor,
          prevOrders: prevSalesData.totalOrders,
          turnoverGrowthPercent,
          receivedGrowthPercent,
          ordersGrowthPercent,
        },
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/analytics/sales-trend
 * Adaptive time-series data for Sales vs Payments chart.
 */
export async function getSalesTrend(req: Request, res: Response, next: NextFunction) {
  try {
    const bId = new mongoose.Types.ObjectId(req.businessId);
    const range = resolveDateRange({
      preset: req.query.preset as string,
      from: req.query.from as string,
      to: req.query.to as string,
      groupBy: req.query.groupBy as string,
    });

    const { startDate, endDate, groupBy } = range;

    let dateGroupFormat = '%Y-%m-%d';
    if (groupBy === 'hour') dateGroupFormat = '%Y-%m-%d %H:00';
    else if (groupBy === 'month') dateGroupFormat = '%Y-%m';
    else if (groupBy === 'week') dateGroupFormat = '%Y-W%V';

    const [salesTimeline, paymentsTimeline] = await Promise.all([
      Invoice.aggregate([
        {
          $match: {
            businessId: bId,
            status: 'FINALIZED',
            invoiceDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: dateGroupFormat, date: '$invoiceDate' } },
            salesMinor: { $sum: '$totals.grandTotalMinor' },
            invoiceCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        {
          $match: {
            businessId: bId,
            status: 'CONFIRMED',
            paidAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: dateGroupFormat, date: '$paidAt' } },
            receivedMinor: { $sum: '$amountMinor' },
            paymentCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

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

    res.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        groupBy,
        series,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/analytics/payment-methods
 * Breakdown and frequencies by payment method.
 */
export async function getPaymentMethodAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const bId = new mongoose.Types.ObjectId(req.businessId);
    const range = resolveDateRange({
      preset: req.query.preset as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });

    const { startDate, endDate } = range;

    const methodsResult = await Payment.aggregate([
      {
        $match: {
          businessId: bId,
          status: 'CONFIRMED',
          paidAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$method',
          amountMinor: { $sum: '$amountMinor' },
          transactions: { $sum: 1 },
        },
      },
      { $sort: { amountMinor: -1 } },
    ]);

    const totalReceivedMinor = methodsResult.reduce((sum, m) => sum + m.amountMinor, 0);
    const totalTransactions = methodsResult.reduce((sum, m) => sum + m.transactions, 0);

    const methods = methodsResult.map((m) => ({
      method: m._id,
      label: m._id ? m._id.replace('_', ' ') : 'CASH',
      transactions: m.transactions,
      amountMinor: m.amountMinor,
      percentage: totalReceivedMinor > 0 ? Math.round((m.amountMinor / totalReceivedMinor) * 1000) / 10 : 0,
      transactionPercentage: totalTransactions > 0 ? Math.round((m.transactions / totalTransactions) * 1000) / 10 : 0,
    }));

    // Find most used method by frequency & highest value method
    let mostUsedMethod = null;
    let highestValueMethod = null;

    if (methods.length > 0) {
      const byCount = [...methods].sort((a, b) => b.transactions - a.transactions)[0];
      const byAmount = [...methods].sort((a, b) => b.amountMinor - a.amountMinor)[0];

      mostUsedMethod = {
        method: byCount.method,
        label: byCount.label,
        count: byCount.transactions,
        percentage: byCount.transactionPercentage,
      };

      highestValueMethod = {
        method: byAmount.method,
        label: byAmount.label,
        amountMinor: byAmount.amountMinor,
        percentage: byAmount.percentage,
      };
    }

    res.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        totalReceivedMinor,
        totalTransactions,
        methods,
        mostUsedMethod,
        highestValueMethod,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/analytics/receiving-accounts
 * Money received by each receiving bank/UPI/cash account.
 */
export async function getReceivingAccountsAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const bId = new mongoose.Types.ObjectId(req.businessId);
    const range = resolveDateRange({
      preset: req.query.preset as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });

    const { startDate, endDate } = range;

    const accountsResult = await Payment.aggregate([
      {
        $match: {
          businessId: bId,
          status: 'CONFIRMED',
          paidAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            id: { $ifNull: ['$paymentAccountId', null] },
            displayName: { $ifNull: ['$paymentAccountSnapshot.displayName', { $ifNull: ['$paymentAccountSnapshot.name', 'Shop Counter Cash'] }] },
            type: { $ifNull: ['$paymentAccountSnapshot.type', '$method'] },
          },
          amountMinor: { $sum: '$amountMinor' },
          paymentCount: { $sum: 1 },
        },
      },
      { $sort: { amountMinor: -1 } },
    ]);

    const totalReceivedMinor = accountsResult.reduce((sum, a) => sum + a.amountMinor, 0);

    const accounts = accountsResult.map((a) => ({
      accountId: a._id.id ? a._id.id.toString() : null,
      accountName: a._id.displayName,
      type: a._id.type,
      paymentCount: a.paymentCount,
      amountReceivedMinor: a.amountMinor,
      percentage: totalReceivedMinor > 0 ? Math.round((a.amountMinor / totalReceivedMinor) * 1000) / 10 : 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        totalReceivedMinor,
        accounts,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/analytics/customers
 * Customers performance, order history, and outstanding balance.
 */
export async function getCustomerAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const bId = new mongoose.Types.ObjectId(req.businessId);
    const range = resolveDateRange({
      preset: req.query.preset as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });

    const { startDate, endDate } = range;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const sortBy = (req.query.sortBy as string) || 'sales'; // 'sales' | 'orders' | 'outstanding'

    let sortStage: any = { turnoverMinor: -1 };
    if (sortBy === 'orders') sortStage = { orderCount: -1, turnoverMinor: -1 };
    else if (sortBy === 'outstanding') sortStage = { outstandingMinor: -1, turnoverMinor: -1 };

    const [customersResult, totalCustomersCount] = await Promise.all([
      Invoice.aggregate([
        {
          $match: {
            businessId: bId,
            status: 'FINALIZED',
            invoiceDate: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$customerId', '$customerSnapshot.name'] },
            customerName: { $first: { $ifNull: ['$customerSnapshot.name', 'Walk-in Customer'] } },
            orderCount: { $sum: 1 },
            turnoverMinor: { $sum: '$totals.grandTotalMinor' },
            paidMinor: { $sum: '$paymentSummary.paidAmountMinor' },
            outstandingMinor: { $sum: '$paymentSummary.dueAmountMinor' },
          },
        },
        { $sort: sortStage },
        { $limit: limit },
      ]),
      Customer.countDocuments({ businessId: bId, active: true }),
    ]);

    const customers = customersResult.map((c) => ({
      customerId: c._id ? c._id.toString() : 'anonymous',
      customerName: c.customerName,
      orders: c.orderCount,
      turnoverMinor: c.turnoverMinor,
      paidMinor: c.paidMinor,
      outstandingMinor: c.outstandingMinor,
      averageOrderMinor: c.orderCount > 0 ? Math.round(c.turnoverMinor / c.orderCount) : 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        totalRegisteredCustomers: totalCustomersCount,
        activeInPeriod: customers.length,
        customers,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/analytics/products
 * Products & Services sales analysis derived strictly from finalized invoice line-items.
 */
export async function getProductAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const bId = new mongoose.Types.ObjectId(req.businessId);
    const range = resolveDateRange({
      preset: req.query.preset as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });

    const { startDate, endDate } = range;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const sortBy = (req.query.sortBy as string) || 'revenue'; // 'revenue' | 'quantity' | 'orders'

    let sortStage: any = { revenueMinor: -1 };
    if (sortBy === 'quantity') sortStage = { quantitySold: -1, revenueMinor: -1 };
    else if (sortBy === 'orders') sortStage = { orderCount: -1, revenueMinor: -1 };

    const itemsResult = await Invoice.aggregate([
      {
        $match: {
          businessId: bId,
          status: 'FINALIZED',
          invoiceDate: { $gte: startDate, $lte: endDate },
        },
      },
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
      { $sort: sortStage },
      { $limit: limit },
    ]);

    // Calculate total turnover in the period to compute percentage of turnover
    const totalTurnoverResult = await Invoice.aggregate([
      {
        $match: {
          businessId: bId,
          status: 'FINALIZED',
          invoiceDate: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalTurnoverMinor: { $sum: '$totals.grandTotalMinor' },
        },
      },
    ]);

    const totalTurnoverMinor = totalTurnoverResult[0]?.totalTurnoverMinor || 0;

    const products = itemsResult.map((p) => ({
      description: p.description,
      type: p.type || 'PRODUCT',
      quantitySold: p.quantitySold,
      orders: p.orderCount,
      revenueMinor: p.revenueMinor,
      averagePriceMinor: p.quantitySold > 0 ? Math.round(p.revenueMinor / p.quantitySold) : 0,
      percentOfTurnover: totalTurnoverMinor > 0 ? Math.round((p.revenueMinor / totalTurnoverMinor) * 1000) / 10 : 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        totalTurnoverMinor,
        products,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

/**
 * GET /api/analytics/outstanding
 * Detailed breakdown of unpaid and partial invoices and top outstanding customers.
 */
export async function getOutstandingAnalytics(req: Request, res: Response, next: NextFunction) {
  try {
    const bId = new mongoose.Types.ObjectId(req.businessId);

    const [breakdownResult, topOutstandingCustomersResult] = await Promise.all([
      Invoice.aggregate([
        {
          $match: {
            businessId: bId,
            status: 'FINALIZED',
            'paymentSummary.dueAmountMinor': { $gt: 0 },
          },
        },
        {
          $group: {
            _id: '$paymentSummary.status',
            totalDueMinor: { $sum: '$paymentSummary.dueAmountMinor' },
            count: { $sum: 1 },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $match: {
            businessId: bId,
            status: 'FINALIZED',
            'paymentSummary.dueAmountMinor': { $gt: 0 },
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$customerId', '$customerSnapshot.name'] },
            customerName: { $first: { $ifNull: ['$customerSnapshot.name', 'Walk-in Customer'] } },
            phone: { $first: '$customerSnapshot.contact.phone' },
            totalDueMinor: { $sum: '$paymentSummary.dueAmountMinor' },
            invoiceCount: { $sum: 1 },
          },
        },
        { $sort: { totalDueMinor: -1 } },
        { $limit: 10 },
      ]),
    ]);

    let totalOutstandingMinor = 0;
    let outstandingInvoiceCount = 0;
    let unpaidMinor = 0;
    let unpaidCount = 0;
    let partialMinor = 0;
    let partialCount = 0;

    breakdownResult.forEach((b) => {
      totalOutstandingMinor += b.totalDueMinor;
      outstandingInvoiceCount += b.count;
      if (b._id === 'UNPAID') {
        unpaidMinor = b.totalDueMinor;
        unpaidCount = b.count;
      } else if (b._id === 'PARTIALLY_PAID' || b._id === 'PARTIAL') {
        partialMinor = b.totalDueMinor;
        partialCount = b.count;
      }
    });

    const averageDueMinor = outstandingInvoiceCount > 0 ? Math.round(totalOutstandingMinor / outstandingInvoiceCount) : 0;

    const topCustomers = topOutstandingCustomersResult.map((c) => ({
      customerId: c._id ? c._id.toString() : 'anonymous',
      customerName: c.customerName,
      phone: c.phone || null,
      outstandingMinor: c.totalDueMinor,
      invoiceCount: c.invoiceCount,
    }));

    res.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        totalOutstandingMinor,
        outstandingInvoiceCount,
        outstandingCustomerCount: topCustomers.length,
        averageDueMinor,
        breakdown: {
          unpaidMinor,
          unpaidCount,
          partialMinor,
          partialCount,
        },
        topCustomers,
      },
    });
  } catch (err: any) {
    next(err);
  }
}
