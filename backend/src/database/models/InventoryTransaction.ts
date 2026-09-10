import { Schema, model, Document, Types } from 'mongoose';

export interface IInventoryTransaction extends Document {
  businessId: Types.ObjectId;
  productId: Types.ObjectId;
  quantity: number; // Negative for stock consumption, positive for restock
  transactionType:
    | 'AMC_SERVICE_USAGE'
    | 'AMC_GAS_CONSUMPTION'
    | 'DIRECT_SALE'
    | 'STOCK_INWARD'
    | 'STOCK_ADJUSTMENT'
    | 'RETURN';
  referenceType: 'AMC_SERVICE_VISIT' | 'INVOICE' | 'MANUAL_ADJUSTMENT';
  referenceId?: Types.ObjectId | null; // e.g. visitId or invoiceId
  contractId?: Types.ObjectId | null; // linked AMC contract for profitability tracking
  unitCostPrice?: number | null;
  unitSellingPrice?: number | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryTransactionSchema = new Schema<IInventoryTransaction>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    transactionType: {
      type: String,
      required: true,
      enum: [
        'AMC_SERVICE_USAGE',
        'AMC_GAS_CONSUMPTION',
        'DIRECT_SALE',
        'STOCK_INWARD',
        'STOCK_ADJUSTMENT',
        'RETURN',
      ],
      index: true,
    },
    referenceType: {
      type: String,
      required: true,
      enum: ['AMC_SERVICE_VISIT', 'INVOICE', 'MANUAL_ADJUSTMENT'],
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'AmcContract',
      default: null,
      index: true,
    },
    unitCostPrice: {
      type: Number,
      default: null,
    },
    unitSellingPrice: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'inventory_transactions',
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
  }
);

InventoryTransactionSchema.index({ businessId: 1, productId: 1, createdAt: -1 });

export const InventoryTransaction = model<IInventoryTransaction>(
  'InventoryTransaction',
  InventoryTransactionSchema
);
export default InventoryTransaction;
