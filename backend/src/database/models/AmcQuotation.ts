import { Schema, model, Document, Types } from 'mongoose';

export interface IAmcQuotationItem {
  serialNumber: number;
  description: string;
  period?: string | null; // e.g. 'Monthly', 'Quarterly', 'Annual'
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IAmcQuotation extends Document {
  businessId: Types.ObjectId;
  quotationNumber: string; // e.g. '252611'
  customerId: Types.ObjectId;
  quotationDate: Date;
  validUntil: Date;
  paymentTerms: string; // e.g. '10 Days from the Invoice date'
  quotationType: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE' | 'RATE_CARD' | 'PERIODIC_CONTRACT' | 'STANDARD';
  items: IAmcQuotationItem[];
  subtotal: number;
  discount: number;
  taxRateBps: number;
  taxAmount: number;
  grandTotal: number;
  termsAndConditions: string[];
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED_TO_CONTRACT';
  convertedContractId?: Types.ObjectId | null;
  notes?: string | null;
  pdfUrl?: string | null;
  snapshotUrl?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AmcQuotationItemSchema = new Schema<IAmcQuotationItem>(
  {
    serialNumber: { type: Number, required: true },
    description: { type: String, required: true, trim: true },
    period: { type: String, default: null, trim: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true, default: 0 },
    amount: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const AmcQuotationSchema = new Schema<IAmcQuotation>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    quotationNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    quotationDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    paymentTerms: {
      type: String,
      default: '10 Days from the Invoice date',
    },
    quotationType: {
      type: String,
      required: true,
      enum: ['COMPREHENSIVE', 'NON_COMPREHENSIVE', 'RATE_CARD', 'PERIODIC_CONTRACT', 'STANDARD'],
      default: 'NON_COMPREHENSIVE',
    },
    items: {
      type: [AmcQuotationItemSchema],
      required: true,
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    taxRateBps: {
      type: Number,
      default: 0, // 0 for tax inclusive or standard GST
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      default: 0,
    },
    termsAndConditions: {
      type: [String],
      default: [
        'This AMC is valid for 1 year from the date of agreement or approval.',
        'Only refrigerant gas is included in the above rates if explicitly configured.',
        'Spare parts are not included. The above rates are for labour charges only.',
        'AC installation charges include up to 10 feet of standard installation.',
        'Additional copper piping beyond 10 feet will be charged on a per-foot basis.',
      ],
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED_TO_CONTRACT'],
      default: 'DRAFT',
      index: true,
    },
    convertedContractId: {
      type: Schema.Types.ObjectId,
      ref: 'AmcContract',
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    snapshotUrl: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'amc_quotations',
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
  }
);

AmcQuotationSchema.index({ businessId: 1, quotationNumber: 1 }, { unique: true });
AmcQuotationSchema.index({ businessId: 1, status: 1 });

export const AmcQuotation = model<IAmcQuotation>('AmcQuotation', AmcQuotationSchema);
export default AmcQuotation;
