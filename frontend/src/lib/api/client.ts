import { ApiResponse, Customer, CustomerListResponse, Product, ProductListResponse, Asset, AssetListResponse, Invoice, InvoiceListResponse } from './types';

// Fallback to local express server endpoint
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

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
  }): Promise<InvoiceListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', params.page.toString());
    if (params.limit) query.append('limit', params.limit.toString());
    if (params.status) query.append('status', params.status);
    if (params.customerId) query.append('customerId', params.customerId);

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

  public async finalizeInvoice(invoiceId: string): Promise<any> {
    const data = await this.post<{ invoice: any }>(`/invoices/${invoiceId}/finalize`, {});
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
}

export const apiClient = new ApiClient();
export default apiClient;
