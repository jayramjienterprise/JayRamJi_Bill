import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  businessId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  action: string;
  entity: 'INVOICE' | 'PAYMENT' | 'SHARE_LINK';
  entityId: mongoose.Types.ObjectId;
  previousState: any;
  newState: any;
  metadata: any;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  entity: { type: String, required: true, enum: ['INVOICE', 'PAYMENT', 'SHARE_LINK'], index: true },
  entityId: { type: Schema.Types.ObjectId, required: true, index: true },
  previousState: { type: Schema.Types.Mixed, default: null },
  newState: { type: Schema.Types.Mixed, default: null },
  metadata: { type: Schema.Types.Mixed, default: null },
  timestamp: { type: Date, default: Date.now, index: true },
});

export const AuditLog = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
export default AuditLog;
