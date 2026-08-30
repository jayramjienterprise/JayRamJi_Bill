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
import { Payment } from '../database/models/Payment';
import { PaymentAccount } from '../database/models/PaymentAccount';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

describe('Dashboard & Business Analytics Test Suite', () => {
  let userA: any;
  let userB: any;
  let tokenA: string;
  let tokenB: string;
  let businessA: any;
  let businessB: any;
  let customerA1: any;
  let customerA2: any;
  let productA1: any;
  let productA2: any;
  let accountBank: any;
  let accountUpi: any;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.MONGODB_URI);
    }
  });

  afterAll(async () => {
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
    await PaymentAccount.deleteMany({});

    // 1. Create Business A & Owner A
    userA = await User.create({
      email: 'ownerA@jayramji.com',
      passwordHash: 'hashed_password',
      name: 'Owner A',
      isEmailVerified: true,
    });

    businessA = await Business.create({
      name: 'Jay Ramji Enterprise A',
      slug: 'jay-ramji-a',
      ownerId: userA._id,
      currency: 'INR',
      address: {
        line1: 'Shop 101, Jay Ramji Market',
        city: 'Ahmedabad',
        state: 'Gujarat',
        postalCode: '380001',
        country: 'India',
      },
    });

    await BusinessMember.create({
      businessId: businessA._id,
      userId: userA._id,
      role: 'OWNER',
      status: 'ACTIVE',
    });

    tokenA = jwt.sign(
      { userId: userA._id.toString(), email: userA.email },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 2. Create Business B & Owner B (For Cross-Tenant Isolation Tests)
    userB = await User.create({
      email: 'ownerB@otherbiz.com',
      passwordHash: 'hashed_password',
      name: 'Owner B',
      isEmailVerified: true,
    });

    businessB = await Business.create({
      name: 'Other Business B',
      slug: 'other-biz-b',
      ownerId: userB._id,
      currency: 'INR',
      address: {
        line1: 'Unit 202, Trade Hub',
        city: 'Surat',
        state: 'Gujarat',
        postalCode: '395001',
        country: 'India',
      },
    });

    await BusinessMember.create({
      businessId: businessB._id,
      userId: userB._id,
      role: 'OWNER',
      status: 'ACTIVE',
    });

    tokenB = jwt.sign(
      { userId: userB._id.toString(), email: userB.email },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 3. Create Master Data for Business A
    customerA1 = await Customer.create({
      businessId: businessA._id,
      name: 'ABC Engineering',
      contact: { phone: '9876543210', email: 'abc@eng.com' },
      active: true,
    });

    customerA2 = await Customer.create({
      businessId: businessA._id,
      name: 'Rajesh Patel',
      contact: { phone: '9822334455', email: 'rajesh@patel.com' },
      active: true,
    });

    productA1 = await Product.create({
      businessId: businessA._id,
      type: 'SERVICE',
      name: 'AC Overhaul Service',
      defaultPriceMinor: 300000,
      uom: 'unit',
      defaultTaxRateBps: 0,
      active: true,
    });

    productA2 = await Product.create({
      businessId: businessA._id,
      type: 'PRODUCT',
      name: 'Copper Pipe Fitting',
      defaultPriceMinor: 200000,
      uom: 'mtr',
      defaultTaxRateBps: 0,
      active: true,
    });

    accountBank = await PaymentAccount.create({
      businessId: businessA._id,
      name: 'HDFC Current',
      displayName: 'HDFC Main Current',
      type: 'BANK',
      bankName: 'HDFC Bank',
      maskedAccountNumber: '••••4421',
      active: true,
    });
    expect(accountBank.name).toBe('HDFC Current');

    accountUpi = await PaymentAccount.create({
      businessId: businessA._id,
      name: 'GPay UPI',
      displayName: 'Jay Ramji GPay UPI',
      type: 'UPI',
      upiId: 'jayramji@hdfcbank',
      active: true,
    });

    // 4. Create Standard Test Invoices for Business A
    // Invoice 1: Finalized, Total ₹3,000, Fully Paid ₹3,000 via UPI
    const inv1 = await Invoice.create({
      businessId: businessA._id,
      invoiceNumber: 'JRE-000001',
      invoiceDate: new Date(),
      status: 'FINALIZED',
      currency: 'INR',
      customerId: customerA1._id,
      customerSnapshot: { name: 'ABC Engineering' },
      items: [
        {
          productId: productA1._id,
          type: 'SERVICE',
          description: 'AC Overhaul Service',
          uom: 'unit',
          quantity: 1,
          unitPriceMinor: 300000,
          lineTotalMinor: 300000,
          taxableAmountMinor: 300000,
          taxes: [],
          taxAmountMinor: 0,
        },
      ],
      totals: {
        subtotalMinor: 300000,
        discountMinor: 0,
        taxableAmountMinor: 300000,
        taxes: [],
        taxTotalMinor: 0,
        roundingMinor: 0,
        grandTotalMinor: 300000,
        currency: 'INR',
      },
      paymentSummary: {
        status: 'PAID',
        paidAmountMinor: 300000,
        dueAmountMinor: 0,
      },
      createdBy: userA._id,
      finalizedAt: new Date(),
    });

    await Payment.create({
      businessId: businessA._id,
      invoiceId: inv1._id,
      amountMinor: 300000,
      currency: 'INR',
      method: 'UPI',
      paymentAccountId: accountUpi._id,
      paymentAccountSnapshot: { displayName: 'Jay Ramji GPay UPI', type: 'UPI' },
      paidAt: new Date(),
      status: 'CONFIRMED',
      recordedBy: userA._id,
    });

    // Invoice 2: Finalized, Total ₹5,000, Partially Paid ₹2,000 via CASH (Due ₹3,000)
    const inv2 = await Invoice.create({
      businessId: businessA._id,
      invoiceNumber: 'JRE-000002',
      invoiceDate: new Date(),
      status: 'FINALIZED',
      currency: 'INR',
      customerId: customerA2._id,
      customerSnapshot: { name: 'Rajesh Patel', contact: { phone: '9822334455' } },
      items: [
        {
          productId: productA2._id,
          type: 'PRODUCT',
          description: 'Copper Pipe Fitting',
          uom: 'mtr',
          quantity: 2.5,
          unitPriceMinor: 200000,
          lineTotalMinor: 500000,
          taxableAmountMinor: 500000,
          taxes: [],
          taxAmountMinor: 0,
        },
      ],
      totals: {
        subtotalMinor: 500000,
        discountMinor: 0,
        taxableAmountMinor: 500000,
        taxes: [],
        taxTotalMinor: 0,
        roundingMinor: 0,
        grandTotalMinor: 500000,
        currency: 'INR',
      },
      paymentSummary: {
        status: 'PARTIALLY_PAID',
        paidAmountMinor: 200000,
        dueAmountMinor: 300000,
      },
      createdBy: userA._id,
      finalizedAt: new Date(),
    });

    await Payment.create({
      businessId: businessA._id,
      invoiceId: inv2._id,
      amountMinor: 200000,
      currency: 'INR',
      method: 'CASH',
      paymentAccountSnapshot: { displayName: 'Counter Cash', type: 'CASH' },
      paidAt: new Date(),
      status: 'CONFIRMED',
      recordedBy: userA._id,
    });

    // Invoice 3: Finalized, Total ₹7,000, UNPAID (Due ₹7,000)
    await Invoice.create({
      businessId: businessA._id,
      invoiceNumber: 'JRE-000003',
      invoiceDate: new Date(),
      status: 'FINALIZED',
      currency: 'INR',
      customerId: customerA1._id,
      customerSnapshot: { name: 'ABC Engineering' },
      items: [
        {
          productId: productA1._id,
          type: 'SERVICE',
          description: 'AC Overhaul Service',
          uom: 'unit',
          quantity: 2,
          unitPriceMinor: 350000,
          lineTotalMinor: 700000,
          taxableAmountMinor: 700000,
          taxes: [],
          taxAmountMinor: 0,
        },
      ],
      totals: {
        subtotalMinor: 700000,
        discountMinor: 0,
        taxableAmountMinor: 700000,
        taxes: [],
        taxTotalMinor: 0,
        roundingMinor: 0,
        grandTotalMinor: 700000,
        currency: 'INR',
      },
      paymentSummary: {
        status: 'UNPAID',
        paidAmountMinor: 0,
        dueAmountMinor: 700000,
      },
      createdBy: userA._id,
      finalizedAt: new Date(),
    });

    // Invoice 4: DRAFT Invoice (Must NOT count in Turnover or Sales)
    await Invoice.create({
      businessId: businessA._id,
      invoiceNumber: null,
      invoiceDate: new Date(),
      status: 'DRAFT',
      currency: 'INR',
      customerId: customerA1._id,
      items: [],
      totals: {
        subtotalMinor: 5000000,
        discountMinor: 0,
        taxableAmountMinor: 5000000,
        taxes: [],
        taxTotalMinor: 0,
        roundingMinor: 0,
        grandTotalMinor: 5000000,
        currency: 'INR',
      },
      paymentSummary: {
        status: 'UNPAID',
        paidAmountMinor: 0,
        dueAmountMinor: 5000000,
      },
      createdBy: userA._id,
    });

    // Invoice 5: CANCELLED Invoice (Must NOT count in Turnover or Sales)
    await Invoice.create({
      businessId: businessA._id,
      invoiceNumber: 'JRE-000000',
      invoiceDate: new Date(),
      status: 'CANCELLED',
      cancellationReason: 'Duplicate entry',
      currency: 'INR',
      customerId: customerA1._id,
      items: [],
      totals: {
        subtotalMinor: 8000000,
        discountMinor: 0,
        taxableAmountMinor: 8000000,
        taxes: [],
        taxTotalMinor: 0,
        roundingMinor: 0,
        grandTotalMinor: 8000000,
        currency: 'INR',
      },
      paymentSummary: {
        status: 'UNPAID',
        paidAmountMinor: 0,
        dueAmountMinor: 8000000,
      },
      createdBy: userA._id,
    });
  });

  describe('Dashboard Overview & Activity Endpoints', () => {
    it('1. should calculate authoritative Dashboard KPIs for Business A', async () => {
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const kpis = res.body.data.kpis;
      // Expected:
      // Total Sales = ₹3,000 + ₹5,000 + ₹7,000 = ₹15,000 (1500000 minor)
      // Money Received = ₹3,000 + ₹2,000 = ₹5,000 (500000 minor)
      // Outstanding Dues = ₹3,000 + ₹7,000 = ₹10,000 (1000000 minor)
      // Invoices = 3 (Drafts and Cancelled ignored)
      // Average Ticket = ₹15,000 / 3 = ₹5,000 (500000 minor)
      // Collection Rate = (₹5,000 / ₹15,000) * 100 = 33.3%
      expect(kpis.salesMinor).toBe(1500000);
      expect(kpis.moneyReceivedMinor).toBe(500000);
      expect(kpis.outstandingMinor).toBe(1000000);
      expect(kpis.invoiceCount).toBe(3);
      expect(kpis.averageInvoiceMinor).toBe(500000);
      expect(kpis.paidRatePercentage).toBeCloseTo(33.3, 1);

      // Verify payment methods breakdown
      const methods = res.body.data.paymentMethods;
      expect(methods.length).toBe(2);
      const upi = methods.find((m: any) => m.method === 'UPI');
      const cash = methods.find((m: any) => m.method === 'CASH');
      expect(upi.amountMinor).toBe(300000);
      expect(cash.amountMinor).toBe(200000);

      // Verify top customers
      const topCustomers = res.body.data.topCustomers;
      expect(topCustomers.length).toBe(2);
      expect(topCustomers[0].customerName).toBe('ABC Engineering');
      expect(topCustomers[0].salesMinor).toBe(1000000); // ₹3,000 + ₹7,000

      // Verify best selling items
      const bestSelling = res.body.data.bestSelling;
      expect(bestSelling.length).toBe(2);
      const acService = bestSelling.find((b: any) => b.description === 'AC Overhaul Service');
      expect(acService.quantitySold).toBe(3);
      expect(acService.revenueMinor).toBe(1000000);
    });

    it('2. should return combined recent activity stream', async () => {
      const res = await request(app)
        .get('/api/dashboard/recent-activity')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.activities)).toBe(true);
      expect(res.body.data.activities.length).toBeGreaterThan(0);
    });
  });

  describe('Dedicated Analytics Endpoints', () => {
    it('3. should return complete Business Analytics overview with growth indicators', async () => {
      const res = await request(app)
        .get('/api/analytics/overview?preset=THIS_MONTH')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const kpis = res.body.data.kpis;
      expect(kpis.turnoverMinor).toBe(1500000);
      expect(kpis.totalReceivedMinor).toBe(500000);
      expect(kpis.outstandingMinor).toBe(1000000);
      expect(kpis.totalOrders).toBe(3);
      expect(kpis.uniqueCustomers).toBe(2);
      expect(kpis.averageOrderValueMinor).toBe(500000);
      expect(kpis.collectionRate).toBeCloseTo(33.3, 1);
    });

    it('4. should return Sales vs Payments trend time-series', async () => {
      const res = await request(app)
        .get('/api/analytics/sales-trend?preset=THIS_MONTH&groupBy=day')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.series)).toBe(true);
      expect(res.body.data.series.length).toBeGreaterThan(0);
    });

    it('5. should return payment method frequency & highest value channel', async () => {
      const res = await request(app)
        .get('/api/analytics/payment-methods')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalReceivedMinor).toBe(500000);
      expect(res.body.data.totalTransactions).toBe(2);
      expect(res.body.data.highestValueMethod.method).toBe('UPI');
      expect(res.body.data.highestValueMethod.amountMinor).toBe(300000);
    });

    it('6. should return receiving accounts performance', async () => {
      const res = await request(app)
        .get('/api/analytics/receiving-accounts')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accounts.length).toBe(2);
    });

    it('7. should return customer analytics sorted by sales and outstanding', async () => {
      const res = await request(app)
        .get('/api/analytics/customers?sortBy=outstanding')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const customers = res.body.data.customers;
      expect(customers[0].customerName).toBe('ABC Engineering');
      expect(customers[0].outstandingMinor).toBe(700000);
    });

    it('8. should return products & services analytics strictly from invoice snapshots', async () => {
      const res = await request(app)
        .get('/api/analytics/products?sortBy=revenue')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const products = res.body.data.products;
      expect(products[0].description).toBe('AC Overhaul Service');
      expect(products[0].quantitySold).toBe(3);
      expect(products[0].revenueMinor).toBe(1000000);
      expect(products[0].percentOfTurnover).toBeCloseTo(66.7, 1);
    });

    it('9. should return outstanding analysis with unpaid vs partial breakdown', async () => {
      const res = await request(app)
        .get('/api/analytics/outstanding')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalOutstandingMinor).toBe(1000000);
      expect(res.body.data.breakdown.unpaidMinor).toBe(700000);
      expect(res.body.data.breakdown.unpaidCount).toBe(1);
      expect(res.body.data.breakdown.partialMinor).toBe(300000);
      expect(res.body.data.breakdown.partialCount).toBe(1);
    });
  });

  describe('Multi-Tenant Security & Isolation', () => {
    it('10. should strictly isolate analytics so Business B cannot view Business A financial data', async () => {
      // Requesting as Business B
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-business-id', businessB._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Business B has 0 invoices and 0 payments
      expect(res.body.data.kpis.salesMinor).toBe(0);
      expect(res.body.data.kpis.moneyReceivedMinor).toBe(0);
      expect(res.body.data.kpis.outstandingMinor).toBe(0);
      expect(res.body.data.kpis.invoiceCount).toBe(0);
      expect(res.body.data.paymentMethods.length).toBe(0);
      expect(res.body.data.topCustomers.length).toBe(0);
    });

    it('11. should reject unauthorized tenant switching (IDOR)', async () => {
      // User B tries to pass Business A id
      const res = await request(app)
        .get('/api/dashboard/overview')
        .set('Authorization', `Bearer ${tokenB}`)
        .set('x-business-id', businessA._id.toString());

      expect(res.status).toBe(403);
    });
  });
});
