import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceItem {
  productId: mongoose.Types.ObjectId | null;
  type: 'SERVICE' | 'PRODUCT';
  description: string;
  uom: string;
  quantity: number;
  unitPriceMinor: number;
  taxableAmountMinor: number;
  taxes: Array<{
    type: string;
    rateBps: number;
    amountMinor: number;
  }>;
  taxAmountMinor: number;
  lineTotalMinor: number;
}

export interface IInvoice extends Document {
  businessId: mongoose.Types.ObjectId;
  invoiceNumber: string | null;
  invoiceDate: Date;
  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  currency: 'INR';
  customerId: mongoose.Types.ObjectId | null;
  customerSnapshot: Record<string, any>;
  businessSnapshot: Record<string, any>;
  assetSnapshot: Record<string, any>;
  taxMode: 'NONE' | 'EXCLUSIVE' | 'INCLUSIVE';
  defaultTaxRateBps: number;
  discount: {
    type: 'NONE' | 'FIXED' | 'PERCENTAGE';
    value: number;
  };
  items: IInvoiceItem[];
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    taxableAmountMinor: number;
    taxes: Array<{
      type: string;
      rateBps: number;
      amountMinor: number;
    }>;
    taxTotalMinor: number;
    roundingMinor: number;
    grandTotalMinor: number;
    currency: 'INR';
  };
  amountInWords: string;
  paymentTerms: string | null;
  notes: string | null;
  paymentSummary: {
    paidAmountMinor: number;
    dueAmountMinor: number;
    status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  };
  publicAccess: {
    enabled: boolean;
    tokenHash: string | null;
    createdAt: Date | null;
    expiresAt: Date | null;
  };
  document: {
    snapshot: {
      status: 'NOT_GENERATED' | 'GENERATING' | 'READY' | 'FAILED';
      provider: string;
      publicId: string | null;
      secureUrl: string | null;
      format: string;
      width: number | null;
      height: number | null;
      generatedAt: Date | null;
      checksum: string | null;
    };
    pdf: {
      status: 'NOT_GENERATED' | 'GENERATING' | 'READY' | 'FAILED';
      provider: string;
      storageKey: string | null;
      secureUrl: string | null;
      generatedAt: Date | null;
      checksum: string | null;
    };
  };
  createdBy: mongoose.Types.ObjectId;
  finalizedBy: mongoose.Types.ObjectId | null;
  cancelledBy: mongoose.Types.ObjectId | null;
  cancellationReason: string | null;
  finalizedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItem>({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
  type: { type: String, required: true, enum: ['SERVICE', 'PRODUCT'] },
  description: { type: String, required: true },
  uom: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPriceMinor: { type: Number, required: true },
  taxableAmountMinor: { type: Number, required: true },
  taxes: [
    {
      type: { type: String, required: true },
      rateBps: { type: Number, required: true },
      amountMinor: { type: Number, required: true },
    },
  ],
  taxAmountMinor: { type: Number, default: 0 },
  lineTotalMinor: { type: Number, required: true },
});

const InvoiceSchema = new Schema<IInvoice>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    invoiceNumber: { type: String, default: null },
    invoiceDate: { type: Date, required: true },
    status: { type: String, required: true, enum: ['DRAFT', 'FINALIZED', 'CANCELLED'], default: 'DRAFT' },
    currency: { type: String, required: true, enum: ['INR'], default: 'INR' },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
    customerSnapshot: { type: Schema.Types.Mixed, default: {} },
    businessSnapshot: { type: Schema.Types.Mixed, default: {} },
    assetSnapshot: { type: Schema.Types.Mixed, default: {} },
    taxMode: { type: String, required: true, enum: ['NONE', 'EXCLUSIVE', 'INCLUSIVE'], default: 'NONE' },
    defaultTaxRateBps: { type: Number, default: 0 },
    discount: {
      type: { type: String, enum: ['NONE', 'FIXED', 'PERCENTAGE'], default: 'NONE' },
      value: { type: Number, default: 0 },
    },
    items: [InvoiceItemSchema],
    totals: {
      subtotalMinor: { type: Number, required: true },
      discountMinor: { type: Number, default: 0 },
      taxableAmountMinor: { type: Number, required: true },
      taxes: [
        {
          type: { type: String, required: true },
          rateBps: { type: Number, required: true },
          amountMinor: { type: Number, required: true },
        },
      ],
      taxTotalMinor: { type: Number, default: 0 },
      roundingMinor: { type: Number, default: 0 },
      grandTotalMinor: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
    },
    amountInWords: { type: String, default: '' },
    paymentTerms: { type: String, default: null },
    notes: { type: String, default: null },
    paymentSummary: {
      paidAmountMinor: { type: Number, default: 0 },
      dueAmountMinor: { type: Number, required: true },
      status: { type: String, enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'], default: 'UNPAID' },
    },
    publicAccess: {
      enabled: { type: Boolean, default: false },
      tokenHash: { type: String, default: null },
      createdAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
    },
    document: {
      snapshot: {
        status: { type: String, default: 'NOT_GENERATED', enum: ['NOT_GENERATED', 'GENERATING', 'READY', 'FAILED'] },
        provider: { type: String, default: 'CLOUDINARY' },
        publicId: { type: String, default: null },
        secureUrl: { type: String, default: null },
        format: { type: String, default: 'png' },
        width: { type: Number, default: null },
        height: { type: Number, default: null },
        generatedAt: { type: Date, default: null },
        checksum: { type: String, default: null },
      },
      pdf: {
        status: { type: String, default: 'NOT_GENERATED', enum: ['NOT_GENERATED', 'GENERATING', 'READY', 'FAILED'] },
        provider: { type: String, default: 'CLOUDINARY' },
        storageKey: { type: String, default: null },
        secureUrl: { type: String, default: null },
        generatedAt: { type: Date, default: null },
        checksum: { type: String, default: null },
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    finalizedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationReason: { type: String, default: null },
    finalizedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Primary query indexes
InvoiceSchema.index({ businessId: 1, createdAt: -1 });
InvoiceSchema.index({ businessId: 1, status: 1 });
InvoiceSchema.index({ businessId: 1, customerId: 1 });

export const Invoice = mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', InvoiceSchema);
export default Invoice;
