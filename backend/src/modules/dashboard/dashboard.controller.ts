import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Invoice } from '../../database/models/Invoice';

export async function getOverview(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: any = {
      businessId: new mongoose.Types.ObjectId(req.businessId),
      status: 'FINALIZED',
    };

    if (req.query.from || req.query.to) {
      filter.invoiceDate = {};
      if (req.query.from) {
        filter.invoiceDate.$gte = new Date(req.query.from as string);
      }
      if (req.query.to) {
        filter.invoiceDate.$lte = new Date(req.query.to as string + 'T23:59:59.999Z');
      }
    }

    const overviewResult = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          revenueMinor: { $sum: '$totals.grandTotalMinor' },
          paidMinor: { $sum: '$paymentSummary.paidAmountMinor' },
          outstandingMinor: { $sum: '$paymentSummary.dueAmountMinor' },
          invoiceCount: { $sum: 1 },
        },
      },
    ]);

    const data = overviewResult[0] || {
      revenueMinor: 0,
      paidMinor: 0,
      outstandingMinor: 0,
      invoiceCount: 0,
    };

    const averageInvoiceMinor = data.invoiceCount > 0 ? Math.round(data.revenueMinor / data.invoiceCount) : 0;

    res.status(200).json({
      success: true,
      data: {
        revenueMinor: data.revenueMinor,
        invoiceCount: data.invoiceCount,
        paidMinor: data.paidMinor,
        outstandingMinor: data.outstandingMinor,
        averageInvoiceMinor,
        currency: 'INR',
      },
    });
  } catch (err: any) {
    next(err);
  }
}

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
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate,
        customer: {
          name: customerName,
        },
        totalMinor: inv.totals?.grandTotalMinor || 0,
        currency: inv.currency,
        status: inv.status,
        paymentStatus: inv.paymentSummary?.status || 'UNPAID',
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
