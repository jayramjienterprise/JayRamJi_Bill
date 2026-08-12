import { Schema, model, Document, Types } from 'mongoose';

export interface ICustomer extends Document {
  businessId: Types.ObjectId;
  name: string;
  contact: {
    phone: string | null;
    email: string | null;
  };
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string;
  };
  taxProfile: {
    gstin: string | null;
    pan: string | null;
  };
  notes: string | null;
  active: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
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
      index: true,
    },
    contact: {
      phone: {
        type: String,
        default: null,
      },
      email: {
        type: String,
        default: null,
      },
    },
    address: {
      line1: {
        type: String,
        default: null,
      },
      line2: {
        type: String,
        default: null,
      },
      city: {
        type: String,
        default: null,
      },
      state: {
        type: String,
        default: null,
      },
      postalCode: {
        type: String,
        default: null,
      },
      country: {
        type: String,
        required: true,
        default: 'India',
      },
    },
    taxProfile: {
      gstin: {
        type: String,
        default: null,
      },
      pan: {
        type: String,
        default: null,
      },
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
    collection: 'customers',
  }
);

// Indexes specified in MODELS.md
CustomerSchema.index({ businessId: 1, name: 1 });
CustomerSchema.index({ businessId: 1, 'contact.phone': 1 });
CustomerSchema.index({ businessId: 1, 'taxProfile.gstin': 1 });
CustomerSchema.index({ businessId: 1, active: 1 });

export const Customer = model<ICustomer>('Customer', CustomerSchema);
