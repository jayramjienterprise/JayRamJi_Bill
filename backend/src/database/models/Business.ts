import { Schema, model, Document } from 'mongoose';

export interface IBusiness extends Document {
  name: string;
  legalName: string | null;
  displayName: string | null;
  address: {
    line1: string;
    line2: string | null;
    displayAddress?: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string;
  };
  contact: {
    phone: string | null;
    email: string | null;
    website: string | null;
  };
  timezone: string;
  taxProfile: {
    gstin: string | null;
    pan: string | null;
    taxRegistrationType: string | null;
  };
  bankDetails: {
    bankName: string | null;
    accountHolderName: string | null;
    accountNumber: string | null;
    ifsc: string | null;
    branch: string | null;
  };
  invoiceSettings: {
    invoiceTitle: string;
    prefix: string;
    defaultCurrency: 'INR';
    defaultPaymentTerms: string | null;
    defaultTaxMode: 'NONE' | 'EXCLUSIVE' | 'INCLUSIVE';
    defaultTaxRateBps: number;
    numberingMode: 'SEQUENTIAL';
  };
  paymentSettings: {
    defaultPaymentStatus: 'UNPAID';
  };
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    name: { type: String, required: true, trim: true },
    legalName: { type: String, default: null, trim: true },
    displayName: { type: String, default: null, trim: true },
    address: {
      line1: { type: String, required: true, trim: true },
      line2: { type: String, default: null, trim: true },
      displayAddress: { type: String, default: null, trim: true },
      city: { type: String, default: null, trim: true },
      state: { type: String, default: null, trim: true },
      postalCode: { type: String, default: null, trim: true },
      country: { type: String, required: true, default: 'India', trim: true },
    },
    contact: {
      phone: { type: String, default: null, trim: true },
      email: { type: String, default: null, lowercase: true, trim: true },
      website: { type: String, default: null, trim: true },
    },
    timezone: { type: String, required: true, default: 'Asia/Kolkata' },
    taxProfile: {
      gstin: { type: String, default: null, trim: true },
      pan: { type: String, default: null, trim: true },
      taxRegistrationType: { type: String, default: null, trim: true },
    },
    bankDetails: {
      bankName: { type: String, default: null, trim: true },
      accountHolderName: { type: String, default: null, trim: true },
      accountNumber: { type: String, default: null, trim: true },
      ifsc: { type: String, default: null, trim: true },
      branch: { type: String, default: null, trim: true },
    },
    invoiceSettings: {
      invoiceTitle: { type: String, required: true, default: 'TAX INVOICE' },
      prefix: { type: String, required: true, default: 'JRE' },
      defaultCurrency: { type: String, required: true, default: 'INR', enum: ['INR'] },
      defaultPaymentTerms: { type: String, default: null },
      defaultTaxMode: {
        type: String,
        required: true,
        default: 'NONE',
        enum: ['NONE', 'EXCLUSIVE', 'INCLUSIVE'],
      },
      defaultTaxRateBps: { type: Number, required: true, default: 0 },
      numberingMode: { type: String, required: true, default: 'SEQUENTIAL', enum: ['SEQUENTIAL'] },
    },
    paymentSettings: {
      defaultPaymentStatus: { type: String, required: true, default: 'UNPAID', enum: ['UNPAID'] },
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

export const Business = model<IBusiness>('Business', BusinessSchema);
export default Business;
