import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Purchase, PaymentStatus } from '../../database/models/Purchase';
import { VendorPayment, VendorPaymentMethod } from '../../database/models/VendorPayment';
import { InvoiceSequence } from '../../database/models/InvoiceSequence';
import { AppError } from '../../middleware/errorHandler';

const recordPaymentSchema = z.object({
  amount: z.number().min(0.01, 'Payment amount must be greater than 0'),
  paymentMethod: z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']).default('UPI'),
  paymentDate: z.string().or(z.date()).optional(),
  referenceNumber: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

/**
 * Generate sequential vendor payment number (e.g. VPAY-2526-0001)
 */
export async function generatePaymentNumber(businessId: Types.ObjectId | string): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const startYear = month >= 4 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  const fyPrefix = `${startYear.toString().slice(-2)}${endYear.toString().padStart(2, '0')}`;

  const seq = await InvoiceSequence.findOneAndUpdate(
    { businessId: new Types.ObjectId(businessId), key: 'VENDOR_PAYMENT' },
    { $inc: { nextNumber: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const formattedNum = String(seq.nextNumber).padStart(4, '0');
  return `VPAY-${fyPrefix}-${formattedNum}`;
}

/**
 * Compute payment status from total and paid amounts
 */
export function calculatePaymentStatus(totalAmount: number, paidAmount: number): PaymentStatus {
  if (paidAmount <= 0) return 'UNPAID';
  if (paidAmount >= totalAmount) return 'PAID';
  return 'PARTIALLY_PAID';
}

/**
 * Record a payment against a purchase bill
 */
export async function recordPurchasePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    if (!businessId) {
      return next(new AppError('Business context required', 400, 'BUSINESS_REQUIRED'));
    }

    const { purchaseId } = req.params;
    const userId = (req as any).user?.id || (req as any).user?._id;
    const validated = recordPaymentSchema.parse(req.body);

    const purchase = await Purchase.findOne({ _id: purchaseId, businessId });
    if (!purchase) {
      return next(new AppError('Purchase not found', 404, 'PURCHASE_NOT_FOUND'));
    }

    if (purchase.status === 'CANCELLED') {
      return next(new AppError('Cannot record payment for a cancelled purchase', 400, 'PURCHASE_CANCELLED'));
    }

    // Overpayment check
    const currentOutstanding = purchase.outstandingAmount ?? (purchase.totalAmount - (purchase.paidAmount || 0));
    if (validated.amount > currentOutstanding) {
      return next(
        new AppError(
          `Payment amount (₹${validated.amount}) cannot exceed current outstanding balance (₹${currentOutstanding}).`,
          400,
          'OVERPAYMENT_NOT_ALLOWED'
        )
      );
    }

    const paymentNumber = await generatePaymentNumber(businessId);

    const payment = await VendorPayment.create({
      businessId,
      vendorId: purchase.vendorId,
      purchaseId: purchase._id,
      paymentNumber,
      amount: validated.amount,
      paymentMethod: validated.paymentMethod as VendorPaymentMethod,
      paymentDate: validated.paymentDate ? new Date(validated.paymentDate) : new Date(),
      referenceNumber: validated.referenceNumber || null,
      notes: validated.notes || null,
      createdBy: userId ? new Types.ObjectId(userId) : undefined,
    });

    // Update purchase paid amount and outstanding balance
    purchase.paidAmount = Math.round(((purchase.paidAmount || 0) + validated.amount) * 100) / 100;
    purchase.outstandingAmount = Math.max(0, Math.round((purchase.totalAmount - purchase.paidAmount) * 100) / 100);
    purchase.paymentStatus = calculatePaymentStatus(purchase.totalAmount, purchase.paidAmount);
    await purchase.save();

    res.status(201).json({
      success: true,
      data: {
        payment,
        purchase,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all payment records for a specific purchase
 */
export async function listPurchasePayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { purchaseId } = req.params;

    const payments = await VendorPayment.find({ purchaseId, businessId })
      .populate('createdBy', 'name email')
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        payments: payments.map((p) => ({
          ...p,
          id: p._id.toString(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all payments for a vendor across all purchases
 */
export async function listVendorPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { vendorId } = req.params;

    const payments = await VendorPayment.find({ vendorId, businessId })
      .populate('purchaseId', 'purchaseNumber vendorInvoiceNumber totalAmount paidAmount outstandingAmount')
      .populate('createdBy', 'name email')
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        payments: payments.map((p) => ({
          ...p,
          id: p._id.toString(),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
}
