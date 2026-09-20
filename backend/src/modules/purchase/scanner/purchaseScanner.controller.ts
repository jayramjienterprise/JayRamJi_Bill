import { Request, Response, NextFunction } from 'express';
import { purchaseScannerService } from './purchaseScanner.service';
import { AppError } from '../../../middleware/errorHandler';
import crypto from 'crypto';
import {
  generateScannerCorrelationId,
  hashIdentifier,
  logScannerEvent,
  scannerMetrics,
} from './scannerObservability';

/**
 * Purchase Scanner HTTP Controller
 *
 * Exposes endpoints for:
 * - POST /api/purchases/scanner/draft: Upload & scan bill document to produce PurchaseDraft
 * - GET /api/purchases/scanner/drafts/:draftId: Tenant-scoped draft retrieval
 * - PATCH /api/purchases/scanner/drafts/:draftId: Tenant-scoped draft working-copy update
 * - POST /api/purchases/scanner/drafts/:draftId/confirm: Confirm draft to Purchase
 *
 * Strict boundary:
 * Contains NO NVIDIA logic, NO financial calculation algorithms, NO database mutations directly.
 * Strictly orchestrates HTTP request validation, correlation tracking, and delegates to purchaseScannerService.
 */
export class PurchaseScannerController {
  /**
   * Handle document upload, preprocessing, vision extraction, matching, and draft creation.
   */
  public async createDraftHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId =
      (req.headers['x-request-id'] as string) || generateScannerCorrelationId();
    res.setHeader('X-Request-Id', correlationId);

    try {
      const businessId = req.businessId;
      const userId = req.user?._id;

      if (!businessId || !userId) {
        return next(new AppError('Active business workspace context is required', 400, 'BAD_REQUEST'));
      }

      const file = req.file;
      if (!file || !file.buffer) {
        return next(
          new AppError(
            'Bill document file is required. Please upload a valid PDF, PNG, or JPEG file.',
            400,
            'FILE_REQUIRED'
          )
        );
      }

      logScannerEvent('info', 'SCANNER_UPLOAD_RECEIVED', {
        correlationId,
        businessId: businessId.toString(),
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
      });

      // Read Idempotency-Key & Scan-Operation-Id headers safely
      const rawIdempotencyKey = (req.headers['idempotency-key'] || req.headers['Idempotency-Key']) as string | undefined;
      const idempotencyKey = rawIdempotencyKey ? String(rawIdempotencyKey).trim() : null;
      const scanOperationId = (req.headers['x-scan-operation-id'] || req.headers['X-Scan-Operation-Id']) as string | undefined;

      const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

      logScannerEvent('info', 'SCANNER_REQUEST_STARTED', {
        correlationId,
        scanOperationId: scanOperationId || idempotencyKey || null,
        idempotencyKeyHash: idempotencyKey ? hashIdentifier(idempotencyKey) : null,
        fileHash,
        fileName: file.originalname,
        fileSize: file.size,
        businessId: businessId.toString(),
      });

      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId,
        userId,
        fileBuffer: file.buffer,
        fileName: file.originalname || 'uploaded_bill',
        mimeType: file.mimetype || 'application/octet-stream',
        fileSize: file.size || file.buffer.length,
        idempotencyKey,
        correlationId,
      });

      const durationMs = Date.now() - startTime;
      scannerMetrics.recordScannerRequest(true, durationMs);
      scannerMetrics.recordDraftCreated();

      logScannerEvent('info', 'SCANNER_DRAFT_CREATED', {
        correlationId,
        businessId: businessId.toString(),
        draftId: draft._id.toString(),
        durationMs,
      });

      res.status(201).json({
        success: true,
        correlationId,
        data: {
          success: true,
          draft,
          draftId: draft._id.toString(),
          draftNumber: draft.draftNumber,
          status: draft.status,
        },
        draft,
      });
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      scannerMetrics.recordScannerRequest(false, durationMs);

      logScannerEvent('error', 'SCANNER_UPLOAD_FAILED', {
        correlationId,
        durationMs,
        error: error.message,
        errorCode: error.errorCode || error.code || 'UNKNOWN_ERROR',
      });

      next(error);
    }
  }

  /**
   * Handle retrieving a PurchaseDraft by ID for the authenticated tenant.
   */
  public async getDraftHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return next(new AppError('Active business workspace context is required', 400, 'BAD_REQUEST'));
      }

      const { draftId } = req.params;
      const draft = await purchaseScannerService.getDraftById(businessId, draftId);

      res.status(200).json({
        success: true,
        data: {
          draft,
        },
        draft,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle updating allowed working fields on a PurchaseDraft for the authenticated tenant.
   */
  public async patchDraftHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const businessId = req.businessId;
      if (!businessId) {
        return next(new AppError('Active business workspace context is required', 400, 'BAD_REQUEST'));
      }

      const { draftId } = req.params;
      const draft = await purchaseScannerService.updateDraftById(businessId, draftId, req.body);

      res.status(200).json({
        success: true,
        data: {
          draft,
        },
        draft,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle confirming a PurchaseDraft into an official Purchase for the authenticated tenant.
   * POST /api/purchases/scanner/drafts/:draftId/confirm
   */
  public async confirmDraftHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    const startTime = Date.now();
    const correlationId =
      (req.headers['x-request-id'] as string) || generateScannerCorrelationId();
    res.setHeader('X-Request-Id', correlationId);

    try {
      const businessId = req.businessId;
      if (!businessId) {
        return next(new AppError('Active business workspace context is required', 400, 'BAD_REQUEST'));
      }

      const userId = (req as any).user?.id || (req as any).user?._id;
      const { draftId } = req.params;

      logScannerEvent('info', 'SCANNER_CONFIRM_STARTED', {
        correlationId,
        businessId: businessId.toString(),
        draftId,
      });

      const result = await purchaseScannerService.confirmDraft(businessId, draftId, userId, req.body);

      const durationMs = Date.now() - startTime;
      scannerMetrics.recordDraftConfirmed();

      logScannerEvent('info', 'SCANNER_CONFIRM_SUCCESS', {
        correlationId,
        businessId: businessId.toString(),
        draftId,
        purchaseId: result.purchaseId,
        alreadyConverted: result.alreadyConverted,
        durationMs,
      });

      res.status(200).json({
        ...result,
        data: result,
        correlationId,
      });
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      scannerMetrics.recordConfirmationFailure();

      logScannerEvent('error', 'SCANNER_CONFIRM_FAILED', {
        correlationId,
        durationMs,
        error: error.message,
        errorCode: error.errorCode || error.code || 'UNKNOWN_ERROR',
      });

      next(error);
    }
  }
}

export const purchaseScannerController = new PurchaseScannerController();
export default purchaseScannerController;
