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
import { PurchaseReceipt } from '../database/models/PurchaseReceipt';
import { InventoryTransaction } from '../database/models/InventoryTransaction';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

let token: string;
let testUser: any;
let business: any;
let productA: any;
let productB: any;
let testVendor: any;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);

  // Clean test records
  await PurchaseReceipt.deleteMany({});
  await InventoryTransaction.deleteMany({});
  await Purchase.deleteMany({});
  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});

  testUser = await User.create({
    name: 'Receiving Test Admin',
    email: 'receiving_test@jayramji.com',
    passwordHash: 'dummyhash',
  });

  business = await Business.create({
    name: 'Jay Ramji Receiving Test Corp',
    legalName: 'Jay Ramji Receiving Test Corp',
    address: {
      line1: 'Baroi Road',
      city: 'Mundra',
      state: 'Gujarat',
      postalCode: '370421',
      country: 'India',
    },
    contact: {
      phone: '8469326901',
      email: 'receiving_test@jayramji.com',
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

  productA = await Product.create({
    businessId: business._id,
    type: 'PRODUCT',
    name: 'Capacitor 35µF',
    sku: 'CAP-35UF',
    uom: 'NOS',
    defaultPriceMinor: 25000,
    stockQuantity: 15,
  });

  productB = await Product.create({
    businessId: business._id,
    type: 'PRODUCT',
    name: 'Contactor 25A',
    sku: 'CON-25A',
    uom: 'NOS',
    defaultPriceMinor: 85000,
    stockQuantity: 8,
  });

  testVendor = await Vendor.create({
    businessId: business._id,
    vendorCode: 'VEN-001',
    name: 'Cooling Spares India',
    mobile: '9876543210',
    isActive: true,
  });
});

afterAll(async () => {
  await PurchaseReceipt.deleteMany({});
  await InventoryTransaction.deleteMany({});
  await Purchase.deleteMany({});
  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

describe('Purchase Module - Phase 2: Product Receiving & Inventory Integration', () => {
  let purchaseId: string;
  let itemAId: string;
  let itemBId: string;

  it('should create an ORDERED_PURCHASE with 10 units of A and 5 units of B with stock intact', async () => {
    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        purchaseType: 'ORDERED_PURCHASE',
        vendorId: testVendor._id.toString(),
        vendorInvoiceNumber: 'INV-PHASE2-PO1',
        items: [
          {
            productId: productA._id.toString(),
            orderedQuantity: 10,
            unitPurchasePrice: 180,
          },
          {
            productId: productB._id.toString(),
            orderedQuantity: 5,
            unitPurchasePrice: 600,
          },
        ],
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data.purchase;
    purchaseId = purchase._id;
    itemAId = purchase.items[0]._id;
    itemBId = purchase.items[1]._id;

    expect(purchase.receivingStatus).toBe('NOT_RECEIVED');
    expect(purchase.items[0].receivedQuantity).toBe(0);
    expect(purchase.items[0].remainingQuantity).toBe(10);

    // Verify stock is still 15 and 8
    const checkA = await Product.findById(productA._id);
    const checkB = await Product.findById(productB._id);
    expect(checkA?.stockQuantity).toBe(15);
    expect(checkB?.stockQuantity).toBe(8);
  });

  it('should partially receive 6 units of Product A and increment stock by +6', async () => {
    const res = await request(app)
      .post(`/api/purchases/${purchaseId}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        items: [
          {
            purchaseItemId: itemAId,
            quantityReceived: 6,
          },
        ],
        deliveryChallanNumber: 'DC-1001',
        notes: 'First delivery by courier',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const receipt = res.body.data.receipt;
    expect(receipt.receiptNumber).toMatch(/^REC-/);
    expect(receipt.items.length).toBe(1);
    expect(receipt.items[0].quantityReceived).toBe(6);

    // Verify purchase state
    const updatedPurchase = res.body.data.purchase;
    expect(updatedPurchase.receivingStatus).toBe('PARTIALLY_RECEIVED');
    const itemA = updatedPurchase.items.find((i: any) => i._id.toString() === itemAId);
    expect(itemA.receivedQuantity).toBe(6);
    expect(itemA.remainingQuantity).toBe(4);
    expect(itemA.receivingStatus).toBe('PARTIALLY_RECEIVED');

    // Verify Product stock incremented from 15 to 21 (+6)
    const currentA = await Product.findById(productA._id);
    expect(currentA?.stockQuantity).toBe(21);
    expect(currentA?.lastPurchasePriceMinor).toBe(18000); // 180 * 100
    // Selling price remains untouched
    expect(currentA?.defaultPriceMinor).toBe(25000);

    // Verify immutable InventoryTransaction
    const tx = await InventoryTransaction.findOne({ referenceId: receipt._id });
    expect(tx).toBeDefined();
    expect(tx?.quantity).toBe(6);
    expect(tx?.transactionType).toBe('PURCHASE_RECEIPT');
    expect(tx?.referenceType).toBe('PURCHASE_RECEIPT');
  });

  it('should strictly reject over-receiving (> remaining quantity)', async () => {
    // Remaining for itemA is 4; attempting to receive 5 should fail
    const res = await request(app)
      .post(`/api/purchases/${purchaseId}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        items: [
          {
            purchaseItemId: itemAId,
            quantityReceived: 5,
          },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('OVER_RECEIVING_NOT_ALLOWED');

    // Stock must remain unchanged at 21
    const currentA = await Product.findById(productA._id);
    expect(currentA?.stockQuantity).toBe(21);
  });

  it('should receive the remaining 4 units of A and 5 units of B, marking status as RECEIVED', async () => {
    const res = await request(app)
      .post(`/api/purchases/${purchaseId}/receive`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        items: [
          {
            purchaseItemId: itemAId,
            quantityReceived: 4,
          },
          {
            purchaseItemId: itemBId,
            quantityReceived: 5,
          },
        ],
        deliveryChallanNumber: 'DC-1002',
        notes: 'Final delivery',
      });

    expect(res.status).toBe(201);
    const updatedPurchase = res.body.data.purchase;
    expect(updatedPurchase.receivingStatus).toBe('RECEIVED');

    const itemA = updatedPurchase.items.find((i: any) => i._id.toString() === itemAId);
    expect(itemA.receivedQuantity).toBe(10);
    expect(itemA.remainingQuantity).toBe(0);
    expect(itemA.receivingStatus).toBe('RECEIVED');

    const itemB = updatedPurchase.items.find((i: any) => i._id.toString() === itemBId);
    expect(itemB.receivedQuantity).toBe(5);
    expect(itemB.remainingQuantity).toBe(0);
    expect(itemB.receivingStatus).toBe('RECEIVED');

    // Verify stock: Product A from 21 -> 25 (+4), Product B from 8 -> 13 (+5)
    const currentA = await Product.findById(productA._id);
    const currentB = await Product.findById(productB._id);
    expect(currentA?.stockQuantity).toBe(25);
    expect(currentB?.stockQuantity).toBe(13);
  });

  it('should retrieve audit trail of all receipts for the purchase', async () => {
    const res = await request(app)
      .get(`/api/purchases/${purchaseId}/receipts`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.receipts.length).toBe(2);
    expect(res.body.data.receipts[0].receiptNumber).toMatch(/^REC-/);
    expect(res.body.data.receipts[1].receiptNumber).toMatch(/^REC-/);
  });

  it('should automatically process receipt and stock when DIRECT_PURCHASE has directReceivedFull = true', async () => {
    const initialStockA = (await Product.findById(productA._id))!.stockQuantity || 0;

    const res = await request(app)
      .post('/api/purchases')
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        purchaseType: 'DIRECT_PURCHASE',
        directReceivedFull: true,
        vendorId: testVendor._id.toString(),
        vendorInvoiceNumber: 'CASH-DIRECT-999',
        items: [
          {
            productId: productA._id.toString(),
            orderedQuantity: 3,
            unitPurchasePrice: 195,
          },
        ],
      });

    expect(res.status).toBe(201);
    const purchase = res.body.data.purchase;

    // Fetch fresh purchase
    const freshPurchase = await Purchase.findById(purchase._id);
    expect(freshPurchase?.receivingStatus).toBe('RECEIVED');
    expect(freshPurchase?.items[0].receivedQuantity).toBe(3);
    expect(freshPurchase?.items[0].remainingQuantity).toBe(0);

    // Stock should increase by 3
    const finalStockA = (await Product.findById(productA._id))!.stockQuantity || 0;
    expect(finalStockA).toBe(initialStockA + 3);

    // Receipt audit created
    const receipts = await PurchaseReceipt.find({ purchaseId: purchase._id });
    expect(receipts.length).toBe(1);
    expect(receipts[0].items[0].quantityReceived).toBe(3);
  });
});
