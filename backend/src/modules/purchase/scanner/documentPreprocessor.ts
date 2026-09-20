import { validateDocumentInput } from './fileValidator';
import { renderPdfToPages } from './pdfRenderer';
import { normalizePageImage } from './imagePreprocessor';
import {
  DocumentPreprocessingResult,
  PreprocessingOptions,
  ProcessedDocumentPage,
} from './preprocessingTypes';
import { env } from '../../../config/env';

/**
 * Main Document Preprocessing Pipeline
 *
 * Accepts purchase-bill images/PDFs and produces normalized, orientation-corrected,
 * OCR-ready page images suitable for subsequent AI vision/document extraction.
 *
 * Guaranteed Properties:
 * - Read-only: never touches database models (Purchase, Vendor, Product, Stock)
 * - Safe: validates signatures, enforces page limits and file size limits
 * - In-memory: processes sequential buffers without leaving stray files on disk
 * - Deterministic: consistent output ordering and image transformations
 */
export async function preprocessDocument(
  buffer: Buffer,
  rawFilename: string,
  options?: PreprocessingOptions
): Promise<DocumentPreprocessingResult> {
  const startTime = Date.now();

  // 1. Input validation & magic byte signature verification
  const validated = validateDocumentInput(buffer, rawFilename, {
    maxFileSizeMb: options?.maxFileSizeMb,
  });

  const maxPages = options?.maxPages ?? env.PURCHASE_SCANNER_MAX_PAGES;
  const maxFileSizeBytes =
    (options?.maxFileSizeMb ?? env.PURCHASE_SCANNER_MAX_FILE_SIZE_MB) * 1024 * 1024;

  const processedPages: ProcessedDocumentPage[] = [];
  const documentWarnings: string[] = [];
  let rendererUsed = 'sharp-native';

  if (validated.documentType === 'PDF') {
    rendererUsed = 'pdf-to-png-converter (Mozilla PDF.js / napi-rs)';

    // 2a. PDF pipeline: rasterize pages to PNG
    const rawPages = await renderPdfToPages(buffer, {
      maxPages,
      targetDpi: options?.targetDpi,
    });

    // 2b. Process and normalize each page sequentially to prevent memory spikes
    for (const rawPage of rawPages) {
      const normalizedPage = await normalizePageImage(
        rawPage.buffer,
        rawPage.pageNumber,
        {
          maxDimension: options?.maxDimension,
          skipContrastNormalization: options?.skipContrastNormalization,
          skipSharpening: options?.skipSharpening,
        }
      );
      processedPages.push(normalizedPage);
    }
  } else {
    // 3. Image pipeline (PNG / JPEG): single page
    const normalizedPage = await normalizePageImage(buffer, 1, {
      maxDimension: options?.maxDimension,
      skipContrastNormalization: options?.skipContrastNormalization,
      skipSharpening: options?.skipSharpening,
    });
    processedPages.push(normalizedPage);
  }

  const durationMs = Date.now() - startTime;

  return {
    documentType: validated.documentType,
    originalMimeType: validated.mimeType,
    originalFileName: validated.sanitizedFileName,
    fileSizeBytes: validated.fileSizeBytes,
    pageCount: processedPages.length,
    pages: processedPages,
    warnings: documentWarnings,
    processingMetadata: {
      durationMs,
      maxPagesConfigured: maxPages,
      maxFileSizeBytesConfigured: maxFileSizeBytes,
      rendererUsed,
    },
  };
}
