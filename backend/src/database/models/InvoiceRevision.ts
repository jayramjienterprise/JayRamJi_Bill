import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IInvoiceRevision extends Document {
  businessId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  revisionNumber: number;
  action: 'CREATED' | 'FINALIZED' | 'EDITED' | 'CANCELLED';
  summary: string;
  changes: string[];
  snapshot: Record<string, any>;
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    taxableAmountMinor: number;
    taxTotalMinor: number;
    roundingMinor: number;
    grandTotalMinor: number;
    currency: string;
  };
  performedBy: Types.ObjectId;
  performedByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceRevisionSchema = new Schema<IInvoiceRevision>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    revisionNumber: { type: Number, required: true },
    action: {
      type: String,
      required: true,
      enum: ['CREATED', 'FINALIZED', 'EDITED', 'CANCELLED'],
      default: 'EDITED',
    },
    summary: { type: String, required: true },
    changes: { type: [String], default: [] },
    snapshot: { type: Schema.Types.Mixed, required: true },
    totals: {
      subtotalMinor: { type: Number, required: true },
      discountMinor: { type: Number, default: 0 },
      taxableAmountMinor: { type: Number, required: true },
      taxTotalMinor: { type: Number, default: 0 },
      roundingMinor: { type: Number, default: 0 },
      grandTotalMinor: { type: Number, required: true },
      currency: { type: String, default: 'INR' },
    },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, default: 'System User' },
  },
  { timestamps: true }
);

InvoiceRevisionSchema.index({ businessId: 1, invoiceId: 1, revisionNumber: -1 });

export const InvoiceRevision =
  mongoose.models.InvoiceRevision || mongoose.model<IInvoiceRevision>('InvoiceRevision', InvoiceRevisionSchema);
export default InvoiceRevision;

