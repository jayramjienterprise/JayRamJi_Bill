import { env } from '../../../config/env';
import { NimExtractionRequest } from './extractionTypes';
import { AppError } from '../../../middleware/errorHandler';

export class NvidiaNimError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    errorCode: string,
    details: Record<string, unknown> = {}
  ) {
    super(message, statusCode, errorCode, details);
  }
}

export class NvidiaAuthError extends NvidiaNimError {
  constructor(message = 'NVIDIA NIM authentication failed. Check backend NVIDIA_NIM_API_KEY.') {
    super(message, 401, 'NVIDIA_AUTH_ERROR');
  }
}

export class NvidiaRateLimitError extends NvidiaNimError {
  constructor(message = 'NVIDIA NIM API rate limit exceeded. Please retry shortly.') {
    super(message, 429, 'NVIDIA_RATE_LIMIT');
  }
}

export class NvidiaTimeoutError extends NvidiaNimError {
  constructor(timeoutMs: number) {
    super(`NVIDIA NIM extraction request timed out after ${timeoutMs}ms`, 504, 'NVIDIA_TIMEOUT', {
      timeoutMs,
    });
  }
}

export class NvidiaResponseTooLargeError extends NvidiaNimError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 413, 'NVIDIA_RESPONSE_TOO_LARGE', details);
  }
}

/**
 * Validates backend configuration for NVIDIA NIM scanner initialization.
 * Fails clearly if API key is missing or model name is empty.
 * Never allows silent fallback to another AI provider or fake data.
 */
export function validateNimConfig(config?: { apiKey?: string; model?: string }): void {
  const apiKey = config?.apiKey !== undefined ? config.apiKey : env.NVIDIA_NIM_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new NvidiaAuthError(
      'NVIDIA_NIM_API_KEY is not configured in backend environment. Scanner configuration validation failed.'
    );
  }

  const model = config?.model !== undefined ? config.model : env.NVIDIA_NIM_MODEL;
  if (!model || !model.trim()) {
    throw new NvidiaNimError(
      'NVIDIA_NIM_MODEL is not configured or is empty. Backend configuration requires a valid model name.',
      500,
      'NVIDIA_MODEL_CONFIG_MISSING'
    );
  }
}

export interface NvidiaNimClientConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

/**
 * Production HTTP Client for NVIDIA NIM Vision & Extraction APIs
 */
export class NvidiaNimClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config?: NvidiaNimClientConfig) {
    this.apiKey = config?.apiKey ?? env.NVIDIA_NIM_API_KEY;
    this.baseUrl = (config?.baseUrl ?? env.NVIDIA_NIM_BASE_URL).replace(/\/+$/, '');
    this.defaultModel = config?.model ?? env.NVIDIA_NIM_MODEL;
    this.timeoutMs = config?.timeoutMs ?? env.PURCHASE_SCANNER_NIM_TIMEOUT_MS;
    this.maxRetries = config?.maxRetries ?? 3;
  }

  /**
   * Dispatches multimodal page images to NVIDIA NIM vision model
   */
  public async extractDocumentVision(request: NimExtractionRequest): Promise<{
    rawText: string;
    model: string;
    durationMs: number;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    finishReason?: string | null;
  }> {
    const model = request.model || this.defaultModel;
    validateNimConfig({ apiKey: this.apiKey, model });

    const url = `${this.baseUrl}/chat/completions`;

    // Construct OpenAI-compatible multimodal content array
    const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      {
        type: 'text',
        text: request.prompt,
      },
    ];

    for (const page of request.pages) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${page.mimeType};base64,${page.base64Data}`,
        },
      });
    }

    const configuredMaxTokens = env.PURCHASE_SCANNER_NIM_MAX_OUTPUT_TOKENS || 4096;
    const maxTokens = request.maxTokens
      ? Math.min(request.maxTokens, configuredMaxTokens)
      : configuredMaxTokens;

    const messages: Array<{ role: string; content: any }> = [];
    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }
    messages.push({
      role: 'user',
      content: contentParts,
    });

    const requestBody = {
      model,
      messages,
      temperature: request.temperature ?? 0.0,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    };

    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      try {
        const response = await this.executeHttpRequest(url, requestBody);
        const durationMs = Date.now() - startTime;

        const firstChoice = response.choices?.[0];
        const rawText = firstChoice?.message?.content || '';
        const finishReason = firstChoice?.finish_reason || null;
        return {
          rawText,
          model,
          durationMs,
          usage: response.usage,
          finishReason,
        };
      } catch (err: any) {
        lastError = err;
        const isTransient =
          err instanceof NvidiaRateLimitError ||
          err instanceof NvidiaTimeoutError ||
          (err instanceof NvidiaNimError && err.statusCode >= 500 && err.statusCode <= 504);

        if (isTransient && attempt < this.maxRetries) {
          attempt++;
          // Progressive backoff: 1000ms, 2000ms, 3500ms + random jitter
          const baseDelay = attempt === 1 ? 1000 : attempt === 2 ? 2000 : 3500;
          const backoffDelay = baseDelay + Math.floor(Math.random() * 250);
          console.warn(
            `[NvidiaNimClient] Transient error (${err.message}). Retrying attempt ${attempt}/${this.maxRetries} after ${backoffDelay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }

        // Permanent error or retries exhausted
        throw err;
      }
    }

    throw lastError || new NvidiaNimError('NVIDIA NIM request failed', 500, 'NVIDIA_REQUEST_FAILED');
  }

  /**
   * Executes low-level fetch request with timeouts, response size bounds, and sanitization
   */
  private async executeHttpRequest(url: string, body: Record<string, unknown>): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const maxResponseBytes = (env.PURCHASE_SCANNER_MAX_RESPONSE_MB || 10) * 1024 * 1024;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.handleHttpError(response);
      }

      // 1. Check Content-Length header if present
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (!isNaN(contentLength) && contentLength > maxResponseBytes) {
          throw new NvidiaResponseTooLargeError(
            `NVIDIA NIM response Content-Length (${(contentLength / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${env.PURCHASE_SCANNER_MAX_RESPONSE_MB} MB`,
            { receivedBytes: contentLength, limitBytes: maxResponseBytes }
          );
        }
      }

      // 2. Stream / body reading with bounded byte counter
      let rawBodyText: string;
      if (response.body && typeof (response.body as any).getReader === 'function') {
        const reader = (response.body as any).getReader();
        const chunks: Uint8Array[] = [];
        let totalBytes = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              totalBytes += value.length;
              if (totalBytes > maxResponseBytes) {
                await reader.cancel();
                throw new NvidiaResponseTooLargeError(
                  `NVIDIA NIM response stream (${(totalBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${env.PURCHASE_SCANNER_MAX_RESPONSE_MB} MB`,
                  { receivedBytes: totalBytes, limitBytes: maxResponseBytes }
                );
              }
              chunks.push(value);
            }
          }
        } finally {
          reader.releaseLock?.();
        }
        rawBodyText = Buffer.concat(chunks).toString('utf-8');
      } else {
        rawBodyText = await response.text();
        const bodyBytes = Buffer.byteLength(rawBodyText, 'utf8');
        if (bodyBytes > maxResponseBytes) {
          throw new NvidiaResponseTooLargeError(
            `NVIDIA NIM response body (${(bodyBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${env.PURCHASE_SCANNER_MAX_RESPONSE_MB} MB`,
            { receivedBytes: bodyBytes, limitBytes: maxResponseBytes }
          );
        }
      }

      try {
        return JSON.parse(rawBodyText);
      } catch (parseErr: any) {
        throw new NvidiaNimError(
          'NVIDIA NIM returned invalid JSON response',
          422,
          'NVIDIA_INVALID_JSON_RESPONSE',
          { parseError: parseErr?.message }
        );
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted') || err?.message?.includes('timeout')) {
        throw new NvidiaTimeoutError(this.timeoutMs);
      }
      if (err instanceof NvidiaNimError) {
        throw err;
      }
      throw new NvidiaNimError(
        `NVIDIA NIM network communication failure: ${err?.message || 'unknown error'}`,
        502,
        'NVIDIA_NETWORK_ERROR'
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Maps HTTP status codes into domain-specific error types
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorDetail = '';
    try {
      const errorJson = await response.json();
      errorDetail =
        errorJson?.detail ||
        errorJson?.error?.message ||
        errorJson?.message ||
        errorJson?.title ||
        JSON.stringify(errorJson);
    } catch {
      try {
        errorDetail = await response.text();
      } catch {
        errorDetail = response.statusText;
      }
    }

    const status = response.status;

    if (status === 401 || status === 403) {
      throw new NvidiaAuthError(`NVIDIA NIM authentication rejected (${status}): ${errorDetail}`);
    }

    if (status === 429) {
      throw new NvidiaRateLimitError(`NVIDIA NIM rate limit reached (${status}): ${errorDetail}`);
    }

    if (status >= 500 && status <= 504) {
      throw new NvidiaNimError(`NVIDIA NIM server error (${status}): ${errorDetail}`, status, 'NVIDIA_SERVER_ERROR');
    }

    throw new NvidiaNimError(`NVIDIA NIM API error (${status}): ${errorDetail}`, status, 'NVIDIA_API_ERROR');
  }
}
