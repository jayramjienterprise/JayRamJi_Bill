export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface HealthCheckResponse {
  status: string;
}

export interface Customer {
  id: string;
  businessId: string;
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
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  type: 'SERVICE' | 'PRODUCT';
  name: string;
  description: string | null;
  uom: string;
  defaultPriceMinor: number;
  currency: 'INR';
  defaultTaxRateBps: number;
  active: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  businessId: string;
  type: 'LOGO' | 'STAMP' | 'SIGNATURE' | 'OTHER';
  cloudinaryPublicId: string;
  secureUrl: string;
  format: string | null;
  width: number | null;
  height: number | null;
  version: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CustomerListResponse {
  customers: Customer[];
  pagination: Pagination;
}

export interface ProductListResponse {
  products: Product[];
  pagination: Pagination;
}

export interface AssetListResponse {
  assets: Asset[];
}

export interface InvoiceItem {
  productId: string | null;
  type: 'SERVICE' | 'PRODUCT';
  description: string;
  uom: string;
  quantity: number;
  unitPriceMinor: number;
  taxableAmountMinor: number;
  taxes: Array<{
    type: string;
    rateBps: number;
    amountMinor: number;
  }>;
  taxAmountMinor: number;
  lineTotalMinor: number;
}

export interface Invoice {
  id: string;
  businessId: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  currency: 'INR';
  customerId: string | null;
  customerSnapshot: Record<string, any>;
  businessSnapshot: Record<string, any>;
  assetSnapshot: Record<string, any>;
  taxMode: 'NONE' | 'EXCLUSIVE' | 'INCLUSIVE';
  defaultTaxRateBps: number;
  discount: {
    type: 'NONE' | 'FIXED' | 'PERCENTAGE';
    value: number;
  };
  items: InvoiceItem[];
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    taxableAmountMinor: number;
    taxes: Array<{
      type: string;
      rateBps: number;
      amountMinor: number;
    }>;
    taxTotalMinor: number;
    roundingMinor: number;
    grandTotalMinor: number;
    currency: 'INR';
  };
  amountInWords: string;
  paymentTerms: string | null;
  notes: string | null;
  paymentSummary: {
    paidAmountMinor: number;
    dueAmountMinor: number;
    status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  };
  document?: {
    snapshot?: {
      status: 'NOT_GENERATED' | 'GENERATING' | 'READY' | 'FAILED';
      provider: string;
      publicId: string | null;
      secureUrl: string | null;
      format: string;
      width: number | null;
      height: number | null;
      generatedAt: string | null;
      checksum: string | null;
    };
    pdf?: {
      status: 'NOT_GENERATED' | 'GENERATING' | 'READY' | 'FAILED';
      provider: string;
      storageKey: string | null;
      secureUrl: string | null;
      generatedAt: string | null;
      checksum: string | null;
    };
  };
  cancellationReason?: string | null;
  cancelledAt?: string | null;
  cancelledBy?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: Pagination;
}
