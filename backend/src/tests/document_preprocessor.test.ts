import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import {
  preprocessDocument,
  validateDocumentInput,
  detectFileSignature,
  sanitizeFilename,
  inspectPdfPageCount,
  EmptyFileError,
  FileSizeExceededError,
  UnsupportedFileTypeError,
  FileSignatureMismatchError,
  CorruptFileError,
  PageLimitExceededError,
} from '../modules/purchase/scanner';
import mongoose from 'mongoose';
import Purchase from '../database/models/Purchase';
import Product from '../database/models/Product';
import Vendor from '../database/models/Vendor';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

describe('Phase 2D — Purchase Bill Document Preprocessing Engine', () => {
  let samplePngBuffer: Buffer;
  let sampleJpegBuffer: Buffer;
  let singlePagePdfBuffer: Buffer;
  let multiPagePdfBuffer: Buffer;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_MONGO_URI);
    }

    // 1. Generate clean PNG fixture
    samplePngBuffer = await sharp({
      create: {
        width: 800,
        height: 600,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    // 2. Generate clean JPEG fixture
    sampleJpegBuffer = await sharp({
      create: {
        width: 1024,
        height: 768,
        channels: 3,
        background: { r: 245, g: 245, b: 245 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();

    // 3. Generate single-page PDF fixture
    const pdfDoc1 = await PDFDocument.create();
    const p1 = pdfDoc1.addPage([595, 842]); // A4
    p1.drawText('Purchase Bill Tax Invoice #INV-2026-001', { x: 50, y: 750, size: 16 });
    singlePagePdfBuffer = Buffer.from(await pdfDoc1.save());

    // 4. Generate 3-page PDF fixture
    const pdfDoc3 = await PDFDocument.create();
    for (let i = 1; i <= 3; i++) {
      const page = pdfDoc3.addPage([595, 842]);
      page.drawText(`Purchase Invoice - Page ${i} of 3`, { x: 50, y: 750, size: 14 });
    }
    multiPagePdfBuffer = Buffer.from(await pdfDoc3.save());
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  // ----------------------------------------------------
  // A. PNG Input
  // ----------------------------------------------------
  it('Scenario A: Valid PNG input processes cleanly into normalized page image', async () => {
    const result = await preprocessDocument(samplePngBuffer, 'sample_bill.png');

    expect(result.documentType).toBe('IMAGE');
    expect(result.originalMimeType).toBe('image/png');
    expect(result.originalFileName).toBe('sample_bill.png');
    expect(result.pageCount).toBe(1);
    expect(result.pages).toHaveLength(1);

    const page1 = result.pages[0];
    expect(page1.pageNumber).toBe(1);
    expect(page1.mimeType).toBe('image/png');
    expect(page1.width).toBe(800);
    expect(page1.height).toBe(600);
    expect(page1.buffer).toBeInstanceOf(Buffer);
    expect(page1.preprocessingApplied).toContain('colorspace_srgb');
  });

  // ----------------------------------------------------
  // B. JPEG Input
  // ----------------------------------------------------
  it('Scenario B: Valid JPEG input normalizes color space and encodes to lossless PNG', async () => {
    const result = await preprocessDocument(sampleJpegBuffer, 'tax_invoice.jpg');

    expect(result.documentType).toBe('IMAGE');
    expect(result.originalMimeType).toBe('image/jpeg');
    expect(result.pageCount).toBe(1);

    const page = result.pages[0];
    expect(page.pageNumber).toBe(1);
    expect(page.mimeType).toBe('image/png');
    expect(page.width).toBe(1024);
    expect(page.height).toBe(768);
    expect(page.preprocessingApplied).toContain('colorspace_srgb');
  });

  // ----------------------------------------------------
  // C. Single-Page PDF Input
  // ----------------------------------------------------
  it('Scenario C: Valid single-page PDF renders and normalizes page 1 deterministically', async () => {
    const result = await preprocessDocument(singlePagePdfBuffer, 'purchase_invoice.pdf');

    expect(result.documentType).toBe('PDF');
    expect(result.originalMimeType).toBe('application/pdf');
    expect(result.pageCount).toBe(1);
    expect(result.pages).toHaveLength(1);

    const page = result.pages[0];
    expect(page.pageNumber).toBe(1);
    expect(page.mimeType).toBe('image/png');
    expect(page.width).toBeGreaterThan(0);
    expect(page.height).toBeGreaterThan(0);
    expect(page.buffer.length).toBeGreaterThan(100);
  });

  // ----------------------------------------------------
  // D. Multi-Page PDF Input
  // ----------------------------------------------------
  it('Scenario D: Multi-page PDF processes every page sequentially and preserves order', async () => {
    const result = await preprocessDocument(multiPagePdfBuffer, 'multi_item_bill.pdf');

    expect(result.documentType).toBe('PDF');
    expect(result.originalMimeType).toBe('application/pdf');
    expect(result.pageCount).toBe(3);
    expect(result.pages).toHaveLength(3);

    // Verify deterministic 1-indexed page ordering
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[1].pageNumber).toBe(2);
    expect(result.pages[2].pageNumber).toBe(3);

    for (const page of result.pages) {
      expect(page.mimeType).toBe('image/png');
      expect(page.buffer).toBeInstanceOf(Buffer);
      expect(page.width).toBeGreaterThan(0);
      expect(page.height).toBeGreaterThan(0);
    }
  });

  // ----------------------------------------------------
  // E. Unsupported MIME Type / Extension
  // ----------------------------------------------------
  it('Scenario E: Rejects unsupported file formats cleanly with UnsupportedFileTypeError', async () => {
    const textBuffer = Buffer.from('Just plain text bill summary');

    await expect(
      preprocessDocument(textBuffer, 'bill.txt')
    ).rejects.toThrow(UnsupportedFileTypeError);

    await expect(
      preprocessDocument(textBuffer, 'archive.zip')
    ).rejects.toThrow(UnsupportedFileTypeError);
  });

  // ----------------------------------------------------
  // F. Empty File
  // ----------------------------------------------------
  it('Scenario F: Rejects 0-byte empty file with EmptyFileError', async () => {
    const emptyBuffer = Buffer.alloc(0);

    await expect(
      preprocessDocument(emptyBuffer, 'empty_bill.pdf')
    ).rejects.toThrow(EmptyFileError);
  });

  // ----------------------------------------------------
  // G. Corrupt Image
  // ----------------------------------------------------
  it('Scenario G: Rejects corrupt/truncated image data safely', async () => {
    // Valid PNG signature followed by corrupted junk data
    const corruptPngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('corrupted payload that cannot be decoded as image'),
    ]);

    await expect(
      preprocessDocument(corruptPngBuffer, 'corrupt.png')
    ).rejects.toThrow();
  });

  // ----------------------------------------------------
  // H. Corrupt PDF
  // ----------------------------------------------------
  it('Scenario H: Rejects corrupt/truncated PDF file with CorruptFileError', async () => {
    const corruptPdfBuffer = Buffer.from('%PDF-1.4\n%broken junk data EOF');

    await expect(
      preprocessDocument(corruptPdfBuffer, 'broken.pdf')
    ).rejects.toThrow(CorruptFileError);
  });

  // ----------------------------------------------------
  // I. Page Limit Enforcement
  // ----------------------------------------------------
  it('Scenario I: Rejects PDF that exceeds configured maximum page limit', async () => {
    // multiPagePdfBuffer has 3 pages; set maxPages to 2
    await expect(
      preprocessDocument(multiPagePdfBuffer, 'long_bill.pdf', { maxPages: 2 })
    ).rejects.toThrow(PageLimitExceededError);
  });

  // ----------------------------------------------------
  // J. File Size Enforcement
  // ----------------------------------------------------
  it('Scenario J: Rejects document exceeding configured file size limit with FileSizeExceededError', async () => {
    // 2 MB dummy buffer with maxFileSizeMb set to 1 MB
    const largeDummyPng = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(2 * 1024 * 1024),
    ]);

    await expect(
      preprocessDocument(largeDummyPng, 'large_bill.png', { maxFileSizeMb: 1 })
    ).rejects.toThrow(FileSizeExceededError);
  });

  // ----------------------------------------------------
  // K. EXIF Orientation Handling
  // ----------------------------------------------------
  it('Scenario K: Auto-orients image based on EXIF tag to upright position', async () => {
    // Create an image with an EXIF orientation tag (Orientation 6 = 90 deg CW)
    const rotatedImageBuffer = await sharp({
      create: {
        width: 600,
        height: 400,
        channels: 3,
        background: { r: 200, g: 200, b: 200 },
      },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();

    const result = await preprocessDocument(rotatedImageBuffer, 'phone_photo.jpg');

    expect(result.pages[0].rotation).toBe(90);
    expect(result.pages[0].preprocessingApplied).toContain('exif_auto_rotate_90deg');
    // Once rotated 90 deg, original 600x400 becomes 400x600 upright
    expect(result.pages[0].width).toBe(400);
    expect(result.pages[0].height).toBe(600);
  });

  // ----------------------------------------------------
  // L. Deterministic Output
  // ----------------------------------------------------
  it('Scenario L: Identical inputs produce deterministic, repeatable dimensions and page numbers', async () => {
    const run1 = await preprocessDocument(singlePagePdfBuffer, 'invoice.pdf');
    const run2 = await preprocessDocument(singlePagePdfBuffer, 'invoice.pdf');

    expect(run1.pageCount).toBe(run2.pageCount);
    expect(run1.pages[0].width).toBe(run2.pages[0].width);
    expect(run1.pages[0].height).toBe(run2.pages[0].height);
    expect(run1.pages[0].pageNumber).toBe(run2.pages[0].pageNumber);
    expect(run1.pages[0].preprocessingApplied).toEqual(run2.pages[0].preprocessingApplied);
  });

  // ----------------------------------------------------
  // M. Magic Byte Signature Mismatch Detection
  // ----------------------------------------------------
  it('Scenario M: Detects extension spoofing (e.g. text/executable renamed to .pdf or .png)', () => {
    const fakePdf = Buffer.from('<html><body>Not a real PDF</body></html>');

    expect(() => {
      validateDocumentInput(fakePdf, 'fake.pdf');
    }).toThrow(UnsupportedFileTypeError);

    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ executable signature
    expect(() => {
      validateDocumentInput(exeBuffer, 'trojan.png');
    }).toThrow(UnsupportedFileTypeError);

    // PNG buffer declared as .pdf triggers FileSignatureMismatchError
    expect(() => {
      validateDocumentInput(samplePngBuffer, 'deceptive_bill.pdf');
    }).toThrow(FileSignatureMismatchError);

    // Verify direct signature detector helper
    const detectedPng = detectFileSignature(samplePngBuffer);
    expect(detectedPng.detectedMime).toBe('image/png');
    expect(detectedPng.detectedType).toBe('IMAGE');

    const detectedPdf = detectFileSignature(singlePagePdfBuffer);
    expect(detectedPdf.detectedMime).toBe('application/pdf');
    expect(detectedPdf.detectedType).toBe('PDF');
  });

  it('Unit: inspectPdfPageCount reads page count fast without rasterization overhead', async () => {
    const count = await inspectPdfPageCount(multiPagePdfBuffer, 10);
    expect(count).toBe(3);
  });

  // ----------------------------------------------------
  // N. Malicious Filename & Path Traversal Neutralization
  // ----------------------------------------------------
  it('Scenario N: Neutralizes directory traversal characters in filenames safely', async () => {
    const sanitized1 = sanitizeFilename('../../etc/passwd.pdf');
    expect(sanitized1).toBe('passwd.pdf');
    expect(sanitized1).not.toContain('..');
    expect(sanitized1).not.toContain('/');

    const sanitized2 = sanitizeFilename('..\\..\\windows\\system32\\cmd.exe.png');
    expect(sanitized2).toBe('cmd.exe.png');
    expect(sanitized2).not.toContain('\\');

    const result = await preprocessDocument(samplePngBuffer, '../../etc/secret_bill.png');
    expect(result.originalFileName).toBe('secret_bill.png');
  });

  // ----------------------------------------------------
  // Side-Effect Invariants Guarantee
  // ----------------------------------------------------
  it('Side-Effect Invariants: Document preprocessing NEVER mutates database or creates Purchase', async () => {
    const initialPurchaseCount = await Purchase.countDocuments();
    const initialProductCount = await Product.countDocuments();
    const initialVendorCount = await Vendor.countDocuments();

    // Execute multiple preprocessing runs
    await preprocessDocument(samplePngBuffer, 'bill_1.png');
    await preprocessDocument(sampleJpegBuffer, 'bill_2.jpg');
    await preprocessDocument(singlePagePdfBuffer, 'bill_3.pdf');
    await preprocessDocument(multiPagePdfBuffer, 'bill_4.pdf');

    // Verify zero database mutations
    expect(await Purchase.countDocuments()).toBe(initialPurchaseCount);
    expect(await Product.countDocuments()).toBe(initialProductCount);
    expect(await Vendor.countDocuments()).toBe(initialVendorCount);
  });
});
