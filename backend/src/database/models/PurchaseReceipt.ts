import { Schema, model, Document, Types } from 'mongoose';

export interface IPurchaseReceiptItem {
  purchaseItemId: Types.ObjectId;
  productId: Types.ObjectId;
  productNameSnapshot: string;
  quantityReceived: number;
  unitPurchasePrice?: number;
}

export interface IPurchaseReceipt extends Document {
  businessId: Types.ObjectId;
  purchaseId: Types.ObjectId;
  receiptNumber: string;
  receivedBy: Types.ObjectId;
  receivedAt: Date;
  items: IPurchaseReceiptItem[];
  deliveryChallanNumber: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseReceiptItemSchema = new Schema<IPurchaseReceiptItem>(
  {
    purchaseItemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productNameSnapshot: {
      type: String,
      required: true,
      trim: true,
    },
    quantityReceived: {
      type: Number,
      required: true,
      min: [1, 'Received quantity must be at least 1'],
    },
    unitPurchasePrice: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

const PurchaseReceiptSchema = new Schema<IPurchaseReceipt>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: 'Purchase',
      required: true,
      index: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      trim: true,
    },
    receivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receivedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    items: {
      type: [PurchaseReceiptItemSchema],
      required: true,
      validate: {
        validator: (items: IPurchaseReceiptItem[]) => items.length > 0,
        message: 'Receipt must have at least one received item',
      },
    },
    deliveryChallanNumber: {
      type: String,
      trim: true,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'purchase_receipts',
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

PurchaseReceiptSchema.index({ businessId: 1, purchaseId: 1, createdAt: -1 });
PurchaseReceiptSchema.index({ businessId: 1, receiptNumber: 1 }, { unique: true });

export const PurchaseReceipt = model<IPurchaseReceipt>('PurchaseReceipt', PurchaseReceiptSchema);
export default PurchaseReceipt;
