import { Schema, model, Document, Types } from 'mongoose';

export interface IAmcPlanPartCoverage {
  productId: Types.ObjectId;
  coverageType: 'FULL' | 'LABOUR_ONLY' | 'DISCOUNTED' | 'NOT_COVERED';
  quantityLimitPerYear?: number | null; // e.g. 2/year for capacitor
  discountPercent?: number; // e.g. 20% discount if DISCOUNTED
  notes?: string | null;
}

export interface IAmcPlanEntitlement {
  serviceType:
    | 'DRY_SERVICE'
    | 'WATER_SERVICE'
    | 'PREVENTIVE_HEALTH_CHECK'
    | 'BREAKDOWN_REPAIR'
    | 'GAS_CHARGING';
  scheduling: 'MONTHLY' | 'QUARTERLY' | 'BI_MONTHLY' | 'ON_DEMAND';
  quantity: number; // e.g. 12 for monthly dry, 4 for quarterly water, 2 for breakdown
  entitlementScope: 'PER_EQUIPMENT' | 'PER_CONTRACT';
}

export interface IAmcPlanGasCoverage {
  included: boolean;
  refrigerantTypes: string[]; // e.g. ['R32', 'R410A']
  quantityLimitKg?: number | null;
  limitScope: 'PER_EQUIPMENT' | 'PER_CONTRACT';
  excludeDamagePipingLeaks: boolean;
}

export interface IAmcPlan extends Document {
  businessId: Types.ObjectId;
  name: string;
  code?: string | null;
  planType: 'COMPREHENSIVE' | 'NON_COMPREHENSIVE';
  durationMonths: number; // default: 12
  basePrice: number; // in INR
  applicableAcTypes: string[];
  applicableTonnages: string[];
  entitlements: IAmcPlanEntitlement[];
  partCoverages: IAmcPlanPartCoverage[];
  gasCoverage: IAmcPlanGasCoverage;
  termsAndConditions: string[];
  active: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const AmcPlanPartCoverageSchema = new Schema<IAmcPlanPartCoverage>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    coverageType: {
      type: String,
      required: true,
      enum: ['FULL', 'LABOUR_ONLY', 'DISCOUNTED', 'NOT_COVERED'],
      default: 'FULL',
    },
    quantityLimitPerYear: {
      type: Number,
      default: null,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const AmcPlanEntitlementSchema = new Schema<IAmcPlanEntitlement>(
  {
    serviceType: {
      type: String,
      required: true,
      enum: [
        'DRY_SERVICE',
        'WATER_SERVICE',
        'PREVENTIVE_HEALTH_CHECK',
        'BREAKDOWN_REPAIR',
        'GAS_CHARGING',
      ],
    },
    scheduling: {
      type: String,
      required: true,
      enum: ['MONTHLY', 'QUARTERLY', 'BI_MONTHLY', 'ON_DEMAND'],
      default: 'QUARTERLY',
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    entitlementScope: {
      type: String,
      required: true,
      enum: ['PER_EQUIPMENT', 'PER_CONTRACT'],
      default: 'PER_EQUIPMENT',
    },
  },
  { _id: false }
);

const AmcPlanGasCoverageSchema = new Schema<IAmcPlanGasCoverage>(
  {
    included: { type: Boolean, default: false },
    refrigerantTypes: { type: [String], default: ['R32', 'R410A'] },
    quantityLimitKg: { type: Number, default: null },
    limitScope: {
      type: String,
      enum: ['PER_EQUIPMENT', 'PER_CONTRACT'],
      default: 'PER_EQUIPMENT',
    },
    excludeDamagePipingLeaks: { type: Boolean, default: true },
  },
  { _id: false }
);

const AmcPlanSchema = new Schema<IAmcPlan>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      default: null,
      trim: true,
    },
    planType: {
      type: String,
      required: true,
      enum: ['COMPREHENSIVE', 'NON_COMPREHENSIVE'],
      default: 'NON_COMPREHENSIVE',
      index: true,
    },
    durationMonths: {
      type: Number,
      required: true,
      default: 12,
      min: 1,
    },
    basePrice: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    applicableAcTypes: {
      type: [String],
      default: ['SPLIT', 'WINDOW', 'CASSETTE', 'DUCTABLE'],
    },
    applicableTonnages: {
      type: [String],
      default: ['1.0', '1.5', '2.0', 'Up to 5 Ton'],
    },
    entitlements: {
      type: [AmcPlanEntitlementSchema],
      default: [
        {
          serviceType: 'WATER_SERVICE',
          scheduling: 'QUARTERLY',
          quantity: 4,
          entitlementScope: 'PER_EQUIPMENT',
        },
        {
          serviceType: 'BREAKDOWN_REPAIR',
          scheduling: 'ON_DEMAND',
          quantity: 2,
          entitlementScope: 'PER_CONTRACT',
        },
      ],
    },
    partCoverages: {
      type: [AmcPlanPartCoverageSchema],
      default: [],
    },
    gasCoverage: {
      type: AmcPlanGasCoverageSchema,
      default: () => ({
        included: false,
        refrigerantTypes: ['R32', 'R410A'],
        quantityLimitKg: null,
        limitScope: 'PER_EQUIPMENT',
        excludeDamagePipingLeaks: true,
      }),
    },
    termsAndConditions: {
      type: [String],
      default: [
        'This AMC is valid for 1 year from the date of agreement or approval.',
        'Spare parts are not included unless explicitly specified in comprehensive coverage.',
        'AC installation charges include up to 10 feet of standard installation.',
        'Additional copper piping beyond 10 feet will be charged on a per-foot basis.',
      ],
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
    collection: 'amc_plans',
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id?.toString();
        return ret;
      },
    },
  }
);

AmcPlanSchema.index({ businessId: 1, active: 1 });

export const AmcPlan = model<IAmcPlan>('AmcPlan', AmcPlanSchema);
export default AmcPlan;
