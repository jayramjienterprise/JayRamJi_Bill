import { Schema, model, Document, Types } from 'mongoose';

export interface ICustomerAcEquipment extends Document {
  businessId: Types.ObjectId;
  customerId: Types.ObjectId;
  acType: 'SPLIT' | 'WINDOW' | 'CASSETTE' | 'DUCTABLE' | 'TOWER' | 'PACKAGE' | 'OTHER';
  tonnage: string; // '1.0', '1.5', '2.0', 'Up to 5 Ton', '5 to 8.5 Ton', '5 to 11 Ton', etc.
  brand: string;
  modelNumber?: string | null;
  serialNumber?: string | null;
  installationLocation: string; // e.g., 'Server Room 1', 'Main Office', '2nd Floor Hall'
  refrigerantType?: string | null; // e.g., 'R22', 'R32', 'R410A'
  indoorUnitSerial?: string | null;
  outdoorUnitSerial?: string | null;
  installationDate?: Date | null;
  status: 'OPERATIONAL' | 'NEEDS_SERVICE' | 'UNDER_REPAIR' | 'DECOMMISSIONED';
  notes?: string | null;
  active: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerAcEquipmentSchema = new Schema<ICustomerAcEquipment>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    acType: {
      type: String,
      required: true,
      enum: ['SPLIT', 'WINDOW', 'CASSETTE', 'DUCTABLE', 'TOWER', 'PACKAGE', 'OTHER'],
      default: 'SPLIT',
    },
    tonnage: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    modelNumber: {
      type: String,
      default: null,
      trim: true,
    },
    serialNumber: {
      type: String,
      default: null,
      trim: true,
    },
    installationLocation: {
      type: String,
      required: true,
      trim: true,
    },
    refrigerantType: {
      type: String,
      default: 'R32',
      trim: true,
    },
    indoorUnitSerial: {
      type: String,
      default: null,
      trim: true,
    },
    outdoorUnitSerial: {
      type: String,
      default: null,
      trim: true,
    },
    installationDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['OPERATIONAL', 'NEEDS_SERVICE', 'UNDER_REPAIR', 'DECOMMISSIONED'],
      default: 'OPERATIONAL',
    },
    notes: {
      type: String,
      default: null,
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
    collection: 'customer_ac_equipments',
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
  }
);

CustomerAcEquipmentSchema.index({ businessId: 1, customerId: 1, active: 1 });
CustomerAcEquipmentSchema.index({ businessId: 1, serialNumber: 1 });

export const CustomerAcEquipment =
  (model<ICustomerAcEquipment>('CustomerAcEquipment', CustomerAcEquipmentSchema));
export default CustomerAcEquipment;
