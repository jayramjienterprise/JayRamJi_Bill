import mongoose, { Schema, Document } from 'mongoose';

export interface IIdempotencyKey extends Document {
  key: string;
  businessId: mongoose.Types.ObjectId;
  responseStatus: number;
  responseBody: any;
  createdAt: Date;
}

const IdempotencyKeySchema = new Schema<IIdempotencyKey>({
  key: { type: String, required: true },
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
  responseStatus: { type: Number, required: true },
  responseBody: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
});

// TTL index to expire after 24 hours (86400 seconds)
IdempotencyKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
IdempotencyKeySchema.index({ key: 1, businessId: 1 }, { unique: true });

export const IdempotencyKey = mongoose.models.IdempotencyKey || mongoose.model<IIdempotencyKey>('IdempotencyKey', IdempotencyKeySchema);
export default IdempotencyKey;
