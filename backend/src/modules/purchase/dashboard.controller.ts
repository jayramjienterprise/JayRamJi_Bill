import { Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { Purchase } from '../../database/models/Purchase';
import { AppError } from '../../middleware/errorHandler';

/**
 * Get comprehensive Purchase Dashboard metrics
 */
export async function getPurchaseDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return next(new AppError('Business context required', 400, 'BUSINESS_REQUIRED'));
    }

    const bId = new Types.ObjectId(businessId);

    // Current month date boundaries
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      totalsAgg,
      monthAgg,
      pendingDeliveriesCount,
      partiallyReceivedCount,
      recentPurchases,
      topVendorsAgg,
      outstandingPayables,
    ] = await Promise.all([
      // 1. Overall totals
      Purchase.aggregate([
        { $match: { businessId: bId, status: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalPurchased: { $sum: '$totalAmount' },
            totalPaid: { $sum: '$paidAmount' },
            totalOutstanding: { $sum: '$outstandingAmount' },
          },
        },
      ]),

      // 2. This month totals
      Purchase.aggregate([
        {
          $match: {
            businessId: bId,
            status: { $ne: 'CANCELLED' },
            purchaseDate: { $gte: startOfMonth, $lte: endOfMonth },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
          },
        },
      ]),

      // 3. Pending deliveries count
      Purchase.countDocuments({
        businessId: bId,
        status: { $ne: 'CANCELLED' },
        receivingStatus: { $in: ['NOT_RECEIVED', 'PARTIALLY_RECEIVED'] },
      }),

      // 4. Partially received count
      Purchase.countDocuments({
        businessId: bId,
        status: { $ne: 'CANCELLED' },
        receivingStatus: 'PARTIALLY_RECEIVED',
      }),

      // 5. Recent purchases
      Purchase.find({ businessId: bId, status: { $ne: 'CANCELLED' } })
        .populate('vendorId', 'name vendorCode mobile')
        .sort({ purchaseDate: -1, createdAt: -1 })
        .limit(8)
        .lean(),

      // 6. Top Vendors by purchase volume
      Purchase.aggregate([
        { $match: { businessId: bId, status: { $ne: 'CANCELLED' } } },
        {
          $group: {
            _id: '$vendorId',
            totalPurchases: { $sum: 1 },
            totalAmount: { $sum: '$totalAmount' },
            totalPaid: { $sum: '$paidAmount' },
            outstandingAmount: { $sum: '$outstandingAmount' },
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'vendors',
            localField: '_id',
            foreignField: '_id',
            as: 'vendor',
          },
        },
        { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
      ]),

      // 7. Top outstanding payables
      Purchase.find({
        businessId: bId,
        status: { $ne: 'CANCELLED' },
        outstandingAmount: { $gt: 0 },
      })
        .populate('vendorId', 'name vendorCode')
        .sort({ outstandingAmount: -1 })
        .limit(6)
        .lean(),
    ]);

    const overall = totalsAgg[0] || {
      totalCount: 0,
      totalPurchased: 0,
      totalPaid: 0,
      totalOutstanding: 0,
    };

    const monthData = monthAgg[0] || {
      count: 0,
      totalAmount: 0,
    };

    res.json({
      success: true,
      data: {
        summary: {
          totalCount: overall.totalCount,
          totalPurchased: overall.totalPurchased,
          totalPaid: overall.totalPaid,
          totalOutstanding: overall.totalOutstanding,
          monthCount: monthData.count,
          monthPurchased: monthData.totalAmount,
          pendingDeliveriesCount,
          partiallyReceivedCount,
        },
        recentPurchases: recentPurchases.map((p) => ({
          ...p,
          id: p._id.toString(),
          vendor: p.vendorId,
        })),
        topVendors: topVendorsAgg.map((v) => ({
          vendorId: v._id?.toString(),
          name: v.vendor?.name || 'Unknown',
          vendorCode: v.vendor?.vendorCode || '',
          totalPurchases: v.totalPurchases,
          totalAmount: v.totalAmount,
          totalPaid: v.totalPaid,
          outstandingAmount: v.outstandingAmount,
        })),
        outstandingPayables: outstandingPayables.map((p) => ({
          ...p,
          id: p._id.toString(),
          vendor: p.vendorId,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}
