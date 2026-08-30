import mongoose, { Schema, Document } from 'mongoose';
import { IPaymentProof } from './Payment';

export type UploadSessionStatus = 'CREATED' | 'SCANNED' | 'UPLOADING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED' | 'FAILED';

export interface IUploadSessionMetadata {
  invoiceNumber?: string | null;
  amountMinor?: number | null;
  method?: string | null;
  customerName?: string | null;
}

export interface IUploadSession extends Document {
  businessId: mongoose.Types.ObjectId;
  invoiceId: mongoose.Types.ObjectId | null;
  paymentId: mongoose.Types.ObjectId | null;
  tokenHash: string;
  metadata: IUploadSessionMetadata;
  status: UploadSessionStatus;
  proof: IPaymentProof | null;
  expiresAt: Date;
  createdBy: mongoose.Types.ObjectId;
  scannedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UploadSessionSchema = new Schema<IUploadSession>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    tokenHash: { type: String, required: true, unique: true, index: true },
    metadata: {
      invoiceNumber: { type: String, default: null },
      amountMinor: { type: Number, default: null },
      method: { type: String, default: null },
      customerName: { type: String, default: null },
    },
    status: {
      type: String,
      required: true,
      enum: ['CREATED', 'SCANNED', 'UPLOADING', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'FAILED'],
      default: 'CREATED',
      index: true,
    },
    proof: { type: Schema.Types.Mixed, default: null },
    expiresAt: { type: Date, required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    scannedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const UploadSession = mongoose.model<IUploadSession>('UploadSession', UploadSessionSchema);
