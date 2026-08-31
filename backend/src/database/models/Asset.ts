import { Schema, model, Document, Types } from 'mongoose';

export interface IAsset extends Document {
  businessId: Types.ObjectId;
  type: 'LOGO' | 'STAMP' | 'SIGNATURE' | 'OTHER';
  cloudinaryPublicId: string;
  secureUrl: string;
  format: string | null;
  width: number | null;
  height: number | null;
  version: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
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
      enum: ['LOGO', 'STAMP', 'SIGNATURE', 'OTHER'],
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
    },
    secureUrl: {
      type: String,
      required: true,
    },
    format: {
      type: String,
      default: null,
    },
    width: {
      type: Number,
      default: null,
    },
    height: {
      type: Number,
      default: null,
    },
    version: {
      type: Number,
      default: null,
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'assets',
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes specified in MODELS.md
AssetSchema.index({ businessId: 1, type: 1, active: 1 });
AssetSchema.index({ businessId: 1, active: 1 });

export const Asset = model<IAsset>('Asset', AssetSchema);
