import { Schema, model, Document, Types } from 'mongoose';
import { env } from '../../config/env';

export type FieldStatus =
  | 'EXTRACTED'
  | 'VERIFIED'
  | 'REVIEW_REQUIRED'
  | 'MISSING'
  | 'INVALID';

export interface IBoundingBox {
  pageNumber: number;
  box2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
}

export interface IExtractedField<T = any> {
  value: T | null;
  confidence: number;
  status: FieldStatus;
  bbox?: IBoundingBox | null;
  warning?: string | null;
}

export interface ISupplierExtraction {
  name: IExtractedField<string>;
  gstin: IExtractedField<string>;
  pan: IExtractedField<string>;
  address: IExtractedField<string>;
  city: IExtractedField<string>;
  state: IExtractedField<string>;
  stateCode: IExtractedField<string>;
  pincode: IExtractedField<string>;
  phone: IExtractedField<string>;
  email: IExtractedField<string>;
}

export interface IBuyerExtraction {
  name: IExtractedField<string>;
  address: IExtractedField<string>;
  city: IExtractedField<string>;
  state: IExtractedField<string>;
  stateCode: IExtractedField<string>;
  pincode: IExtractedField<string>;
  gstin: IExtractedField<string>;
}

export interface IInvoiceMetaExtraction {
  invoiceNumber: IExtractedField<string>;
  invoiceDate: IExtractedField<string>; // YYYY-MM-DD
  dueDate: IExtractedField<string>; // YYYY-MM-DD
  poNumber: IExtractedField<string>;
  ewayBillNumber: IExtractedField<string>;
  placeOfSupply: IExtractedField<string>;
  isReverseCharge: IExtractedField<boolean>;
  alternativeDates?: string[];
  dateConflict?: boolean;
}

export interface IProductMatchAlternative {
  productId: string;
  productName: string;
  sku: string | null;
  score: number;
}

export interface IProductMatchResult {
  productId: string | null;
  productName: string | null;
  sku: string | null;
  uom: string | null;
  currentStock: number | null;
  lastPurchasePrice: number | null; // In Rupees
  matchingMethod:
    | 'EXACT_SKU'
    | 'EXACT_BARCODE'
    | 'EXACT_NAME'
    | 'HSN_AND_DESCRIPTION'
    | 'FUZZY_DESCRIPTION'
    | 'UNMATCHED';
  confidence: number;
  isMatched: boolean;
  status: FieldStatus;
  alternatives?: IProductMatchAlternative[];
}

export type TaxSource =
  | 'INVOICE_DOCUMENT_EXTRACTED'
  | 'INVOICE_LINE_EXTRACTED'
  | 'INVOICE_EXTRACTED'
  | 'CATALOG_DEFAULT'
  | 'USER_OVERRIDE'
  | 'NOT_SPECIFIED'
  | 'NONE';

export interface IDocumentTaxMetadata {
  mode: 'INTRA_STATE' | 'INTER_STATE' | null;
  hasDocumentTax: boolean;
  hasLineLevelTax: boolean;
  cgstRate: number | null;
  cgstAmount?: number | null;
  sgstRate: number | null;
  sgstAmount?: number | null;
  igstRate: number | null;
  igstAmount?: number | null;
  totalGstRate: number | null;
  totalGstAmount?: number | null;
  taxInclusionMode?: 'EXCLUSIVE' | 'INCLUSIVE' | 'UNKNOWN';
  source: TaxSource;
  evidenceType?: 'DOCUMENT_SUMMARY' | 'LINE_ITEMS' | 'NONE';
}

export interface IExtractedLineItem {
  id: string; // Client row key UUID
  lineNumber: number;
  description: IExtractedField<string>;
  skuOrCode: IExtractedField<string>;
  hsnSac: IExtractedField<string>;
  quantity: IExtractedField<number>;
  unit: IExtractedField<string>;
  unitPrice: IExtractedField<number>; // In Rupees
  discountPercent: IExtractedField<number>;
  discountAmount: IExtractedField<number>; // In Rupees
  taxableAmount: IExtractedField<number>; // In Rupees
  gstRate: IExtractedField<number>; // e.g. 18.0
  cgstRate: IExtractedField<number>;
  cgstAmount: IExtractedField<number>; // In Rupees
  sgstRate: IExtractedField<number>;
  sgstAmount: IExtractedField<number>; // In Rupees
  igstRate: IExtractedField<number>;
  igstAmount: IExtractedField<number>; // In Rupees
  cessRate: IExtractedField<number>;
  cessAmount: IExtractedField<number>; // In Rupees
  lineTotal: IExtractedField<number>; // In Rupees (printed)
  calculated?: {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    lineTotal: number;
    discrepancy: number; // In Rupees
  };
  productMatch?: IProductMatchResult;
  taxMode?: 'EXCLUSIVE' | 'INCLUSIVE' | 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE';
  taxSource?: TaxSource;
  gstNotice?: string | null;
}

export interface ISummaryExtraction {
  subtotal: IExtractedField<number>;
  totalDiscount: IExtractedField<number>;
  taxableAmount: IExtractedField<number>;
  cgstRate?: IExtractedField<number>;
  cgstAmount: IExtractedField<number>;
  sgstRate?: IExtractedField<number>;
  sgstAmount: IExtractedField<number>;
  igstRate?: IExtractedField<number>;
  igstAmount: IExtractedField<number>;
  cessAmount: IExtractedField<number>;
  totalTax: IExtractedField<number>;
  roundOff: IExtractedField<number>;
  grandTotal: IExtractedField<number>;
  amountPaid: IExtractedField<number>;
  balanceDue: IExtractedField<number>;
  taxExtractionStatus?: 'VERIFIED' | 'DERIVED' | 'DISCREPANT' | 'UNVERIFIED';
}

export interface IPaymentDetailsExtraction {
  paymentMode: IExtractedField<'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT' | 'OTHER'>;
  bankName: IExtractedField<string>;
  bankAccountNumber: IExtractedField<string>;
  bankIfsc: IExtractedField<string>;
  upiId: IExtractedField<string>;
  transactionReference: IExtractedField<string>;
}

export interface IAdditionalDetailsExtraction {
  notes: IExtractedField<string>;
  termsAndConditions: IExtractedField<string>;
  vehicleNumber: IExtractedField<string>;
}

export interface IPurchaseBillExtraction {
  supplier: ISupplierExtraction;
  buyer?: IBuyerExtraction;
  invoice: IInvoiceMetaExtraction;
  items: IExtractedLineItem[];
  summary: ISummaryExtraction;
  payment: IPaymentDetailsExtraction;
  additional: IAdditionalDetailsExtraction;
  tax?: IDocumentTaxMetadata;
}

export interface IVendorMatchAlternative {
  vendorId: string;
  name: string;
  gstNumber: string | null;
  similarity: number;
}

export interface IVendorMatchResult {
  matchedVendorId: string | null;
  matchedVendorName: string | null;
  matchedVendorGstin: string | null;
  matchingMethod: 'EXACT_GSTIN' | 'PAN_MATCH' | 'EXACT_NAME' | 'FUZZY_NAME_OR_PHONE' | 'NO_MATCH';
  confidence: number;
  status: FieldStatus;
  alternatives?: IVendorMatchAlternative[];
}

export type DraftStatus =
  | 'PROCESSING'
  | 'DRAFT_READY'
  | 'VALIDATION_ERROR'
  | 'CONFIRMING'
  | 'CONVERTED'
  | 'EXPIRED';

export interface IDraftReconciliation {
  isMathValid: boolean;
  hasDiscrepancies: boolean;
  discrepancyNotes: string[];
  calculatedSubtotal: number;
  calculatedTaxTotal: number;
  calculatedGrandTotal: number;
  calculatedCgstAmount?: number;
  calculatedSgstAmount?: number;
  calculatedIgstAmount?: number;
  taxMode?: 'INTRA_STATE' | 'INTER_STATE' | 'UNKNOWN';
}

export interface IPurchaseDraftOriginalFile {
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  publicId: string;
  pageCount: number;
  previewImages: string[];
  fileHash?: string | null;
}

export interface IUserCorrection {
  field: string;
  originalValue: any;
  newValue: any;
  changedAt: Date;
  changedBy?: Types.ObjectId | null;
  reason?: string | null;
}

export interface IPurchaseDraft extends Document {
  businessId: Types.ObjectId;
  draftNumber: string;
  originalFile: IPurchaseDraftOriginalFile;
  rawExtraction: IPurchaseBillExtraction; // Immutable original extraction from AI
  extraction: IPurchaseBillExtraction; // Working copy containing user updates/edits
  reconciliation: IDraftReconciliation;
  vendorId?: Types.ObjectId | null;
  vendorMatch: IVendorMatchResult;
  manualOverride?: boolean;
  userCorrections?: IUserCorrection[];
  totalSource?: 'PRINTED_BILL' | 'DETERMINISTIC_CALCULATION' | 'DETERMINISTIC_CALCULATION_PENDING' | 'USER_OVERRIDE';
  finalPurchaseTotal?: number | null;
  acceptedCalculatedTotalAt?: Date | null;
  acceptedCalculatedTotalBy?: Types.ObjectId | null;
  status: DraftStatus;
  idempotencyKey?: string | null;
  confirmedPurchaseId?: Types.ObjectId | null;
  confirmedAt?: Date | null;
  confirmedBy?: Types.ObjectId | null;
  confirmationStartedAt?: Date | null;
  createdBy: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ----------------------------------------------------
// Sub-schemas for Mongoose
// ----------------------------------------------------

const BoundingBoxSchema = new Schema<IBoundingBox>(
  {
    pageNumber: { type: Number, required: true },
    box2d: { type: [Number], required: true },
  },
  { _id: false }
);

function createExtractedFieldSubSchema(valueType: any = Schema.Types.Mixed) {
  return new Schema<IExtractedField>(
    {
      value: { type: valueType, default: null },
      confidence: { type: Number, required: true, default: 0, min: 0, max: 1 },
      status: {
        type: String,
        required: true,
        enum: ['EXTRACTED', 'VERIFIED', 'REVIEW_REQUIRED', 'MISSING', 'INVALID'],
        default: 'MISSING',
      },
      bbox: { type: BoundingBoxSchema, default: null },
      warning: { type: String, default: null },
    },
    { _id: false }
  );
}

const ProductMatchSchema = new Schema<IProductMatchResult>(
  {
    productId: { type: String, default: null },
    productName: { type: String, default: null },
    sku: { type: String, default: null },
    uom: { type: String, default: null },
    currentStock: { type: Number, default: null },
    lastPurchasePrice: { type: Number, default: null },
    matchingMethod: {
      type: String,
      required: true,
      enum: [
        'EXACT_SKU',
        'EXACT_BARCODE',
        'EXACT_NAME',
        'HSN_AND_DESCRIPTION',
        'FUZZY_DESCRIPTION',
        'UNMATCHED',
      ],
      default: 'UNMATCHED',
    },
    confidence: { type: Number, required: true, default: 0, min: 0, max: 1 },
    isMatched: { type: Boolean, required: true, default: false },
    status: {
      type: String,
      required: true,
      enum: ['EXTRACTED', 'VERIFIED', 'REVIEW_REQUIRED', 'MISSING', 'INVALID'],
      default: 'MISSING',
    },
    alternatives: {
      type: [
        new Schema(
          {
            productId: { type: String, required: true },
            productName: { type: String, required: true },
            sku: { type: String, default: null },
            score: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

const ExtractedLineItemSchema = new Schema<IExtractedLineItem>(
  {
    id: { type: String, required: true },
    lineNumber: { type: Number, required: true },
    description: createExtractedFieldSubSchema(String),
    skuOrCode: createExtractedFieldSubSchema(String),
    hsnSac: createExtractedFieldSubSchema(String),
    quantity: createExtractedFieldSubSchema(Number),
    unit: createExtractedFieldSubSchema(String),
    unitPrice: createExtractedFieldSubSchema(Number),
    discountPercent: createExtractedFieldSubSchema(Number),
    discountAmount: createExtractedFieldSubSchema(Number),
    taxableAmount: createExtractedFieldSubSchema(Number),
    gstRate: createExtractedFieldSubSchema(Number),
    cgstRate: createExtractedFieldSubSchema(Number),
    cgstAmount: createExtractedFieldSubSchema(Number),
    sgstRate: createExtractedFieldSubSchema(Number),
    sgstAmount: createExtractedFieldSubSchema(Number),
    igstRate: createExtractedFieldSubSchema(Number),
    igstAmount: createExtractedFieldSubSchema(Number),
    cessRate: createExtractedFieldSubSchema(Number),
    cessAmount: createExtractedFieldSubSchema(Number),
    lineTotal: createExtractedFieldSubSchema(Number),
    calculated: {
      taxableAmount: { type: Number, default: 0 },
      cgstAmount: { type: Number, default: 0 },
      sgstAmount: { type: Number, default: 0 },
      igstAmount: { type: Number, default: 0 },
      cessAmount: { type: Number, default: 0 },
      lineTotal: { type: Number, default: 0 },
      discrepancy: { type: Number, default: 0 },
    },
    productMatch: { type: ProductMatchSchema, default: () => ({}) },
    taxMode: { type: String, enum: ['EXCLUSIVE', 'INCLUSIVE', 'TAX_EXCLUSIVE', 'TAX_INCLUSIVE'], default: 'EXCLUSIVE' },
    taxSource: {
      type: String,
      enum: [
        'INVOICE_DOCUMENT_EXTRACTED',
        'INVOICE_LINE_EXTRACTED',
        'INVOICE_EXTRACTED',
        'CATALOG_DEFAULT',
        'USER_OVERRIDE',
        'NOT_SPECIFIED',
        'NONE',
      ],
      default: null,
    },
    gstNotice: { type: String, default: null },
  },
  { _id: false }
);

const PurchaseBillExtractionSchema = new Schema<IPurchaseBillExtraction>(
  {
    supplier: {
      name: createExtractedFieldSubSchema(String),
      gstin: createExtractedFieldSubSchema(String),
      pan: createExtractedFieldSubSchema(String),
      address: createExtractedFieldSubSchema(String),
      city: createExtractedFieldSubSchema(String),
      state: createExtractedFieldSubSchema(String),
      stateCode: createExtractedFieldSubSchema(String),
      pincode: createExtractedFieldSubSchema(String),
      phone: createExtractedFieldSubSchema(String),
      email: createExtractedFieldSubSchema(String),
    },
    buyer: {
      name: createExtractedFieldSubSchema(String),
      address: createExtractedFieldSubSchema(String),
      city: createExtractedFieldSubSchema(String),
      state: createExtractedFieldSubSchema(String),
      stateCode: createExtractedFieldSubSchema(String),
      pincode: createExtractedFieldSubSchema(String),
      gstin: createExtractedFieldSubSchema(String),
    },
    invoice: {
      invoiceNumber: createExtractedFieldSubSchema(String),
      invoiceDate: createExtractedFieldSubSchema(String),
      dueDate: createExtractedFieldSubSchema(String),
      poNumber: createExtractedFieldSubSchema(String),
      ewayBillNumber: createExtractedFieldSubSchema(String),
      placeOfSupply: createExtractedFieldSubSchema(String),
      isReverseCharge: createExtractedFieldSubSchema(Boolean),
      alternativeDates: { type: [String], default: [] },
      dateConflict: { type: Boolean, default: false },
    },
    items: {
      type: [ExtractedLineItemSchema],
      default: [],
    },
    summary: {
      subtotal: createExtractedFieldSubSchema(Number),
      totalDiscount: createExtractedFieldSubSchema(Number),
      taxableAmount: createExtractedFieldSubSchema(Number),
      cgstRate: createExtractedFieldSubSchema(Number),
      cgstAmount: createExtractedFieldSubSchema(Number),
      sgstRate: createExtractedFieldSubSchema(Number),
      sgstAmount: createExtractedFieldSubSchema(Number),
      igstRate: createExtractedFieldSubSchema(Number),
      igstAmount: createExtractedFieldSubSchema(Number),
      cessAmount: createExtractedFieldSubSchema(Number),
      totalTax: createExtractedFieldSubSchema(Number),
      roundOff: createExtractedFieldSubSchema(Number),
      grandTotal: createExtractedFieldSubSchema(Number),
      amountPaid: createExtractedFieldSubSchema(Number),
      balanceDue: createExtractedFieldSubSchema(Number),
      taxExtractionStatus: { type: String, enum: ['VERIFIED', 'DERIVED', 'DISCREPANT', 'UNVERIFIED'], default: null },
    },
    payment: {
      paymentMode: createExtractedFieldSubSchema(String),
      bankName: createExtractedFieldSubSchema(String),
      bankAccountNumber: createExtractedFieldSubSchema(String),
      bankIfsc: createExtractedFieldSubSchema(String),
      upiId: createExtractedFieldSubSchema(String),
      transactionReference: createExtractedFieldSubSchema(String),
    },
    additional: {
      notes: createExtractedFieldSubSchema(String),
      termsAndConditions: createExtractedFieldSubSchema(String),
      vehicleNumber: createExtractedFieldSubSchema(String),
    },
    tax: {
      type: new Schema(
        {
          mode: { type: String, enum: ['INTRA_STATE', 'INTER_STATE'], default: null },
          hasDocumentTax: { type: Boolean, default: false },
          hasLineLevelTax: { type: Boolean, default: false },
          cgstRate: { type: Number, default: null },
          cgstAmount: { type: Number, default: null },
          sgstRate: { type: Number, default: null },
          sgstAmount: { type: Number, default: null },
          igstRate: { type: Number, default: null },
          igstAmount: { type: Number, default: null },
          totalGstRate: { type: Number, default: null },
          totalGstAmount: { type: Number, default: null },
          taxInclusionMode: { type: String, enum: ['EXCLUSIVE', 'INCLUSIVE', 'UNKNOWN'], default: 'EXCLUSIVE' },
          source: { type: String, default: null },
          evidenceType: { type: String, enum: ['DOCUMENT_SUMMARY', 'LINE_ITEMS', 'NONE'], default: 'NONE' },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { _id: false }
);

const VendorMatchSchema = new Schema<IVendorMatchResult>(
  {
    matchedVendorId: { type: String, default: null },
    matchedVendorName: { type: String, default: null },
    matchedVendorGstin: { type: String, default: null },
    matchingMethod: {
      type: String,
      required: true,
      enum: ['EXACT_GSTIN', 'PAN_MATCH', 'EXACT_NAME', 'FUZZY_NAME_OR_PHONE', 'NO_MATCH'],
      default: 'NO_MATCH',
    },
    confidence: { type: Number, required: true, default: 0, min: 0, max: 1 },
    status: {
      type: String,
      required: true,
      enum: ['EXTRACTED', 'VERIFIED', 'REVIEW_REQUIRED', 'MISSING', 'INVALID'],
      default: 'MISSING',
    },
    alternatives: {
      type: [
        new Schema(
          {
            vendorId: { type: String, required: true },
            name: { type: String, required: true },
            gstNumber: { type: String, default: null },
            similarity: { type: Number, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { _id: false }
);

// ----------------------------------------------------
// Main PurchaseDraft Schema
// ----------------------------------------------------

const PurchaseDraftSchema = new Schema<IPurchaseDraft>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    draftNumber: {
      type: String,
      required: true,
      trim: true,
    },
    originalFile: {
      fileName: { type: String, required: true },
      fileSize: { type: Number, required: true, min: 1 },
      mimeType: { type: String, required: true },
      fileUrl: { type: String, required: true },
      publicId: { type: String, required: true },
      pageCount: { type: Number, default: 1, min: 1 },
      previewImages: { type: [String], default: [] },
      fileHash: { type: String, default: null },
    },
    rawExtraction: {
      type: PurchaseBillExtractionSchema,
      required: true,
    },
    extraction: {
      type: PurchaseBillExtractionSchema,
      required: true,
    },
    reconciliation: {
      isMathValid: { type: Boolean, default: false },
      hasDiscrepancies: { type: Boolean, default: false },
      discrepancyNotes: { type: [String], default: [] },
      calculatedSubtotal: { type: Number, default: 0 },
      calculatedTaxTotal: { type: Number, default: 0 },
      calculatedGrandTotal: { type: Number, default: 0 },
      calculatedCgstAmount: { type: Number, default: 0 },
      calculatedSgstAmount: { type: Number, default: 0 },
      calculatedIgstAmount: { type: Number, default: 0 },
      taxMode: { type: String, default: null },
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
      index: true,
    },
    vendorMatch: {
      type: VendorMatchSchema,
      required: true,
      default: () => ({
        matchedVendorId: null,
        matchedVendorName: null,
        matchedVendorGstin: null,
        matchingMethod: 'NO_MATCH',
        confidence: 0,
        status: 'MISSING',
        alternatives: [],
      }),
    },
    manualOverride: {
      type: Boolean,
      default: false,
    },
    userCorrections: [
      {
        field: { type: String, required: true },
        originalValue: { type: Schema.Types.Mixed, default: null },
        newValue: { type: Schema.Types.Mixed, default: null },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        reason: { type: String, default: null },
      },
    ],
    totalSource: {
      type: String,
      enum: ['PRINTED_BILL', 'DETERMINISTIC_CALCULATION', 'DETERMINISTIC_CALCULATION_PENDING', 'USER_OVERRIDE'],
      default: 'PRINTED_BILL',
    },
    finalPurchaseTotal: { type: Number, default: null },
    acceptedCalculatedTotalAt: { type: Date, default: null },
    acceptedCalculatedTotalBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      required: true,
      enum: ['PROCESSING', 'DRAFT_READY', 'VALIDATION_ERROR', 'CONFIRMING', 'CONVERTED', 'EXPIRED'],
      default: 'DRAFT_READY',
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
    },
    confirmedPurchaseId: {
      type: Schema.Types.ObjectId,
      ref: 'Purchase',
      default: null,
    },
    confirmedAt: {
      type: Date,
      default: null,
    },
    confirmedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    confirmationStartedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => {
        const hours = env.PURCHASE_DRAFT_TTL_HOURS || 48;
        return new Date(Date.now() + hours * 60 * 60 * 1000);
      },
    },
  },
  {
    timestamps: true,
    collection: 'purchases_drafts',
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        return ret;
      },
    },
  }
);

// ----------------------------------------------------
// Indexes: Tenancy, Audit, Idempotency, and TTL
// ----------------------------------------------------
PurchaseDraftSchema.index({ businessId: 1, createdAt: -1 });
PurchaseDraftSchema.index({ businessId: 1, status: 1 });
PurchaseDraftSchema.index({ businessId: 1, draftNumber: 1 }, { unique: true });
// Tenant-scoped idempotency index: prevents collisions across tenants, ignores null/undefined
PurchaseDraftSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);
// MongoDB TTL index: expires drafts automatically at expiresAt
PurchaseDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PurchaseDraft = model<IPurchaseDraft>('PurchaseDraft', PurchaseDraftSchema);
export default PurchaseDraft;
