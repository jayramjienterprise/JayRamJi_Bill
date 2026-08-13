import mongoose, { Schema, Document } from 'mongoose';

export interface IInvoiceSequence extends Document {
  businessId: mongoose.Types.ObjectId;
  key: string;
  prefix: string;
  nextNumber: number;
  updatedAt: Date;
}

const InvoiceSequenceSchema = new Schema<IInvoiceSequence>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    key: { type: String, required: true, default: 'INVOICE' },
    prefix: { type: String, required: true },
    nextNumber: { type: Number, required: true, default: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

InvoiceSequenceSchema.index({ businessId: 1, key: 1 }, { unique: true });

export const InvoiceSequence = mongoose.models.InvoiceSequence || mongoose.model<IInvoiceSequence>('InvoiceSequence', InvoiceSequenceSchema);
export default InvoiceSequence;
