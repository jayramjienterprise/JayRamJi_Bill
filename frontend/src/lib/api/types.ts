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
  database?: string;
  timestamp?: string;
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
  section?: 'ITEM' | 'LABOUR' | 'PART';
}

export interface Invoice {
  id: string;
  businessId: string;
  invoiceNumber: string;
  invoiceDate: string;
  status: 'DRAFT' | 'FINALIZED' | 'CANCELLED';
  currency: string;
  customerId: string | null;
  customerSnapshot: {
    name?: string;
    contact?: { phone?: string; email?: string };
    address?: { line1?: string; line2?: string; city?: string; state?: string; postalCode?: string; country?: string };
    taxProfile?: { gstin?: string; pan?: string };
  };
  businessSnapshot?: Record<string, any>;
  assetSnapshot?: Record<string, any>;
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
    currency: string;
  };
  amountInWords: string;
  paymentTerms: string | null;
  notes: string | null;
  paymentSummary: {
    paidAmountMinor: number;
    dueAmountMinor: number;
    status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  };
  publicAccess?: {
    enabled: boolean;
    tokenHash: string | null;
    createdAt: string | null;
    expiresAt: string | null;
  };
  document?: {
    snapshot?: {
      status: 'NOT_GENERATED' | 'GENERATING' | 'READY' | 'FAILED';
      secureUrl?: string | null;
    };
    pdf?: {
      status: 'NOT_GENERATED' | 'GENERATING' | 'READY' | 'FAILED';
      secureUrl?: string | null;
    };
  };
  createdBy: string;
  finalizedBy: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  finalizedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  pagination: Pagination;
}

export interface CreateInvoicePayload {
  customerId?: string | null;
  customerSnapshot?: Record<string, any>;
  invoiceDate: string;
  items: Array<{
    productId?: string | null;
    type?: 'SERVICE' | 'PRODUCT';
    description: string;
    uom: string;
    quantity: number;
    unitPriceMinor: number;
    section?: 'ITEM' | 'LABOUR' | 'PART';
  }>;
  taxMode: 'NONE' | 'EXCLUSIVE' | 'INCLUSIVE';
  defaultTaxRateBps?: number;
  discount?: {
    type: 'NONE' | 'FIXED' | 'PERCENTAGE';
    value: number;
  };
  paymentTerms?: string;
  notes?: string;
  paymentStatus?: 'UNPAID' | 'PAID' | 'PARTIAL';
  payment?: any;
}

export type PaymentMethod = 'CASH' | 'UPI' | 'QR_CODE' | 'BANK_TRANSFER' | 'CHEQUE';
export type PaymentAccountType = 'BANK' | 'UPI' | 'CASH';

export interface PaymentAccount {
  id: string;
  _id?: string;
  businessId: string;
  name: string;
  displayName: string;
  type: PaymentAccountType;
  bankName?: string | null;
  accountHolderName?: string | null;
  accountNumber?: string | null;
  maskedAccountNumber?: string | null;
  ifsc?: string | null;
  branch?: string | null;
  upiId?: string | null;
  qrAssetId?: string | null;
  qrAssetUrl?: string | null;
  active: boolean;
  isDefault: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAccountSnapshot {
  name: string;
  type: PaymentAccountType;
  displayName: string;
  bankName?: string | null;
  maskedAccountNumber?: string | null;
  ifsc?: string | null;
  upiId?: string | null;
  qrAssetUrl?: string | null;
}

export interface PaymentProof {
  publicId: string | null;
  secureUrl: string | null;
  format: string | null;
  fileType: string | null;
  uploadedAt: string | null;
}

export interface ChequeDetails {
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bankName?: string | null;
  status?: 'RECEIVED' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED';
}

export interface PaymentRecord {
  id: string;
  _id?: string;
  businessId: string;
  invoiceId: string;
  amountMinor: number;
  currency: 'INR';
  method: PaymentMethod;
  paymentAccountId?: string | null;
  paymentAccountSnapshot?: PaymentAccountSnapshot | null;
  referenceNumber: string | null;
  chequeDetails?: ChequeDetails | null;
  proof?: PaymentProof | null;
  paidAt: string;
  notes: string | null;
  status: 'CONFIRMED' | 'REVERSED';
  createdAt: string;
  updatedAt: string;
}

export type UploadSessionStatus = 'CREATED' | 'SCANNED' | 'UPLOADING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED' | 'FAILED';

export interface UploadSession {
  sessionId: string;
  token: string;
  qrCodeDataUrl: string;
  uploadUrl: string;
  expiresAt: string;
  status: UploadSessionStatus;
  metadata?: {
    invoiceNumber?: string | null;
    amountMinor?: number | null;
    method?: string | null;
    customerName?: string | null;
  };
  proof?: PaymentProof | null;
}

export interface PublicUploadSessionInfo {
  businessName: string;
  invoiceNumber: string;
  amountMinor?: number | null;
  method?: string | null;
  status: UploadSessionStatus;
  expiresAt: string;
}

// ----------------------------------------------------
// Dashboard & Analytics Typed Contracts
// ----------------------------------------------------

export interface TimeSeriesPoint {
  period: string;
  dateLabel: string;
  salesMinor: number;
  receivedMinor: number;
  invoiceCount: number;
}

export interface PaymentMethodBreakdown {
  method: PaymentMethod;
  label: string;
  amountMinor: number;
  count: number;
  transactions?: number;
  percentage: number;
  transactionPercentage?: number;
}

export interface PaymentAccountBreakdown {
  accountId: string | null;
  accountName: string;
  type: string;
  amountReceivedMinor: number;
  paymentCount: number;
  percentage: number;
}

export interface TopCustomerItem {
  customerId: string;
  customerName: string;
  orders: number;
  salesMinor: number;
  paidMinor: number;
  outstandingMinor: number;
}

export interface BestSellingItem {
  description: string;
  type?: 'SERVICE' | 'PRODUCT';
  quantitySold: number;
  orders: number;
  revenueMinor: number;
  averagePriceMinor?: number;
  percentOfTurnover?: number;
}

export interface DashboardOverview {
  currency: string;
  dateRange: {
    from: string;
    to: string;
    preset: string;
    groupBy: string;
  };
  kpis: {
    salesMinor: number;
    moneyReceivedMinor: number;
    outstandingMinor: number;
    invoiceCount: number;
    averageInvoiceMinor: number;
    paidRatePercentage: number;
  };
  salesOverviewSeries: TimeSeriesPoint[];
  paymentMethods: PaymentMethodBreakdown[];
  paymentAccounts: PaymentAccountBreakdown[];
  topCustomers: TopCustomerItem[];
  bestSelling: BestSellingItem[];
  outstandingInvoices: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    dueAmountMinor: number;
    grandTotalMinor: number;
    invoiceDate: string;
  }>;
}

export interface AnalyticsOverview {
  currency: string;
  dateRange: {
    from: string;
    to: string;
    preset: string;
    groupBy: string;
  };
  kpis: {
    turnoverMinor: number;
    totalReceivedMinor: number;
    outstandingMinor: number;
    totalOrders: number;
    uniqueCustomers: number;
    averageOrderValueMinor: number;
    collectionRate: number;
  };
  comparison: {
    hasPreviousData: boolean;
    prevTurnoverMinor: number;
    prevReceivedMinor: number;
    prevOrders: number;
    turnoverGrowthPercent: number | null;
    receivedGrowthPercent: number | null;
    ordersGrowthPercent: number | null;
  };
}

export interface AnalyticsPaymentMethods {
  currency: string;
  totalReceivedMinor: number;
  totalTransactions: number;
  methods: PaymentMethodBreakdown[];
  mostUsedMethod: {
    method: PaymentMethod;
    label: string;
    count: number;
    percentage: number;
  } | null;
  highestValueMethod: {
    method: PaymentMethod;
    label: string;
    amountMinor: number;
    percentage: number;
  } | null;
}

export interface AnalyticsReceivingAccounts {
  currency: string;
  totalReceivedMinor: number;
  accounts: PaymentAccountBreakdown[];
}

export interface AnalyticsCustomers {
  currency: string;
  totalRegisteredCustomers: number;
  activeInPeriod: number;
  customers: Array<{
    customerId: string;
    customerName: string;
    orders: number;
    turnoverMinor: number;
    paidMinor: number;
    outstandingMinor: number;
    averageOrderMinor: number;
  }>;
}

export interface AnalyticsProducts {
  currency: string;
  totalTurnoverMinor: number;
  products: BestSellingItem[];
}

export interface AnalyticsOutstanding {
  currency: string;
  totalOutstandingMinor: number;
  outstandingInvoiceCount: number;
  outstandingCustomerCount: number;
  averageDueMinor: number;
  breakdown: {
    unpaidMinor: number;
    unpaidCount: number;
    partialMinor: number;
    partialCount: number;
  };
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    phone: string | null;
    outstandingMinor: number;
    invoiceCount: number;
  }>;
}

export interface RecentActivityItem {
  id: string;
  type: 'INVOICE_FINALIZED' | 'PAYMENT_RECEIVED';
  title: string;
  description: string;
  amountMinor: number;
  timestamp: string;
}
