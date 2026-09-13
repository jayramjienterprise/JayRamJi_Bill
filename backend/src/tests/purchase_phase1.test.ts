import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
// Mock DocumentGenerationService to bypass Puppeteer browser launch in test runner
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

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);

  // Clean test records
  await Purchase.deleteMany({});
  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});

  // Setup user & business
  testUser = await User.create({
    name: 'Purchase Test Admin',
    email: 'purchase_test@jayramji.com',
    passwordHash: 'dummyhash',
  });

  business = await Business.create({
    name: 'Jay Ramji Purchase Test Corp',
    legalName: 'Jay Ramji Purchase Test Corp',
    address: {
      line1: 'Baroi Road',
      city: 'Mundra',
      state: 'Gujarat',
      postalCode: '370421',
      country: 'India',
    },
    contact: {
      phone: '8469326901',
      email: 'purchase_test@jayramji.com',
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

  // Setup Products
  product1 = await Product.create({
    businessId: business._id,
    type: 'PRODUCT',
    name: 'Capacitor 35µF',
    sku: 'CAP-35UF',
    uom: 'NOS',
    defaultPriceMinor: 25000,
    stockQuantity: 15,
  });

  product2 = await Product.create({
    businessId: business._id,
    type: 'PRODUCT',
    name: 'Contactor 25A',
    sku: 'CON-25A',
    uom: 'NOS',
    defaultPriceMinor: 85000,
    stockQuantity: 8,
  });
});

afterAll(async () => {
  await Purchase.deleteMany({});
  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

describe('Purchase Module - Phase 1: Core Vendors & Purchases', () => {
  describe('Vendor Management', () => {
    it('should create a new vendor with auto-generated vendorCode', async () => {
      const res = await request(app)
        .post('/api/vendors')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          name: 'Cooling Spares India Pvt Ltd',
          contactPerson: 'Ramesh Patel',
          mobile: '9876543210',
          gstNumber: '24AAAAA0000A1Z5',
          city: 'Ahmedabad',
          state: 'Gujarat',
          paymentTerms: 'Net 30',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendor).toBeDefined();
      expect(res.body.data.vendor.name).toBe('Cooling Spares India Pvt Ltd');
      expect(res.body.data.vendor.vendorCode).toMatch(/^VEN-\d{3}/);
      testVendor = res.body.data.vendor;
    });

    it('should list vendors with financial summaries', async () => {
      const res = await request(app)
        .get('/api/vendors')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.vendors.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.vendors.find((v: any) => v.id === testVendor._id.toString() || v._id === testVendor._id.toString());
      expect(found).toBeDefined();
      expect(found.totalPurchases).toBe(0);
      expect(found.outstandingAmount).toBe(0);
    });
  });

  describe('Purchase Order Creation', () => {
    it('should create an ORDERED_PURCHASE and verify stock remains unchanged', async () => {
      const initialStockP1 = product1.stockQuantity;

      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          purchaseType: 'ORDERED_PURCHASE',
          vendorId: testVendor._id.toString(),
          vendorInvoiceNumber: 'INV-2026-001',
          purchaseDate: new Date().toISOString(),
          items: [
            {
              productId: product1._id.toString(),
              orderedQuantity: 10,
              unitPurchasePrice: 180,
              taxRate: 18,
            },
            {
              productId: product2._id.toString(),
              orderedQuantity: 5,
              unitPurchasePrice: 600,
              taxRate: 18,
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const purchase = res.body.data.purchase;
      expect(purchase.purchaseNumber).toMatch(/^PUR-/);
      expect(purchase.purchaseType).toBe('ORDERED_PURCHASE');
      expect(purchase.receivingStatus).toBe('NOT_RECEIVED');
      expect(purchase.paymentStatus).toBe('UNPAID');

      // Check product snapshotting
      expect(purchase.items[0].productNameSnapshot).toBe('Capacitor 35µF');
      expect(purchase.items[0].skuSnapshot).toBe('CAP-35UF');
      expect(purchase.items[0].orderedQuantity).toBe(10);
      expect(purchase.items[0].receivedQuantity).toBe(0);
      expect(purchase.items[0].remainingQuantity).toBe(10);
      expect(purchase.items[0].receivingStatus).toBe('NOT_RECEIVED');

      // Math verification:
      // Item 1: 10 * 180 = 1800; Tax 18% = 324; Total = 2124
      // Item 2: 5 * 600 = 3000; Tax 18% = 540; Total = 3540
      // Subtotal = 4800, Tax = 864, Grand Total = 5664
      expect(purchase.subtotal).toBe(4800);
      expect(purchase.taxAmount).toBe(864);
      expect(purchase.totalAmount).toBe(5664);
      expect(purchase.outstandingAmount).toBe(5664);

      // Verify Product stock did NOT increase merely because purchase was created
      const currentP1 = await Product.findById(product1._id);
      expect(currentP1?.stockQuantity).toBe(initialStockP1);
    });

    it('should detect and prevent duplicate vendor invoice number', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          purchaseType: 'ORDERED_PURCHASE',
          vendorId: testVendor._id.toString(),
          vendorInvoiceNumber: 'INV-2026-001', // duplicate!
          items: [
            {
              productId: product1._id.toString(),
              orderedQuantity: 2,
              unitPurchasePrice: 180,
            },
          ],
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('DUPLICATE_VENDOR_INVOICE');
    });

    it('should allow checking duplicate invoice via API helper', async () => {
      const checkRes = await request(app)
        .get(`/api/purchases/check-duplicate-invoice?vendorId=${testVendor._id}&vendorInvoiceNumber=INV-2026-001`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.isDuplicate).toBe(true);
      expect(checkRes.body.data.existingPurchase).toBeDefined();

      const checkRes2 = await request(app)
        .get(`/api/purchases/check-duplicate-invoice?vendorId=${testVendor._id}&vendorInvoiceNumber=INV-UNIQUE-999`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(checkRes2.status).toBe(200);
      expect(checkRes2.body.data.isDuplicate).toBe(false);
    });

    it('should create a DIRECT_PURCHASE with directReceivedFull flag', async () => {
      const res = await request(app)
        .post('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          purchaseType: 'DIRECT_PURCHASE',
          directReceivedFull: true,
          vendorId: testVendor._id.toString(),
          vendorInvoiceNumber: 'CASH-BILL-888',
          items: [
            {
              productId: product1._id.toString(),
              orderedQuantity: 4,
              unitPurchasePrice: 175,
              discountPercent: 10,
              taxRate: 18,
            },
          ],
        });

      expect(res.status).toBe(201);
      const purchase = res.body.data.purchase;
      expect(purchase.purchaseType).toBe('DIRECT_PURCHASE');
      expect(purchase.receivingStatus).toBe('RECEIVED');
      expect(purchase.paymentStatus).toBe('UNPAID'); // Payment remains separate!
      expect(purchase.items[0].receivedQuantity).toBe(4);
      expect(purchase.items[0].remainingQuantity).toBe(0);
      expect(purchase.items[0].receivingStatus).toBe('RECEIVED');
    });

    it('should list purchases with status filters and summary metrics', async () => {
      const res = await request(app)
        .get('/api/purchases')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.purchases.length).toBe(2);
      expect(res.body.data.summary.totalCount).toBe(2);
      expect(res.body.data.summary.totalPurchased).toBeGreaterThan(0);
      expect(res.body.data.summary.totalOutstanding).toBeGreaterThan(0);
    });
  });
});
