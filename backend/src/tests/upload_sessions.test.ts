import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

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
import { env } from '../config/env';
import { User } from '../database/models/User';
import { Business } from '../database/models/Business';
import { BusinessMember } from '../database/models/BusinessMember';
import { Customer } from '../database/models/Customer';
import { Product } from '../database/models/Product';
import { Invoice } from '../database/models/Invoice';
import { PaymentAccount } from '../database/models/PaymentAccount';
import { UploadSession } from '../database/models/UploadSession';

let user: any;
let token: string;
let business: any;
let anotherUser: any;
let anotherToken: string;
let anotherBusiness: any;
let customer: any;
let product: any;

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
  }
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Business.deleteMany({});
  await BusinessMember.deleteMany({});
  await Customer.deleteMany({});
  await Product.deleteMany({});
  await Invoice.deleteMany({});
  await PaymentAccount.deleteMany({});
  await UploadSession.deleteMany({});

  user = await User.create({
    email: 'shopkeeper@jayramji.com',
    passwordHash: 'hashed_password',
    name: 'Jay Ramji Owner',
  });

  business = await Business.create({
    name: 'Jay Ramji Enterprise',
    address: { line1: 'Mundra Road', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    contact: { phone: '9876543210', email: 'contact@jayramji.com' },
    invoiceSettings: { prefix: 'JRE', nextSequenceNumber: 1 },
  });

  await BusinessMember.create({
    businessId: business._id,
    userId: user._id,
    role: 'OWNER',
  });

  token = jwt.sign(
    { userId: user._id.toString(), email: user.email, businessId: business._id.toString(), role: 'OWNER' },
    env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  anotherUser = await User.create({
    email: 'other@shop.com',
    passwordHash: 'hashed_password',
    name: 'Other Owner',
  });

  anotherBusiness = await Business.create({
    name: 'Competitor Workshop',
    address: { line1: 'Bhuj Highway', city: 'Bhuj', state: 'Gujarat', postalCode: '370001', country: 'India' },
    invoiceSettings: { prefix: 'COMP', nextSequenceNumber: 1 },
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

describe('Payment Proof: Device Upload & Phone QR Upload Suite', () => {

  describe('A. Device Direct Upload', () => {
    it('1. should upload valid PNG image proof from desktop device', async () => {
      const buffer = Buffer.from('fake-image-content-png');
      const res = await request(app)
        .post('/api/upload-sessions/direct-upload')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .attach('file', buffer, { filename: 'receipt.png', contentType: 'image/png' });

      expect(res.status).toBe(200);
      expect(res.body.data.proof).toBeDefined();
      expect(res.body.data.proof.secureUrl).toBeDefined();
      expect(res.body.data.proof.format).toBe('png');
      expect(res.body.data.proof.fileType).toBe('image/png');
    });

    it('2. should reject invalid file type (e.g. .exe or .txt)', async () => {
      const buffer = Buffer.from('malicious-or-text-content');
      const res = await request(app)
        .post('/api/upload-sessions/direct-upload')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .attach('file', buffer, { filename: 'script.exe', contentType: 'application/x-msdownload' });

      expect(res.status).toBe(400);
    });

    it('3. should reject missing file', async () => {
      const res = await request(app)
        .post('/api/upload-sessions/direct-upload')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(res.status).toBe(400);
    });
  });

  describe('B. Phone QR Upload Session Lifecycle & Polling', () => {
    it('4. should create temporary phone upload session with QR code data URL and 15m expiration', async () => {
      const res = await request(app)
        .post('/api/upload-sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          metadata: {
            invoiceNumber: 'JRE-000001',
            amountMinor: 300000,
            method: 'UPI',
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.data.sessionId).toBeDefined();
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.qrCodeDataUrl).toContain('data:image/png;base64');
      expect(res.body.data.uploadUrl).toContain(res.body.data.token);
      expect(res.body.data.status).toBe('CREATED');
    });

    it('5. should fetch session status on desktop polling', async () => {
      const createRes = await request(app)
        .post('/api/upload-sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({});
      const sessionId = createRes.body.data.sessionId;

      const statusRes = await request(app)
        .get(`/api/upload-sessions/${sessionId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.status).toBe('CREATED');
      expect(statusRes.body.data.proof).toBeNull();
    });

    it('6. should cancel upload session when desktop user clicks cancel', async () => {
      const createRes = await request(app)
        .post('/api/upload-sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({});
      const sessionId = createRes.body.data.sessionId;
      const rawToken = createRes.body.data.token;

      const cancelRes = await request(app)
        .post(`/api/upload-sessions/${sessionId}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      // Subsequent public access by phone should be rejected
      const publicRes = await request(app).get(`/api/upload-sessions/public/${rawToken}`);
      expect(publicRes.status).toBe(400);
    });

    it('7. should update status to SCANNED when phone opens public session URL', async () => {
      const createRes = await request(app)
        .post('/api/upload-sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          metadata: {
            invoiceNumber: 'JRE-000004',
            amountMinor: 300000,
            method: 'UPI',
          },
        });
      const sessionId = createRes.body.data.sessionId;
      const rawToken = createRes.body.data.token;

      // Phone scans QR & opens page
      const publicRes = await request(app).get(`/api/upload-sessions/public/${rawToken}`);
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.data.businessName).toBe('Jay Ramji Enterprise');
      expect(publicRes.body.data.invoiceNumber).toBe('JRE-000004');
      expect(publicRes.body.data.amountMinor).toBe(300000);
      expect(publicRes.body.data.method).toBe('UPI');
      expect(publicRes.body.data.status).toBe('SCANNED');

      // Desktop polling sees SCANNED
      const statusRes = await request(app)
        .get(`/api/upload-sessions/${sessionId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(statusRes.body.data.status).toBe('SCANNED');
    });

    it('8. should successfully upload payment proof from phone and complete session', async () => {
      const createRes = await request(app)
        .post('/api/upload-sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          metadata: { invoiceNumber: 'JRE-000005', amountMinor: 300000, method: 'UPI' },
        });
      const sessionId = createRes.body.data.sessionId;
      const rawToken = createRes.body.data.token;

      // Phone uploads proof photo
      const buffer = Buffer.from('phone-camera-proof-photo');
      const uploadRes = await request(app)
        .post(`/api/upload-sessions/public/${rawToken}/upload`)
        .attach('file', buffer, { filename: 'gpay_receipt.jpg', contentType: 'image/jpeg' });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.data.proof.secureUrl).toBeDefined();
      expect(uploadRes.body.data.proof.format).toBe('jpg');

      // Desktop polling sees COMPLETED and receives proof
      const statusRes = await request(app)
        .get(`/api/upload-sessions/${sessionId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(statusRes.body.data.status).toBe('COMPLETED');
      expect(statusRes.body.data.proof.secureUrl).toBeDefined();

      // Trying to upload again with same token is rejected
      const dupUploadRes = await request(app)
        .post(`/api/upload-sessions/public/${rawToken}/upload`)
        .attach('file', buffer, { filename: 'another.jpg', contentType: 'image/jpeg' });
      expect(dupUploadRes.status).toBe(400);
    });

    it('9. should reject expired token with 410 GONE', async () => {
      const createRes = await request(app)
        .post('/api/upload-sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({});
      const sessionId = createRes.body.data.sessionId;
      const rawToken = createRes.body.data.token;

      // Manually backdate expiration
      await UploadSession.findByIdAndUpdate(sessionId, { expiresAt: new Date(Date.now() - 1000) });

      const publicRes = await request(app).get(`/api/upload-sessions/public/${rawToken}`);
      expect(publicRes.status).toBe(410);

      const buffer = Buffer.from('photo');
      const uploadRes = await request(app)
        .post(`/api/upload-sessions/public/${rawToken}/upload`)
        .attach('file', buffer, { filename: 'photo.jpg', contentType: 'image/jpeg' });
      expect(uploadRes.status).toBe(410);
    });

    it('10. should reject invalid or forged token with 404 NOT_FOUND', async () => {
      const fakeToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const publicRes = await request(app).get(`/api/upload-sessions/public/${fakeToken}`);
      expect(publicRes.status).toBe(404);
    });
  });

  describe('C. End-to-End Integration: Invoice Creation & Payments with Proof', () => {
    it('11. should finalize invoice with initial payment and attached device proof', async () => {
      const upiAcc = await PaymentAccount.create({
        businessId: business._id,
        name: 'Jay Ramji UPI',
        displayName: 'Jay Ramji UPI - jayramji@upi',
        type: 'UPI',
        upiId: 'jayramji@upi',
        active: true,
      });

      // 1. Desktop user uploads proof
      const buffer = Buffer.from('gpay_screenshot');
      const proofRes = await request(app)
        .post('/api/upload-sessions/direct-upload')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .attach('file', buffer, { filename: 'gpay_receipt.png', contentType: 'image/png' });
      const proof = proofRes.body.data.proof;

      // 2. User creates draft and finalizes with payment + proof
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'AC Repair Job', uom: 'JOB', quantity: 1, unitPriceMinor: 300000 }],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });
      const invoiceId = draftRes.body.data.invoice._id;

      const finRes = await request(app)
        .post(`/api/invoices/${invoiceId}/finalize`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          payment: {
            status: 'PAID',
            method: 'UPI',
            paymentAccountId: upiAcc._id.toString(),
            referenceNumber: 'UPI998877',
            proof,
          },
        });

      expect(finRes.status).toBe(200);

      // Verify payment history has proof
      const payHist = await request(app)
        .get(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(payHist.body.data.payments.length).toBe(1);
      expect(payHist.body.data.payments[0].proof.secureUrl).toBe(proof.secureUrl);
    });

    it('12. should record payment on finalized invoice using phone QR proof', async () => {
      const bankAcc = await PaymentAccount.create({
        businessId: business._id,
        name: 'HDFC Current',
        displayName: 'HDFC Current ••••5678',
        type: 'BANK',
        bankName: 'HDFC',
        accountNumber: '50200012345678',
        active: true,
      });

      // 1. Create finalized UNPAID invoice
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'AC Repair Job', uom: 'JOB', quantity: 1, unitPriceMinor: 300000 }],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });
      const invoiceId = draftRes.body.data.invoice._id;
      await request(app).post(`/api/invoices/${invoiceId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());

      // 2. User opens "Record Payment" -> "Upload from Phone"
      const sessionRes = await request(app)
        .post('/api/upload-sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceId,
          metadata: { invoiceNumber: 'JRE-000002', amountMinor: 300000, method: 'BANK_TRANSFER' },
        });
      const sessionId = sessionRes.body.data.sessionId;
      const rawToken = sessionRes.body.data.token;

      // 3. Phone uploads bank deposit slip / NEFT screenshot
      const buffer = Buffer.from('neft_screenshot_proof');
      await request(app)
        .post(`/api/upload-sessions/public/${rawToken}/upload`)
        .attach('file', buffer, { filename: 'neft_receipt.jpg', contentType: 'image/jpeg' });

      // 4. Laptop polling receives proof
      const pollRes = await request(app)
        .get(`/api/upload-sessions/${sessionId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      const phoneProof = pollRes.body.data.proof;

      // 5. Laptop submits Record Payment with phoneProof
      const payRes = await request(app)
        .post(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          amountMinor: 300000,
          method: 'BANK_TRANSFER',
          paymentAccountId: bankAcc._id.toString(),
          referenceNumber: 'NEFT4444',
          proof: phoneProof,
        });

      expect(payRes.status).toBe(201);
      expect(payRes.body.data.paymentSummary.status).toBe('PAID');

      // 6. Verify proof in payment history
      const hist = await request(app)
        .get(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());
      expect(hist.body.data.payments[0].proof.secureUrl).toBe(phoneProof.secureUrl);
    });

    it('13. should allow recording payment without proof (proof remains optional)', async () => {
      const draftRes = await request(app)
        .post('/api/invoices')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          invoiceDate: '2026-08-30',
          customerId: customer._id.toString(),
          items: [{ productId: product._id.toString(), type: 'SERVICE', description: 'Counter Job', uom: 'JOB', quantity: 1, unitPriceMinor: 100000 }],
          taxMode: 'NONE',
          defaultTaxRateBps: 0,
        });
      const invoiceId = draftRes.body.data.invoice._id;
      await request(app).post(`/api/invoices/${invoiceId}/finalize`).set('Authorization', `Bearer ${token}`).set('x-business-id', business._id.toString());

      const payRes = await request(app)
        .post(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          amountMinor: 100000,
          method: 'CASH',
          notes: 'Paid cash at counter without proof receipt',
        });

      expect(payRes.status).toBe(201);
      expect(payRes.body.data.paymentSummary.status).toBe('PAID');
    });
  });

  describe('D. Multi-Tenant Security & IDOR Protection', () => {
    it('14. should prevent tenant B from viewing or polling tenant A upload session', async () => {
      const sessionRes = await request(app)
        .post('/api/upload-sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({});
      const sessionId = sessionRes.body.data.sessionId;

      const crossRes = await request(app)
        .get(`/api/upload-sessions/${sessionId}/status`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .set('x-business-id', anotherBusiness._id.toString());

      expect(crossRes.status).toBe(404);
    });

    it('15. should prevent tenant B from cancelling tenant A upload session', async () => {
      const sessionRes = await request(app)
        .post('/api/upload-sessions')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({});
      const sessionId = sessionRes.body.data.sessionId;

      const crossRes = await request(app)
        .post(`/api/upload-sessions/${sessionId}/cancel`)
        .set('Authorization', `Bearer ${anotherToken}`)
        .set('x-business-id', anotherBusiness._id.toString());

      expect(crossRes.status).toBe(404);
    });
  });
});
