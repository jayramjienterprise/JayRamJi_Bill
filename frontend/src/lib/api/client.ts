import { ApiResponse, Customer, CustomerListResponse, Product, ProductListResponse, Asset, AssetListResponse, Invoice, InvoiceListResponse, PaymentAccount, PaymentProof, PaymentRecord, PaymentMethod } from './types';

// Direct Render backend in production and local express in dev
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && (window.location.hostname.includes('jayramjienterprise.in') || window.location.hostname.includes('vercel.app'))
    ? 'https://backend.invoice.jayramjienterprise.in/api'
    : 'http://localhost:5000/api');

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details: Record<string, any>;

  constructor(message: string, code: string, status: number, details: Record<string, any> = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class ApiClient {
  public getBaseUrl(): string {
    return BASE_URL;
  }
  /**
   * Performs an asynchronous fetch request and returns structured data
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = { ...options.headers as Record<string, string> };
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
      });

      // Parse JSON response. Most of our APIs will return JSON.
      let result: ApiResponse<T>;
      try {
        result = await response.json();
      } catch (jsonErr) {
        throw new ApiError(
          `Unexpected non-JSON response from server (Status: ${response.status})`,
          'NON_JSON_RESPONSE',
          response.status
        );
      }

      // Check if API reported failure or HTTP status is not ok
      if (!response.ok || !result.success) {
        throw new ApiError(
          result.error?.message || 'Request failed',
          result.error?.code || 'API_ERROR',
          response.status,
          result.error?.details || {}
        );
      }

      if (result.data === undefined) {
        throw new ApiError(
          'API response did not contain expected data payload',
          'MISSING_DATA_PAYLOAD',
          response.status
        );
      }

      return result.data;
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error;
      }
      // Handle network connection/cors failures
      throw new ApiError(
        error.message || 'Network connection failed',
        'NETWORK_FAILURE',
        500
      );
    }
  }

  public async get<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public async post<T>(endpoint: string, body: any, options: RequestInit = {}): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  public async put<T>(endpoint: string, body: any, options: RequestInit = {}): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  public async patch<T>(endpoint: string, body: any, options: RequestInit = {}): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  public async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  // Customers Module API calls
  public async listCustomers(params: {
    page?: number;
    limit?: number;
    search?: string;
    active?: boolean;
  }): Promise<CustomerListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.search) query.append('search', params.search);
    if (params.active !== undefined) query.append('active', params.active.toString());

    return this.get<CustomerListResponse>(`/customers?${query.toString()}`);
  }

  public async getCustomer(customerId: string): Promise<Customer> {
    const data = await this.get<{ customer: Customer }>(`/customers/${customerId}`);
    return data.customer;
  }

  public async createCustomer(customerData: Partial<Customer>): Promise<Customer> {
    const data = await this.post<{ customer: Customer }>('/customers', customerData);
    return data.customer;
  }

  public async updateCustomer(customerId: string, customerData: Partial<Customer>): Promise<Customer> {
    const data = await this.patch<{ customer: Customer }>(`/customers/${customerId}`, customerData);
    return data.customer;
  }

  public async deactivateCustomer(customerId: string): Promise<Customer> {
    const data = await this.patch<{ customer: Customer }>(`/customers/${customerId}/deactivate`, {});
    return data.customer;
  }

  // Products/Services Module API calls
  public async listProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: 'SERVICE' | 'PRODUCT';
    active?: boolean;
  }): Promise<ProductListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.search) query.append('search', params.search);
    if (params.type) query.append('type', params.type);
    if (params.active !== undefined) query.append('active', params.active.toString());

    return this.get<ProductListResponse>(`/products?${query.toString()}`);
  }

  public async getProduct(productId: string): Promise<Product> {
    const data = await this.get<{ product: Product }>(`/products/${productId}`);
    return data.product;
  }

  public async createProduct(productData: Partial<Product>): Promise<Product> {
    const data = await this.post<{ product: Product }>('/products', productData);
    return data.product;
  }

  public async updateProduct(productId: string, productData: Partial<Product>): Promise<Product> {
    const data = await this.patch<{ product: Product }>(`/products/${productId}`, productData);
    return data.product;
  }

  public async deactivateProduct(productId: string): Promise<Product> {
    const data = await this.patch<{ product: Product }>(`/products/${productId}/deactivate`, {});
    return data.product;
  }

  // Assets Module API calls
  public async listAssets(type?: 'LOGO' | 'STAMP' | 'SIGNATURE' | 'OTHER'): Promise<Asset[]> {
    const query = type ? `?type=${type}` : '';
    const data = await this.get<{ assets: Asset[] }>(`/assets${query}`);
    return data.assets;
  }

  public async uploadAsset(file: File, type: 'LOGO' | 'STAMP' | 'SIGNATURE' | 'OTHER'): Promise<Asset> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const data = await this.post<{ asset: Asset }>('/assets', formData);
    return data.asset;
  }

  public async activateAsset(assetId: string): Promise<Asset> {
    const data = await this.patch<{ asset: Asset }>(`/assets/${assetId}/activate`, {});
    return data.asset;
  }

  public async deactivateAsset(assetId: string): Promise<Asset> {
    const data = await this.patch<{ asset: Asset }>(`/assets/${assetId}/deactivate`, {});
    return data.asset;
  }

  // Invoices Module API calls
  public async listInvoices(params: {
    page?: number;
    limit?: number;
    status?: string;
    customerId?: string;
    search?: string;
    paymentStatus?: string;
    from?: string;
    to?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<InvoiceListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.status) query.append('status', params.status);
    if (params.customerId) query.append('customerId', params.customerId);
    if (params.search) query.append('search', params.search);
    if (params.paymentStatus) query.append('paymentStatus', params.paymentStatus);
    if (params.from) query.append('from', params.from);
    if (params.to) query.append('to', params.to);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);

    return this.get<InvoiceListResponse>(`/invoices?${query.toString()}`);
  }

  public async getInvoice(invoiceId: string): Promise<Invoice> {
    const data = await this.get<{ invoice: Invoice }>(`/invoices/${invoiceId}`);
    return data.invoice;
  }

  public async createInvoiceDraft(invoiceData: any): Promise<Invoice> {
    const data = await this.post<{ invoice: Invoice }>('/invoices', invoiceData);
    return data.invoice;
  }

  public async updateInvoiceDraft(invoiceId: string, invoiceData: any): Promise<Invoice> {
    const data = await this.patch<{ invoice: Invoice }>(`/invoices/${invoiceId}`, invoiceData);
    return data.invoice;
  }

  public async deleteInvoiceDraft(invoiceId: string): Promise<void> {
    await this.delete<void>(`/invoices/${invoiceId}`);
  }

  public async calculatePreview(invoiceData: any): Promise<{ totals: any, items: any[], amountInWords: string }> {
    return this.post<{ totals: any, items: any[], amountInWords: string }>('/invoices/calculate', invoiceData);
  }

  public async getInvoicePreview(invoiceId: string): Promise<any> {
    return this.get<any>(`/invoices/${invoiceId}/preview`);
  }

  public async finalizeInvoice(invoiceId: string, payload: { payment?: any } = {}): Promise<any> {
    const data = await this.post<{ invoice: any }>(`/invoices/${invoiceId}/finalize`, payload);
    return data.invoice;
  }

  public async cancelInvoice(invoiceId: string, reason: string): Promise<any> {
    const data = await this.post<{ invoice: any }>(`/invoices/${invoiceId}/cancel`, { reason });
    return data.invoice;
  }

  public async retrySnapshot(invoiceId: string): Promise<any> {
    return this.post<any>(`/invoices/${invoiceId}/documents/snapshot/retry`, {});
  }

  public async retryPdf(invoiceId: string): Promise<any> {
    return this.post<any>(`/invoices/${invoiceId}/documents/pdf/retry`, {});
  }

  // Payment Accounts API calls
  public async listPaymentAccounts(params?: { active?: boolean; type?: string }): Promise<PaymentAccount[]> {
    const query = new URLSearchParams();
    if (params?.active !== undefined) query.append('active', String(params.active));
    if (params?.type) query.append('type', params.type);
    const queryString = query.toString();
    const res = await this.get<{ accounts: PaymentAccount[] }>(`/payment-accounts${queryString ? `?${queryString}` : ''}`);
    return res.accounts;
  }

  public async getPaymentAccount(id: string): Promise<PaymentAccount> {
    const res = await this.get<{ account: PaymentAccount }>(`/payment-accounts/${id}`);
    return res.account;
  }

  public async createPaymentAccount(accountData: Partial<PaymentAccount>): Promise<PaymentAccount> {
    const res = await this.post<{ account: PaymentAccount }>('/payment-accounts', accountData);
    return res.account;
  }

  public async updatePaymentAccount(id: string, accountData: Partial<PaymentAccount>): Promise<PaymentAccount> {
    const res = await this.patch<{ account: PaymentAccount }>(`/payment-accounts/${id}`, accountData);
    return res.account;
  }

  public async deactivatePaymentAccount(id: string): Promise<PaymentAccount> {
    const res = await this.post<{ account: PaymentAccount }>(`/payment-accounts/${id}/deactivate`, {});
    return res.account;
  }

  public async activatePaymentAccount(id: string): Promise<PaymentAccount> {
    const res = await this.post<{ account: PaymentAccount }>(`/payment-accounts/${id}/activate`, {});
    return res.account;
  }

  // Payment Proof Upload API call
  public async uploadPaymentProof(invoiceId: string, file: File): Promise<{ proof: PaymentProof }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.post<{ proof: PaymentProof }>(`/invoices/${invoiceId}/payments/proof`, formData);
  }

  // Payments Module API calls
  public async recordPayment(invoiceId: string, paymentData: {
    amountMinor: number;
    method: PaymentMethod;
    paymentAccountId?: string | null;
    referenceNumber?: string;
    chequeDetails?: {
      chequeNumber?: string | null;
      chequeDate?: string | null;
      bankName?: string | null;
      status?: 'RECEIVED' | 'DEPOSITED' | 'CLEARED' | 'BOUNCED';
    };
    proof?: PaymentProof | null;
    paidAt?: string;
    notes?: string;
  }): Promise<{ payment: PaymentRecord; paymentSummary: any }> {
    return this.post<{ payment: PaymentRecord; paymentSummary: any }>(`/invoices/${invoiceId}/payments`, paymentData);
  }

  public async listPayments(invoiceId: string): Promise<PaymentRecord[]> {
    const res = await this.get<{ payments: PaymentRecord[] }>(`/invoices/${invoiceId}/payments`);
    return res.payments;
  }

  public async reversePayment(invoiceId: string, paymentId: string, reason?: string): Promise<{ payment: PaymentRecord; paymentSummary: any }> {
    return this.post<{ payment: PaymentRecord; paymentSummary: any }>(`/invoices/${invoiceId}/payments/${paymentId}/reverse`, { reason });
  }

  // Dashboard & Analytics Module API calls
  public async getDashboardOverview(params?: {
    preset?: string;
    from?: string;
    to?: string;
    groupBy?: string;
  }): Promise<import('./types').DashboardOverview> {
    const query = new URLSearchParams();
    if (params?.preset) query.append('preset', params.preset);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.groupBy) query.append('groupBy', params.groupBy);
    return this.get<import('./types').DashboardOverview>(`/dashboard/overview?${query.toString()}`);
  }

  public async getRecentInvoices(limit = 5): Promise<any[]> {
    const res = await this.get<{ invoices: any[] }>(`/dashboard/recent-invoices?limit=${limit}`);
    return res.invoices;
  }

  public async getRecentActivity(): Promise<import('./types').RecentActivityItem[]> {
    const res = await this.get<{ activities: import('./types').RecentActivityItem[] }>('/dashboard/recent-activity');
    return res.activities;
  }

  public async getAnalyticsOverview(params?: {
    preset?: string;
    from?: string;
    to?: string;
    groupBy?: string;
  }): Promise<import('./types').AnalyticsOverview> {
    const query = new URLSearchParams();
    if (params?.preset) query.append('preset', params.preset);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.groupBy) query.append('groupBy', params.groupBy);
    return this.get<import('./types').AnalyticsOverview>(`/analytics/overview?${query.toString()}`);
  }

  public async getSalesTrend(params?: {
    preset?: string;
    from?: string;
    to?: string;
    groupBy?: string;
  }): Promise<{ currency: string; groupBy: string; series: import('./types').TimeSeriesPoint[] }> {
    const query = new URLSearchParams();
    if (params?.preset) query.append('preset', params.preset);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.groupBy) query.append('groupBy', params.groupBy);
    return this.get<{ currency: string; groupBy: string; series: import('./types').TimeSeriesPoint[] }>(
      `/analytics/sales-trend?${query.toString()}`
    );
  }

  public async getPaymentMethodAnalytics(params?: {
    preset?: string;
    from?: string;
    to?: string;
  }): Promise<import('./types').AnalyticsPaymentMethods> {
    const query = new URLSearchParams();
    if (params?.preset) query.append('preset', params.preset);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    return this.get<import('./types').AnalyticsPaymentMethods>(`/analytics/payment-methods?${query.toString()}`);
  }

  public async getReceivingAccountsAnalytics(params?: {
    preset?: string;
    from?: string;
    to?: string;
  }): Promise<import('./types').AnalyticsReceivingAccounts> {
    const query = new URLSearchParams();
    if (params?.preset) query.append('preset', params.preset);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    return this.get<import('./types').AnalyticsReceivingAccounts>(`/analytics/receiving-accounts?${query.toString()}`);
  }

  public async getCustomerAnalytics(params?: {
    preset?: string;
    from?: string;
    to?: string;
    sortBy?: 'sales' | 'orders' | 'outstanding';
    limit?: number;
  }): Promise<import('./types').AnalyticsCustomers> {
    const query = new URLSearchParams();
    if (params?.preset) query.append('preset', params.preset);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.get<import('./types').AnalyticsCustomers>(`/analytics/customers?${query.toString()}`);
  }

  public async getProductAnalytics(params?: {
    preset?: string;
    from?: string;
    to?: string;
    sortBy?: 'revenue' | 'quantity' | 'orders';
    limit?: number;
  }): Promise<import('./types').AnalyticsProducts> {
    const query = new URLSearchParams();
    if (params?.preset) query.append('preset', params.preset);
    if (params?.from) query.append('from', params.from);
    if (params?.to) query.append('to', params.to);
    if (params?.sortBy) query.append('sortBy', params.sortBy);
    if (params?.limit) query.append('limit', params.limit.toString());
    return this.get<import('./types').AnalyticsProducts>(`/analytics/products?${query.toString()}`);
  }

  public async getOutstandingAnalytics(): Promise<import('./types').AnalyticsOutstanding> {
    return this.get<import('./types').AnalyticsOutstanding>('/analytics/outstanding');
  }

  // Sharing Module API calls
  public async createShareLink(invoiceId: string, expiresAt?: string): Promise<{ shareUrl: string; expiresAt: string | null }> {
    const data = await this.post<{ shareUrl: string; expiresAt: string | null }>(`/invoices/${invoiceId}/share`, { expiresAt });
    return data;
  }

  public async disableShareLink(invoiceId: string): Promise<any> {
    return this.post<any>(`/invoices/${invoiceId}/share/disable`, {});
  }

  public async getPublicInvoice(token: string): Promise<{ invoice: any }> {
    return this.get<{ invoice: any }>(`/public/invoices/${token}`);
  }

  // Upload Sessions API calls
  public async createUploadSession(payload: { invoiceId?: string; metadata?: any }): Promise<any> {
    return this.post<any>('/upload-sessions', payload);
  }

  public async getUploadSessionStatus(sessionId: string): Promise<any> {
    return this.get<any>(`/upload-sessions/${sessionId}/status`);
  }

  public async cancelUploadSession(sessionId: string): Promise<any> {
    return this.post<any>(`/upload-sessions/${sessionId}/cancel`, {});
  }

  public async directUploadProof(file: File): Promise<{ proof: any }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.post<{ proof: any }>('/upload-sessions/direct-upload', formData);
  }

  public async getPublicUploadSession(token: string): Promise<any> {
    return this.get<any>(`/upload-sessions/public/${token}`);
  }

  public async uploadPublicProof(token: string, file: File): Promise<{ proof: any }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.post<{ proof: any }>(`/upload-sessions/public/${token}/upload`, formData);
  }
}

export const apiClient = new ApiClient();
export default apiClient;

