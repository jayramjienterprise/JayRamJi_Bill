import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Invoice } from '../../database/models/Invoice';
import { AppError } from '../../middleware/errorHandler';

export async function getPublicInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = req.params;
    if (!token) {
      return next(new AppError('Token is required', 400, 'VALIDATION_ERROR'));
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const invoice = await Invoice.findOne({
      'publicAccess.tokenHash': tokenHash,
      'publicAccess.enabled': true,
    });

    if (!invoice) {
      return next(new AppError('Public invoice not found or link disabled', 404, 'PUBLIC_INVOICE_NOT_FOUND'));
    }

    if (invoice.publicAccess.expiresAt && new Date() > invoice.publicAccess.expiresAt) {
      return next(new AppError('This bill link has expired', 400, 'PUBLIC_LINK_EXPIRED'));
    }

    res.status(200).json({
      success: true,
      data: {
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          business: invoice.businessSnapshot,
          customer: invoice.customerSnapshot,
          items: invoice.items,
          totals: invoice.totals,
          amountInWords: invoice.amountInWords,
          paymentTerms: invoice.paymentTerms,
          notes: invoice.notes,
          snapshotUrl: invoice.document?.snapshot?.secureUrl,
          pdfUrl: invoice.document?.pdf?.secureUrl,
          currency: invoice.currency,
        },
      },
    });
  } catch (err: any) {
    next(err);
  }
}
