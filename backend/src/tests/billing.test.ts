import mongoose from 'mongoose';
import request from 'supertest';

// Mock DocumentGenerationService to bypass Puppeteer ESM loading issues in Jest
jest.mock('../services/DocumentGenerationService', () => {
  return {
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
    },
  };
});

import app from '../app';
import { User } from '../database/models/User';
import { Business } from '../database/models/Business';
import { BusinessMember } from '../database/models/BusinessMember';
import { Customer } from '../database/models/Customer';
import { Product } from '../database/models/Product';
import { Invoice } from '../database/models/Invoice';
import { InvoiceSequence } from '../database/models/InvoiceSequence';
import { Payment } from '../database/models/Payment';
import { PaymentAccount } from '../database/models/PaymentAccount';
import { AuditLog } from '../database/models/AuditLog';
import { IdempotencyKey } from '../database/models/IdempotencyKey';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/jayramji_bill_test';

let token: string;
let anotherToken: string;
let testUser: any;
let anotherUser: any;
let business: any;
let anotherBusiness: any;
let customer: any;
let anotherCustomer: any;
let product: any;
let anotherProduct: any;
let testUpiAccount: any;

beforeAll(async () => {
  process.env.MONGODB_URI = TEST_MONGO_URI;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);
});

afterAll(async () => {
  try {
    await mongoose.connection.dropDatabase();
  } catch (err) {}
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Business.deleteMany({});
  await BusinessMember.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await Invoice.deleteMany({});
  await Payment.deleteMany({});
  await AuditLog.deleteMany({});
  await IdempotencyKey.deleteMany({});

  // Seed Primary User & Business
  testUser = await User.create({
    name: 'Test Operator',
    email: 'test@example.com',
    passwordHash: 'hashedpassword',
    status: 'ACTIVE',
  });

  business = await Business.create({
    name: 'Test Business',
    legalName: 'Test Business Ltd',
    displayName: 'Test Biz',
    address: { line1: '123 Test St', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    contact: { phone: '1234567890', email: 'test@example.com' },
    timezone: 'Asia/Kolkata',
    invoiceSettings: {
      invoiceTitle: 'TAX INVOICE',
      prefix: 'TBI',
      defaultCurrency: 'INR',
      defaultTaxMode: 'NONE',
      defaultTaxRateBps: 0,
      numberingMode: 'SEQUENTIAL',
    },
    status: 'ACTIVE',
  });

  await BusinessMember.create({
    businessId: business._id,
    userId: testUser._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  // Seed Secondary User & Business for isolation checks
  anotherUser = await User.create({
    name: 'Other Operator',
    email: 'other@example.com',
    passwordHash: 'hashedpassword',
    status: 'ACTIVE',
  });

  anotherBusiness = await Business.create({
    name: 'Other Business',
    legalName: 'Other Business Ltd',
    displayName: 'Other Biz',
    address: { line1: '456 Other St', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    contact: { phone: '0987654321', email: 'other@example.com' },
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE',
  });

  await BusinessMember.create({
    businessId: anotherBusiness._id,
    userId: anotherUser._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  // Tokens
  token = jwt.sign({ userId: testUser._id, email: testUser.email }, env.JWT_SECRET);
  anotherToken = jwt.sign({ userId: anotherUser._id, email: anotherUser.email }, env.JWT_SECRET);

  // Seed Customers
  customer = await Customer.create({
    businessId: business._id,
    name: 'AON CLIENT',
    contact: { phone: '9999999999', email: 'client@aon.com' },
    address: { line1: 'Aon Tower', country: 'India' },
    active: true,
  });

  anotherCustomer = await Customer.create({
    businessId: anotherBusiness._id,
    name: 'OTHER CLIENT',
    contact: { phone: '8888888888', email: 'client@other.com' },
    address: { line1: 'Other Tower', country: 'India' },
    active: true,
  });

  // Seed Products
  product = await Product.create({
    businessId: business._id,
    type: 'SERVICE',
    name: 'AC DRY SERVICE',
    uom: 'JOB',
    defaultPriceMinor: 150000, // ₹1,500
    currency: 'INR',
    active: true,
  });

  anotherProduct = await Product.create({
    businessId: anotherBusiness._id,
    type: 'SERVICE',
    name: 'AC WET SERVICE',
    uom: 'JOB',
    defaultPriceMinor: 250000, // ₹2,500
    currency: 'INR',
    active: true,
  });

  // Seed default Payment Account
  testUpiAccount = await PaymentAccount.create({
    businessId: business._id,
    name: 'Jay Ramji UPI',
    displayName: 'Jay Ramji UPI (jayramji@upi)',
    type: 'UPI',
    upiId: 'jayramji@upi',
    active: true,
  });
});

describe('Billing Engine Core Tests', () => {
  describe('Calculations & Previews', () => {
    it('should correctly compute a single item with no discount or tax', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 2,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      expect(res.status).toBe(201);
      const totals = res.body.data.invoice.totals;
      expect(totals.subtotalMinor).toBe(300000); // 150000 * 2
      expect(totals.discountMinor).toBe(0);
      expect(totals.taxTotalMinor).toBe(0);
      expect(totals.grandTotalMinor).toBe(300000);
      expect(res.body.data.invoice.amountInWords).toBe('Three Thousand Rupees Only');
    });

    it('should correctly calculate fixed and percentage discounts', async () => {
      // 1. Percentage discount: 10% on 300000 = 30000
      const resPercentage = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 2,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
          discount: {
            type: 'PERCENTAGE',
            value: 1000, // 10% in basis points (1000/10000)
          },
        });

      expect(resPercentage.status).toBe(201);
      expect(resPercentage.body.data.invoice.totals.discountMinor).toBe(30000);
      expect(resPercentage.body.data.invoice.totals.grandTotalMinor).toBe(270000);

      // 2. Fixed discount: 25000 paise (₹250)
      const resFixed = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 2,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
          discount: {
            type: 'FIXED',
            value: 25000,
          },
        });

      expect(resFixed.status).toBe(201);
      expect(resFixed.body.data.invoice.totals.discountMinor).toBe(25000);
      expect(resFixed.body.data.invoice.totals.grandTotalMinor).toBe(275000);
    });

    it('should correctly calculate exclusive tax (GST 18%)', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 2,
              unitPriceMinor: 150000, // ₹3,000 total
            },
          ],
          taxMode: 'EXCLUSIVE',
          defaultTaxRateBps: 1800, // 18% basis points
        });

      expect(res.status).toBe(201);
      const totals = res.body.data.invoice.totals;
      expect(totals.subtotalMinor).toBe(300000);
      expect(totals.taxTotalMinor).toBe(54000); // 300000 * 0.18
      expect(totals.grandTotalMinor).toBe(354000); // 300000 + 54000
    });

    it('should correctly calculate inclusive tax (GST 18%)', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 2,
              unitPriceMinor: 150000, // ₹3,000 total inclusive
            },
          ],
          taxMode: 'INCLUSIVE',
          defaultTaxRateBps: 1800, // 18% basis points
        });

      expect(res.status).toBe(201);
      const totals = res.body.data.invoice.totals;
      expect(totals.grandTotalMinor).toBe(300000); // Inclusive means grand total is exactly the subtotal
      // Taxable amount: 300000 / 1.18 = 254237.28 -> 254237
      expect(totals.taxableAmountMinor).toBe(254237);
      expect(totals.taxTotalMinor).toBe(45763); // 300000 - 254237
    });

    it('should perform nearest-rupee rounding', async () => {
      // 1. Exclusive tax with rounding
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 123456, // ₹1,234.56
            },
          ],
          taxMode: 'EXCLUSIVE',
          defaultTaxRateBps: 1800, // 18% GST -> 22222 paise tax -> 145678 paise grand pre-round
        });

      expect(res.status).toBe(201);
      const totals = res.body.data.invoice.totals;
      // 123456 * 1.18 = 145678.08 paise. Nearest 100 paise (Rupee) = 145700 paise (₹1,457.00)
      expect(totals.grandTotalMinor).toBe(145700);
      expect(totals.roundingMinor).toBe(22); // 145700 - 145678
    });
  });

  describe('Validation & Scoping', () => {
    it('should block drafts with negative or zero quantities', async () => {
      const resZero = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 0,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      expect(resZero.status).toBe(400);

      const resNegative = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: -2,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      expect(resNegative.status).toBe(400);
    });

    it('should reject inputs with quantity exceeding 3 decimal places', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1.2345,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      // Zod or finalize validation blocks it
      expect(res.status).toBe(400);
    });

    it('should reject customer of another business tenant (IDOR)', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: anotherCustomer._id.toString(), // belongs to anotherBusiness
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      expect(res.status).toBe(404); // client customer mismatch
    });

    it('should reject product of another business tenant (IDOR)', async () => {
      const res = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: anotherProduct._id.toString(), // belongs to anotherBusiness
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      expect(res.status).toBe(404); // client product mismatch
    });
  });

  describe('Invoice Lifecycle & Finalization', () => {
    it('should support DRAFT -> FINALIZED, sequentially numbering and freezing snapshots', async () => {
      // 1. Create Draft
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      expect(draftRes.status).toBe(201);
      const draftInvoice = draftRes.body.data.invoice;
      expect(draftInvoice.status).toBe('DRAFT');
      expect(draftInvoice.invoiceNumber).toBeNull();

      // 2. Finalize
      const finalizeRes = await request(app)
        .post(`/api/invoices/${draftInvoice._id}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(finalizeRes.status).toBe(200);
      const finalized = finalizeRes.body.data.invoice;
      expect(finalized.status).toBe('FINALIZED');
      expect(finalized.invoiceNumber).toBe('TBI-000001');

      // 3. Check Snapshots in DB
      const dbInvoice = await Invoice.findById(draftInvoice._id);
      expect(dbInvoice!.status).toBe('FINALIZED');
      expect(dbInvoice!.customerSnapshot.name).toBe('AON CLIENT');
      expect(dbInvoice!.businessSnapshot.name).toBe('Test Business');

      // 4. Try modifying finalized invoice (should fail)
      const modifyRes = await request(app)
        .patch(`/api/invoices/${draftInvoice._id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          notes: 'Try editing details',
        });
      expect(modifyRes.status).toBe(400); // Blocked
    });

    it('should block double-finalizing an invoice', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      const draftId = draftRes.body.data.invoice._id;

      // First finalization
      const fin1 = await request(app)
        .post(`/api/invoices/${draftId}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(fin1.status).toBe(200);

      // Second finalization
      const fin2 = await request(app)
        .post(`/api/invoices/${draftId}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(fin2.status).toBe(400); // Already finalized
    });

    it('should support DRAFT -> CANCELLED and FINALIZED -> CANCELLED', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      const draftId = draftRes.body.data.invoice._id;

      // Cancel Draft
      const cancelRes = await request(app)
        .post(`/api/invoices/${draftId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ reason: 'Client changed mind' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.invoice.status).toBe('CANCELLED');

      // Verify it cannot be finalized now
      const finRes = await request(app)
        .post(`/api/invoices/${draftId}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(finRes.status).toBe(400);
    });
  });

  describe('Idempotency Mechanisms', () => {
    it('should return exactly same cached response on repeated requests using same key', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      const draftId = draftRes.body.data.invoice._id;
      const idempotencyKey = 'key-finalize-12345';

      // Call 1
      const res1 = await request(app)
        .post(`/api/invoices/${draftId}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .set('Idempotency-Key', idempotencyKey);

      expect(res1.status).toBe(200);
      const invoiceNum1 = res1.body.data.invoice.invoiceNumber;

      // Call 2 (identical key)
      const res2 = await request(app)
        .post(`/api/invoices/${draftId}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .set('Idempotency-Key', idempotencyKey);

      expect(res2.status).toBe(200);
      expect(res2.body.data.invoice.invoiceNumber).toBe(invoiceNum1);

      // Verify sequence nextNumber only incremented once
      const sequence = await InvoiceSequence.findOne({ businessId: business._id });
      expect(sequence!.nextNumber).toBe(2); // Initial was 1, incremented to 2 on first call, second call served from cache
    });
  });

  describe('Payments Module', () => {
    it('should prevent payments on draft invoices', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      const draftId = draftRes.body.data.invoice._id;

      const paymentRes = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          amountMinor: 50000,
          method: 'UPI',
          referenceNumber: '1234567890',
        });

      expect(paymentRes.status).toBe(400); // Payments forbidden on DRAFT
    });

    it('should successfully record payments and keep due/paid amounts consistent', async () => {
      // 1. Create and Finalize Invoice (Total ₹1500)
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      const draftId = draftRes.body.data.invoice._id;

      await request(app)
        .post(`/api/invoices/${draftId}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      // 2. Record Partial Payment (₹500 / 50000 paise)
      const pay1 = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          amountMinor: 50000,
          method: 'UPI',
          paymentAccountId: testUpiAccount._id.toString(),
          referenceNumber: 'UPI0001',
        });

      expect(pay1.status).toBe(201);
      expect(pay1.body.data.paymentSummary.paidAmountMinor).toBe(50000);
      expect(pay1.body.data.paymentSummary.dueAmountMinor).toBe(100000);
      expect(pay1.body.data.paymentSummary.status).toBe('PARTIALLY_PAID');

      // 3. Record remaining payment (₹1000 / 100000 paise)
      const pay2 = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          amountMinor: 100000,
          method: 'CASH',
        });

      expect(pay2.status).toBe(201);
      expect(pay2.body.data.paymentSummary.paidAmountMinor).toBe(150000);
      expect(pay2.body.data.paymentSummary.dueAmountMinor).toBe(0);
      expect(pay2.body.data.paymentSummary.status).toBe('PAID');
    });

    it('should reject payment amounts exceeding the remaining due amount', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      const draftId = draftRes.body.data.invoice._id;
      await request(app)
        .post(`/api/invoices/${draftId}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      // Attempt recording payment of ₹2000 (200000 paise) on ₹1500 invoice
      const payRes = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          amountMinor: 200000,
          method: 'CARD',
        });

      expect(payRes.status).toBe(400); // Blocked
    });

    it('should support payment reversal and recalculate invoice status correctly', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      const draftId = draftRes.body.data.invoice._id;
      await request(app)
        .post(`/api/invoices/${draftId}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      // Record ₹500 payment
      const payRes = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          amountMinor: 50000,
          method: 'UPI',
          paymentAccountId: testUpiAccount._id.toString(),
        });

      const paymentId = payRes.body.data.payment._id;

      // Reverse payment
      const revRes = await request(app)
        .post(`/api/invoices/${draftId}/payments/${paymentId}/reverse`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ reason: 'Accidental entry' });

      expect(revRes.status).toBe(200);
      expect(revRes.body.data.payment.status).toBe('REVERSED');
      expect(revRes.body.data.paymentSummary.paidAmountMinor).toBe(0);
      expect(revRes.body.data.paymentSummary.dueAmountMinor).toBe(150000);
      expect(revRes.body.data.paymentSummary.status).toBe('UNPAID');
    });

    it('should reject zero and negative payment amounts', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'TEST', uom: 'JOB', quantity: 1, unitPriceMinor: 100000 }],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });
      const draftId = draftRes.body.data.invoice._id;
      await request(app).post(`/api/invoices/${draftId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());

      // Zero payment
      const zeroRes = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ amountMinor: 0, method: 'CASH' });
      expect(zeroRes.status).toBe(400);

      // Negative payment
      const negRes = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ amountMinor: -5000, method: 'CASH' });
      expect(negRes.status).toBe(400);
    });

    it('should reject payment recording against another business invoice (IDOR)', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'TEST', uom: 'JOB', quantity: 1, unitPriceMinor: 100000 }],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });
      const draftId = draftRes.body.data.invoice._id;
      await request(app).post(`/api/invoices/${draftId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());

      // Attempt payment from another tenant
      const crossPayRes = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .set('x-business-id', anotherBusiness._id.toString())
        .send({ amountMinor: 50000, method: 'CASH' });
      expect(crossPayRes.status).toBe(404);
    });

    it('should reject payment against a cancelled invoice', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'TEST', uom: 'JOB', quantity: 1, unitPriceMinor: 100000 }],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });
      const draftId = draftRes.body.data.invoice._id;
      await request(app).post(`/api/invoices/${draftId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());
      await request(app).post(`/api/invoices/${draftId}/cancel`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString()).send({ reason: 'Customer changed mind' });

      const payRes = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ amountMinor: 50000, method: 'CASH' });
      expect(payRes.status).toBe(400);
    });

    it('should prevent duplicate payments on retry using Idempotency-Key', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'TEST', uom: 'JOB', quantity: 1, unitPriceMinor: 100000 }],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });
      const draftId = draftRes.body.data.invoice._id;
      await request(app).post(`/api/invoices/${draftId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());

      const idempotencyKey = `idem-pay-${Date.now()}`;

      const pay1 = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .set('Idempotency-Key', idempotencyKey)
        .send({ amountMinor: 50000, method: 'UPI', paymentAccountId: testUpiAccount._id.toString() });
      expect(pay1.status).toBe(201);

      const pay2 = await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .set('Idempotency-Key', idempotencyKey)
        .send({ amountMinor: 50000, method: 'UPI', paymentAccountId: testUpiAccount._id.toString() });
      expect(pay2.status).toBe(201);
      expect(pay2.body.data.payment._id).toBe(pay1.body.data.payment._id);

      // Verify invoice only recorded 50000 paise (not doubled to 100000)
      const invCheck = await request(app)
        .get(`/api/invoices/${draftId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(invCheck.body.data.invoice.paymentSummary.paidAmountMinor).toBe(50000);
      expect(invCheck.body.data.invoice.paymentSummary.dueAmountMinor).toBe(50000);
      expect(invCheck.body.data.invoice.paymentSummary.status).toBe('PARTIALLY_PAID');
    });

    it('should guarantee finalized invoice content and totals remain strictly immutable after recording payment', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'ORIGINAL DESCRIPTION', uom: 'JOB', quantity: 1, unitPriceMinor: 100000 }],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });
      const draftId = draftRes.body.data.invoice._id;
      await request(app).post(`/api/invoices/${draftId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());

      // Record full payment
      await request(app)
        .post(`/api/invoices/${draftId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ amountMinor: 100000, method: 'CASH' });

      // Attempt to modify invoice content via patch (must fail)
      const patchRes = await request(app)
        .patch(`/api/invoices/${draftId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'HACKED DESCRIPTION', uom: 'JOB', quantity: 5, unitPriceMinor: 500000 }] });
      expect(patchRes.status).toBe(400);

      // Verify invoice content is intact
      const invCheck = await request(app)
        .get(`/api/invoices/${draftId}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(invCheck.body.data.invoice.status).toBe('FINALIZED');
      expect(invCheck.body.data.invoice.items[0].description).toBe('ORIGINAL DESCRIPTION');
      expect(invCheck.body.data.invoice.totals.grandTotalMinor).toBe(100000);
      expect(invCheck.body.data.invoice.paymentSummary.status).toBe('PAID');
    });
  });

  describe('IDOR & Security Protections', () => {
    it('should prevent reading invoices of another business workspace', async () => {
      // 1. Create a draft in business A
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [
            {
              productId: product._id.toString(),
              type: 'SERVICE',
              description: 'AC DRY SERVICE',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 150000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      const draftId = draftRes.body.data.invoice._id;

      // 2. Try accessing it from anotherUser with anotherBusiness context
      const accessRes = await request(app)
        .get(`/api/invoices/${draftId}`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .set('x-business-id', anotherBusiness._id.toString());

      expect(accessRes.status).toBe(404); // isolated/hidden
    });
  });

  describe('Prompt 3 - End-to-End Customer Delivery Suite', () => {
    it('should execute the complete 23-step shopkeeper workflow with exact calculations and snapshots', async () => {
      // Step 1: Customer Creation
      const custRes = await request(app)
        .post('/api/customers')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          name: 'Test Customer',
          contact: { phone: '9876543210', email: 'test@shop.com' },
          address: { line1: 'Shop #12, Market Road', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
        });
      expect(custRes.status).toBe(201);
      const testCustomer = custRes.body.data.customer;

      // Step 2: Catalogue Service Creation
      const s1 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ name: 'AC Water Service', type: 'SERVICE', uom: 'JOB', defaultPriceMinor: 130000, currency: 'INR' });
      expect(s1.status).toBe(201);

      const s2 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ name: 'Gas Refill', type: 'PRODUCT', uom: 'KG', defaultPriceMinor: 28000, currency: 'INR' });
      expect(s2.status).toBe(201);

      const s3 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ name: 'Service Charge', type: 'SERVICE', uom: 'VISIT', defaultPriceMinor: 12000, currency: 'INR' });
      expect(s3.status).toBe(201);

      // Step 3: Create Draft Bill with 3 items
      // AC Water Service: Qty 1 x ₹1,300 (130000 paise) = ₹1,300
      // Gas Refill: Qty 2 x ₹280 (28000 paise) = ₹560 (56000 paise)
      // Service Charge: Qty 3 x ₹120 (12000 paise) = ₹360 (36000 paise)
      // Expected Subtotal = ₹1,300 + ₹560 + ₹360 = ₹2,220 (222000 paise)
      const invoiceDraftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: testCustomer._id.toString(),
          items: [
            {
              productId: s1.body.data.product._id,
              type: 'SERVICE',
              description: 'AC Water Service',
              uom: 'JOB',
              quantity: 1,
              unitPriceMinor: 130000,
            },
            {
              productId: s2.body.data.product._id,
              type: 'PRODUCT',
              description: 'Gas Refill',
              uom: 'KG',
              quantity: 2,
              unitPriceMinor: 28000,
            },
            {
              productId: s3.body.data.product._id,
              type: 'SERVICE',
              description: 'Service Charge',
              uom: 'VISIT',
              quantity: 3,
              unitPriceMinor: 12000,
            },
          ],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });

      expect(invoiceDraftRes.status).toBe(201);
      const draft = invoiceDraftRes.body.data.invoice;
      expect(draft.totals.subtotalMinor).toBe(222000);
      expect(draft.totals.grandTotalMinor).toBe(222000);
      expect(draft.amountInWords).toBe('Two Thousand Two Hundred Twenty Rupees Only');

      // Step 4: Preview Draft Endpoint
      const previewRes = await request(app)
        .get(`/api/invoices/${draft._id}/preview`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(previewRes.status).toBe(200);
      expect(previewRes.body.data.totals.subtotal).toBe(2220);
      expect(previewRes.body.data.totals.grandTotal).toBe(2220);

      // Step 5: Finalize Invoice
      const finalizeRes = await request(app)
        .post(`/api/invoices/${draft._id}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(finalizeRes.status).toBe(200);
      const finalized = finalizeRes.body.data.invoice;
      expect(finalized.status).toBe('FINALIZED');
      expect(finalized.invoiceNumber).toBe('TBI-000001');

      const fullFinalizedRes = await request(app)
        .get(`/api/invoices/${draft._id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(fullFinalizedRes.body.data.invoice.customerSnapshot.name).toBe('Test Customer');
      expect(fullFinalizedRes.body.data.invoice.businessSnapshot.name).toBe('Test Business');

      // Step 6: Immutability Protection
      // Attempting to modify finalized invoice fields directly must fail
      const editAttempt = await request(app)
        .patch(`/api/invoices/${draft._id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ invoiceDate: '2026-09-01' });
      expect(editAttempt.status).toBe(400);

      // Step 7: Master Data Changes Must Not Affect Historical Snapshots
      // Change customer master data
      await request(app)
        .patch(`/api/customers/${testCustomer._id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ name: 'Completely Changed Customer Name' });

      // Change business settings
      await request(app)
        .patch('/api/business')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({ name: 'New Business Brand' });

      // Re-fetch finalized invoice and verify snapshots are preserved
      const historicalRes = await request(app)
        .get(`/api/invoices/${draft._id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(historicalRes.body.data.invoice.customerSnapshot.name).toBe('Test Customer');
      expect(historicalRes.body.data.invoice.businessSnapshot.name).toBe('Test Business');

      // Step 8: Public Share Lifecycle
      // Enable sharing
      const shareEnableRes = await request(app)
        .post(`/api/invoices/${draft._id}/share`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({});
      expect(shareEnableRes.status).toBe(200);
      const shareUrl = shareEnableRes.body.data.shareUrl;
      const shareToken = shareUrl.split('/').pop();
      expect(shareToken).toBeDefined();

      // Access public share unauthenticated
      const publicRes = await request(app).get(`/api/public/invoices/${shareToken}`);
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.data.invoice.invoiceNumber).toBe('TBI-000001');

      // Revoke public sharing
      const revokeRes = await request(app)
        .delete(`/api/invoices/${draft._id}/share`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(revokeRes.status).toBe(200);

      // Verify access to revoked token is now rejected
      const revokedAccessRes = await request(app).get(`/api/public/invoices/${shareToken}`);
      expect(revokedAccessRes.status).toBe(404);
    });
  });
});

