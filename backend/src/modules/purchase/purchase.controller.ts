import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import {
  Purchase,
  IPurchaseItem,
  PaymentStatus,
} from '../../database/models/Purchase';
import { Vendor } from '../../database/models/Vendor';
import { Product } from '../../database/models/Product';
import { InvoiceSequence } from '../../database/models/InvoiceSequence';
import { AppError } from '../../middleware/errorHandler';
import { processReceiving } from './receiving.controller';

const purchaseItemInputSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  productName: z.string().optional(),
  sku: z.string().nullable().optional(),
  orderedQuantity: z.number().min(1, 'Ordered quantity must be at least 1'),
  receivedQuantity: z.number().min(0).optional().default(0),
  unitPurchasePrice: z.number().min(0, 'Purchase price cannot be negative'),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  discountAmount: z.number().min(0).optional().default(0),
  taxRate: z.number().min(0).optional().default(0),
});

export const createPurchaseSchema = z.object({
  purchaseType: z.enum(['DIRECT_PURCHASE', 'ORDERED_PURCHASE']).default('DIRECT_PURCHASE'),
  vendorId: z.string().min(1, 'Vendor is required'),
  vendorInvoiceNumber: z.string().trim().nullable().optional(),
  purchaseDate: z.string().or(z.date()).optional(),
  invoiceDate: z.string().or(z.date()).nullable().optional(),
  dueDate: z.string().or(z.date()).nullable().optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).default('CONFIRMED'),
  items: z.array(purchaseItemInputSchema).min(1, 'At least one product item is required'),
  notes: z.string().nullable().optional(),
  directReceivedFull: z.boolean().optional().default(false), // Convenience flag for direct purchase
  allowDuplicateInvoice: z.boolean().optional().default(false),
});

export const updatePurchaseSchema = createPurchaseSchema.partial();

/**
 * Compute overall payment status from total and paid
 */
export function calculatePaymentStatus(totalAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount >= totalAmount) return 'PAID';
  return 'PARTIALLY_PAID';
}

/**
 * Generate sequential purchase number (e.g. PUR-2526-0001)
 */
async function generatePurchaseNumber(businessId: Types.ObjectId | string): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  const fyPrefix = `${startYear.toString().slice(-2)}${endYear.toString().padStart(2, '0')}`;

  const seq = await InvoiceSequence.findOneAndUpdate(
    { businessId: new Types.ObjectId(businessId), key: 'PURCHASE' },
    { $inc: { nextNumber: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const formattedNum = String(seq.nextNumber).padStart(4, '0');
  return `PUR-${fyPrefix}-${formattedNum}`;
}

/**
 * Check duplicate invoice number endpoint
 */
export async function checkDuplicateInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { vendorId, vendorInvoiceNumber, excludePurchaseId } = req.query;

    if (!vendorId || !vendorInvoiceNumber) {
      res.json({ success: true, isDuplicate: false });
      return;
    }

    const query: any = {
      businessId,
      vendorId,
      vendorInvoiceNumber: (vendorInvoiceNumber as string).trim(),
      status: { $ne: 'CANCELLED' },
    };

    if (excludePurchaseId) {
      query._id = { $ne: excludePurchaseId };
    }

    const existing = await Purchase.findOne(query).select('purchaseNumber vendorInvoiceNumber purchaseDate');

    res.json({
      success: true,
      data: {
        isDuplicate: !!existing,
        existingPurchase: existing
          ? {
              id: existing._id,
              purchaseNumber: existing.purchaseNumber,
              vendorInvoiceNumber: existing.vendorInvoiceNumber,
              purchaseDate: existing.purchaseDate,
            }
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List purchases with pagination, filters, and summary stats
 */
export async function listPurchases(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const {
      vendorId,
      purchaseType,
      receivingStatus,
      paymentStatus,
      status,
      search,
      startDate,
      endDate,
    } = req.query;

    const query: any = { businessId };

    if (vendorId && vendorId !== 'ALL') {
      query.vendorId = vendorId;
    }

    if (purchaseType && purchaseType !== 'ALL') {
      query.purchaseType = purchaseType;
    }

    if (receivingStatus && receivingStatus !== 'ALL') {
      query.receivingStatus = receivingStatus;
    }

    if (paymentStatus && paymentStatus !== 'ALL') {
      query.paymentStatus = paymentStatus;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    } else {
      // Default exclude cancelled unless explicitly requested
      query.status = { $ne: 'CANCELLED' };
    }

    if (startDate || endDate) {
      query.purchaseDate = {};
      if (startDate) query.purchaseDate.$gte = new Date(startDate as string);
      if (endDate) query.purchaseDate.$lte = new Date(endDate as string);
    }

    if (search && typeof search === 'string' && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { purchaseNumber: regex },
        { vendorInvoiceNumber: regex },
      ];
    }

    const purchases = await Purchase.find(query)
      .populate('vendorId', 'name vendorCode mobile gstNumber')
      .populate('createdBy', 'name email')
      .sort({ purchaseDate: -1, createdAt: -1 })
      .lean();

    // Summary calculation
    let totalPurchased = 0;
    let totalPaid = 0;
    let totalOutstanding = 0;

    const formattedPurchases = purchases.map((p) => {
      totalPurchased += p.totalAmount || 0;
      totalPaid += p.paidAmount || 0;
      totalOutstanding += p.outstandingAmount || 0;

      return {
        ...p,
        id: p._id.toString(),
        vendor: p.vendorId,
      };
    });

    res.json({
      success: true,
      data: {
        purchases: formattedPurchases,
        summary: {
          totalCount: formattedPurchases.length,
          totalPurchased,
          totalPaid,
          totalOutstanding,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get single purchase details
 */
export async function getPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { purchaseId } = req.params;

    const purchase = await Purchase.findOne({ _id: purchaseId, businessId })
      .populate('vendorId', 'name vendorCode contactPerson mobile alternateMobile email address city state pincode gstNumber paymentTerms')
      .populate('createdBy', 'name email')
      .populate('items.productId', 'name sku uom defaultPriceMinor lastPurchasePriceMinor stockQuantity')
      .lean();

    if (!purchase) {
      return next(new AppError('Purchase not found', 404, 'PURCHASE_NOT_FOUND'));
    }

    res.json({
      success: true,
      data: {
        purchase: {
          ...purchase,
          id: purchase._id.toString(),
          vendor: purchase.vendorId,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new Purchase
 */
export async function createPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return next(new AppError('Business context required', 400, 'BUSINESS_REQUIRED'));
    }
    const userId = (req as any).user?.id || (req as any).user?._id;
    const validated = createPurchaseSchema.parse(req.body);

    // 1. Verify vendor exists
    const vendor = await Vendor.findOne({ _id: validated.vendorId, businessId, isActive: true });
    if (!vendor) {
      return next(new AppError('Vendor not found or inactive', 404, 'VENDOR_NOT_FOUND'));
    }

    // 2. Duplicate invoice number check
    if (validated.vendorInvoiceNumber?.trim()) {
      const existing = await Purchase.findOne({
        businessId,
        vendorId: validated.vendorId,
        vendorInvoiceNumber: validated.vendorInvoiceNumber.trim(),
        status: { $ne: 'CANCELLED' },
      });

      if (existing && !validated.allowDuplicateInvoice) {
        return next(
          new AppError(
            `A purchase bill with invoice number "${validated.vendorInvoiceNumber}" already exists for ${vendor.name} (${existing.purchaseNumber}).`,
            409,
            'DUPLICATE_VENDOR_INVOICE'
          )
        );
      }
    }

    // 3. Resolve products and build snapshot items
    const productIds = validated.items.map((it) => it.productId);
    const existingProducts = await Product.find({ _id: { $in: productIds }, businessId }).lean();
    const productMap = new Map<string, any>();
    existingProducts.forEach((prod) => productMap.set(prod._id.toString(), prod));

    const processedItems: IPurchaseItem[] = [];
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;

    for (const item of validated.items) {
      const prod = productMap.get(item.productId);
      if (!prod) {
        return next(new AppError(`Product with ID ${item.productId} not found`, 400, 'PRODUCT_NOT_FOUND'));
      }

      // Snapshot product name and SKU
      const productNameSnapshot = prod.name;
      const skuSnapshot = prod.sku || item.sku || null;

      const orderedQty = item.orderedQuantity;

      // Financial calculations per line
      const grossAmount = orderedQty * item.unitPurchasePrice;
      const discountPercent = item.discountPercent || 0;
      const discountAmt = item.discountAmount > 0 ? item.discountAmount : (grossAmount * discountPercent) / 100;
      const taxable = Math.max(0, grossAmount - discountAmt);
      const taxRate = item.taxRate || 0;
      const taxAmt = (taxable * taxRate) / 100;
      const lineTotal = Math.round((taxable + taxAmt) * 100) / 100;

      subtotal += grossAmount;
      totalDiscount += discountAmt;
      totalTax += taxAmt;
      grandTotal += lineTotal;

      processedItems.push({
        productId: prod._id,
        productNameSnapshot,
        skuSnapshot,
        orderedQuantity: orderedQty,
        receivedQuantity: 0,
        remainingQuantity: orderedQty,
        unitPurchasePrice: item.unitPurchasePrice,
        discountPercent,
        discountAmount: discountAmt,
        taxRate,
        taxAmount: taxAmt,
        totalAmount: lineTotal,
        receivingStatus: 'NOT_RECEIVED',
      });
    }

    const purchaseNumber = await generatePurchaseNumber(businessId);

    const paidAmount = 0;
    const outstandingAmount = grandTotal;
    const paymentStatus: PaymentStatus = 'UNPAID';

    const purchase = await Purchase.create({
      businessId,
      purchaseNumber,
      purchaseType: validated.purchaseType,
      vendorId: validated.vendorId,
      vendorInvoiceNumber: validated.vendorInvoiceNumber?.trim() || null,
      purchaseDate: validated.purchaseDate ? new Date(validated.purchaseDate) : new Date(),
      invoiceDate: validated.invoiceDate ? new Date(validated.invoiceDate) : null,
      dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
      status: validated.status || 'CONFIRMED',
      receivingStatus: 'NOT_RECEIVED',
      paymentStatus,
      subtotal,
      discountAmount: totalDiscount,
      taxAmount: totalTax,
      totalAmount: grandTotal,
      paidAmount,
      outstandingAmount,
      items: processedItems,
      notes: validated.notes?.trim() || null,
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    // If Direct Purchase with immediate physical receipt, execute receiving workflow
    if (validated.purchaseType === 'DIRECT_PURCHASE' && validated.directReceivedFull) {
      await processReceiving({
        businessId,
        purchase,
        itemsToReceive: purchase.items.map((it: any) => ({
          purchaseItemId: it._id,
          quantityReceived: it.orderedQuantity,
        })),
        receivedBy: userId || purchase.createdBy,
        notes: 'Initial direct purchase receipt',
      });
    }

    res.status(201).json({
      success: true,
      data: {
        purchase,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel a purchase
 */
export async function cancelPurchase(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { purchaseId } = req.params;

    const purchase = await Purchase.findOne({ _id: purchaseId, businessId });
    if (!purchase) {
      return next(new AppError('Purchase not found', 404, 'PURCHASE_NOT_FOUND'));
    }

    if (purchase.receivingStatus !== 'NOT_RECEIVED') {
      return next(
        new AppError(
          'Cannot cancel a purchase where products have already been received. Reverse or return the goods first.',
          400,
          'RECEIVING_IN_PROGRESS'
        )
      );
    }

    if (purchase.paidAmount > 0) {
      return next(
        new AppError(
          'Cannot cancel a purchase with existing payment records. Remove or refund payments first.',
          400,
          'PAYMENTS_EXIST'
        )
      );
    }

    purchase.status = 'CANCELLED';
    await purchase.save();

    res.json({
      success: true,
      data: {
        purchase,
      },
    });
  } catch (error) {
    next(error);
  }
}
