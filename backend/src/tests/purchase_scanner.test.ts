import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';

// Mock DocumentGenerationService to bypass Puppeteer launch
jest.mock('../services/DocumentGenerationService', () => ({
  DocumentGenerationService: {
    generateDocuments: jest.fn().mockResolvedValue({
      snapshot: {
        publicId: 'businesses/test/invoices/test/original',
        secureUrl: 'https://res.cloudinary.com/test-cloud/image/upload/v1/original.png',
        width: 794,
        height: 1123,
      },
      pdf: {
        secureUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/invoice.pdf',
      },
    }),
    generateBuffers: jest.fn().mockResolvedValue({
      pngBuffer: Buffer.from('mock-png'),
      pdfBuffer: Buffer.from('mock-pdf'),
    }),
    generateAmcQuotationBuffers: jest.fn().mockResolvedValue({
      pngBuffer: Buffer.from('mock-png'),
      pdfBuffer: Buffer.from('mock-pdf'),
    }),
    generateAmcQuotationDocuments: jest.fn().mockResolvedValue({}),
  },
}));

import app from '../app';
import { env } from '../config/env';
import { User } from '../database/models/User';
import { Business } from '../database/models/Business';
import { BusinessMember } from '../database/models/BusinessMember';
import { Product } from '../database/models/Product';
import { Vendor } from '../database/models/Vendor';
import { Purchase } from '../database/models/Purchase';
import { PurchaseDraft } from '../database/models/PurchaseDraft';
import { PurchaseReceipt } from '../database/models/PurchaseReceipt';
import { InventoryTransaction } from '../database/models/InventoryTransaction';
import { NvidiaNimClient, NvidiaTimeoutError } from '../modules/purchase/scanner/nvidiaNimClient';
import { purchaseScannerService } from '../modules/purchase/scanner/purchaseScanner.service';
import * as cloudinaryService from '../services/cloudinary';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

jest.setTimeout(25000);

describe('Phase 3 — Purchase Scanner → Purchase Draft API Integration', () => {
  let samplePngBuffer: Buffer;
  let tokenA: string;
  let tokenB: string;
  let userA: any;
  let userB: any;
  let businessA: any;
  let businessB: any;
  let vendorA: any;
  let productA1: any;
  let productA2: any;
  let extractVisionSpy: jest.SpyInstance;
  let uploadBufferSpy: jest.SpyInstance;

  // Standard mock invoice response
  const standardExtractionOutput = {
    supplier: {
      name: 'Havells India Limited',
      gstin: '07AAACH1234A1Z5',
      pan: 'AAACH1234A',
      address: 'QRG Towers, Sector 126, Noida',
      city: 'Noida',
      state: 'Uttar Pradesh',
      stateCode: '09',
      pincode: '201304',
      phone: '0120-4771000',
      email: 'contact@havells.com',
    },
    invoice: {
      invoiceNumber: 'HVL-2026-9001',
      invoiceDate: '15/09/2026',
      dueDate: '15/10/2026',
      poNumber: 'PO-7788',
      ewayBillNumber: '121456789012',
      placeOfSupply: 'Gujarat',
      isReverseCharge: false,
    },
    items: [
      {
        lineNumber: 1,
        description: 'Heavy Duty Contactor 32A',
        skuOrCode: 'CONT-32A',
        hsnSac: '8536',
        quantity: 10,
        unit: 'NOS',
        unitPrice: 1000,
        discountPercent: 0,
        discountAmount: 0,
        taxableAmount: 10000,
        gstRate: 18,
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        igstRate: 18,
        igstAmount: 1800,
        cessRate: 0,
        cessAmount: 0,
        lineTotal: 11800,
      },
    ],
    summary: {
      subtotal: 10000,
      totalDiscount: 0,
      taxableAmount: 10000,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 1800,
      cessAmount: 0,
      totalTax: 1800,
      roundOff: 0,
      grandTotal: 11800,
      amountPaid: 0,
      balanceDue: 11800,
    },
    payment: {
      paymentMode: 'BANK_TRANSFER',
      bankName: 'HDFC Bank',
      bankAccountNumber: '50200012345678',
      bankIfsc: 'HDFC0000123',
    },
    additional: {
      notes: 'Standard warranty applicable.',
    },
  };

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    await mongoose.connect(TEST_MONGO_URI);

    // Clean test collections
    await PurchaseDraft.deleteMany({});
    await Purchase.deleteMany({});
    await PurchaseReceipt.deleteMany({});
    await InventoryTransaction.deleteMany({});
    await Vendor.deleteMany({});
    await Product.deleteMany({});
    await BusinessMember.deleteMany({});
    await Business.deleteMany({});
    await User.deleteMany({});

    // Generate valid PNG fixture
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

    // Create Tenant A
    userA = await User.create({
      name: 'Tenant A User',
      email: `tenant_a_${Date.now()}@jayramji.com`,
      passwordHash: 'dummyhash',
    });

    businessA = await Business.create({
      name: 'Business A Industrial',
      legalName: 'Business A Industrial Pvt Ltd',
      address: { line1: 'GIDC', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
      contact: { phone: '9825100001', email: 'bizA@jayramji.com' },
      ownerId: userA._id,
      active: true,
    });

    await BusinessMember.create({ businessId: businessA._id, userId: userA._id, role: 'OWNER' });
    tokenA = jwt.sign({ userId: userA._id, email: userA.email }, env.JWT_SECRET, { expiresIn: '1d' });

    // Create Tenant B
    userB = await User.create({
      name: 'Tenant B User',
      email: `tenant_b_${Date.now()}@jayramji.com`,
      passwordHash: 'dummyhash',
    });

    businessB = await Business.create({
      name: 'Business B Marine',
      legalName: 'Business B Marine LLP',
      address: { line1: 'Port Road', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
      contact: { phone: '9825100002', email: 'bizB@jayramji.com' },
      ownerId: userB._id,
      active: true,
    });

    await BusinessMember.create({ businessId: businessB._id, userId: userB._id, role: 'OWNER' });
    tokenB = jwt.sign({ userId: userB._id, email: userB.email }, env.JWT_SECRET, { expiresIn: '1d' });

    // Seed Vendor for Tenant A (matching test)
    vendorA = await Vendor.create({
      businessId: businessA._id,
      vendorCode: 'VEND-001',
      name: 'Havells India Limited',
      gstNumber: '07AAACH1234A1Z5',
      mobile: '0120-4771000',
      address: 'QRG Towers, Sector 126',
      city: 'Noida',
      state: 'Uttar Pradesh',
      isActive: true,
    });

    // Seed Products for Tenant A
    productA1 = await Product.create({
      businessId: businessA._id,
      type: 'PRODUCT',
      name: 'Heavy Duty Contactor 32A',
      sku: 'CONT-32A',
      barcode: '8901234567890',
      uom: 'NOS',
      defaultPriceMinor: 120000,
      stockQuantity: 50,
      active: true,
      deletedAt: null,
    });

    productA2 = await Product.create({
      businessId: businessA._id,
      type: 'PRODUCT',
      name: 'LED Industrial Bulb 50W',
      sku: 'BULB-50W',
      barcode: '8901234567891',
      uom: 'NOS',
      defaultPriceMinor: 60000,
      stockQuantity: 100,
      active: true,
      deletedAt: null,
    });

    // Setup default spy on NvidiaNimClient.prototype.extractDocumentVision
    extractVisionSpy = jest.spyOn(NvidiaNimClient.prototype, 'extractDocumentVision');
    extractVisionSpy.mockResolvedValue({
      rawText: JSON.stringify(standardExtractionOutput),
      model: 'meta/llama-3.2-11b-vision-instruct',
      durationMs: 150,
    });

    // Mock uploadBufferToCloudinary to avoid network calls
    uploadBufferSpy = jest.spyOn(cloudinaryService, 'uploadBufferToCloudinary').mockImplementation(
      async (_buf: Buffer, options: any) => ({
        public_id: `${options.folder}/${options.public_id}`,
        secure_url: `https://res.cloudinary.com/mock-cloud/image/upload/v1/${options.folder}/${options.public_id}.png`,
      })
    );
  });

  afterAll(async () => {
    extractVisionSpy?.mockRestore();
    uploadBufferSpy?.mockRestore();
    await mongoose.disconnect();
  });

  beforeEach(() => {
    extractVisionSpy = jest.spyOn(NvidiaNimClient.prototype, 'extractDocumentVision');
    extractVisionSpy.mockResolvedValue({
      rawText: JSON.stringify(standardExtractionOutput),
      model: 'meta/llama-3.2-11b-vision-instruct',
      durationMs: 10,
    });

    uploadBufferSpy = jest.spyOn(cloudinaryService, 'uploadBufferToCloudinary');
    uploadBufferSpy.mockImplementation(
      async (_buf: Buffer, options: any) => ({
        public_id: `${options.folder}/${options.public_id}`,
        secure_url: `https://res.cloudinary.com/mock-cloud/image/upload/v1/${options.folder}/${options.public_id}.png`,
      })
    );
  });

  // ----------------------------------------------------
  // 1. Authentication
  // ----------------------------------------------------
  describe('1. Authentication Guard', () => {
    it('1. unauthenticated scanner request rejected with 401', async () => {
      const res = await request(app)
        .post('/api/purchases/scanner/draft')
        .attach('file', samplePngBuffer, 'invoice.png');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('2. authenticated request succeeds with 201', async () => {
      const res = await request(app)
        .post('/api/purchases/scanner/draft')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .attach('file', samplePngBuffer, 'invoice.png');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.draft).toBeDefined();
      expect(res.body.draft.draftNumber).toMatch(/^DRF-\d{4}-\d{4}$/);
    });
  });

  // ----------------------------------------------------
  // 2. Tenant Isolation
  // ----------------------------------------------------
  describe('2. Tenant Isolation', () => {
    let draftA: any;

    beforeAll(async () => {
      draftA = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'tenant_iso.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });
    });

    it('3. draft persists with authenticated businessId', async () => {
      const retrieved = await PurchaseDraft.findById(draftA._id);
      expect(retrieved?.businessId.toString()).toBe(businessA._id.toString());
    });

    it('4. client businessId cannot override authenticated businessId', async () => {
      const res = await request(app)
        .post('/api/purchases/scanner/draft')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .field('businessId', businessB._id.toString()) // Attempted spoofing
        .attach('file', samplePngBuffer, 'invoice.png');

      expect(res.status).toBe(201);
      expect(res.body.draft.businessId).toBe(businessA._id.toString());
      expect(res.body.draft.businessId).not.toBe(businessB._id.toString());
    });

    it('5. tenant B cannot GET tenant A draft (returns 404 without data leak)', async () => {
      const res = await request(app)
        .get(`/api/purchases/scanner/drafts/${draftA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-business-id', businessB._id.toString());

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error?.message).toMatch(/not found/i);
    });

    it('6. tenant B cannot PATCH tenant A draft (returns 404 without data leak)', async () => {
      const res = await request(app)
        .patch(`/api/purchases/scanner/drafts/${draftA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-business-id', businessB._id.toString())
        .send({ notes: 'Malicious update attempt' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      // Verify draft A was not modified
      const check = await PurchaseDraft.findById(draftA._id);
      expect(check?.extraction.additional.notes.value).not.toBe('Malicious update attempt');
    });
  });

  // ----------------------------------------------------
  // 3. Idempotency
  // ----------------------------------------------------
  describe('3. Idempotency & Concurrency', () => {
    it('7 & 8 & 10. same business + same key returns same draft without re-invoking NVIDIA', async () => {
      const idempotencyKey = `IDEM-KEY-${Date.now()}`;

      // First request
      const res1 = await request(app)
        .post('/api/purchases/scanner/draft')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', samplePngBuffer, 'invoice.png');

      expect(res1.status).toBe(201);
      const draftId1 = res1.body.draft.id;
      expect(extractVisionSpy).toHaveBeenCalledTimes(1);

      // Repeated request with same key
      const res2 = await request(app)
        .post('/api/purchases/scanner/draft')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .set('Idempotency-Key', idempotencyKey)
        .attach('file', samplePngBuffer, 'invoice.png');

      expect(res2.status).toBe(201);
      expect(res2.body.draft.id).toBe(draftId1);
      // NVIDIA NIM should NOT have been called a second time
      expect(extractVisionSpy).toHaveBeenCalledTimes(1);
    });

    it('9. different business + same key creates independent drafts', async () => {
      const sharedKey = `CROSS-BIZ-${Date.now()}`;

      // Business A with shared key
      const resA = await request(app)
        .post('/api/purchases/scanner/draft')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .set('Idempotency-Key', sharedKey)
        .attach('file', samplePngBuffer, 'invoice.png');

      expect(resA.status).toBe(201);

      // Business B with same shared key
      const resB = await request(app)
        .post('/api/purchases/scanner/draft')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-business-id', businessB._id.toString())
        .set('Idempotency-Key', sharedKey)
        .attach('file', samplePngBuffer, 'invoice.png');

      expect(resB.status).toBe(201);
      expect(resA.body.draft.id).not.toBe(resB.body.draft.id);
      expect(resA.body.draft.businessId).toBe(businessA._id.toString());
      expect(resB.body.draft.businessId).toBe(businessB._id.toString());
    });

    it('37. concurrent duplicate requests with same key handled safely via unique index', async () => {
      const concurrentKey = `CONCURRENT-KEY-${Date.now()}`;

      // Fire 2 concurrent requests
      const [p1, p2] = await Promise.all([
        purchaseScannerService.scanAndCreateDraft({
          businessId: businessA._id,
          userId: userA._id,
          fileBuffer: samplePngBuffer,
          fileName: 'concurrent1.png',
          mimeType: 'image/png',
          fileSize: samplePngBuffer.length,
          idempotencyKey: concurrentKey,
        }),
        purchaseScannerService.scanAndCreateDraft({
          businessId: businessA._id,
          userId: userA._id,
          fileBuffer: samplePngBuffer,
          fileName: 'concurrent2.png',
          mimeType: 'image/png',
          fileSize: samplePngBuffer.length,
          idempotencyKey: concurrentKey,
        }),
      ]);

      expect(p1.id).toBe(p2.id);
      // Ensure only 1 draft in database with this key
      const count = await PurchaseDraft.countDocuments({
        businessId: businessA._id,
        idempotencyKey: concurrentKey,
      });
      expect(count).toBe(1);
    });
  });

  // ----------------------------------------------------
  // 4. Extraction & Missing Values
  // ----------------------------------------------------
  describe('4. Extraction & Missing Data Handling', () => {
    it('11. successful extraction creates draft with typed fields', async () => {
      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'bill.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      expect(draft.status).toBe('DRAFT_READY');
      expect(draft.extraction.supplier.name.value).toBe('Havells India Limited');
      expect(draft.extraction.invoice.invoiceNumber.value).toBe('HVL-2026-9001');
      expect(draft.extraction.invoice.invoiceDate.value).toBe('2026-09-15');
      expect(draft.extraction.items).toHaveLength(1);
      expect(draft.extraction.items[0].description.value).toBe('Heavy Duty Contactor 32A');
    });

    it('12 & 16. missing optional values remain null with MISSING status (no hallucinations)', async () => {
      extractVisionSpy.mockResolvedValue({
        rawText: JSON.stringify({
          supplier: { name: 'Unregistered Local Trader' },
          invoice: { invoiceNumber: null, invoiceDate: null, dueDate: null },
          items: [{ lineNumber: 1, description: 'General Cable', quantity: 5, unitPrice: 200, lineTotal: 1000 }],
          summary: { grandTotal: 1000 },
          payment: {},
          additional: {},
        }),
        model: 'meta/llama-3.2-11b-vision-instruct',
        durationMs: 120,
      });

      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'sparse.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      expect(draft.extraction.invoice.invoiceNumber.value).toBeNull();
      expect(draft.extraction.invoice.invoiceNumber.status).toBe('MISSING');
      expect(draft.extraction.invoice.dueDate.value).toBeNull();
      expect(draft.extraction.invoice.dueDate.status).toBe('MISSING');
      expect(draft.extraction.items[0].hsnSac.value).toBeNull();
      expect(draft.extraction.items[0].hsnSac.status).toBe('MISSING');
    });

    it('13. malformed extraction response fails safely without creating draft', async () => {
      extractVisionSpy.mockResolvedValue({
        rawText: '<<<INVALID UNPARSEABLE NON-JSON>>>',
        model: 'meta/llama-3.2-11b-vision-instruct',
        durationMs: 100,
      });

      const countBefore = await PurchaseDraft.countDocuments();

      await expect(
        purchaseScannerService.scanAndCreateDraft({
          businessId: businessA._id,
          userId: userA._id,
          fileBuffer: samplePngBuffer,
          fileName: 'malformed.png',
          mimeType: 'image/png',
          fileSize: samplePngBuffer.length,
        })
      ).rejects.toThrow();

      const countAfter = await PurchaseDraft.countDocuments();
      expect(countAfter).toBe(countBefore);
    });

    it('14 & 15. NVIDIA timeout fails safely without creating draft', async () => {
      extractVisionSpy.mockRejectedValue(new NvidiaTimeoutError(60000));

      const countBefore = await PurchaseDraft.countDocuments();

      await expect(
        purchaseScannerService.scanAndCreateDraft({
          businessId: businessA._id,
          userId: userA._id,
          fileBuffer: samplePngBuffer,
          fileName: 'timeout.png',
          mimeType: 'image/png',
          fileSize: samplePngBuffer.length,
        })
      ).rejects.toThrow(/timed out/i);

      const countAfter = await PurchaseDraft.countDocuments();
      expect(countAfter).toBe(countBefore);
    });
  });

  // ----------------------------------------------------
  // 5. Deterministic Financial Validation
  // ----------------------------------------------------
  describe('5. Deterministic Financial Validation', () => {
    it('17 & 18. financial mismatch produces discrepancy warning while preserving printed numbers', async () => {
      // Intentionally create mismatch: item total 10,000 + 1,800 tax = 11,800, but printed grandTotal is 12,500
      const mismatchedOutput = {
        ...standardExtractionOutput,
        summary: {
          ...standardExtractionOutput.summary,
          grandTotal: 12500, // ₹700 printed discrepancy
        },
      };

      extractVisionSpy.mockResolvedValue({
        rawText: JSON.stringify(mismatchedOutput),
        model: 'meta/llama-3.2-11b-vision-instruct',
        durationMs: 140,
      });

      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'math_mismatch.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      expect(draft.reconciliation.hasDiscrepancies).toBe(true);
      expect(draft.reconciliation.isMathValid).toBe(false);
      expect(draft.reconciliation.discrepancyNotes.some((n) => n.includes('Grand Total mismatch'))).toBe(true);
      // Preserves original printed value
      expect(draft.extraction.summary.grandTotal.value).toBe(12500);
      expect(draft.reconciliation.calculatedGrandTotal).toBe(11800);
    });

    it('19. AI confidence (even 0.99) does not become VERIFIED on extraction', async () => {
      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'confidence_test.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      // Extracted field confidence is high, but status remains EXTRACTED
      expect(draft.extraction.supplier.name.confidence).toBeGreaterThanOrEqual(0.85);
      expect(draft.extraction.supplier.name.status).toBe('EXTRACTED');
    });
  });

  // ----------------------------------------------------
  // 6. Vendor Matching
  // ----------------------------------------------------
  describe('6. Vendor Matching Integration', () => {
    it('20. exact GSTIN match sets status to VERIFIED', async () => {
      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'vendor_gstin.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      expect(draft.vendorMatch.matchedVendorId).toBe(vendorA._id.toString());
      expect(draft.vendorMatch.matchingMethod).toBe('EXACT_GSTIN');
      expect(draft.vendorMatch.status).toBe('VERIFIED');
    });

    it('21. exact Name match requires review (REVIEW_REQUIRED)', async () => {
      // Match by name only (omitting GSTIN)
      extractVisionSpy.mockResolvedValue({
        rawText: JSON.stringify({
          ...standardExtractionOutput,
          supplier: {
            name: 'Havells India Limited',
            gstin: null,
            pan: null,
          },
        }),
        model: 'meta/llama-3.2-11b-vision-instruct',
        durationMs: 140,
      });

      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'vendor_name.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      expect(draft.vendorMatch.matchedVendorId).toBe(vendorA._id.toString());
      expect(draft.vendorMatch.matchingMethod).toBe('EXACT_NAME');
      expect(draft.vendorMatch.status).toBe('REVIEW_REQUIRED');
    });

    it('22 & 23. unmatched vendor remains unresolved and creates zero Vendor records', async () => {
      const vendorCountBefore = await Vendor.countDocuments();

      extractVisionSpy.mockResolvedValue({
        rawText: JSON.stringify({
          ...standardExtractionOutput,
          supplier: {
            name: 'Completely Unknown New Supplier 999',
            gstin: '24ZZZZZ9999Z1Z1',
          },
        }),
        model: 'meta/llama-3.2-11b-vision-instruct',
        durationMs: 140,
      });

      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'unmatched_vendor.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      expect(draft.vendorMatch.matchedVendorId).toBeNull();
      expect(draft.vendorMatch.matchingMethod).toBe('NO_MATCH');
      expect(draft.vendorMatch.status).toBe('MISSING');

      const vendorCountAfter = await Vendor.countDocuments();
      expect(vendorCountAfter).toBe(vendorCountBefore);
    });
  });

  // ----------------------------------------------------
  // 7. Product Matching
  // ----------------------------------------------------
  describe('7. Product Matching Integration', () => {
    it('24. exact SKU match produces VERIFIED status', async () => {
      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'sku_match.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      const item = draft.extraction.items[0];
      expect(item.productMatch?.productId).toBe(productA1._id.toString());
      expect(item.productMatch?.matchingMethod).toBe('EXACT_SKU');
      expect(item.productMatch?.status).toBe('VERIFIED');
    });

    it('25. exact Barcode match produces VERIFIED status', async () => {
      extractVisionSpy.mockResolvedValue({
        rawText: JSON.stringify({
          ...standardExtractionOutput,
          items: [
            {
              lineNumber: 1,
              description: 'Unknown Description',
              skuOrCode: '8901234567891', // Product A2's barcode
              quantity: 1,
              unitPrice: 400,
              lineTotal: 400,
            },
          ],
        }),
        model: 'meta/llama-3.2-11b-vision-instruct',
        durationMs: 140,
      });

      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'barcode_match.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      const item = draft.extraction.items[0];
      expect(item.productMatch?.productId).toBe(productA2._id.toString());
      expect(item.productMatch?.matchingMethod).toBe('EXACT_BARCODE');
      expect(item.productMatch?.status).toBe('VERIFIED');
    });

    it('26. exact Name match requires review (REVIEW_REQUIRED)', async () => {
      extractVisionSpy.mockResolvedValue({
        rawText: JSON.stringify({
          ...standardExtractionOutput,
          items: [
            {
              lineNumber: 1,
              description: 'LED Industrial Bulb 50W', // Matches Product A2 by name
              skuOrCode: null,
              quantity: 2,
              unitPrice: 400,
              lineTotal: 800,
            },
          ],
        }),
        model: 'meta/llama-3.2-11b-vision-instruct',
        durationMs: 140,
      });

      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'name_match.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      const item = draft.extraction.items[0];
      expect(item.productMatch?.productId).toBe(productA2._id.toString());
      expect(item.productMatch?.matchingMethod).toBe('EXACT_NAME');
      expect(item.productMatch?.status).toBe('REVIEW_REQUIRED');
    });

    it('27 & 28. spec conflict requires review & creates zero Product records', async () => {
      const productCountBefore = await Product.countDocuments();

      extractVisionSpy.mockResolvedValue({
        rawText: JSON.stringify({
          ...standardExtractionOutput,
          items: [
            {
              lineNumber: 1,
              description: 'LED Industrial Bulb 500W', // Conflicting rating (500W vs 50W)
              skuOrCode: null,
              quantity: 1,
              unitPrice: 2000,
              lineTotal: 2000,
            },
          ],
        }),
        model: 'meta/llama-3.2-11b-vision-instruct',
        durationMs: 140,
      });

      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'conflict_prod.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      const item = draft.extraction.items[0];
      expect(item.productMatch?.status).toBe('REVIEW_REQUIRED');

      const productCountAfter = await Product.countDocuments();
      expect(productCountAfter).toBe(productCountBefore);
    });
  });

  // ----------------------------------------------------
  // 8. Draft Integrity & Patching
  // ----------------------------------------------------
  describe('8. Draft Integrity & Patch Updates', () => {
    let baseDraft: any;

    beforeEach(async () => {
      baseDraft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'patch_test.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });
    });

    it('29 & 30. rawExtraction remains immutable while working extraction updates', async () => {
      const originalRawInvoiceNo = baseDraft.rawExtraction.invoice.invoiceNumber.value;
      const originalWorkingInvoiceNo = baseDraft.extraction.invoice.invoiceNumber.value;
      expect(originalWorkingInvoiceNo).toBe('HVL-2026-9001');

      const res = await request(app)
        .patch(`/api/purchases/scanner/drafts/${baseDraft._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({
          vendorInvoiceNumber: 'USER-MODIFIED-999',
          notes: 'Customer verified invoice number manually',
        });

      expect(res.status).toBe(200);
      expect(res.body.draft.extraction.invoice.invoiceNumber.value).toBe('USER-MODIFIED-999');
      expect(res.body.draft.rawExtraction.invoice.invoiceNumber.value).toBe(originalRawInvoiceNo);
      expect(res.body.draft.rawExtraction.invoice.invoiceNumber.value).not.toBe('USER-MODIFIED-999');
    });

    it('31. protected fields cannot be updated by client', async () => {
      const res = await request(app)
        .patch(`/api/purchases/scanner/drafts/${baseDraft._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({
          draftNumber: 'HACKED-DRF',
          status: 'CONVERTED',
          businessId: businessB._id.toString(),
        });

      // Zod schema strict() rejects unexpected server-controlled fields
      expect(res.status).toBe(400);

      // Verify draft untouched in DB
      const check = await PurchaseDraft.findById(baseDraft._id);
      expect(check?.draftNumber).toBe(baseDraft.draftNumber);
      expect(check?.status).toBe('DRAFT_READY');
      expect(check?.businessId.toString()).toBe(businessA._id.toString());
    });

    it('32. expired draft cannot be updated (fails with 400)', async () => {
      // Force draft into expired state
      await PurchaseDraft.updateOne(
        { _id: baseDraft._id },
        { $set: { expiresAt: new Date(Date.now() - 3600000) } } // 1 hour ago
      );

      const res = await request(app)
        .patch(`/api/purchases/scanner/drafts/${baseDraft._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({ notes: 'Should fail on expired draft' });

      expect(res.status).toBe(400);
      expect(res.body.error?.message).toMatch(/expired/i);
    });
  });

  // ----------------------------------------------------
  // 9. Side Effects Verification
  // ----------------------------------------------------
  describe('9. Side-Effect Assertions (Zero Side Effects)', () => {
    it('34 to 39. scanner creates NO Purchase, Receipt, Transaction, Vendor, Product, or Stock change', async () => {
      const purchaseCountBefore = await Purchase.countDocuments();
      const receiptCountBefore = await PurchaseReceipt.countDocuments();
      const transactionCountBefore = await InventoryTransaction.countDocuments();
      const vendorCountBefore = await Vendor.countDocuments();
      const productCountBefore = await Product.countDocuments();

      const prod1Before = await Product.findById(productA1._id);
      const stockBefore = prod1Before?.stockQuantity;

      // Run full scanner API call
      const res = await request(app)
        .post('/api/purchases/scanner/draft')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .attach('file', samplePngBuffer, 'side_effect_test.png');

      expect(res.status).toBe(201);

      const purchaseCountAfter = await Purchase.countDocuments();
      const receiptCountAfter = await PurchaseReceipt.countDocuments();
      const transactionCountAfter = await InventoryTransaction.countDocuments();
      const vendorCountAfter = await Vendor.countDocuments();
      const productCountAfter = await Product.countDocuments();

      const prod1After = await Product.findById(productA1._id);
      const stockAfter = prod1After?.stockQuantity;

      // Strict assertions: ALL counts remain identical
      expect(purchaseCountAfter).toBe(purchaseCountBefore);
      expect(receiptCountAfter).toBe(receiptCountBefore);
      expect(transactionCountAfter).toBe(transactionCountBefore);
      expect(vendorCountAfter).toBe(vendorCountBefore);
      expect(productCountAfter).toBe(productCountBefore);
      expect(stockAfter).toBe(stockBefore);
    });
  });

  // ----------------------------------------------------
  // 10. Storage & Duplicate Vendor Invoice
  // ----------------------------------------------------
  describe('10. Original Document Storage & Duplicate Invoice', () => {
    it('40. original document reference is preserved in draft', async () => {
      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'document_ref.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      expect(draft.originalFile.fileName).toBe('document_ref.png');
      expect(draft.originalFile.mimeType).toBe('image/png');
      expect(draft.originalFile.fileSize).toBe(samplePngBuffer.length);
      expect(draft.originalFile.fileUrl).toContain('cloudinary');
      expect(draft.originalFile.publicId).toBeDefined();
    });

    it('41. storage upload failure does not create misleading successful draft', async () => {
      const uploadSpy = jest
        .spyOn(cloudinaryService, 'uploadBufferToCloudinary')
        .mockRejectedValueOnce(new Error('Cloudinary connection failure'));

      const countBefore = await PurchaseDraft.countDocuments();

      await expect(
        purchaseScannerService.scanAndCreateDraft({
          businessId: businessA._id,
          userId: userA._id,
          fileBuffer: samplePngBuffer,
          fileName: 'upload_fail.png',
          mimeType: 'image/png',
          fileSize: samplePngBuffer.length,
        })
      ).rejects.toThrow(/Failed to store original bill document/i);

      const countAfter = await PurchaseDraft.countDocuments();
      expect(countAfter).toBe(countBefore);

      uploadSpy.mockRestore();
    });

    it('42 & 43. duplicate vendor invoice produces warning without modifying existing Purchase', async () => {
      // 1. Create existing active purchase for vendorA with invoice number HVL-2026-9001
      const existingPurchase = await Purchase.create({
        businessId: businessA._id,
        purchaseNumber: 'PUR-2526-0099',
        purchaseType: 'DIRECT_PURCHASE',
        vendorId: vendorA._id,
        vendorInvoiceNumber: 'HVL-2026-9001',
        purchaseDate: new Date('2026-09-10'),
        receivingStatus: 'NOT_RECEIVED',
        paymentStatus: 'UNPAID',
        subtotal: 5000,
        discountAmount: 0,
        taxAmount: 900,
        totalAmount: 5900,
        paidAmount: 0,
        outstandingAmount: 5900,
        status: 'CONFIRMED',
        createdBy: userA._id,
        items: [
          {
            productId: productA1._id,
            productNameSnapshot: 'Heavy Duty Contactor 32A',
            skuSnapshot: 'CONT-32A',
            orderedQuantity: 5,
            receivedQuantity: 0,
            remainingQuantity: 5,
            unitPurchasePrice: 1000,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 18,
            taxAmount: 900,
            totalAmount: 5900,
            receivingStatus: 'NOT_RECEIVED',
          },
        ],
      });

      const existingPurchaseUpdatedAtBefore = existingPurchase.updatedAt;

      // 2. Scan invoice with matching vendor and same invoice number HVL-2026-9001
      const draft = await purchaseScannerService.scanAndCreateDraft({
        businessId: businessA._id,
        userId: userA._id,
        fileBuffer: samplePngBuffer,
        fileName: 'duplicate_bill.png',
        mimeType: 'image/png',
        fileSize: samplePngBuffer.length,
      });

      // 3. Draft has DUPLICATE_VENDOR_INVOICE warning in reconciliation
      expect(draft.reconciliation.hasDiscrepancies).toBe(true);
      expect(
        draft.reconciliation.discrepancyNotes.some((note) =>
          note.includes('DUPLICATE_VENDOR_INVOICE')
        )
      ).toBe(true);

      // 4. Existing Purchase was NOT modified or cancelled
      const checkExisting = await Purchase.findById(existingPurchase._id);
      expect(checkExisting?.status).toBe('CONFIRMED');
      expect(checkExisting?.purchaseNumber).toBe('PUR-2526-0099');
      expect(checkExisting?.updatedAt.getTime()).toBe(existingPurchaseUpdatedAtBefore.getTime());
    });
  });
});
