import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Vendor } from '../../database/models/Vendor';
import { Purchase } from '../../database/models/Purchase';
import { AppError } from '../../middleware/errorHandler';

export const vendorSchema = z.object({
  vendorCode: z.string().trim().optional(),
  name: z.string().min(1, 'Vendor name is required').trim(),
  contactPerson: z.string().trim().nullable().optional(),
  mobile: z.string().trim().nullable().optional(),
  alternateMobile: z.string().trim().nullable().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')).nullable().optional(),
  address: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  pincode: z.string().trim().nullable().optional(),
  gstNumber: z.string().trim().toUpperCase().nullable().optional(),
  paymentTerms: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateVendorSchema = vendorSchema.partial();

/**
 * List all vendors for the business with aggregate financial balances
 */
export async function listVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { search, isActive } = req.query;

    const query: any = { businessId };
    if (isActive !== undefined) {
      query.isActive = isActive === 'true';
    }

    if (search && typeof search === 'string' && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { vendorCode: regex },
        { mobile: regex },
        { gstNumber: regex },
        { contactPerson: regex },
      ];
    }

    const vendors = await Vendor.find(query).sort({ name: 1 }).lean();

    // Fetch aggregate financial stats per vendor
    const vendorIds = vendors.map((v) => v._id);
    const purchaseStats = await Purchase.aggregate([
      {
        $match: {
          businessId: new Types.ObjectId(businessId),
          vendorId: { $in: vendorIds },
          status: { $ne: 'CANCELLED' },
        },
      },
      {
        $group: {
          _id: '$vendorId',
          totalPurchases: { $sum: 1 },
          totalAmountPurchased: { $sum: '$totalAmount' },
          totalAmountPaid: { $sum: '$paidAmount' },
          outstandingAmount: { $sum: '$outstandingAmount' },
        },
      },
    ]);

    const statsMap = new Map<string, any>();
    purchaseStats.forEach((stat) => {
      statsMap.set(stat._id.toString(), stat);
    });

    const enrichedVendors = vendors.map((v) => {
      const stats = statsMap.get(v._id.toString()) || {
        totalPurchases: 0,
        totalAmountPurchased: 0,
        totalAmountPaid: 0,
        outstandingAmount: 0,
      };
      return {
        ...v,
        id: v._id.toString(),
        totalPurchases: stats.totalPurchases,
        totalAmountPurchased: stats.totalAmountPurchased,
        totalAmountPaid: stats.totalAmountPaid,
        outstandingAmount: stats.outstandingAmount,
      };
    });

    res.json({
      success: true,
      data: {
        vendors: enrichedVendors,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get vendor profile by ID including purchase & balance history
 */
export async function getVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { vendorId } = req.params;

    const vendor = await Vendor.findOne({ _id: vendorId, businessId }).lean();
    if (!vendor) {
      return next(new AppError('Vendor not found', 404, 'VENDOR_NOT_FOUND'));
    }

    // Compute financial aggregates
    const stats = await Purchase.aggregate([
      {
        $match: {
          businessId: new Types.ObjectId(businessId),
          vendorId: new Types.ObjectId(vendorId),
          status: { $ne: 'CANCELLED' },
        },
      },
      {
        $group: {
          _id: '$vendorId',
          totalPurchases: { $sum: 1 },
          totalAmountPurchased: { $sum: '$totalAmount' },
          totalAmountPaid: { $sum: '$paidAmount' },
          outstandingAmount: { $sum: '$outstandingAmount' },
        },
      },
    ]);

    const financialSummary = stats[0] || {
      totalPurchases: 0,
      totalAmountPurchased: 0,
      totalAmountPaid: 0,
      outstandingAmount: 0,
    };

    // Recent purchases
    const recentPurchases = await Purchase.find({
      businessId,
      vendorId,
    })
      .sort({ purchaseDate: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      data: {
        vendor: {
          ...vendor,
          id: vendor._id.toString(),
          ...financialSummary,
          recentPurchases,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new vendor
 */
export async function createVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const validated = vendorSchema.parse(req.body);

    let vendorCode = validated.vendorCode;
    if (!vendorCode) {
      const count = await Vendor.countDocuments({ businessId });
      vendorCode = `VEN-${String(count + 1).padStart(3, '0')}`;
    }

    const existingCode = await Vendor.findOne({ businessId, vendorCode });
    if (existingCode) {
      const count = await Vendor.countDocuments({ businessId });
      vendorCode = `VEN-${String(count + 1).padStart(3, '0')}-${Date.now().toString().slice(-4)}`;
    }

    const vendor = await Vendor.create({
      ...validated,
      vendorCode,
      businessId,
    });

    res.status(201).json({
      success: true,
      data: {
        vendor,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update vendor details
 */
export async function updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { vendorId } = req.params;
    const validated = updateVendorSchema.parse(req.body);

    const vendor = await Vendor.findOneAndUpdate(
      { _id: vendorId, businessId },
      { $set: validated },
      { new: true, runValidators: true }
    );

    if (!vendor) {
      return next(new AppError('Vendor not found', 404, 'VENDOR_NOT_FOUND'));
    }

    res.json({
      success: true,
      data: {
        vendor,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle vendor active status
 */
export async function toggleVendorStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { vendorId } = req.params;

    const vendor = await Vendor.findOne({ _id: vendorId, businessId });
    if (!vendor) {
      return next(new AppError('Vendor not found', 404, 'VENDOR_NOT_FOUND'));
    }

    vendor.isActive = !vendor.isActive;
    await vendor.save();

    res.json({
      success: true,
      data: {
        vendor,
      },
    });
  } catch (error) {
    next(error);
  }
}
