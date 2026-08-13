import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Business } from '../../database/models/Business';
import { AppError } from '../../middleware/errorHandler';

function maskAccountNumber(accountNumber: string | null): string | null {
  if (!accountNumber) return null;
  if (accountNumber.length <= 4) return 'XXXX';
  const visibleLength = 4;
  const maskedLength = accountNumber.length - visibleLength;
  return 'X'.repeat(maskedLength) + accountNumber.slice(-visibleLength);
}

// Zod validation schemas
const updateBusinessSchema = z.object({
  name: z.string().min(1, 'Business name cannot be empty').optional(),
  legalName: z.string().nullable().optional(),
  displayName: z.string().nullable().optional(),
  address: z
    .object({
      line1: z.string().min(1, 'Address Line 1 is required'),
      line2: z.string().nullable().optional(),
      city: z.string().nullable().optional(),
      state: z.string().nullable().optional(),
      postalCode: z.string().nullable().optional(),
      country: z.string().default('India'),
    })
    .optional(),
  contact: z
    .object({
      phone: z.string().nullable().optional(),
      email: z.string().email('Invalid email address').nullable().optional(),
      website: z.string().nullable().optional(),
    })
    .optional(),
  timezone: z.string().optional(),
  taxProfile: z
    .object({
      gstin: z.string().nullable().optional(),
      pan: z.string().nullable().optional(),
      taxRegistrationType: z.string().nullable().optional(),
    })
    .optional(),
  bankDetails: z
    .object({
      bankName: z.string().nullable().optional(),
      accountHolderName: z.string().nullable().optional(),
      accountNumber: z.string().nullable().optional(),
      ifsc: z.string().nullable().optional(),
      branch: z.string().nullable().optional(),
    })
    .optional(),
});

const updateInvoiceSettingsSchema = z.object({
  invoiceTitle: z.string().min(1, 'Invoice title is required'),
  prefix: z.string().min(1, 'Invoice prefix is required'),
  defaultCurrency: z.enum(['INR']),
  defaultPaymentTerms: z.string().nullable().optional(),
  defaultTaxMode: z.enum(['NONE', 'EXCLUSIVE', 'INCLUSIVE']),
  defaultTaxRateBps: z.coerce.number().min(0, 'Tax rate cannot be negative'),
});

const updatePaymentSettingsSchema = z.object({
  defaultPaymentStatus: z.enum(['UNPAID']),
});

/**
 * Fetches the current business workspace details
 */
export async function getBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const business = await Business.findById(req.businessId);
    if (!business) {
      return next(new AppError('Business settings not found', 404, 'NOT_FOUND'));
    }

    const businessObj = business.toObject();
    if (req.membership && req.membership.role === 'STAFF') {
      if (businessObj.bankDetails && businessObj.bankDetails.accountNumber) {
        businessObj.bankDetails.accountNumber = maskAccountNumber(businessObj.bankDetails.accountNumber);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        business: businessObj,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates basic business workspace profile information
 */
export async function updateBusiness(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const validated = updateBusinessSchema.parse(req.body);

    const updateFields: Record<string, any> = {};
    if (validated.name !== undefined) updateFields.name = validated.name;
    if (validated.legalName !== undefined) updateFields.legalName = validated.legalName;
    if (validated.displayName !== undefined) updateFields.displayName = validated.displayName;
    if (validated.timezone !== undefined) updateFields.timezone = validated.timezone;

    if (validated.address) {
      for (const [key, value] of Object.entries(validated.address)) {
        updateFields[`address.${key}`] = value;
      }
    }
    if (validated.contact) {
      for (const [key, value] of Object.entries(validated.contact)) {
        updateFields[`contact.${key}`] = value;
      }
    }
    if (validated.taxProfile) {
      for (const [key, value] of Object.entries(validated.taxProfile)) {
        updateFields[`taxProfile.${key}`] = value;
      }
    }
    if (validated.bankDetails) {
      for (const [key, value] of Object.entries(validated.bankDetails)) {
        updateFields[`bankDetails.${key}`] = value;
      }
    }

    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!business) {
      return next(new AppError('Business settings not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        business,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates default settings for future generated invoices
 */
export async function updateInvoiceSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validated = updateInvoiceSettingsSchema.parse(req.body);

    const updateFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(validated)) {
      updateFields[`invoiceSettings.${key}`] = value;
    }

    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!business) {
      return next(new AppError('Business settings not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        invoiceSettings: business.invoiceSettings,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Updates default settings for invoice payment tracking
 */
export async function updatePaymentSettings(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const validated = updatePaymentSettingsSchema.parse(req.body);

    const updateFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(validated)) {
      updateFields[`paymentSettings.${key}`] = value;
    }

    const business = await Business.findByIdAndUpdate(
      req.businessId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!business) {
      return next(new AppError('Business settings not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: {
        paymentSettings: business.paymentSettings,
      },
    });
  } catch (error) {
    next(error);
  }
}
