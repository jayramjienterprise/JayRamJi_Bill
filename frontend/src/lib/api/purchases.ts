import { apiClient } from './client';

export type PurchaseType = 'DIRECT_PURCHASE' | 'ORDERED_PURCHASE';
export type PurchaseStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type ReceivingStatus = 'NOT_RECEIVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export type FieldStatus =
  | 'EXTRACTED'
  | 'VERIFIED'
  | 'REVIEW_REQUIRED'
  | 'MISSING'
  | 'INVALID';

export interface IExtractedField<T = any> {
  value: T | null;
  confidence: number;
  status: FieldStatus;
  bbox?: number[] | null;
  warning?: string | null;
}

export interface IProductMatchAlternative {
  productId: string;
  productName: string;
  sku: string | null;
  score: number;
}

export interface IProductMatchResult {
  productId: string | null;
  productName: string | null;
  sku: string | null;
  uom: string | null;
  currentStock: number | null;
  lastPurchasePrice: number | null;
  matchingMethod: string;
  confidence: number;
  isMatched: boolean;
  status: FieldStatus;
  alternatives?: IProductMatchAlternative[];
}

export interface IExtractedLineItem {
  id: string;
  lineNumber: number;
  description: IExtractedField<string>;
  skuOrCode: IExtractedField<string>;
  hsnSac: IExtractedField<string>;
  quantity: IExtractedField<number>;
  unit: IExtractedField<string>;
  unitPrice: IExtractedField<number>;
  discountPercent: IExtractedField<number>;
  discountAmount: IExtractedField<number>;
  taxableAmount: IExtractedField<number>;
  gstRate: IExtractedField<number>;
  cgstRate: IExtractedField<number>;
  cgstAmount: IExtractedField<number>;
  sgstRate: IExtractedField<number>;
  sgstAmount: IExtractedField<number>;
  igstRate: IExtractedField<number>;
  igstAmount: IExtractedField<number>;
  cessRate: IExtractedField<number>;
  cessAmount: IExtractedField<number>;
  lineTotal: IExtractedField<number>;
  calculated?: {
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    lineTotal: number;
    discrepancy: number;
  };
  productMatch?: IProductMatchResult;
}

export interface IVendorMatchAlternative {
  vendorId: string;
  name: string;
  gstNumber: string | null;
  similarity: number;
}

export interface IVendorMatchResult {
  matchedVendorId: string | null;
  matchedVendorName: string | null;
  matchedVendorGstin: string | null;
  matchingMethod: string;
  confidence: number;
  status: FieldStatus;
  alternatives?: IVendorMatchAlternative[];
}

export interface IDraftReconciliation {
  isMathValid: boolean;
  hasDiscrepancies: boolean;
  discrepancyNotes: string[];
  calculatedSubtotal: number;
  calculatedTaxTotal: number;
  calculatedGrandTotal: number;
  calculatedCgstAmount?: number;
  calculatedSgstAmount?: number;
  calculatedIgstAmount?: number;
  taxMode?: 'INTRA_STATE' | 'INTER_STATE' | 'UNKNOWN';
}

export interface IPurchaseDraftOriginalFile {
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  publicId: string;
  pageCount: number;
  previewImages: string[];
}

export interface IPurchaseDraft {
  _id: string;
  businessId: string;
  draftNumber: string;
  vendorId?: string | null;
  originalFile: IPurchaseDraftOriginalFile;
  rawExtraction: any;
  extraction: {
    supplier: {
      name: IExtractedField<string>;
      gstin: IExtractedField<string>;
      pan: IExtractedField<string>;
      address: IExtractedField<string>;
      city: IExtractedField<string>;
      state: IExtractedField<string>;
      stateCode: IExtractedField<string>;
      pincode: IExtractedField<string>;
      phone: IExtractedField<string>;
      email: IExtractedField<string>;
    };
    invoice: {
      invoiceNumber: IExtractedField<string>;
      invoiceDate: IExtractedField<string>;
      dueDate: IExtractedField<string>;
      poNumber: IExtractedField<string>;
      ewayBillNumber: IExtractedField<string>;
      placeOfSupply: IExtractedField<string>;
      isReverseCharge: IExtractedField<boolean>;
    };
    items: IExtractedLineItem[];
    summary: {
      subtotal: IExtractedField<number>;
      totalDiscount: IExtractedField<number>;
      taxableAmount: IExtractedField<number>;
      cgstRate?: IExtractedField<number>;
      cgstAmount: IExtractedField<number>;
      sgstRate?: IExtractedField<number>;
      sgstAmount: IExtractedField<number>;
      igstRate?: IExtractedField<number>;
      igstAmount: IExtractedField<number>;
      cessAmount: IExtractedField<number>;
      totalTax: IExtractedField<number>;
      roundOff: IExtractedField<number>;
      grandTotal: IExtractedField<number>;
      amountPaid: IExtractedField<number>;
      balanceDue: IExtractedField<number>;
    };
    payment: {
      paymentMode: IExtractedField<string>;
      bankName: IExtractedField<string>;
      bankAccountNumber: IExtractedField<string>;
      bankIfsc: IExtractedField<string>;
      upiId: IExtractedField<string>;
      transactionReference: IExtractedField<string>;
    };
    additional: {
      notes: IExtractedField<string>;
      termsAndConditions: IExtractedField<string>;
      vehicleNumber: IExtractedField<string>;
    };
  };
  reconciliation: IDraftReconciliation;
  vendorMatch: IVendorMatchResult;
  manualOverride?: boolean;
  userCorrections?: Array<{
    field: string;
    originalValue: any;
    newValue: any;
    changedAt: string;
    reason?: string | null;
  }>;
  status: 'DRAFT_READY' | 'REVIEW_REQUIRED' | 'CONFIRMING' | 'CONVERTED' | 'EXPIRED';
  idempotencyKey?: string | null;
  confirmedPurchaseId?: string | null;
  confirmedAt?: string | null;
  confirmedBy?: string | null;
  createdBy: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  _id: string;
  id?: string;
  vendorCode: string;
  name: string;
  contactPerson?: string | null;
  mobile?: string | null;
  alternateMobile?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstNumber?: string | null;
  paymentTerms?: string | null;
  notes?: string | null;
  isActive: boolean;
  totalPurchases?: number;
  totalAmountPurchased?: number;
  totalAmountPaid?: number;
  outstandingAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseItem {
  _id?: string;
  productId: string | { _id: string; name: string; sku?: string; stockQuantity?: number; uom?: string };
  productNameSnapshot: string;
  skuSnapshot?: string | null;
  orderedQuantity: number;
  receivedQuantity: number;
  remainingQuantity: number;
  unitPurchasePrice: number;
  discountPercent: number;
  discountAmount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  receivingStatus: ReceivingStatus;
}

export interface Purchase {
  _id: string;
  id?: string;
  purchaseNumber: string;
  purchaseType: PurchaseType;
  vendorId: string | Vendor;
  vendor?: Vendor;
  vendorNameSnapshot?: string;
  vendorInvoiceNumber?: string | null;
  purchaseDate: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  status: PurchaseStatus;
  receivingStatus: ReceivingStatus;
  paymentStatus: PaymentStatus;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  items: PurchaseItem[];
  notes?: string | null;
  billAttachments?: BillAttachment[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchasesSummary {
  totalCount: number;
  totalPurchased: number;
  totalPaid: number;
  totalOutstanding: number;
}

export const purchasesApi = {
  // Vendors API
  async listVendors(params?: { search?: string; isActive?: boolean }): Promise<{ vendors: Vendor[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.isActive !== undefined) query.set('isActive', String(params.isActive));
    const qs = query.toString();
    return apiClient.get<{ vendors: Vendor[] }>(`/vendors${qs ? `?${qs}` : ''}`);
  },

  async getVendor(vendorId: string): Promise<{ vendor: Vendor }> {
    return apiClient.get<{ vendor: Vendor }>(`/vendors/${vendorId}`);
  },

  async createVendor(data: Partial<Vendor>): Promise<{ vendor: Vendor }> {
    return apiClient.post<{ vendor: Vendor }>('/vendors', data);
  },

  async updateVendor(vendorId: string, data: Partial<Vendor>): Promise<{ vendor: Vendor }> {
    return apiClient.patch<{ vendor: Vendor }>(`/vendors/${vendorId}`, data);
  },

  async toggleVendorStatus(vendorId: string): Promise<{ vendor: Vendor }> {
    return apiClient.patch<{ vendor: Vendor }>(`/vendors/${vendorId}/toggle-status`, {});
  },

  // Purchases API
  async listPurchases(params?: {
    vendorId?: string;
    purchaseType?: string;
    receivingStatus?: string;
    paymentStatus?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ purchases: Purchase[]; summary: PurchasesSummary }> {
    const query = new URLSearchParams();
    if (params?.vendorId && params.vendorId !== 'ALL') query.set('vendorId', params.vendorId);
    if (params?.purchaseType && params.purchaseType !== 'ALL') query.set('purchaseType', params.purchaseType);
    if (params?.receivingStatus && params.receivingStatus !== 'ALL') query.set('receivingStatus', params.receivingStatus);
    if (params?.paymentStatus && params.paymentStatus !== 'ALL') query.set('paymentStatus', params.paymentStatus);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const qs = query.toString();
    return apiClient.get<{ purchases: Purchase[]; summary: PurchasesSummary }>(`/purchases${qs ? `?${qs}` : ''}`);
  },

  async getPurchase(purchaseId: string): Promise<{ purchase: Purchase }> {
    return apiClient.get<{ purchase: Purchase }>(`/purchases/${purchaseId}`);
  },

  async createPurchase(data: any): Promise<{ purchase: Purchase }> {
    return apiClient.post<{ purchase: Purchase }>('/purchases', data);
  },

  async cancelPurchase(purchaseId: string): Promise<{ purchase: Purchase }> {
    return apiClient.patch<{ purchase: Purchase }>(`/purchases/${purchaseId}/cancel`, {});
  },

  async checkDuplicateInvoice(vendorId: string, vendorInvoiceNumber: string, excludePurchaseId?: string): Promise<{
    isDuplicate: boolean;
    existingPurchase?: { id: string; purchaseNumber: string; vendorInvoiceNumber: string; purchaseDate: string } | null;
  }> {
    const query = new URLSearchParams({
      vendorId,
      vendorInvoiceNumber,
    });
    if (excludePurchaseId) query.set('excludePurchaseId', excludePurchaseId);
    return apiClient.get<{
      isDuplicate: boolean;
      existingPurchase?: { id: string; purchaseNumber: string; vendorInvoiceNumber: string; purchaseDate: string } | null;
    }>(`/purchases/check-duplicate-invoice?${query.toString()}`);
  },

  // Receiving API
  async receivePurchaseProducts(
    purchaseId: string,
    payload: {
      items: { purchaseItemId: string; quantityReceived: number }[];
      deliveryChallanNumber?: string;
      notes?: string;
    }
  ): Promise<{ receipt: PurchaseReceipt; purchase: Purchase }> {
    return apiClient.post<{ receipt: PurchaseReceipt; purchase: Purchase }>(
      `/purchases/${purchaseId}/receive`,
      payload
    );
  },

  async listPurchaseReceipts(purchaseId: string): Promise<{ receipts: PurchaseReceipt[] }> {
    return apiClient.get<{ receipts: PurchaseReceipt[] }>(`/purchases/${purchaseId}/receipts`);
  },

  // Payments API
  async recordPurchasePayment(
    purchaseId: string,
    payload: {
      amount: number;
      paymentMethod: string;
      paymentDate?: string;
      referenceNumber?: string;
      notes?: string;
    }
  ): Promise<{ payment: VendorPayment; purchase: Purchase }> {
    return apiClient.post<{ payment: VendorPayment; purchase: Purchase }>(
      `/purchases/${purchaseId}/payments`,
      payload
    );
  },

  async listPurchasePayments(purchaseId: string): Promise<{ payments: VendorPayment[] }> {
    return apiClient.get<{ payments: VendorPayment[] }>(`/purchases/${purchaseId}/payments`);
  },

  async listVendorPayments(vendorId: string): Promise<{ payments: VendorPayment[] }> {
    return apiClient.get<{ payments: VendorPayment[] }>(`/vendors/${vendorId}/payments`);
  },

  // Dashboard API
  async getPurchaseDashboard(): Promise<{
    summary: {
      totalCount: number;
      totalPurchased: number;
      totalPaid: number;
      totalOutstanding: number;
      monthCount: number;
      monthPurchased: number;
      pendingDeliveriesCount: number;
      partiallyReceivedCount: number;
    };
    recentPurchases: Purchase[];
    topVendors: {
      vendorId: string;
      name: string;
      vendorCode: string;
      totalPurchases: number;
      totalAmount: number;
      totalPaid: number;
      outstandingAmount: number;
    }[];
    outstandingPayables: Purchase[];
  }> {
    return apiClient.get<any>('/purchases/dashboard');
  },

  // Automation & OCR
  async extractBillDraft(file: File): Promise<{
    attachmentUrl: string;
    fileName: string;
    extraction: ExtractedBillDraft;
  }> {
    const formData = new FormData();
    formData.append('billFile', file);
    return apiClient.post<{
      attachmentUrl: string;
      fileName: string;
      extraction: ExtractedBillDraft;
    }>('/purchases/extract-bill', formData);
  },

  // Phase 4 — AI Purchase Bill Scanner APIs
  async createScannerDraft(
    file: File,
    idempotencyKey?: string,
    options: { signal?: AbortSignal } = {}
  ): Promise<{
    success: boolean;
    draftId: string;
    draftNumber: string;
    status: string;
    draft: IPurchaseDraft;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (idempotencyKey) {
      headers['Idempotency-Key'] = idempotencyKey;
      headers['X-Scan-Operation-Id'] = idempotencyKey;
    }
    return apiClient.post<{
      success: boolean;
      draftId: string;
      draftNumber: string;
      status: string;
      draft: IPurchaseDraft;
    }>('/purchases/scanner/draft', formData, {
      ...options,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
    });
  },

  async getScannerDraft(draftId: string): Promise<{
    success: boolean;
    draft: IPurchaseDraft;
  }> {
    return apiClient.get<{
      success: boolean;
      draft: IPurchaseDraft;
    }>(`/purchases/scanner/drafts/${draftId}`);
  },

  async updateScannerDraft(draftId: string, patchData: any): Promise<{
    success: boolean;
    draft: IPurchaseDraft;
  }> {
    return apiClient.patch<{
      success: boolean;
      draft: IPurchaseDraft;
    }>(`/purchases/scanner/drafts/${draftId}`, patchData);
  },

  async confirmScannerDraft(draftId: string, payload?: any): Promise<{
    success: boolean;
    converted: boolean;
    alreadyConverted?: boolean;
    purchaseId: string;
    purchase: Purchase;
  }> {
    return apiClient.post<{
      success: boolean;
      converted: boolean;
      alreadyConverted?: boolean;
      purchaseId: string;
      purchase: Purchase;
    }>(`/purchases/scanner/drafts/${draftId}/confirm`, payload || {});
  },

  // CSV Import
  async parseCsvItems(params: { file?: File; csvText?: string }): Promise<ParseCsvResult> {
    if (params.file) {
      const formData = new FormData();
      formData.append('csvFile', params.file);
      return apiClient.post<ParseCsvResult>('/purchases/parse-csv', formData);
    } else {
      return apiClient.post<ParseCsvResult>('/purchases/parse-csv', { csvText: params.csvText });
    }
  },

  // Attachments
  async uploadPurchaseAttachment(
    purchaseId: string,
    file: File
  ): Promise<{ attachment: BillAttachment; purchase: Purchase }> {
    const formData = new FormData();
    formData.append('attachment', file);
    return apiClient.post<{ attachment: BillAttachment; purchase: Purchase }>(
      `/purchases/${purchaseId}/attachments`,
      formData
    );
  },

  async deletePurchaseAttachment(
    purchaseId: string,
    attachmentId: string
  ): Promise<{ purchase: Purchase }> {
    return apiClient.delete<{ purchase: Purchase }>(
      `/purchases/${purchaseId}/attachments/${attachmentId}`
    );
  },
};

export interface BillAttachment {
  _id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  publicId?: string | null;
  documentType?: string;
  uploadedAt: string;
  uploadedBy?: { _id: string; name: string; email: string } | string;
}

export interface ExtractedItemDraft {
  rawDescription: string;
  rawQuantity: number;
  rawUnitPrice: number;
  rawTaxRate: number;
  rawDiscountPercent: number;
  matchedProductId?: string;
  matchedProductName?: string;
  matchedSku?: string;
  matchConfidence: number;
  isMatched: boolean;
}

export interface ExtractedBillDraft {
  suggestedVendor?: {
    id: string;
    name: string;
    vendorCode: string;
    gstNumber?: string | null;
  } | null;
  vendorInvoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  items: ExtractedItemDraft[];
  confidenceScore: number;
  notes?: string;
}

export interface ParsedCsvRow {
  rowNumber: number;
  rawText: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPurchasePrice: number;
  discountPercent: number;
  taxRate: number;
  totalAmount: number;
  matchedProductId?: string;
  matchedProductName?: string;
  isValid: boolean;
  errors: string[];
}

export interface ParseCsvResult {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: ParsedCsvRow[];
}

export interface VendorPayment {
  _id: string;
  paymentNumber: string;
  amount: number;
  paymentMethod: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
  paymentDate: string;
  referenceNumber?: string | null;
  notes?: string | null;
  createdBy?: { _id: string; name: string; email: string };
  createdAt: string;
}

export interface PurchaseReceiptItem {
  purchaseItemId: string;
  productId: string;
  productNameSnapshot: string;
  quantityReceived: number;
  unitPurchasePrice?: number;
}

export interface PurchaseReceipt {
  _id: string;
  receiptNumber: string;
  receivedBy?: { _id: string; name: string; email: string };
  receivedAt: string;
  items: PurchaseReceiptItem[];
  deliveryChallanNumber?: string | null;
  notes?: string | null;
  createdAt: string;
}
