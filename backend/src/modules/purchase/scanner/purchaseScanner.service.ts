import { Types } from 'mongoose';
import {
  PurchaseDraft,
  IPurchaseDraft,
  IPurchaseBillExtraction,
  IVendorMatchResult,
  IDraftReconciliation,
} from '../../../database/models/PurchaseDraft';
import { Purchase } from '../../../database/models/Purchase';
import { Product } from '../../../database/models/Product';
import { Vendor } from '../../../database/models/Vendor';
import { InvoiceSequence } from '../../../database/models/InvoiceSequence';
import { executeCreatePurchaseCore } from '../purchase.controller';
import { processReceiving } from '../receiving.controller';
import { preprocessDocument } from './documentPreprocessor';
import { parseBillDocument } from './billParser.service';
import {
  reconcilePurchaseExtraction,
  populateCalculatedLineValues,
} from '../validation/calculationComparator';
import { matchVendor } from '../matching/vendorMatcher';
import { matchProduct } from '../matching/productMatcher';
import {
  editableDraftFieldsSchema,
  EditableDraftFields,
} from '../draft/purchaseDraft.schema';
import * as cloudinaryService from '../../../services/cloudinary';
import { AppError } from '../../../middleware/errorHandler';

import crypto from 'crypto';
import {
  generateScannerCorrelationId,
  hashIdentifier,
  logScannerEvent,
  scannerMetrics,
  ScannerStageDurations,
} from './scannerObservability';

export interface ScanDocumentInput {
  businessId: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  fileBuffer: Buffer;
  fileName: string;
  mimeType: string;
  fileSize: number;
  idempotencyKey?: string | null;
  correlationId?: string;
}

export class PurchaseScannerService {
  /**
   * In-flight operational locking to prevent concurrent duplicate NIM / Cloudinary calls
   */
  private static activeScanLocks = new Map<
    string,
    { promise: Promise<IPurchaseDraft>; fileHash: string }
  >();

  /**
   * Generates a sequential draft number: DRF-YYMM-XXXX
   * Thread-safe and atomic via MongoDB InvoiceSequence model.
   */
  private async generateDraftNumber(businessId: Types.ObjectId | string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const startYear = month >= 4 ? year : year - 1;
    const endYear = (startYear + 1) % 100;
    const fyPrefix = `${startYear.toString().slice(-2)}${endYear.toString().padStart(2, '0')}`;

    const seq = await InvoiceSequence.findOneAndUpdate(
      { businessId: new Types.ObjectId(businessId), key: 'PURCHASE_DRAFT' },
      { $inc: { nextNumber: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const formattedNum = String(seq.nextNumber).padStart(4, '0');
    return `DRF-${fyPrefix}-${formattedNum}`;
  }

  /**
   * Safe cleanup helper for Cloudinary asset in case downstream processing fails.
   */
  private async cleanupCloudinaryAsset(
    publicId: string,
    resourceType: 'image' | 'raw' = 'image'
  ): Promise<void> {
    try {
      if (cloudinaryService.cloudinary?.uploader?.destroy) {
        await cloudinaryService.cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      }
    } catch (cleanupErr: any) {
      console.warn('⚠️ Cloudinary asset cleanup warning:', cleanupErr?.message || cleanupErr);
    }
  }

  /**
   * Full end-to-end scanner orchestration with in-flight duplicate locking.
   *
   * Side-effect guarantee:
   * NEVER creates a Purchase, PurchaseReceipt, or InventoryTransaction.
   * NEVER creates or modifies Vendor or Product records.
   * NEVER alters product stock.
   */
  public async scanAndCreateDraft(input: ScanDocumentInput): Promise<IPurchaseDraft> {
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    const lockKey = idempotencyKey ? `${input.businessId.toString()}:${idempotencyKey}` : null;
    const fileHash = crypto.createHash('sha256').update(input.fileBuffer).digest('hex');

    if (lockKey && PurchaseScannerService.activeScanLocks.has(lockKey)) {
      const activeLock = PurchaseScannerService.activeScanLocks.get(lockKey)!;
      if (activeLock.fileHash !== fileHash) {
        logScannerEvent('warn', 'SCANNER_IDEMPOTENCY_CONFLICT', {
          businessId: input.businessId.toString(),
          idempotencyKeyHash: hashIdentifier(idempotencyKey),
          existingFileHash: activeLock.fileHash,
          newFileHash: fileHash,
          inFlight: true,
        });
        throw new AppError(
          'Idempotency key has already been used for a different bill file. Please initiate a fresh scan with a unique key.',
          409,
          'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_FILE'
        );
      }

      scannerMetrics.recordDuplicateRequest();
      logScannerEvent('info', 'SCANNER_DUPLICATE_REQUEST', {
        businessId: input.businessId.toString(),
        idempotencyKeyHash: hashIdentifier(idempotencyKey),
        inFlight: true,
      });
      return await activeLock.promise;
    }

    const scanPromise = this.executeScanAndCreateDraft(input, fileHash);
    if (lockKey) {
      PurchaseScannerService.activeScanLocks.set(lockKey, { promise: scanPromise, fileHash });
    }

    try {
      return await scanPromise;
    } finally {
      if (lockKey) {
        PurchaseScannerService.activeScanLocks.delete(lockKey);
      }
    }
  }

  /**
   * Core scan processing pipeline with stage-level high-resolution timing.
   */
  private async executeScanAndCreateDraft(
    input: ScanDocumentInput,
    precomputedFileHash?: string
  ): Promise<IPurchaseDraft> {
    const tStart = Date.now();
    const correlationId = input.correlationId || generateScannerCorrelationId();
    const bId = new Types.ObjectId(input.businessId);
    const uId = new Types.ObjectId(input.userId);
    const idempotencyKey = input.idempotencyKey?.trim() || null;
    const fileHash =
      precomputedFileHash || crypto.createHash('sha256').update(input.fileBuffer).digest('hex');

    // 1. Idempotency Check: Return existing draft if already processed for this tenant
    if (idempotencyKey) {
      const existing = await PurchaseDraft.findOne({
        businessId: bId,
        idempotencyKey,
      });
      if (existing) {
        const existingHash = existing.originalFile?.fileHash;
        if (existingHash && existingHash !== fileHash) {
          logScannerEvent('warn', 'SCANNER_IDEMPOTENCY_CONFLICT', {
            correlationId,
            businessId: bId.toString(),
            idempotencyKeyHash: hashIdentifier(idempotencyKey),
            existingDraftId: existing._id.toString(),
            existingFileHash: existingHash,
            newFileHash: fileHash,
          });
          throw new AppError(
            'Idempotency key has already been used for a different bill file. Please initiate a fresh scan with a unique key.',
            409,
            'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_FILE'
          );
        }

        scannerMetrics.recordDuplicateRequest();
        logScannerEvent('info', 'SCANNER_DUPLICATE_REQUEST', {
          correlationId,
          businessId: bId.toString(),
          idempotencyKeyHash: hashIdentifier(idempotencyKey),
          existingDraftId: existing._id.toString(),
        });
        return existing;
      }
    }

    // 2. Document Preprocessing
    const tPreprocessStart = Date.now();
    logScannerEvent('info', 'SCANNER_PREPROCESS_STARTED', {
      correlationId,
      fileName: input.fileName,
      fileSize: input.fileSize,
    });

    const preprocessingResult = await preprocessDocument(input.fileBuffer, input.fileName);
    const preprocessingDurationMs = Date.now() - tPreprocessStart;

    logScannerEvent('info', 'SCANNER_PREPROCESS_COMPLETED', {
      correlationId,
      durationMs: preprocessingDurationMs,
      pageCount: preprocessingResult.pageCount,
    });

    // 3. Upload original document buffer to Cloudinary for permanent audit
    const tCloudinaryStart = Date.now();
    const resourceType = input.mimeType === 'application/pdf' ? 'raw' : 'image';
    const uploadId = `draft_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    let cloudinaryUpload: { public_id: string; secure_url: string };
    try {
      cloudinaryUpload = await cloudinaryService.uploadBufferToCloudinary(input.fileBuffer, {
        folder: 'jayramji/purchase-drafts',
        public_id: uploadId,
        resource_type: resourceType,
      });
    } catch (uploadError: any) {
      throw new AppError(
        `Failed to store original bill document: ${uploadError.message}`,
        502,
        'STORAGE_UPLOAD_FAILED'
      );
    }
    const cloudinaryDurationMs = Date.now() - tCloudinaryStart;

    // 4. NVIDIA NIM Extraction & Structured Normalization
    let extractionResult;
    try {
      extractionResult = await parseBillDocument(preprocessingResult);
    } catch (extractionError: any) {
      // Cloudinary Atomicity: Clean up uploaded asset if extraction fails
      if (cloudinaryUpload?.public_id) {
        await this.cleanupCloudinaryAsset(cloudinaryUpload.public_id, resourceType);
      }
      throw extractionError;
    }

    // 5. Normalization & Deterministic Financial Validation
    const tNormStart = Date.now();
    const normalizedExtraction: IPurchaseBillExtraction = extractionResult.normalizedExtraction;
    const normalizationDurationMs = Date.now() - tNormStart;

    const tValStart = Date.now();
    const reconciliationDetail = reconcilePurchaseExtraction(normalizedExtraction);
    const validation = reconciliationDetail.invoiceValidation;

    // Attach calculated values to line items without mutating printed values
    const lineItemsWithCalculated = populateCalculatedLineValues(
      normalizedExtraction.items,
      validation
    );

    const workingExtraction: IPurchaseBillExtraction = {
      ...normalizedExtraction,
      items: lineItemsWithCalculated,
    };

    // Deep copy immutable rawExtraction
    const rawExtraction: IPurchaseBillExtraction = JSON.parse(
      JSON.stringify(normalizedExtraction)
    );
    const validationDurationMs = Date.now() - tValStart;

    // 6. Vendor Matching
    const tMatchStart = Date.now();
    const vendorMatchExecution = await matchVendor({
      businessId: bId,
      name: normalizedExtraction.supplier?.name?.value,
      gstin: normalizedExtraction.supplier?.gstin?.value,
      pan: normalizedExtraction.supplier?.pan?.value,
      phone: normalizedExtraction.supplier?.phone?.value,
      address: normalizedExtraction.supplier?.address?.value,
      state: normalizedExtraction.supplier?.state?.value,
    });

    const vendorMatch: IVendorMatchResult = {
      matchedVendorId: vendorMatchExecution.matchedVendorId,
      matchedVendorName: vendorMatchExecution.matchedVendorName,
      matchedVendorGstin: vendorMatchExecution.matchedVendorGstin,
      matchingMethod: vendorMatchExecution.matchingMethod,
      confidence: vendorMatchExecution.confidence,
      status: vendorMatchExecution.status,
      alternatives: vendorMatchExecution.alternatives,
    };

    // 7. Product Matching for Line Items
    const cachedProducts = await Product.find({
      businessId: bId,
      active: true,
      deletedAt: null,
    }).lean();

    for (const item of workingExtraction.items) {
      const prodMatch = await matchProduct(
        {
          businessId: bId,
          description: item.description?.value,
          skuOrCode: item.skuOrCode?.value,
          barcode: item.skuOrCode?.value,
          hsnSac: item.hsnSac?.value,
          unit: item.unit?.value,
          quantity: item.quantity?.value,
          unitPrice: item.unitPrice?.value,
        },
        { cachedProducts }
      );

      // Phase 5.4: Strict Matching Tiers
      // Deterministic matches (EXACT_SKU, EXACT_BARCODE, EXACT_NAME) are confirmed VERIFIED.
      // Fuzzy matches (FUZZY_DESCRIPTION, HSN_AND_DESCRIPTION) must NEVER auto-bind; they are strictly SUGGESTIONS.
      const isDeterministic =
        prodMatch.matchingMethod === 'EXACT_SKU' ||
        prodMatch.matchingMethod === 'EXACT_BARCODE' ||
        prodMatch.matchingMethod === 'EXACT_NAME';

      const isFuzzy =
        prodMatch.matchingMethod === 'FUZZY_DESCRIPTION' ||
        prodMatch.matchingMethod === 'HSN_AND_DESCRIPTION';

      const safeAlternatives = [...(prodMatch.alternatives || [])];
      if (isFuzzy && prodMatch.productId && !safeAlternatives.some((a) => a.productId === prodMatch.productId)) {
        safeAlternatives.unshift({
          productId: prodMatch.productId,
          productName: prodMatch.productName || '',
          sku: prodMatch.sku || null,
          score: prodMatch.matchingScore,
        });
      }

      item.productMatch = {
        productId: isDeterministic ? prodMatch.productId : null,
        productName: isDeterministic ? prodMatch.productName : null,
        sku: isDeterministic ? prodMatch.sku : null,
        uom: isDeterministic ? prodMatch.uom : null,
        currentStock: isDeterministic ? prodMatch.currentStock : null,
        lastPurchasePrice: isDeterministic ? prodMatch.lastPurchasePrice : null,
        matchingMethod: prodMatch.matchingMethod,
        confidence: prodMatch.confidence,
        isMatched: isDeterministic && prodMatch.isMatched,
        status: isDeterministic
          ? 'VERIFIED'
          : safeAlternatives.length > 0
          ? 'REVIEW_REQUIRED'
          : 'MISSING',
        alternatives: safeAlternatives,
      };
    }
    const matchingDurationMs = Date.now() - tMatchStart;

    logScannerEvent('info', 'SCANNER_MATCHING_COMPLETED', {
      correlationId,
      durationMs: matchingDurationMs,
      vendorMatched: !!vendorMatch.matchedVendorId,
      lineItemsCount: workingExtraction.items.length,
    });

    // 8. Duplicate Vendor Invoice Warning Check & Date Conflict Surfacing
    const tDupStart = Date.now();
    const discrepancyNotes = [...reconciliationDetail.discrepancyNotes];
    let hasDiscrepancies = reconciliationDetail.hasDiscrepancies;

    const extractedInvoiceNumber = normalizedExtraction.invoice?.invoiceNumber?.value;
    if (vendorMatch.matchedVendorId && extractedInvoiceNumber) {
      const existingPurchase = await Purchase.findOne({
        businessId: bId,
        vendorId: new Types.ObjectId(vendorMatch.matchedVendorId),
        vendorInvoiceNumber: extractedInvoiceNumber.trim(),
        status: { $ne: 'CANCELLED' },
      }).select('_id purchaseNumber vendorInvoiceNumber');

      if (existingPurchase) {
        hasDiscrepancies = true;
        discrepancyNotes.push(
          `DUPLICATE_VENDOR_INVOICE: An active purchase (${existingPurchase.purchaseNumber}) already exists for this vendor and invoice number.`
        );
      }
    }

    // Phase 5.1 Requirement 16: Date Conflict Surfacing
    if (
      normalizedExtraction.invoice?.dateConflict ||
      (normalizedExtraction.invoice?.alternativeDates &&
        normalizedExtraction.invoice.alternativeDates.length > 0)
    ) {
      hasDiscrepancies = true;
      const allDates = [
        normalizedExtraction.invoice?.invoiceDate?.value,
        ...(normalizedExtraction.invoice?.alternativeDates || []),
      ]
        .filter(Boolean)
        .join(', ');
      discrepancyNotes.push(
        `DATE_CONFLICT: Multiple conflicting dates printed on document (${allDates}). Manual review required.`
      );
      if (workingExtraction.invoice?.invoiceDate) {
        workingExtraction.invoice.invoiceDate.status = 'REVIEW_REQUIRED';
        workingExtraction.invoice.invoiceDate.warning =
          'Multiple conflicting dates detected on document. Manual review required.';
      }
    }
    const duplicateCheckDurationMs = Date.now() - tDupStart;

    const reconciliation: IDraftReconciliation = {
      isMathValid: reconciliationDetail.isMathValid,
      hasDiscrepancies,
      discrepancyNotes,
      calculatedSubtotal: reconciliationDetail.calculatedSubtotal,
      calculatedCgstAmount: reconciliationDetail.calculatedCgstAmount,
      calculatedSgstAmount: reconciliationDetail.calculatedSgstAmount,
      calculatedIgstAmount: reconciliationDetail.calculatedIgstAmount,
      calculatedTaxTotal: reconciliationDetail.calculatedTaxTotal,
      calculatedGrandTotal: reconciliationDetail.calculatedGrandTotal,
      taxMode: reconciliationDetail.taxMode,
    };

    // 9. Generate Sequential Draft Number
    const tPersistStart = Date.now();
    const draftNumber = await this.generateDraftNumber(bId);

    // 10. Persist PurchaseDraft with Idempotency Race Protection
    let draft: IPurchaseDraft;
    try {
      draft = await PurchaseDraft.create({
        businessId: bId,
        draftNumber,
        originalFile: {
          fileName: preprocessingResult.originalFileName,
          fileSize: preprocessingResult.fileSizeBytes,
          mimeType: preprocessingResult.originalMimeType,
          fileUrl: cloudinaryUpload.secure_url,
          publicId: cloudinaryUpload.public_id,
          pageCount: preprocessingResult.pageCount,
          previewImages: [],
          fileHash,
        },
        rawExtraction,
        extraction: workingExtraction,
        reconciliation,
        vendorId: vendorMatch.matchedVendorId ? new Types.ObjectId(vendorMatch.matchedVendorId) : null,
        vendorMatch,
        status: 'DRAFT_READY',
        idempotencyKey,
        createdBy: uId,
      });
    } catch (saveError: any) {
      // Catch MongoDB unique constraint race condition on { businessId, idempotencyKey }
      if (saveError?.code === 11000 && idempotencyKey) {
        const winningDraft = await PurchaseDraft.findOne({
          businessId: bId,
          idempotencyKey,
        });
        if (winningDraft) {
          // Clean up this racing redundant upload asset
          if (cloudinaryUpload?.public_id) {
            await this.cleanupCloudinaryAsset(cloudinaryUpload.public_id, resourceType);
          }
          if (winningDraft.originalFile?.fileHash && winningDraft.originalFile.fileHash !== fileHash) {
            logScannerEvent('warn', 'SCANNER_IDEMPOTENCY_CONFLICT', {
              correlationId,
              businessId: bId.toString(),
              idempotencyKeyHash: hashIdentifier(idempotencyKey),
              existingDraftId: winningDraft._id.toString(),
              existingFileHash: winningDraft.originalFile.fileHash,
              newFileHash: fileHash,
            });
            throw new AppError(
              'Idempotency key has already been used for a different bill file. Please initiate a fresh scan with a unique key.',
              409,
              'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_FILE'
            );
          }
          return winningDraft;
        }
      }

      // If persistent save failed for another reason, cleanup uploaded file
      if (cloudinaryUpload?.public_id) {
        await this.cleanupCloudinaryAsset(cloudinaryUpload.public_id, resourceType);
      }
      throw saveError;
    }
    const persistenceDurationMs = Date.now() - tPersistStart;
    const totalDurationMs = Date.now() - tStart;

    // Stage-Level Durations
    const stageDurations: ScannerStageDurations = {
      preprocessing: preprocessingDurationMs,
      cloudinaryUpload: cloudinaryDurationMs,
      nimInitial: extractionResult.metadata?.initialNimDurationMs ?? extractionResult.metadata?.durationMs ?? 0,
      jsonParseInitial: extractionResult.metadata?.initialParseDurationMs ?? 0,
      nimRepair: extractionResult.metadata?.repairNimDurationMs ?? 0,
      jsonParseRepair: extractionResult.metadata?.repairParseDurationMs ?? 0,
      normalization: normalizationDurationMs,
      financialValidation: validationDurationMs,
      matching: matchingDurationMs,
      duplicateInvoiceDetection: duplicateCheckDurationMs,
      draftPersistence: persistenceDurationMs,
      total: totalDurationMs,
    };

    // Record metrics into registry
    scannerMetrics.recordStageLatency('preprocessing', stageDurations.preprocessing);
    scannerMetrics.recordStageLatency('nimInitial', stageDurations.nimInitial);
    if (stageDurations.nimRepair > 0) {
      scannerMetrics.recordStageLatency('nimRepair', stageDurations.nimRepair);
    }
    scannerMetrics.recordStageLatency('matching', stageDurations.matching);
    scannerMetrics.recordStageLatency('draftCreation', stageDurations.draftPersistence);

    // Emit safe structured timing event (without raw content or sensitive keys)
    logScannerEvent('info', 'SCANNER_TIMING', {
      correlationId,
      draftId: draft._id.toString(),
      businessId: bId.toString(),
      durationMs: stageDurations,
    });

    return draft;
  }

  /**
   * Retrieves a draft by ID with strict tenant isolation.
   */
  public async getDraftById(
    businessId: string | Types.ObjectId,
    draftId: string
  ): Promise<IPurchaseDraft> {
    if (!Types.ObjectId.isValid(draftId)) {
      throw new AppError('Invalid draft ID format', 400, 'INVALID_DRAFT_ID');
    }

    const draft = await PurchaseDraft.findOne({
      _id: new Types.ObjectId(draftId),
      businessId: new Types.ObjectId(businessId),
    });

    if (!draft) {
      throw new AppError('Purchase draft not found', 404, 'DRAFT_NOT_FOUND');
    }

    return draft;
  }

  /**
   * Alias for updateDraftById for consistent API naming
   */
  public async updateDraft(
    businessId: string | Types.ObjectId,
    draftId: string,
    rawPatchData: unknown
  ): Promise<IPurchaseDraft> {
    return this.updateDraftById(businessId, draftId, rawPatchData);
  }

  /**
   * Updates user-editable fields in a draft's working extraction.
   * Preserves rawExtraction immutably and recalculates financial validation.
   */
  public async updateDraftById(
    businessId: string | Types.ObjectId,
    draftId: string,
    rawPatchData: unknown
  ): Promise<IPurchaseDraft> {
    const draft = await this.getDraftById(businessId, draftId);

    // Expired check
    if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
      throw new AppError('This purchase draft has expired and cannot be modified', 400, 'DRAFT_EXPIRED');
    }

    // Validate payload against strict editable fields schema
    const patchData: EditableDraftFields = editableDraftFieldsSchema.parse(rawPatchData);

    const working = draft.extraction;

    // Apply header updates
    if (patchData.vendorInvoiceNumber !== undefined) {
      working.invoice.invoiceNumber.value = patchData.vendorInvoiceNumber;
      working.invoice.invoiceNumber.status = 'VERIFIED';
    }
    if (patchData.invoiceDate !== undefined) {
      working.invoice.invoiceDate.value = patchData.invoiceDate;
      working.invoice.invoiceDate.status = 'VERIFIED';
    }
    if (patchData.dueDate !== undefined) {
      working.invoice.dueDate.value = patchData.dueDate;
      working.invoice.dueDate.status = patchData.dueDate ? 'VERIFIED' : 'MISSING';
    }
    if (patchData.poNumber !== undefined) {
      working.invoice.poNumber.value = patchData.poNumber;
    }
    if (patchData.ewayBillNumber !== undefined) {
      working.invoice.ewayBillNumber.value = patchData.ewayBillNumber;
    }
    if (patchData.placeOfSupply !== undefined) {
      working.invoice.placeOfSupply.value = patchData.placeOfSupply;
    }
    if (patchData.notes !== undefined) {
      if (!working.additional) working.additional = {} as any;
      if (!working.additional.notes) {
        working.additional.notes = { value: patchData.notes, confidence: 1, status: 'VERIFIED', bbox: null };
      } else {
        working.additional.notes.value = patchData.notes;
      }
    }

    // Apply manual vendor override if supplied
    if (patchData.vendorId !== undefined) {
      draft.vendorId = patchData.vendorId ? new Types.ObjectId(patchData.vendorId) : null;
      draft.vendorMatch.matchedVendorId = patchData.vendorId;
      draft.vendorMatch.status = patchData.vendorId ? 'VERIFIED' : 'MISSING';
      draft.markModified('vendorId');
      draft.markModified('vendorMatch');
    }

    // Apply summary overrides if supplied
    if (patchData.summary) {
      draft.manualOverride = true;
      if (!draft.userCorrections) draft.userCorrections = [];
      const s = patchData.summary;

      if (s.grandTotal !== undefined && s.grandTotal !== working.summary.grandTotal.value) {
        draft.userCorrections.push({
          field: 'summary.grandTotal',
          originalValue: working.summary.grandTotal.value,
          newValue: s.grandTotal,
          changedAt: new Date(),
        });
      }
      if (s.taxableAmount !== undefined && s.taxableAmount !== working.summary.taxableAmount.value) {
        draft.userCorrections.push({
          field: 'summary.taxableAmount',
          originalValue: working.summary.taxableAmount.value,
          newValue: s.taxableAmount,
          changedAt: new Date(),
        });
      }
      if (s.totalTax !== undefined && s.totalTax !== working.summary.totalTax.value) {
        draft.userCorrections.push({
          field: 'summary.totalTax',
          originalValue: working.summary.totalTax.value,
          newValue: s.totalTax,
          changedAt: new Date(),
        });
      }
      draft.markModified('userCorrections');

      if (s.subtotal !== undefined) {
        working.summary.subtotal.value = s.subtotal;
        working.summary.subtotal.status = 'VERIFIED';
      }
      if (s.totalDiscount !== undefined) {
        working.summary.totalDiscount.value = s.totalDiscount;
        working.summary.totalDiscount.status = 'VERIFIED';
      }
      if (s.taxableAmount !== undefined) {
        working.summary.taxableAmount.value = s.taxableAmount;
        working.summary.taxableAmount.status = 'VERIFIED';
      }
      if (s.cgstRate !== undefined) {
        if (!working.summary.cgstRate) working.summary.cgstRate = { value: s.cgstRate, confidence: 1, status: 'VERIFIED' };
        else { working.summary.cgstRate.value = s.cgstRate; working.summary.cgstRate.status = 'VERIFIED'; }
      }
      if (s.cgstAmount !== undefined) {
        working.summary.cgstAmount.value = s.cgstAmount;
        working.summary.cgstAmount.status = 'VERIFIED';
      }
      if (s.sgstRate !== undefined) {
        if (!working.summary.sgstRate) working.summary.sgstRate = { value: s.sgstRate, confidence: 1, status: 'VERIFIED' };
        else { working.summary.sgstRate.value = s.sgstRate; working.summary.sgstRate.status = 'VERIFIED'; }
      }
      if (s.sgstAmount !== undefined) {
        working.summary.sgstAmount.value = s.sgstAmount;
        working.summary.sgstAmount.status = 'VERIFIED';
      }
      if (s.igstRate !== undefined) {
        if (!working.summary.igstRate) working.summary.igstRate = { value: s.igstRate, confidence: 1, status: 'VERIFIED' };
        else { working.summary.igstRate.value = s.igstRate; working.summary.igstRate.status = 'VERIFIED'; }
      }
      if (s.igstAmount !== undefined) {
        working.summary.igstAmount.value = s.igstAmount;
        working.summary.igstAmount.status = 'VERIFIED';
      }
      if (s.totalTax !== undefined) {
        working.summary.totalTax.value = s.totalTax;
        working.summary.totalTax.status = 'VERIFIED';
      }
      if (s.roundOff !== undefined) {
        working.summary.roundOff.value = s.roundOff;
        working.summary.roundOff.status = 'VERIFIED';
      }
      if (s.grandTotal !== undefined) {
        working.summary.grandTotal.value = s.grandTotal;
        working.summary.grandTotal.status = 'VERIFIED';
      }
      draft.markModified('extraction');
    }

    if (patchData.manualOverride !== undefined) {
      draft.manualOverride = patchData.manualOverride;
    }

    if (patchData.userCorrections && patchData.userCorrections.length > 0) {
      if (!draft.userCorrections) draft.userCorrections = [];
      for (const c of patchData.userCorrections) {
        draft.userCorrections.push({
          field: c.field,
          originalValue: c.originalValue,
          newValue: c.newValue,
          changedAt: c.changedAt ? new Date(c.changedAt) : new Date(),
          reason: c.reason || null,
        });
      }
      draft.markModified('userCorrections');
    }

    // Apply line item updates
    if (patchData.items && patchData.items.length > 0) {
      for (const itemPatch of patchData.items) {
        const line = working.items.find((it) => it.id === itemPatch.id);
        if (line) {
          if (itemPatch.description !== undefined) line.description.value = itemPatch.description;
          if (itemPatch.quantity !== undefined) line.quantity.value = itemPatch.quantity;
          if (itemPatch.unitPrice !== undefined) line.unitPrice.value = itemPatch.unitPrice;
          if (itemPatch.discountPercent !== undefined) line.discountPercent.value = itemPatch.discountPercent;
          if (itemPatch.discountAmount !== undefined) line.discountAmount.value = itemPatch.discountAmount;
          if (itemPatch.skuOrCode !== undefined) line.skuOrCode.value = itemPatch.skuOrCode;
          if (itemPatch.hsnSac !== undefined) line.hsnSac.value = itemPatch.hsnSac;
          if (itemPatch.unit !== undefined) line.unit.value = itemPatch.unit;
          if (itemPatch.productId !== undefined) {
            if (!line.productMatch) {
              line.productMatch = {
                productId: itemPatch.productId,
                productName: line.description?.value || null,
                sku: line.skuOrCode?.value || null,
                uom: line.unit?.value || null,
                currentStock: null,
                lastPurchasePrice: null,
                matchingMethod: 'UNMATCHED',
                confidence: 1.0,
                isMatched: Boolean(itemPatch.productId),
                status: itemPatch.productId ? 'VERIFIED' : 'MISSING',
                alternatives: [],
              };
            } else {
              line.productMatch.productId = itemPatch.productId;
              line.productMatch.isMatched = Boolean(itemPatch.productId);
              line.productMatch.status = itemPatch.productId ? 'VERIFIED' : 'MISSING';
            }
          }
        }
      }
    }

    // Re-run financial validation and recalculation
    const reconciliationDetail = reconcilePurchaseExtraction(working);
    const lineItemsWithCalculated = populateCalculatedLineValues(
      working.items,
      reconciliationDetail.invoiceValidation
    );
    working.items = lineItemsWithCalculated;
    // If manual override is NOT active, automatically sync working summary with calculated totals
    if (!draft.manualOverride) {
      if (!working.summary) working.summary = {} as any;
      if (!working.summary.subtotal) {
        working.summary.subtotal = { value: reconciliationDetail.calculatedSubtotal, confidence: 1, status: 'VERIFIED' };
      } else {
        working.summary.subtotal.value = reconciliationDetail.calculatedSubtotal;
      }

      if (!working.summary.totalTax) {
        working.summary.totalTax = { value: reconciliationDetail.calculatedTaxTotal, confidence: 1, status: 'VERIFIED' };
      } else {
        working.summary.totalTax.value = reconciliationDetail.calculatedTaxTotal;
      }

      if (!working.summary.grandTotal) {
        working.summary.grandTotal = { value: reconciliationDetail.calculatedGrandTotal, confidence: 1, status: 'VERIFIED' };
      } else {
        working.summary.grandTotal.value = reconciliationDetail.calculatedGrandTotal;
      }

      if (reconciliationDetail.calculatedCgstAmount !== undefined) {
        if (!working.summary.cgstAmount) {
          working.summary.cgstAmount = { value: reconciliationDetail.calculatedCgstAmount, confidence: 1, status: 'VERIFIED' };
        } else {
          working.summary.cgstAmount.value = reconciliationDetail.calculatedCgstAmount;
        }
      }
      if (reconciliationDetail.calculatedSgstAmount !== undefined) {
        if (!working.summary.sgstAmount) {
          working.summary.sgstAmount = { value: reconciliationDetail.calculatedSgstAmount, confidence: 1, status: 'VERIFIED' };
        } else {
          working.summary.sgstAmount.value = reconciliationDetail.calculatedSgstAmount;
        }
      }
      if (reconciliationDetail.calculatedIgstAmount !== undefined) {
        if (!working.summary.igstAmount) {
          working.summary.igstAmount = { value: reconciliationDetail.calculatedIgstAmount, confidence: 1, status: 'VERIFIED' };
        } else {
          working.summary.igstAmount.value = reconciliationDetail.calculatedIgstAmount;
        }
      }
    }

    draft.extraction = working;
    draft.reconciliation = {
      isMathValid: reconciliationDetail.isMathValid,
      hasDiscrepancies: reconciliationDetail.hasDiscrepancies,
      discrepancyNotes: reconciliationDetail.discrepancyNotes,
      calculatedSubtotal: reconciliationDetail.calculatedSubtotal,
      calculatedCgstAmount: reconciliationDetail.calculatedCgstAmount,
      calculatedSgstAmount: reconciliationDetail.calculatedSgstAmount,
      calculatedIgstAmount: reconciliationDetail.calculatedIgstAmount,
      calculatedTaxTotal: reconciliationDetail.calculatedTaxTotal,
      calculatedGrandTotal: reconciliationDetail.calculatedGrandTotal,
      taxMode: reconciliationDetail.taxMode,
    };

    draft.markModified('extraction');
    draft.markModified('reconciliation');

    await draft.save();
    return draft;
  }

  /**
   * Confirms a PurchaseDraft, creating a real Purchase through the existing purchase workflow.
   * Phase 4.1 Hardened:
   * - Durable sourceDraftId link on Purchase with partial unique constraint
   * - Recovery from crash windows (Purchase created but draft update failed)
   * - Stale lock recovery for crashed/abandoned CONFIRMING attempts
   * - Deterministic, tenant-scoped duplicate conversion prevention
   * - Zero duplicate purchases, receipts, or stock mutations under concurrent retries
   * - Safe audit logging of confirmation metadata
   */
  async confirmDraft(
    businessId: string | Types.ObjectId,
    draftId: string,
    userId: string | Types.ObjectId,
    payload?: {
      purchaseType?: 'DIRECT_PURCHASE' | 'ORDERED_PURCHASE';
      directReceivedFull?: boolean;
      allowDuplicateInvoice?: boolean;
      vendorId?: string;
      vendorInvoiceNumber?: string;
      purchaseDate?: string;
      invoiceDate?: string;
      dueDate?: string;
      notes?: string;
      payment?: {
        amount: number;
        paymentMethod?: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
        paymentAccountId?: string | null;
        paymentDate?: string | Date;
        referenceNumber?: string | null;
        reference?: string | null;
        notes?: string | null;
      };
      items?: {
        id: string;
        productId: string;
        orderedQuantity?: number;
        unitPurchasePrice?: number;
        discountPercent?: number;
        taxRate?: number;
      }[];
    }
  ): Promise<{
    success: boolean;
    converted: boolean;
    alreadyConverted?: boolean;
    purchaseId: string;
    purchase: any;
  }> {
    const startTime = Date.now();
    const CONFIRMATION_LOCK_TIMEOUT_MS = parseInt(
      process.env.PURCHASE_CONFIRMATION_LOCK_TIMEOUT_MS || '60000',
      10
    );

    const draft = await this.getDraftById(businessId, draftId);

    // 1. Expired check
    if (draft.expiresAt && new Date(draft.expiresAt).getTime() < Date.now()) {
      throw new AppError('This purchase draft has expired and cannot be confirmed', 400, 'DRAFT_EXPIRED');
    }

    // 2. Crash-Window / Pre-existing Purchase Recovery
    // Check if a Purchase was already created for this draft in this business
    const existingPurchaseBySource = await Purchase.findOne({
      businessId,
      sourceDraftId: draftId,
    });

    if (existingPurchaseBySource) {
      // Phase 4.2 Option A: If direct receiving was requested and receiving is incomplete, resume and complete it safely
      const directReceivedFullRequested = payload?.directReceivedFull ?? true;
      const isDirect = (payload?.purchaseType || existingPurchaseBySource.purchaseType) === 'DIRECT_PURCHASE';

      if (isDirect && directReceivedFullRequested && existingPurchaseBySource.receivingStatus !== 'RECEIVED') {
        console.log(
          `[PurchaseConfirmation] Resuming pending direct receiving for recovered purchase ${existingPurchaseBySource._id}`
        );
        await processReceiving({
          businessId,
          purchase: existingPurchaseBySource,
          itemsToReceive: existingPurchaseBySource.items
            .filter((it: any) => it.remainingQuantity > 0)
            .map((it: any) => ({
              purchaseItemId: it._id,
              quantityReceived: it.remainingQuantity,
            })),
          receivedBy: (userId || existingPurchaseBySource.createdBy || businessId) as Types.ObjectId | string,
          notes: 'Direct purchase receipt (recovered)',
          idempotencyKey: `DIRECT_RECEIPT_${existingPurchaseBySource._id}`,
        });

        const updatedPurchase = await Purchase.findOne({ _id: existingPurchaseBySource._id, businessId });
        if (updatedPurchase) {
          existingPurchaseBySource.receivingStatus = updatedPurchase.receivingStatus;
          existingPurchaseBySource.items = updatedPurchase.items;
        }
      }

      if (draft.status !== 'CONVERTED') {
        draft.status = 'CONVERTED';
        draft.confirmedPurchaseId = existingPurchaseBySource._id;
        draft.confirmedAt = existingPurchaseBySource.createdAt || new Date();
        if (userId) draft.confirmedBy = new Types.ObjectId(userId);
        await draft.save();
      }

      console.log(
        `[PurchaseConfirmation] Idempotent recovery for draft ${draftId} -> existing Purchase ${existingPurchaseBySource._id} (${Date.now() - startTime}ms)`
      );

      return {
        success: true,
        converted: true,
        alreadyConverted: true,
        purchaseId: existingPurchaseBySource._id.toString(),
        purchase: existingPurchaseBySource,
      };
    }

    // 3. Already converted check by draft status
    if (draft.status === 'CONVERTED') {
      let existingPurchase: any = null;
      if (draft.confirmedPurchaseId) {
        existingPurchase = await Purchase.findOne({
          _id: draft.confirmedPurchaseId,
          businessId,
        });
      }

      if (!existingPurchase) {
        existingPurchase = await Purchase.findOne({
          businessId,
          sourceDraftId: draftId,
        });
      }

      if (!existingPurchase) {
        console.error(
          `[PurchaseConfirmation] INVARIANT VIOLATION: Draft ${draftId} is CONVERTED but purchase record is missing`
        );
        throw new AppError(
          'Internal inconsistency: Draft is marked as converted but associated Purchase was not found',
          500,
          'CONVERTED_PURCHASE_MISSING'
        );
      }

      return {
        success: true,
        converted: true,
        alreadyConverted: true,
        purchaseId: existingPurchase._id.toString(),
        purchase: existingPurchase,
      };
    }

    // 4. Atomic claim & stale lock recovery
    // Stale lock: If a draft entered CONFIRMING more than CONFIRMATION_LOCK_TIMEOUT_MS ago and no purchase was created, allow retry
    const staleThreshold = new Date(Date.now() - CONFIRMATION_LOCK_TIMEOUT_MS);

    const lockedDraft = await PurchaseDraft.findOneAndUpdate(
      {
        _id: draftId,
        businessId,
        status: { $ne: 'CONVERTED' },
        $or: [
          { status: { $in: ['DRAFT_READY', 'REVIEW_REQUIRED'] } },
          {
            status: 'CONFIRMING',
            confirmationStartedAt: { $lt: staleThreshold },
          },
        ],
      },
      {
        $set: {
          status: 'CONFIRMING',
          confirmationStartedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!lockedDraft) {
      // Re-inspect current state to give precise response
      const current = await PurchaseDraft.findOne({ _id: draftId, businessId });

      // If a purchase was created while we were checking
      const currentPurchase = await Purchase.findOne({ businessId, sourceDraftId: draftId });
      if (currentPurchase) {
        const directReceivedFullRequested = payload?.directReceivedFull ?? true;
        const isDirect = (payload?.purchaseType || currentPurchase.purchaseType) === 'DIRECT_PURCHASE';

        if (isDirect && directReceivedFullRequested && currentPurchase.receivingStatus !== 'RECEIVED') {
          await processReceiving({
            businessId,
            purchase: currentPurchase,
            itemsToReceive: currentPurchase.items
              .filter((it: any) => it.remainingQuantity > 0)
              .map((it: any) => ({
                purchaseItemId: it._id,
                quantityReceived: it.remainingQuantity,
              })),
            receivedBy: (userId || currentPurchase.createdBy || businessId) as Types.ObjectId | string,
            notes: 'Direct purchase receipt (recovered)',
            idempotencyKey: `DIRECT_RECEIPT_${currentPurchase._id}`,
          });
          const updated = await Purchase.findOne({ _id: currentPurchase._id, businessId });
          if (updated) {
            currentPurchase.receivingStatus = updated.receivingStatus;
            currentPurchase.items = updated.items;
          }
        }

        if (current && current.status !== 'CONVERTED') {
          current.status = 'CONVERTED';
          current.confirmedPurchaseId = currentPurchase._id;
          current.confirmedAt = currentPurchase.createdAt || new Date();
          await current.save();
        }
        return {
          success: true,
          converted: true,
          alreadyConverted: true,
          purchaseId: currentPurchase._id.toString(),
          purchase: currentPurchase,
        };
      }

      if (current?.status === 'CONVERTED') {
        const existingPurchase = await Purchase.findOne({
          _id: current.confirmedPurchaseId,
          businessId,
        });
        return {
          success: true,
          converted: true,
          alreadyConverted: true,
          purchaseId: current.confirmedPurchaseId ? current.confirmedPurchaseId.toString() : '',
          purchase: existingPurchase,
        };
      }

      if (current?.status === 'CONFIRMING') {
        throw new AppError(
          'Confirmation is currently in progress for this draft. Please wait a moment.',
          409,
          'CONCURRENT_CONFIRMATION'
        );
      }

      throw new AppError('Purchase draft cannot be confirmed in its current state', 400, 'INVALID_DRAFT_STATE');
    }

    // 5. Secondary check after acquiring lock (double-checked locking)
    const secondaryCheck = await Purchase.findOne({ businessId, sourceDraftId: draftId });
    if (secondaryCheck) {
      const directReceivedFullRequested = payload?.directReceivedFull ?? true;
      const isDirect = (payload?.purchaseType || secondaryCheck.purchaseType) === 'DIRECT_PURCHASE';

      if (isDirect && directReceivedFullRequested && secondaryCheck.receivingStatus !== 'RECEIVED') {
        await processReceiving({
          businessId,
          purchase: secondaryCheck,
          itemsToReceive: secondaryCheck.items
            .filter((it: any) => it.remainingQuantity > 0)
            .map((it: any) => ({
              purchaseItemId: it._id,
              quantityReceived: it.remainingQuantity,
            })),
          receivedBy: (userId || secondaryCheck.createdBy || businessId) as Types.ObjectId | string,
          notes: 'Direct purchase receipt (recovered)',
          idempotencyKey: `DIRECT_RECEIPT_${secondaryCheck._id}`,
        });
        const updated = await Purchase.findOne({ _id: secondaryCheck._id, businessId });
        if (updated) {
          secondaryCheck.receivingStatus = updated.receivingStatus;
          secondaryCheck.items = updated.items;
        }
      }

      lockedDraft.status = 'CONVERTED';
      lockedDraft.confirmedPurchaseId = secondaryCheck._id;
      lockedDraft.confirmedAt = secondaryCheck.createdAt || new Date();
      await lockedDraft.save();

      return {
        success: true,
        converted: true,
        alreadyConverted: true,
        purchaseId: secondaryCheck._id.toString(),
        purchase: secondaryCheck,
      };
    }

    try {
      // 6. Vendor revalidation
      const vendorId =
        payload?.vendorId ||
        (lockedDraft as any).vendorId?.toString() ||
        lockedDraft.vendorMatch?.matchedVendorId ||
        null;

      if (!vendorId) {
        throw new AppError('A valid vendor must be selected to confirm purchase', 400, 'VENDOR_REQUIRED');
      }

      const vendor = await Vendor.findById(vendorId);
      if (!vendor) {
        throw new AppError('Selected vendor does not exist', 404, 'VENDOR_NOT_FOUND');
      }

      if (vendor.businessId.toString() !== businessId.toString()) {
        throw new AppError('Selected vendor does not belong to the active business', 403, 'VENDOR_NOT_IN_BUSINESS');
      }

      if (!vendor.isActive) {
        throw new AppError('Selected vendor is inactive', 400, 'VENDOR_INACTIVE');
      }

      // 7. Invoice number & date
      const vendorInvoiceNumber =
        payload?.vendorInvoiceNumber !== undefined
          ? payload.vendorInvoiceNumber?.trim() || null
          : (lockedDraft.extraction.invoice?.invoiceNumber?.value?.trim() || null);

      const invoiceDate =
        payload?.invoiceDate ||
        lockedDraft.extraction.invoice?.invoiceDate?.value ||
        null;

      const dueDate =
        payload?.dueDate ||
        lockedDraft.extraction.invoice?.dueDate?.value ||
        null;

      const purchaseDate =
        payload?.purchaseDate ||
        lockedDraft.extraction.invoice?.invoiceDate?.value ||
        new Date().toISOString().split('T')[0];

      // 8. Line items revalidation
      const draftItems = lockedDraft.extraction.items;
      if (!draftItems || draftItems.length === 0) {
        throw new AppError('Purchase draft contains no line items to confirm', 400, 'ITEMS_REQUIRED');
      }

      const validatedItems: any[] = [];
      for (const it of draftItems) {
        const itemOverride = payload?.items?.find((p) => p.id === it.id);
        const productId = itemOverride?.productId || it.productMatch?.productId;

        if (!productId) {
          throw new AppError(
            `Line item "${it.description.value || it.lineNumber}" is not mapped to an inventory product`,
            400,
            'PRODUCT_UNRESOLVED'
          );
        }

        // Verify product existence and active status in business
        const prod = await Product.findOne({ _id: productId, businessId, active: true, deletedAt: null });
        if (!prod) {
          throw new AppError(
            `Mapped product for line "${it.description.value || it.lineNumber}" does not exist or is inactive`,
            400,
            'PRODUCT_NOT_FOUND'
          );
        }

        const orderedQty =
          itemOverride?.orderedQuantity !== undefined
            ? itemOverride.orderedQuantity
            : (it.quantity.value && it.quantity.value > 0 ? it.quantity.value : 1);

        if (orderedQty <= 0) {
          throw new AppError(`Quantity for "${it.description.value || it.lineNumber}" must be at least 1`, 400, 'INVALID_QUANTITY');
        }

        const unitPrice =
          itemOverride?.unitPurchasePrice !== undefined
            ? itemOverride.unitPurchasePrice
            : (it.unitPrice.value !== null && it.unitPrice.value !== undefined ? it.unitPrice.value : 0);

        if (unitPrice < 0) {
          throw new AppError(`Price for "${it.description.value || it.lineNumber}" cannot be negative`, 400, 'INVALID_PRICE');
        }

        const discountPercent =
          itemOverride?.discountPercent !== undefined
            ? itemOverride.discountPercent
            : (it.discountPercent?.value || 0);

        const taxRate =
          itemOverride?.taxRate !== undefined
            ? itemOverride.taxRate
            : (it.gstRate?.value || 0);

        validatedItems.push({
          productId: prod._id.toString(),
          productName: prod.name,
          sku: prod.sku || it.skuOrCode?.value || null,
          orderedQuantity: orderedQty,
          unitPurchasePrice: unitPrice,
          discountPercent,
          discountAmount: it.discountAmount?.value || 0,
          taxRate,
        });
      }

      // Build billAttachments from lockedDraft.originalFile
      const billAttachments = lockedDraft.originalFile?.fileUrl
        ? [
            {
              fileName: lockedDraft.originalFile.fileName || 'purchase_bill.pdf',
              fileUrl: lockedDraft.originalFile.fileUrl,
              mimeType: lockedDraft.originalFile.mimeType || 'application/pdf',
              fileSize: lockedDraft.originalFile.fileSize || 0,
              publicId: lockedDraft.originalFile.publicId || null,
              documentType: 'PURCHASE_BILL',
              uploadedAt: lockedDraft.createdAt || new Date(),
              uploadedBy: userId ? new Types.ObjectId(userId) : undefined,
            },
          ]
        : [];

      // 9. Call existing purchase creation logic with durable sourceDraftId and billAttachments
      const purchase = await executeCreatePurchaseCore({
        businessId,
        userId,
        validated: {
          purchaseType: payload?.purchaseType || 'DIRECT_PURCHASE',
          vendorId: vendor._id.toString(),
          vendorInvoiceNumber,
          purchaseDate,
          invoiceDate,
          dueDate,
          status: 'CONFIRMED',
          items: validatedItems,
          notes: payload?.notes !== undefined ? payload.notes : (lockedDraft.extraction?.additional?.notes?.value || null),
          billAttachments,
          directReceivedFull: payload?.directReceivedFull ?? true,
          allowDuplicateInvoice: payload?.allowDuplicateInvoice ?? false,
          sourceDraftId: lockedDraft._id,
          payment: payload?.payment,
        },
      });

      // 10. Successfully created Purchase -> Transition draft to CONVERTED
      lockedDraft.status = 'CONVERTED';
      lockedDraft.confirmedPurchaseId = purchase._id;
      lockedDraft.confirmedAt = new Date();
      if (userId) {
        lockedDraft.confirmedBy = new Types.ObjectId(userId);
      }
      await lockedDraft.save();

      console.log(
        `[PurchaseConfirmation] Draft ${draftId} confirmed successfully -> Purchase ${purchase._id} (${Date.now() - startTime}ms)`
      );

      return {
        success: true,
        converted: true,
        alreadyConverted: false,
        purchaseId: purchase._id.toString(),
        purchase,
      };
    } catch (err: any) {
      // If error is DUPLICATE_CONVERSION (race condition where another request created purchase with same sourceDraftId)
      if (err.code === 'DUPLICATE_CONVERSION' || (err.name === 'MongoServerError' && err.code === 11000)) {
        const winnerPurchase = await Purchase.findOne({ businessId, sourceDraftId: draftId });
        if (winnerPurchase) {
          lockedDraft.status = 'CONVERTED';
          lockedDraft.confirmedPurchaseId = winnerPurchase._id;
          lockedDraft.confirmedAt = winnerPurchase.createdAt || new Date();
          await lockedDraft.save();

          console.log(
            `[PurchaseConfirmation] Caught race condition duplicate conversion -> recovered Purchase ${winnerPurchase._id}`
          );

          return {
            success: true,
            converted: true,
            alreadyConverted: true,
            purchaseId: winnerPurchase._id.toString(),
            purchase: winnerPurchase,
          };
        }
      }

      // Revert status from CONFIRMING back to previous status and reset confirmationStartedAt
      await PurchaseDraft.updateOne(
        { _id: draftId, businessId, status: 'CONFIRMING' },
        {
          $set: {
            status: lockedDraft.reconciliation?.hasDiscrepancies ? 'REVIEW_REQUIRED' : 'DRAFT_READY',
            confirmationStartedAt: null,
          },
        }
      );

      console.error(
        `[PurchaseConfirmation] Confirmation failed for draft ${draftId} after ${Date.now() - startTime}ms: ${err.message}`
      );

      throw err;
    }
  }
}

export const purchaseScannerService = new PurchaseScannerService();
export default purchaseScannerService;
