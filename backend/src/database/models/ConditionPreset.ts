import mongoose, { Schema, Document } from 'mongoose';

export type ConditionCategory = 'ALL' | 'GENERAL' | 'AMC' | 'INVOICE';

export interface IConditionPreset extends Document {
  businessId: mongoose.Types.ObjectId;
  title: string;
  text: string;
  category: ConditionCategory;
  isDefault: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ConditionPresetSchema = new Schema<IConditionPreset>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      set: (val: string) => (val || '').toUpperCase().trim(),
    },
    text: {
      type: String,
      required: true,
      trim: true,
      set: (val: string) => (val || '').toUpperCase().trim(),
    },
    category: {
      type: String,
      enum: ['ALL', 'GENERAL', 'AMC', 'INVOICE'],
      default: 'ALL',
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

ConditionPresetSchema.index({ businessId: 1, active: 1, category: 1 });

export const ConditionPreset =
  mongoose.models.ConditionPreset ||
  mongoose.model<IConditionPreset>('ConditionPreset', ConditionPresetSchema);

export default ConditionPreset;
