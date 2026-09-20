import { Schema, model, Document, Types } from 'mongoose';

export type PurchaseType = 'DIRECT_PURCHASE' | 'ORDERED_PURCHASE';
export type PurchaseStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type ReceivingStatus = 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export function calculateOverallReceivingStatus(items: { receivingStatus: ReceivingStatus }[]): ReceivingStatus {
  if (items.length === 0) return 'NOT_RECEIVED';
  const allReceived = items.every((it) => it.receivingStatus === 'RECEIVED');
  if (allReceived) return 'RECEIVED';
  const allNotReceived = items.every((it) => it.receivingStatus === 'NOT_RECEIVED');
  if (allNotReceived) return 'NOT_RECEIVED';
  return 'PARTIALLY_RECEIVED';
}

export interface IPurchaseItem {
  _id?: Types.ObjectId;
  productId: Types.ObjectId;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPurchasePrice: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  receivingStatus: ReceivingStatus;
}

export interface IBillAttachment {
  _id?: Types.ObjectId;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  publicId?: string | null;
  documentType?: string;
  uploadedAt: Date;
  uploadedBy?: Types.ObjectId;
}

export interface IPurchase extends Document {
  businessId: Types.ObjectId;
  purchaseNumber: string;
  purchaseType: PurchaseType;
  vendorId: Types.ObjectId;
  vendorInvoiceNumber: string | null;
  purchaseDate: Date;
  invoiceDate: Date | null;
  dueDate: Date | null;
  status: PurchaseStatus;
  receivingStatus: ReceivingStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  items: IPurchaseItem[];
  notes: string | null;
  billAttachments: IBillAttachment[];
  sourceDraftId?: Types.ObjectId | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>(
  {
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
    skuSnapshot: {
      type: String,
      trim: true,
      default: null,
    },
    orderedQuantity: {
      type: Number,
      required: true,
      min: [1, 'Ordered quantity must be at least 1'],
    },
    receivedQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    remainingQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    unitPurchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    receivingStatus: {
      type: String,
      enum: ['NOT_RECEIVED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
      default: 'NOT_RECEIVED',
    },
  },
  { _id: true }
);

const BillAttachmentSchema = new Schema<IBillAttachment>(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    mimeType: { type: String, default: null },
    fileSize: { type: Number, default: null },
    publicId: { type: String, default: null },
    documentType: { type: String, default: 'PURCHASE_BILL' },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const PurchaseSchema = new Schema<IPurchase>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    purchaseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    purchaseType: {
      type: String,
      required: true,
      enum: ['DIRECT_PURCHASE', 'ORDERED_PURCHASE'],
      default: 'DIRECT_PURCHASE',
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    vendorInvoiceNumber: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    invoiceDate: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['DRAFT', 'CONFIRMED', 'CANCELLED'],
      default: 'CONFIRMED',
      index: true,
    },
    receivingStatus: {
      type: String,
      required: true,
      enum: ['NOT_RECEIVED', 'PARTIALLY_RECEIVED', 'RECEIVED'],
      default: 'NOT_RECEIVED',
      index: true,
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
      default: 'UNPAID',
      index: true,
    },
    subtotal: {
      type: Number,
      required: true,
      default: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    taxAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    paidAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    outstandingAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    items: {
      type: [PurchaseItemSchema],
      default: [],
      validate: {
        validator: (items: IPurchaseItem[]) => items.length > 0,
        message: 'A purchase must contain at least one item',
      },
    },
    notes: {
      type: String,
      default: null,
    },
    billAttachments: {
      type: [BillAttachmentSchema],
      default: [],
    },
    sourceDraftId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseDraft',
      default: null,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'purchases',
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

PurchaseSchema.index({ businessId: 1, purchaseNumber: 1 }, { unique: true });
PurchaseSchema.index({ businessId: 1, vendorId: 1, purchaseDate: -1 });
PurchaseSchema.index({ businessId: 1, receivingStatus: 1 });
PurchaseSchema.index({ businessId: 1, paymentStatus: 1 });
PurchaseSchema.index({ businessId: 1, vendorId: 1, vendorInvoiceNumber: 1 });
// Phase 4.1: Unique index on sourceDraftId per business (partial filter to allow nulls for manual purchases)
PurchaseSchema.index(
  { businessId: 1, sourceDraftId: 1 },
  { unique: true, partialFilterExpression: { sourceDraftId: { $type: 'objectId' } } }
);

export const Purchase = model<IPurchase>('Purchase', PurchaseSchema);
export default Purchase;
