import mongoose from 'mongoose';
import { PurchaseDraft, IPurchaseBillExtraction } from '../database/models/PurchaseDraft';
import { User } from '../database/models/User';
import { Business } from '../database/models/Business';
import { BusinessMember } from '../database/models/BusinessMember';
import {
  purchaseDraftSchema,
  editableDraftFieldsSchema,
  extractedLineItemSchema,
  summaryExtractionSchema,
} from '../modules/purchase/draft/purchaseDraft.schema';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

let testUser: any;
let businessA: any;
let businessB: any;

function createSampleExtraction(overrides: Partial<IPurchaseBillExtraction> = {}): IPurchaseBillExtraction {
  return {
    supplier: {
      name: { value: 'Havells India Limited', confidence: 0.98, status: 'EXTRACTED' },
      gstin: { value: '07AAACH1234A1Z5', confidence: 0.99, status: 'EXTRACTED' },
      pan: { value: 'AAACH1234A', confidence: 0.95, status: 'EXTRACTED' },
      address: { value: 'QRG Towers, 2D, Sector 126', confidence: 0.9, status: 'EXTRACTED' },
      city: { value: 'Noida', confidence: 0.9, status: 'EXTRACTED' },
      state: { value: 'Uttar Pradesh', confidence: 0.9, status: 'EXTRACTED' },
      stateCode: { value: '09', confidence: 0.95, status: 'EXTRACTED' },
      pincode: { value: '201304', confidence: 0.95, status: 'EXTRACTED' },
      phone: { value: '0120-4771000', confidence: 0.85, status: 'EXTRACTED' },
      email: { value: 'contact@havells.com', confidence: 0.85, status: 'EXTRACTED' },
    },
    invoice: {
      invoiceNumber: { value: 'HVL-2026-8890', confidence: 0.97, status: 'EXTRACTED' },
      invoiceDate: { value: '2026-09-18', confidence: 0.98, status: 'EXTRACTED' },
      dueDate: { value: '2026-10-18', confidence: 0.9, status: 'EXTRACTED' },
      poNumber: { value: 'PO-9912', confidence: 0.88, status: 'EXTRACTED' },
      ewayBillNumber: { value: '121456789012', confidence: 0.92, status: 'EXTRACTED' },
      placeOfSupply: { value: 'Gujarat', confidence: 0.95, status: 'EXTRACTED' },
      isReverseCharge: { value: false, confidence: 0.99, status: 'EXTRACTED' },
    },
    items: [
      {
        id: 'item-row-1',
        lineNumber: 1,
        description: { value: 'Heavy Duty Contactor 32A', confidence: 0.96, status: 'EXTRACTED' },
        skuOrCode: { value: 'CONT-32A', confidence: 0.9, status: 'EXTRACTED' },
        hsnSac: { value: '8536', confidence: 0.92, status: 'EXTRACTED' },
        quantity: { value: 4, confidence: 0.99, status: 'EXTRACTED' },
        unit: { value: 'NOS', confidence: 0.95, status: 'EXTRACTED' },
        unitPrice: { value: 1250, confidence: 0.98, status: 'EXTRACTED' }, // ₹1,250
        discountPercent: { value: 5, confidence: 0.9, status: 'EXTRACTED' },
        discountAmount: { value: 250, confidence: 0.9, status: 'EXTRACTED' },
        taxableAmount: { value: 4750, confidence: 0.95, status: 'EXTRACTED' },
        gstRate: { value: 18, confidence: 0.98, status: 'EXTRACTED' },
        cgstRate: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
        cgstAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
        sgstRate: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
        sgstAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
        igstRate: { value: 18, confidence: 0.98, status: 'EXTRACTED' },
        igstAmount: { value: 855, confidence: 0.95, status: 'EXTRACTED' },
        cessRate: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
        cessAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
        lineTotal: { value: 5605, confidence: 0.98, status: 'EXTRACTED' },
        calculated: {
          taxableAmount: 4750,
          cgstAmount: 0,
          sgstAmount: 0,
          igstAmount: 855,
          cessAmount: 0,
          lineTotal: 5605,
          discrepancy: 0,
        },
      },
    ],
    summary: {
      subtotal: { value: 5000, confidence: 0.98, status: 'EXTRACTED' },
      totalDiscount: { value: 250, confidence: 0.92, status: 'EXTRACTED' },
      taxableAmount: { value: 4750, confidence: 0.98, status: 'EXTRACTED' },
      cgstAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
      sgstAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
      igstAmount: { value: 855, confidence: 0.98, status: 'EXTRACTED' },
      cessAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
      totalTax: { value: 855, confidence: 0.98, status: 'EXTRACTED' },
      roundOff: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
      grandTotal: { value: 5605, confidence: 0.99, status: 'EXTRACTED' },
      amountPaid: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
      balanceDue: { value: 5605, confidence: 0.95, status: 'EXTRACTED' },
    },
    payment: {
      paymentMode: { value: 'BANK_TRANSFER', confidence: 0.85, status: 'EXTRACTED' },
      bankName: { value: 'HDFC Bank', confidence: 0.88, status: 'EXTRACTED' },
      bankAccountNumber: { value: '50200012345678', confidence: 0.89, status: 'EXTRACTED' },
      bankIfsc: { value: 'HDFC0000123', confidence: 0.92, status: 'EXTRACTED' },
      upiId: { value: null, confidence: 0, status: 'MISSING' },
      transactionReference: { value: null, confidence: 0, status: 'MISSING' },
    },
    additional: {
      notes: { value: 'Goods once sold will not be taken back.', confidence: 0.9, status: 'EXTRACTED' },
      termsAndConditions: { value: 'Payment due within 30 days.', confidence: 0.9, status: 'EXTRACTED' },
      vehicleNumber: { value: null, confidence: 0, status: 'MISSING' },
    },
    ...overrides,
  };
}

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);

  await PurchaseDraft.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});

  testUser = await User.create({
    name: 'Draft Test User',
    email: `draft_user_${Date.now()}@jayramji.com`,
    passwordHash: 'dummyhash',
  });

  businessA = await Business.create({
    name: 'Business A Electronics',
    legalName: 'Business A Electronics Pvt Ltd',
    address: { line1: 'GIDC', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    contact: { phone: '9825100001', email: 'bizA@jayramji.com' },
    ownerId: testUser._id,
    active: true,
  });

  businessB = await Business.create({
    name: 'Business B Refrigeration',
    legalName: 'Business B Refrigeration LLP',
    address: { line1: 'Port Road', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    contact: { phone: '9825100002', email: 'bizB@jayramji.com' },
    ownerId: testUser._id,
    active: true,
  });

  await BusinessMember.create([
    { businessId: businessA._id, userId: testUser._id, role: 'OWNER' },
    { businessId: businessB._id, userId: testUser._id, role: 'OWNER' },
  ]);

  // Drop test collection to cleanly rebuild updated indexes without stale index option conflicts
  try {
    await PurchaseDraft.collection.drop();
  } catch {
    // collection may not exist yet on fresh database
  }
  await PurchaseDraft.createIndexes();
});

afterAll(async () => {
  await PurchaseDraft.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

describe('Phase 2A — PurchaseDraft Model & Contract Foundation', () => {
  describe('1. Mongoose Model Creation & Invariants', () => {
    it('should successfully create and persist a valid PurchaseDraft', async () => {
      const sampleExtraction = createSampleExtraction();

      const draft = await PurchaseDraft.create({
        businessId: businessA._id,
        draftNumber: 'DRF-2526-0001',
        originalFile: {
          fileName: 'havells_invoice_09.pdf',
          fileSize: 204850,
          mimeType: 'application/pdf',
          fileUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/sample.pdf',
          publicId: 'purchase_raw_123',
          pageCount: 1,
          previewImages: ['https://res.cloudinary.com/test-cloud/image/upload/v1/preview.png'],
        },
        rawExtraction: sampleExtraction,
        extraction: sampleExtraction,
        reconciliation: {
          isMathValid: true,
          hasDiscrepancies: false,
          discrepancyNotes: [],
          calculatedSubtotal: 5000,
          calculatedTaxTotal: 855,
          calculatedGrandTotal: 5605,
        },
        vendorMatch: {
          matchedVendorId: null,
          matchedVendorName: null,
          matchedVendorGstin: null,
          matchingMethod: 'NO_MATCH',
          confidence: 0,
          status: 'MISSING',
          alternatives: [],
        },
        status: 'DRAFT_READY',
        createdBy: testUser._id,
      });

      expect(draft).toBeDefined();
      expect(draft._id).toBeDefined();
      expect(draft.draftNumber).toBe('DRF-2526-0001');
      expect(draft.status).toBe('DRAFT_READY');
      expect(draft.expiresAt).toBeDefined();
      expect(draft.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should require businessId', async () => {
      const sampleExtraction = createSampleExtraction();
      await expect(
        PurchaseDraft.create({
          draftNumber: 'DRF-2526-0002',
          originalFile: {
            fileName: 'invoice.pdf',
            fileSize: 1000,
            mimeType: 'application/pdf',
            fileUrl: 'https://res.cloudinary.com/test/invoice.pdf',
            publicId: 'test_123',
          },
          rawExtraction: sampleExtraction,
          extraction: sampleExtraction,
          createdBy: testUser._id,
        })
      ).rejects.toThrow(/businessId/i);
    });

    it('should require draftNumber', async () => {
      const sampleExtraction = createSampleExtraction();
      await expect(
        PurchaseDraft.create({
          businessId: businessA._id,
          originalFile: {
            fileName: 'invoice.pdf',
            fileSize: 1000,
            mimeType: 'application/pdf',
            fileUrl: 'https://res.cloudinary.com/test/invoice.pdf',
            publicId: 'test_123',
          },
          rawExtraction: sampleExtraction,
          extraction: sampleExtraction,
          createdBy: testUser._id,
        })
      ).rejects.toThrow(/draftNumber/i);
    });

    it('should require originalFile', async () => {
      const sampleExtraction = createSampleExtraction();
      await expect(
        PurchaseDraft.create({
          businessId: businessA._id,
          draftNumber: 'DRF-2526-0003',
          rawExtraction: sampleExtraction,
          extraction: sampleExtraction,
          createdBy: testUser._id,
        })
      ).rejects.toThrow(/originalFile/i);
    });

    it('should reject invalid Draft status', async () => {
      const sampleExtraction = createSampleExtraction();
      await expect(
        PurchaseDraft.create({
          businessId: businessA._id,
          draftNumber: 'DRF-2526-0004',
          originalFile: {
            fileName: 'invoice.pdf',
            fileSize: 1000,
            mimeType: 'application/pdf',
            fileUrl: 'https://res.cloudinary.com/test/invoice.pdf',
            publicId: 'test_123',
          },
          rawExtraction: sampleExtraction,
          extraction: sampleExtraction,
          status: 'INVALID_UNKNOWN_STATUS' as any,
          createdBy: testUser._id,
        })
      ).rejects.toThrow();
    });
  });

  describe('2. Preservation of Raw AI vs User Edits & Missing/Null Values', () => {
    it('should allow genuine missing information to remain null with MISSING status', async () => {
      const incompleteExtraction = createSampleExtraction();
      incompleteExtraction.supplier.gstin = { value: null, confidence: 0, status: 'MISSING' };
      incompleteExtraction.invoice.poNumber = { value: null, confidence: 0, status: 'MISSING' };
      incompleteExtraction.payment.upiId = { value: null, confidence: 0, status: 'MISSING' };
      incompleteExtraction.items[0].skuOrCode = { value: null, confidence: 0, status: 'MISSING' };

      const draft = await PurchaseDraft.create({
        businessId: businessA._id,
        draftNumber: 'DRF-2526-0005',
        originalFile: {
          fileName: 'partial_bill.jpg',
          fileSize: 50000,
          mimeType: 'image/jpeg',
          fileUrl: 'https://res.cloudinary.com/test/partial.jpg',
          publicId: 'partial_1',
        },
        rawExtraction: incompleteExtraction,
        extraction: incompleteExtraction,
        status: 'DRAFT_READY',
        createdBy: testUser._id,
      });

      expect(draft.extraction.supplier.gstin.value).toBeNull();
      expect(draft.extraction.supplier.gstin.status).toBe('MISSING');
      expect(draft.extraction.invoice.poNumber.value).toBeNull();
      expect(draft.extraction.items[0].skuOrCode.value).toBeNull();
    });

    it('should preserve original rawExtraction unchanged when extraction working copy is updated', async () => {
      const originalExtraction = createSampleExtraction();
      const workingExtraction = JSON.parse(JSON.stringify(originalExtraction));

      const draft = await PurchaseDraft.create({
        businessId: businessA._id,
        draftNumber: 'DRF-2526-0006',
        originalFile: {
          fileName: 'bill.pdf',
          fileSize: 60000,
          mimeType: 'application/pdf',
          fileUrl: 'https://res.cloudinary.com/test/bill.pdf',
          publicId: 'bill_orig',
        },
        rawExtraction: originalExtraction,
        extraction: workingExtraction,
        status: 'DRAFT_READY',
        createdBy: testUser._id,
      });

      // User updates the working copy (e.g. corrects unit price from 1250 to 1200)
      draft.extraction.items[0].unitPrice.value = 1200;
      draft.extraction.items[0].unitPrice.status = 'VERIFIED';
      await draft.save();

      const reloaded = await PurchaseDraft.findById(draft._id);
      // Working copy has the updated user value
      expect(reloaded!.extraction.items[0].unitPrice.value).toBe(1200);
      expect(reloaded!.extraction.items[0].unitPrice.status).toBe('VERIFIED');
      // Original raw AI extraction remains permanently frozen at 1250
      expect(reloaded!.rawExtraction.items[0].unitPrice.value).toBe(1250);
      expect(reloaded!.rawExtraction.items[0].unitPrice.status).toBe('EXTRACTED');
    });
  });

  describe('3. Tenant-Scoped Idempotency Index', () => {
    it('should allow the same idempotency key in different business tenants', async () => {
      const sampleExtraction = createSampleExtraction();
      const sharedKey = `idemp_shared_${Date.now()}`;

      const draftA = await PurchaseDraft.create({
        businessId: businessA._id,
        draftNumber: 'DRF-2526-0007',
        originalFile: {
          fileName: 'docA.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
          fileUrl: 'https://res.cloudinary.com/test/docA.pdf',
          publicId: 'doc_a',
        },
        rawExtraction: sampleExtraction,
        extraction: sampleExtraction,
        idempotencyKey: sharedKey,
        createdBy: testUser._id,
      });

      const draftB = await PurchaseDraft.create({
        businessId: businessB._id,
        draftNumber: 'DRF-2526-0008',
        originalFile: {
          fileName: 'docB.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
          fileUrl: 'https://res.cloudinary.com/test/docB.pdf',
          publicId: 'doc_b',
        },
        rawExtraction: sampleExtraction,
        extraction: sampleExtraction,
        idempotencyKey: sharedKey,
        createdBy: testUser._id,
      });

      expect(draftA._id).toBeDefined();
      expect(draftB._id).toBeDefined();
    });

    it('should reject duplicate idempotency key within the same business tenant', async () => {
      const sampleExtraction = createSampleExtraction();
      const duplicateKey = `idemp_collision_${Date.now()}`;

      await PurchaseDraft.create({
        businessId: businessA._id,
        draftNumber: 'DRF-2526-0009',
        originalFile: {
          fileName: 'doc1.pdf',
          fileSize: 1000,
          mimeType: 'application/pdf',
          fileUrl: 'https://res.cloudinary.com/test/doc1.pdf',
          publicId: 'doc_1',
        },
        rawExtraction: sampleExtraction,
        extraction: sampleExtraction,
        idempotencyKey: duplicateKey,
        createdBy: testUser._id,
      });

      await expect(
        PurchaseDraft.create({
          businessId: businessA._id,
          draftNumber: 'DRF-2526-0010',
          originalFile: {
            fileName: 'doc2.pdf',
            fileSize: 1000,
            mimeType: 'application/pdf',
            fileUrl: 'https://res.cloudinary.com/test/doc2.pdf',
            publicId: 'doc_2',
          },
          rawExtraction: sampleExtraction,
          extraction: sampleExtraction,
          idempotencyKey: duplicateKey,
          createdBy: testUser._id,
        })
      ).rejects.toThrow();
    });
  });

  describe('4. Zod Contract Validation Rules', () => {
    it('should reject negative line item quantity', () => {
      const itemWithNegativeQty = {
        id: 'line-1',
        lineNumber: 1,
        description: { value: 'Capacitor', confidence: 0.9, status: 'EXTRACTED' },
        skuOrCode: { value: 'CAP', confidence: 0.9, status: 'EXTRACTED' },
        hsnSac: { value: '8532', confidence: 0.9, status: 'EXTRACTED' },
        quantity: { value: -5, confidence: 0.9, status: 'INVALID' }, // Negative
        unit: { value: 'NOS', confidence: 0.9, status: 'EXTRACTED' },
        unitPrice: { value: 100, confidence: 0.9, status: 'EXTRACTED' },
        discountPercent: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        discountAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        taxableAmount: { value: 500, confidence: 0.9, status: 'EXTRACTED' },
        gstRate: { value: 18, confidence: 0.9, status: 'EXTRACTED' },
        cgstRate: { value: 9, confidence: 0.9, status: 'EXTRACTED' },
        cgstAmount: { value: 45, confidence: 0.9, status: 'EXTRACTED' },
        sgstRate: { value: 9, confidence: 0.9, status: 'EXTRACTED' },
        sgstAmount: { value: 45, confidence: 0.9, status: 'EXTRACTED' },
        igstRate: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        igstAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        cessRate: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        cessAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        lineTotal: { value: 590, confidence: 0.9, status: 'EXTRACTED' },
      };

      const result = extractedLineItemSchema.safeParse(itemWithNegativeQty);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Quantity cannot be negative');
      }
    });

    it('should reject negative line item price', () => {
      const itemWithNegativePrice = {
        id: 'line-2',
        lineNumber: 1,
        description: { value: 'Compressor', confidence: 0.9, status: 'EXTRACTED' },
        skuOrCode: { value: 'COMP', confidence: 0.9, status: 'EXTRACTED' },
        hsnSac: { value: '8414', confidence: 0.9, status: 'EXTRACTED' },
        quantity: { value: 1, confidence: 0.9, status: 'EXTRACTED' },
        unit: { value: 'NOS', confidence: 0.9, status: 'EXTRACTED' },
        unitPrice: { value: -4500, confidence: 0.9, status: 'INVALID' }, // Negative
        discountPercent: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        discountAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        taxableAmount: { value: 4500, confidence: 0.9, status: 'EXTRACTED' },
        gstRate: { value: 18, confidence: 0.9, status: 'EXTRACTED' },
        cgstRate: { value: 9, confidence: 0.9, status: 'EXTRACTED' },
        cgstAmount: { value: 405, confidence: 0.9, status: 'EXTRACTED' },
        sgstRate: { value: 9, confidence: 0.9, status: 'EXTRACTED' },
        sgstAmount: { value: 405, confidence: 0.9, status: 'EXTRACTED' },
        igstRate: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        igstAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        cessRate: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        cessAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        lineTotal: { value: 5310, confidence: 0.9, status: 'EXTRACTED' },
      };

      const result = extractedLineItemSchema.safeParse(itemWithNegativePrice);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Unit price cannot be negative');
      }
    });

    it('should reject negative discount', () => {
      const itemWithNegativeDiscount = {
        id: 'line-3',
        lineNumber: 1,
        description: { value: 'Fan Motor', confidence: 0.9, status: 'EXTRACTED' },
        skuOrCode: { value: 'MOT', confidence: 0.9, status: 'EXTRACTED' },
        hsnSac: { value: '8501', confidence: 0.9, status: 'EXTRACTED' },
        quantity: { value: 2, confidence: 0.9, status: 'EXTRACTED' },
        unit: { value: 'NOS', confidence: 0.9, status: 'EXTRACTED' },
        unitPrice: { value: 800, confidence: 0.9, status: 'EXTRACTED' },
        discountPercent: { value: -10, confidence: 0.9, status: 'INVALID' }, // Negative
        discountAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        taxableAmount: { value: 1600, confidence: 0.9, status: 'EXTRACTED' },
        gstRate: { value: 18, confidence: 0.9, status: 'EXTRACTED' },
        cgstRate: { value: 9, confidence: 0.9, status: 'EXTRACTED' },
        cgstAmount: { value: 144, confidence: 0.9, status: 'EXTRACTED' },
        sgstRate: { value: 9, confidence: 0.9, status: 'EXTRACTED' },
        sgstAmount: { value: 144, confidence: 0.9, status: 'EXTRACTED' },
        igstRate: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        igstAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        cessRate: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        cessAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        lineTotal: { value: 1888, confidence: 0.9, status: 'EXTRACTED' },
      };

      const result = extractedLineItemSchema.safeParse(itemWithNegativeDiscount);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Discount % must be 0-100');
      }
    });

    it('should reject negative grand total in summary', () => {
      const summaryWithNegativeTotal = {
        subtotal: { value: 1000, confidence: 0.9, status: 'EXTRACTED' },
        totalDiscount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        taxableAmount: { value: 1000, confidence: 0.9, status: 'EXTRACTED' },
        cgstAmount: { value: 90, confidence: 0.9, status: 'EXTRACTED' },
        sgstAmount: { value: 90, confidence: 0.9, status: 'EXTRACTED' },
        igstAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        cessAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        totalTax: { value: 180, confidence: 0.9, status: 'EXTRACTED' },
        roundOff: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        grandTotal: { value: -1180, confidence: 0.9, status: 'INVALID' }, // Negative
        amountPaid: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
        balanceDue: { value: 1180, confidence: 0.9, status: 'EXTRACTED' },
      };

      const result = summaryExtractionSchema.safeParse(summaryWithNegativeTotal);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Grand total cannot be negative');
      }
    });
  });

  describe('5. Security: Editable vs Protected Fields Separation', () => {
    it('should accept valid user-editable draft update payload', () => {
      const validClientUpdate = {
        vendorId: '65f8a999c9e23a0099999999',
        vendorInvoiceNumber: 'INV-NEW-9041',
        invoiceDate: '2026-09-19',
        notes: 'User updated invoice note.',
        items: [
          {
            id: 'row-1',
            quantity: 5,
            unitPrice: 1200,
          },
        ],
      };

      const result = editableDraftFieldsSchema.safeParse(validClientUpdate);
      expect(result.success).toBe(true);
    });

    it('should strictly reject client attempts to inject server-controlled fields', () => {
      const maliciousPayload = {
        vendorInvoiceNumber: 'INV-HACK-01',
        // Injected server-controlled fields
        businessId: '65f8a000c9e23a0000000000',
        status: 'CONVERTED',
        confirmedPurchaseId: '65f8b000c9e23a0000000000',
        createdBy: '65f8c000c9e23a0000000000',
      };

      const result = editableDraftFieldsSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.issues.map((i) => i.message);
        expect(errorMessages.some((msg) => msg.includes('Unrecognized key'))).toBe(true);
      }
    });

    it('should validate complete purchase draft object using purchaseDraftSchema', () => {
      const sampleExtraction = createSampleExtraction();
      const validDraftObj = {
        businessId: businessA._id.toString(),
        draftNumber: 'DRF-2526-9999',
        originalFile: {
          fileName: 'bill.pdf',
          fileSize: 12345,
          mimeType: 'application/pdf',
          fileUrl: 'https://res.cloudinary.com/test/bill.pdf',
          publicId: 'bill_pub_123',
          pageCount: 1,
          previewImages: ['https://res.cloudinary.com/test/preview.png'],
        },
        rawExtraction: sampleExtraction,
        extraction: sampleExtraction,
        reconciliation: {
          isMathValid: true,
          hasDiscrepancies: false,
          discrepancyNotes: [],
          calculatedSubtotal: 5000,
          calculatedTaxTotal: 855,
          calculatedGrandTotal: 5605,
        },
        vendorMatch: {
          matchedVendorId: null,
          matchedVendorName: null,
          matchedVendorGstin: null,
          matchingMethod: 'NO_MATCH' as const,
          confidence: 0,
          status: 'MISSING' as const,
          alternatives: [],
        },
        status: 'DRAFT_READY' as const,
        createdBy: testUser._id.toString(),
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      };

      const parsed = purchaseDraftSchema.safeParse(validDraftObj);
      expect(parsed.success).toBe(true);
    });
  });
});
