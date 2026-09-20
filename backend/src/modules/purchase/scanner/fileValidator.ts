import path from 'path';
import {
  EmptyFileError,
  FileSizeExceededError,
  FileSignatureMismatchError,
  UnsupportedFileTypeError,
} from './preprocessingErrors';
import { SupportedDocumentType, SupportedMimeType } from './preprocessingTypes';
import { env } from '../../../config/env';

export interface ValidatedFileDetails {
  sanitizedFileName: string;
  fileSizeBytes: number;
  documentType: SupportedDocumentType;
  mimeType: SupportedMimeType;
}

/**
 * Magic Byte signatures
 */
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/**
 * Sanitizes user-provided filename to prevent path traversal and shell injection
 */
export function sanitizeFilename(rawFilename?: string | null): string {
  if (!rawFilename || typeof rawFilename !== 'string') {
    return `document_${Date.now()}`;
  }

  // Strip all directory path components (handling both Windows \ and POSIX /)
  const base = path.basename(rawFilename.replace(/\\/g, '/')).trim();

  // Strip non-printable / control characters / dangerous symbols
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Prevent hidden / dotfiles
  return cleaned.replace(/^\.+/, '') || `document_${Date.now()}`;
}

/**
 * Detects actual file format from buffer magic bytes
 */
export function detectFileSignature(buffer: Buffer): {
  detectedMime: SupportedMimeType | null;
  detectedType: SupportedDocumentType | null;
} {
  if (buffer.length < 4) {
    return { detectedMime: null, detectedType: null };
  }

  // 1. Check PNG signature (8 bytes)
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_MAGIC)) {
    return { detectedMime: 'image/png', detectedType: 'IMAGE' };
  }

  // 2. Check JPEG signature (first 3 bytes: FF D8 FF)
  if (buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
    return { detectedMime: 'image/jpeg', detectedType: 'IMAGE' };
  }

  // 3. Check PDF signature (%PDF- anywhere within first 1024 bytes to allow BOM/leading headers)
  const searchLimit = Math.min(buffer.length, 1024);
  const headerSlice = buffer.subarray(0, searchLimit);
  if (headerSlice.includes(PDF_MAGIC)) {
    return { detectedMime: 'application/pdf', detectedType: 'PDF' };
  }

  return { detectedMime: null, detectedType: null };
}

/**
 * Validates document buffer, size, claimed extension, and authentic magic bytes
 */
export function validateDocumentInput(
  buffer: Buffer,
  rawFilename: string,
  options?: {
    maxFileSizeMb?: number;
  }
): ValidatedFileDetails {
  // 1. Verify buffer existence & non-empty
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new EmptyFileError();
  }

  // 2. File size enforcement
  const maxMb = options?.maxFileSizeMb ?? env.PURCHASE_SCANNER_MAX_FILE_SIZE_MB;
  const maxBytes = maxMb * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new FileSizeExceededError(buffer.length, maxBytes);
  }

  // 3. Sanitize filename
  const sanitizedFileName = sanitizeFilename(rawFilename);

  // 4. Validate extension
  const ext = path.extname(sanitizedFileName).toLowerCase();
  const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
  if (!allowedExtensions.includes(ext)) {
    throw new UnsupportedFileTypeError(
      `Unsupported file extension '${ext}'. Supported document formats are: PDF, PNG, JPG, JPEG.`,
      { ext, allowedExtensions }
    );
  }

  // 5. Detect magic bytes signature
  const { detectedMime, detectedType } = detectFileSignature(buffer);
  if (!detectedMime || !detectedType) {
    throw new UnsupportedFileTypeError(
      `File format signature is unrecognized or unsupported. Please upload a valid PDF, PNG, or JPEG file.`,
      { filename: sanitizedFileName }
    );
  }

  // 6. Verify declared extension matches authentic magic bytes signature
  const isPdfExt = ext === '.pdf';
  const isImageExt = ext === '.png' || ext === '.jpg' || ext === '.jpeg';

  if (isPdfExt && detectedType !== 'PDF') {
    throw new FileSignatureMismatchError('pdf', detectedMime);
  }

  if (isImageExt && detectedType !== 'IMAGE') {
    throw new FileSignatureMismatchError(ext.replace('.', ''), detectedMime);
  }

  return {
    sanitizedFileName,
    fileSizeBytes: buffer.length,
    documentType: detectedType,
    mimeType: detectedMime,
  };
}
