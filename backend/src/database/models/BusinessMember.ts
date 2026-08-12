import { Schema, model, Document } from 'mongoose';

export interface IBusinessMember extends Document {
  businessId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
}

const BusinessMemberSchema = new Schema<IBusinessMember>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ['OWNER', 'ADMIN', 'STAFF'],
      default: 'STAFF',
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'INVITED', 'SUSPENDED'],
      default: 'ACTIVE',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes defined in MODELS.md
BusinessMemberSchema.index({ businessId: 1, userId: 1 }, { unique: true });
BusinessMemberSchema.index({ userId: 1, status: 1 });

export const BusinessMember = model<IBusinessMember>('BusinessMember', BusinessMemberSchema);
export default BusinessMember;
