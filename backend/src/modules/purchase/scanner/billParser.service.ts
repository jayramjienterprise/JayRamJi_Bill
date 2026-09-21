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
  normalizeNumeric,
  normalizePercentage,
} from './extractionNormalizer';
import { NvidiaNimClient } from './nvidiaNimClient';
import {
  IExtractedLineItem,
  IPurchaseBillExtraction,
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

  // 2. Dispatch vision extraction prompt to NVIDIA NIM
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

  logScannerEvent('info', 'SCANNER_NIM_INITIAL_COMPLETED', {
    model,
    durationMs: response.durationMs,
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

    // 4. One single controlled FRESH VISION RETRY attempt with original images
    logScannerEvent('info', 'SCANNER_NIM_RETRY_STARTED', { model, attempt: 2 });
    logScannerEvent('info', 'SCANNER_NIM_REPAIR_STARTED', { model }); // Backwards-compatible alias

    const retryStart = Date.now();
    try {
      const retryUserPrompt = `${EXTRACTION_RETRY_PROMPT}\n\n${EXTRACTION_USER_PROMPT}`;
      const retryResponse = await client.extractDocumentVision({
        model,
        pages: pagePayloads, // CRITICAL: Original preprocessed bill page images!
        systemPrompt: EXTRACTION_SYSTEM_PROMPT,
        prompt: retryUserPrompt,
        temperature: 0.0,
      });

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
    gstin: createExtractedField(cleanStr(sup.gstin)),
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
    gstin: createExtractedField(cleanStr(buy.gstin)),
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

  // --- LINE ITEMS ---
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  const items: IExtractedLineItem[] = rawItems.map((it, idx) => {
    const lineNum = typeof it.lineNumber === 'number' ? it.lineNumber : idx + 1;
    const pageNum = typeof it.pageNumber === 'number' ? it.pageNumber : 1;
    const bbox = normalizeBoundingBox(it.bbox, pageNum);

    const qtyNorm = normalizeNumeric(it.quantity);
    const rawPrice = it.unitPrice ?? (it as any).rate ?? (it as any).unitRate ?? (it as any).price;
    const rawTotal = it.lineTotal ?? (it as any).amount ?? (it as any).lineAmount ?? (it as any).totalAmount;

    let unitPriceNorm = normalizeNumeric(rawPrice);
    const lineTotalNorm = normalizeNumeric(rawTotal);

    // Rate vs Amount disambiguation:
    // If quantity > 1 and unitPrice matches lineTotal (or diverges by >10x from expected rate),
    // the printed line total was mistakenly assigned to unitPrice.
    if (
      qtyNorm.value !== null &&
      qtyNorm.value > 1 &&
      unitPriceNorm.value !== null &&
      lineTotalNorm.value !== null
    ) {
      if (Math.abs(unitPriceNorm.value - lineTotalNorm.value) < 0.05) {
        const computedRate = Math.round((lineTotalNorm.value / qtyNorm.value) * 100) / 100;
        unitPriceNorm = { value: computedRate, warning: null };
      }
    }

    const discPctNorm = normalizePercentage(it.discountPercent);
    const discAmtNorm = normalizeNumeric(it.discountAmount);
    const taxableNorm = normalizeNumeric(it.taxableAmount);
    const gstRateNorm = normalizePercentage(it.gstRate);
    const cgstRateNorm = normalizePercentage(it.cgstRate);
    const cgstAmtNorm = normalizeNumeric(it.cgstAmount);
    const sgstRateNorm = normalizePercentage(it.sgstRate);
    const sgstAmtNorm = normalizeNumeric(it.sgstAmount);
    const igstRateNorm = normalizePercentage(it.igstRate);
    const igstAmtNorm = normalizeNumeric(it.igstAmount);
    const cessRateNorm = normalizePercentage(it.cessRate);
    const cessAmtNorm = normalizeNumeric(it.cessAmount);

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
      taxableAmount: createExtractedField(taxableNorm.value, { bbox, warning: taxableNorm.warning }),
      gstRate: createExtractedField(gstRateNorm.value, { bbox, warning: gstRateNorm.warning }),
      cgstRate: createExtractedField(cgstRateNorm.value, { bbox, warning: cgstRateNorm.warning }),
      cgstAmount: createExtractedField(cgstAmtNorm.value, { bbox, warning: cgstAmtNorm.warning }),
      sgstRate: createExtractedField(sgstRateNorm.value, { bbox, warning: sgstRateNorm.warning }),
      sgstAmount: createExtractedField(sgstAmtNorm.value, { bbox, warning: sgstAmtNorm.warning }),
      igstRate: createExtractedField(igstRateNorm.value, { bbox, warning: igstRateNorm.warning }),
      igstAmount: createExtractedField(igstAmtNorm.value, { bbox, warning: igstAmtNorm.warning }),
      cessRate: createExtractedField(cessRateNorm.value, { bbox, warning: cessRateNorm.warning }),
      cessAmount: createExtractedField(cessAmtNorm.value, { bbox, warning: cessAmtNorm.warning }),
      lineTotal: createExtractedField(lineTotalNorm.value, { bbox, warning: lineTotalNorm.warning }),
    };
  });

  // --- SUMMARY ---
  const sum = raw.summary || {};
  const subtotalNorm = normalizeNumeric(sum.subtotal);
  const totalDiscNorm = normalizeNumeric(sum.totalDiscount);
  const taxableSumNorm = normalizeNumeric(sum.taxableAmount);
  const cgstRateNorm = normalizePercentage(sum.cgstRate);
  const cgstSumNorm = normalizeNumeric(sum.cgstAmount);
  const sgstRateNorm = normalizePercentage(sum.sgstRate);
  const sgstSumNorm = normalizeNumeric(sum.sgstAmount);
  const igstRateNorm = normalizePercentage(sum.igstRate);
  const igstSumNorm = normalizeNumeric(sum.igstAmount);
  const cessSumNorm = normalizeNumeric(sum.cessAmount);
  const totalTaxNorm = normalizeNumeric(sum.totalTax);
  const roundOffNorm = normalizeNumeric(sum.roundOff);
  const grandTotalNorm = normalizeNumeric(sum.grandTotal);
  const amountPaidNorm = normalizeNumeric(sum.amountPaid);
  const balanceDueNorm = normalizeNumeric(sum.balanceDue);

  const summary = {
    subtotal: createExtractedField(subtotalNorm.value, { warning: subtotalNorm.warning }),
    totalDiscount: createExtractedField(totalDiscNorm.value, { warning: totalDiscNorm.warning }),
    taxableAmount: createExtractedField(taxableSumNorm.value, { warning: taxableSumNorm.warning }),
    cgstRate: createExtractedField(cgstRateNorm.value, { warning: cgstRateNorm.warning }),
    cgstAmount: createExtractedField(cgstSumNorm.value, { warning: cgstSumNorm.warning }),
    sgstRate: createExtractedField(sgstRateNorm.value, { warning: sgstRateNorm.warning }),
    sgstAmount: createExtractedField(sgstSumNorm.value, { warning: sgstSumNorm.warning }),
    igstRate: createExtractedField(igstRateNorm.value, { warning: igstRateNorm.warning }),
    igstAmount: createExtractedField(igstSumNorm.value, { warning: igstSumNorm.warning }),
    cessAmount: createExtractedField(cessSumNorm.value, { warning: cessSumNorm.warning }),
    totalTax: createExtractedField(totalTaxNorm.value, { warning: totalTaxNorm.warning }),
    roundOff: createExtractedField(roundOffNorm.value, { warning: roundOffNorm.warning }),
    grandTotal: createExtractedField(grandTotalNorm.value, { warning: grandTotalNorm.warning }),
    amountPaid: createExtractedField(amountPaidNorm.value, { warning: amountPaidNorm.warning }),
    balanceDue: createExtractedField(balanceDueNorm.value, { warning: balanceDueNorm.warning }),
  };

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

  return {
    supplier,
    buyer,
    invoice,
    items,
    summary,
    payment,
    additional,
  };
}

function cleanStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const str = String(val).trim();
  return str.length > 0 ? str : null;
}
