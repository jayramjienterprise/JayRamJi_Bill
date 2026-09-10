import { Schema, model, Document, Types } from 'mongoose';

export interface IEquipmentAssignmentHistory extends Document {
  businessId: Types.ObjectId;
  equipmentId: Types.ObjectId;
  fromCustomerId?: Types.ObjectId | null;
  toCustomerId: Types.ObjectId;
  contractId?: Types.ObjectId | null;
  transferredAt: Date;
  reason: string;
  notes?: string | null;
  performedBy?: Types.ObjectId | null;
  createdAt: Date;
}

const EquipmentAssignmentHistorySchema = new Schema<IEquipmentAssignmentHistory>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    equipmentId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerAcEquipment',
      required: true,
      index: true,
    },
    fromCustomerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    toCustomerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'AmcContract',
      default: null,
    },
    transferredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    reason: {
      type: String,
      required: true,
      default: 'Initial Registration',
    },
    notes: {
      type: String,
      default: null,
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'equipment_assignment_histories',
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
  }
);

EquipmentAssignmentHistorySchema.index({ businessId: 1, equipmentId: 1, transferredAt: -1 });

export const EquipmentAssignmentHistory = model<IEquipmentAssignmentHistory>(
  'EquipmentAssignmentHistory',
  EquipmentAssignmentHistorySchema
);
export default EquipmentAssignmentHistory;
