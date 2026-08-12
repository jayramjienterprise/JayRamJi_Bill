import { Schema, model, Document, Types } from 'mongoose';

export interface IProduct extends Document {
  businessId: Types.ObjectId;
  type: 'SERVICE' | 'PRODUCT';
  name: string;
  description: string | null;
  uom: string;
  defaultPriceMinor: number;
  currency: 'INR';
  defaultTaxRateBps: number;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['SERVICE', 'PRODUCT'],
      default: 'SERVICE',
    },
    name: {
      type: String,
      required: true,
      index: true,
    },
    description: {
      type: String,
      default: null,
    },
    uom: {
      type: String,
      required: true,
    },
    defaultPriceMinor: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      enum: ['INR'],
      default: 'INR',
    },
    defaultTaxRateBps: {
      type: Number,
      required: true,
      default: 0,
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'products',
  }
);

// Indexes specified in MODELS.md
ProductSchema.index({ businessId: 1, name: 1 });
ProductSchema.index({ businessId: 1, active: 1 });

export const Product = model<IProduct>('Product', ProductSchema);
