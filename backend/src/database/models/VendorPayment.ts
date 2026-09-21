import { Schema, model, Document, Types } from 'mongoose';

export type VendorPaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';

export interface IVendorPayment extends Document {
  businessId: Types.ObjectId;
  vendorId: Types.ObjectId;
  purchaseId?: Types.ObjectId | null;
  paymentAccountId?: Types.ObjectId | null;
  paymentNumber: string;
  amount: number;
  paymentMethod: VendorPaymentMethod;
  paymentDate: Date;
  referenceNumber: string | null;
  notes: string | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VendorPaymentSchema = new Schema<IVendorPayment>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: 'Purchase',
      default: null,
      index: true,
    },
    paymentAccountId: {
      type: Schema.Types.ObjectId,
      ref: 'PaymentAccount',
      default: null,
    },
    paymentNumber: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, 'Payment amount must be greater than 0'],
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER'],
      default: 'UPI',
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'vendor_payments',
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

VendorPaymentSchema.index({ businessId: 1, vendorId: 1, paymentDate: -1 });
VendorPaymentSchema.index({ businessId: 1, purchaseId: 1, paymentDate: -1 });
VendorPaymentSchema.index({ businessId: 1, paymentNumber: 1 }, { unique: true });

export const VendorPayment = model<IVendorPayment>('VendorPayment', VendorPaymentSchema);
export default VendorPayment;
