import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Invoice } from '../../database/models/Invoice';

export async function getRevenue(req: Request, res: Response, next: NextFunction) {
  try {
    const groupBy = req.query.groupBy === 'day' ? 'day' : 'month';
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

    const dateGrouping = groupBy === 'day'
      ? { $dateToString: { format: '%Y-%m-%d', date: '$invoiceDate' } }
      : { $dateToString: { format: '%Y-%m', date: '$invoiceDate' } };

    const revenueResult = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: dateGrouping,
          revenueMinor: { $sum: '$totals.grandTotalMinor' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const series = revenueResult.map((r) => ({
      period: r._id,
      revenueMinor: r.revenueMinor,
    }));

    res.status(200).json({
      success: true,
      data: {
        currency: 'INR',
        series,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function getTopServices(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
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

    const servicesResult = await Invoice.aggregate([
      { $match: filter },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.description',
          quantity: { $sum: '$items.quantity' },
          revenueMinor: { $sum: '$items.lineTotalMinor' },
        },
      },
      { $sort: { quantity: -1, revenueMinor: -1 } },
      { $limit: limit },
    ]);

    const services = servicesResult.map((s) => ({
      description: s._id,
      quantity: s.quantity,
      revenueMinor: s.revenueMinor,
    }));

    res.status(200).json({
      success: true,
      data: {
        services,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function getOutstanding(req: Request, res: Response, next: NextFunction) {
  try {
    const outstandingResult = await Invoice.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(req.businessId),
          status: 'FINALIZED',
          'paymentSummary.dueAmountMinor': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          totalOutstandingMinor: { $sum: '$paymentSummary.dueAmountMinor' },
          invoiceCount: { $sum: 1 },
        },
      },
    ]);

    const outData = outstandingResult[0] || {
      totalOutstandingMinor: 0,
      invoiceCount: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        totalOutstandingMinor: outData.totalOutstandingMinor,
        invoiceCount: outData.invoiceCount,
        currency: 'INR',
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function getCustomers(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
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

    const customersResult = await Invoice.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $ifNull: ['$customerId', '$customerSnapshot.name'] },
          customerName: { $first: { $ifNull: ['$customerSnapshot.name', 'Unknown Customer'] } },
          invoiceCount: { $sum: 1 },
          revenueMinor: { $sum: '$totals.grandTotalMinor' },
        },
      },
      { $sort: { revenueMinor: -1, invoiceCount: -1 } },
      { $limit: limit },
    ]);

    const customers = customersResult.map((c) => ({
      customerId: c._id ? c._id.toString() : 'anonymous',
      customerName: c.customerName,
      invoiceCount: c.invoiceCount,
      revenueMinor: c.revenueMinor,
    }));

    res.status(200).json({
      success: true,
      data: {
        customers,
      },
    });
  } catch (err: any) {
    next(err);
  }
}
