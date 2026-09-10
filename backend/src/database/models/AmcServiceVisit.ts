import { Schema, model, Document, Types } from 'mongoose';

export interface IAmcVisitChecklist {
  filterCleaned: boolean;
  indoorCoilCleaned: boolean;
  outdoorCondenserWashed: boolean;
  electricalTightened: boolean;
  blowerMotorChecked: boolean;
  drainPipeChecked: boolean;
  operatingCurrentAmps?: number | null;
  suctionPressurePsi?: number | null;
  dischargePressurePsi?: number | null;
}

export interface IAmcVisitSpareUsed {
  productId: Types.ObjectId;
  quantity: number;
  isCoveredByAmc: boolean;
  unitPrice: number;
  customerCharge: number; // 0 if covered
  inventoryTransactionId?: Types.ObjectId | null;
  notes?: string | null;
}

export interface IAmcVisitAdditionalWork {
  hasUncoveredWork: boolean;
  description?: string | null;
  estimatedAmount?: number | null;
  customerApproved?: boolean | null;
  quotationId?: Types.ObjectId | null;
  invoiceId?: Types.ObjectId | null;
}

export interface IAmcServiceVisit extends Document {
  businessId: Types.ObjectId;
  visitNumber: string; // e.g. 'SV-2526-0001'
  contractId: Types.ObjectId;
  acEquipmentId: Types.ObjectId;
  serviceType:
    | 'DRY_SERVICE'
    | 'WATER_SERVICE'
    | 'PREVENTIVE_HEALTH_CHECK'
    | 'BREAKDOWN_REPAIR'
    | 'GAS_CHARGING'
    | 'INSTALLATION_DISMANTLING';
  scheduledDate: Date;
  actualServiceDate?: Date | null;
  technicianId?: Types.ObjectId | null; // FK to User
  status:
    | 'SCHEDULED'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'RESCHEDULED';
  isBillableExtra: boolean; // true if quota exceeded or out of scope
  checklist: IAmcVisitChecklist;
  gasRefilledKg?: number | null;
  refrigerantType?: string | null;
  gasCoveredByAmc: boolean;
  gasCustomerCharge: number;
  sparesUsed: IAmcVisitSpareUsed[];
  additionalWorkRequest: IAmcVisitAdditionalWork;
  workPerformed?: string | null;
  technicianNotes?: string | null;
  customerRemarks?: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AmcVisitChecklistSchema = new Schema<IAmcVisitChecklist>(
  {
    filterCleaned: { type: Boolean, default: false },
    indoorCoilCleaned: { type: Boolean, default: false },
    outdoorCondenserWashed: { type: Boolean, default: false },
    electricalTightened: { type: Boolean, default: false },
    blowerMotorChecked: { type: Boolean, default: false },
    drainPipeChecked: { type: Boolean, default: false },
    operatingCurrentAmps: { type: Number, default: null },
    suctionPressurePsi: { type: Number, default: null },
    dischargePressurePsi: { type: Number, default: null },
  },
  { _id: false }
);

const AmcVisitSpareUsedSchema = new Schema<IAmcVisitSpareUsed>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: { type: Number, required: true, default: 1 },
    isCoveredByAmc: { type: Boolean, required: true, default: false },
    unitPrice: { type: Number, required: true, default: 0 },
    customerCharge: { type: Number, required: true, default: 0 },
    inventoryTransactionId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryTransaction',
      default: null,
    },
    notes: { type: String, default: null },
  },
  { _id: false }
);

const AmcVisitAdditionalWorkSchema = new Schema<IAmcVisitAdditionalWork>(
  {
    hasUncoveredWork: { type: Boolean, default: false },
    description: { type: String, default: null },
    estimatedAmount: { type: Number, default: 0 },
    customerApproved: { type: Boolean, default: null },
    quotationId: { type: Schema.Types.ObjectId, ref: 'AmcQuotation', default: null },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', default: null },
  },
  { _id: false }
);

const AmcServiceVisitSchema = new Schema<IAmcServiceVisit>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    visitNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    contractId: {
      type: Schema.Types.ObjectId,
      ref: 'AmcContract',
      required: true,
      index: true,
    },
    acEquipmentId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerAcEquipment',
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      required: true,
      enum: [
        'DRY_SERVICE',
        'WATER_SERVICE',
        'PREVENTIVE_HEALTH_CHECK',
        'BREAKDOWN_REPAIR',
        'GAS_CHARGING',
        'INSTALLATION_DISMANTLING',
      ],
      index: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    actualServiceDate: {
      type: Date,
      default: null,
    },
    technicianId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        'SCHEDULED',
        'ASSIGNED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
        'RESCHEDULED',
      ],
      default: 'SCHEDULED',
      index: true,
    },
    isBillableExtra: {
      type: Boolean,
      default: false,
    },
    checklist: {
      type: AmcVisitChecklistSchema,
      default: () => ({
        filterCleaned: false,
        indoorCoilCleaned: false,
        outdoorCondenserWashed: false,
        electricalTightened: false,
        blowerMotorChecked: false,
        drainPipeChecked: false,
        operatingCurrentAmps: null,
        suctionPressurePsi: null,
        dischargePressurePsi: null,
      }),
    },
    gasRefilledKg: {
      type: Number,
      default: null,
    },
    refrigerantType: {
      type: String,
      default: null,
    },
    gasCoveredByAmc: {
      type: Boolean,
      default: false,
    },
    gasCustomerCharge: {
      type: Number,
      default: 0,
    },
    sparesUsed: {
      type: [AmcVisitSpareUsedSchema],
      default: [],
    },
    additionalWorkRequest: {
      type: AmcVisitAdditionalWorkSchema,
      default: () => ({
        hasUncoveredWork: false,
        description: null,
        estimatedAmount: 0,
        customerApproved: null,
        quotationId: null,
        invoiceId: null,
      }),
    },
    workPerformed: {
      type: String,
      default: null,
    },
    technicianNotes: {
      type: String,
      default: null,
    },
    customerRemarks: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'amc_service_visits',
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
  }
);

AmcServiceVisitSchema.index({ businessId: 1, visitNumber: 1 }, { unique: true });
AmcServiceVisitSchema.index({ businessId: 1, contractId: 1, status: 1 });
AmcServiceVisitSchema.index({ businessId: 1, scheduledDate: 1 });

export const AmcServiceVisit = model<IAmcServiceVisit>(
  'AmcServiceVisit',
  AmcServiceVisitSchema
);
export default AmcServiceVisit;
