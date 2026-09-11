import { Schema, model, Document, Types } from 'mongoose';

export interface IAmcCoveredUnit {
  acEquipmentId: Types.ObjectId;
  unitTonnage?: string | null;
  unitBrand?: string | null;
  unitSerial?: string | null;
  unitLocation?: string | null;
  unitNotes?: string | null;
}

export interface IAmcContractPlanSnapshot {
  planId?: Types.ObjectId | null;
  planName: string;
  planType: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE';
  durationMonths: number;
  entitlements: Array<{
    serviceType:
      | 'DRY_SERVICE'
      | 'WATER_SERVICE'
      | 'PREVENTIVE_HEALTH_CHECK'
      | 'BREAKDOWN_REPAIR'
      | 'GAS_CHARGING';
    scheduling: 'MONTHLY' | 'QUARTERLY' | 'BI_MONTHLY' | 'ON_DEMAND';
    quantity: number;
    entitlementScope: 'PER_EQUIPMENT' | 'PER_CONTRACT';
  }>;
  partCoverages: Array<{
    productId: Types.ObjectId;
    productName?: string;
    coverageType: 'FULL' | 'LABOUR_ONLY' | 'DISCOUNTED' | 'NOT_COVERED';
    quantityLimitPerYear?: number | null;
    discountPercent?: number;
  }>;
  gasCoverage: {
    included: boolean;
    refrigerantTypes: string[];
    quantityLimitKg?: number | null;
    limitScope: 'PER_EQUIPMENT' | 'PER_CONTRACT';
    excludeDamagePipingLeaks: boolean;
  };
  termsAndConditions: string[];
}

export interface IAmcPaymentRecord {
  amount: number;
  paidAt: Date;
  method: 'CASH' | 'UPI' | 'QR_CODE' | 'BANK_TRANSFER' | 'CHEQUE';
  paymentAccountId?: Types.ObjectId | null;
  paymentAccountSnapshot?: {
    name: string;
    type: string;
    displayName: string;
    bankName?: string | null;
    maskedAccountNumber?: string | null;
    ifsc?: string | null;
    upiId?: string | null;
  } | null;
  referenceNumber?: string | null;
  chequeDetails?: {
    chequeNumber?: string | null;
    chequeDate?: Date | null;
    bankName?: string | null;
    status?: 'RECEIVED' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED';
  } | null;
  proof?: {
    publicId?: string | null;
    secureUrl?: string | null;
    format?: string | null;
    fileType?: string | null;
    uploadedAt?: Date | null;
  } | null;
  notes?: string | null;
}

export interface IAmcPaymentInstallment {
  installmentNumber: number;
  title: string;
  dueDate: Date;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  paidAt?: Date | null;
  paymentRecordIndex?: number | null;
}

export interface IAmcContract extends Document {
  businessId: Types.ObjectId;
  contractNumber: string; // e.g. 'AMC-2526-001'
  quotationId?: Types.ObjectId | null;
  previousContractId?: Types.ObjectId | null; // Predecessor contract (for renewals)
  renewedByContractId?: Types.ObjectId | null; // Successor contract (points to the new renewal contract)
  customerId: Types.ObjectId;
  contractType: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE';
  coveredUnits: IAmcCoveredUnit[];
  startDate: Date;
  endDate: Date;
  planSnapshot: IAmcContractPlanSnapshot; // Immutable snapshot of plan rules at time of signing
  financials: {
    contractAmount: number;
    discount: number;
    taxAmount: number;
    finalAmount: number;
    paidAmount: number;
  };
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  paymentScheduleType?: 'LUMP_SUM' | 'HALF_YEARLY' | 'QUARTERLY' | 'CUSTOM';
  installments?: IAmcPaymentInstallment[];
  paymentRecords?: IAmcPaymentRecord[];
  activationTrigger: 'ADMIN_APPROVAL' | 'PAYMENT_RECEIVED' | 'ADVANCE_RECEIVED';
  status:
    | 'DRAFT'
    | 'PENDING_APPROVAL'
    | 'PENDING_PAYMENT'
    | 'ACTIVE'
    | 'EXPIRED'
    | 'TERMINATED'
    | 'CANCELLED'
    | 'SUSPENDED';
  notes?: string | null;
  pdfUrl?: string | null;
  visitsGenerated?: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AmcCoveredUnitSchema = new Schema<IAmcCoveredUnit>(
  {
    acEquipmentId: {
      type: Schema.Types.ObjectId,
      ref: 'CustomerAcEquipment',
      required: true,
    },
    unitTonnage: { type: String, default: null },
    unitBrand: { type: String, default: null },
    unitSerial: { type: String, default: null },
    unitLocation: { type: String, default: null },
    unitNotes: { type: String, default: null },
  },
  { _id: false }
);

const AmcContractPlanSnapshotSchema = new Schema<IAmcContractPlanSnapshot>(
  {
    planId: { type: Schema.Types.ObjectId, ref: 'AmcPlan', default: null },
    planName: { type: String, required: true },
    planType: {
      type: String,
      required: true,
      enum: ['COMPREHENSIVE', 'NON_COMPREHENSIVE'],
    },
    durationMonths: { type: Number, required: true, default: 12 },
    entitlements: [
      {
        serviceType: { type: String, required: true },
        scheduling: { type: String, required: true },
        quantity: { type: Number, required: true },
        entitlementScope: {
          type: String,
          required: true,
          enum: ['PER_EQUIPMENT', 'PER_CONTRACT'],
        },
      },
    ],
    partCoverages: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        productName: { type: String, default: null },
        coverageType: { type: String, required: true },
        quantityLimitPerYear: { type: Number, default: null },
        discountPercent: { type: Number, default: 0 },
      },
    ],
    gasCoverage: {
      included: { type: Boolean, default: false },
      refrigerantTypes: { type: [String], default: [] },
      quantityLimitKg: { type: Number, default: null },
      limitScope: { type: String, default: 'PER_EQUIPMENT' },
      excludeDamagePipingLeaks: { type: Boolean, default: true },
    },
    termsAndConditions: { type: [String], default: [] },
  },
  { _id: false }
);

const AmcPaymentRecordSchema = new Schema<IAmcPaymentRecord>(
  {
    amount: { type: Number, required: true },
    paidAt: { type: Date, required: true, default: Date.now },
    method: {
      type: String,
      required: true,
      enum: ['CASH', 'UPI', 'QR_CODE', 'BANK_TRANSFER', 'CHEQUE'],
      default: 'CASH',
    },
    paymentAccountId: { type: Schema.Types.ObjectId, ref: 'PaymentAccount', default: null },
    paymentAccountSnapshot: {
      name: { type: String, default: null },
      type: { type: String, default: null },
      displayName: { type: String, default: null },
      bankName: { type: String, default: null },
      maskedAccountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
      upiId: { type: String, default: null },
    },
    referenceNumber: { type: String, default: null },
    chequeDetails: {
      chequeNumber: { type: String, default: null },
      chequeDate: { type: Date, default: null },
      bankName: { type: String, default: null },
      status: {
        type: String,
        enum: ['RECEIVED', 'DEPOSITED', 'CLEARED', 'BOUNCED'],
        default: 'RECEIVED',
      },
    },
    proof: {
      publicId: { type: String, default: null },
      secureUrl: { type: String, default: null },
      format: { type: String, default: null },
      fileType: { type: String, default: null },
      uploadedAt: { type: Date, default: null },
    },
    notes: { type: String, default: null },
  },
  { _id: true, timestamps: true }
);

const AmcPaymentInstallmentSchema = new Schema<IAmcPaymentInstallment>(
  {
    installmentNumber: { type: Number, required: true },
    title: { type: String, required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'PAID', 'OVERDUE'],
      default: 'PENDING',
    },
    paidAt: { type: Date, default: null },
    paymentRecordIndex: { type: Number, default: null },
  },
  { _id: true }
);

const AmcContractSchema = new Schema<IAmcContract>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    contractNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    quotationId: {
      type: Schema.Types.ObjectId,
      ref: 'AmcQuotation',
      default: null,
    },
    previousContractId: {
      type: Schema.Types.ObjectId,
      ref: 'AmcContract',
      default: null,
      index: true,
    },
    renewedByContractId: {
      type: Schema.Types.ObjectId,
      ref: 'AmcContract',
      default: null,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    contractType: {
      type: String,
      required: true,
      enum: ['COMPREHENSIVE', 'NON_COMPREHENSIVE'],
      default: 'NON_COMPREHENSIVE',
      index: true,
    },
    coveredUnits: {
      type: [AmcCoveredUnitSchema],
      default: [],
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    planSnapshot: {
      type: AmcContractPlanSnapshotSchema,
      required: true,
    },
    financials: {
      contractAmount: { type: Number, required: true, default: 0 },
      discount: { type: Number, default: 0 },
      taxAmount: { type: Number, default: 0 },
      finalAmount: { type: Number, required: true, default: 0 },
      paidAmount: { type: Number, default: 0 },
    },
    paymentStatus: {
      type: String,
      required: true,
      enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID'],
      default: 'UNPAID',
    },
    paymentScheduleType: {
      type: String,
      enum: ['LUMP_SUM', 'HALF_YEARLY', 'QUARTERLY', 'CUSTOM'],
      default: 'LUMP_SUM',
    },
    installments: {
      type: [AmcPaymentInstallmentSchema],
      default: [],
    },
    paymentRecords: {
      type: [AmcPaymentRecordSchema],
      default: [],
    },
    activationTrigger: {
      type: String,
      required: true,
      enum: ['ADMIN_APPROVAL', 'PAYMENT_RECEIVED', 'ADVANCE_RECEIVED'],
      default: 'ADMIN_APPROVAL',
    },
    status: {
      type: String,
      required: true,
      enum: [
        'DRAFT',
        'PENDING_APPROVAL',
        'PENDING_PAYMENT',
        'ACTIVE',
        'EXPIRED',
        'TERMINATED',
        'CANCELLED',
        'SUSPENDED',
      ],
      default: 'DRAFT',
      index: true,
    },
    notes: {
      type: String,
      default: null,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    visitsGenerated: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'amc_contracts',
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
  }
);

AmcContractSchema.index({ businessId: 1, contractNumber: 1 }, { unique: true });
AmcContractSchema.index({ businessId: 1, status: 1 });
AmcContractSchema.index({ businessId: 1, endDate: 1 });

export const AmcContract = model<IAmcContract>('AmcContract', AmcContractSchema);
export default AmcContract;
