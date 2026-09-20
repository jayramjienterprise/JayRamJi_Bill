import mongoose, { Types } from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

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
import { processReceiving } from '../modules/purchase/receiving.controller';

describe('Phase 4 — Purchase Scanner Draft Confirmation Integration', () => {
  let userA: any;
  let userB: any;
  let businessA: any;
  let businessB: any;
  let tokenA: string;
  let tokenB: string;
  let vendorA: any;
  let productA1: any;

  beforeAll(async () => {
    // Connect to MongoDB if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
    }
  });

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Business.deleteMany({});
    await BusinessMember.deleteMany({});
    await Product.deleteMany({});
    await Vendor.deleteMany({});
    await Purchase.deleteMany({});
    await PurchaseDraft.deleteMany({});
    await PurchaseReceipt.deleteMany({});
    await InventoryTransaction.deleteMany({});

    // Setup Tenant A
    userA = await User.create({
      name: 'Owner A',
      email: 'ownerA@test.com',
      passwordHash: 'hashed_pw_A',
      status: 'ACTIVE',
    });

    businessA = await Business.create({
      name: 'Tenant A Business',
      legalName: 'Tenant A Business Pvt Ltd',
      address: { line1: 'GIDC', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
      contact: { phone: '9825100001', email: 'bizA@jayramji.com' },
      ownerId: userA._id,
      active: true,
      status: 'ACTIVE',
      currency: 'INR',
    });

    await BusinessMember.create({
      businessId: businessA._id,
      userId: userA._id,
      role: 'OWNER',
      status: 'ACTIVE',
    });

    tokenA = jwt.sign(
      { userId: userA._id.toString(), email: userA.email, role: 'OWNER' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Setup Tenant B
    userB = await User.create({
      name: 'Owner B',
      email: 'ownerB@test.com',
      passwordHash: 'hashed_pw_B',
      status: 'ACTIVE',
    });

    businessB = await Business.create({
      name: 'Tenant B Business',
      legalName: 'Tenant B Business Pvt Ltd',
      address: { line1: 'GIDC', city: 'Anjar', state: 'Gujarat', postalCode: '370110', country: 'India' },
      contact: { phone: '9825100002', email: 'bizB@jayramji.com' },
      ownerId: userB._id,
      active: true,
      status: 'ACTIVE',
      currency: 'INR',
    });

    await BusinessMember.create({
      businessId: businessB._id,
      userId: userB._id,
      role: 'OWNER',
      status: 'ACTIVE',
    });

    tokenB = jwt.sign(
      { userId: userB._id.toString(), email: userB.email, role: 'OWNER' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Vendor and Products for Tenant A
    vendorA = await Vendor.create({
      businessId: businessA._id,
      vendorCode: 'VND-001',
      name: 'Voltas India Limited',
      gstNumber: '27AABCV1234F1Z5',
      isActive: true,
    });

    productA1 = await Product.create({
      businessId: businessA._id,
      name: 'Copper Pipe 1/2 Inch',
      sku: 'COP-12',
      uom: 'MTR',
      defaultPriceMinor: 150000,
      stockQuantity: 10,
      active: true,
      deletedAt: null,
    });
  });

  // Helper to create a standard valid working draft
  async function createTestDraft(overrides: any = {}) {
    return PurchaseDraft.create({
      businessId: businessA._id,
      draftNumber: `DRF-2609-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'DRAFT_READY',
      originalFile: {
        fileName: 'voltas_bill.pdf',
        fileSize: 10240,
        mimeType: 'application/pdf',
        fileUrl: 'https://res.cloudinary.com/test-cloud/raw/upload/v1/bill.pdf',
        publicId: 'test-public-id',
        pageCount: 1,
        previewImages: [],
      },
      rawExtraction: {
        supplier: {
          name: { value: 'Voltas India Limited', confidence: 0.98, status: 'EXTRACTED' },
          gstin: { value: '27AABCV1234F1Z5', confidence: 0.99, status: 'EXTRACTED' },
          pan: { value: 'AABCV1234F', confidence: 0.95, status: 'EXTRACTED' },
          address: { value: 'Mumbai', confidence: 0.9, status: 'EXTRACTED' },
          city: { value: 'Mumbai', confidence: 0.9, status: 'EXTRACTED' },
          state: { value: 'Maharashtra', confidence: 0.9, status: 'EXTRACTED' },
          stateCode: { value: '27', confidence: 0.9, status: 'EXTRACTED' },
          pincode: { value: '400001', confidence: 0.9, status: 'EXTRACTED' },
          phone: { value: null, confidence: 0, status: 'MISSING' },
          email: { value: null, confidence: 0, status: 'MISSING' },
        },
        invoice: {
          invoiceNumber: { value: 'VOLTAS-INV-9901', confidence: 0.98, status: 'EXTRACTED' },
          invoiceDate: { value: '2026-09-10', confidence: 0.98, status: 'EXTRACTED' },
          dueDate: { value: '2026-10-10', confidence: 0.9, status: 'EXTRACTED' },
          poNumber: { value: null, confidence: 0, status: 'MISSING' },
          ewayBillNumber: { value: null, confidence: 0, status: 'MISSING' },
          placeOfSupply: { value: 'Maharashtra', confidence: 0.9, status: 'EXTRACTED' },
          isReverseCharge: { value: false, confidence: 0.9, status: 'EXTRACTED' },
        },
        items: [
          {
            id: 'line-1',
            lineNumber: 1,
            description: { value: 'Copper Pipe 1/2 Inch', confidence: 0.98, status: 'EXTRACTED' },
            skuOrCode: { value: 'COP-12', confidence: 0.95, status: 'EXTRACTED' },
            hsnSac: { value: '7411', confidence: 0.95, status: 'EXTRACTED' },
            quantity: { value: 5, confidence: 0.98, status: 'EXTRACTED' },
            unit: { value: 'MTR', confidence: 0.95, status: 'EXTRACTED' },
            unitPrice: { value: 1500, confidence: 0.98, status: 'EXTRACTED' },
            discountPercent: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            discountAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            taxableAmount: { value: 7500, confidence: 0.98, status: 'EXTRACTED' },
            gstRate: { value: 18, confidence: 0.98, status: 'EXTRACTED' },
            cgstRate: { value: 9, confidence: 0.98, status: 'EXTRACTED' },
            cgstAmount: { value: 675, confidence: 0.98, status: 'EXTRACTED' },
            sgstRate: { value: 9, confidence: 0.98, status: 'EXTRACTED' },
            sgstAmount: { value: 675, confidence: 0.98, status: 'EXTRACTED' },
            igstRate: { value: 0, confidence: 0.98, status: 'EXTRACTED' },
            igstAmount: { value: 0, confidence: 0.98, status: 'EXTRACTED' },
            cessRate: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            cessAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            lineTotal: { value: 8850, confidence: 0.98, status: 'EXTRACTED' },
          },
        ],
        summary: {
          subtotal: { value: 7500, confidence: 0.98, status: 'EXTRACTED' },
          totalDiscount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
          taxableAmount: { value: 7500, confidence: 0.98, status: 'EXTRACTED' },
          cgstAmount: { value: 675, confidence: 0.98, status: 'EXTRACTED' },
          sgstAmount: { value: 675, confidence: 0.98, status: 'EXTRACTED' },
          igstAmount: { value: 0, confidence: 0.98, status: 'EXTRACTED' },
          cessAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
          totalTax: { value: 1350, confidence: 0.98, status: 'EXTRACTED' },
          roundOff: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
          grandTotal: { value: 8850, confidence: 0.98, status: 'EXTRACTED' },
          amountPaid: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
          balanceDue: { value: 8850, confidence: 0.98, status: 'EXTRACTED' },
        },
        payment: {
          paymentMode: { value: 'BANK_TRANSFER', confidence: 0.9, status: 'EXTRACTED' },
          bankName: { value: null, confidence: 0, status: 'MISSING' },
          bankAccountNumber: { value: null, confidence: 0, status: 'MISSING' },
          bankIfsc: { value: null, confidence: 0, status: 'MISSING' },
          upiId: { value: null, confidence: 0, status: 'MISSING' },
          transactionReference: { value: null, confidence: 0, status: 'MISSING' },
        },
        additional: {
          notes: { value: 'Delivery within 2 days', confidence: 0.9, status: 'EXTRACTED' },
          termsAndConditions: { value: null, confidence: 0, status: 'MISSING' },
          vehicleNumber: { value: null, confidence: 0, status: 'MISSING' },
        },
      },
      extraction: {
        supplier: {
          name: { value: 'Voltas India Limited', confidence: 0.98, status: 'EXTRACTED' },
          gstin: { value: '27AABCV1234F1Z5', confidence: 0.99, status: 'EXTRACTED' },
          pan: { value: 'AABCV1234F', confidence: 0.95, status: 'EXTRACTED' },
          address: { value: 'Mumbai', confidence: 0.9, status: 'EXTRACTED' },
          city: { value: 'Mumbai', confidence: 0.9, status: 'EXTRACTED' },
          state: { value: 'Maharashtra', confidence: 0.9, status: 'EXTRACTED' },
          stateCode: { value: '27', confidence: 0.9, status: 'EXTRACTED' },
          pincode: { value: '400001', confidence: 0.9, status: 'EXTRACTED' },
          phone: { value: null, confidence: 0, status: 'MISSING' },
          email: { value: null, confidence: 0, status: 'MISSING' },
        },
        invoice: {
          invoiceNumber: { value: 'VOLTAS-INV-9901', confidence: 0.98, status: 'EXTRACTED' },
          invoiceDate: { value: '2026-09-10', confidence: 0.98, status: 'EXTRACTED' },
          dueDate: { value: '2026-10-10', confidence: 0.9, status: 'EXTRACTED' },
          poNumber: { value: null, confidence: 0, status: 'MISSING' },
          ewayBillNumber: { value: null, confidence: 0, status: 'MISSING' },
          placeOfSupply: { value: 'Maharashtra', confidence: 0.9, status: 'EXTRACTED' },
          isReverseCharge: { value: false, confidence: 0.9, status: 'EXTRACTED' },
        },
        items: [
          {
            id: 'line-1',
            lineNumber: 1,
            description: { value: 'Copper Pipe 1/2 Inch', confidence: 0.98, status: 'EXTRACTED' },
            skuOrCode: { value: 'COP-12', confidence: 0.95, status: 'EXTRACTED' },
            hsnSac: { value: '7411', confidence: 0.95, status: 'EXTRACTED' },
            quantity: { value: 5, confidence: 0.98, status: 'EXTRACTED' },
            unit: { value: 'MTR', confidence: 0.95, status: 'EXTRACTED' },
            unitPrice: { value: 1500, confidence: 0.98, status: 'EXTRACTED' },
            discountPercent: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            discountAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            taxableAmount: { value: 7500, confidence: 0.98, status: 'EXTRACTED' },
            gstRate: { value: 18, confidence: 0.98, status: 'EXTRACTED' },
            cgstRate: { value: 9, confidence: 0.98, status: 'EXTRACTED' },
            cgstAmount: { value: 675, confidence: 0.98, status: 'EXTRACTED' },
            sgstRate: { value: 9, confidence: 0.98, status: 'EXTRACTED' },
            sgstAmount: { value: 675, confidence: 0.98, status: 'EXTRACTED' },
            igstRate: { value: 0, confidence: 0.98, status: 'EXTRACTED' },
            igstAmount: { value: 0, confidence: 0.98, status: 'EXTRACTED' },
            cessRate: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            cessAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            lineTotal: { value: 8850, confidence: 0.98, status: 'EXTRACTED' },
            productMatch: {
              productId: productA1._id.toString(),
              productName: productA1.name,
              sku: productA1.sku,
              uom: 'NOS',
              currentStock: 10,
              lastPurchasePrice: 1500,
              matchingMethod: 'EXACT_SKU',
              confidence: 1.0,
              isMatched: true,
              status: 'VERIFIED',
            },
          },
        ],
        summary: {
          subtotal: { value: 7500, confidence: 0.98, status: 'EXTRACTED' },
          totalDiscount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
          taxableAmount: { value: 7500, confidence: 0.98, status: 'EXTRACTED' },
          cgstAmount: { value: 675, confidence: 0.98, status: 'EXTRACTED' },
          sgstAmount: { value: 675, confidence: 0.98, status: 'EXTRACTED' },
          igstAmount: { value: 0, confidence: 0.98, status: 'EXTRACTED' },
          cessAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
          totalTax: { value: 1350, confidence: 0.98, status: 'EXTRACTED' },
          roundOff: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
          grandTotal: { value: 8850, confidence: 0.98, status: 'EXTRACTED' },
          amountPaid: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
          balanceDue: { value: 8850, confidence: 0.98, status: 'EXTRACTED' },
        },
        payment: {
          paymentMode: { value: 'BANK_TRANSFER', confidence: 0.9, status: 'EXTRACTED' },
          bankName: { value: null, confidence: 0, status: 'MISSING' },
          bankAccountNumber: { value: null, confidence: 0, status: 'MISSING' },
          bankIfsc: { value: null, confidence: 0, status: 'MISSING' },
          upiId: { value: null, confidence: 0, status: 'MISSING' },
          transactionReference: { value: null, confidence: 0, status: 'MISSING' },
        },
        additional: {
          notes: { value: 'Delivery within 2 days', confidence: 0.9, status: 'EXTRACTED' },
          termsAndConditions: { value: null, confidence: 0, status: 'MISSING' },
          vehicleNumber: { value: null, confidence: 0, status: 'MISSING' },
        },
      },
      reconciliation: {
        isMathValid: true,
        hasDiscrepancies: false,
        discrepancyNotes: [],
        calculatedSubtotal: 7500,
        calculatedTaxTotal: 1350,
        calculatedGrandTotal: 8850,
      },
      vendorMatch: {
        matchedVendorId: vendorA._id.toString(),
        matchedVendorName: vendorA.name,
        matchedVendorGstin: vendorA.gstNumber,
        matchingMethod: 'EXACT_GSTIN',
        confidence: 1.0,
        status: 'VERIFIED',
      },
      createdBy: userA._id,
      expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      ...overrides,
    });
  }

  // ----------------------------------------------------
  // Scenario 1: Authentication Guard
  // ----------------------------------------------------
  it('1. confirmation requires authentication (unauthenticated request returns 401)', async () => {
    const draft = await createTestDraft();

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .send({});

    expect(res.status).toBe(401);
  });

  // ----------------------------------------------------
  // Scenario 2: Cross-Tenant Isolation
  // ----------------------------------------------------
  it('2 & 18. cross-tenant confirmation is blocked (Tenant B cannot confirm Tenant A draft)', async () => {
    const draftA = await createTestDraft();

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draftA._id}/confirm`)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('x-business-id', businessB._id.toString())
      .send({});

    expect(res.status).toBe(404);
  });

  // ----------------------------------------------------
  // Scenario 3: Expired Draft Guard
  // ----------------------------------------------------
  it('3. expired draft cannot be confirmed (fails with 400 DRAFT_EXPIRED)', async () => {
    const draft = await createTestDraft({
      expiresAt: new Date(Date.now() - 1000), // In the past
    });

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('DRAFT_EXPIRED');
  });

  // ----------------------------------------------------
  // Scenario 4: Missing Line Items Guard
  // ----------------------------------------------------
  it('4. invalid working extraction without line items cannot confirm', async () => {
    const draft = await createTestDraft();
    draft.extraction.items = [];
    await draft.save();

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('ITEMS_REQUIRED');
  });

  // ----------------------------------------------------
  // Scenario 6 & 19: Vendor Revalidation (Stale/Inactive Vendor)
  // ----------------------------------------------------
  it('6 & 19. vendor is revalidated against current database (stale/missing vendor rejected)', async () => {
    const nonExistentVendorId = new Types.ObjectId().toString();
    const draft = await createTestDraft({
      vendorMatch: {
        matchedVendorId: nonExistentVendorId,
        matchedVendorName: 'Ghost Vendor',
        matchedVendorGstin: null,
        matchingMethod: 'EXACT_NAME',
        confidence: 0.9,
        status: 'REVIEW_REQUIRED',
      },
    });

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VENDOR_NOT_FOUND');
  });

  // ----------------------------------------------------
  // Scenario 7: Product Revalidation (Unresolved Product)
  // ----------------------------------------------------
  it('7. products are revalidated against current catalog (unresolved product line rejected)', async () => {
    const draft = await createTestDraft();
    draft.extraction.items[0].productMatch = undefined; // Unmapped product
    await draft.save();

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PRODUCT_UNRESOLVED');
  });

  // ----------------------------------------------------
  // Scenario 8: Duplicate Invoice Re-checked at Confirmation
  // ----------------------------------------------------
  it('8. duplicate invoice is rechecked against active Purchases at confirmation time', async () => {
    // 1. Create an existing purchase with invoice number VOLTAS-INV-9901
    await Purchase.create({
      businessId: businessA._id,
      purchaseNumber: 'PUR-2609-0001',
      purchaseType: 'DIRECT_PURCHASE',
      vendorId: vendorA._id,
      vendorInvoiceNumber: 'VOLTAS-INV-9901',
      status: 'CONFIRMED',
      totalAmount: 5000,
      subtotal: 5000,
      paidAmount: 0,
      outstandingAmount: 5000,
      items: [
        {
          productId: productA1._id,
          productNameSnapshot: productA1.name,
          skuSnapshot: productA1.sku,
          orderedQuantity: 1,
          receivedQuantity: 0,
          remainingQuantity: 1,
          unitPurchasePrice: 5000,
          totalAmount: 5000,
          receivingStatus: 'NOT_RECEIVED',
        },
      ],
    });

    // 2. Draft has the same vendor & invoice number
    const draft = await createTestDraft();

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({ allowDuplicateInvoice: false });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_VENDOR_INVOICE');
  });

  // ----------------------------------------------------
  // Scenario 9, 10, 11, 16, 17: Successful Explicit Confirmation
  // ----------------------------------------------------
  it('9 & 10 & 11 & 16 & 17. purchase created only upon confirmation, reuses numbering, updates stock if direct, preserves audit', async () => {
    const draft = await createTestDraft();

    // Initial assertions: Zero purchases exist
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(0);
    expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(0);

    const initialStock = productA1.stockQuantity; // 10

    // Confirm draft with directReceivedFull: true
    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({
        purchaseType: 'DIRECT_PURCHASE',
        directReceivedFull: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.converted).toBe(true);
    expect(res.body.purchaseId).toBeDefined();

    const createdPurchase = await Purchase.findById(res.body.purchaseId);
    expect(createdPurchase).toBeDefined();
    expect(createdPurchase?.purchaseNumber).toMatch(/^PUR-/);
    expect(createdPurchase?.vendorInvoiceNumber).toBe('VOLTAS-INV-9901');
    expect(createdPurchase?.totalAmount).toBe(8850);
    expect(createdPurchase?.receivingStatus).toBe('RECEIVED');

    // Direct receiving executed: stock incremented (+5 ordered -> 10 + 5 = 15)
    const updatedProduct = await Product.findById(productA1._id);
    expect(updatedProduct?.stockQuantity).toBe(initialStock + 5);

    // PurchaseReceipt & InventoryTransaction created
    expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
    expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);

    // Draft audit state updated
    const updatedDraft = await PurchaseDraft.findById(draft._id);
    expect(updatedDraft?.status).toBe('CONVERTED');
    expect(updatedDraft?.confirmedPurchaseId?.toString()).toBe(createdPurchase?._id.toString());
    expect(updatedDraft?.confirmedAt).toBeDefined();
    expect(updatedDraft?.confirmedBy?.toString()).toBe(userA._id.toString());

    // Invariant: rawExtraction was NOT modified
    expect(updatedDraft?.rawExtraction.supplier.name.value).toBe('Voltas India Limited');
    expect(updatedDraft?.rawExtraction.invoice.invoiceNumber.value).toBe('VOLTAS-INV-9901');
    expect(updatedDraft?.rawExtraction.items[0].description.value).toBe('Copper Pipe 1/2 Inch');
    expect(updatedDraft?.rawExtraction.summary.grandTotal.value).toBe(8850);
  });

  // ----------------------------------------------------
  // Scenario 12: Ordered Purchase (No immediate stock change)
  // ----------------------------------------------------
  it('12. ordered purchase does not increment stock upon confirmation (receiving deferred)', async () => {
    const draft = await createTestDraft();
    const initialStock = productA1.stockQuantity;

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({
        purchaseType: 'ORDERED_PURCHASE',
        directReceivedFull: false,
      });

    expect(res.status).toBe(200);
    const purchase = await Purchase.findById(res.body.purchaseId);
    expect(purchase?.purchaseType).toBe('ORDERED_PURCHASE');
    expect(purchase?.receivingStatus).toBe('NOT_RECEIVED');

    // Stock remained completely intact
    const product = await Product.findById(productA1._id);
    expect(product?.stockQuantity).toBe(initialStock);

    // Zero receipts created
    expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(0);
  });

  // ----------------------------------------------------
  // Scenario 13 & 15: Double Confirmation Idempotency
  // ----------------------------------------------------
  it('13 & 15. double confirmation returns existing converted purchase without creating duplicates', async () => {
    const draft = await createTestDraft();

    // First confirmation
    const firstRes = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({ purchaseType: 'ORDERED_PURCHASE', directReceivedFull: false });

    expect(firstRes.status).toBe(200);
    const firstPurchaseId = firstRes.body.purchaseId;
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);

    // Second confirmation on same draft
    const secondRes = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({ purchaseType: 'ORDERED_PURCHASE', directReceivedFull: false });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.success).toBe(true);
    expect(secondRes.body.converted).toBe(true);
    expect(secondRes.body.alreadyConverted).toBe(true);
    expect(secondRes.body.purchaseId).toBe(firstPurchaseId);

    // Exactly 1 Purchase in DB
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
  });

  // ----------------------------------------------------
  // Scenario 14: Concurrent Confirmation Guard
  // ----------------------------------------------------
  it('14. concurrent confirmation attempts are locked atomically (second caller gets safe response)', async () => {
    const draft = await createTestDraft();

    // Mark draft as CONFIRMING (simulating in-flight execution)
    draft.status = 'CONFIRMING';
    draft.confirmationStartedAt = new Date();
    await draft.save();

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONCURRENT_CONFIRMATION');
  });

  // ----------------------------------------------------
  // Scenario 20: Confirmation failure rollback
  // ----------------------------------------------------
  it('20. confirmation failure does not create partial purchases and restores draft state', async () => {
    const draft = await createTestDraft();
    const countBefore = await Purchase.countDocuments({ businessId: businessA._id });

    // Send payload with invalid product ID
    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({
        items: [
          {
            id: 'line-1',
            productId: new Types.ObjectId().toString(), // Missing product
          },
        ],
      });

    expect(res.status).toBe(400);

    // No purchases created
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(countBefore);

    // Draft status rolled back from CONFIRMING to DRAFT_READY
    const reloadedDraft = await PurchaseDraft.findById(draft._id);
    expect(reloadedDraft?.status).toBe('DRAFT_READY');
  });

  // ====================================================
  // PHASE 4.1 HARDENING & ATOMICITY SCENARIOS
  // ====================================================

  // ----------------------------------------------------
  // Scenario 5: Critical Crash-Window Simulation & Recovery
  // ----------------------------------------------------
  it('5. crash-window simulation: pre-existing purchase with sourceDraftId is safely recovered on retry', async () => {
    const draft = await createTestDraft();

    // Simulate crash window:
    // Purchase was inserted with sourceDraftId, but server crashed before draft status could be updated to CONVERTED
    const initialStock = productA1.stockQuantity;
    const existingPurchase = await Purchase.create({
      businessId: businessA._id,
      purchaseNumber: 'PUR-2609-0099',
      purchaseType: 'DIRECT_PURCHASE',
      vendorId: vendorA._id,
      vendorInvoiceNumber: 'VOLTAS-INV-9901',
      purchaseDate: new Date(),
      status: 'CONFIRMED',
      receivingStatus: 'RECEIVED',
      paymentStatus: 'UNPAID',
      subtotal: 7500,
      discountAmount: 0,
      taxAmount: 1350,
      totalAmount: 8850,
      paidAmount: 0,
      outstandingAmount: 8850,
      sourceDraftId: draft._id,
      items: [
        {
          productId: productA1._id,
          productNameSnapshot: productA1.name,
          skuSnapshot: productA1.sku,
          orderedQuantity: 5,
          receivedQuantity: 5,
          remainingQuantity: 0,
          unitPurchasePrice: 1500,
          discountPercent: 0,
          discountAmount: 0,
          taxRate: 18,
          taxAmount: 1350,
          totalAmount: 8850,
          receivingStatus: 'RECEIVED',
        },
      ],
    });

    // Create 1 receipt and 1 inventory transaction simulating direct receiving completed before crash
    await PurchaseReceipt.create({
      businessId: businessA._id,
      purchaseId: existingPurchase._id,
      receiptNumber: 'REC-2526-0099',
      receivedBy: userA._id,
      items: [
        {
          purchaseItemId: existingPurchase.items[0]._id,
          productId: productA1._id,
          productNameSnapshot: productA1.name,
          quantityReceived: 5,
          unitPurchasePrice: 1500,
        },
      ],
    });

    await InventoryTransaction.create({
      businessId: businessA._id,
      productId: productA1._id,
      quantity: 5,
      transactionType: 'PURCHASE_RECEIPT',
      referenceType: 'PURCHASE_RECEIPT',
      referenceId: existingPurchase._id,
      purchaseId: existingPurchase._id,
      unitCostPrice: 1500,
    });

    // Baseline counts before retry
    const purchaseCountBefore = await Purchase.countDocuments({ businessId: businessA._id });
    const receiptCountBefore = await PurchaseReceipt.countDocuments({ businessId: businessA._id });
    const txCountBefore = await InventoryTransaction.countDocuments({ businessId: businessA._id });

    // Draft is still in DRAFT_READY or CONFIRMING (crashed state)
    draft.status = 'CONFIRMING';
    await draft.save();

    // Client retries confirmation
    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({ directReceivedFull: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.converted).toBe(true);
    expect(res.body.alreadyConverted).toBe(true);
    expect(res.body.purchaseId).toBe(existingPurchase._id.toString());

    // CRITICAL INVARIANTS: Zero new purchases, receipts, or transactions created!
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(purchaseCountBefore);
    expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(receiptCountBefore);
    expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(txCountBefore);

    // Stock was NOT incremented again
    const productAfter = await Product.findById(productA1._id);
    expect(productAfter?.stockQuantity).toBe(initialStock);

    // Draft was healed to CONVERTED
    const reloadedDraft = await PurchaseDraft.findById(draft._id);
    expect(reloadedDraft?.status).toBe('CONVERTED');
    expect(reloadedDraft?.confirmedPurchaseId?.toString()).toBe(existingPurchase._id.toString());
  });

  // ----------------------------------------------------
  // Scenario 6: Database-Level Unique Constraint on sourceDraftId
  // ----------------------------------------------------
  it('6. unique sourceDraftId constraint: database rejects duplicate purchase creation for same draft', async () => {
    const draft = await createTestDraft();

    // First purchase with sourceDraftId
    await Purchase.create({
      businessId: businessA._id,
      purchaseNumber: 'PUR-2609-0001',
      purchaseType: 'DIRECT_PURCHASE',
      vendorId: vendorA._id,
      vendorInvoiceNumber: 'INV-1',
      status: 'CONFIRMED',
      subtotal: 100,
      totalAmount: 100,
      paidAmount: 0,
      outstandingAmount: 100,
      sourceDraftId: draft._id,
      items: [
        {
          productId: productA1._id,
          productNameSnapshot: productA1.name,
          orderedQuantity: 1,
          receivedQuantity: 0,
          remainingQuantity: 1,
          unitPurchasePrice: 100,
          totalAmount: 100,
          receivingStatus: 'NOT_RECEIVED',
        },
      ],
    });

    // Attempting to create another purchase with the same sourceDraftId in the same business must fail
    let duplicateError: any = null;
    try {
      await Purchase.create({
        businessId: businessA._id,
        purchaseNumber: 'PUR-2609-0002',
        purchaseType: 'DIRECT_PURCHASE',
        vendorId: vendorA._id,
        vendorInvoiceNumber: 'INV-2',
        status: 'CONFIRMED',
        subtotal: 100,
        totalAmount: 100,
        paidAmount: 0,
        outstandingAmount: 100,
        sourceDraftId: draft._id,
        items: [
          {
            productId: productA1._id,
            productNameSnapshot: productA1.name,
            orderedQuantity: 1,
            receivedQuantity: 0,
            remainingQuantity: 1,
            unitPurchasePrice: 100,
            totalAmount: 100,
            receivingStatus: 'NOT_RECEIVED',
          },
        ],
      });
    } catch (err: any) {
      duplicateError = err;
    }

    expect(duplicateError).toBeDefined();
    expect(duplicateError.code).toBe(11000);
  });

  // ----------------------------------------------------
  // Scenario 7: Manual Purchase Creation Unaffected
  // ----------------------------------------------------
  it('7. manual purchase creation unaffected: multiple manual purchases with null sourceDraftId coexist without collisions', async () => {
    // 1. Create first manual purchase via standard API
    const res1 = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({
        purchaseType: 'ORDERED_PURCHASE',
        vendorId: vendorA._id.toString(),
        vendorInvoiceNumber: 'MANUAL-INV-001',
        items: [
          {
            productId: productA1._id.toString(),
            orderedQuantity: 2,
            unitPurchasePrice: 1500,
            taxRate: 18,
          },
        ],
      });

    expect(res1.status).toBe(201);
    expect(res1.body.data.purchase.purchaseNumber).toBeDefined();
    expect(res1.body.data.purchase.sourceDraftId).toBeNull();

    // 2. Create second manual purchase via standard API
    const res2 = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({
        purchaseType: 'ORDERED_PURCHASE',
        vendorId: vendorA._id.toString(),
        vendorInvoiceNumber: 'MANUAL-INV-002',
        items: [
          {
            productId: productA1._id.toString(),
            orderedQuantity: 3,
            unitPurchasePrice: 1500,
            taxRate: 18,
          },
        ],
      });

    expect(res2.status).toBe(201);
    expect(res2.body.data.purchase.sourceDraftId).toBeNull();

    // Assert both purchases exist and total manual purchases = 2
    expect(await Purchase.countDocuments({ businessId: businessA._id, sourceDraftId: null })).toBe(2);
  });

  // ----------------------------------------------------
  // Scenario 10: Stale CONFIRMING State Recovery
  // ----------------------------------------------------
  it('10. stale CONFIRMING state recovery: abandoned lock older than timeout allows reclamation', async () => {
    const draft = await createTestDraft();

    // Set draft into CONFIRMING state started 2 minutes ago (stale lock > 60s)
    draft.status = 'CONFIRMING';
    draft.confirmationStartedAt = new Date(Date.now() - 120 * 1000);
    await draft.save();

    // User or retry calls confirm
    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({ purchaseType: 'ORDERED_PURCHASE', directReceivedFull: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.converted).toBe(true);
    expect(res.body.alreadyConverted).toBe(false);

    // Exactly 1 Purchase created
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);

    const reloadedDraft = await PurchaseDraft.findById(draft._id);
    expect(reloadedDraft?.status).toBe('CONVERTED');
  });

  // ----------------------------------------------------
  // Scenario 12 & 13 & 14 & 15: Inventory Duplication Test Under Direct Receiving
  // ----------------------------------------------------
  it('12 & 13 & 14 & 15. direct receiving happens exactly once and repeated confirmation does not double stock or receipts', async () => {
    const draft = await createTestDraft();
    const initialStock = productA1.stockQuantity; // 10

    // 1. First confirmation with direct full receipt (orderedQuantity = 5)
    const res1 = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({ purchaseType: 'DIRECT_PURCHASE', directReceivedFull: true });

    expect(res1.status).toBe(200);
    const purchaseId = res1.body.purchaseId;

    // Verify side-effects after first confirmation
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
    expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
    expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);

    const productAfter1 = await Product.findById(productA1._id);
    expect(productAfter1?.stockQuantity).toBe(initialStock + 5); // 10 + 5 = 15

    // 2. Second confirmation (repeated / retry)
    const res2 = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({ purchaseType: 'DIRECT_PURCHASE', directReceivedFull: true });

    expect(res2.status).toBe(200);
    expect(res2.body.alreadyConverted).toBe(true);
    expect(res2.body.purchaseId).toBe(purchaseId);

    // CRITICAL: All counts remain exactly unchanged!
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
    expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
    expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);

    // Stock remained 15 (NOT 20!)
    const productAfter2 = await Product.findById(productA1._id);
    expect(productAfter2?.stockQuantity).toBe(initialStock + 5);
  });

  // ----------------------------------------------------
  // Scenario 14 Concurrent: Simultaneous Requests Promise.all
  // ----------------------------------------------------
  it('14 concurrent. simultaneous confirm requests result in exactly one Purchase and one stock update', async () => {
    const draft = await createTestDraft();
    const initialStock = productA1.stockQuantity;

    // Launch two simultaneous confirmation requests
    const [res1, res2] = await Promise.all([
      request(app)
        .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({ purchaseType: 'DIRECT_PURCHASE', directReceivedFull: true }),
      request(app)
        .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({ purchaseType: 'DIRECT_PURCHASE', directReceivedFull: true }),
    ]);

    // One request must succeed with 200, the other either succeeds with alreadyConverted (200) or gets safe 409
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain(200);

    // Exactly one Purchase in DB
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
    expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
    expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);

    // Stock incremented exactly once (+5)
    const product = await Product.findById(productA1._id);
    expect(product?.stockQuantity).toBe(initialStock + 5);
  });

  // ----------------------------------------------------
  // Scenario 17: Converted State Invariant Check
  // ----------------------------------------------------
  it('17. converted draft invariant: if associated Purchase is deleted/missing, returns 500 without creating new purchase', async () => {
    const draft = await createTestDraft();
    draft.status = 'CONVERTED';
    draft.confirmedPurchaseId = new Types.ObjectId(); // Non-existent purchase ID
    await draft.save();

    const res = await request(app)
      .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-business-id', businessA._id.toString())
      .send({});

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('CONVERTED_PURCHASE_MISSING');

    // Zero purchases created
    expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(0);
  });

  // =========================================================================
  // PHASE 4.2 — RECEIVING & INVENTORY ATOMICITY / RECOVERY HARDENING TESTS
  // =========================================================================
  describe('Phase 4.2 Hardening: Crash Recovery, Concurrency & Side-Effect Guarantees', () => {
    // ----------------------------------------------------
    // Scenario 4.2.1: Case B Crash Simulation (Crash before Receipt)
    // ----------------------------------------------------
    it('Phase 4.2 Case B: recovers when Purchase exists but server crashed before receipt/inventory was executed', async () => {
      const draft = await createTestDraft();
      const initialStock = productA1.stockQuantity;

      // Simulate Case B state: Purchase was created, but server crashed before processReceiving
      const simulatedPurchase = await Purchase.create({
        businessId: businessA._id,
        purchaseNumber: 'PUR-CASE-B-001',
        purchaseType: 'DIRECT_PURCHASE',
        vendorId: vendorA._id,
        purchaseDate: new Date(),
        subtotal: 7500,
        discountAmount: 0,
        taxAmount: 1350,
        totalAmount: 8850,
        paidAmount: 0,
        outstandingAmount: 8850,
        receivingStatus: 'NOT_RECEIVED',
        status: 'CONFIRMED',
        sourceDraftId: draft._id,
        items: [
          {
            productId: productA1._id,
            productNameSnapshot: productA1.name,
            skuSnapshot: productA1.sku,
            orderedQuantity: 5,
            receivedQuantity: 0,
            remainingQuantity: 5,
            unitPurchasePrice: 1500,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 18,
            taxAmount: 1350,
            totalAmount: 8850,
            receivingStatus: 'NOT_RECEIVED',
          },
        ],
      });

      // Verify pre-conditions: 1 Purchase, 0 Receipts, 0 Transactions, stock unchanged
      expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(0);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(0);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock);

      // Now client retries confirmation
      const res = await request(app)
        .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({ purchaseType: 'DIRECT_PURCHASE', directReceivedFull: true });

      expect(res.status).toBe(200);
      expect(res.body.alreadyConverted).toBe(true);
      expect(res.body.purchaseId).toBe(simulatedPurchase._id.toString());

      // Phase 4.2 Option A Recovery Verified:
      // Exactly 1 Purchase, 1 Receipt, 1 InventoryTransaction, stock incremented once (+5)
      expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 5);

      // Purchase receiving status was healed to RECEIVED
      const healedPurchase = await Purchase.findById(simulatedPurchase._id);
      expect(healedPurchase?.receivingStatus).toBe('RECEIVED');
      expect(healedPurchase?.items[0].receivedQuantity).toBe(5);
      expect(healedPurchase?.items[0].remainingQuantity).toBe(0);

      // Subsequent retry produces 0 duplicate effects
      const res2 = await request(app)
        .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({ purchaseType: 'DIRECT_PURCHASE', directReceivedFull: true });

      expect(res2.status).toBe(200);
      expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 5);
    });

    // ----------------------------------------------------
    // Scenario 4.2.2: Case C Crash Simulation (Crash after Receipt before Tx/Stock)
    // ----------------------------------------------------
    it('Phase 4.2 Case C: recovers when Receipt exists but server crashed before InventoryTransaction/stock', async () => {
      const draft = await createTestDraft();
      const initialStock = productA1.stockQuantity;

      // Simulate Case C state: Purchase created
      const simulatedPurchase = await Purchase.create({
        businessId: businessA._id,
        purchaseNumber: 'PUR-CASE-C-001',
        purchaseType: 'DIRECT_PURCHASE',
        vendorId: vendorA._id,
        purchaseDate: new Date(),
        subtotal: 7500,
        discountAmount: 0,
        taxAmount: 1350,
        totalAmount: 8850,
        paidAmount: 0,
        outstandingAmount: 8850,
        receivingStatus: 'NOT_RECEIVED',
        status: 'CONFIRMED',
        sourceDraftId: draft._id,
        items: [
          {
            productId: productA1._id,
            productNameSnapshot: productA1.name,
            skuSnapshot: productA1.sku,
            orderedQuantity: 5,
            receivedQuantity: 0,
            remainingQuantity: 5,
            unitPurchasePrice: 1500,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 18,
            taxAmount: 1350,
            totalAmount: 8850,
            receivingStatus: 'NOT_RECEIVED',
          },
        ],
      });

      // Receipt was created with durable idempotencyKey, but crash happened before tx/stock
      await PurchaseReceipt.create({
        businessId: businessA._id,
        purchaseId: simulatedPurchase._id,
        receiptNumber: 'REC-2609-0001',
        receivedBy: userA._id,
        receivedAt: new Date(),
        idempotencyKey: `DIRECT_RECEIPT_${simulatedPurchase._id}`,
        items: [
          {
            purchaseItemId: simulatedPurchase.items[0]._id,
            productId: productA1._id,
            productNameSnapshot: productA1.name,
            quantityReceived: 5,
            unitPurchasePrice: 1500,
          },
        ],
      });

      // Verify pre-crash state: 1 Purchase, 1 Receipt, 0 InventoryTransactions, stock NOT incremented
      expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(0);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock);

      // Confirmation retry arrives
      const res = await request(app)
        .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({ purchaseType: 'DIRECT_PURCHASE', directReceivedFull: true });

      expect(res.status).toBe(200);

      // Verify reconciliation: Receipt is reused (NOT duplicated), Transaction is inserted, Stock incremented
      expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 5);

      const healedPurchase = await Purchase.findById(simulatedPurchase._id);
      expect(healedPurchase?.receivingStatus).toBe('RECEIVED');
    });

    // ----------------------------------------------------
    // Scenario 4.2.3: Case D Crash Simulation (Crash after Tx before Final State Save)
    // ----------------------------------------------------
    it('Phase 4.2 Case D: recovers when Tx and stock exist but server crashed before final status save', async () => {
      const draft = await createTestDraft();
      const initialStock = productA1.stockQuantity;

      const simulatedPurchase = await Purchase.create({
        businessId: businessA._id,
        purchaseNumber: 'PUR-CASE-D-001',
        purchaseType: 'DIRECT_PURCHASE',
        vendorId: vendorA._id,
        purchaseDate: new Date(),
        subtotal: 7500,
        discountAmount: 0,
        taxAmount: 1350,
        totalAmount: 8850,
        paidAmount: 0,
        outstandingAmount: 8850,
        receivingStatus: 'NOT_RECEIVED',
        status: 'CONFIRMED',
        sourceDraftId: draft._id,
        items: [
          {
            productId: productA1._id,
            productNameSnapshot: productA1.name,
            skuSnapshot: productA1.sku,
            orderedQuantity: 5,
            receivedQuantity: 0,
            remainingQuantity: 5,
            unitPurchasePrice: 1500,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 18,
            taxAmount: 1350,
            totalAmount: 8850,
            receivingStatus: 'NOT_RECEIVED',
          },
        ],
      });

      const receipt = await PurchaseReceipt.create({
        businessId: businessA._id,
        purchaseId: simulatedPurchase._id,
        receiptNumber: 'REC-2609-0002',
        receivedBy: userA._id,
        receivedAt: new Date(),
        idempotencyKey: `DIRECT_RECEIPT_${simulatedPurchase._id}`,
        items: [
          {
            purchaseItemId: simulatedPurchase.items[0]._id,
            productId: productA1._id,
            productNameSnapshot: productA1.name,
            quantityReceived: 5,
            unitPurchasePrice: 1500,
          },
        ],
      });

      // Stock was already updated
      await Product.findByIdAndUpdate(productA1._id, { $inc: { stockQuantity: 5 } });

      // Transaction was already inserted
      await InventoryTransaction.create({
        businessId: businessA._id,
        productId: productA1._id,
        quantity: 5,
        transactionType: 'PURCHASE_RECEIPT',
        referenceType: 'PURCHASE_RECEIPT',
        referenceId: receipt._id,
        purchaseId: simulatedPurchase._id,
        idempotencyKey: `RECEIPT_ITEM_${receipt._id}_${simulatedPurchase.items[0]._id}`,
        unitCostPrice: 1500,
      });

      // Verification: Stock is already initial + 5
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 5);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);

      // Confirmation retry arrives
      const res = await request(app)
        .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({ purchaseType: 'DIRECT_PURCHASE', directReceivedFull: true });

      expect(res.status).toBe(200);

      // Stock was NOT doubled! Tx was NOT duplicated!
      expect(await Purchase.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 5);

      const healedPurchase = await Purchase.findById(simulatedPurchase._id);
      expect(healedPurchase?.receivingStatus).toBe('RECEIVED');
    });

    // ----------------------------------------------------
    // Scenario 4.2.4: Concurrent processReceiving calls with same idempotencyKey
    // ----------------------------------------------------
    it('Phase 4.2: concurrent processReceiving with same idempotencyKey produces exactly one receipt and stock increment', async () => {
      const initialStock = productA1.stockQuantity;

      const purchase = await Purchase.create({
        businessId: businessA._id,
        purchaseNumber: 'PUR-CONC-001',
        purchaseType: 'ORDERED_PURCHASE',
        vendorId: vendorA._id,
        purchaseDate: new Date(),
        subtotal: 7500,
        discountAmount: 0,
        taxAmount: 1350,
        totalAmount: 8850,
        paidAmount: 0,
        outstandingAmount: 8850,
        receivingStatus: 'NOT_RECEIVED',
        status: 'CONFIRMED',
        items: [
          {
            productId: productA1._id,
            productNameSnapshot: productA1.name,
            skuSnapshot: productA1.sku,
            orderedQuantity: 5,
            receivedQuantity: 0,
            remainingQuantity: 5,
            unitPurchasePrice: 1500,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 18,
            taxAmount: 1350,
            totalAmount: 8850,
            receivingStatus: 'NOT_RECEIVED',
          },
        ],
      });

      const receivingParams = {
        businessId: businessA._id,
        purchase,
        itemsToReceive: [
          {
            purchaseItemId: purchase.items[0]!._id as Types.ObjectId,
            quantityReceived: 5,
          },
        ],
        receivedBy: userA._id,
        idempotencyKey: `CONCURRENT_RECEIPT_${purchase._id}`,
      };

      // Launch two concurrent receiving operations simultaneously
      const [rec1, rec2] = await Promise.all([
        processReceiving(receivingParams),
        processReceiving(receivingParams),
      ]);

      expect(rec1._id.toString()).toBe(rec2._id.toString());

      // Exactly 1 receipt in DB
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
      // Exactly 1 inventory transaction in DB
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);
      // Stock incremented exactly once (+5)
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 5);
    });

    // ----------------------------------------------------
    // Scenario 4.2.5: Manual Partial Receiving & Duplicate Request Prevention
    // ----------------------------------------------------
    it('Phase 4.2: manual partial receiving supports multiple receipts and rejects duplicate operations', async () => {
      const initialStock = productA1.stockQuantity;

      // Create an ORDERED_PURCHASE for 10 units
      const purchase = await Purchase.create({
        businessId: businessA._id,
        purchaseNumber: 'PUR-PARTIAL-001',
        purchaseType: 'ORDERED_PURCHASE',
        vendorId: vendorA._id,
        purchaseDate: new Date(),
        subtotal: 15000,
        discountAmount: 0,
        taxAmount: 2700,
        totalAmount: 17700,
        paidAmount: 0,
        outstandingAmount: 17700,
        receivingStatus: 'NOT_RECEIVED',
        status: 'CONFIRMED',
        items: [
          {
            productId: productA1._id,
            productNameSnapshot: productA1.name,
            skuSnapshot: productA1.sku,
            orderedQuantity: 10,
            receivedQuantity: 0,
            remainingQuantity: 10,
            unitPurchasePrice: 1500,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 18,
            taxAmount: 2700,
            totalAmount: 17700,
            receivingStatus: 'NOT_RECEIVED',
          },
        ],
      });

      const purchaseItemId = purchase.items[0]!._id!.toString();

      // Receipt 1: Receive 4 units with Idempotency-Key: OP-1
      const res1 = await request(app)
        .post(`/api/purchases/${purchase._id}/receive`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .set('idempotency-key', 'OP-PARTIAL-1')
        .send({
          items: [{ purchaseItemId, quantityReceived: 4 }],
        });

      expect(res1.status).toBe(201);
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 4);

      let updatedP = await Purchase.findById(purchase._id);
      expect(updatedP?.receivingStatus).toBe('PARTIALLY_RECEIVED');
      expect(updatedP?.items[0].receivedQuantity).toBe(4);
      expect(updatedP?.items[0].remainingQuantity).toBe(6);

      // Duplicate submission of Receipt 1 (same idempotency-key):
      const res1Duplicate = await request(app)
        .post(`/api/purchases/${purchase._id}/receive`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .set('idempotency-key', 'OP-PARTIAL-1')
        .send({
          items: [{ purchaseItemId, quantityReceived: 4 }],
        });

      expect(res1Duplicate.status).toBe(201);
      // Zero duplicate receipts, zero duplicate transactions, stock remains initial + 4
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(1);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(1);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 4);

      // Receipt 2: Receive remaining 6 units with Idempotency-Key: OP-2
      const res2 = await request(app)
        .post(`/api/purchases/${purchase._id}/receive`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .set('idempotency-key', 'OP-PARTIAL-2')
        .send({
          items: [{ purchaseItemId, quantityReceived: 6 }],
        });

      expect(res2.status).toBe(201);
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(2);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(2);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 10);

      updatedP = await Purchase.findById(purchase._id);
      expect(updatedP?.receivingStatus).toBe('RECEIVED');
      expect(updatedP?.items[0].receivedQuantity).toBe(10);
      expect(updatedP?.items[0].remainingQuantity).toBe(0);

      // Duplicate submission of Receipt 2 (same idempotency-key):
      const res2Duplicate = await request(app)
        .post(`/api/purchases/${purchase._id}/receive`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .set('idempotency-key', 'OP-PARTIAL-2')
        .send({
          items: [{ purchaseItemId, quantityReceived: 6 }],
        });

      expect(res2Duplicate.status).toBe(201);
      expect(await PurchaseReceipt.countDocuments({ businessId: businessA._id })).toBe(2);
      expect(await InventoryTransaction.countDocuments({ businessId: businessA._id })).toBe(2);
      expect((await Product.findById(productA1._id))?.stockQuantity).toBe(initialStock + 10);
    });

    // ----------------------------------------------------
    // Scenario 4.2.6: Tenant Isolation in Receiving Operations
    // ----------------------------------------------------
    it('Phase 4.2: strict tenant isolation blocks cross-tenant receiving operations', async () => {
      // Purchase belongs to Tenant A
      const purchaseA = await Purchase.create({
        businessId: businessA._id,
        purchaseNumber: 'PUR-ISOL-001',
        purchaseType: 'ORDERED_PURCHASE',
        vendorId: vendorA._id,
        purchaseDate: new Date(),
        subtotal: 7500,
        discountAmount: 0,
        taxAmount: 1350,
        totalAmount: 8850,
        paidAmount: 0,
        outstandingAmount: 8850,
        receivingStatus: 'NOT_RECEIVED',
        status: 'CONFIRMED',
        items: [
          {
            productId: productA1._id,
            productNameSnapshot: productA1.name,
            skuSnapshot: productA1.sku,
            orderedQuantity: 5,
            receivedQuantity: 0,
            remainingQuantity: 5,
            unitPurchasePrice: 1500,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 18,
            taxAmount: 1350,
            totalAmount: 8850,
            receivingStatus: 'NOT_RECEIVED',
          },
        ],
      });

      // Tenant B attempts to receive Tenant A's purchase
      const res = await request(app)
        .post(`/api/purchases/${purchaseA._id}/receive`)
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-business-id', businessB._id.toString())
        .send({
          items: [
            {
              purchaseItemId: purchaseA.items[0]!._id!.toString(),
              quantityReceived: 5,
            },
          ],
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PURCHASE_NOT_FOUND');

      // 0 Receipts, 0 Transactions in either tenant
      expect(await PurchaseReceipt.countDocuments({})).toBe(0);
      expect(await InventoryTransaction.countDocuments({})).toBe(0);
    });

    // ----------------------------------------------------
    // Scenario 4.2.7: rawExtraction Immutability Verification
    // ----------------------------------------------------
    it('Phase 4.2: rawExtraction remains untouched and immutable throughout confirmation and recoveries', async () => {
      const draft = await createTestDraft();
      const preConfirmedDraft = await PurchaseDraft.findById(draft._id);
      const originalRawJson = JSON.stringify(preConfirmedDraft?.rawExtraction);

      const res = await request(app)
        .post(`/api/purchases/scanner/drafts/${draft._id}/confirm`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString())
        .send({ purchaseType: 'DIRECT_PURCHASE', directReceivedFull: true });

      expect(res.status).toBe(200);

      const reloadedDraft = await PurchaseDraft.findById(draft._id);
      expect(JSON.stringify(reloadedDraft?.rawExtraction)).toBe(originalRawJson);
    });
  });
});

