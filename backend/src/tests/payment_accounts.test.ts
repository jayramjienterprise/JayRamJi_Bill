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
import { AuditLog } from '../database/models/AuditLog';
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
let product: any;

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
  await PaymentAccount.deleteMany({});
  await AuditLog.deleteMany({});

  // 1. Create Business A & User A
  testUser = await User.create({
    name: 'Jay Ramji Owner',
    email: 'shopkeeper@jayramji.com',
    passwordHash: 'hashed_password_abc',
  });

  business = await Business.create({
    name: 'Jay Ramji Enterprise',
    legalName: 'Jay Ramji Enterprise Pvt Ltd',
    displayName: 'Jay Ramji',
    slug: 'jay-ramji',
    address: { line1: 'Shop #4, Baroi Road', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    contact: { phone: '9825012345', email: 'info@jayramji.com' },
    taxProfile: { gstin: '24ABCDE1234F1Z5', pan: 'ABCDE1234F' },
  });

  await BusinessMember.create({
    businessId: business._id,
    userId: testUser._id,
    role: 'OWNER',
  });

  token = jwt.sign(
    { userId: testUser._id.toString(), email: testUser.email, businessId: business._id.toString(), role: 'OWNER' },
    env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  // 2. Create Business B & User B (for cross-tenant tests)
  anotherUser = await User.create({
    name: 'Other Shop Owner',
    email: 'other@competitor.com',
    passwordHash: 'hashed_password_xyz',
  });

  anotherBusiness = await Business.create({
    name: 'Competitor Store',
    legalName: 'Competitor Store LLP',
    displayName: 'Competitor',
    slug: 'competitor',
    address: { line1: 'Other Market', city: 'Bhuj', state: 'Gujarat', postalCode: '370001', country: 'India' },
    contact: { phone: '9825099999', email: 'other@competitor.com' },
  });

  await BusinessMember.create({
    businessId: anotherBusiness._id,
    userId: anotherUser._id,
    role: 'OWNER',
  });

  anotherToken = jwt.sign(
    { userId: anotherUser._id.toString(), email: anotherUser.email, businessId: anotherBusiness._id.toString(), role: 'OWNER' },
    env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  customer = await Customer.create({
    businessId: business._id,
    name: 'Priy Mavani',
    contact: { phone: '9876543210' },
  });

  product = await Product.create({
    businessId: business._id,
    name: 'AC Service Job',
    type: 'SERVICE',
    uom: 'JOB',
    defaultPriceMinor: 300000,
    currency: 'INR',
  });
});

describe('Payment Accounts & Proof Management Suite', () => {
  it('1. should create a BANK payment account with masked number', async () => {
    const res = await request(app)
      .post('/api/payment-accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        name: 'HDFC Current',
        type: 'BANK',
        bankName: 'HDFC Bank',
        accountHolderName: 'Jay Ramji Enterprise',
        accountNumber: '50200012345678',
        ifsc: 'HDFC0001234',
        branch: 'Mundra',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.account.type).toBe('BANK');
    expect(res.body.data.account.maskedAccountNumber).toBe('••••5678');
    expect(res.body.data.account.displayName).toContain('HDFC Bank ••••5678');
    expect(res.body.data.account.active).toBe(true);
  });

  it('2. should create a UPI payment account', async () => {
    const res = await request(app)
      .post('/api/payment-accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        name: 'Jay Ramji UPI',
        type: 'UPI',
        upiId: 'jayramji@upi',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.account.type).toBe('UPI');
    expect(res.body.data.account.upiId).toBe('jayramji@upi');
    expect(res.body.data.account.displayName).toBe('Jay Ramji UPI - jayramji@upi');
  });

  it('3. should create a CASH payment account', async () => {
    const res = await request(app)
      .post('/api/payment-accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        name: 'Counter Cash',
        type: 'CASH',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.account.type).toBe('CASH');
    expect(res.body.data.account.active).toBe(true);
  });

  it('4. should deactivate and reactivate a payment account', async () => {
    const createRes = await request(app)
      .post('/api/payment-accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ name: 'Old Bank', type: 'BANK', bankName: 'SBI', accountNumber: '123456789' });

    const accId = createRes.body.data.account._id;

    // Deactivate
    const deactRes = await request(app)
      .post(`/api/payment-accounts/${accId}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());
    expect(deactRes.status).toBe(200);
    expect(deactRes.body.data.account.active).toBe(false);

    // Reactivate
    const actRes = await request(app)
      .post(`/api/payment-accounts/${accId}/activate`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());
    expect(actRes.status).toBe(200);
    expect(actRes.body.data.account.active).toBe(true);
  });

  it('5. should reject payment using an inactive account', async () => {
    const acc = await PaymentAccount.create({
      businessId: business._id,
      name: 'Old UPI',
      displayName: 'Old UPI',
      type: 'UPI',
      upiId: 'old@upi',
      active: false,
    });

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

    const payRes = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amountMinor: 50000,
        method: 'UPI',
        paymentAccountId: acc._id.toString(),
      });

    expect(payRes.status).toBe(400); // Inactive account rejected
  });

  it('6 & 7. should require UPI account for UPI and QR_CODE payments', async () => {
    const bankAcc = await PaymentAccount.create({
      businessId: business._id,
      name: 'HDFC Bank',
      displayName: 'HDFC Bank',
      type: 'BANK',
      bankName: 'HDFC',
      accountNumber: '112233',
      active: true,
    });

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

    // 1. Missing account for UPI
    const pay1 = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ amountMinor: 50000, method: 'UPI' });
    expect(pay1.status).toBe(400);

    // 2. Supplying BANK account for UPI
    const pay2 = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ amountMinor: 50000, method: 'UPI', paymentAccountId: bankAcc._id.toString() });
    expect(pay2.status).toBe(400);

    // 3. Supplying BANK account for QR_CODE
    const pay3 = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ amountMinor: 50000, method: 'QR_CODE', paymentAccountId: bankAcc._id.toString() });
    expect(pay3.status).toBe(400);
  });

  it('8 & 9. should require BANK account for BANK_TRANSFER and CHEQUE payments', async () => {
    const upiAcc = await PaymentAccount.create({
      businessId: business._id,
      name: 'GPay',
      displayName: 'GPay',
      type: 'UPI',
      upiId: 'gpay@upi',
      active: true,
    });

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

    // 1. Missing account for BANK_TRANSFER
    const pay1 = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ amountMinor: 50000, method: 'BANK_TRANSFER' });
    expect(pay1.status).toBe(400);

    // 2. Supplying UPI account for BANK_TRANSFER
    const pay2 = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ amountMinor: 50000, method: 'BANK_TRANSFER', paymentAccountId: upiAcc._id.toString() });
    expect(pay2.status).toBe(400);

    // 3. Supplying UPI account for CHEQUE
    const pay3 = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ amountMinor: 50000, method: 'CHEQUE', paymentAccountId: upiAcc._id.toString() });
    expect(pay3.status).toBe(400);
  });

  it('10. should allow CASH payment with no account required', async () => {
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

    const payRes = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ amountMinor: 100000, method: 'CASH' });

    expect(payRes.status).toBe(201);
    expect(payRes.body.data.payment.method).toBe('CASH');
    expect(payRes.body.data.payment.paymentAccountSnapshot.type).toBe('CASH');
    expect(payRes.body.data.paymentSummary.status).toBe('PAID');
  });

  it('11 & 12. should reject payment using account from another business (IDOR)', async () => {
    const competitorAcc = await PaymentAccount.create({
      businessId: anotherBusiness._id,
      name: 'Competitor UPI',
      displayName: 'Competitor UPI',
      type: 'UPI',
      upiId: 'competitor@upi',
      active: true,
    });

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

    const payRes = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amountMinor: 50000,
        method: 'UPI',
        paymentAccountId: competitorAcc._id.toString(),
      });

    expect(payRes.status).toBe(404); // IDOR rejected
  });

  it('25. should reject unauthorized access and cross-tenant workspace access', async () => {
    // 1. Unauthenticated request
    const unauthRes = await request(app)
      .get('/api/payment-accounts')
      .set('x-business-id', business._id.toString());
    expect(unauthRes.status).toBe(401);

    // 2. Cross-tenant user attempting to access Business A accounts
    const crossRes = await request(app)
      .get('/api/payment-accounts')
      .set('Authorization', `Bearer ${anotherToken}`)
      .set('x-business-id', business._id.toString());
    expect(crossRes.status).toBe(403);
  });

  it('20 & 21. should freeze paymentAccountSnapshot and preserve historical record after account rename or deactivation', async () => {
    const upiAcc = await PaymentAccount.create({
      businessId: business._id,
      name: 'Original UPI Account',
      displayName: 'Original UPI Account (orig@upi)',
      type: 'UPI',
      upiId: 'orig@upi',
      active: true,
    });

    const draftRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        invoiceDate: '2026-08-30',
        customerId: customer._id.toString(),
        items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'TEST', uom: 'JOB', quantity: 1, unitPriceMinor: 300000 }],
        taxMode: 'NONE',
        defaultTaxRateBps: 0,
      });

    const draftId = draftRes.body.data.invoice._id;
    await request(app).post(`/api/invoices/${draftId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());

    // Record payment
    const payRes = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amountMinor: 100000,
        method: 'UPI',
        paymentAccountId: upiAcc._id.toString(),
        referenceNumber: 'UPI999888',
      });

    expect(payRes.status).toBe(201);
    const paymentId = payRes.body.data.payment._id;

    // Mutate the master payment account (rename and deactivate)
    upiAcc.name = 'Changed Master Name';
    upiAcc.displayName = 'Changed Master Display';
    upiAcc.active = false;
    await upiAcc.save();

    // Verify payment record in database preserves the original snapshot
    const savedPayment = await Payment.findById(paymentId);
    expect(savedPayment!.paymentAccountSnapshot!.name).toBe('Original UPI Account');
    expect(savedPayment!.paymentAccountSnapshot!.displayName).toBe('Original UPI Account (orig@upi)');
    expect(savedPayment!.paymentAccountSnapshot!.upiId).toBe('orig@upi');
  });

  it('27. Complete End-to-End Payment Accounts & Proof Flow', async () => {
    // 1. Create four payment accounts
    const hdfcRes = await request(app)
      .post('/api/payment-accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ name: 'HDFC Bank', type: 'BANK', bankName: 'HDFC Bank', accountNumber: '50200012345678', ifsc: 'HDFC0001234' });
    expect(hdfcRes.status).toBe(201);
    const hdfcAcc = hdfcRes.body.data.account;

    const iciciRes = await request(app)
      .post('/api/payment-accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ name: 'ICICI Bank', type: 'BANK', bankName: 'ICICI Bank', accountNumber: '001122334455', ifsc: 'ICIC0001122' });
    expect(iciciRes.status).toBe(201);

    const upiRes = await request(app)
      .post('/api/payment-accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ name: 'Jay Ramji UPI', type: 'UPI', upiId: 'jayramji@upi' });
    expect(upiRes.status).toBe(201);
    const upiAcc = upiRes.body.data.account;

    const cashRes = await request(app)
      .post('/api/payment-accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({ name: 'Counter Cash', type: 'CASH' });
    expect(cashRes.status).toBe(201);

    // 2. Create a finalized ₹3,000 invoice
    const draftRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        invoiceDate: '2026-08-30',
        customerId: customer._id.toString(),
        items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'AC Repair Full Job', uom: 'JOB', quantity: 1, unitPriceMinor: 300000 }],
        taxMode: 'NONE',
        defaultTaxRateBps: 0,
      });
    const draftId = draftRes.body.data.invoice._id;
    await request(app).post(`/api/invoices/${draftId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());

    // 3. Record ₹1,000 through UPI with screenshot proof
    const pay1 = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amountMinor: 100000,
        method: 'UPI',
        paymentAccountId: upiAcc._id,
        referenceNumber: 'UPI12345678',
        proof: {
          publicId: 'proof_123',
          secureUrl: 'https://res.cloudinary.com/test-cloud/image/upload/v1/upi_screenshot.png',
          format: 'png',
          fileType: 'image/png',
        },
      });

    expect(pay1.status).toBe(201);
    expect(pay1.body.data.paymentSummary.paidAmountMinor).toBe(100000);
    expect(pay1.body.data.paymentSummary.dueAmountMinor).toBe(200000);
    expect(pay1.body.data.paymentSummary.status).toBe('PARTIALLY_PAID');

    // 4. Record remaining ₹2,000 through BANK_TRANSFER with bank account
    const pay2 = await request(app)
      .post(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amountMinor: 200000,
        method: 'BANK_TRANSFER',
        paymentAccountId: hdfcAcc._id,
        referenceNumber: 'NEFT000999',
      });

    expect(pay2.status).toBe(201);
    expect(pay2.body.data.paymentSummary.paidAmountMinor).toBe(300000);
    expect(pay2.body.data.paymentSummary.dueAmountMinor).toBe(0);
    expect(pay2.body.data.paymentSummary.status).toBe('PAID');

    // 5. Verify invoice remains FINALIZED
    const invCheck = await request(app)
      .get(`/api/invoices/${draftId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());
    expect(invCheck.body.data.invoice.status).toBe('FINALIZED');
    expect(invCheck.body.data.invoice.paymentSummary.status).toBe('PAID');

    // 6. Verify payments appear in payment history with correct receiving accounts
    const histRes = await request(app)
      .get(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());
    expect(histRes.status).toBe(200);
    expect(histRes.body.data.payments.length).toBe(2);

    const upiPayment = histRes.body.data.payments.find((p: any) => p.method === 'UPI');
    expect(upiPayment.paymentAccountSnapshot.name).toBe('Jay Ramji UPI');
    expect(upiPayment.proof.secureUrl).toContain('upi_screenshot.png');

    const bankPayment = histRes.body.data.payments.find((p: any) => p.method === 'BANK_TRANSFER');
    expect(bankPayment.paymentAccountSnapshot.name).toBe('HDFC Bank');
    expect(bankPayment.paymentAccountSnapshot.maskedAccountNumber).toBe('••••5678');

    // 7. Deactivate the UPI account
    await request(app)
      .post(`/api/payment-accounts/${upiAcc._id}/deactivate`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());

    // 8. Verify old payment still shows the UPI account details
    const histAfterDeact = await request(app)
      .get(`/api/invoices/${draftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());
    const oldUpiPayment = histAfterDeact.body.data.payments.find((p: any) => p.method === 'UPI');
    expect(oldUpiPayment.paymentAccountSnapshot.upiId).toBe('jayramji@upi');

    // 9. Verify inactive UPI account cannot be selected for a new payment
    const newDraftRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        invoiceDate: '2026-08-30',
        customerId: customer._id.toString(),
        items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'AC Repair Job 2', uom: 'JOB', quantity: 1, unitPriceMinor: 100000 }],
        taxMode: 'NONE',
        defaultTaxRateBps: 0,
      });
    const newDraftId = newDraftRes.body.data.invoice._id;
    await request(app).post(`/api/invoices/${newDraftId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());

    const blockedPay = await request(app)
      .post(`/api/invoices/${newDraftId}/payments`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        amountMinor: 50000,
        method: 'UPI',
        paymentAccountId: upiAcc._id,
      });
    expect(blockedPay.status).toBe(400); // Inactive account blocked for new payments
  });
});
