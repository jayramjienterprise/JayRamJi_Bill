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
      generateAmcQuotationDocuments: jest.fn().mockResolvedValue({
        snapshot: {
          publicId: 'test-snapshot',
          secureUrl: 'https://res.cloudinary.com/test/image.png',
          width: 794,
          height: 1123,
        },
        pdf: {
          secureUrl: 'https://res.cloudinary.com/test/quotation.pdf',
        },
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
import { EquipmentAssignmentHistory } from '../database/models/EquipmentAssignmentHistory';
import { AmcPlan } from '../database/models/AmcPlan';
import { AmcQuotation } from '../database/models/AmcQuotation';
import { AmcContract } from '../database/models/AmcContract';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

let token: string;
let testUser: any;
let business: any;
let customer: any;
let productCapacitor: any;
let productContactor: any;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);
});

afterAll(async () => {
  await CustomerAcEquipment.deleteMany({});
  await EquipmentAssignmentHistory.deleteMany({});
  await AmcPlan.deleteMany({});
  await AmcQuotation.deleteMany({});
  await AmcContract.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});
  await mongoose.connection.close();
});

beforeEach(async () => {
  await CustomerAcEquipment.deleteMany({});
  await EquipmentAssignmentHistory.deleteMany({});
  await AmcPlan.deleteMany({});
  await AmcQuotation.deleteMany({});
  await AmcContract.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});
  await BusinessMember.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});

  testUser = await User.create({
    name: 'Jay Ramji Admin',
    email: 'admin.amc@jayramji.com',
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
    contact: {
      phone: '9876543210',
      email: 'operations@jashenergy.com',
    },
    taxProfile: {
      gstin: '24BBBBB1111B1Z2',
    },
    active: true,
  });

  productCapacitor = await Product.create({
    businessId: business._id,
    type: 'PRODUCT',
    name: 'Capacitor 35µF',
    description: 'Running capacitor 35 MFD',
    uom: 'NOS',
    defaultPriceMinor: 60000,
    currency: 'INR',
    defaultTaxRateBps: 1800,
    active: true,
  });

  productContactor = await Product.create({
    businessId: business._id,
    type: 'PRODUCT',
    name: 'Heavy Duty Contactor',
    description: '32A 2-pole contactor',
    uom: 'NOS',
    defaultPriceMinor: 120000,
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

describe('AMC Module Phase 1 - Enterprise Architecture Tests', () => {
  describe('1. Customer AC Equipment Registry & Assignment History', () => {
    it('should register a customer AC unit and create an EquipmentAssignmentHistory audit', async () => {
      const payload = {
        customerId: customer._id.toString(),
        acType: 'SPLIT',
        tonnage: '1.5',
        brand: 'Daikin',
        modelNumber: 'FTKF50TV',
        serialNumber: 'DKN-2026-99881',
        installationLocation: 'Server Room 1',
        refrigerantType: 'R32',
      };

      const res = await request(app)
        .post('/api/amc/equipment')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.brand).toBe('Daikin');
      expect(res.body.data.serialNumber).toBe('DKN-2026-99881');

      // Verify audit history was recorded
      const history = await EquipmentAssignmentHistory.find({
        equipmentId: res.body.data.id,
        businessId: business._id,
      });
      expect(history.length).toBe(1);
      expect(history[0].toCustomerId.toString()).toBe(customer._id.toString());
      expect(history[0].reason).toBe('Initial Registration');
    });

    it('should track ownership transfer in EquipmentAssignmentHistory when customer changes', async () => {
      const equipment = await CustomerAcEquipment.create({
        businessId: business._id,
        customerId: customer._id,
        acType: 'SPLIT',
        tonnage: '2.0',
        brand: 'Voltas',
        installationLocation: 'Admin Room',
        active: true,
      });

      const newCustomer = await Customer.create({
        businessId: business._id,
        name: 'ADANI PORTS LTD',
        active: true,
      });

      const res = await request(app)
        .patch(`/api/amc/equipment/${equipment._id}`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          customerId: newCustomer._id.toString(),
          transferReason: 'Asset Reallocation',
        });

      expect(res.status).toBe(200);

      // Verify transfer history was recorded with both fromCustomerId and toCustomerId
      const transferAudit = await EquipmentAssignmentHistory.findOne({
        equipmentId: equipment._id,
        toCustomerId: newCustomer._id,
      });
      expect(transferAudit).toBeTruthy();
      expect(transferAudit?.fromCustomerId?.toString()).toBe(customer._id.toString());
      expect(transferAudit?.reason).toBe('Asset Reallocation');
    });
  });

  describe('2. AMC Plan Templates with Product ID Part Coverage & Multi-Entitlements', () => {
    it('should create an AMC Plan with Product ID references and multi-entitlement matrix', async () => {
      const planPayload = {
        name: 'Corporate Comprehensive Fleet AMC',
        planType: 'COMPREHENSIVE',
        durationMonths: 12,
        basePrice: 15000,
        applicableAcTypes: ['SPLIT', 'DUCTABLE'],
        applicableTonnages: ['1.0', '1.5', '2.0', 'Up to 5 Ton'],
        entitlements: [
          {
            serviceType: 'DRY_SERVICE',
            scheduling: 'MONTHLY',
            quantity: 12,
            entitlementScope: 'PER_EQUIPMENT',
          },
          {
            serviceType: 'WATER_SERVICE',
            scheduling: 'QUARTERLY',
            quantity: 4,
            entitlementScope: 'PER_EQUIPMENT',
          },
          {
            serviceType: 'BREAKDOWN_REPAIR',
            scheduling: 'ON_DEMAND',
            quantity: 2,
            entitlementScope: 'PER_CONTRACT',
          },
        ],
        partCoverages: [
          {
            productId: productCapacitor._id.toString(),
            coverageType: 'FULL',
            quantityLimitPerYear: 2,
          },
          {
            productId: productContactor._id.toString(),
            coverageType: 'FULL',
            quantityLimitPerYear: 1,
          },
        ],
        gasCoverage: {
          included: true,
          refrigerantTypes: ['R32', 'R410A'],
          quantityLimitKg: 5,
          limitScope: 'PER_CONTRACT',
          excludeDamagePipingLeaks: true,
        },
      };

      const res = await request(app)
        .post('/api/amc/plans')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send(planPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entitlements.length).toBe(3);
      expect(res.body.data.partCoverages.length).toBe(2);
      expect(res.body.data.partCoverages[0].productId.name).toBe('Capacitor 35µF');
      expect(res.body.data.gasCoverage.included).toBe(true);
    });

    it('should reject plan creation if part ID does not exist in inventory', async () => {
      const fakeProductId = new mongoose.Types.ObjectId().toString();
      const planPayload = {
        name: 'Invalid Plan',
        basePrice: 5000,
        partCoverages: [
          {
            productId: fakeProductId,
            coverageType: 'FULL',
          },
        ],
      };

      const res = await request(app)
        .post('/api/amc/plans')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send(planPayload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_PRODUCT_SELECTION');
    });
  });

  describe('3. AMC Quotations (Matching JRE Real PDFs 252611 & 252612)', () => {
    it('should accurately calculate Quotation #252611 (Unit Rate-Card totaling ₹28,570.00)', async () => {
      const items = [
        { description: 'AC Dry Service', quantity: 1, unitPrice: 700, amount: 700 },
        { description: 'AC Water Service (Up to 5 Ton)', quantity: 1, unitPrice: 1650, amount: 2600 },
        { description: 'AC Water Service (Up 5 to 8.5 Ton)', quantity: 1, unitPrice: 2750, amount: 2750 },
        { description: 'Gas Charging (Per 1 Ton, Including Gas)', quantity: 1, unitPrice: 2400, amount: 2400 },
        { description: 'Leakage Detection and Repair (Up to 5 Ton)', quantity: 1, unitPrice: 2150, amount: 2150 },
        { description: 'Preventive Maintenance (PM) AC Health Check (Per 1 Ton)', quantity: 1, unitPrice: 510, amount: 510 },
        { description: 'Inspection / Complaint Charge (Checking & Fault Identification Only)', quantity: 1, unitPrice: 1000, amount: 1000 },
        { description: 'Split AC Installation Charge (Per 1 Ton)', quantity: 1, unitPrice: 1600, amount: 1600 },
        { description: 'Duct AC Installation Charge (Per 1 Ton)', quantity: 1, unitPrice: 3500, amount: 3500 },
        { description: 'Compressor Replacement (Per 1 Ton)', quantity: 1, unitPrice: 1200, amount: 1200 },
        { description: 'Indoor Blower Replacement (Split AC Only)', quantity: 1, unitPrice: 1350, amount: 1350 },
        { description: 'Blower Replacement (Duct AC, 1–5 Ton)', quantity: 1, unitPrice: 2350, amount: 2350 },
        { description: 'Blower Replacement (Duct AC, 5–11 Ton)', quantity: 1, unitPrice: 3500, amount: 3500 },
        { description: 'AC Dismantling (Per 1 Ton)', quantity: 1, unitPrice: 1000, amount: 1000 },
        { description: 'Copper Pipe Charge (Per Foot, Material Not Included)', quantity: 1, unitPrice: 310, amount: 310 },
        { description: 'Gas Top-Up (Per 1 Ton, Split AC, Including Gas)', quantity: 1, unitPrice: 1650, amount: 1650 },
      ];

      const res = await request(app)
        .post('/api/amc/quotations')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          customerId: customer._id.toString(),
          quotationNumber: '252611',
          quotationType: 'RATE_CARD',
          paymentTerms: '10 Days from the Invoice date',
          items,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quotationNumber).toBe('252611');
      expect(res.body.data.grandTotal).toBe(28570);
    });

    it('should accurately calculate Quotation #252612 (Periodic Fleet Maintenance totaling ₹5,85,520.00)', async () => {
      const items = [
        { description: 'AC Dry Service', period: 'Monthly', quantity: 1, unitPrice: 700, amount: 173600 },
        { description: 'AC Water Service (Up to 5 Ton)', period: 'Quarterly', quantity: 1, unitPrice: 1650, amount: 178200 },
        { description: 'AC Water Service (Up 5 to 8.5 Ton)', period: 'Quarterly', quantity: 1, unitPrice: 2750, amount: 44000 },
        { description: 'Preventive Maintenance (PM) AC Health Check', period: 'Monthly', quantity: 1, unitPrice: 510, amount: 189720 },
      ];

      const res = await request(app)
        .post('/api/amc/quotations')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send({
          customerId: customer._id.toString(),
          quotationNumber: '252612',
          quotationType: 'PERIODIC_CONTRACT',
          paymentTerms: '10 Days from the Invoice date',
          items,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quotationNumber).toBe('252612');
      expect(res.body.data.grandTotal).toBe(585520);
    });
  });

  describe('4. AMC Contract Engine & Immutable Plan Snapshot', () => {
    it('should create an AMC Contract with an immutable planSnapshot and covered AC units', async () => {
      const eq1 = await CustomerAcEquipment.create({
        businessId: business._id,
        customerId: customer._id,
        acType: 'SPLIT',
        tonnage: '1.5',
        brand: 'Daikin',
        installationLocation: 'Main Office',
        active: true,
      });

      const eq2 = await CustomerAcEquipment.create({
        businessId: business._id,
        customerId: customer._id,
        acType: 'DUCTABLE',
        tonnage: '5.0',
        brand: 'Blue Star',
        installationLocation: 'Assembly Floor',
        active: true,
      });

      const plan = await AmcPlan.create({
        businessId: business._id,
        name: 'Original 2026 Plan Template',
        planType: 'COMPREHENSIVE',
        basePrice: 50000,
        entitlements: [
          { serviceType: 'WATER_SERVICE', scheduling: 'QUARTERLY', quantity: 4, entitlementScope: 'PER_EQUIPMENT' },
        ],
        partCoverages: [
          { productId: productCapacitor._id, coverageType: 'FULL', quantityLimitPerYear: 2 },
        ],
        active: true,
      });

      const contractPayload = {
        customerId: customer._id.toString(),
        planId: plan._id.toString(),
        contractType: 'COMPREHENSIVE',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        coveredUnits: [
          { acEquipmentId: eq1._id.toString() },
          { acEquipmentId: eq2._id.toString() },
        ],
        financials: {
          contractAmount: 50000,
          finalAmount: 50000,
          paidAmount: 50000,
        },
        activationTrigger: 'PAYMENT_RECEIVED',
      };

      const res = await request(app)
        .post('/api/amc/contracts')
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString())
        .send(contractPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.coveredUnits.length).toBe(2);

      // Verify immutable planSnapshot is preserved
      expect(res.body.data.planSnapshot.planName).toBe('Original 2026 Plan Template');
      expect(res.body.data.planSnapshot.partCoverages.length).toBe(1);

      // Modify the original plan template and verify contract snapshot remains unchanged!
      plan.name = 'Altered Plan 2027 Price Hike';
      plan.partCoverages = []; // Remove coverage
      await plan.save();

      const refetched = await AmcContract.findById(res.body.data.id);
      expect(refetched?.planSnapshot.planName).toBe('Original 2026 Plan Template');
      expect(refetched?.planSnapshot.partCoverages.length).toBe(1);
    });

    it('should perform a 1-click renewal linking previousContractId and renewedByContractId without overwriting history', async () => {
      const eq = await CustomerAcEquipment.create({
        businessId: business._id,
        customerId: customer._id,
        acType: 'SPLIT',
        tonnage: '1.5',
        brand: 'Daikin',
        installationLocation: 'Director Cabin',
        active: true,
      });

      const oldContract = await AmcContract.create({
        businessId: business._id,
        contractNumber: 'AMC-2526-001',
        customerId: customer._id,
        contractType: 'NON_COMPREHENSIVE',
        coveredUnits: [{ acEquipmentId: eq._id }],
        startDate: new Date('2025-04-01'),
        endDate: new Date('2026-03-31'),
        planSnapshot: {
          planName: 'Basic Non-Comp Plan',
          planType: 'NON_COMPREHENSIVE',
          durationMonths: 12,
          entitlements: [],
          partCoverages: [],
          gasCoverage: { included: false, refrigerantTypes: [], limitScope: 'PER_EQUIPMENT', excludeDamagePipingLeaks: true },
          termsAndConditions: [],
        },
        financials: { contractAmount: 10000, discount: 0, taxAmount: 0, finalAmount: 10000, paidAmount: 10000 },
        paymentStatus: 'PAID',
        activationTrigger: 'ADMIN_APPROVAL',
        status: 'ACTIVE',
        active: true,
      });

      // Renew Contract
      const res = await request(app)
        .post(`/api/amc/contracts/${oldContract._id}/renew`)
        .set('Authorization', `Bearer ${token}`)
        .set('x-business-id', business._id.toString());

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const newContract = res.body.data;
      expect(newContract.previousContractId._id.toString()).toBe(oldContract._id.toString());

      // Verify old contract is NOT overwritten, but points to the new contract
      const updatedOldContract = await AmcContract.findById(oldContract._id);
      expect(updatedOldContract?.contractNumber).toBe('AMC-2526-001'); // Intact
      expect(updatedOldContract?.renewedByContractId?.toString()).toBe(newContract.id);
    });
  });
});
