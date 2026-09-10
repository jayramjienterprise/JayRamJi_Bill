import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AmcQuotation } from '../../database/models/AmcQuotation';
import { Customer } from '../../database/models/Customer';
import { Business } from '../../database/models/Business';
import { Asset } from '../../database/models/Asset';
import { InvoiceSequence } from '../../database/models/InvoiceSequence';
import { DocumentGenerationService } from '../../services/DocumentGenerationService';
import { AmcQuotationRenderData } from '../../services/AmcRenderService';
import { AppError } from '../../middleware/errorHandler';

const quotationItemSchema = z.object({
  serialNumber: z.number().default(1),
  description: z.string().min(1, 'Description is required'),
  period: z.string().nullable().optional(),
  quantity: z.number().min(0).default(1),
  unitPrice: z.number().min(0, 'Price must be non-negative'),
  amount: z.number().min(0, 'Amount must be non-negative'),
});

const createQuotationSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  quotationNumber: z.string().optional(),
  quotationDate: z.string().optional(),
  validUntil: z.string().optional(),
  paymentTerms: z.string().default('10 Days from the Invoice date'),
  quotationType: z.enum(['COMPREHENSIVE', 'NON_COMPREHENSIVE', 'RATE_CARD', 'PERIODIC_CONTRACT', 'STANDARD']).default('NON_COMPREHENSIVE'),
  items: z.array(quotationItemSchema).min(1, 'At least one line item is required'),
  discount: z.number().min(0).default(0),
  taxRateBps: z.number().min(0).default(0),
  termsAndConditions: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

const updateQuotationSchema = createQuotationSchema.partial();

export async function listQuotations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { customerId, status, quotationType, search } = req.query;

    const query: any = { businessId, active: true };

    if (customerId) {
      query.customerId = customerId;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (quotationType && quotationType !== 'ALL') {
      query.quotationType = quotationType;
    }

    if (search && typeof search === 'string') {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [{ quotationNumber: searchRegex }, { notes: searchRegex }];
    }

    const quotations = await AmcQuotation.find(query)
      .populate('customerId', 'name contact address taxProfile')
      .populate('convertedContractId', 'contractNumber status')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: quotations,
    });
  } catch (error) {
    next(error);
  }
}

export async function getQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const quotation = await AmcQuotation.findOne({ _id: id, businessId, active: true })
      .populate('customerId', 'name contact address taxProfile')
      .populate('convertedContractId', 'contractNumber status');

    if (!quotation) {
      return next(new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND'));
    }

    res.status(200).json({
      success: true,
      data: quotation,
    });
  } catch (error) {
    next(error);
  }
}

export async function createQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const validated = createQuotationSchema.parse(req.body);

    const customer = await Customer.findOne({ _id: validated.customerId, businessId, active: true });
    if (!customer) {
      return next(new AppError('Associated customer not found', 404, 'CUSTOMER_NOT_FOUND'));
    }

    // Auto-generate quotation number if not explicitly specified
    let quotationNumber = validated.quotationNumber?.trim();
    if (!quotationNumber) {
      const seq = await InvoiceSequence.findOneAndUpdate(
        { businessId, key: 'AMC_QUOTATION' },
        { $inc: { nextNumber: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      // Generate standard sequence e.g. 252611
      const prefix = seq.prefix || '2526';
      quotationNumber = `${prefix}${seq.nextNumber}`;
    }

    // Calculate totals
    const calculatedItems = validated.items.map((it, idx) => ({
      ...it,
      serialNumber: it.serialNumber || idx + 1,
      amount: it.amount !== undefined ? it.amount : it.quantity * it.unitPrice,
    }));

    const subtotal = calculatedItems.reduce((acc, it) => acc + it.amount, 0);
    const discount = validated.discount || 0;
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = (taxable * (validated.taxRateBps || 0)) / 10000;
    const grandTotal = Math.round((taxable + taxAmount) * 100) / 100;

    const quotation = await AmcQuotation.create({
      ...validated,
      items: calculatedItems,
      quotationNumber,
      subtotal,
      discount,
      taxAmount,
      grandTotal,
      businessId,
      quotationDate: validated.quotationDate ? new Date(validated.quotationDate) : new Date(),
      validUntil: validated.validUntil
        ? new Date(validated.validUntil)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'DRAFT',
      active: true,
    });

    const populated = await AmcQuotation.findById(quotation._id)
      .populate('customerId', 'name contact address taxProfile');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'AMC Quotation created successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateQuotation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const validated = updateQuotationSchema.parse(req.body);

    const quotation = await AmcQuotation.findOne({ _id: id, businessId, active: true });
    if (!quotation) {
      return next(new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND'));
    }

    if (quotation.status === 'CONVERTED_TO_CONTRACT') {
      return next(
        new AppError(
          'Cannot edit a quotation that has already been converted to an active AMC Contract',
          400,
          'QUOTATION_ALREADY_CONVERTED'
        )
      );
    }

    let items = quotation.items;
    if (validated.items) {
      items = validated.items.map((it, idx) => ({
        ...it,
        serialNumber: it.serialNumber || idx + 1,
        amount: it.amount !== undefined ? it.amount : it.quantity * it.unitPrice,
      }));
    }

    const subtotal = items.reduce((acc, it) => acc + it.amount, 0);
    const discount = validated.discount !== undefined ? validated.discount : quotation.discount;
    const taxRateBps = validated.taxRateBps !== undefined ? validated.taxRateBps : quotation.taxRateBps;
    const taxable = Math.max(0, subtotal - discount);
    const taxAmount = (taxable * taxRateBps) / 10000;
    const grandTotal = Math.round((taxable + taxAmount) * 100) / 100;

    const updatePayload: any = {
      ...validated,
      items,
      subtotal,
      discount,
      taxAmount,
      grandTotal,
    };

    if (validated.quotationDate) {
      updatePayload.quotationDate = new Date(validated.quotationDate);
    }
    if (validated.validUntil) {
      updatePayload.validUntil = new Date(validated.validUntil);
    }

    const updated = await AmcQuotation.findByIdAndUpdate(id, updatePayload, { new: true })
      .populate('customerId', 'name contact address taxProfile');

    res.status(200).json({
      success: true,
      data: updated,
      message: 'AMC Quotation updated successfully',
    });
  } catch (error) {
    next(error);
  }
}

export async function updateQuotationStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { status } = req.body;

    if (!['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'].includes(status)) {
      return next(new AppError('Invalid status transition', 400, 'INVALID_STATUS'));
    }

    const quotation = await AmcQuotation.findOne({ _id: id, businessId, active: true });
    if (!quotation) {
      return next(new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND'));
    }

    quotation.status = status;
    await quotation.save();

    res.status(200).json({
      success: true,
      data: quotation,
      message: `Quotation status updated to ${status}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function generateQuotationPdf(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const quotation = await AmcQuotation.findOne({ _id: id, businessId, active: true })
      .populate('customerId');

    if (!quotation) {
      return next(new AppError('Quotation not found', 404, 'QUOTATION_NOT_FOUND'));
    }

    const business = await Business.findById(businessId);
    if (!business) {
      return next(new AppError('Business profile not found', 404, 'BUSINESS_NOT_FOUND'));
    }

    const activeAssets = await Asset.find({ businessId, active: true });
    const logo = activeAssets.find((a) => a.type === 'LOGO');
    const stamp = activeAssets.find((a) => a.type === 'STAMP');
    const signature = activeAssets.find((a) => a.type === 'SIGNATURE');

    const customer: any = quotation.customerId;

    const renderData: AmcQuotationRenderData = {
      quotation: {
        id: quotation._id.toString(),
        quotationNumber: quotation.quotationNumber,
        quotationDate: quotation.quotationDate,
        validUntil: quotation.validUntil,
        paymentTerms: quotation.paymentTerms,
        title: quotation.quotationType === 'COMPREHENSIVE' ? 'AMC QUOTATION (COMPREHENSIVE)' : 'AMC QUOTATION (NON-COMPREHENSIVE)',
        termsAndConditions: quotation.termsAndConditions,
      },
      business: {
        name: business.name,
        displayName: business.displayName || business.name,
        legalName: business.legalName,
        address: business.address as any,
        contact: business.contact,
        taxProfile: business.taxProfile,
      },
      customer: {
        name: customer?.name || 'Valued Customer',
        address: customer?.address,
        contact: customer?.contact,
        taxProfile: customer?.taxProfile,
      },
      items: quotation.items.map((it) => ({
        serialNumber: it.serialNumber,
        description: it.description,
        period: it.period,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        amount: it.amount,
      })),
      totals: {
        subtotal: quotation.subtotal,
        discount: quotation.discount,
        taxTotal: quotation.taxAmount,
        grandTotal: quotation.grandTotal,
      },
      assets: {
        logo: logo ? { secureUrl: logo.secureUrl } : null,
        stamp: stamp ? { secureUrl: stamp.secureUrl } : null,
        signature: signature ? { secureUrl: signature.secureUrl } : null,
      },
    };

    const { pdfBuffer } = await DocumentGenerationService.generateAmcQuotationBuffers(renderData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="Quotation-${quotation.quotationNumber}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}
