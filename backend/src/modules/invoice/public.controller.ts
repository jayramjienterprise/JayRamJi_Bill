import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Invoice } from '../../database/models/Invoice';
import { AppError } from '../../middleware/errorHandler';
import { DocumentGenerationService } from '../../services/DocumentGenerationService';

function buildPublicRenderData(invoice: any) {
  const formattedItems = invoice.items.map((item: any, index: number) => ({
    serialNumber: index + 1,
    description: item.description,
    uom: item.uom || 'Unit',
    quantity: item.quantity,
    unitPrice: item.unitPriceMinor / 100,
    amount: (item.quantity * item.unitPriceMinor) / 100,
    taxAmount: (item.taxAmountMinor || 0) / 100,
    lineTotal: (item.lineTotalMinor || (item.quantity * item.unitPriceMinor)) / 100,
    type: item.type,
    section: item.section,
  }));

  const formattedTotals = {
    subtotal: (invoice.totals.subtotalMinor || 0) / 100,
    discount: (invoice.totals.discountMinor || 0) / 100,
    taxableAmount: (invoice.totals.taxableAmountMinor || 0) / 100,
    taxes: (invoice.totals.taxes || []).map((t: any) => ({
      type: t.type,
      rateBps: t.rateBps,
      amount: (t.amountMinor || 0) / 100,
    })),
    taxTotal: (invoice.totals.taxTotalMinor || 0) / 100,
    rounding: (invoice.totals.roundingMinor || 0) / 100,
    grandTotal: (invoice.totals.grandTotalMinor || 0) / 100,
    currency: invoice.totals.currency || 'INR',
  };

  return {
    invoice: {
      id: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      amountInWords: invoice.amountInWords,
      paymentTerms: invoice.paymentTerms,
      notes: invoice.notes,
    },
    business: invoice.businessSnapshot || {},
    customer: invoice.customerSnapshot || {},
    items: formattedItems,
    totals: formattedTotals,
    assets: invoice.assetSnapshot || { logo: null, stamp: null, signature: null },
  };
}

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
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          business: invoice.businessSnapshot,
          customer: invoice.customerSnapshot,
          items: invoice.items,
          totals: invoice.totals,
          amountInWords: invoice.amountInWords,
          paymentTerms: invoice.paymentTerms,
          notes: invoice.notes,
          snapshotUrl: `/api/public/invoices/${token}/png`,
          pdfUrl: `/api/public/invoices/${token}/pdf`,
          currency: invoice.currency,
        },
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function downloadPublicInvoicePdf(req: Request, res: Response, next: NextFunction) {
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

    const renderData = buildPublicRenderData(invoice);
    const { pdfBuffer } = await DocumentGenerationService.generateBuffers(renderData as any);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${invoice.invoiceNumber || 'bill'}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    next(err);
  }
}

export async function downloadPublicInvoicePng(req: Request, res: Response, next: NextFunction) {
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

    const renderData = buildPublicRenderData(invoice);
    const { pngBuffer } = await DocumentGenerationService.generateBuffers(renderData as any);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${invoice.invoiceNumber || 'bill'}.png"`);
    res.send(pngBuffer);
  } catch (err: any) {
    next(err);
  }
}
