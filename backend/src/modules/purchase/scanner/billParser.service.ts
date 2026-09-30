import { DocumentPreprocessingResult } from './preprocessingTypes';
import {
  NimDocumentPagePayload,
  NimExtractionResult,
  RawNimExtractionResponse,
  rawNimExtractionResponseSchema,
} from './extractionTypes';
import {
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_USER_PROMPT,
  EXTRACTION_RETRY_PROMPT,
} from './extractionPrompt';
import {
  createExtractedField,
  normalizeBoundingBox,
  normalizeDate,
  normalizeGstin,
  normalizeNumeric,
  normalizePercentage,
} from './extractionNormalizer';
import { NvidiaNimClient } from './nvidiaNimClient';
import {
  IDocumentTaxMetadata,
  IExtractedLineItem,
  IPurchaseBillExtraction,
  TaxSource,
} from '../../../database/models/PurchaseDraft';
import { purchaseBillExtractionSchema } from '../draft/purchaseDraft.schema';
import { AppError } from '../../../middleware/errorHandler';
import { env } from '../../../config/env';
import { logScannerEvent, scannerMetrics } from './scannerObservability';

export class ExtractionError extends AppError {
  constructor(
    message: string,
    statusCode: number = 422,
    errorCode: string = 'EXTRACTION_FAILED',
    details: Record<string, unknown> = {}
  ) {
    super(message, statusCode, errorCode, details);
  }
}

export interface BillParserOptions {
  client?: NvidiaNimClient;
  temperature?: number;
  /**
   * Strictly internal service/testing override.
   * Never exposed to or accepted from public HTTP requests.
   */
  _internalModelOverride?: string;
  /**
   * @deprecated Client-provided model parameter. Ignored for security to prevent client model overriding.
   */
  model?: string;
}

/**
 * Safely extracts pure JSON payload from LLM responses.
 *
 * Supported cleanups:
 * 1. Direct trimmed JSON (e.g. `{ ... }`)
 * 2. Markdown fenced code blocks (```json ... ``` or ``` ... ```)
 * 3. Outermost balanced object braces `{ ... }` when surrounded by introductory or concluding text
 *
 * Guarantees:
 * - Deterministic, non-hallucinating: Never alters numbers, fields, or values.
 * - Does not invent missing data.
 */
export function extractJsonPayload(rawText: string): { cleanJsonText: string; method: 'direct' | 'fence' | 'braces' } {
  if (!rawText) return { cleanJsonText: '', method: 'direct' };

  const trimmed = rawText.trim();

  // 1. Direct test: If text already parses directly
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      JSON.parse(trimmed);
      return { cleanJsonText: trimmed, method: 'direct' };
    } catch {
      // Fall through to other extraction methods
    }
  }

  // 2. Fenced test: Markdown code blocks
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let fenceMatch: RegExpExecArray | null;
  while ((fenceMatch = fenceRegex.exec(rawText)) !== null) {
    const candidate = fenceMatch[1].trim();
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      try {
        JSON.parse(candidate);
        return { cleanJsonText: candidate, method: 'fence' };
      } catch {
        // Continue looking for valid blocks
      }
    }
  }

  // 3. Braces extraction: Locate first '{' and last '}'
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    const candidate = rawText.substring(firstBrace, lastBrace + 1).trim();
    try {
      JSON.parse(candidate);
      return { cleanJsonText: candidate, method: 'braces' };
    } catch {
      // Not valid JSON
    }
  }

  // If no method produced valid JSON, return stripped candidate for error reporting / repair
  const fallback = trimmed
    .replace(/^```(?:json)?\s*/im, '')
    .replace(/\s*```\s*$/m, '')
    .trim();

  return { cleanJsonText: fallback, method: 'direct' };
}

/**
 * Strips markdown code block wrappers (e.g. ```json ... ```)
 * Maintained as backward-compatible utility.
 */
export function stripMarkdownFences(text: string): string {
  return extractJsonPayload(text).cleanJsonText;
}

/**
 * Production Document Parser Service using NVIDIA NIM Vision Models
 *
 * Guaranteed Properties:
 * - Read-only: never touches database models or inventory
 * - Strict integrity: never invents, guesses, or fills fake values
 * - Multi-page: combines line items and metadata across all document pages
 * - Safe normalization: sanitizes currencies, commas, percentages, and Indian date formats
 */
export async function parseBillDocument(
  preprocessing: DocumentPreprocessingResult,
  options?: BillParserOptions
): Promise<NimExtractionResult> {
  if (!preprocessing.pages || preprocessing.pages.length === 0) {
    throw new ExtractionError('Document contains no pages for extraction', 400, 'NO_PAGES');
  }

  const client = options?.client ?? new NvidiaNimClient();

  // Requirement 2: Ensure NVIDIA_NIM_MODEL is controlled by backend configuration.
  // Client-provided `model` parameter is strictly ignored.
  const model = (options?._internalModelOverride ?? env.NVIDIA_NIM_MODEL ?? '').trim();

  // Requirement 6: Model configuration validation
  if (!model) {
    throw new ExtractionError(
      'NVIDIA_NIM_MODEL is not configured or is empty. Backend configuration requires a valid model name.',
      500,
      'NVIDIA_MODEL_CONFIG_MISSING'
    );
  }

  const warnings: string[] = [...preprocessing.warnings];

  // Phase 5.13.1: Track parser-level deadline across BOTH initial and repair NIM calls.
  // This prevents the repair call from getting a fresh NVIDIA_NIM_TOTAL_TIMEOUT_MS budget.
  // Budget = 2 × NIM_TOTAL_TIMEOUT_MS + 10s overhead (for JSON parse, normalization).
  const nimTotalBudget = env.NVIDIA_NIM_TOTAL_TIMEOUT_MS ?? 50000;
  const parserBudgetMs = nimTotalBudget * 2 + 10000;
  const parserStart = Date.now();

  // 1. Prepare base64 image payloads for all pages sequentially and validate payload limits
  const maxPageBytes = (env.PURCHASE_SCANNER_MAX_PAGE_IMAGE_MB || 5) * 1024 * 1024;
  const maxPayloadBytes = (env.PURCHASE_SCANNER_MAX_NIM_PAYLOAD_MB || 20) * 1024 * 1024;

  let totalEncodedBytes = 0;
  const pagePayloads: NimDocumentPagePayload[] = [];

  for (const p of preprocessing.pages) {
    const base64Data = p.buffer.toString('base64');
    const pageBytes = Buffer.byteLength(base64Data, 'utf8');

    // Requirement 4: Per-page image size limit
    if (pageBytes > maxPageBytes) {
      throw new ExtractionError(
        `Page ${p.pageNumber} encoded payload size (${(pageBytes / (1024 * 1024)).toFixed(2)} MB) exceeds configured per-page limit of ${env.PURCHASE_SCANNER_MAX_PAGE_IMAGE_MB} MB`,
        413,
        'PAGE_PAYLOAD_TOO_LARGE',
        { pageNumber: p.pageNumber, pageBytes, limitBytes: maxPageBytes }
      );
    }

    totalEncodedBytes += pageBytes;
    pagePayloads.push({
      pageNumber: p.pageNumber,
      mimeType: p.mimeType || 'image/png',
      base64Data,
    });
  }

  // Requirement 3: Total multimodal request payload limit
  if (totalEncodedBytes > maxPayloadBytes) {
    throw new ExtractionError(
      `Total multimodal image payload size (${(totalEncodedBytes / (1024 * 1024)).toFixed(2)} MB) exceeds configured limit of ${env.PURCHASE_SCANNER_MAX_NIM_PAYLOAD_MB} MB`,
      413,
      'PAYLOAD_TOO_LARGE',
      { totalBytes: totalEncodedBytes, limitBytes: maxPayloadBytes, pageCount: preprocessing.pageCount }
    );
  }

  // 2. Dispatch vision extraction prompt to NVIDIA NIM (initial attempt)
  logScannerEvent('info', 'SCANNER_NIM_INITIAL_STARTED', {
    model,
    pageCount: preprocessing.pageCount,
    payloadBytes: totalEncodedBytes,
  });

  const response = await client.extractDocumentVision({
    model,
    pages: pagePayloads,
    systemPrompt: EXTRACTION_SYSTEM_PROMPT,
    prompt: EXTRACTION_USER_PROMPT,
    temperature: options?.temperature ?? 0.0,
  });

  // Track attempt count and per-attempt durations from the NIM client response
  const initialAttemptCount: number = (response as any).attemptCount ?? 1;
  const initialAttemptDurations: number[] = (response as any).attemptDurations ?? [response.durationMs];

  logScannerEvent('info', 'SCANNER_NIM_INITIAL_COMPLETED', {
    model,
    durationMs: response.durationMs,
    attemptCount: initialAttemptCount,
    attemptDurations: initialAttemptDurations,
    promptTokens: response.usage?.prompt_tokens ?? null,
    completionTokens: response.usage?.completion_tokens ?? null,
    finishReason: response.finishReason ?? null,
  });

  let rawText = response.rawText;
  let parsedJson: any = null;
  let repaired = false;
  let initialParseDurationMs = 0;
  let retryNimDurationMs = 0;
  let retryParseDurationMs = 0;
  let repairAttemptCount = 0;
  let repairAttemptDurations: number[] = [];

  // 3. Attempt JSON parse (using safe deterministic extraction)
  const parseStart = Date.now();
  const extractionResult = extractJsonPayload(rawText);
  const cleanJsonText = extractionResult.cleanJsonText;

  try {
    parsedJson = JSON.parse(cleanJsonText);
    initialParseDurationMs = Date.now() - parseStart;
  } catch (initialParseError: any) {
    initialParseDurationMs = Date.now() - parseStart;

    // Safe diagnostic metadata (NEVER logs sensitive data, full response, or image)
    const safeDiagnostics = {
      model,
      rawByteLength: Buffer.byteLength(rawText, 'utf8'),
      cleanByteLength: Buffer.byteLength(cleanJsonText, 'utf8'),
      finishReason: response.finishReason ?? null,
      promptTokens: response.usage?.prompt_tokens ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
      isEmpty: !rawText || rawText.trim().length === 0,
      hasMarkdownFences: rawText.includes('```'),
      startsWithBrace: rawText.trim().startsWith('{'),
      endsWithBrace: rawText.trim().endsWith('}'),
      extractionMethodAttempted: extractionResult.method,
      parseErrorMessage: initialParseError?.message ?? 'Unknown JSON parse error',
    };

    logScannerEvent('warn', 'SCANNER_NIM_JSON_PARSE_FAILED', safeDiagnostics);

    // Phase 5.13.1: Guard — check shared parser budget before starting repair.
    // Prevents the repair NIM call from getting a fresh nimTotalBudget (50s).
    // Minimum required budget for a repair attempt: 12000ms (NIM attempt timeout + 2s overhead).
    const elapsedSoFar = Date.now() - parserStart;
    const remainingParserBudget = parserBudgetMs - elapsedSoFar;
    const MIN_REPAIR_BUDGET_MS = 12000;

    if (remainingParserBudget < MIN_REPAIR_BUDGET_MS) {
      logScannerEvent('warn', 'SCANNER_NIM_REPAIR_SKIPPED_BUDGET', {
        model,
        elapsedSoFar,
        remainingParserBudget,
        minRequired: MIN_REPAIR_BUDGET_MS,
      });
      throw new ExtractionError(
        `NVIDIA NIM returned malformed JSON and no budget remains for repair (${remainingParserBudget}ms remaining). Total parser elapsed: ${elapsedSoFar}ms`,
        504,
        'NVIDIA_TIMEOUT',
        { elapsedSoFar, remainingParserBudget, initialParseError: initialParseError?.message }
      );
    }

    // 4. One single controlled FRESH VISION RETRY attempt with original images.
    // Use remaining parser budget (capped) as the totalBudgetMs for this NIM client
    // so it cannot consume another full nimTotalBudget (50s).
    logScannerEvent('info', 'SCANNER_NIM_RETRY_STARTED', { model, attempt: 2, remainingParserBudget });
    logScannerEvent('info', 'SCANNER_NIM_REPAIR_STARTED', { model }); // Backwards-compatible alias

    const retryStart = Date.now();
    try {
      const retryUserPrompt = `${EXTRACTION_RETRY_PROMPT}\n\n${EXTRACTION_USER_PROMPT}`;
      // Create a repair client with capped budget to prevent fresh 50s window
      const repairClient = options?.client ?? new NvidiaNimClient({ totalBudgetMs: remainingParserBudget - 2000 });
      const retryResponse = await repairClient.extractDocumentVision({
        model,
        pages: pagePayloads, // CRITICAL: Original preprocessed bill page images!
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        prompt: retryUserPrompt,
        temperature: 0.0,
      });

      repairAttemptCount = (retryResponse as any).attemptCount ?? 1;
      repairAttemptDurations = (retryResponse as any).attemptDurations ?? [];
      retryNimDurationMs = retryResponse.durationMs;
      const retryParseStart = Date.now();
      const retryExtraction = extractJsonPayload(retryResponse.rawText);
      parsedJson = JSON.parse(retryExtraction.cleanJsonText);
      retryParseDurationMs = Date.now() - retryParseStart;

      repaired = true;
      warnings.push('Extraction output required second vision extraction attempt');
      scannerMetrics.recordRepair(true, retryNimDurationMs);
      logScannerEvent('info', 'SCANNER_NIM_RETRY_COMPLETED', {
        model,
        durationMs: retryNimDurationMs,
        attemptCount: repairAttemptCount,
        retryParseDurationMs,
      });
      logScannerEvent('info', 'SCANNER_NIM_REPAIR_COMPLETED', {
        model,
        repairNimDurationMs: retryNimDurationMs,
        repairParseDurationMs: retryParseDurationMs,
      });
    } catch (retryErr: any) {
      retryNimDurationMs = Date.now() - retryStart;
      scannerMetrics.recordRepair(false, retryNimDurationMs);
      logScannerEvent('error', 'SCANNER_NIM_RETRY_FAILED', {
        model,
        durationMs: retryNimDurationMs,
        error: retryErr?.message ?? 'Fresh vision extraction retry failed',
      });
      logScannerEvent('error', 'SCANNER_NIM_REPAIR_FAILED', {
        model,
        repairDurationMs: retryNimDurationMs,
        error: retryErr?.message ?? 'Repair failed',
      });

      throw new ExtractionError(
        'NVIDIA NIM returned malformed JSON that could not be parsed or repaired',
        422,
        'MALFORMED_JSON',
        { originalError: initialParseError?.message, retryError: retryErr?.message }
      );
    }
  }

  // 5. Validate raw model output structure with Zod
  const validatedRaw = rawNimExtractionResponseSchema.safeParse(parsedJson);
  if (!validatedRaw.success) {
    throw new ExtractionError(
      'Extracted document structure failed schema validation',
      422,
      'SCHEMA_VALIDATION_FAILED',
      { issues: validatedRaw.error.issues }
    );
  }

  const raw = validatedRaw.data;

  // 6. Map and normalize into full PurchaseBillExtraction
  const normalizedExtraction = mapRawToPurchaseBillExtraction(raw);

  // 7. Verify final normalized extraction adheres strictly to purchaseBillExtractionSchema
  const finalValidation = purchaseBillExtractionSchema.safeParse(normalizedExtraction);
  if (!finalValidation.success) {
    throw new ExtractionError(
      'Normalized extraction failed internal contract validation',
      500,
      'INTERNAL_CONTRACT_ERROR',
      { issues: finalValidation.error.issues }
    );
  }

  // Compute aggregate attempt counts and durations across initial + repair calls
  const totalNimAttemptCount = initialAttemptCount + repairAttemptCount;
  // Flatten all per-attempt durations: initial call attempts, then repair call attempts
  const allAttemptDurations = [...initialAttemptDurations, ...repairAttemptDurations];

  return {
    rawResponse: raw,
    normalizedExtraction: finalValidation.data as any,
    metadata: {
      durationMs: response.durationMs + retryNimDurationMs,
      initialNimDurationMs: response.durationMs,
      initialParseDurationMs,
      repairNimDurationMs: retryNimDurationMs,
      repairParseDurationMs: retryParseDurationMs,
      retryNimDurationMs,
      retryParseDurationMs,
      retryAttempted: repaired,
      modelUsed: response.model,
      pageCount: preprocessing.pageCount,
      warnings,
      repaired,
      // Phase 5.13.1: Per-attempt observability
      nimAttemptCount: totalNimAttemptCount,
      nimAttemptDurations: allAttemptDurations,
    },
  };
}

/**
 * Transforms raw NIM fields into the canonical PurchaseBillExtraction schema
 */
export function mapRawToPurchaseBillExtraction(
  raw: RawNimExtractionResponse
): IPurchaseBillExtraction {
  // --- SUPPLIER ---
  const sup = raw.supplier || {};
  const supplier = {
    name: createExtractedField(cleanStr(sup.name)),
    gstin: createExtractedField(normalizeGstin(sup.gstin)),
    pan: createExtractedField(cleanStr(sup.pan)),
    address: createExtractedField(cleanStr(sup.address)),
    city: createExtractedField(cleanStr(sup.city)),
    state: createExtractedField(cleanStr(sup.state)),
    stateCode: createExtractedField(cleanStr(sup.stateCode)),
    pincode: createExtractedField(cleanStr(sup.pincode)),
    phone: createExtractedField(cleanStr(sup.phone)),
    email: createExtractedField(cleanStr(sup.email)),
  };

  // --- BUYER ---
  const buy = (raw as any).buyer || {};
  const buyer = {
    name: createExtractedField(cleanStr(buy.name)),
    address: createExtractedField(cleanStr(buy.address)),
    city: createExtractedField(cleanStr(buy.city)),
    state: createExtractedField(cleanStr(buy.state)),
    stateCode: createExtractedField(cleanStr(buy.stateCode)),
    pincode: createExtractedField(cleanStr(buy.pincode)),
    gstin: createExtractedField(normalizeGstin(buy.gstin)),
  };

  // Defensive Check: Ensure buyer is not mistakenly assigned as supplier
  if (supplier.name.value && /^(buyer|bill\s*to|billed\s*to|customer|consignee):/i.test(supplier.name.value)) {
    const cleanedBuyerName = supplier.name.value.replace(/^(buyer|bill\s*to|billed\s*to|customer|consignee):\s*/i, '').trim();
    if (!buyer.name.value) {
      buyer.name.value = cleanedBuyerName;
    }
    supplier.name.value = null;
  }

  // --- INVOICE ---
  const inv = raw.invoice || {};
  const invDateNorm = normalizeDate(inv.invoiceDate);
  const dueDateNorm = normalizeDate(inv.dueDate);

  const invoice = {
    invoiceNumber: createExtractedField(cleanStr(inv.invoiceNumber)),
    invoiceDate: createExtractedField(invDateNorm.isoDate, {
      warning: invDateNorm.warning,
    }),
    dueDate: createExtractedField(dueDateNorm.isoDate, {
      warning: dueDateNorm.warning,
    }),
    poNumber: createExtractedField(cleanStr(inv.poNumber)),
    ewayBillNumber: createExtractedField(cleanStr(inv.ewayBillNumber)),
    placeOfSupply: createExtractedField(cleanStr(inv.placeOfSupply)),
    isReverseCharge: createExtractedField(
      typeof inv.isReverseCharge === 'boolean'
        ? inv.isReverseCharge
        : typeof inv.isReverseCharge === 'string'
        ? inv.isReverseCharge.toLowerCase() === 'true' || inv.isReverseCharge.toLowerCase() === 'yes'
        : null
    ),
    alternativeDates: Array.isArray(inv.alternativeDates)
      ? (inv.alternativeDates as any[]).map((d) => String(d).trim()).filter(Boolean)
      : [],
    dateConflict: Boolean(inv.dateConflict),
  };

  // --- SUMMARY (Extracted first so document-level tax rates can propagate to line items) ---
  const sum = raw.summary || {};
  const subtotalNorm = normalizeNumeric(sum.subtotal ?? (sum as any).subTotal ?? (sum as any).sub_total ?? (sum as any).netAmount);
  const totalDiscNorm = normalizeNumeric(sum.totalDiscount ?? (sum as any).discountTotal ?? (sum as any).total_discount);
  const taxableSumNorm = normalizeNumeric(sum.taxableAmount ?? (sum as any).taxableValue ?? (sum as any).taxable_amount);
  const cgstRateNorm = normalizePercentage(sum.cgstRate ?? (sum as any).cgst_rate ?? (sum as any).cgstPercent ?? (sum as any).cgst_percentage);
  // Phase 5.13: cgstSumNorm, sgstSumNorm, totalTaxNorm declared as 'let' so the GST Rate Halving Guard below can correct them
  let cgstSumNorm = normalizeNumeric(sum.cgstAmount ?? (sum as any).cgst ?? (sum as any).cgst_amount ?? (sum as any).cgstTax);
  const sgstRateNorm = normalizePercentage(sum.sgstRate ?? (sum as any).sgst_rate ?? (sum as any).sgstPercent ?? (sum as any).sgst_percentage);
  let sgstSumNorm = normalizeNumeric(sum.sgstAmount ?? (sum as any).sgst ?? (sum as any).sgst_amount ?? (sum as any).sgstTax);
  const igstRateNorm = normalizePercentage(sum.igstRate ?? (sum as any).igst_rate ?? (sum as any).igstPercent ?? (sum as any).igst_percentage);
  const igstSumNorm = normalizeNumeric(sum.igstAmount ?? (sum as any).igst ?? (sum as any).igst_amount ?? (sum as any).igstTax);
  const cessSumNorm = normalizeNumeric(sum.cessAmount ?? (sum as any).cess ?? (sum as any).cess_amount);
  let totalTaxNorm = normalizeNumeric(sum.totalTax ?? (sum as any).taxAmount ?? (sum as any).total_tax ?? (sum as any).tax_amount ?? (sum as any).gst ?? (sum as any).gstAmount);
  const roundOffNorm = normalizeNumeric(sum.roundOff ?? (sum as any).round_off ?? (sum as any).rounding);
  const grandTotalNorm = normalizeNumeric(sum.grandTotal ?? (sum as any).grand_total ?? (sum as any).total ?? (sum as any).invoiceTotal ?? (sum as any).billAmount);
  const amountPaidNorm = normalizeNumeric(sum.amountPaid ?? (sum as any).amount_paid ?? (sum as any).paidAmount);
  const balanceDueNorm = normalizeNumeric(sum.balanceDue ?? (sum as any).balance_due ?? (sum as any).dueAmount);

  // Derive document-level uniform tax rates from summary if applicable (Phase 5.10 & 5.11)
  let docCgstRate: number | null = cgstRateNorm.value;
  let docSgstRate: number | null = sgstRateNorm.value;
  let docIgstRate: number | null = igstRateNorm.value;
  let docGstRate: number | null = null;
  let docTaxMode: 'INTRA_STATE' | 'INTER_STATE' | null = null;

  const baseSubtotal =
    taxableSumNorm.value ||
    subtotalNorm.value ||
    (grandTotalNorm.value !== null && totalTaxNorm.value !== null && grandTotalNorm.value > totalTaxNorm.value
      ? grandTotalNorm.value - totalTaxNorm.value
      : null);

  if (baseSubtotal && baseSubtotal > 0) {
    if (cgstSumNorm.value !== null && cgstSumNorm.value > 0) {
      const derivedCgst = Math.round((cgstSumNorm.value / baseSubtotal) * 10000) / 100;
      if (docCgstRate === null) {
        docCgstRate = derivedCgst;
      } else if (Math.abs(docCgstRate - derivedCgst) > 0.5) {
        // Amount vs Rate confusion safeguard (e.g. 20% vs 20,475 / 227,500 = 9%)
        console.warn(
          `[Tax Consistency] Extracted CGST rate ${docCgstRate}% contradicts amount ₹${cgstSumNorm.value} / subtotal ₹${baseSubtotal} (${derivedCgst}%). Overriding with mathematically consistent rate.`
        );
        docCgstRate = derivedCgst;
      }
    }
    if (sgstSumNorm.value !== null && sgstSumNorm.value > 0) {
      const derivedSgst = Math.round((sgstSumNorm.value / baseSubtotal) * 10000) / 100;
      if (docSgstRate === null) {
        docSgstRate = derivedSgst;
      } else if (Math.abs(docSgstRate - derivedSgst) > 0.5) {
        console.warn(
          `[Tax Consistency] Extracted SGST rate ${docSgstRate}% contradicts amount ₹${sgstSumNorm.value} / subtotal ₹${baseSubtotal} (${derivedSgst}%). Overriding with mathematically consistent rate.`
        );
        docSgstRate = derivedSgst;
      }
    }
    if (igstSumNorm.value !== null && igstSumNorm.value > 0) {
      const derivedIgst = Math.round((igstSumNorm.value / baseSubtotal) * 10000) / 100;
      if (docIgstRate === null) {
        docIgstRate = derivedIgst;
      } else if (Math.abs(docIgstRate - derivedIgst) > 0.5) {
        console.warn(
          `[Tax Consistency] Extracted IGST rate ${docIgstRate}% contradicts amount ₹${igstSumNorm.value} / subtotal ₹${baseSubtotal} (${derivedIgst}%). Overriding with mathematically consistent rate.`
        );
        docIgstRate = derivedIgst;
      }
    }
  }

  // Intra-state symmetry: In Indian GST, CGST and SGST rates are identical
  if (docCgstRate !== null && docSgstRate === null && (!docIgstRate || docIgstRate === 0)) {
    docSgstRate = docCgstRate;
  } else if (docSgstRate !== null && docCgstRate === null && (!docIgstRate || docIgstRate === 0)) {
    docCgstRate = docSgstRate;
  }

  if (docIgstRate !== null && docIgstRate > 0) {
    docGstRate = docIgstRate;
    docTaxMode = 'INTER_STATE';
  } else if (docCgstRate !== null && docSgstRate !== null) {
    docGstRate = Math.round((docCgstRate + docSgstRate) * 100) / 100;
    docTaxMode = 'INTRA_STATE';
  } else if (baseSubtotal && baseSubtotal > 0 && totalTaxNorm.value !== null && totalTaxNorm.value > 0) {
    docGstRate = Math.round((totalTaxNorm.value / baseSubtotal) * 10000) / 100;
    docTaxMode = 'INTRA_STATE';
    docCgstRate = Math.round((docGstRate / 2) * 100) / 100;
    docSgstRate = Math.round((docGstRate / 2) * 100) / 100;
  }

  // --- Phase 5.13: GST Rate Halving Guard ---
  // In Indian GST, CGST rate = SGST rate = combined_rate / 2.
  // Valid combined Indian GST rates: 0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 12, 18, 28.
  // AI models frequently put the COMBINED rate (e.g. 18%) into BOTH cgstRate AND sgstRate fields,
  // making docGstRate = 36% — which is NOT a valid Indian GST rate.
  // Baseline Phase 5.12A: this pattern caused 65 GST_RATE_ERROR and 40 TAX_MODE_ERROR occurrences.
  // Detection: combined(cgstRate + sgstRate) ∉ valid set, but combined/2 ∈ valid set.
  // Correction: halve rates AND recompute amounts so the EXCLUSIVE/INCLUSIVE detection stays accurate.
  if (
    docCgstRate !== null && docSgstRate !== null &&
    docCgstRate > 0 && Math.abs(docCgstRate - docSgstRate) < 0.05 && // symmetric: CGST ≈ SGST
    docGstRate !== null && docGstRate > 0 &&
    (!docIgstRate || docIgstRate === 0) && // only for intra-state (CGST+SGST) mode
    baseSubtotal && baseSubtotal > 0
  ) {
    const VALID_COMBINED_GST = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 12, 18, 28];
    const isValidCombined = (r: number) => VALID_COMBINED_GST.some(v => Math.abs(v - r) < 0.05);
    const halfCombined = Math.round((docGstRate / 2) * 100) / 100;

    if (!isValidCombined(docGstRate) && isValidCombined(halfCombined)) {
      const originalCgst = docCgstRate;
      const originalCombined = docGstRate;

      docCgstRate = Math.round((originalCgst / 2) * 100) / 100;
      docSgstRate = Math.round((originalCgst / 2) * 100) / 100;
      docGstRate = Math.round((docCgstRate + docSgstRate) * 100) / 100;

      // Recompute amounts proportionally from the corrected rate × baseSubtotal.
      // This is necessary for the EXCLUSIVE/INCLUSIVE tax mode detection below to work correctly:
      // expectedExclusiveGrand = baseSubtotal + (correctedCgstAmt + correctedSgstAmt) must ≈ grandTotal.
      if (cgstSumNorm.value !== null && cgstSumNorm.value > 0) {
        const newCgstAmt = Math.round((docCgstRate / 100) * baseSubtotal * 100) / 100;
        const newSgstAmt = Math.round((docSgstRate / 100) * baseSubtotal * 100) / 100;
        cgstSumNorm = {
          value: newCgstAmt,
          warning: `Phase 5.13 halving: combined ${originalCombined}% → ${docGstRate}%; amount corrected.`,
        };
        sgstSumNorm = {
          value: newSgstAmt,
          warning: `Phase 5.13 halving: combined ${originalCombined}% → ${docGstRate}%; amount corrected.`,
        };
        totalTaxNorm = {
          value: Math.round((newCgstAmt + newSgstAmt) * 100) / 100,
          warning: null,
        };
      }

      console.warn(
        `[Phase 5.13 GST Halving] Combined ${originalCombined}% (CGST=${originalCgst}%+SGST=${originalCgst}%) is not a valid Indian GST rate. ` +
        `Corrected: CGST=${docCgstRate}%+SGST=${docSgstRate}%=combined ${docGstRate}%.`
      );
    }
  }

  // Phase 5.12 Section 10: Deterministic GST Inclusive vs Exclusive Detection
  let docTaxInclusionMode: 'EXCLUSIVE' | 'INCLUSIVE' | 'UNKNOWN' = 'EXCLUSIVE';
  const computedTaxTotal = totalTaxNorm.value ?? ((cgstSumNorm.value || 0) + (sgstSumNorm.value || 0) + (igstSumNorm.value || 0));
  if (baseSubtotal && baseSubtotal > 0 && grandTotalNorm.value !== null && grandTotalNorm.value > 0) {
    const expectedExclusiveGrand = Math.round((baseSubtotal + computedTaxTotal) * 100) / 100;
    const printedGrand = grandTotalNorm.value;

    if (Math.abs(expectedExclusiveGrand - printedGrand) <= 2.0) {
      docTaxInclusionMode = 'EXCLUSIVE';
    } else if (computedTaxTotal > 0 && Math.abs(baseSubtotal - printedGrand) <= 2.0) {
      docTaxInclusionMode = 'INCLUSIVE';
    } else {
      docTaxInclusionMode = 'UNKNOWN';
    }
  }

  const summary = {
    subtotal: createExtractedField(subtotalNorm.value, { warning: subtotalNorm.warning }),
    totalDiscount: createExtractedField(totalDiscNorm.value, { warning: totalDiscNorm.warning }),
    taxableAmount: createExtractedField(taxableSumNorm.value, { warning: taxableSumNorm.warning }),
    cgstRate: createExtractedField(docCgstRate ?? cgstRateNorm.value, { warning: cgstRateNorm.warning }),
    cgstAmount: createExtractedField(cgstSumNorm.value, { warning: cgstSumNorm.warning }),
    sgstRate: createExtractedField(docSgstRate ?? sgstRateNorm.value, { warning: sgstRateNorm.warning }),
    sgstAmount: createExtractedField(sgstSumNorm.value, { warning: sgstSumNorm.warning }),
    igstRate: createExtractedField(docIgstRate ?? igstRateNorm.value, { warning: igstRateNorm.warning }),
    igstAmount: createExtractedField(igstSumNorm.value, { warning: igstSumNorm.warning }),
    cessAmount: createExtractedField(cessSumNorm.value, { warning: cessSumNorm.warning }),
    totalTax: createExtractedField(totalTaxNorm.value, { warning: totalTaxNorm.warning }),
    roundOff: createExtractedField(roundOffNorm.value, { warning: roundOffNorm.warning }),
    grandTotal: createExtractedField(grandTotalNorm.value, { warning: grandTotalNorm.warning }),
    amountPaid: createExtractedField(amountPaidNorm.value, { warning: amountPaidNorm.warning }),
    balanceDue: createExtractedField(balanceDueNorm.value, { warning: balanceDueNorm.warning }),
    taxExtractionStatus: (docTaxInclusionMode !== 'UNKNOWN' && (docCgstRate !== null || docGstRate !== null) ? 'VERIFIED' : 'DERIVED') as 'VERIFIED' | 'DERIVED',
  };

  // --- LINE ITEMS & TAX PROVENANCE RESOLUTION (Phase 5.12) ---
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  // 1. Evaluate document-level tax from summary
  const hasDocTax =
    (docGstRate !== null && docGstRate > 0) ||
    (totalTaxNorm.value !== null && totalTaxNorm.value > 0) ||
    (cgstSumNorm.value !== null && cgstSumNorm.value > 0) ||
    (sgstSumNorm.value !== null && sgstSumNorm.value > 0) ||
    (igstSumNorm.value !== null && igstSumNorm.value > 0);

  // 2. Pre-evaluate raw line taxes returned by AI vision model
  let sumRawLineTax = 0;
  let rawLineRatesDifferFromDoc = false;
  let hasAnyRawLineTax = false;

  for (const it of rawItems) {
    const q = normalizeNumeric(it.quantity).value ?? 1;
    const p = normalizeNumeric(it.unitPrice ?? (it as any).rate ?? (it as any).unitRate ?? (it as any).price).value ?? 0;
    const d = normalizeNumeric(it.discountAmount ?? (it as any).discount_amount).value ?? 0;
    const taxable = Math.max(0, q * p - d);
    const rGst = normalizePercentage(it.gstRate ?? (it as any).taxRate ?? (it as any).tax_rate).value;
    const rCgst = normalizePercentage(it.cgstRate ?? (it as any).cgst_rate).value;
    const rSgst = normalizePercentage(it.sgstRate ?? (it as any).sgst_rate).value;
    const rIgst = normalizePercentage(it.igstRate ?? (it as any).igst_rate).value;
    const lineCombinedRate = rIgst ?? (rCgst !== null && rSgst !== null ? Math.round((rCgst + rSgst) * 100) / 100 : rGst);

    if (lineCombinedRate !== null && lineCombinedRate > 0) {
      hasAnyRawLineTax = true;
      sumRawLineTax += Math.round((taxable * (lineCombinedRate / 100)) * 100) / 100;
      if (docGstRate !== null && Math.abs(lineCombinedRate - docGstRate) > 0.05) {
        rawLineRatesDifferFromDoc = true;
      }
    }
  }

  // 3. Document Evidence vs AI Hallucination Evaluation (Phase 5.12 Sections 2-5)
  // AI-returned value != document evidence.
  // When invoice contains document-level tax (e.g. CGST 9% + SGST 9% = 18%), and:
  // - table has no GST column (raw.hasLineTaxColumn === false), OR
  // - raw line rates differ from document tax (e.g. 25% or 14% vs 18%) AND the sum of line taxes
  //   fails to match printed summary total tax (diverges by > ₹1.00)
  // -> Line rates are AI hallucinations/inferences, NOT document evidence!
  // -> hasLineLevelTax = false, document tax is authoritative!
  let hasLineLevelTax = false;
  if (hasAnyRawLineTax) {
    if ((raw as any).hasLineTaxColumn === false) {
      hasLineLevelTax = false;
    } else if (hasDocTax && rawLineRatesDifferFromDoc) {
      const summaryTax = totalTaxNorm.value ?? (docGstRate && baseSubtotal ? (baseSubtotal * docGstRate) / 100 : 0);
      const isSumConsistent = Math.abs(sumRawLineTax - summaryTax) <= 1.0;
      hasLineLevelTax = isSumConsistent;
    } else if (!hasDocTax) {
      hasLineLevelTax = true;
    } else {
      // Lines match docGstRate -> uniform document tax applies
      hasLineLevelTax = false;
    }
  }

  const docTaxSource: TaxSource = hasLineLevelTax
    ? 'INVOICE_LINE_EXTRACTED'
    : hasDocTax
    ? 'INVOICE_DOCUMENT_EXTRACTED'
    : 'NOT_SPECIFIED';

  // 4. Decimal Shift & Line Subtotal Reconciliation (Phase 5.12 Sections 16, 17, 18)
  // When an AI model drops decimal points (e.g. Rate 7.50 scanned as 750 -> 1000 × 750 = 750,000 instead of 7,500),
  // line totals explode (e.g. ₹9,70,000 instead of ₹2,27,500). Reconcile individual lines against printed subtotal.
  if (baseSubtotal && baseSubtotal > 0 && rawItems.length > 0) {
    const rawLineTotals = rawItems.map((it) => {
      const q = normalizeNumeric(it.quantity).value ?? 1;
      const p = normalizeNumeric(it.unitPrice ?? (it as any).rate ?? (it as any).unitRate ?? (it as any).price).value ?? 0;
      const t = normalizeNumeric(it.lineTotal ?? (it as any).amount ?? (it as any).lineAmount ?? (it as any).totalAmount).value ?? (q * p);
      return { q, p, t };
    });

    const sumTotals = rawLineTotals.reduce((acc, curr) => acc + curr.t, 0);

    if (Math.abs(sumTotals - baseSubtotal) > 1.0) {
      for (let i = 0; i < rawItems.length; i++) {
        const item = rawItems[i];
        const lineInfo = rawLineTotals[i];
        const sumOtherLines = sumTotals - lineInfo.t;
        const requiredLineTotal = Math.round((baseSubtotal - sumOtherLines) * 100) / 100;

        if (requiredLineTotal > 0) {
          const ratios = [100, 10, 1000, 0.1, 0.01];
          for (const ratio of ratios) {
            if (Math.abs(lineInfo.t / ratio - requiredLineTotal) <= 1.0) {
              console.warn(
                `[Subtotal Reconciler] Line ${i + 1} ('${item.description}'): detected ${ratio}x decimal shift. Line total ${lineInfo.t} corrected to ${requiredLineTotal}.`
              );
              item.lineTotal = requiredLineTotal;
              item.taxableAmount = requiredLineTotal;
              if (lineInfo.q > 0) {
                const correctedPrice = Math.round((requiredLineTotal / lineInfo.q) * 10000) / 10000;
                item.unitPrice = correctedPrice;
              }
              break;
            }
          }
        }
      }
    }
  }

  const items: IExtractedLineItem[] = rawItems.map((it, idx) => {
    const lineNum = typeof it.lineNumber === 'number' ? it.lineNumber : idx + 1;
    const pageNum = typeof it.pageNumber === 'number' ? it.pageNumber : 1;
    const bbox = normalizeBoundingBox(it.bbox, pageNum);

    const qtyNorm = normalizeNumeric(it.quantity);
    const rawPrice = it.unitPrice ?? (it as any).rate ?? (it as any).unitRate ?? (it as any).price;
    const rawTotal = it.lineTotal ?? (it as any).amount ?? (it as any).lineAmount ?? (it as any).totalAmount;

    let unitPriceNorm = normalizeNumeric(rawPrice);
    const lineTotalNorm = normalizeNumeric(rawTotal);

    // Rate vs Amount disambiguation & Decimal point drop correction (Sections 17 & 18):
    if (
      qtyNorm.value !== null &&
      qtyNorm.value > 0 &&
      unitPriceNorm.value !== null &&
      lineTotalNorm.value !== null
    ) {
      const expectedTotal = qtyNorm.value * unitPriceNorm.value;
      const printedTotal = lineTotalNorm.value;
      const expectedUnitPrice = Math.round((printedTotal / qtyNorm.value) * 100) / 100;

      // 1. Rate was mistakenly assigned the line total
      if (qtyNorm.value > 1 && Math.abs(unitPriceNorm.value - printedTotal) < 0.05) {
        unitPriceNorm = { value: expectedUnitPrice, warning: null };
      }
      // 2. OCR dropped decimal point (e.g. 7.50 scanned as 750 or 75)
      else if (
        Math.abs(expectedTotal - printedTotal) > 1.0 &&
        (Math.abs(unitPriceNorm.value - expectedUnitPrice * 100) < 0.1 ||
         Math.abs(unitPriceNorm.value - expectedUnitPrice * 10) < 0.1 ||
         Math.abs(unitPriceNorm.value - expectedUnitPrice * 1000) < 0.1)
      ) {
        console.warn(
          `[Decimal Correction] Line ${lineNum} ('${it.description}'): rate ${unitPriceNorm.value} with qty ${qtyNorm.value} contradicted printed line total ${printedTotal}. Corrected decimal placement to ${expectedUnitPrice}.`
        );
        unitPriceNorm = { value: expectedUnitPrice, warning: null };
      }
    }

    const discPctNorm = normalizePercentage(it.discountPercent ?? (it as any).discount_percent);
    const discAmtNorm = normalizeNumeric(it.discountAmount ?? (it as any).discount_amount);
    const taxableNorm = normalizeNumeric(it.taxableAmount ?? (it as any).taxable_amount);
    const gstRateNorm = normalizePercentage(it.gstRate ?? (it as any).taxRate ?? (it as any).tax_rate);
    const cgstRateNorm = normalizePercentage(it.cgstRate ?? (it as any).cgst_rate);
    const cgstAmtNorm = normalizeNumeric(it.cgstAmount ?? (it as any).cgst ?? (it as any).cgst_amount);
    const sgstRateNorm = normalizePercentage(it.sgstRate ?? (it as any).sgst_rate);
    const sgstAmtNorm = normalizeNumeric(it.sgstAmount ?? (it as any).sgst ?? (it as any).sgst_amount);
    const igstRateNorm = normalizePercentage(it.igstRate ?? (it as any).igst_rate);
    const igstAmtNorm = normalizeNumeric(it.igstAmount ?? (it as any).igst ?? (it as any).igst_amount);
    const cessRateNorm = normalizePercentage(it.cessRate ?? (it as any).cess_rate);
    const cessAmtNorm = normalizeNumeric(it.cessAmount ?? (it as any).cess ?? (it as any).cess_amount);

    const hasRawLineTax =
      (gstRateNorm.value !== null && gstRateNorm.value > 0) ||
      (cgstRateNorm.value !== null && cgstRateNorm.value > 0) ||
      (sgstRateNorm.value !== null && sgstRateNorm.value > 0) ||
      (igstRateNorm.value !== null && igstRateNorm.value > 0);

    let finalGstRate: number | null = null;
    let finalCgstRate: number | null = null;
    let finalSgstRate: number | null = null;
    let finalIgstRate: number | null = null;
    let finalTaxMode: 'EXCLUSIVE' | 'INCLUSIVE' = docTaxInclusionMode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE';
    let finalTaxSource: TaxSource = 'NOT_SPECIFIED';

    if (hasLineLevelTax && hasRawLineTax) {
      // Priority 2: Genuine explicit line-level GST actually printed on invoice
      finalTaxSource = 'INVOICE_LINE_EXTRACTED';
      finalGstRate = gstRateNorm.value;
      finalCgstRate = cgstRateNorm.value;
      finalSgstRate = sgstRateNorm.value;
      finalIgstRate = igstRateNorm.value;
      if (finalIgstRate !== null && finalIgstRate > 0) {
        finalGstRate = finalIgstRate;
      } else if (finalCgstRate !== null && finalSgstRate !== null) {
        finalGstRate = Math.round((finalCgstRate + finalSgstRate) * 100) / 100;
      } else if (finalGstRate !== null && finalGstRate > 0) {
        finalCgstRate = Math.round((finalGstRate / 2) * 100) / 100;
        finalSgstRate = Math.round((finalGstRate / 2) * 100) / 100;
      }
    } else if (hasDocTax && docGstRate !== null && docGstRate > 0) {
      // Priority 3: Authoritative document-level tax printed on invoice (e.g. CGST 9% + SGST 9% = 18%)
      // All taxable lines inherit document tax; hallucinated line rates are rejected
      finalTaxSource = 'INVOICE_DOCUMENT_EXTRACTED';
      finalGstRate = docGstRate;
      if (docTaxMode === 'INTER_STATE') {
        finalIgstRate = docIgstRate ?? docGstRate;
        finalCgstRate = null;
        finalSgstRate = null;
      } else {
        finalCgstRate = docCgstRate ?? (docGstRate / 2);
        finalSgstRate = docSgstRate ?? (docGstRate / 2);
        finalIgstRate = null;
      }
    } else {
      finalTaxSource = 'NOT_SPECIFIED';
    }

    const qty = qtyNorm.value ?? 1;
    const price = unitPriceNorm.value ?? 0;
    const disc = discAmtNorm.value ?? 0;
    const isInclusive = finalTaxMode === 'INCLUSIVE' || docTaxInclusionMode === 'INCLUSIVE';
    const effectiveRate = finalGstRate ?? ((finalCgstRate || 0) + (finalSgstRate || 0) + (finalIgstRate || 0));
    const grossLine = Math.max(0, qty * price - disc);
    const calcTaxable = isInclusive && effectiveRate > 0
      ? Math.round((grossLine * 100 / (100 + effectiveRate)) * 100) / 100
      : grossLine;
    const lineTaxable =
      taxableNorm.value !== null && Math.abs(taxableNorm.value - calcTaxable) <= 1.0
        ? taxableNorm.value
        : calcTaxable;

    let calcCgstAmt: number | null = null;
    let calcSgstAmt: number | null = null;
    let calcIgstAmt: number | null = null;

    if (
      finalTaxSource === 'INVOICE_DOCUMENT_EXTRACTED' ||
      finalTaxSource === 'INVOICE_LINE_EXTRACTED'
    ) {
      if (finalIgstRate !== null && finalIgstRate > 0) {
        calcIgstAmt = Math.round((lineTaxable * (finalIgstRate / 100)) * 100) / 100;
      } else if (finalGstRate !== null && finalGstRate > 0) {
        const cRate = finalCgstRate ?? (finalGstRate / 2);
        const sRate = finalSgstRate ?? (finalGstRate / 2);
        calcCgstAmt = Math.round((lineTaxable * (cRate / 100)) * 100) / 100;
        calcSgstAmt = Math.round((lineTaxable * (sRate / 100)) * 100) / 100;
      }
    }

    // Section 21: Safe development debug tax trace logging
    console.log('[DEBUG TAX TRACE]', {
      lineNumber: lineNum,
      description: cleanStr(it.description),
      rawCgstRate: cgstRateNorm.value,
      rawCgstAmount: cgstAmtNorm.value,
      rawSgstRate: sgstRateNorm.value,
      rawSgstAmount: sgstAmtNorm.value,
      normalizedCgstRate: finalCgstRate,
      normalizedCgstAmount: calcCgstAmt,
      normalizedSgstRate: finalSgstRate,
      normalizedSgstAmount: calcSgstAmt,
      derivedGstRate: finalGstRate,
      taxMode: finalTaxMode,
      taxSource: finalTaxSource,
    });

    return {
      id: `line_${lineNum}_${Date.now()}_${idx}`,
      lineNumber: lineNum,
      description: createExtractedField(cleanStr(it.description), { bbox }),
      skuOrCode: createExtractedField(cleanStr(it.skuOrCode), { bbox }),
      hsnSac: createExtractedField(cleanStr(it.hsnSac), { bbox }),
      quantity: createExtractedField(qtyNorm.value, { bbox, warning: qtyNorm.warning }),
      unit: createExtractedField(cleanStr(it.unit), { bbox }),
      unitPrice: createExtractedField(unitPriceNorm.value, { bbox, warning: unitPriceNorm.warning }),
      discountPercent: createExtractedField(discPctNorm.value, { bbox, warning: discPctNorm.warning }),
      discountAmount: createExtractedField(discAmtNorm.value, { bbox, warning: discAmtNorm.warning }),
      taxableAmount: createExtractedField(taxableNorm.value ?? calcTaxable, { bbox, warning: taxableNorm.warning }),
      gstRate: createExtractedField(finalGstRate, { bbox, warning: gstRateNorm.warning }),
      cgstRate: createExtractedField(finalCgstRate, { bbox, warning: cgstRateNorm.warning }),
      cgstAmount: createExtractedField(calcCgstAmt, { bbox, warning: cgstAmtNorm.warning }),
      sgstRate: createExtractedField(finalSgstRate, { bbox, warning: sgstRateNorm.warning }),
      sgstAmount: createExtractedField(calcSgstAmt, { bbox, warning: sgstAmtNorm.warning }),
      igstRate: createExtractedField(finalIgstRate, { bbox, warning: igstRateNorm.warning }),
      igstAmount: createExtractedField(calcIgstAmt, { bbox, warning: igstAmtNorm.warning }),
      cessRate: createExtractedField(cessRateNorm.value, { bbox, warning: cessRateNorm.warning }),
      cessAmount: createExtractedField(cessAmtNorm.value, { bbox, warning: cessAmtNorm.warning }),
      lineTotal: createExtractedField(lineTotalNorm.value, { bbox, warning: lineTotalNorm.warning }),
      taxMode: finalTaxMode,
      taxSource: finalTaxSource,
    };
  });

  // --- PAYMENT ---
  const pay = raw.payment || {};
  let validPayMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT' | 'OTHER' | null = null;
  if (pay.paymentMode) {
    const modeUpper = pay.paymentMode.toUpperCase().trim();
    if (['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT', 'OTHER'].includes(modeUpper)) {
      validPayMode = modeUpper as any;
    } else {
      validPayMode = 'OTHER';
    }
  }

  const payment = {
    paymentMode: createExtractedField(validPayMode),
    bankName: createExtractedField(cleanStr(pay.bankName)),
    bankAccountNumber: createExtractedField(cleanStr(pay.bankAccountNumber)),
    bankIfsc: createExtractedField(cleanStr(pay.bankIfsc)),
    upiId: createExtractedField(cleanStr(pay.upiId)),
    transactionReference: createExtractedField(cleanStr(pay.transactionReference)),
  };

  // --- ADDITIONAL ---
  const add = raw.additional || {};
  const additional = {
    notes: createExtractedField(cleanStr(add.notes)),
    termsAndConditions: createExtractedField(cleanStr(add.termsAndConditions)),
    vehicleNumber: createExtractedField(cleanStr(add.vehicleNumber)),
  };

  const totalGstAmount =
    totalTaxNorm.value ??
    ((cgstSumNorm.value || 0) + (sgstSumNorm.value || 0) + (igstSumNorm.value || 0));

  const taxMetadata: IDocumentTaxMetadata = {
    mode: docTaxMode ?? 'INTRA_STATE',
    hasDocumentTax: hasDocTax,
    hasLineLevelTax,
    cgstRate: docCgstRate,
    cgstAmount: cgstSumNorm.value,
    sgstRate: docSgstRate,
    sgstAmount: sgstSumNorm.value,
    igstRate: docIgstRate,
    igstAmount: igstSumNorm.value,
    totalGstRate: docGstRate,
    totalGstAmount: totalGstAmount > 0 ? totalGstAmount : null,
    taxInclusionMode: docTaxInclusionMode,
    source: docTaxSource,
    evidenceType: hasDocTax ? 'DOCUMENT_SUMMARY' : hasLineLevelTax ? 'LINE_ITEMS' : 'NONE',
  };

  return {
    supplier,
    buyer,
    invoice,
    items,
    summary,
    payment,
    additional,
    tax: taxMetadata,
  };
}

function cleanStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str.length > 0 ? str : null;
}
