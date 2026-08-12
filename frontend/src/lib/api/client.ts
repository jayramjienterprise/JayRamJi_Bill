import { ApiResponse } from './types';

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
    
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
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
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  public async put<T>(endpoint: string, body: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  public async delete<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
