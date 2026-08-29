import mongoose, { Schema, Document } from 'mongoose';

export type PaymentAccountType = 'BANK' | 'UPI' | 'CASH';

export interface IPaymentAccount extends Document {
  businessId: mongoose.Types.ObjectId;
  name: string;
  displayName: string;
  type: PaymentAccountType;
  // Bank details
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  maskedAccountNumber?: string | null;
  ifsc?: string | null;
  branch?: string | null;
  // UPI details
  upiId?: string | null;
  qrAssetId?: mongoose.Types.ObjectId | null;
  qrAssetUrl?: string | null;
  // Status
  active: boolean;
  isDefault: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAccountSchema = new Schema<IPaymentAccount>(
  {
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    name: { type: String, required: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['BANK', 'UPI', 'CASH'],
      index: true,
    },
    bankName: { type: String, default: null, trim: true },
    accountHolderName: { type: String, default: null, trim: true },
    accountNumber: { type: String, default: null, trim: true },
    maskedAccountNumber: { type: String, default: null, trim: true },
    ifsc: { type: String, default: null, trim: true },
    branch: { type: String, default: null, trim: true },
    upiId: { type: String, default: null, trim: true },
    qrAssetId: { type: Schema.Types.ObjectId, ref: 'Asset', default: null },
    qrAssetUrl: { type: String, default: null },
    active: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PaymentAccountSchema.index({ businessId: 1, active: 1 });
PaymentAccountSchema.index({ businessId: 1, type: 1 });

export const PaymentAccount = mongoose.models.PaymentAccount || mongoose.model<IPaymentAccount>('PaymentAccount', PaymentAccountSchema);
export default PaymentAccount;
