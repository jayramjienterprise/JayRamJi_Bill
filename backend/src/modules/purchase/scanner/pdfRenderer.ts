import { PDFDocument } from 'pdf-lib';
import { pdfToPng } from 'pdf-to-png-converter';
import {
  CorruptFileError,
  PageLimitExceededError,
  PdfRenderError,
} from './preprocessingErrors';
import { env } from '../../../config/env';

export interface RawPdfPageImage {
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
}

/**
 * Inspects PDF page count and validates structural integrity without rasterization overhead
 */
export async function inspectPdfPageCount(
  pdfBuffer: Buffer,
  maxPages: number = env.PURCHASE_SCANNER_MAX_PAGES
): Promise<number> {
  try {
    const doc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
      parseSpeed: 1, // FAST
    });

    const pageCount = doc.getPageCount();

    if (pageCount === 0) {
      throw new CorruptFileError('PDF contains 0 pages');
    }

    if (pageCount > maxPages) {
      throw new PageLimitExceededError(pageCount, maxPages);
    }

    return pageCount;
  } catch (err: any) {
    if (err instanceof PageLimitExceededError) {
      throw err;
    }
    throw new CorruptFileError(`PDF file is corrupt or unreadable: ${err?.message || 'unknown parse error'}`);
  }
}

/**
 * Deterministically renders each PDF page to a PNG buffer
 * Uses pdf-to-png-converter (Mozilla PDF.js + @napi-rs/canvas)
 * Operates purely in memory without disk clutter.
 */
export async function renderPdfToPages(
  pdfBuffer: Buffer,
  options?: {
    maxPages?: number;
    targetDpi?: number;
  }
): Promise<RawPdfPageImage[]> {
  const maxPages = options?.maxPages ?? env.PURCHASE_SCANNER_MAX_PAGES;
  const targetDpi = options?.targetDpi ?? env.PURCHASE_SCANNER_TARGET_DPI;

  // 1. Structural pre-check & page limit enforcement
  const totalPages = await inspectPdfPageCount(pdfBuffer, maxPages);

  // 2. Scale factor based on target DPI (standard PDF point = 1/72 inch)
  // Target 150 DPI gives ~2.08 scale, perfect for crisp text reading
  const viewportScale = Math.max(1.0, Math.min(3.0, targetDpi / 72));

  try {
    // Process pages sequentially in-memory
    const pages = await pdfToPng(pdfBuffer, {
      viewportScale,
      disableFontFace: false,
      useSystemFonts: true,
    });

    if (!pages || pages.length === 0) {
      throw new PdfRenderError('PDF renderer produced 0 output pages');
    }

    // Sort deterministically by pageNumber (1-indexed)
    const sorted = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

    return sorted.map((p, idx) => {
      const pageNum = p.pageNumber || idx + 1;
      const buffer = p.content;

      if (!buffer || buffer.length === 0) {
        throw new PdfRenderError(`Rendered page ${pageNum} produced an empty buffer`);
      }

      return {
        pageNumber: pageNum,
        buffer,
        width: p.width,
        height: p.height,
      };
    });
  } catch (err: any) {
    if (err instanceof PageLimitExceededError || err instanceof CorruptFileError) {
      throw err;
    }
    throw new PdfRenderError(`Failed to rasterize PDF document: ${err?.message || 'rendering failure'}`, {
      originalError: err?.message,
      totalPages,
    });
  }
}
