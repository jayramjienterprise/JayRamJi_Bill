import mongoose from 'mongoose';
import { Vendor } from '../database/models/Vendor';
import { Product } from '../database/models/Product';
import { Business } from '../database/models/Business';
import { User } from '../database/models/User';
import { matchVendor } from '../modules/purchase/matching/vendorMatcher';
import { matchProduct } from '../modules/purchase/matching/productMatcher';

const TEST_MONGO_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/jayramji_bill_test';

let testUser: any;
let businessA: any;
let businessB: any;

beforeAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);

  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});

  testUser = await User.create({
    name: 'Matching Engine Test User',
    email: `matcher_user_${Date.now()}@jayramji.com`,
    passwordHash: 'dummyhash',
  });

  businessA = await Business.create({
    name: 'Business Alpha Electronics',
    legalName: 'Alpha Electronics Pvt Ltd',
    address: { line1: 'GIDC', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    contact: { phone: '9825100001', email: 'alpha@jayramji.com' },
    ownerId: testUser._id,
    active: true,
  });

  businessB = await Business.create({
    name: 'Business Beta Cooling',
    legalName: 'Beta Cooling Systems LLP',
    address: { line1: 'Port Road', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    contact: { phone: '9825100002', email: 'beta@jayramji.com' },
    ownerId: testUser._id,
    active: true,
  });
});

afterAll(async () => {
  await Vendor.deleteMany({});
  await Product.deleteMany({});
  await Business.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

describe('Phase 2C — Vendor & Product Matching Engine', () => {
  // =========================================================================
  // 1. VENDOR MATCHING TEST SUITE (16 SCENARIOS)
  // =========================================================================
  describe('A. Vendor Matcher Tests (16 Required Scenarios)', () => {
    let vendorA1: any;
    let vendorA2: any;
    let vendorB_sameGstin: any;

    beforeAll(async () => {
      // Create Vendor A1 for Business A with valid GSTIN
      vendorA1 = await Vendor.create({
        businessId: businessA._id,
        vendorCode: 'VEND-001',
        name: 'Havells India Limited',
        gstNumber: '07AAACH1234A1Z5', // PAN: AAACH1234A
        mobile: '9825111111',
        city: 'Noida',
        state: 'Uttar Pradesh',
        isActive: true,
      });

      // Create Vendor A2 for Business A with a different GSTIN
      vendorA2 = await Vendor.create({
        businessId: businessA._id,
        vendorCode: 'VEND-002',
        name: 'Polycab Wires Private Limited',
        gstNumber: '24AAACP5555P1Z8',
        mobile: '9825222222',
        city: 'Vadodara',
        state: 'Gujarat',
        isActive: true,
      });

      // Inactive vendor in Business A
      await Vendor.create({
        businessId: businessA._id,
        vendorCode: 'VEND-003',
        name: 'Inactive Components India',
        gstNumber: '24AAAAA0000A1Z0',
        isActive: false,
      });

      // Vendor in Business B with the IDENTICAL GSTIN to Vendor A1 (tenant isolation test)
      vendorB_sameGstin = await Vendor.create({
        businessId: businessB._id,
        vendorCode: 'VEND-B01',
        name: 'Havells India Branch Mundra',
        gstNumber: '07AAACH1234A1Z5',
        isActive: true,
      });

      // Two vendors in Business A sharing the same PAN (different branch/GSTIN)
      await Vendor.create({
        businessId: businessA._id,
        vendorCode: 'VEND-004',
        name: 'Schneider Electric Gujarat Branch',
        gstNumber: '24AAACS9999S1Z1', // PAN: AAACS9999S
        isActive: true,
      });

      await Vendor.create({
        businessId: businessA._id,
        vendorCode: 'VEND-005',
        name: 'Schneider Electric Maharashtra Branch',
        gstNumber: '27AAACS9999S1Z4', // Same PAN: AAACS9999S
        isActive: true,
      });
    });

    // 1. Exact GSTIN match
    it('TEST V1: Exact GSTIN match -> EXACT_GSTIN, status: VERIFIED', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        gstin: '07AAACH1234A1Z5',
        name: 'Some Random Header Name',
      });

      expect(result.matchingMethod).toBe('EXACT_GSTIN');
      expect(result.status).toBe('VERIFIED');
      expect(result.matchingScore).toBe(1.0);
      expect(result.matchedVendorId).toBe(vendorA1._id.toString());
      expect(result.matchedVendorName).toBe('Havells India Limited');
    });

    // 2. GSTIN normalization
    it('TEST V2: GSTIN normalization safely handles whitespace and lowercase', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        gstin: '  07aaach1234a1z5  ',
      });

      expect(result.matchingMethod).toBe('EXACT_GSTIN');
      expect(result.status).toBe('VERIFIED');
      expect(result.matchedVendorId).toBe(vendorA1._id.toString());
    });

    // 3. Invalid GSTIN
    it('TEST V3: Invalid/malformed GSTIN is not manufactured into a match', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        gstin: 'INVALID_GSTIN_123',
        name: 'Unregistered Small Vendor',
      });

      // Cannot match on invalid GSTIN
      expect(result.matchingMethod).not.toBe('EXACT_GSTIN');
      expect(result.status).not.toBe('VERIFIED');
    });

    // 4. No GSTIN
    it('TEST V4: No GSTIN falls through to name matching tier', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        gstin: null,
        name: 'Polycab Wires Private Limited',
      });

      expect(result.matchingMethod).toBe('EXACT_NAME');
      expect(result.matchedVendorId).toBe(vendorA2._id.toString());
      expect(result.status).toBe('REVIEW_REQUIRED');
    });

    // 5. Exact name match
    it('TEST V5: Exact name match -> EXACT_NAME, status: REVIEW_REQUIRED', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        name: 'Havells India Limited',
      });

      expect(result.matchingMethod).toBe('EXACT_NAME');
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.matchedVendorId).toBe(vendorA1._id.toString());
    });

    // 6. Name formatting differences
    it('TEST V6: Name formatting differences (Pvt Ltd vs Private Limited, dots) matched safely', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        name: 'Polycab Wires Pvt. Ltd.', // Catalog has "Polycab Wires Private Limited"
      });

      expect(result.matchingMethod).toBe('EXACT_NAME');
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.matchedVendorId).toBe(vendorA2._id.toString());
    });

    // 7. PAN match
    it('TEST V7: PAN match produces REVIEW_REQUIRED without guessing', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        pan: 'AAACH1234A', // Matches vendorA1
        name: 'Havells Noida Central',
      });

      expect(result.matchingMethod).toBe('PAN_MATCH');
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.matchingScore).toBe(0.90);
      expect(result.matchedVendorId).toBe(vendorA1._id.toString());
    });

    // 8. Duplicate PAN
    it('TEST V8: Duplicate PAN across branches returns REVIEW_REQUIRED with alternatives', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        pan: 'AAACS9999S', // Shared by Schneider Gujarat & Maharashtra
      });

      expect(result.matchingMethod).toBe('PAN_MATCH');
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.matchedVendorId).toBeNull(); // Do NOT arbitrarily pick one
      expect(result.alternatives.length).toBe(2);
    });

    // 9. Phone + name match
    it('TEST V9: Phone match with supporting identity evidence -> FUZZY_NAME_OR_PHONE', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        phone: '+91-9825-111111', // Matches vendorA1 mobile
        name: 'Havells',
      });

      expect(result.matchingMethod).toBe('FUZZY_NAME_OR_PHONE');
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.matchedVendorId).toBe(vendorA1._id.toString());
    });

    // 10. Fuzzy candidate
    it('TEST V10: High confidence fuzzy name match returns candidate with REVIEW_REQUIRED', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        name: 'Havells India Ltd QRG Noida', // Extra suffix tokens
      });

      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.matchedVendorId).toBe(vendorA1._id.toString());
      expect(result.matchingScore).toBeGreaterThanOrEqual(0.80);
    });

    // 11. Ambiguous fuzzy candidates
    it('TEST V11: Ambiguous fuzzy candidates with close scores return null matchedId and alternatives', async () => {
      // Add two vendors with very similar names
      await Vendor.create({
        businessId: businessA._id,
        vendorCode: 'VEND-CL1',
        name: 'Apex Industrial Spares Agency',
        isActive: true,
      });
      await Vendor.create({
        businessId: businessA._id,
        vendorCode: 'VEND-CL2',
        name: 'Apex Industrial Spares Depot',
        isActive: true,
      });

      const result = await matchVendor({
        businessId: businessA._id,
        name: 'Apex Industrial Spares',
      });

      expect(result.matchedVendorId).toBeNull(); // Do NOT guess
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
    });

    // 12. No vendor match
    it('TEST V12: Completely unknown vendor returns NO_MATCH with status MISSING', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        name: 'Zylog Technologies Hyper Solutions 999',
      });

      expect(result.matchingMethod).toBe('NO_MATCH');
      expect(result.status).toBe('MISSING');
      expect(result.matchedVendorId).toBeNull();
      expect(result.alternatives).toHaveLength(0);
    });

    // 13. Identical vendor name across two businesses
    it('TEST V13: Tenant isolation - Identical vendor name in Business B is NEVER matched in Business A', async () => {
      // Create vendor in Business B only
      await Vendor.create({
        businessId: businessB._id,
        vendorCode: 'VEND-B99',
        name: 'Kirloskar Chillers Private Limited',
        isActive: true,
      });

      const result = await matchVendor({
        businessId: businessA._id, // Searching within Business A!
        name: 'Kirloskar Chillers Private Limited',
      });

      expect(result.matchedVendorId).toBeNull();
      expect(result.matchingMethod).toBe('NO_MATCH');
    });

    // 14. Identical GSTIN across two businesses
    it('TEST V14: Tenant isolation - Identical GSTIN in Business B cannot match when querying Business A', async () => {
      // vendorB_sameGstin has GSTIN '07AAACH1234A1Z5' in Business B
      // When querying Business B:
      const resultB = await matchVendor({
        businessId: businessB._id,
        gstin: '07AAACH1234A1Z5',
      });

      expect(resultB.matchedVendorId).toBe(vendorB_sameGstin._id.toString());
      expect(resultB.matchedVendorId).not.toBe(vendorA1._id.toString());
    });

    // 15. Inactive vendor excluded
    it('TEST V15: Inactive vendors (isActive: false) are excluded from matching', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        gstin: '24AAAAA0000A1Z0', // vendorA_inactive
        name: 'Inactive Components India',
      });

      expect(result.matchedVendorId).toBeNull();
      expect(result.matchingMethod).toBe('NO_MATCH');
    });

    // 16. vendors[0] is NEVER selected as fallback
    it('TEST V16: Invariant - vendors[0] is NEVER selected as fallback on empty/unknown query', async () => {
      const result = await matchVendor({
        businessId: businessA._id,
        name: null,
        gstin: null,
        phone: null,
      });

      expect(result.matchedVendorId).toBeNull();
      expect(result.matchingMethod).toBe('NO_MATCH');
      expect(result.matchedVendorId).not.toBe(vendorA1._id.toString());
    });
  });

  // =========================================================================
  // 2. PRODUCT MATCHING TEST SUITE (19 SCENARIOS)
  // =========================================================================
  describe('B. Product Matcher Tests (19 Required Scenarios)', () => {
    let productA1: any;
    let productA2: any;
    let productA3_hsn: any;
    let productB_sameSku: any;

    beforeAll(async () => {
      // Product A1: Standard AC Run Capacitor with SKU
      productA1 = await Product.create({
        businessId: businessA._id,
        name: 'Capacitor 35µF 440V AC Run',
        sku: 'CAP-35UF',
        description: 'Heavy duty round motor run capacitor 35 microfarad',
        uom: 'PCS',
        defaultPriceMinor: 25000, // ₹250.00
        lastPurchasePriceMinor: 22000, // ₹220.00
        stockQuantity: 100,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
        barcode: '8901234567890',
        hsnCode: '8532',
      } as any);

      // Product A2: AC Contactor
      productA2 = await Product.create({
        businessId: businessA._id,
        name: 'Schneider Electric AC Contactor 25A 3-Pole',
        sku: 'CONT-25A-3P',
        description: 'Power contactor 25 ampere 415V coil',
        uom: 'PCS',
        defaultPriceMinor: 120000, // ₹1,200.00
        stockQuantity: 40,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
        barcode: '8909876543210',
        hsnCode: '8536',
      } as any);

      // Product A3: Heavy duty aluminium condenser coil with HSN
      productA3_hsn = await Product.create({
        businessId: businessA._id,
        name: 'Aluminium Condenser Coil Parallel Flow',
        sku: 'COND-AL-01',
        description: 'Parallel flow aluminium condenser core for HVAC',
        uom: 'SET',
        defaultPriceMinor: 650000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
        hsnCode: '8415',
      } as any);

      // Inactive product in Business A
      await Product.create({
        businessId: businessA._id,
        name: 'Legacy R12 Refrigerant Cylinder',
        sku: 'GAS-R12',
        uom: 'KG',
        defaultPriceMinor: 100000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: false,
        deletedAt: new Date(),
      });

      // Product in Business B with identical SKU to Product A1
      productB_sameSku = await Product.create({
        businessId: businessB._id,
        name: 'Capacitor 35µF Beta Stock',
        sku: 'CAP-35UF',
        uom: 'PCS',
        defaultPriceMinor: 26000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
        barcode: '8901234567890',
      } as any);

      // Two products in Business A sharing the same SKU (duplicate SKU anomaly)
      await Product.create({
        businessId: businessA._id,
        name: 'Blower Fan Wheel 10x10 CW',
        sku: 'BLOWER-1010',
        uom: 'PCS',
        defaultPriceMinor: 150000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      await Product.create({
        businessId: businessA._id,
        name: 'Blower Fan Wheel 10x10 CCW',
        sku: 'BLOWER-1010', // Identical SKU
        uom: 'PCS',
        defaultPriceMinor: 150000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });
    });

    // 1. Exact SKU
    it('TEST P1: Exact SKU match -> EXACT_SKU, status: VERIFIED', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        skuOrCode: 'CAP-35UF',
        description: 'Random bill description',
      });

      expect(result.matchingMethod).toBe('EXACT_SKU');
      expect(result.isMatched).toBe(true);
      expect(result.status).toBe('VERIFIED');
      expect(result.productId).toBe(productA1._id.toString());
      expect(result.productName).toBe('Capacitor 35µF 440V AC Run');
    });

    // 2. SKU normalization
    it('TEST P2: SKU normalization handles lowercase, spaces, and hyphens', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        skuOrCode: '  cap_35uf  ',
      });

      expect(result.matchingMethod).toBe('EXACT_SKU');
      expect(result.isMatched).toBe(true);
      expect(result.productId).toBe(productA1._id.toString());
    });

    // 3. Duplicate SKU
    it('TEST P3: Duplicate SKU returns REVIEW_REQUIRED with alternatives and isMatched: false', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        skuOrCode: 'BLOWER-1010',
      });

      expect(result.matchingMethod).toBe('EXACT_SKU');
      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.productId).toBeNull();
      expect(result.alternatives).toHaveLength(2);
    });

    // 4. Exact barcode
    it('TEST P4: Exact barcode match -> EXACT_BARCODE, status: VERIFIED', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        barcode: '8901234567890',
      });

      expect(result.matchingMethod).toBe('EXACT_BARCODE');
      expect(result.isMatched).toBe(true);
      expect(result.status).toBe('VERIFIED');
      expect(result.productId).toBe(productA1._id.toString());
    });

    // 5. Duplicate barcode
    it('TEST P5: Duplicate barcode returns REVIEW_REQUIRED with alternatives', async () => {
      // Add two products sharing barcode
      await Product.create({
        businessId: businessA._id,
        name: 'Relay 12V DC Type A',
        uom: 'PCS',
        defaultPriceMinor: 8000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
        barcode: '9999999999999',
      } as any);

      await Product.create({
        businessId: businessA._id,
        name: 'Relay 12V DC Type B',
        uom: 'PCS',
        defaultPriceMinor: 8500,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
        barcode: '9999999999999',
      } as any);

      const result = await matchProduct({
        businessId: businessA._id,
        barcode: '9999999999999',
      });

      expect(result.matchingMethod).toBe('EXACT_BARCODE');
      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.productId).toBeNull();
      expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
    });

    // 6. Exact product name
    it('TEST P6: Exact product name match -> EXACT_NAME, status: REVIEW_REQUIRED', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Schneider Electric AC Contactor 25A 3-Pole',
      });

      expect(result.matchingMethod).toBe('EXACT_NAME');
      expect(result.isMatched).toBe(true);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.productId).toBe(productA2._id.toString());
    });

    // 7. Name formatting differences
    it('TEST P7: Name formatting ("35 uF Capacitor" vs "35µF Capacitor") matched safely without stripping spec', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Capacitor 35 uF 440V AC Run', // '35 uF' normalized to '35uf' matching '35µF'
      });

      expect(result.matchingMethod).toBe('EXACT_NAME');
      expect(result.isMatched).toBe(true);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.productId).toBe(productA1._id.toString());
    });

    // 8. HSN + description
    it('TEST P8: HSN + description similarity -> HSN_AND_DESCRIPTION, status: REVIEW_REQUIRED', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        hsnSac: '8415',
        description: 'Aluminium Condenser Coil Parallel Flow Core', // High similarity
      });

      expect(result.matchingMethod).toBe('HSN_AND_DESCRIPTION');
      expect(result.isMatched).toBe(true);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.productId).toBe(productA3_hsn._id.toString());
      expect(result.matchingScore).toBeGreaterThanOrEqual(0.75);
    });

    // 9. HSN alone
    it('TEST P9: HSN code alone NEVER identifies a specific product', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        hsnSac: '8415',
        description: null, // No description provided
      });

      expect(result.matchingMethod).toBe('UNMATCHED');
      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.productId).toBeNull();
      expect(result.reason).toContain('HSN code alone cannot identify a specific product');
    });

    // 10. Fuzzy description
    it('TEST P10: Distinct fuzzy description match -> FUZZY_DESCRIPTION, status: REVIEW_REQUIRED', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Schneider AC Contactor 25A 3 Pole Power', // Moderate variation
      });

      expect(result.matchingMethod).toBe('FUZZY_DESCRIPTION');
      expect(result.isMatched).toBe(true);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.productId).toBe(productA2._id.toString());
    });

    // 11. Ambiguous fuzzy candidates
    it('TEST P11: Ambiguous fuzzy candidates with close scores return UNMATCHED with alternatives', async () => {
      // Create two close items
      await Product.create({
        businessId: businessA._id,
        name: 'Copper Tube 1/4 Inch 0.7mm',
        uom: 'MTR',
        defaultPriceMinor: 22000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });
      await Product.create({
        businessId: businessA._id,
        name: 'Copper Tube 1/4 Inch 0.8mm',
        uom: 'MTR',
        defaultPriceMinor: 24000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Copper Tube 1/4 Inch',
      });

      expect(result.matchingMethod).toBe('UNMATCHED');
      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.productId).toBeNull();
      expect(result.alternatives.length).toBeGreaterThanOrEqual(2);
    });

    // 12. No product match
    it('TEST P12: Completely unknown product returns UNMATCHED with status MISSING', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Industrial Hydraulic Robot Arm Subassembly 9000',
      });

      expect(result.matchingMethod).toBe('UNMATCHED');
      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('MISSING');
      expect(result.productId).toBeNull();
      expect(result.alternatives).toHaveLength(0);
    });

    // 13. HSN conflict
    it('TEST P13: HSN conflict generates warning when description matches but HSN differs', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Capacitor 35µF 440V AC Run', // Product A1 has HSN 8532
        hsnSac: '8415', // Extracted bill erroneously says 8415
      });

      expect(result.isMatched).toBe(true);
      expect(result.productId).toBe(productA1._id.toString());
      expect(result.reason).toContain('Warning: Extracted HSN (8415) differs from catalog HSN (8532)');
    });

    // 14. Description conflict
    it('TEST P14: HSN matches but description strongly conflicts -> UNMATCHED, REVIEW_REQUIRED', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        hsnSac: '8415', // Product A3 has HSN 8415
        description: 'Centrifugal Water Pump Impeller', // Strongly conflicts with Condenser Coil
      });

      expect(result.matchingMethod).toBe('UNMATCHED');
      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.productId).toBeNull();
      expect(result.reason).toContain('HSN matches catalog category, but product description strongly conflicts');
    });

    // 15. UOM difference
    it('TEST P15: Unit difference generates contextual warning without hard rejecting', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        skuOrCode: 'CAP-35UF',
        unit: 'BOX', // Catalog has PCS
      });

      expect(result.isMatched).toBe(true);
      expect(result.productId).toBe(productA1._id.toString());
      expect(result.reason).toContain('Warning: Invoice unit (BOX) differs from catalog UOM (PCS)');
    });

    // 16. Identical SKU across two businesses
    it('TEST P16: Tenant isolation - Identical SKU in Business B cannot match when querying Business A', async () => {
      const resultA = await matchProduct({
        businessId: businessA._id,
        skuOrCode: 'CAP-35UF',
      });
      const resultB = await matchProduct({
        businessId: businessB._id,
        skuOrCode: 'CAP-35UF',
      });

      expect(resultA.productId).toBe(productA1._id.toString());
      expect(resultB.productId).toBe(productB_sameSku._id.toString());
      expect(resultA.productId).not.toBe(resultB.productId);
    });

    // 17. Identical barcode across two businesses
    it('TEST P17: Tenant isolation - Identical barcode in Business B cannot match when querying Business A', async () => {
      const resultA = await matchProduct({
        businessId: businessA._id,
        barcode: '8901234567890',
      });
      const resultB = await matchProduct({
        businessId: businessB._id,
        barcode: '8901234567890',
      });

      expect(resultA.productId).toBe(productA1._id.toString());
      expect(resultB.productId).toBe(productB_sameSku._id.toString());
    });

    // 18. Inactive product excluded
    it('TEST P18: Inactive or deleted products (active: false, deletedAt != null) are excluded', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        skuOrCode: 'GAS-R12', // productA_inactive
        description: 'Legacy R12 Refrigerant Cylinder',
      });

      expect(result.matchingMethod).toBe('UNMATCHED');
      expect(result.isMatched).toBe(false);
      expect(result.productId).toBeNull();
    });

    // 19. Product is NEVER selected arbitrarily
    it('TEST P19: Invariant - Arbitrary fallback product is NEVER chosen on missing/blank input', async () => {
      const result = await matchProduct({
        businessId: businessA._id,
        description: null,
        skuOrCode: null,
        barcode: null,
        hsnSac: null,
      });

      expect(result.matchingMethod).toBe('UNMATCHED');
      expect(result.isMatched).toBe(false);
      expect(result.productId).toBeNull();
      expect(result.productId).not.toBe(productA1._id.toString());
    });
  });

  // =========================================================================
  // 3. READ-ONLY MUTATION GUARANTEE TESTS
  // =========================================================================
  describe('C. Read-Only Mutation Guarantees', () => {
    it('should never create or update any Vendor or Product document during matching operations', async () => {
      const vendorCountBefore = await Vendor.countDocuments({});
      const productCountBefore = await Product.countDocuments({});

      // Execute vendor match with novel vendor info
      await matchVendor({
        businessId: businessA._id,
        name: 'Brand New Vendor Not In DB',
        gstin: '24AAACT9999T1Z9',
      });

      // Execute product match with novel product info
      await matchProduct({
        businessId: businessA._id,
        skuOrCode: 'BRAND-NEW-SKU',
        description: 'Brand New Product Not In Catalog',
      });

      const vendorCountAfter = await Vendor.countDocuments({});
      const productCountAfter = await Product.countDocuments({});

      expect(vendorCountAfter).toBe(vendorCountBefore);
      expect(productCountAfter).toBe(productCountBefore);
    });
  });

  // =========================================================================
  // 4. SPECIFICATION-AWARE FUZZY MATCHING & SUBSTRING SAFETY (PHASE 2C.1)
  // =========================================================================
  describe('D. Phase 2C.1 — Specification-Aware Fuzzy Matching & Substring Baseline Safety', () => {
    beforeAll(async () => {
      // 1. Capacitor 35UF 450V
      await Product.create({
        businessId: businessA._id,
        name: 'Capacitor 35UF 450V',
        uom: 'PCS',
        defaultPriceMinor: 25000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      // 2. AC 1.5 Ton 3 Star
      await Product.create({
        businessId: businessA._id,
        name: 'AC 1.5 Ton 3 Star',
        uom: 'SET',
        defaultPriceMinor: 3500000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      // 3. Pump 2HP
      await Product.create({
        businessId: businessA._id,
        name: 'Pump 2HP',
        uom: 'PCS',
        defaultPriceMinor: 1500000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      // 4. Motor 1HP
      await Product.create({
        businessId: businessA._id,
        name: 'Motor 1HP',
        uom: 'PCS',
        defaultPriceMinor: 850000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      // 5. Capacitor 35UF (without voltage)
      await Product.create({
        businessId: businessA._id,
        name: 'Capacitor 35UF',
        uom: 'PCS',
        defaultPriceMinor: 20000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });
    });

    // Example 1: Identical specifications -> strong match
    it('Example 1: Catalog "Capacitor 35UF 450V" vs Bill "Capacitor 35UF 450V" -> EXACT_NAME match with REVIEW_REQUIRED', async () => {
      await Product.deleteMany({});
      await Product.create({
        businessId: businessA._id,
        name: 'Capacitor 35UF 450V',
        uom: 'PCS',
        defaultPriceMinor: 25000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Capacitor 35UF 450V',
      });

      expect(result.matchingMethod).toBe('EXACT_NAME');
      expect(result.isMatched).toBe(true);
      expect(result.status).toBe('REVIEW_REQUIRED'); // Name match requires review
      expect(result.productName).toBe('Capacitor 35UF 450V');
    });

    // Example 2: Voltage conflict (450V vs 250V) -> must NOT be treated as high-confidence match
    it('Example 2: Catalog "Capacitor 35UF 450V" vs Bill "Capacitor 35UF 250V" -> Voltage conflict prevents automatic match', async () => {
      await Product.deleteMany({});
      await Product.create({
        businessId: businessA._id,
        name: 'Capacitor 35UF 450V',
        uom: 'PCS',
        defaultPriceMinor: 25000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Capacitor 35UF 250V',
      });

      // Voltage contradicts (250V != 450V)
      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.reason).toContain('Conflicting product specification detected');
      expect(result.reason).toContain('voltage');
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    // Example 3: Star rating conflict (3 Star vs 5 Star) -> REVIEW_REQUIRED, no auto match
    it('Example 3: Catalog "AC 1.5 Ton 3 Star" vs Bill "AC 1.5 Ton 5 Star" -> Star rating conflict produces REVIEW_REQUIRED', async () => {
      await Product.deleteMany({});
      await Product.create({
        businessId: businessA._id,
        name: 'AC 1.5 Ton 3 Star',
        uom: 'SET',
        defaultPriceMinor: 3500000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      const result = await matchProduct({
        businessId: businessA._id,
        description: 'AC 1.5 Ton 5 Star',
      });

      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.reason).toContain('Conflicting product specification detected');
      expect(result.reason).toContain('star_rating');
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    // Example 4: Pump HP conflict (2HP vs 5HP) -> REVIEW_REQUIRED, no auto match
    it('Example 4: Catalog "Pump 2HP" vs Bill "Pump 5HP" -> Horsepower conflict produces REVIEW_REQUIRED', async () => {
      await Product.deleteMany({});
      await Product.create({
        businessId: businessA._id,
        name: 'Pump 2HP',
        uom: 'PCS',
        defaultPriceMinor: 1500000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Pump 5HP',
      });

      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.reason).toContain('Conflicting product specification detected');
      expect(result.reason).toContain('horsepower');
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    // Example 5: Motor HP conflict (1HP vs 2HP) -> REVIEW_REQUIRED, no auto match
    it('Example 5: Catalog "Motor 1HP" vs Bill "Motor 2HP" -> Horsepower conflict produces REVIEW_REQUIRED', async () => {
      await Product.deleteMany({});
      await Product.create({
        businessId: businessA._id,
        name: 'Motor 1HP',
        uom: 'PCS',
        defaultPriceMinor: 850000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Motor 2HP',
      });

      expect(result.isMatched).toBe(false);
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.reason).toContain('Conflicting product specification detected');
      expect(result.reason).toContain('horsepower');
      expect(result.alternatives.length).toBeGreaterThan(0);
    });

    // Example 6: Substring similarity alone cannot bypass review
    it('Example 6: Catalog "Capacitor 35UF" vs Bill "Capacitor 35UF 450V" -> Candidate but must NOT bypass REVIEW_REQUIRED', async () => {
      await Product.deleteMany({});
      await Product.create({
        businessId: businessA._id,
        name: 'Capacitor 35UF',
        uom: 'PCS',
        defaultPriceMinor: 20000,
        currency: 'INR',
        defaultTaxRateBps: 1800,
        active: true,
        deletedAt: null,
      });

      const result = await matchProduct({
        businessId: businessA._id,
        description: 'Capacitor 35UF 450V',
      });

      // Even if "Capacitor 35UF" is a substring, status MUST be REVIEW_REQUIRED
      expect(result.status).toBe('REVIEW_REQUIRED');
      expect(result.status).not.toBe('VERIFIED');
      expect(result.matchingMethod).toBe('FUZZY_DESCRIPTION');
      expect(result.productName).toBe('Capacitor 35UF');
    });
  });
});
