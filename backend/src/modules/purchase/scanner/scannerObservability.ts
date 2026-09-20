import crypto from 'crypto';

/**
 * Production Observability, Safe Structured Logging & Metrics Registry
 * for Purchase Bill Scanner
 */

export interface ScannerLogMetadata {
  correlationId?: string;
  businessId?: string;
  draftId?: string;
  purchaseId?: string;
  sourceDraftId?: string;
  stage?: string;
  durationMs?: number | ScannerStageDurations;
  fileType?: string;
  fileSize?: number;
  pageCount?: number;
  error?: string;
  errorCode?: string;
  [key: string]: any;
}

const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /auth(orization)?/i,
  /token/i,
  /secret/i,
  /password/i,
  /base64/i,
  /image/i,
  /cookie/i,
  /account[-_]?num/i,
  /ifsc/i,
  /upi/i,
  /pan/i,
  /card/i,
];

/**
 * Strips secrets, base64 payloads, images, and sensitive bank info from log objects.
 */
export function sanitizeLogData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

    if (isSensitiveKey) {
      sanitized[key] = '[REDACTED]';
      continue;
    }

    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (Buffer.isBuffer(value)) {
      sanitized[key] = `[BUFFER: ${value.length} bytes]`;
    } else if (typeof value === 'string' && value.length > 500) {
      sanitized[key] = `${value.substring(0, 100)}... [TRUNCATED: ${value.length} chars]`;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeLogData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Generates an operator-traceable correlation/request ID.
 * Format: SCAN-YYYYMMDD-XXXXXX
 */
export function generateScannerCorrelationId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SCAN-${dateStr}-${rand}`;
}

/**
 * Produces a safe, one-way SHA-256 hash prefix of sensitive identifiers (e.g. idempotency keys)
 * so they can be securely correlated in logs without exposing raw credentials.
 */
export function hashIdentifier(val?: string | null): string | null {
  if (!val) return null;
  return crypto.createHash('sha256').update(val).digest('hex').substring(0, 16);
}

/**
 * Safe structured logger for scanner lifecycle events.
 */
export function logScannerEvent(
  level: 'info' | 'warn' | 'error',
  eventName: string,
  metadata: ScannerLogMetadata = {}
): void {
  const sanitizedMeta = sanitizeLogData(metadata);
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: eventName,
    ...sanitizedMeta,
  };

  const message = `[ScannerObservability] [${level.toUpperCase()}] ${eventName} ${JSON.stringify(logEntry)}`;

  if (level === 'error') {
    console.error(message);
  } else if (level === 'warn') {
    console.warn(message);
  } else {
    console.log(message);
  }
}

export interface ScannerStageDurations {
  preprocessing: number;
  cloudinaryUpload: number;
  nimInitial: number;
  jsonParseInitial: number;
  nimRepair: number;
  jsonParseRepair: number;
  normalization: number;
  financialValidation: number;
  matching: number;
  duplicateInvoiceDetection: number;
  draftPersistence: number;
  total: number;
}

/**
 * In-memory lightweight metrics registry
 */
class ScannerMetricsRegistry {
  private scannerRequestsTotal = 0;
  private scannerSuccessTotal = 0;
  private scannerFailureTotal = 0;
  private scannerLatencies: number[] = [];

  private nvidiaRequestsTotal = 0;
  private nvidiaFailuresTotal = 0;
  private nvidiaLatencies: number[] = [];

  private draftCreatedTotal = 0;
  private draftExpiredTotal = 0;
  private draftConfirmedTotal = 0;
  private confirmationFailuresTotal = 0;
  private receivingRecoveryTotal = 0;

  // Phase 5.1 Additions
  private repairTotal = 0;
  private repairSuccessTotal = 0;
  private repairFailureTotal = 0;
  private duplicateRequestsTotal = 0;

  private nimInitialLatencies: number[] = [];
  private nimRepairLatencies: number[] = [];
  private preprocessingLatencies: number[] = [];
  private matchingLatencies: number[] = [];
  private draftCreationLatencies: number[] = [];

  public recordScannerRequest(success: boolean, durationMs: number): void {
    this.scannerRequestsTotal++;
    if (success) {
      this.scannerSuccessTotal++;
    } else {
      this.scannerFailureTotal++;
    }
    this.scannerLatencies.push(durationMs);
  }

  public recordNvidiaCall(success: boolean, durationMs: number): void {
    this.nvidiaRequestsTotal++;
    if (!success) {
      this.nvidiaFailuresTotal++;
    }
    this.nvidiaLatencies.push(durationMs);
  }

  public recordRepair(success: boolean, durationMs: number): void {
    this.repairTotal++;
    if (success) {
      this.repairSuccessTotal++;
    } else {
      this.repairFailureTotal++;
    }
    this.nimRepairLatencies.push(durationMs);
  }

  public recordDuplicateRequest(): void {
    this.duplicateRequestsTotal++;
  }

  public recordStageLatency(
    stage: 'preprocessing' | 'matching' | 'draftCreation' | 'nimInitial' | 'nimRepair',
    durationMs: number
  ): void {
    switch (stage) {
      case 'preprocessing':
        this.preprocessingLatencies.push(durationMs);
        break;
      case 'matching':
        this.matchingLatencies.push(durationMs);
        break;
      case 'draftCreation':
        this.draftCreationLatencies.push(durationMs);
        break;
      case 'nimInitial':
        this.nimInitialLatencies.push(durationMs);
        break;
      case 'nimRepair':
        this.nimRepairLatencies.push(durationMs);
        break;
    }
  }

  public recordDraftCreated(): void {
    this.draftCreatedTotal++;
  }

  public recordDraftExpired(): void {
    this.draftExpiredTotal++;
  }

  public recordDraftConfirmed(): void {
    this.draftConfirmedTotal++;
  }

  public recordConfirmationFailure(): void {
    this.confirmationFailuresTotal++;
  }

  public recordReceivingRecovery(): void {
    this.receivingRecoveryTotal++;
  }

  private calculatePercentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
  }

  public getMetricsSummary() {
    const scannerAvg =
      this.scannerLatencies.length > 0
        ? Math.round(this.scannerLatencies.reduce((a, b) => a + b, 0) / this.scannerLatencies.length)
        : 0;

    const nvidiaAvg =
      this.nvidiaLatencies.length > 0
        ? Math.round(this.nvidiaLatencies.reduce((a, b) => a + b, 0) / this.nvidiaLatencies.length)
        : 0;

    return {
      scanner_requests_total: this.scannerRequestsTotal,
      scanner_success_total: this.scannerSuccessTotal,
      scanner_failure_total: this.scannerFailureTotal,
      scanner_repair_total: this.repairTotal,
      scanner_repair_success_total: this.repairSuccessTotal,
      scanner_repair_failure_total: this.repairFailureTotal,
      scanner_duplicate_request_total: this.duplicateRequestsTotal,
      scanner_latency: {
        avgMs: scannerAvg,
        p50Ms: this.calculatePercentile(this.scannerLatencies, 50),
        p95Ms: this.calculatePercentile(this.scannerLatencies, 95),
        p99Ms: this.calculatePercentile(this.scannerLatencies, 99),
        count: this.scannerLatencies.length,
      },
      nvidia_requests_total: this.nvidiaRequestsTotal,
      nvidia_failures_total: this.nvidiaFailuresTotal,
      nvidia_latency: {
        avgMs: nvidiaAvg,
        p50Ms: this.calculatePercentile(this.nvidiaLatencies, 50),
        p95Ms: this.calculatePercentile(this.nvidiaLatencies, 95),
        p99Ms: this.calculatePercentile(this.nvidiaLatencies, 99),
        count: this.nvidiaLatencies.length,
      },
      scanner_nim_initial_latency: {
        count: this.nimInitialLatencies.length,
        p50Ms: this.calculatePercentile(this.nimInitialLatencies, 50),
        p95Ms: this.calculatePercentile(this.nimInitialLatencies, 95),
      },
      scanner_nim_repair_latency: {
        count: this.nimRepairLatencies.length,
        p50Ms: this.calculatePercentile(this.nimRepairLatencies, 50),
        p95Ms: this.calculatePercentile(this.nimRepairLatencies, 95),
      },
      scanner_preprocessing_latency: {
        count: this.preprocessingLatencies.length,
        p50Ms: this.calculatePercentile(this.preprocessingLatencies, 50),
      },
      scanner_matching_latency: {
        count: this.matchingLatencies.length,
        p50Ms: this.calculatePercentile(this.matchingLatencies, 50),
      },
      scanner_draft_creation_latency: {
        count: this.draftCreationLatencies.length,
        p50Ms: this.calculatePercentile(this.draftCreationLatencies, 50),
      },
      draft_created_total: this.draftCreatedTotal,
      draft_expired_total: this.draftExpiredTotal,
      draft_confirmed_total: this.draftConfirmedTotal,
      confirmation_failures_total: this.confirmationFailuresTotal,
      receiving_recovery_total: this.receivingRecoveryTotal,
    };
  }

  public resetMetrics(): void {
    this.scannerRequestsTotal = 0;
    this.scannerSuccessTotal = 0;
    this.scannerFailureTotal = 0;
    this.scannerLatencies = [];
    this.nvidiaRequestsTotal = 0;
    this.nvidiaFailuresTotal = 0;
    this.nvidiaLatencies = [];
    this.draftCreatedTotal = 0;
    this.draftExpiredTotal = 0;
    this.draftConfirmedTotal = 0;
    this.confirmationFailuresTotal = 0;
    this.receivingRecoveryTotal = 0;
    this.repairTotal = 0;
    this.repairSuccessTotal = 0;
    this.repairFailureTotal = 0;
    this.duplicateRequestsTotal = 0;
    this.nimInitialLatencies = [];
    this.nimRepairLatencies = [];
    this.preprocessingLatencies = [];
    this.matchingLatencies = [];
    this.draftCreationLatencies = [];
  }
}

export const scannerMetrics = new ScannerMetricsRegistry();

