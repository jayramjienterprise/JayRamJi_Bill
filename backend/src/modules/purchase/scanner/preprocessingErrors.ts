import { AppError } from '../../../middleware/errorHandler';

export type PreprocessingErrorCode =
  | 'FILE_SIZE_EXCEEDED'
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_SIGNATURE_MISMATCH'
  | 'CORRUPT_FILE'
  | 'PAGE_LIMIT_EXCEEDED'
  | 'PDF_RENDER_ERROR'
  | 'IMAGE_DECODE_ERROR'
  | 'IMAGE_PROCESSING_ERROR';

/**
 * Domain-specific error class for Purchase Bill Document Preprocessing
 */
export class PreprocessingError extends AppError {
  constructor(
    message: string,
    statusCode: number,
    errorCode: PreprocessingErrorCode,
    details: Record<string, unknown> = {}
  ) {
    super(message, statusCode, errorCode, details);
  }
}

export class EmptyFileError extends PreprocessingError {
  constructor(message = 'Uploaded document is empty (0 bytes)') {
    super(message, 400, 'EMPTY_FILE');
  }
}

export class FileSizeExceededError extends PreprocessingError {
  constructor(sizeBytes: number, maxBytes: number) {
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(2);
    super(
      `File size (${sizeMb} MB) exceeds maximum allowed limit (${maxMb} MB)`,
      413,
      'FILE_SIZE_EXCEEDED',
      { sizeBytes, maxBytes }
    );
  }
}

export class UnsupportedFileTypeError extends PreprocessingError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 415, 'UNSUPPORTED_FILE_TYPE', details);
  }
}

export class FileSignatureMismatchError extends PreprocessingError {
  constructor(declaredExt: string, detectedSignature: string) {
    super(
      `File header does not match claimed file extension '.${declaredExt}'. Expected authentic document signature.`,
      400,
      'FILE_SIGNATURE_MISMATCH',
      { declaredExt, detectedSignature }
    );
  }
}

export class CorruptFileError extends PreprocessingError {
  constructor(message = 'Uploaded document is malformed or corrupt and cannot be parsed', details: Record<string, unknown> = {}) {
    super(message, 422, 'CORRUPT_FILE', details);
  }
}

export class PageLimitExceededError extends PreprocessingError {
  constructor(pageCount: number, maxPages: number) {
    super(
      `Document page count (${pageCount}) exceeds maximum allowed limit (${maxPages} pages)`,
      422,
      'PAGE_LIMIT_EXCEEDED',
      { pageCount, maxPages }
    );
  }
}

export class PdfRenderError extends PreprocessingError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 500, 'PDF_RENDER_ERROR', details);
  }
}

export class ImageDecodeError extends PreprocessingError {
  constructor(message = 'Failed to decode image data. Buffer may be truncated or unsupported format.', details: Record<string, unknown> = {}) {
    super(message, 422, 'IMAGE_DECODE_ERROR', details);
  }
}

export class ImageProcessingError extends PreprocessingError {
  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, 500, 'IMAGE_PROCESSING_ERROR', details);
  }
}
