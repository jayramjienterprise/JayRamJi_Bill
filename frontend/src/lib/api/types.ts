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
