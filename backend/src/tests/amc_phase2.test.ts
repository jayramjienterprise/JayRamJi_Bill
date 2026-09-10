import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock DocumentGenerationService to bypass Puppeteer browser launch
jest.mock('../services/DocumentGenerationService', () => {
  return {
    DocumentGenerationService: {
      generateDocuments: jest.fn().mockResolvedValue({}),
      generateBuffers: jest.fn().mockResolvedValue({}),
      generateAmcQuotationBuffers: jest.fn().mockResolvedValue({
        pngBuffer: Buffer.from('mock-png'),
        pdfBuffer: Buffer.from('mock-pdf'),
      }),
      generateAmcQuotationDocuments: jest.fn().mockResolvedValue({
        snapshot: { publicId: 'test', secureUrl: 'https://test.com/s.png', width: 794, height: 1123 },
        pdf: { secureUrl: 'https://test.com/q.pdf' },
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
import { CustomerAcEquipment } from '../database/models/CustomerAcEquipment';
import { AmcPlan } from '../database/models/AmcPlan';
import { AmcContract } from '../database/models/AmcContract';
import { AmcServiceVisit } from '../database/models/AmcServiceVisit';
import { InventoryTransaction } from '../database/models/InventoryTransaction';
import { AmcQuotation } from '../database/models/AmcQuotation';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

let token: string;
let testUser: any;
let technicianUser: any;
let business: any;
let customer: any;
let eqUnit1: any;
let eqUnit2: any;
let productCapacitor: any;
let productCompressor: any;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);
});

afterAll(async () => {
  await AmcServiceVisit.deleteMany({});
  await InventoryTransaction.deleteMany({});
  await AmcContract.deleteMany({});
  await AmcPlan.deleteMany({});
  await AmcQuotation.deleteMany({});
  await CustomerAcEquipment.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});
  await mongoose.connection.close();
});

beforeEach(async () => {
  await AmcServiceVisit.deleteMany({});
  await InventoryTransaction.deleteMany({});
  await AmcContract.deleteMany({});
  await AmcPlan.deleteMany({});
  await AmcQuotation.deleteMany({});
  await CustomerAcEquipment.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});

  testUser = await User.create({
    name: 'Jay Ramji Admin',
    email: 'admin.phase2@jayramji.com',
    passwordHash: 'hashed_secret_pass',
    status: 'ACTIVE',
  });

  technicianUser = await User.create({
    name: 'Ramesh Patel (Senior Technician)',
    email: 'ramesh.tech@jayramji.com',
    passwordHash: 'hashed_secret_pass',
    status: 'ACTIVE',
  });

  business = await Business.create({
    name: 'JAY RAMJI ENTERPRISE',
    legalName: 'JAY RAMJI ENTERPRISE',
    address: {
      line1: 'Maruti Chhaya Complex, Baroi Road',
      city: 'Mundra',
      state: 'Gujarat',
      postalCode: '370421',
      country: 'India',
    },
    contact: {
      phone: '8469326901',
      email: 'contact@jayramji.com',
    },
    taxProfile: {
      gstin: '24AAAAA0000A1Z5',
    },
    active: true,
  });

  await BusinessMember.create({
    userId: testUser._id,
    businessId: business._id,
    role: 'OWNER',
    status: 'ACTIVE',
  });

  customer = await Customer.create({
    businessId: business._id,
    name: 'JASH ENERGY PVT LTD',
    address: {
      line1: 'MUNDRA - KUTCH',
      city: 'Mundra',
      state: 'Gujarat',
      postalCode: '370421',
      country: 'India',
    },
    active: true,
  });

  eqUnit1 = await CustomerAcEquipment.create({
    businessId: business._id,
    customerId: customer._id,
    acType: 'SPLIT',
    tonnage: '1.5',
    brand: 'Daikin',
    installationLocation: 'Admin Cabin 1',
    active: true,
  });

  eqUnit2 = await CustomerAcEquipment.create({
    businessId: business._id,
    customerId: customer._id,
    acType: 'DUCTABLE',
    tonnage: '5.0',
    brand: 'Blue Star',
    installationLocation: 'Conference Room',
    active: true,
  });

  productCapacitor = await Product.create({
    businessId: business._id,
    type: 'PRODUCT',
    name: 'Capacitor 35µF',
    uom: 'NOS',
    defaultPriceMinor: 60000, // ₹600
    currency: 'INR',
    defaultTaxRateBps: 1800,
    active: true,
  });

  productCompressor = await Product.create({
    businessId: business._id,
    type: 'PRODUCT',
    name: 'Compressor 1.5 Ton Rotary',
    uom: 'NOS',
    defaultPriceMinor: 850000, // ₹8,500
    currency: 'INR',
    defaultTaxRateBps: 1800,
    active: true,
  });

  token = jwt.sign(
    { userId: testUser._id.toString(), email: testUser.email },
    env.JWT_SECRET,
    { expiresIn: '1d' }
  );
});

describe('AMC Module Phase 2 - Service Visits Engine & Stock Deduction Tests', () => {
  it('should auto-generate scheduled periodic visits for all covered units under a contract', async () => {
    const contract = await AmcContract.create({
      businessId: business._id,
      contractNumber: 'AMC-2526-101',
      customerId: customer._id,
      contractType: 'COMPREHENSIVE',
      coveredUnits: [
        { acEquipmentId: eqUnit1._id },
        { acEquipmentId: eqUnit2._id },
      ],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      planSnapshot: {
        planName: 'Fleet Maintenance Comprehensive',
        planType: 'COMPREHENSIVE',
        durationMonths: 12,
        entitlements: [
          { serviceType: 'WATER_SERVICE', scheduling: 'QUARTERLY', quantity: 4, entitlementScope: 'PER_EQUIPMENT' },
          { serviceType: 'BREAKDOWN_REPAIR', scheduling: 'ON_DEMAND', quantity: 2, entitlementScope: 'PER_CONTRACT' },
        ],
        partCoverages: [],
        gasCoverage: { included: false, refrigerantTypes: [], limitScope: 'PER_EQUIPMENT', excludeDamagePipingLeaks: true },
        termsAndConditions: [],
      },
      financials: { contractAmount: 20000, discount: 0, taxAmount: 0, finalAmount: 20000, paidAmount: 20000 },
      paymentStatus: 'PAID',
      activationTrigger: 'ADMIN_APPROVAL',
      status: 'ACTIVE',
      active: true,
    });

    const res = await request(app)
      .post(`/api/amc/contracts/${contract._id}/generate-visits`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // 4 water services * 2 equipment units = 8 visits + 2 breakdown visits = 10 total visits
    expect(res.body.data.length).toBe(10);

    // Verify all generated visits are in SCHEDULED status
    const allVisits = await AmcServiceVisit.find({ contractId: contract._id });
    expect(allVisits.length).toBe(10);
    expect(allVisits[0].status).toBe('SCHEDULED');
  });

  it('should assign a technician using technicianId foreign key', async () => {
    const contract = await AmcContract.create({
      businessId: business._id,
      contractNumber: 'AMC-2526-102',
      customerId: customer._id,
      contractType: 'NON_COMPREHENSIVE',
      coveredUnits: [{ acEquipmentId: eqUnit1._id }],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      planSnapshot: {
        planName: 'Standard',
        planType: 'NON_COMPREHENSIVE',
        durationMonths: 12,
        entitlements: [],
        partCoverages: [],
        gasCoverage: { included: false, refrigerantTypes: [], limitScope: 'PER_EQUIPMENT', excludeDamagePipingLeaks: true },
        termsAndConditions: [],
      },
      financials: { contractAmount: 5000, discount: 0, taxAmount: 0, finalAmount: 5000, paidAmount: 5000 },
      paymentStatus: 'PAID',
      activationTrigger: 'ADMIN_APPROVAL',
      status: 'ACTIVE',
      active: true,
    });

    const visit = await AmcServiceVisit.create({
      businessId: business._id,
      visitNumber: 'SV-2526-0001',
      contractId: contract._id,
      acEquipmentId: eqUnit1._id,
      serviceType: 'WATER_SERVICE',
      scheduledDate: new Date('2026-05-15'),
      status: 'SCHEDULED',
      active: true,
    });

    const res = await request(app)
      .patch(`/api/amc/visits/${visit._id}/assign`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        technicianId: technicianUser._id.toString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ASSIGNED');
    expect(res.body.data.technicianId._id.toString()).toBe(technicianUser._id.toString());
    expect(res.body.data.technicianId.name).toBe('Ramesh Patel (Senior Technician)');
  });

  it('should evaluate parts coverage, deduct inventory, and handle covered vs uncovered parts', async () => {
    // Comprehensive contract with Capacitor 35µF covered (limit: 2/year), Compressor NOT covered
    const contract = await AmcContract.create({
      businessId: business._id,
      contractNumber: 'AMC-2526-103',
      customerId: customer._id,
      contractType: 'COMPREHENSIVE',
      coveredUnits: [{ acEquipmentId: eqUnit1._id }],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      planSnapshot: {
        planName: 'Comprehensive AC Plan',
        planType: 'COMPREHENSIVE',
        durationMonths: 12,
        entitlements: [],
        partCoverages: [
          {
            productId: productCapacitor._id,
            productName: 'Capacitor 35µF',
            coverageType: 'FULL',
            quantityLimitPerYear: 2,
          },
          {
            productId: productCompressor._id,
            productName: 'Compressor',
            coverageType: 'NOT_COVERED',
          },
        ],
        gasCoverage: { included: false, refrigerantTypes: [], limitScope: 'PER_EQUIPMENT', excludeDamagePipingLeaks: true },
        termsAndConditions: [],
      },
      financials: { contractAmount: 12000, discount: 0, taxAmount: 0, finalAmount: 12000, paidAmount: 12000 },
      paymentStatus: 'PAID',
      activationTrigger: 'ADMIN_APPROVAL',
      status: 'ACTIVE',
      active: true,
    });

    const visit = await AmcServiceVisit.create({
      businessId: business._id,
      visitNumber: 'SV-2526-0002',
      contractId: contract._id,
      acEquipmentId: eqUnit1._id,
      serviceType: 'BREAKDOWN_REPAIR',
      scheduledDate: new Date(),
      status: 'IN_PROGRESS',
      active: true,
    });

    // Complete Job Card: Technician replaces 1 Capacitor (covered) and 1 Compressor (not covered)
    const jobCardPayload = {
      workPerformed: 'Replaced damaged capacitor and found burnt compressor motor',
      checklist: {
        filterCleaned: true,
        indoorCoilCleaned: true,
        outdoorCondenserWashed: true,
        electricalTightened: true,
        suctionPressurePsi: 65,
        dischargePressurePsi: 250,
      },
      sparesUsed: [
        { productId: productCapacitor._id.toString(), quantity: 1, unitPrice: 600 },
        { productId: productCompressor._id.toString(), quantity: 1, unitPrice: 8500 },
      ],
    };

    const res = await request(app)
      .post(`/api/amc/visits/${visit._id}/complete-jobcard`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send(jobCardPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updatedVisit = res.body.data;
    expect(updatedVisit.status).toBe('COMPLETED');
    expect(updatedVisit.sparesUsed.length).toBe(2);

    // 1. Capacitor is covered -> customer charge = ₹0
    const capacitorUsage = updatedVisit.sparesUsed.find((s: any) => s.productId._id.toString() === productCapacitor._id.toString());
    expect(capacitorUsage.isCoveredByAmc).toBe(true);
    expect(capacitorUsage.customerCharge).toBe(0);

    // 2. Compressor is NOT covered -> customer charge = ₹8,500
    const compressorUsage = updatedVisit.sparesUsed.find((s: any) => s.productId._id.toString() === productCompressor._id.toString());
    expect(compressorUsage.isCoveredByAmc).toBe(false);
    expect(compressorUsage.customerCharge).toBe(8500);

    // 3. Uncovered work was flagged
    expect(updatedVisit.additionalWorkRequest.hasUncoveredWork).toBe(true);
    expect(updatedVisit.additionalWorkRequest.estimatedAmount).toBe(8500);

    // 4. Verify InventoryTransactions were generated to deduct stock
    const inventoryTxs = await InventoryTransaction.find({ referenceId: visit._id });
    expect(inventoryTxs.length).toBe(2);
    expect(inventoryTxs[0].quantity).toBe(-1); // stock reduced
    expect(inventoryTxs[1].quantity).toBe(-1); // stock reduced

    // 5. Test Supplementary Estimate creation (Issue 7)
    const quoteRes = await request(app)
      .post(`/api/amc/visits/${visit._id}/supplementary-quotation`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());

    expect(quoteRes.status).toBe(201);
    expect(quoteRes.body.success).toBe(true);
    expect(quoteRes.body.data.grandTotal).toBe(8500);
    expect(quoteRes.body.data.items.length).toBe(1);
    expect(quoteRes.body.data.items[0].description).toContain('Compressor');
  });

  it('should enforce annual covered part limits and charge for excess units', async () => {
    const contract = await AmcContract.create({
      businessId: business._id,
      contractNumber: 'AMC-2526-104',
      customerId: customer._id,
      contractType: 'COMPREHENSIVE',
      coveredUnits: [{ acEquipmentId: eqUnit1._id }],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      planSnapshot: {
        planName: 'Capacitor Capped Plan',
        planType: 'COMPREHENSIVE',
        durationMonths: 12,
        entitlements: [],
        partCoverages: [
          {
            productId: productCapacitor._id,
            productName: 'Capacitor 35µF',
            coverageType: 'FULL',
            quantityLimitPerYear: 1, // Limit is strictly 1 per year
          },
        ],
        gasCoverage: { included: false, refrigerantTypes: [], limitScope: 'PER_EQUIPMENT', excludeDamagePipingLeaks: true },
        termsAndConditions: [],
      },
      financials: { contractAmount: 10000, discount: 0, taxAmount: 0, finalAmount: 10000, paidAmount: 10000 },
      paymentStatus: 'PAID',
      activationTrigger: 'ADMIN_APPROVAL',
      status: 'ACTIVE',
      active: true,
    });

    // Visit 1 consumes 1 capacitor (uses full quota of 1)
    const visit1 = await AmcServiceVisit.create({
      businessId: business._id,
      visitNumber: 'SV-2526-0003',
      contractId: contract._id,
      acEquipmentId: eqUnit1._id,
      serviceType: 'PREVENTIVE_HEALTH_CHECK',
      scheduledDate: new Date(),
      status: 'IN_PROGRESS',
      active: true,
    });

    await request(app)
      .post(`/api/amc/visits/${visit1._id}/complete-jobcard`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        workPerformed: 'Replaced swollen capacitor',
        sparesUsed: [{ productId: productCapacitor._id.toString(), quantity: 1, unitPrice: 600 }],
      });

    // Visit 2 attempts to consume another capacitor under the same contract
    const visit2 = await AmcServiceVisit.create({
      businessId: business._id,
      visitNumber: 'SV-2526-0004',
      contractId: contract._id,
      acEquipmentId: eqUnit1._id,
      serviceType: 'BREAKDOWN_REPAIR',
      scheduledDate: new Date(),
      status: 'IN_PROGRESS',
      active: true,
    });

    const res2 = await request(app)
      .post(`/api/amc/visits/${visit2._id}/complete-jobcard`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString())
      .send({
        workPerformed: 'Another capacitor failed',
        sparesUsed: [{ productId: productCapacitor._id.toString(), quantity: 1, unitPrice: 600 }],
      });

    expect(res2.status).toBe(200);
    const visit2Data = res2.body.data;

    // Because quota was 1 and already used in visit 1, visit 2's capacitor is chargeable!
    expect(visit2Data.sparesUsed[0].isCoveredByAmc).toBe(false);
    expect(visit2Data.sparesUsed[0].customerCharge).toBe(600);
    expect(visit2Data.sparesUsed[0].notes).toContain('Annual limit of 1 units reached');
  });

  it('should query authoritative visit entitlement breakdown without counter drift', async () => {
    const contract = await AmcContract.create({
      businessId: business._id,
      contractNumber: 'AMC-2526-105',
      customerId: customer._id,
      contractType: 'NON_COMPREHENSIVE',
      coveredUnits: [
        { acEquipmentId: eqUnit1._id },
        { acEquipmentId: eqUnit2._id },
      ],
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      planSnapshot: {
        planName: 'Fleet Quota Plan',
        planType: 'NON_COMPREHENSIVE',
        durationMonths: 12,
        entitlements: [
          { serviceType: 'DRY_SERVICE', scheduling: 'MONTHLY', quantity: 12, entitlementScope: 'PER_EQUIPMENT' },
          { serviceType: 'WATER_SERVICE', scheduling: 'QUARTERLY', quantity: 4, entitlementScope: 'PER_EQUIPMENT' },
        ],
        partCoverages: [],
        gasCoverage: { included: false, refrigerantTypes: [], limitScope: 'PER_EQUIPMENT', excludeDamagePipingLeaks: true },
        termsAndConditions: [],
      },
      financials: { contractAmount: 15000, discount: 0, taxAmount: 0, finalAmount: 15000, paidAmount: 15000 },
      paymentStatus: 'PAID',
      activationTrigger: 'ADMIN_APPROVAL',
      status: 'ACTIVE',
      active: true,
    });

    // Create 3 completed dry visits
    for (let i = 1; i <= 3; i++) {
      await AmcServiceVisit.create({
        businessId: business._id,
        visitNumber: `SV-DRY-${i}`,
        contractId: contract._id,
        acEquipmentId: eqUnit1._id,
        serviceType: 'DRY_SERVICE',
        scheduledDate: new Date(),
        status: 'COMPLETED',
        active: true,
      });
    }

    const res = await request(app)
      .get(`/api/amc/contracts/${contract._id}/entitlements`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-business-id', business._id.toString());

    expect(res.status).toBe(200);
    const drySummary = res.body.data.entitlements.find((e: any) => e.serviceType === 'DRY_SERVICE');

    // 12 services * 2 equipment units = 24 target quota
    expect(drySummary.targetQuota).toBe(24);
    // 3 completed
    expect(drySummary.completedCount).toBe(3);
    // 21 remaining
    expect(drySummary.remainingCount).toBe(21);
  });
});
