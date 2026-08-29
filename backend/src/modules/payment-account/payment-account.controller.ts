import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PaymentAccount } from '../../database/models/PaymentAccount';
import { Asset } from '../../database/models/Asset';
import { AppError } from '../../middleware/errorHandler';

// Zod validation schemas
const createPaymentAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').trim(),
  displayName: z.string().trim().optional(),
  type: z.enum(['BANK', 'UPI', 'CASH']),
  // Bank fields
  bankName: z.string().trim().optional().nullable(),
  accountHolderName: z.string().trim().optional().nullable(),
  accountNumber: z.string().trim().optional().nullable(),
  ifsc: z.string().trim().optional().nullable(),
  branch: z.string().trim().optional().nullable(),
  // UPI fields
  upiId: z.string().trim().optional().nullable(),
  qrAssetId: z.string().trim().optional().nullable(),
  qrAssetUrl: z.string().trim().optional().nullable(),
  isDefault: z.boolean().optional().default(false),
});

const updatePaymentAccountSchema = createPaymentAccountSchema.partial();

export async function listPaymentAccounts(req: Request, res: Response, next: NextFunction) {
  try {
    const filter: any = { businessId: req.businessId };

    if (req.query.active !== undefined) {
      filter.active = req.query.active === 'true';
    }

    if (req.query.type) {
      filter.type = String(req.query.type).toUpperCase();
    }

    const accounts = await PaymentAccount.find(filter).sort({ isDefault: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        accounts,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function getPaymentAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await PaymentAccount.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!account) {
      throw new AppError('Payment account not found', 404, 'NOT_FOUND');
    }

    res.status(200).json({
      success: true,
      data: {
        account,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function createPaymentAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createPaymentAccountSchema.parse(req.body);

    let maskedAccountNumber: string | null = null;
    if (parsed.accountNumber) {
      const cleanNum = parsed.accountNumber.trim();
      const last4 = cleanNum.slice(-4);
      maskedAccountNumber = `••••${last4}`;
    }

    let resolvedQrUrl = parsed.qrAssetUrl || null;
    if (parsed.qrAssetId) {
      const qrAsset = await Asset.findOne({ _id: parsed.qrAssetId, businessId: req.businessId });
      if (qrAsset) {
        resolvedQrUrl = qrAsset.secureUrl;
      }
    }

    // Generate smart display name if not explicitly provided
    let displayName = parsed.displayName;
    if (!displayName || displayName.trim().length === 0) {
      if (parsed.type === 'BANK') {
        const bName = parsed.bankName || parsed.name;
        displayName = `${bName} ${maskedAccountNumber || ''}`.trim();
      } else if (parsed.type === 'UPI') {
        displayName = `${parsed.name} - ${parsed.upiId || ''}`.trim();
      } else {
        displayName = parsed.name || 'Cash Account';
      }
    }

    // Validation according to account type
    if (parsed.type === 'BANK' && !parsed.accountNumber && !parsed.bankName) {
      throw new AppError('Bank accounts require bank name or account number', 400, 'BAD_REQUEST');
    }
    if (parsed.type === 'UPI' && !parsed.upiId) {
      throw new AppError('UPI accounts require a valid UPI ID', 400, 'BAD_REQUEST');
    }

    const account = await PaymentAccount.create({
      businessId: req.businessId,
      name: parsed.name,
      displayName,
      type: parsed.type,
      bankName: parsed.bankName || null,
      accountHolderName: parsed.accountHolderName || null,
      accountNumber: parsed.accountNumber || null,
      maskedAccountNumber,
      ifsc: parsed.ifsc ? parsed.ifsc.toUpperCase() : null,
      branch: parsed.branch || null,
      upiId: parsed.upiId || null,
      qrAssetId: parsed.qrAssetId || null,
      qrAssetUrl: resolvedQrUrl,
      isDefault: parsed.isDefault || false,
      active: true,
    });

    res.status(201).json({
      success: true,
      data: {
        account,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function updatePaymentAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await PaymentAccount.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!account) {
      throw new AppError('Payment account not found', 404, 'NOT_FOUND');
    }

    const parsed = updatePaymentAccountSchema.parse(req.body);

    if (parsed.name !== undefined) account.name = parsed.name;
    if (parsed.type !== undefined) account.type = parsed.type;
    if (parsed.bankName !== undefined) account.bankName = parsed.bankName;
    if (parsed.accountHolderName !== undefined) account.accountHolderName = parsed.accountHolderName;
    if (parsed.ifsc !== undefined) account.ifsc = parsed.ifsc ? parsed.ifsc.toUpperCase() : null;
    if (parsed.branch !== undefined) account.branch = parsed.branch;
    if (parsed.upiId !== undefined) account.upiId = parsed.upiId;
    if (parsed.isDefault !== undefined) account.isDefault = parsed.isDefault;

    if (parsed.accountNumber !== undefined) {
      account.accountNumber = parsed.accountNumber;
      if (parsed.accountNumber) {
        account.maskedAccountNumber = `••••${parsed.accountNumber.trim().slice(-4)}`;
      } else {
        account.maskedAccountNumber = null;
      }
    }

    if (parsed.qrAssetId !== undefined) {
      account.qrAssetId = parsed.qrAssetId;
      if (parsed.qrAssetId) {
        const qrAsset = await Asset.findOne({ _id: parsed.qrAssetId, businessId: req.businessId });
        if (qrAsset) account.qrAssetUrl = qrAsset.secureUrl;
      }
    }
    if (parsed.qrAssetUrl !== undefined) {
      account.qrAssetUrl = parsed.qrAssetUrl;
    }

    if (parsed.displayName !== undefined && parsed.displayName.trim().length > 0) {
      account.displayName = parsed.displayName;
    } else {
      if (account.type === 'BANK') {
        const bName = account.bankName || account.name;
        account.displayName = `${bName} ${account.maskedAccountNumber || ''}`.trim();
      } else if (account.type === 'UPI') {
        account.displayName = `${account.name} - ${account.upiId || ''}`.trim();
      } else {
        account.displayName = account.name || 'Cash Account';
      }
    }

    await account.save();

    res.status(200).json({
      success: true,
      data: {
        account,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function deactivatePaymentAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await PaymentAccount.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!account) {
      throw new AppError('Payment account not found', 404, 'NOT_FOUND');
    }

    account.active = false;
    account.deletedAt = new Date();
    await account.save();

    res.status(200).json({
      success: true,
      data: {
        account,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function activatePaymentAccount(req: Request, res: Response, next: NextFunction) {
  try {
    const account = await PaymentAccount.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!account) {
      throw new AppError('Payment account not found', 404, 'NOT_FOUND');
    }

    account.active = true;
    account.deletedAt = null;
    await account.save();

    res.status(200).json({
      success: true,
      data: {
        account,
      },
    });
  } catch (err: any) {
    next(err);
  }
}
