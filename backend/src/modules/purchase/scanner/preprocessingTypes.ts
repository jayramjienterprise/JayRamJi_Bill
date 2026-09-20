/**
 * Contract Definitions for Purchase Bill Document Preprocessing Layer
 */

export type SupportedDocumentType = 'PDF' | 'IMAGE';

export type SupportedMimeType = 'application/pdf' | 'image/png' | 'image/jpeg';

export interface ProcessedDocumentPage {
  /** 1-indexed deterministic page order */
  pageNumber: number;
  /** Normalized output image width in pixels */
  width: number;
  /** Normalized output image height in pixels */
  height: number;
  /** Output image format (normalized to PNG for lossless OCR text fidelity) */
  mimeType: 'image/png';
  /** Normalized image buffer in memory */
  buffer: Buffer;
  /** EXIF or applied rotation (0, 90, 180, 270) */
  rotation: number;
  /** Pre-normalization original dimensions */
  originalDimensions: {
    width: number;
    height: number;
  };
  /** Preprocessing operations applied to this page */
  preprocessingApplied: string[];
  /** Informative warnings regarding image quality, orientation uncertainty, etc. */
  warnings: string[];
}

export interface DocumentPreprocessingResult {
  /** High-level document category */
  documentType: SupportedDocumentType;
  /** Original MIME type detected from signature / header */
  originalMimeType: SupportedMimeType;
  /** Sanitized original file name */
  originalFileName: string;
  /** Original file size in bytes */
  fileSizeBytes: number;
  /** Total number of pages extracted */
  pageCount: number;
  /** Sequential, 1-indexed processed page images */
  pages: ProcessedDocumentPage[];
  /** Document-level warnings */
  warnings: string[];
  /** Deterministic execution metadata */
  processingMetadata: {
    durationMs: number;
    maxPagesConfigured: number;
    maxFileSizeBytesConfigured: number;
    rendererUsed: string;
  };
}

export interface PreprocessingOptions {
  /** Override max allowed file size in MB */
  maxFileSizeMb?: number;
  /** Override max allowed PDF pages */
  maxPages?: number;
  /** Target rasterization DPI / scale for PDF rendering */
  targetDpi?: number;
  /** Max bounding dimension (width/height) for OCR normalization */
  maxDimension?: number;
  /** Skip contrast normalization step */
  skipContrastNormalization?: boolean;
  /** Skip unsharp mask sharpening step */
  skipSharpening?: boolean;
}
