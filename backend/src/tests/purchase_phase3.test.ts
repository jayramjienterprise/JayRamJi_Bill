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
import { VendorPayment } from '../database/models/VendorPayment';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

let token: string;
let testUser: any;
let business: any;
let product: any;
let testVendor: any;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);

  // Clean test records
  await VendorPayment.deleteMany({});
  await Purchase.deleteMany({});
  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});

  testUser = await User.create({
    name: 'Payment Test Admin',
    email: 'payment_test@jayramji.com',
    passwordHash: 'dummyhash',
  });

  business = await Business.create({
    name: 'Jay Ramji Payment Test Corp',
    legalName: 'Jay Ramji Payment Test Corp',
    address: {
      line1: 'Baroi Road',
      city: 'Mundra',
      state: 'Gujarat',
      postalCode: '370421',
      country: 'India',
    },
    contact: {
      phone: '8469326901',
      email: 'payment_test@jayramji.com',
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

  product = await Product.create({
    businessId: business._id,
    type: 'PRODUCT',
    name: 'AC Copper Pipe 1/2',
    sku: 'COP-050',
    uom: 'MTR',
    defaultPriceMinor: 45000,
    stockQuantity: 50,
  });

  testVendor = await Vendor.create({
    businessId: business._id,
    vendorCode: 'VEN-009',
    name: 'Metals & Pipes Gujarat',
    mobile: '9876500000',
    isActive: true,
  });
});

afterAll(async () => {
  await VendorPayment.deleteMany({});
  await Purchase.deleteMany({});
  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

describe('Purchase Module - Phase 3: Vendor Payments & Outstanding Payables', () => {
  let purchaseId: string;

  it('should create a purchase order with total ₹10,000 starting as UNPAID', async () => {
    // 20 meters @ ₹500 = ₹10,000
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        purchaseType: 'ORDERED_PURCHASE',
        vendorId: testVendor._id.toString(),
        vendorInvoiceNumber: 'INV-PAY-100',
        items: [
          {
            productId: product._id.toString(),
            orderedQuantity: 20,
            unitPurchasePrice: 500,
            taxRate: 0,
          },
        ],
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data.purchase;
    purchaseId = purchase._id;
    expect(purchase.totalAmount).toBe(10000);
    expect(purchase.paidAmount).toBe(0);
    expect(purchase.outstandingAmount).toBe(10000);
    expect(purchase.paymentStatus).toBe('UNPAID');
  });

  it('should record first payment of ₹4,000 via UPI and transition to PARTIALLY_PAID', async () => {
    const res = await request(app)
      .post(`/api/purchases/${purchaseId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amount: 4000,
        paymentMethod: 'UPI',
        referenceNumber: 'UPI/123456/MUNDRA',
        notes: '40% advance via GPay',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const payment = res.body.data.payment;
    expect(payment.paymentNumber).toMatch(/^VPAY-/);
    expect(payment.amount).toBe(4000);
    expect(payment.paymentMethod).toBe('UPI');

    const updatedPurchase = res.body.data.purchase;
    expect(updatedPurchase.paidAmount).toBe(4000);
    expect(updatedPurchase.outstandingAmount).toBe(6000);
    expect(updatedPurchase.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('should record second payment of ₹3,000 via CASH', async () => {
    const res = await request(app)
      .post(`/api/purchases/${purchaseId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amount: 3000,
        paymentMethod: 'CASH',
        notes: 'Paid in cash at shop',
      });

    expect(res.status).toBe(201);
    const updatedPurchase = res.body.data.purchase;
    expect(updatedPurchase.paidAmount).toBe(7000);
    expect(updatedPurchase.outstandingAmount).toBe(3000);
    expect(updatedPurchase.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('should reject payment exceeding outstanding balance (overpayment)', async () => {
    // Current outstanding is 3000; attempting 4000 should be rejected
    const res = await request(app)
      .post(`/api/purchases/${purchaseId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amount: 4000,
        paymentMethod: 'BANK_TRANSFER',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('OVERPAYMENT_NOT_ALLOWED');
  });

  it('should record final payment of ₹3,000 via BANK_TRANSFER and transition to PAID', async () => {
    const res = await request(app)
      .post(`/api/purchases/${purchaseId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amount: 3000,
        paymentMethod: 'BANK_TRANSFER',
        referenceNumber: 'NEFT-AXIS-999888',
      });

    expect(res.status).toBe(201);
    const updatedPurchase = res.body.data.purchase;
    expect(updatedPurchase.paidAmount).toBe(10000);
    expect(updatedPurchase.outstandingAmount).toBe(0);
    expect(updatedPurchase.paymentStatus).toBe('PAID');
  });

  it('should list all payment records for the purchase', async () => {
    const res = await request(app)
      .get(`/api/purchases/${purchaseId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payments.length).toBe(3);
    const totalPaidSum = res.body.data.payments.reduce((sum: number, p: any) => sum + p.amount, 0);
    expect(totalPaidSum).toBe(10000);
  });

  it('should retrieve vendor payments history from vendor endpoint', async () => {
    const res = await request(app)
      .get(`/api/vendors/${testVendor._id}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.payments.length).toBe(3);
  });

  it('should return correct analytics from purchase dashboard endpoint', async () => {
    const res = await request(app)
      .get('/api/purchases/dashboard')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.summary.totalCount).toBe(1);
    expect(data.summary.totalPurchased).toBe(10000);
    expect(data.summary.totalPaid).toBe(10000);
    expect(data.summary.totalOutstanding).toBe(0);
    expect(data.recentPurchases.length).toBe(1);
    expect(data.topVendors.length).toBe(1);
    expect(data.topVendors[0].name).toBe('Metals & Pipes Gujarat');
  });
});
