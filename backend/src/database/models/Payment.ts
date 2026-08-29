import mongoose, { Schema, Document } from 'mongoose';

export type PaymentMethod = 'CASH' | 'UPI' | 'QR_CODE' | 'BANK_TRANSFER' | 'CHEQUE';

export interface IPaymentAccountSnapshot {
  name: string;
  type: 'BANK' | 'UPI' | 'CASH';
  displayName: string;
  bankName?: string | null;
  maskedAccountNumber?: string | null;
  ifsc?: string | null;
  upiId?: string | null;
  qrAssetUrl?: string | null;
}

export interface IPaymentProof {
  publicId: string | null;
  secureUrl: string | null;
  format: string | null;
  fileType: string | null;
  uploadedAt: Date | null;
}

export interface IChequeDetails {
  chequeNumber?: string | null;
  chequeDate?: Date | null;
  bankName?: string | null;
  status?: 'RECEIVED' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED';
}

export interface IPayment extends Document {
  businessId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId;
  amountMinor: number;
  currency: 'INR';
  method: PaymentMethod;
  paymentAccountId?: mongoose.Types.ObjectId | null;
  paymentAccountSnapshot?: IPaymentAccountSnapshot | null;
  referenceNumber: string | null;
  chequeDetails?: IChequeDetails | null;
  proof?: IPaymentProof | null;
  paidAt: Date;
  notes: string | null;
  recordedBy: mongoose.Types.ObjectId;
  status: 'CONFIRMED' | 'REVERSED';
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true, index: true },
    amountMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ['INR'], default: 'INR' },
    method: {
      type: String,
      required: true,
      enum: ['CASH', 'UPI', 'QR_CODE', 'BANK_TRANSFER', 'CHEQUE'],
    },
    paymentAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentAccount', default: null, index: true },
    paymentAccountSnapshot: {
      name: { type: String, default: null },
      type: { type: String, enum: ['BANK', 'UPI', 'CASH'], default: null },
      displayName: { type: String, default: null },
      bankName: { type: String, default: null },
      maskedAccountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
      upiId: { type: String, default: null },
      qrAssetUrl: { type: String, default: null },
    },
    referenceNumber: { type: String, default: null },
    chequeDetails: {
      chequeNumber: { type: String, default: null },
      chequeDate: { type: Date, default: null },
      bankName: { type: String, default: null },
      status: {
        type: String,
        enum: ['RECEIVED', 'DEPOSITED', 'CLEARED', 'BOUNCED'],
        default: 'RECEIVED',
      },
    },
    proof: {
      publicId: { type: String, default: null },
      secureUrl: { type: String, default: null },
      format: { type: String, default: null },
      fileType: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },
    paidAt: { type: Date, required: true },
    notes: { type: String, default: null },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      required: true,
      enum: ['CONFIRMED', 'REVERSED'],
      default: 'CONFIRMED',
      index: true,
    },
  },
  { timestamps: true }
);

PaymentSchema.index({ businessId: 1, invoiceId: 1 });
PaymentSchema.index({ businessId: 1, createdAt: -1 });

export const Payment = mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);
export default Payment;
