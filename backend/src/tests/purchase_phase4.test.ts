import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../services/DocumentGenerationService', () => {
  return {
    DocumentGenerationService: {
      generateDocuments: jest.fn().mockResolvedValue({}),
      generateBuffers: jest.fn().mockResolvedValue({}),
      generateAmcQuotationBuffers: jest.fn().mockResolvedValue({
        pngBuffer: Buffer.from('mock-png'),
        pdfBuffer: Buffer.from('mock-pdf'),
      }),
      generateAmcQuotationDocuments: jest.fn().mockResolvedValue({}),
    },
  };
});

import app from '../app';
import { env } from '../config/env';
import { User } from '../database/models/User';
import { Business } from '../database/models/Business';
import { BusinessMember } from '../database/models/BusinessMember';
import { Product } from '../database/models/Product';
import { Vendor } from '../database/models/Vendor';
import { Purchase } from '../database/models/Purchase';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

let token: string;
let testUser: any;
let business: any;
let product1: any;
let product2: any;
let testVendor: any;
let purchaseId: string;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);

  // Setup user & business
  testUser = await User.create({
    name: 'Phase 4 Admin',
    email: `phase4_${Date.now()}@jayramji.com`,
    passwordHash: 'dummyhash',
  });

  business = await Business.create({
    name: 'Jay Ramji Phase 4 Automations',
    legalName: 'Jay Ramji Phase 4 Automations Corp',
    address: {
      line1: 'Baroi Road',
      city: 'Mundra',
      state: 'Gujarat',
      postalCode: '370421',
      country: 'India',
    },
    contact: {
      phone: '8469326901',
      email: 'phase4@jayramji.com',
    },
    ownerId: testUser._id,
    active: true,
  });

  await BusinessMember.create({
    businessId: business._id,
    userId: testUser._id,
    role: 'OWNER',
  });

  token = jwt.sign(
    { userId: testUser._id.toString(), email: testUser.email },
    env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  testVendor = await Vendor.create({
    businessId: business._id,
    name: 'Blue Star Spares Distribution Ltd',
    vendorCode: 'VND-BS-01',
    mobile: '9825123456',
    gstNumber: '24AAACB0123M1Z5',
    isActive: true,
  });

  product1 = await Product.create({
    businessId: business._id,
    name: 'Rotary Compressor 1.5 Ton',
    sku: 'COMP-ROT-1.5T',
    uom: 'NOS',
    defaultPriceMinor: 850000,
    stockQuantity: 4,
    active: true,
  });

  product2 = await Product.create({
    businessId: business._id,
    name: 'Copper Pipe 1/2 Inch (50ft)',
    sku: 'COPPER-PIPE-12',
    uom: 'ROLL',
    defaultPriceMinor: 320000,
    stockQuantity: 10,
    active: true,
  });
});

afterAll(async () => {
  await Purchase.deleteMany({ businessId: business?._id });
  await Vendor.deleteMany({ businessId: business?._id });
  await Product.deleteMany({ businessId: business?._id });
  await BusinessMember.deleteMany({ businessId: business?._id });
  await Business.deleteMany({ _id: business?._id });
  await User.deleteMany({ _id: testUser?._id });
  await mongoose.disconnect();
});

describe('Purchase Module - Phase 4: Automation (AI/OCR Bill Extraction & CSV Import)', () => {
  describe('1. Bill OCR / Extraction Endpoint', () => {
    it('should extract structured draft purchase from uploaded bill buffer without modifying stock', async () => {
      const mockBillText = `
        TAX INVOICE
        Blue Star Spares Distribution Ltd
        GSTIN: 24AAACB0123M1Z5
        Invoice No: INV-BS-2026-9042
        Date: 2026-09-13
        
        Items:
        Rotary Compressor 1.5 Ton, 2, 6500, 18
        Copper Pipe 1/2 Inch (50ft), 5, 2400, 18
      `;

      const initialStock1 = (await Product.findById(product1._id))!.stockQuantity;

      const res = await request(app)
        .post('/api/purchases/extract-bill')
        .set('Authorization', `Bearer ${token}`)
        .attach('billFile', Buffer.from(mockBillText), 'invoice_sample.txt');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('extraction');

      const ext = res.body.data.extraction;
      expect(ext.vendorInvoiceNumber).toBe('INV-BS-2026-9042');
      expect(ext.suggestedVendor).toBeDefined();
      expect(ext.suggestedVendor.name).toContain('Blue Star Spares');

      // Verify items extracted & matched
      expect(ext.items.length).toBe(2);
      expect(ext.items[0].matchedProductId).toBe(product1._id.toString());
      expect(ext.items[0].isMatched).toBe(true);
      expect(ext.items[0].rawQuantity).toBe(2);
      expect(ext.items[0].rawUnitPrice).toBe(6500);

      // Verify strict invariant: Stock remains completely untouched
      const currentStock1 = (await Product.findById(product1._id))!.stockQuantity;
      expect(currentStock1).toBe(initialStock1);

      // Verify strict invariant: No purchase was inserted into DB
      const dbCount = await Purchase.countDocuments({ businessId: business._id });
      expect(dbCount).toBe(0);
    });
  });

  describe('2. CSV Import Endpoint', () => {
    it('should parse CSV items, match by SKU, and validate rows', async () => {
      const csvContent = `
Product Name,SKU,Quantity,Unit Price,Discount %,Tax %
Rotary Compressor 1.5 Ton,COMP-ROT-1.5T,3,6200,0,18
Copper Pipe 1/2 Inch,COPPER-PIPE-12,4,2300,5,18
Invalid Item With Zero Qty,UNKNOWN-SKU,0,500,0,18
      `.trim();

      const res = await request(app)
        .post('/api/purchases/parse-csv')
        .set('Authorization', `Bearer ${token}`)
        .send({ csvText: csvContent });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalRows).toBe(3);
      expect(res.body.data.validRowsCount).toBe(2);
      expect(res.body.data.invalidRowsCount).toBe(1);

      const rows = res.body.data.rows;
      expect(rows[0].isValid).toBe(true);
      expect(rows[0].matchedProductId).toBe(product1._id.toString());
      expect(rows[0].quantity).toBe(3);

      expect(rows[1].isValid).toBe(true);
      expect(rows[1].matchedProductId).toBe(product2._id.toString());

      expect(rows[2].isValid).toBe(false);
      expect(rows[2].errors).toContain('Quantity must be greater than 0');
    });
  });

  describe('3. Purchase Bill Attachment Lifecycle', () => {
    beforeAll(async () => {
      const p = await Purchase.create({
        businessId: business._id,
        purchaseNumber: 'PUR-PH4-001',
        purchaseType: 'ORDERED_PURCHASE',
        vendorId: testVendor._id,
        purchaseDate: new Date(),
        subtotal: 10000,
        discountAmount: 0,
        taxAmount: 1800,
        totalAmount: 11800,
        paidAmount: 0,
        outstandingAmount: 11800,
        items: [
          {
            productId: product1._id,
            productNameSnapshot: product1.name,
            skuSnapshot: product1.sku,
            orderedQuantity: 2,
            receivedQuantity: 0,
            remainingQuantity: 2,
            unitPurchasePrice: 5000,
            discountPercent: 0,
            discountAmount: 0,
            taxRate: 18,
            taxAmount: 1800,
            totalAmount: 11800,
            receivingStatus: 'NOT_RECEIVED',
          },
        ],
      });
      purchaseId = p._id.toString();
    });

    let attachmentId: string;

    it('should upload and attach bill document to purchase order', async () => {
      const dummyPdf = Buffer.from('%PDF-1.4 Mock Invoice Bill Content');

      const res = await request(app)
        .post(`/api/purchases/${purchaseId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .attach('attachment', dummyPdf, 'signed_vendor_invoice.pdf');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attachment).toBeDefined();
      expect(res.body.data.attachment.fileName).toBe('signed_vendor_invoice.pdf');
      expect(res.body.data.attachment.fileUrl).toBeDefined();

      attachmentId = res.body.data.attachment._id.toString();

      // Check database
      const purchaseInDb = await Purchase.findById(purchaseId);
      expect(purchaseInDb!.billAttachments.length).toBe(1);
      expect(purchaseInDb!.billAttachments[0].fileName).toBe('signed_vendor_invoice.pdf');
    });

    it('should delete bill attachment from purchase order', async () => {
      const res = await request(app)
        .delete(`/api/purchases/${purchaseId}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const purchaseInDb = await Purchase.findById(purchaseId);
      expect(purchaseInDb!.billAttachments.length).toBe(0);
    });
  });
});
