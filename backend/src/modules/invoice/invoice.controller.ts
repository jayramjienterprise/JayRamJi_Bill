import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { env } from '../../config/env';
import { Invoice } from '../../database/models/Invoice';
import { Customer } from '../../database/models/Customer';
import { Product } from '../../database/models/Product';
import { Business } from '../../database/models/Business';
import { Asset } from '../../database/models/Asset';
import { InvoiceSequence } from '../../database/models/InvoiceSequence';
import { InvoiceCalculationService } from '../../services/InvoiceCalculationService';
import { DocumentGenerationService } from '../../services/DocumentGenerationService';
import { AppError } from '../../middleware/errorHandler';

// Zod schemas for validation
const DiscountSchema = z.object({
  type: z.enum(['NONE', 'FIXED', 'PERCENTAGE']),
  value: z.number().nonnegative(),
});

const InvoiceItemInputSchema = z.object({
  productId: z.string().nullable(),
  type: z.enum(['SERVICE', 'PRODUCT']),
  description: z.string().min(1, 'Item description is required'),
  uom: z.string().min(1, 'Unit of measurement (UOM) is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitPriceMinor: z.number().nonnegative('Price cannot be negative'),
});

const CreateInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  invoiceDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  items: z.array(InvoiceItemInputSchema).min(1, 'Invoice must contain at least one item'),
  taxMode: z.enum(['NONE', 'EXCLUSIVE', 'INCLUSIVE']),
  defaultTaxRateBps: z.number().nonnegative(),
  discount: DiscountSchema.optional(),
  paymentTerms: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function createInvoiceDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const bodyResult = CreateInvoiceSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return next(new AppError(bodyResult.error.errors[0].message, 400, 'VALIDATION_ERROR'));
    }

    const {
      customerId,
      invoiceDate,
      items,
      taxMode,
      defaultTaxRateBps,
      discount,
      paymentTerms,
      notes,
    } = bodyResult.data;

    // 1. Verify active customer belongs to business
    const customer = await Customer.findOne({
      _id: customerId,
      businessId: req.businessId,
      active: true,
    });
    if (!customer) {
      return next(new AppError('Active customer profile not found in this business scope', 404, 'INVALID_CUSTOMER'));
    }

    // 2. Verify active products belong to business
    for (const item of items) {
      if (item.productId) {
        const product = await Product.findOne({
          _id: item.productId,
          businessId: req.businessId,
          active: true,
        });
        if (!product) {
          return next(new AppError(`Active product profile for ID ${item.productId} not found in this business scope`, 404, 'INVALID_PRODUCT'));
        }
      }
    }

    // 3. Compute calculations
    const calcResult = InvoiceCalculationService.calculate({
      items,
      taxMode,
      defaultTaxRateBps,
      discount: discount || { type: 'NONE', value: 0 },
    });

    // 4. Fetch business defaults to freeze details (optional but good practice for drafts)
    const business = await Business.findById(req.businessId);
    if (!business) {
      return next(new AppError('Active business context not found', 404, 'NOT_FOUND'));
    }

    // Create draft document
    const newInvoice = new Invoice({
      businessId: req.businessId,
      invoiceNumber: null,
      invoiceDate: new Date(invoiceDate),
      status: 'DRAFT',
      currency: 'INR',
      customerId: customer._id,
      customerSnapshot: {}, // populated on finalization
      businessSnapshot: {}, // populated on finalization
      assetSnapshot: {}, // populated on finalization
      taxMode,
      defaultTaxRateBps,
      discount: discount || { type: 'NONE', value: 0 },
      items: calcResult.items,
      totals: calcResult.totals,
      amountInWords: calcResult.amountInWords,
      paymentTerms: paymentTerms || business.invoiceSettings?.defaultPaymentTerms || null,
      notes: notes || null,
      paymentSummary: {
        paidAmountMinor: 0,
        dueAmountMinor: calcResult.totals.grandTotalMinor,
        status: 'UNPAID',
      },
      document: {
        snapshot: { status: 'NOT_GENERATED', provider: 'CLOUDINARY' },
        pdf: { status: 'NOT_GENERATED', provider: 'CLOUDINARY' },
      },
      createdBy: (req as any).user._id,
    });

    await newInvoice.save();

    res.status(201).json({
      success: true,
      data: { invoice: newInvoice },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function getInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: { invoice },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function updateInvoiceDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'NOT_FOUND'));
    }

    if (invoice.status !== 'DRAFT') {
      return next(new AppError('Only draft invoices can be edited or updated', 400, 'INVOICE_NOT_EDITABLE'));
    }

    const bodyResult = CreateInvoiceSchema.partial().safeParse(req.body);
    if (!bodyResult.success) {
      return next(new AppError(bodyResult.error.errors[0].message, 400, 'VALIDATION_ERROR'));
    }

    const updates = bodyResult.data;

    // Apply basic metadata updates
    if (updates.invoiceDate) {
      invoice.invoiceDate = new Date(updates.invoiceDate);
    }
    if (updates.paymentTerms !== undefined) {
      invoice.paymentTerms = updates.paymentTerms;
    }
    if (updates.notes !== undefined) {
      invoice.notes = updates.notes;
    }

    // Check if customer is changing
    if (updates.customerId) {
      const customer = await Customer.findOne({
        _id: updates.customerId,
        businessId: req.businessId,
        active: true,
      });
      if (!customer) {
        return next(new AppError('Active customer profile not found in this business scope', 404, 'INVALID_CUSTOMER'));
      }
      invoice.customerId = customer._id;
    }

    // Apply configuration updates
    if (updates.taxMode) {
      invoice.taxMode = updates.taxMode;
    }
    if (updates.defaultTaxRateBps !== undefined) {
      invoice.defaultTaxRateBps = updates.defaultTaxRateBps;
    }
    if (updates.discount) {
      invoice.discount = updates.discount;
    }

    // If items, tax settings, or discounts change, re-run calculation engine
    if (updates.items || updates.taxMode || updates.defaultTaxRateBps !== undefined || updates.discount) {
      const itemsToCalculate = updates.items || invoice.items;
      const taxModeToUse = invoice.taxMode || 'NONE';
      const taxRateBpsToUse = invoice.defaultTaxRateBps || 0;
      const discountToUse = invoice.discount || { type: 'NONE' as const, value: 0 };

      // Map document array items back to calculation structure
      const calculationItems = itemsToCalculate.map((item: any) => ({
        productId: item.productId ? item.productId.toString() : null,
        type: item.type,
        description: item.description,
        uom: item.uom,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
      }));

      // Recompute totals
      const calcResult = InvoiceCalculationService.calculate({
        items: calculationItems,
        taxMode: taxModeToUse,
        defaultTaxRateBps: taxRateBpsToUse,
        discount: discountToUse,
      });

      invoice.items = calcResult.items as any;
      invoice.totals = calcResult.totals;
      invoice.amountInWords = calcResult.amountInWords;
      invoice.paymentSummary.dueAmountMinor = calcResult.totals.grandTotalMinor;
    }

    await invoice.save();

    res.status(200).json({
      success: true,
      data: { invoice },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function deleteInvoiceDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'NOT_FOUND'));
    }

    if (invoice.status !== 'DRAFT') {
      return next(new AppError('Only draft invoices can be deleted', 400, 'INVOICE_NOT_EDITABLE'));
    }

    await Invoice.deleteOne({ _id: invoice._id });

    res.status(200).json({
      success: true,
      data: { message: 'Draft invoice deleted successfully' },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function listInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    let limit = parseInt(req.query.limit as string) || 20;
    limit = Math.min(100, Math.max(1, limit));
    const skip = (page - 1) * limit;

    const filter: any = { businessId: req.businessId };

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }
    if (req.query.paymentStatus) {
      filter['paymentSummary.status'] = req.query.paymentStatus;
    }

    if (req.query.from || req.query.to) {
      filter.invoiceDate = {};
      if (req.query.from) {
        filter.invoiceDate.$gte = new Date(req.query.from as string);
      }
      if (req.query.to) {
        filter.invoiceDate.$lte = new Date(req.query.to as string + 'T23:59:59.999Z');
      }
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search as string, 'i');
      const matchingCustomers = await Customer.find({
        businessId: req.businessId,
        name: searchRegex,
      }).select('_id');
      const customerIds = matchingCustomers.map((c) => c._id);

      filter.$or = [
        { invoiceNumber: searchRegex },
        { 'customerSnapshot.name': searchRegex },
        { 'customerSnapshot.contact.phone': searchRegex },
        { 'customerSnapshot.taxProfile.gstin': searchRegex },
        { customerId: { $in: customerIds } },
      ];
    }

    const sortBy = (req.query.sortBy as string) || 'invoiceDate';
    const sortOrder = (req.query.sortOrder as string) === 'asc' ? 1 : -1;
    const sortCriteria: any = {};
    sortCriteria[sortBy] = sortOrder;
    if (sortBy !== 'createdAt') {
      sortCriteria.createdAt = -1;
    }

    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .select({
        _id: 1,
        invoiceNumber: 1,
        invoiceDate: 1,
        customerSnapshot: 1,
        customerId: 1,
        'totals.grandTotalMinor': 1,
        currency: 1,
        status: 1,
        'paymentSummary.status': 1,
        'document.snapshot.secureUrl': 1,
      })
      .populate('customerId', 'name')
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);

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
        snapshotUrl: inv.document?.snapshot?.secureUrl || null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        invoices: formattedInvoices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err: any) {
    next(err);
  }
}

// Preview calculation handler without storing in database
export async function calculatePreview(req: Request, res: Response, next: NextFunction) {
  try {
    const bodyResult = CreateInvoiceSchema.safeParse(req.body);
    if (!bodyResult.success) {
      return next(new AppError(bodyResult.error.errors[0].message, 400, 'VALIDATION_ERROR'));
    }

    const { items, taxMode, defaultTaxRateBps, discount } = bodyResult.data;

    const calcResult = InvoiceCalculationService.calculate({
      items,
      taxMode,
      defaultTaxRateBps,
      discount: discount || { type: 'NONE', value: 0 },
    });

    res.status(200).json({
      success: true,
      data: { totals: calcResult.totals, items: calcResult.items, amountInWords: calcResult.amountInWords },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function getInvoicePreviewData(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'NOT_FOUND'));
    }

    let customerData: any = {};
    let businessData: any = {};
    let assetData: any = { logo: null, stamp: null, signature: null };

    if (invoice.status === 'FINALIZED' || invoice.status === 'CANCELLED') {
      customerData = invoice.customerSnapshot;
      businessData = invoice.businessSnapshot;
      assetData = invoice.assetSnapshot;
    } else {
      const customer = await Customer.findOne({ _id: invoice.customerId, businessId: req.businessId });
      if (customer) {
        customerData = {
          name: customer.name,
          contact: customer.contact,
          address: customer.address,
          taxProfile: customer.taxProfile,
        };
      }

      const business = await Business.findById(req.businessId);
      if (business) {
        businessData = {
          name: business.name,
          legalName: business.legalName,
          displayName: business.displayName,
          address: business.address,
          contact: business.contact,
          timezone: business.timezone,
          taxProfile: business.taxProfile,
          bankDetails: business.bankDetails,
          invoiceTitle: business.invoiceSettings?.invoiceTitle || 'TAX INVOICE',
          paymentTerms: business.invoiceSettings?.defaultPaymentTerms,
        };
      }

      const activeAssets = await Asset.find({ businessId: req.businessId, active: true });
      const logo = activeAssets.find((a) => a.type === 'LOGO');
      const stamp = activeAssets.find((a) => a.type === 'STAMP');
      const signature = activeAssets.find((a) => a.type === 'SIGNATURE');

      assetData = {
        logo: logo ? { assetId: logo._id, cloudinaryPublicId: logo.cloudinaryPublicId, secureUrl: logo.secureUrl } : null,
        stamp: stamp ? { assetId: stamp._id, cloudinaryPublicId: stamp.cloudinaryPublicId, secureUrl: stamp.secureUrl } : null,
        signature: signature ? { assetId: signature._id, cloudinaryPublicId: signature.cloudinaryPublicId, secureUrl: signature.secureUrl } : null,
      };
    }

    const formattedItems = invoice.items.map((item: any, index: number) => ({
      serialNumber: index + 1,
      description: item.description,
      uom: item.uom,
      quantity: item.quantity,
      unitPrice: item.unitPriceMinor / 100,
      amount: (item.quantity * item.unitPriceMinor) / 100,
      taxAmount: item.taxAmountMinor / 100,
      lineTotal: item.lineTotalMinor / 100,
    }));

    const formattedTotals = {
      subtotal: invoice.totals.subtotalMinor / 100,
      discount: invoice.totals.discountMinor / 100,
      taxableAmount: invoice.totals.taxableAmountMinor / 100,
      taxes: invoice.totals.taxes.map((t: any) => ({
        type: t.type,
        rateBps: t.rateBps,
        amount: t.amountMinor / 100,
      })),
      taxTotal: invoice.totals.taxTotalMinor / 100,
      rounding: invoice.totals.roundingMinor / 100,
      grandTotal: invoice.totals.grandTotalMinor / 100,
      currency: invoice.totals.currency,
    };

    res.status(200).json({
      success: true,
      data: {
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          status: invoice.status,
          currency: invoice.currency,
          amountInWords: invoice.amountInWords,
          paymentTerms: invoice.paymentTerms,
          notes: invoice.notes,
        },
        business: businessData,
        customer: customerData,
        items: formattedItems,
        totals: formattedTotals,
        assets: assetData,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function finalizeInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'NOT_FOUND'));
    }

    if (invoice.status !== 'DRAFT') {
      return next(new AppError('Only draft invoices can be finalized', 400, 'BAD_REQUEST'));
    }

    if (!invoice.customerId) {
      return next(new AppError('Customer profile must be linked to finalize the invoice', 400, 'BAD_REQUEST'));
    }

    if (!invoice.items || invoice.items.length === 0) {
      return next(new AppError('Invoice must contain at least one item to finalize', 400, 'BAD_REQUEST'));
    }

    const customer = await Customer.findOne({ _id: invoice.customerId, businessId: req.businessId });
    if (!customer) {
      return next(new AppError('Linked customer profile not found', 400, 'BAD_REQUEST'));
    }

    const business = await Business.findById(req.businessId);
    if (!business) {
      return next(new AppError('Business workspace not found', 400, 'BAD_REQUEST'));
    }

    const activeAssets = await Asset.find({ businessId: req.businessId, active: true });
    const logo = activeAssets.find((a) => a.type === 'LOGO');
    const stamp = activeAssets.find((a) => a.type === 'STAMP');
    const signature = activeAssets.find((a) => a.type === 'SIGNATURE');

    const customerSnapshot = {
      name: customer.name,
      contact: customer.contact,
      address: customer.address,
      taxProfile: customer.taxProfile,
    };

    const businessSnapshot = {
      name: business.name,
      legalName: business.legalName,
      displayName: business.displayName,
      address: business.address,
      contact: business.contact,
      timezone: business.timezone,
      taxProfile: business.taxProfile,
      bankDetails: business.bankDetails,
      invoiceTitle: business.invoiceSettings?.invoiceTitle || 'TAX INVOICE',
      paymentTerms: invoice.paymentTerms || business.invoiceSettings?.defaultPaymentTerms,
    };

    const assetSnapshot = {
      logo: logo ? { assetId: logo._id, cloudinaryPublicId: logo.cloudinaryPublicId, secureUrl: logo.secureUrl } : null,
      stamp: stamp ? { assetId: stamp._id, cloudinaryPublicId: stamp.cloudinaryPublicId, secureUrl: stamp.secureUrl } : null,
      signature: signature ? { assetId: signature._id, cloudinaryPublicId: signature.cloudinaryPublicId, secureUrl: signature.secureUrl } : null,
    };

    const prefix = business.invoiceSettings?.prefix || 'INV';
    const seq = await InvoiceSequence.findOneAndUpdate(
      { businessId: req.businessId, key: 'INVOICE' },
      { 
        $inc: { nextNumber: 1 },
        $setOnInsert: { prefix }
      },
      { new: true, upsert: true }
    );
    const seqNum = seq.nextNumber - 1;
    const paddedNum = String(seqNum).padStart(6, '0');
    const invoiceNumber = `${prefix}-${paddedNum}`;

    const updateResult = await Invoice.updateOne(
      { _id: invoice._id, status: 'DRAFT' },
      {
        $set: {
          status: 'FINALIZED',
          invoiceNumber,
          customerSnapshot,
          businessSnapshot,
          assetSnapshot,
          finalizedBy: req.user?._id,
          finalizedAt: new Date(),
          'document.snapshot.status': 'GENERATING',
          'document.pdf.status': 'GENERATING',
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return next(new AppError('Invoice was already finalized or modified by another session', 409, 'CONFLICT'));
    }

    const finalizedInvoice = await Invoice.findById(invoice._id);
    if (!finalizedInvoice) {
      return next(new AppError('Invoice document lookup failed after save', 500, 'INTERNAL_SERVER_ERROR'));
    }

    const renderItems = finalizedInvoice.items.map((item: any, idx: number) => ({
      serialNumber: idx + 1,
      description: item.description,
      uom: item.uom,
      quantity: item.quantity,
      unitPrice: item.unitPriceMinor / 100,
      amount: (item.quantity * item.unitPriceMinor) / 100,
    }));

    const renderTotals = {
      subtotal: finalizedInvoice.totals.subtotalMinor / 100,
      discount: finalizedInvoice.totals.discountMinor / 100,
      taxableAmount: finalizedInvoice.totals.taxableAmountMinor / 100,
      taxes: finalizedInvoice.totals.taxes.map((t: any) => ({
        type: t.type,
        rateBps: t.rateBps,
        amount: t.amountMinor / 100,
      })),
      taxTotal: finalizedInvoice.totals.taxTotalMinor / 100,
      rounding: finalizedInvoice.totals.roundingMinor / 100,
      grandTotal: finalizedInvoice.totals.grandTotalMinor / 100,
      currency: finalizedInvoice.totals.currency,
    };

    const renderData = {
      invoice: {
        id: finalizedInvoice._id.toString(),
        invoiceNumber: finalizedInvoice.invoiceNumber,
        invoiceDate: finalizedInvoice.invoiceDate,
        amountInWords: finalizedInvoice.amountInWords,
        paymentTerms: finalizedInvoice.paymentTerms,
        notes: finalizedInvoice.notes,
      },
      business: finalizedInvoice.businessSnapshot,
      customer: finalizedInvoice.customerSnapshot,
      items: renderItems,
      totals: renderTotals,
      assets: finalizedInvoice.assetSnapshot,
    };

    DocumentGenerationService.generateDocuments(
      req.businessId!,
      finalizedInvoice._id.toString(),
      renderData as any
    ).then(async (docs) => {
      await Invoice.updateOne(
        { _id: finalizedInvoice._id },
        {
          $set: {
            'document.snapshot.status': 'READY',
            'document.snapshot.publicId': docs.snapshot.publicId,
            'document.snapshot.secureUrl': docs.snapshot.secureUrl,
            'document.snapshot.width': docs.snapshot.width,
            'document.snapshot.height': docs.snapshot.height,
            'document.snapshot.generatedAt': new Date(),
            'document.pdf.status': 'READY',
            'document.pdf.secureUrl': docs.pdf.secureUrl,
            'document.pdf.generatedAt': new Date(),
          },
        }
      );
    }).catch(async (err) => {
      console.error('Error background generating documents:', err);
      await Invoice.updateOne(
        { _id: finalizedInvoice._id },
        {
          $set: {
            'document.snapshot.status': 'FAILED',
            'document.pdf.status': 'FAILED',
          },
        }
      );
    });

    res.status(200).json({
      success: true,
      data: {
        invoice: {
          id: finalizedInvoice._id,
          invoiceNumber: finalizedInvoice.invoiceNumber,
          status: finalizedInvoice.status,
          document: finalizedInvoice.document,
        },
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function cancelInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim() === '') {
      return next(new AppError('Cancellation reason is required', 400, 'BAD_REQUEST'));
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'NOT_FOUND'));
    }

    if (invoice.status !== 'FINALIZED') {
      return next(new AppError('Only finalized invoices can be cancelled', 400, 'BAD_REQUEST'));
    }

    invoice.status = 'CANCELLED';
    invoice.cancelledAt = new Date();
    invoice.cancelledBy = req.user?._id;
    invoice.cancellationReason = reason.trim();
    await invoice.save();

    res.status(200).json({
      success: true,
      data: {
        invoice: {
          id: invoice._id,
          status: invoice.status,
          cancellationReason: invoice.cancellationReason,
        },
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function retrySnapshotGeneration(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });

    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'NOT_FOUND'));
    }

    if (invoice.status === 'DRAFT') {
      return next(new AppError('Cannot generate document snapshots for draft invoices', 400, 'BAD_REQUEST'));
    }

    await Invoice.updateOne(
      { _id: invoice._id },
      { $set: { 'document.snapshot.status': 'GENERATING', 'document.pdf.status': 'GENERATING' } }
    );

    const renderItems = invoice.items.map((item: any, idx: number) => ({
      serialNumber: idx + 1,
      description: item.description,
      uom: item.uom,
      quantity: item.quantity,
      unitPrice: item.unitPriceMinor / 100,
      amount: (item.quantity * item.unitPriceMinor) / 100,
    }));

    const renderTotals = {
      subtotal: invoice.totals.subtotalMinor / 100,
      discount: invoice.totals.discountMinor / 100,
      taxableAmount: invoice.totals.taxableAmountMinor / 100,
      taxes: invoice.totals.taxes.map((t: any) => ({
        type: t.type,
        rateBps: t.rateBps,
        amount: t.amountMinor / 100,
      })),
      taxTotal: invoice.totals.taxTotalMinor / 100,
      rounding: invoice.totals.roundingMinor / 100,
      grandTotal: invoice.totals.grandTotalMinor / 100,
      currency: invoice.totals.currency,
    };

    const renderData = {
      invoice: {
        id: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        amountInWords: invoice.amountInWords,
        paymentTerms: invoice.paymentTerms,
        notes: invoice.notes,
      },
      business: invoice.businessSnapshot,
      customer: invoice.customerSnapshot,
      items: renderItems,
      totals: renderTotals,
      assets: invoice.assetSnapshot,
    };

    DocumentGenerationService.generateDocuments(
      req.businessId!,
      invoice._id.toString(),
      renderData as any
    ).then(async (docs) => {
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            'document.snapshot.status': 'READY',
            'document.snapshot.publicId': docs.snapshot.publicId,
            'document.snapshot.secureUrl': docs.snapshot.secureUrl,
            'document.snapshot.width': docs.snapshot.width,
            'document.snapshot.height': docs.snapshot.height,
            'document.snapshot.generatedAt': new Date(),
            'document.pdf.status': 'READY',
            'document.pdf.secureUrl': docs.pdf.secureUrl,
            'document.pdf.generatedAt': new Date(),
          },
        }
      );
    }).catch(async (err) => {
      console.error('Error retrying document generation:', err);
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            'document.snapshot.status': 'FAILED',
            'document.pdf.status': 'FAILED',
          },
        }
      );
    });

    res.status(200).json({
      success: true,
      data: {
        snapshot: { status: 'GENERATING' }
      }
    });
  } catch (err: any) {
    next(err);
  }
}

export async function retryPdfGeneration(req: Request, res: Response, next: NextFunction) {
  return retrySnapshotGeneration(req, res, next);
}

export async function enableShareLink(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND'));
    }
    if (invoice.status === 'DRAFT') {
      return next(new AppError('Draft invoices cannot be shared publicly', 400, 'INVOICE_NOT_EDITABLE'));
    }

    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : null;

    invoice.publicAccess = {
      enabled: true,
      tokenHash,
      createdAt: new Date(),
      expiresAt,
    };

    await invoice.save();

    const shareUrl = `${env.FRONTEND_URL}/share/${rawToken}`;

    res.status(200).json({
      success: true,
      data: {
        shareUrl,
        expiresAt,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function disableShareLink(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      businessId: req.businessId,
    });
    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND'));
    }

    invoice.publicAccess = {
      enabled: false,
      tokenHash: null,
      createdAt: null,
      expiresAt: null,
    };

    await invoice.save();

    res.status(200).json({
      success: true,
      data: {
        publicAccess: invoice.publicAccess,
      },
    });
  } catch (err: any) {
    next(err);
  }
}
