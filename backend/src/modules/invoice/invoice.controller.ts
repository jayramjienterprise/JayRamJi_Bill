import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { env } from '../../config/env';
import { Invoice } from '../../database/models/Invoice';
import { Customer } from '../../database/models/Customer';
import { Product } from '../../database/models/Product';
import { Business } from '../../database/models/Business';
import { Asset } from '../../database/models/Asset';
import { InvoiceSequence } from '../../database/models/InvoiceSequence';
import { Payment } from '../../database/models/Payment';
import { PaymentAccount } from '../../database/models/PaymentAccount';
import { AuditLog } from '../../database/models/AuditLog';
import { InvoiceCalculationService } from '../../services/InvoiceCalculationService';
import { DocumentGenerationService } from '../../services/DocumentGenerationService';
import { cloudinary, isCloudinaryConfigured } from '../../services/cloudinary';
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
  quantity: z
    .number()
    .positive('Quantity must be greater than zero')
    .refine((val) => (val.toString().split('.')[1] || '').length <= 3, {
      message: 'Quantity cannot have more than 3 decimal places',
    }),
  unitPriceMinor: z.number().nonnegative('Price cannot be negative'),
  section: z.enum(['ITEM', 'LABOUR', 'PART']).optional(),
});

export function normalizeInvoiceNumber(input: string, defaultPrefix: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (/^\d+$/.test(trimmed)) {
    return `${defaultPrefix}-${trimmed}`;
  }

  if (trimmed.toLowerCase().startsWith(defaultPrefix.toLowerCase())) {
    const rest = trimmed.slice(defaultPrefix.length).replace(/^[\s-]+/, '');
    return `${defaultPrefix.toUpperCase()}-${rest}`;
  }

  return trimmed.toUpperCase();
}

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
  paymentStatus: z.enum(['PAID', 'UNPAID', 'PARTIAL']).optional(),
  payment: z.any().optional(),
  paymentDetails: z.any().optional(),
  customInvoiceNumber: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
});

export async function getNextInvoiceNumber(req: Request, res: Response, next: NextFunction) {
  try {
    const business = await Business.findById(req.businessId);
    if (!business) {
      next(new AppError('Active business context not found', 404, 'NOT_FOUND'));
      return;
    }

    const prefix = business.invoiceSettings?.prefix || 'JRE';

    const seq = await InvoiceSequence.findOne({ businessId: req.businessId, key: 'INVOICE' });
    const nextNum = seq ? seq.nextNumber : 1;

    const existingInvoices = await Invoice.find({
      businessId: req.businessId,
      invoiceNumber: { $ne: null },
    }).select('invoiceNumber');

    let maxFound = 0;
    for (const inv of existingInvoices) {
      if (!inv.invoiceNumber) continue;
      const match = inv.invoiceNumber.match(/(\d+)$/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxFound) {
          maxFound = val;
        }
      }
    }

    const candidateNum = Math.max(nextNum, maxFound + 1);
    const paddedNum = String(candidateNum).padStart(6, '0');
    const proposedNumber = `${prefix}-${paddedNum}`;

    res.status(200).json({
      success: true,
      data: {
        invoiceNumber: proposedNumber,
        series: prefix,
      },
    });
    return;
  } catch (err) {
    next(err);
  }
}

export async function checkInvoiceNumberAvailability(req: Request, res: Response, next: NextFunction) {
  try {
    const rawNumber = String(req.query.invoiceNumber || '').trim();
    const excludeId = req.query.excludeInvoiceId ? String(req.query.excludeInvoiceId) : null;

    if (!rawNumber) {
      res.status(200).json({
        success: true,
        data: {
          available: false,
          reason: 'EMPTY',
          invoiceNumber: '',
        },
      });
      return;
    }

    const business = await Business.findById(req.businessId);
    const prefix = business?.invoiceSettings?.prefix || 'JRE';
    const normalized = normalizeInvoiceNumber(rawNumber, prefix);

    const query: any = {
      businessId: req.businessId,
      invoiceNumber: normalized,
    };
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: excludeId };
    }

    const existing = await Invoice.findOne(query).select('_id');

    res.status(200).json({
      success: true,
      data: {
        available: !existing,
        invoiceNumber: normalized,
        series: prefix,
      },
    });
    return;
  } catch (err) {
    next(err);
  }
}

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
      paymentStatus,
      payment,
      paymentDetails,
      customInvoiceNumber,
      invoiceNumber,
    } = bodyResult.data;

    const paymentInput = payment || paymentDetails;
    const rawInvNum = customInvoiceNumber || invoiceNumber;

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

    // 4. Fetch business defaults to freeze details
    const business = await Business.findById(req.businessId);
    if (!business) {
      return next(new AppError('Active business context not found', 404, 'NOT_FOUND'));
    }

    const prefix = business.invoiceSettings?.prefix || 'JRE';
    let assignedInvoiceNumber: string | null = null;

    if (rawInvNum && String(rawInvNum).trim()) {
      const normalized = normalizeInvoiceNumber(String(rawInvNum), prefix);
      const existing = await Invoice.findOne({
        businessId: req.businessId,
        invoiceNumber: normalized,
      });
      if (existing) {
        return next(
          new AppError(
            `Invoice number ${normalized} is already in use. Please choose another number.`,
            409,
            'INVOICE_NUMBER_ALREADY_EXISTS'
          )
        );
      }
      assignedInvoiceNumber = normalized;
    }

    let initialPaidMinor = 0;
    let initialStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
    if (paymentStatus === 'PAID' || paymentInput?.status === 'PAID') {
      initialPaidMinor = calcResult.totals.grandTotalMinor;
      initialStatus = 'PAID';
    } else if (paymentStatus === 'PARTIAL' || paymentInput?.status === 'PARTIAL') {
      const parsedPartial = Math.round(Number(paymentInput?.amountMinor !== undefined ? paymentInput.amountMinor : (Number(paymentInput?.amount) * 100)));
      initialPaidMinor = !isNaN(parsedPartial) && parsedPartial > 0 ? parsedPartial : 0;
      initialStatus = initialPaidMinor >= calcResult.totals.grandTotalMinor ? 'PAID' : (initialPaidMinor > 0 ? 'PARTIALLY_PAID' : 'UNPAID');
    }

    // Create draft document
    const newInvoice = new Invoice({
      businessId: req.businessId,
      invoiceNumber: assignedInvoiceNumber,
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
      draftPaymentDetails: paymentInput || null,
      paymentSummary: {
        paidAmountMinor: initialPaidMinor,
        dueAmountMinor: Math.max(0, calcResult.totals.grandTotalMinor - initialPaidMinor),
        status: initialStatus,
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

    // If items, tax settings, discounts, or paymentStatus change, re-run calculation engine
    if (updates.items || updates.taxMode || updates.defaultTaxRateBps !== undefined || updates.discount || updates.paymentStatus) {
      const itemsToCalculate = updates.items || invoice.items;
      const taxModeToUse = invoice.taxMode || 'NONE';
      const taxRateBpsToUse = invoice.defaultTaxRateBps || 0;
      const discountToUse = invoice.discount || { type: 'NONE' as const, value: 0 };
      const paymentStatusToUse = updates.paymentStatus || (invoice.paymentSummary?.status === 'PAID' ? 'PAID' : 'UNPAID');

      // Map document array items back to calculation structure
      const calculationItems = itemsToCalculate.map((item: any) => ({
        productId: item.productId ? item.productId.toString() : null,
        type: item.type,
        description: item.description,
        uom: item.uom,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        section: item.section,
      }));

      // Recompute totals
      const calcResult = InvoiceCalculationService.calculate({
        items: calculationItems,
        taxMode: taxModeToUse,
        defaultTaxRateBps: taxRateBpsToUse,
        discount: discountToUse,
      });

      const isPaid = paymentStatusToUse === 'PAID';
      invoice.items = calcResult.items as any;
      invoice.totals = calcResult.totals;
      invoice.amountInWords = calcResult.amountInWords;
      invoice.paymentSummary = {
        paidAmountMinor: isPaid ? calcResult.totals.grandTotalMinor : 0,
        dueAmountMinor: isPaid ? 0 : calcResult.totals.grandTotalMinor,
        status: isPaid ? 'PAID' : 'UNPAID',
      };
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
      type: item.type,
      section: item.section,
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

async function triggerBackgroundDocGen(businessId: string, invoiceId: string) {
  try {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return;

    const renderItems = invoice.items.map((item: any, idx: number) => ({
      serialNumber: idx + 1,
      description: item.description,
      uom: item.uom,
      quantity: item.quantity,
      unitPrice: item.unitPriceMinor / 100,
      amount: (item.quantity * item.unitPriceMinor) / 100,
      type: item.type,
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

    const docs = await DocumentGenerationService.generateDocuments(
      businessId,
      invoiceId,
      renderData as any
    );

    await Invoice.updateOne(
      { _id: invoiceId },
      {
        $set: {
          'document.snapshot.status': 'READY',
          'document.snapshot.publicId': docs.snapshot.publicId,
          'document.snapshot.secureUrl': docs.snapshot.secureUrl,
          'document.snapshot.width': docs.snapshot.width,
          'document.snapshot.height': docs.snapshot.height,
          'document.snapshot.generatedAt': new Date(),
          'document.snapshot.errorMessage': null,
          'document.pdf.status': 'READY',
          'document.pdf.secureUrl': docs.pdf.secureUrl,
          'document.pdf.generatedAt': new Date(),
          'document.pdf.errorMessage': null,
        },
      }
    );
  } catch (err: any) {
    console.error('Background document generation failed:', err);
    await Invoice.updateOne(
      { _id: invoiceId },
      {
        $set: {
          'document.snapshot.status': 'FAILED',
          'document.snapshot.errorMessage': err.message,
          'document.pdf.status': 'FAILED',
          'document.pdf.errorMessage': err.message,
        },
        $inc: {
          'document.snapshot.retryCount': 1,
          'document.pdf.retryCount': 1,
        }
      }
    );
  }
}

async function executeInTransaction(callback: (session: mongoose.ClientSession | null) => Promise<any>): Promise<any> {
  const session = await mongoose.startSession();
  try {
    let result: any;
    await session.withTransaction(async () => {
      result = await callback(session);
    });
    return result;
  } catch (err: any) {
    const errmsg = err.errmsg || err.message || '';
    if (
      err.code === 20 ||
      err.codeName === 'IllegalOperation' ||
      errmsg.includes('replica set') ||
      errmsg.includes('Transaction numbers')
    ) {
      return await callback(null);
    }
    throw err;
  } finally {
    session.endSession();
  }
}

export async function finalizeInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await executeInTransaction(async (session) => {
      // 1. Fetch draft invoice
      const invoice = await Invoice.findOne({
        _id: req.params.id,
        businessId: req.businessId,
      }).session(session);

      if (!invoice) {
        throw new AppError('Invoice not found', 404, 'NOT_FOUND');
      }

      if (invoice.status !== 'DRAFT') {
        throw new AppError('Only draft invoices can be finalized', 400, 'BAD_REQUEST');
      }

      if (!invoice.customerId) {
        throw new AppError('Customer profile must be linked to finalize the invoice', 400, 'BAD_REQUEST');
      }

      if (!invoice.items || invoice.items.length === 0) {
        throw new AppError('Invoice must contain at least one item to finalize', 400, 'BAD_REQUEST');
      }

      // 2. Validate Customer exists and belongs to business
      const customer = await Customer.findOne({
        _id: invoice.customerId,
        businessId: req.businessId,
      }).session(session);
      if (!customer) {
        throw new AppError('Linked customer profile not found', 400, 'BAD_REQUEST');
      }
      if (!customer.active) {
        throw new AppError('Linked customer profile is inactive', 400, 'BAD_REQUEST');
      }

      // 3. Validate Business workspace
      const business = await Business.findById(req.businessId).session(session);
      if (!business) {
        throw new AppError('Business workspace not found', 400, 'BAD_REQUEST');
      }

      // 4. Validate Items (products, quantities, unit prices)
      const validatedItemsInput = [];
      for (const item of invoice.items) {
        if (item.productId) {
          const product = await Product.findOne({
            _id: item.productId,
            businessId: req.businessId,
          }).session(session);
          if (!product) {
            throw new AppError(`Product matching item '${item.description}' not found`, 400, 'BAD_REQUEST');
          }
          if (!product.active) {
            throw new AppError(`Product matching item '${item.description}' is inactive`, 400, 'BAD_REQUEST');
          }
        }

        if (!item.quantity || isNaN(item.quantity) || item.quantity <= 0) {
          throw new AppError(`Quantity for item '${item.description}' must be greater than zero`, 400, 'BAD_REQUEST');
        }

        const quantityDecimals = (item.quantity.toString().split('.')[1] || '').length;
        if (quantityDecimals > 3) {
          throw new AppError(`Quantity for item '${item.description}' cannot have more than 3 decimal places`, 400, 'BAD_REQUEST');
        }

        if (item.unitPriceMinor === undefined || isNaN(item.unitPriceMinor) || item.unitPriceMinor < 0) {
          throw new AppError(`Unit price for item '${item.description}' must be non-negative`, 400, 'BAD_REQUEST');
        }

        if (!item.description || item.description.trim() === '') {
          throw new AppError('Item description is required', 400, 'BAD_REQUEST');
        }

        validatedItemsInput.push({
          productId: item.productId ? item.productId.toString() : null,
          type: item.type,
          description: item.description,
          uom: item.uom,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          section: item.section,
        });
      }

      // 5. Recalculate financial values Authoritatively on Server
      const calcResult = InvoiceCalculationService.calculate({
        items: validatedItemsInput,
        taxMode: invoice.taxMode,
        defaultTaxRateBps: invoice.defaultTaxRateBps,
        discount: invoice.discount || { type: 'NONE', value: 0 },
      });

      // 6. Freeze Snapshots
      const activeAssets = await Asset.find({ businessId: req.businessId, active: true }).session(session);
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

      // 7. Atomic Invoice Numbering
      const prefix = business.invoiceSettings?.prefix || 'INV';
      let seq = await InvoiceSequence.findOneAndUpdate(
        { businessId: req.businessId, key: 'INVOICE' },
        { $inc: { nextNumber: 1 } },
        { new: true, session }
      );

      if (!seq) {
        try {
          const [newSeq] = await InvoiceSequence.create(
            [
              {
                businessId: req.businessId,
                key: 'INVOICE',
                prefix,
                nextNumber: 2,
              },
            ],
            { session }
          );
          seq = newSeq;
        } catch (err: any) {
          if (err.code === 11000) {
            seq = await InvoiceSequence.findOneAndUpdate(
              { businessId: req.businessId, key: 'INVOICE' },
              { $inc: { nextNumber: 1 } },
              { new: true, session }
            );
          } else {
            throw err;
          }
        }
      }

      const seqNum = seq.nextNumber - 1;
      const paddedNum = String(seqNum).padStart(6, '0');
      const invoiceNumber = `${prefix}-${paddedNum}`;

      // 8. Apply Updates & Save Invoice Status change
      invoice.status = 'FINALIZED';
      invoice.invoiceNumber = invoiceNumber;
      invoice.customerSnapshot = customerSnapshot;
      invoice.businessSnapshot = businessSnapshot;
      invoice.assetSnapshot = assetSnapshot;
      invoice.items = calcResult.items as any;
      invoice.totals = calcResult.totals;
      // 8. Process Initial Payment (if provided upon finalization)
      const paymentInput = req.body.payment || req.body.paymentDetails || invoice.draftPaymentDetails;
      let initialPaymentRecord: any = null;

      if (paymentInput && (paymentInput.status === 'PAID' || paymentInput.status === 'PARTIAL')) {
        let amountMinor = 0;
        if (paymentInput.status === 'PAID') {
          amountMinor = calcResult.totals.grandTotalMinor;
        } else if (paymentInput.status === 'PARTIAL') {
          amountMinor = Math.round(Number(paymentInput.amountMinor !== undefined ? paymentInput.amountMinor : (Number(paymentInput.amount) * 100)));
          if (isNaN(amountMinor) || amountMinor <= 0) {
            throw new AppError('Partial payment amount must be greater than zero', 400, 'BAD_REQUEST');
          }
          if (amountMinor >= calcResult.totals.grandTotalMinor) {
            throw new AppError('Partial payment amount must be less than the invoice total', 400, 'BAD_REQUEST');
          }
        }

        const allowedMethods = ['CASH', 'UPI', 'QR_CODE', 'BANK_TRANSFER', 'CHEQUE'];
        const paymentMethod = paymentInput.method && allowedMethods.includes(paymentInput.method) ? paymentInput.method : 'CASH';

        let resolvedPaymentAccountId: any = null;
        let paymentAccountSnapshot: any = null;

        if (paymentMethod === 'CASH') {
          if (paymentInput.paymentAccountId) {
            const cashAcc = await PaymentAccount.findOne({
              _id: paymentInput.paymentAccountId,
              businessId: req.businessId,
            }).session(session);
            if (!cashAcc) {
              throw new AppError('Payment account not found or belongs to another business', 404, 'NOT_FOUND');
            }
            if (!cashAcc.active) {
              throw new AppError('Selected payment account is inactive', 400, 'BAD_REQUEST');
            }
            if (cashAcc.type !== 'CASH') {
              throw new AppError('Cash payment requires a CASH account', 400, 'BAD_REQUEST');
            }
            resolvedPaymentAccountId = cashAcc._id;
            paymentAccountSnapshot = {
              name: cashAcc.name,
              type: 'CASH',
              displayName: cashAcc.displayName || cashAcc.name || 'Cash',
            };
          } else {
            paymentAccountSnapshot = {
              name: 'Cash',
              type: 'CASH',
              displayName: 'Cash',
            };
          }
        } else if (paymentMethod === 'UPI' || paymentMethod === 'QR_CODE') {
          if (!paymentInput.paymentAccountId) {
            throw new AppError(`Receiving account is required for ${paymentMethod}`, 400, 'BAD_REQUEST');
          }
          const upiAcc = await PaymentAccount.findOne({
            _id: paymentInput.paymentAccountId,
            businessId: req.businessId,
          }).session(session);
          if (!upiAcc) {
            throw new AppError('Payment account not found or belongs to another business', 404, 'NOT_FOUND');
          }
          if (!upiAcc.active) {
            throw new AppError('Selected payment account is inactive', 400, 'BAD_REQUEST');
          }
          if (upiAcc.type !== 'UPI') {
            throw new AppError(`Payment method ${paymentMethod} requires a UPI account`, 400, 'BAD_REQUEST');
          }
          resolvedPaymentAccountId = upiAcc._id;
          paymentAccountSnapshot = {
            name: upiAcc.name,
            type: 'UPI',
            displayName: upiAcc.displayName,
            upiId: upiAcc.upiId,
            qrAssetUrl: upiAcc.qrAssetUrl || null,
          };
        } else if (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHEQUE') {
          if (!paymentInput.paymentAccountId) {
            throw new AppError(`Receiving/Deposit bank account is required for ${paymentMethod}`, 400, 'BAD_REQUEST');
          }
          const bankAcc = await PaymentAccount.findOne({
            _id: paymentInput.paymentAccountId,
            businessId: req.businessId,
          }).session(session);
          if (!bankAcc) {
            throw new AppError('Payment account not found or belongs to another business', 404, 'NOT_FOUND');
          }
          if (!bankAcc.active) {
            throw new AppError('Selected payment account is inactive', 400, 'BAD_REQUEST');
          }
          if (bankAcc.type !== 'BANK') {
            throw new AppError(`Payment method ${paymentMethod} requires a BANK account`, 400, 'BAD_REQUEST');
          }
          resolvedPaymentAccountId = bankAcc._id;
          paymentAccountSnapshot = {
            name: bankAcc.name,
            type: 'BANK',
            displayName: bankAcc.displayName,
            bankName: bankAcc.bankName,
            maskedAccountNumber: bankAcc.maskedAccountNumber,
            ifsc: bankAcc.ifsc,
          };
        }

        let structuredChequeDetails: any = null;
        if (paymentMethod === 'CHEQUE') {
          structuredChequeDetails = {
            chequeNumber: paymentInput.chequeDetails?.chequeNumber ? String(paymentInput.chequeDetails.chequeNumber).trim() : (paymentInput.referenceNumber ? String(paymentInput.referenceNumber).trim() : null),
            chequeDate: paymentInput.chequeDetails?.chequeDate ? new Date(paymentInput.chequeDetails.chequeDate) : (paymentInput.paymentDate ? new Date(paymentInput.paymentDate) : new Date()),
            bankName: paymentInput.chequeDetails?.bankName ? String(paymentInput.chequeDetails.bankName).trim() : null,
            status: 'RECEIVED',
          };
        }

        let structuredProof: any = null;
        if (paymentInput.proof && paymentInput.proof.secureUrl) {
          structuredProof = {
            publicId: paymentInput.proof.publicId || null,
            secureUrl: paymentInput.proof.secureUrl,
            format: paymentInput.proof.format || null,
            fileType: paymentInput.proof.fileType || null,
            uploadedAt: paymentInput.proof.uploadedAt ? new Date(paymentInput.proof.uploadedAt) : new Date(),
          };
        }

        const [paymentRecord] = await Payment.create([
          {
            businessId: req.businessId,
            invoiceId: invoice._id,
            amountMinor,
            currency: 'INR',
            method: paymentMethod,
            paymentAccountId: resolvedPaymentAccountId,
            paymentAccountSnapshot,
            referenceNumber: paymentInput.referenceNumber ? String(paymentInput.referenceNumber).trim() : null,
            chequeDetails: structuredChequeDetails,
            proof: structuredProof,
            paidAt: paymentInput.paidAt || paymentInput.paymentDate ? new Date(paymentInput.paidAt || paymentInput.paymentDate) : new Date(),
            notes: paymentInput.notes ? String(paymentInput.notes).trim() : null,
            recordedBy: req.user?._id,
            status: 'CONFIRMED',
          }
        ], { session });

        initialPaymentRecord = paymentRecord;

        invoice.paymentSummary = {
          paidAmountMinor: amountMinor,
          dueAmountMinor: calcResult.totals.grandTotalMinor - amountMinor,
          status: amountMinor >= calcResult.totals.grandTotalMinor ? 'PAID' : 'PARTIALLY_PAID',
        };
      } else {
        invoice.paymentSummary = {
          paidAmountMinor: 0,
          dueAmountMinor: calcResult.totals.grandTotalMinor,
          status: 'UNPAID',
        };
      }

      // 9. Apply Updates & Save Invoice Status change
      invoice.status = 'FINALIZED';
      invoice.invoiceNumber = invoiceNumber;
      invoice.customerSnapshot = customerSnapshot;
      invoice.businessSnapshot = businessSnapshot;
      invoice.assetSnapshot = assetSnapshot;
      invoice.items = calcResult.items as any;
      invoice.totals = calcResult.totals;
      invoice.amountInWords = calcResult.amountInWords;
      invoice.draftPaymentDetails = null;
      invoice.finalizedBy = req.user?._id;
      invoice.finalizedAt = new Date();
      invoice.document.snapshot.status = 'GENERATING';
      invoice.document.snapshot.lastAttemptedAt = new Date();
      invoice.document.snapshot.errorMessage = null;
      invoice.document.pdf.status = 'GENERATING';
      invoice.document.pdf.lastAttemptedAt = new Date();
      invoice.document.pdf.errorMessage = null;

      await invoice.save({ session });

      // 10. Write Audit Logs
      await AuditLog.create([
        {
          businessId: req.businessId,
          actorId: req.user?._id,
          action: 'INVOICE_FINALIZED',
          entity: 'INVOICE',
          entityId: invoice._id,
          previousState: { status: 'DRAFT' },
          newState: { status: 'FINALIZED', invoiceNumber, paymentSummary: invoice.paymentSummary },
          metadata: { invoiceNumber },
          timestamp: new Date(),
        }
      ], { session });

      if (initialPaymentRecord) {
        await AuditLog.create([
          {
            businessId: req.businessId,
            actorId: req.user?._id,
            action: 'PAYMENT_CREATED',
            entity: 'PAYMENT',
            entityId: initialPaymentRecord._id,
            previousState: null,
            newState: {
              status: 'CONFIRMED',
              amountMinor: initialPaymentRecord.amountMinor,
              method: initialPaymentRecord.method,
              accountSnapshot: initialPaymentRecord.paymentAccountSnapshot,
            },
            metadata: { invoiceId: invoice._id, invoiceNumber, isInitialPayment: true },
            timestamp: new Date(),
          }
        ], { session });
      }

      return {
        invoice: {
          id: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          document: invoice.document,
        },
      };
    });

    // 10. Trigger document generation in background AFTER transaction commit
    triggerBackgroundDocGen(req.businessId!.toString(), result.invoice.id.toString());

    res.status(200).json({
      success: true,
      data: result,
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

    const resultInvoice = await executeInTransaction(async (session) => {
      const invoice = await Invoice.findOne({
        _id: req.params.id,
        businessId: req.businessId,
      }).session(session);

      if (!invoice) {
        throw new AppError('Invoice not found', 404, 'NOT_FOUND');
      }

      if (invoice.status === 'CANCELLED') {
        throw new AppError('Invoice is already cancelled', 400, 'BAD_REQUEST');
      }

      const previousStatus = invoice.status;

      invoice.status = 'CANCELLED';
      invoice.cancelledAt = new Date();
      invoice.cancelledBy = req.user?._id;
      invoice.cancellationReason = reason.trim();
      await invoice.save({ session });

      // Record Audit Log
      await AuditLog.create([
        {
          businessId: req.businessId,
          actorId: req.user?._id,
          action: 'INVOICE_CANCELLED',
          entity: 'INVOICE',
          entityId: invoice._id,
          previousState: { status: previousStatus },
          newState: { status: 'CANCELLED' },
          metadata: { reason: reason.trim() },
          timestamp: new Date(),
        }
      ], { session });

      return invoice;
    });

    res.status(200).json({
      success: true,
      data: {
        invoice: {
          id: resultInvoice._id,
          status: resultInvoice.status,
          cancellationReason: resultInvoice.cancellationReason,
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
      {
        $set: {
          'document.snapshot.status': 'GENERATING',
          'document.snapshot.lastAttemptedAt': new Date(),
          'document.pdf.status': 'GENERATING',
          'document.pdf.lastAttemptedAt': new Date(),
        }
      }
    );

    // Trigger document generation in background
    triggerBackgroundDocGen(req.businessId!.toString(), invoice._id.toString());

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

export async function downloadInvoiceFile(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { format } = req.query; // 'pdf' or 'png'

    const invoice = await Invoice.findOne({
      _id: id,
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
      type: item.type,
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

    const renderData = {
      invoice: {
        id: invoice._id.toString(),
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        amountInWords: invoice.amountInWords,
        paymentTerms: invoice.paymentTerms,
        notes: invoice.notes,
      },
      business: businessData,
      customer: customerData,
      items: formattedItems,
      totals: formattedTotals,
      assets: assetData,
    };

    const { pngBuffer, pdfBuffer } = await DocumentGenerationService.generateBuffers(renderData as any);

    if (format === 'png') {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="bill-${invoice.invoiceNumber || 'draft'}.png"`);
      res.send(pngBuffer);
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="bill-${invoice.invoiceNumber || 'draft'}.pdf"`);
      res.send(pdfBuffer);
    }
  } catch (err) {
    next(err);
  }
}

export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'NOT_FOUND'));
    }
    const payments = await Payment.find({ invoiceId: invoice._id, businessId: req.businessId });
    res.status(200).json({
      success: true,
      data: { payments },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function uploadPaymentProof(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      return next(new AppError('No proof file provided', 400, 'BAD_REQUEST'));
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, businessId: req.businessId });
    if (!invoice) {
      return next(new AppError('Invoice not found', 404, 'NOT_FOUND'));
    }

    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'pdf'];

    const fileExt = req.file.originalname.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return next(new AppError('Only PNG, JPG, JPEG, WEBP, and PDF files are allowed', 400, 'BAD_REQUEST'));
    }

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return next(new AppError('Invalid proof file MIME format', 400, 'BAD_REQUEST'));
    }

    const maxSizeBytes = 10 * 1024 * 1024;
    if (req.file.size > maxSizeBytes) {
      return next(new AppError('File size exceeds the maximum limit of 10MB', 400, 'BAD_REQUEST'));
    }

    let secureUrl = '';
    let publicId = '';
    let format = fileExt;

    if (isCloudinaryConfigured) {
      try {
        const folderPath = `businesses/${req.businessId}/invoices/${invoice._id}/proofs`;
        const uploadResult: any = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: folderPath,
              public_id: `${Date.now()}`,
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          stream.write(req.file!.buffer);
          stream.end();
        });

        secureUrl = uploadResult.secure_url;
        publicId = uploadResult.public_id;
        format = uploadResult.format || fileExt;
      } catch (uploadErr: any) {
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
          publicId = `mock_proof_${req.businessId}_${Date.now()}`;
          secureUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1/${publicId}.png`;
        } else {
          return next(new AppError(`Failed to upload proof: ${uploadErr.message}`, 502, 'BAD_GATEWAY'));
        }
      }
    } else {
      publicId = `mock_proof_${req.businessId}_${Date.now()}`;
      secureUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1/${publicId}.png`;
    }

    const proof = {
      publicId,
      secureUrl,
      format,
      fileType: req.file.mimetype,
      uploadedAt: new Date(),
    };

    res.status(200).json({
      success: true,
      data: {
        proof,
      },
    });
  } catch (err: any) {
    next(err);
  }
}

export async function recordPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await executeInTransaction(async (session) => {
      const invoice = await Invoice.findOne({ _id: req.params.id, businessId: req.businessId }).session(session);
      if (!invoice) {
        throw new AppError('Invoice not found', 404, 'NOT_FOUND');
      }
      if (invoice.status !== 'FINALIZED') {
        throw new AppError('Payments can only be recorded for finalized invoices', 400, 'BAD_REQUEST');
      }

      const { amountMinor, method, paymentAccountId, referenceNumber, chequeDetails, proof, paidAt, notes } = req.body;
      const parsedAmountMinor = Math.round(Number(amountMinor));
      if (isNaN(parsedAmountMinor) || parsedAmountMinor <= 0) {
        throw new AppError('Payment amount must be greater than zero', 400, 'BAD_REQUEST');
      }

      const confirmedPayments = await Payment.find({
        invoiceId: invoice._id,
        status: 'CONFIRMED',
      }).session(session);

      const currentPaidMinor = confirmedPayments.reduce((sum, p) => sum + p.amountMinor, 0);
      const remainingDueMinor = invoice.totals.grandTotalMinor - currentPaidMinor;

      if (parsedAmountMinor > remainingDueMinor) {
        throw new AppError(`Payment amount ${parsedAmountMinor} paise exceeds remaining due amount ${remainingDueMinor} paise`, 400, 'BAD_REQUEST');
      }

      const allowedMethods = ['CASH', 'UPI', 'QR_CODE', 'BANK_TRANSFER', 'CHEQUE'];
      const paymentMethod = method && allowedMethods.includes(method) ? method : 'CASH';

      let resolvedPaymentAccountId: any = null;
      let paymentAccountSnapshot: any = null;

      if (paymentMethod === 'CASH') {
        if (paymentAccountId) {
          const cashAcc = await PaymentAccount.findOne({
            _id: paymentAccountId,
            businessId: req.businessId,
          }).session(session);
          if (!cashAcc) {
            throw new AppError('Payment account not found or belongs to another business', 404, 'NOT_FOUND');
          }
          if (!cashAcc.active) {
            throw new AppError('Selected payment account is inactive', 400, 'BAD_REQUEST');
          }
          if (cashAcc.type !== 'CASH') {
            throw new AppError('Cash payment requires a CASH account', 400, 'BAD_REQUEST');
          }
          resolvedPaymentAccountId = cashAcc._id;
          paymentAccountSnapshot = {
            name: cashAcc.name,
            type: 'CASH',
            displayName: cashAcc.displayName || cashAcc.name || 'Cash',
          };
        } else {
          paymentAccountSnapshot = {
            name: 'Cash',
            type: 'CASH',
            displayName: 'Cash',
          };
        }
      } else if (paymentMethod === 'UPI' || paymentMethod === 'QR_CODE') {
        if (!paymentAccountId) {
          throw new AppError(`Receiving account is required for ${paymentMethod}`, 400, 'BAD_REQUEST');
        }
        const upiAcc = await PaymentAccount.findOne({
          _id: paymentAccountId,
          businessId: req.businessId,
        }).session(session);
        if (!upiAcc) {
          throw new AppError('Payment account not found or belongs to another business', 404, 'NOT_FOUND');
        }
        if (!upiAcc.active) {
          throw new AppError('Selected payment account is inactive', 400, 'BAD_REQUEST');
        }
        if (upiAcc.type !== 'UPI') {
          throw new AppError(`Payment method ${paymentMethod} requires a UPI account`, 400, 'BAD_REQUEST');
        }
        resolvedPaymentAccountId = upiAcc._id;
        paymentAccountSnapshot = {
          name: upiAcc.name,
          type: 'UPI',
          displayName: upiAcc.displayName,
          upiId: upiAcc.upiId,
          qrAssetUrl: upiAcc.qrAssetUrl || null,
        };
      } else if (paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'CHEQUE') {
        if (!paymentAccountId) {
          throw new AppError(`Receiving/Deposit bank account is required for ${paymentMethod}`, 400, 'BAD_REQUEST');
        }
        const bankAcc = await PaymentAccount.findOne({
          _id: paymentAccountId,
          businessId: req.businessId,
        }).session(session);
        if (!bankAcc) {
          throw new AppError('Payment account not found or belongs to another business', 404, 'NOT_FOUND');
        }
        if (!bankAcc.active) {
          throw new AppError('Selected payment account is inactive', 400, 'BAD_REQUEST');
        }
        if (bankAcc.type !== 'BANK') {
          throw new AppError(`Payment method ${paymentMethod} requires a BANK account`, 400, 'BAD_REQUEST');
        }
        resolvedPaymentAccountId = bankAcc._id;
        paymentAccountSnapshot = {
          name: bankAcc.name,
          type: 'BANK',
          displayName: bankAcc.displayName,
          bankName: bankAcc.bankName,
          maskedAccountNumber: bankAcc.maskedAccountNumber,
          ifsc: bankAcc.ifsc,
        };
      }

      // Structure Cheque details if CHEQUE
      let structuredChequeDetails: any = null;
      if (paymentMethod === 'CHEQUE') {
        structuredChequeDetails = {
          chequeNumber: chequeDetails?.chequeNumber ? String(chequeDetails.chequeNumber).trim() : (referenceNumber ? String(referenceNumber).trim() : null),
          chequeDate: chequeDetails?.chequeDate ? new Date(chequeDetails.chequeDate) : (paidAt ? new Date(paidAt) : new Date()),
          bankName: chequeDetails?.bankName ? String(chequeDetails.bankName).trim() : null,
          status: chequeDetails?.status || 'RECEIVED',
        };
      }

      // Structure Proof if provided
      let structuredProof: any = null;
      if (proof && proof.secureUrl) {
        structuredProof = {
          publicId: proof.publicId || null,
          secureUrl: proof.secureUrl,
          format: proof.format || null,
          fileType: proof.fileType || null,
          uploadedAt: proof.uploadedAt ? new Date(proof.uploadedAt) : new Date(),
        };
      }

      // Create Payment record
      const [payment] = await Payment.create([
        {
          businessId: req.businessId,
          invoiceId: invoice._id,
          amountMinor: parsedAmountMinor,
          currency: 'INR',
          method: paymentMethod,
          paymentAccountId: resolvedPaymentAccountId,
          paymentAccountSnapshot,
          referenceNumber: referenceNumber ? String(referenceNumber).trim() : null,
          chequeDetails: structuredChequeDetails,
          proof: structuredProof,
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          notes: notes ? String(notes).trim() : null,
          recordedBy: req.user?._id,
          status: 'CONFIRMED',
        }
      ], { session });

      // Update payment summary on invoice
      const newPaidMinor = currentPaidMinor + parsedAmountMinor;
      const newDueMinor = invoice.totals.grandTotalMinor - newPaidMinor;
      invoice.paymentSummary = {
        paidAmountMinor: newPaidMinor,
        dueAmountMinor: newDueMinor <= 0 ? 0 : newDueMinor,
        status: newDueMinor <= 0 ? 'PAID' : 'PARTIALLY_PAID',
      };

      await invoice.save({ session });

      // Audit Log
      await AuditLog.create([
        {
          businessId: req.businessId,
          actorId: req.user?._id,
          action: 'PAYMENT_CREATED',
          entity: 'PAYMENT',
          entityId: payment._id,
          previousState: null,
          newState: {
            status: 'CONFIRMED',
            amountMinor: parsedAmountMinor,
            method: paymentMethod,
            accountSnapshot: paymentAccountSnapshot,
          },
          metadata: { invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber },
          timestamp: new Date(),
        }
      ], { session });

      return { payment, paymentSummary: invoice.paymentSummary };
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    next(err);
  }
}

export async function reversePayment(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await executeInTransaction(async (session) => {
      const { id: invoiceId, paymentId } = req.params;
      const invoice = await Invoice.findOne({ _id: invoiceId, businessId: req.businessId }).session(session);
      if (!invoice) {
        throw new AppError('Invoice not found', 404, 'NOT_FOUND');
      }

      const payment = await Payment.findOne({ _id: paymentId, invoiceId: invoice._id, businessId: req.businessId }).session(session);
      if (!payment) {
        throw new AppError('Payment record not found', 404, 'NOT_FOUND');
      }
      if (payment.status === 'REVERSED') {
        throw new AppError('Payment is already reversed', 400, 'BAD_REQUEST');
      }

      payment.status = 'REVERSED';
      await payment.save({ session });

      // Recalculate confirmed payments
      const confirmedPayments = await Payment.find({
        invoiceId: invoice._id,
        status: 'CONFIRMED'
      }).session(session);

      const totalPaidMinor = confirmedPayments.reduce((sum, p) => sum + p.amountMinor, 0);

      invoice.paymentSummary.paidAmountMinor = totalPaidMinor;
      invoice.paymentSummary.dueAmountMinor = invoice.totals.grandTotalMinor - totalPaidMinor;
      invoice.paymentSummary.status = invoice.paymentSummary.dueAmountMinor <= 0 ? 'PAID' : (totalPaidMinor > 0 ? 'PARTIALLY_PAID' : 'UNPAID');

      await invoice.save({ session });

      // Audit Log
      await AuditLog.create([
        {
          businessId: req.businessId,
          actorId: req.user?._id,
          action: 'PAYMENT_REVERSED',
          entity: 'PAYMENT',
          entityId: payment._id,
          previousState: { status: 'CONFIRMED' },
          newState: { status: 'REVERSED' },
          metadata: { invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber, reason: req.body.reason },
          timestamp: new Date(),
        }
      ], { session });

      return { payment, paymentSummary: invoice.paymentSummary };
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    next(err);
  }
}
