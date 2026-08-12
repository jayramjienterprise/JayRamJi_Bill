import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Invoice } from '../../database/models/Invoice';
import { Customer } from '../../database/models/Customer';
import { Product } from '../../database/models/Product';
import { Business } from '../../database/models/Business';
import { Asset } from '../../database/models/Asset';
import { InvoiceCalculationService } from '../../services/InvoiceCalculationService';
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const filter: any = { businessId: req.businessId };

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.customerId) {
      filter.customerId = req.query.customerId;
    }

    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: {
        invoices,
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

    if (invoice.status === 'FINALIZED') {
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
