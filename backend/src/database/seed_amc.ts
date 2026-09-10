import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env';
import { User } from './models/User';
import { Business } from './models/Business';
import { BusinessMember } from './models/BusinessMember';
import { Customer } from './models/Customer';
import { Product } from './models/Product';
import { CustomerAcEquipment } from './models/CustomerAcEquipment';
import { AmcPlan } from './models/AmcPlan';
import { AmcQuotation } from './models/AmcQuotation';
import { AmcContract } from './models/AmcContract';
import { AmcServiceVisit } from './models/AmcServiceVisit';

export async function seedAmcData() {
  console.log('🚀 Starting AMC comprehensive seed script...');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
  }

  // 1. Find shopkeeper@jayramji.com user
  const user = await User.findOne({ email: 'shopkeeper@jayramji.com' });
  if (!user) {
    throw new Error('shopkeeper@jayramji.com user not found. Please run regular seed first.');
  }

  // Find business for shopkeeper
  const membership = await BusinessMember.findOne({ userId: user._id, role: 'OWNER' });
  let businessId: any = membership?.businessId;
  if (!businessId) {
    const defaultBusiness = await Business.findOne({ name: /Jay Ramji/i });
    if (!defaultBusiness) {
      throw new Error('Business for Jay Ramji Enterprise not found.');
    }
    businessId = defaultBusiness._id;
  }

  const business = await Business.findById(businessId);
  if (!business) {
    throw new Error('Business record not found.');
  }

  console.log(`🏢 Inserting AMC seed data for Business: ${business.name} (ID: ${business._id})`);

  const passwordHash = await bcrypt.hash('password123', 10);

  // 2. Create Technicians as Business Members
  const techniciansData = [
    {
      name: 'Ramesh Kumar (Lead Technician)',
      email: 'ramesh.tech@jayramji.com',
      phone: '+91 98765 11223',
    },
    {
      name: 'Suresh Sharma (HVAC Specialist)',
      email: 'suresh.tech@jayramji.com',
      phone: '+91 98250 44556',
    },
  ];

  const technicianUsers: any[] = [];
  for (const tech of techniciansData) {
    let techUser = await User.findOne({ email: tech.email });
    if (!techUser) {
      techUser = await User.create({
        name: tech.name,
        email: tech.email,
        phone: tech.phone,
        passwordHash,
        status: 'ACTIVE',
      });
    }

    await BusinessMember.findOneAndUpdate(
      { businessId, userId: techUser._id },
      { businessId, userId: techUser._id, role: 'STAFF', active: true },
      { upsert: true }
    );
    technicianUsers.push(techUser);
  }

  // 3. Ensure Key Customers exist
  const customersData = [
    {
      name: 'AON ENGINEERS AND CONSULTANTS PVT. LTD',
      companyName: 'AON Engineers & Consultants',
      taxProfile: { gstin: '24AAACA1234F1Z8' },
      contact: { phone: '+91 98251 12233', email: 'service@aonengineers.com' },
      address: { line1: 'GIDC Industrial Area, Phase-2', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    },
    {
      name: 'Patel Cold Storage & Logistics',
      companyName: 'Patel Cold Storage',
      taxProfile: { gstin: '24AABCP4455D1Z6' },
      contact: { phone: '+91 97270 33445', email: 'operations@patelcoldstorage.com' },
      address: { line1: 'Port Road Near Bypass', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    },
    {
      name: 'Mahavir Earthmovers',
      companyName: 'Mahavir Crane & Equipment',
      taxProfile: { gstin: '24AABCM9988E1Z4' },
      contact: { phone: '+91 98980 55667', email: 'mahavir.earth@gmail.com' },
      address: { line1: 'Kandla Highway Junction', city: 'Gandhidham', state: 'Gujarat', postalCode: '370201', country: 'India' },
    },
    {
      name: 'Shreeji Auto Travels',
      companyName: 'Shreeji Travels',
      taxProfile: { gstin: '24AABCS1429B1Z8' },
      contact: { phone: '+91 98250 99887', email: 'fleet@shreejitravels.com' },
      address: { line1: 'National Highway 8A', city: 'Gandhidham', state: 'Gujarat', postalCode: '370201', country: 'India' },
    },
  ];

  const customers: Record<string, any> = {};
  for (const c of customersData) {
    let doc = await Customer.findOne({ businessId, name: c.name });
    if (!doc) {
      doc = await Customer.create({ businessId, ...c, active: true });
    }
    customers[c.name] = doc;
  }

  // 4. Ensure AC Spare Parts / Products exist
  const partsData = [
    {
      name: 'AC Run Capacitor 50 MFD',
      type: 'PRODUCT' as const,
      category: 'Electrical Parts',
      uom: 'PCS',
      defaultPriceMinor: 45000, // ₹450
      hsnCode: '8532',
      description: 'Heavy duty motor run capacitor for outdoor units',
    },
    {
      name: 'Refrigerant R32 Gas Can',
      type: 'PRODUCT' as const,
      category: 'Refrigerant',
      uom: 'KG',
      defaultPriceMinor: 85000, // ₹850
      hsnCode: '2903',
      description: 'Eco-friendly R32 refrigerant top-up',
    },
    {
      name: 'Split AC Indoor Blower Motor',
      type: 'PRODUCT' as const,
      category: 'Motors',
      uom: 'PCS',
      defaultPriceMinor: 220000, // ₹2,200
      hsnCode: '8501',
      description: 'High RPM low noise copper blower motor',
    },
  ];

  const parts: Record<string, any> = {};
  for (const p of partsData) {
    let doc = await Product.findOne({ businessId, name: p.name });
    if (!doc) {
      doc = await Product.create({ businessId, ...p, active: true });
    }
    parts[p.name] = doc;
  }

  // 5. Seed AMC Plans
  let compPlan = await AmcPlan.findOne({ businessId, name: 'Comprehensive Corporate AC Fleet Plan' });
  if (!compPlan) {
    compPlan = await AmcPlan.create({
      businessId,
      name: 'Comprehensive Corporate AC Fleet Plan',
      code: 'PLAN-COMP-01',
      planType: 'COMPREHENSIVE',
      durationMonths: 12,
      basePrice: 6500,
      applicableAcTypes: ['SPLIT', 'CASSETTE', 'DUCTABLE'],
      applicableTonnages: ['1.5', '2.0', 'Up to 5 Ton'],
      entitlements: [
        { serviceType: 'WATER_SERVICE', scheduling: 'QUARTERLY', quantity: 4, entitlementScope: 'PER_EQUIPMENT' },
        { serviceType: 'DRY_SERVICE', scheduling: 'MONTHLY', quantity: 8, entitlementScope: 'PER_EQUIPMENT' },
        { serviceType: 'BREAKDOWN_REPAIR', scheduling: 'ON_DEMAND', quantity: 2, entitlementScope: 'PER_CONTRACT' },
        { serviceType: 'GAS_CHARGING', scheduling: 'ON_DEMAND', quantity: 1, entitlementScope: 'PER_EQUIPMENT' },
      ],
      partCoverages: [
        {
          productId: parts['AC Run Capacitor 50 MFD']._id,
          coverageType: 'FULL',
          quantityLimitPerYear: 2,
        },
      ],
      gasCoverage: {
        included: true,
        refrigerantTypes: ['R32', 'R410A'],
        quantityLimitKg: 2,
        limitScope: 'PER_EQUIPMENT',
        excludeDamagePipingLeaks: true,
      },
      termsAndConditions: [
        'Includes 4 quarterly deep water services and routine breakdown attendance.',
        'Capacitors and minor electricals included under full coverage.',
        'Physical damage to copper piping due to external accidents is excluded.',
      ],
      active: true,
    });
  }

  let nonCompPlan = await AmcPlan.findOne({ businessId, name: 'Non-Comprehensive Standard Annual Plan' });
  if (!nonCompPlan) {
    nonCompPlan = await AmcPlan.create({
      businessId,
      name: 'Non-Comprehensive Standard Annual Plan',
      code: 'PLAN-NONCOMP-01',
      planType: 'NON_COMPREHENSIVE',
      durationMonths: 12,
      basePrice: 3800,
      applicableAcTypes: ['SPLIT', 'WINDOW'],
      applicableTonnages: ['1.0', '1.5', '2.0'],
      entitlements: [
        { serviceType: 'WATER_SERVICE', scheduling: 'QUARTERLY', quantity: 4, entitlementScope: 'PER_EQUIPMENT' },
        { serviceType: 'BREAKDOWN_REPAIR', scheduling: 'ON_DEMAND', quantity: 2, entitlementScope: 'PER_CONTRACT' },
      ],
      partCoverages: [],
      gasCoverage: {
        included: false,
        refrigerantTypes: ['R32', 'R410A'],
        quantityLimitKg: null,
        limitScope: 'PER_EQUIPMENT',
        excludeDamagePipingLeaks: true,
      },
      termsAndConditions: [
        'Includes 4 periodic water washes and labour for breakdowns.',
        'All spare parts, copper tubes, and gas recharging are chargeable.',
      ],
      active: true,
    });
  }

  // 6. Seed Customer AC Equipment (Customer AC Units)
  const equipmentData = [
    {
      customerId: customers['AON ENGINEERS AND CONSULTANTS PVT. LTD']._id,
      acType: 'CASSETTE' as const,
      tonnage: '2.0 Ton',
      brand: 'Daikin',
      modelNumber: 'FCQ71KAVEA',
      serialNumber: 'DKN-CAS-991',
      installationLocation: 'Server Room 1',
      refrigerantType: 'R32',
    },
    {
      customerId: customers['AON ENGINEERS AND CONSULTANTS PVT. LTD']._id,
      acType: 'SPLIT' as const,
      tonnage: '1.5 Ton',
      brand: 'Voltas',
      modelNumber: '183V CZR',
      serialNumber: 'VOL-SPL-442',
      installationLocation: 'Director Cabin (1st Floor)',
      refrigerantType: 'R32',
    },
    {
      customerId: customers['Patel Cold Storage & Logistics']._id,
      acType: 'PACKAGE' as const,
      tonnage: '5.0 Ton',
      brand: 'Carrier',
      modelNumber: '40QMA060',
      serialNumber: 'CAR-PKG-101',
      installationLocation: 'Cold Storage Packing Hall',
      refrigerantType: 'R410A',
    },
    {
      customerId: customers['Patel Cold Storage & Logistics']._id,
      acType: 'SPLIT' as const,
      tonnage: '1.5 Ton',
      brand: 'Hitachi',
      modelNumber: 'RAW518KUD',
      serialNumber: 'HIT-SPL-553',
      installationLocation: 'Accounts Office',
      refrigerantType: 'R32',
    },
    {
      customerId: customers['Mahavir Earthmovers']._id,
      acType: 'SPLIT' as const,
      tonnage: '1.5 Ton',
      brand: 'Blue Star',
      modelNumber: 'IA318YLU',
      serialNumber: 'BLU-SPL-778',
      installationLocation: 'Workshop Office',
      refrigerantType: 'R32',
    },
    {
      customerId: customers['Shreeji Auto Travels']._id,
      acType: 'SPLIT' as const,
      tonnage: '1.5 Ton',
      brand: 'Lloyd',
      modelNumber: 'GLS18I5FWCVB',
      serialNumber: 'LLD-SPL-882',
      installationLocation: 'Ticket Booking Counter',
      refrigerantType: 'R32',
    },
  ];

  const equipments: any[] = [];
  for (const eq of equipmentData) {
    let doc = await CustomerAcEquipment.findOne({
      businessId,
      customerId: eq.customerId,
      serialNumber: eq.serialNumber,
    });
    if (!doc) {
      doc = await CustomerAcEquipment.create({
        businessId,
        ...eq,
        status: 'OPERATIONAL',
        active: true,
      });
    }
    equipments.push(doc);
  }

  // 7. Seed AMC Quotations across all stages
  // STAGE A: DRAFT Quotation
  const qDraftNum = 'JRE-Q-2526-4237';
  await AmcQuotation.findOneAndUpdate(
    { businessId, quotationNumber: qDraftNum },
    {
      businessId,
      quotationNumber: qDraftNum,
      customerId: customers['Mahavir Earthmovers']._id,
      quotationDate: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentTerms: '10 Days from Invoice date',
      quotationType: 'NON_COMPREHENSIVE',
      items: [
        {
          serialNumber: 1,
          description: '1.5 Ton Split AC Routine Non-Comprehensive AMC',
          period: 'Annual',
          quantity: 2,
          unitPrice: 3600,
          amount: 7200,
        },
      ],
      subtotal: 7200,
      discount: 0,
      taxRateBps: 1800,
      taxAmount: 1296,
      grandTotal: 8496,
      status: 'DRAFT',
      notes: 'Draft quotation under client review. Click Edit Draft to add extra units.',
      termsAndConditions: [
        'Includes 4 periodic water washes and labour for breakdowns.',
        'All spare parts and refrigerant gas are chargeable.',
        'Payment term: 10 days from invoice date.',
      ],
      active: true,
    },
    { upsert: true, new: true }
  );

  // STAGE B: SENT / FINALIZED Quotation (Ready to Share or Convert)
  const qSentNum = 'JRE-Q-2526-4238';
  await AmcQuotation.findOneAndUpdate(
    { businessId, quotationNumber: qSentNum },
    {
      businessId,
      quotationNumber: qSentNum,
      customerId: customers['Patel Cold Storage & Logistics']._id,
      quotationDate: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentTerms: '15 Days from Invoice date',
      quotationType: 'COMPREHENSIVE',
      items: [
        {
          serialNumber: 1,
          description: '5.0 Ton Package Ductable AC Comprehensive Annual Maintenance',
          period: 'Annual',
          quantity: 1,
          unitPrice: 14000,
          amount: 14000,
        },
        {
          serialNumber: 2,
          description: '1.5 Ton Split AC Comprehensive Maintenance',
          period: 'Annual',
          quantity: 1,
          unitPrice: 4400,
          amount: 4400,
        },
      ],
      subtotal: 18400,
      discount: 400,
      taxRateBps: 1800,
      taxAmount: 3240,
      grandTotal: 21240,
      status: 'SENT',
      notes: 'Finalized proposal sent to client. Ready for PDF download, WhatsApp share, or 1-click conversion to AMC.',
      termsAndConditions: [
        'Comprehensive AMC covers routine servicing, repairs, and minor electrical components.',
        'Emergency breakdown visits will be attended within 24 hours.',
        'Major compressor replacement requires prior approval.',
      ],
      active: true,
    },
    { upsert: true, new: true }
  );

  // STAGE C: CONVERTED_TO_CONTRACT Quotation
  const qConvertedNum = 'JRE-Q-2526-4239';
  const qConverted = await AmcQuotation.findOneAndUpdate(
    { businessId, quotationNumber: qConvertedNum },
    {
      businessId,
      quotationNumber: qConvertedNum,
      customerId: customers['AON ENGINEERS AND CONSULTANTS PVT. LTD']._id,
      quotationDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      validUntil: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      paymentTerms: '10 Days from Invoice date',
      quotationType: 'COMPREHENSIVE',
      items: [
        {
          serialNumber: 1,
          description: '2.0 Ton Cassette AC Comprehensive Maintenance (Server Room)',
          period: 'Annual',
          quantity: 1,
          unitPrice: 6500,
          amount: 6500,
        },
        {
          serialNumber: 2,
          description: '1.5 Ton Split AC Comprehensive Maintenance (Director Cabin)',
          period: 'Annual',
          quantity: 1,
          unitPrice: 4500,
          amount: 4500,
        },
      ],
      subtotal: 11000,
      discount: 0,
      taxRateBps: 1800,
      taxAmount: 1980,
      grandTotal: 12980,
      status: 'CONVERTED_TO_CONTRACT',
      notes: 'Quotation approved and successfully converted to Contract #AMC-2526-001.',
      active: true,
    },
    { upsert: true, new: true }
  );

  // 8. Seed AMC Contracts
  // CONTRACT 1: Active 1-Year Comprehensive Contract with 2 covered units
  const aonEquips = equipments.filter(
    (e) => e.customerId.toString() === customers['AON ENGINEERS AND CONSULTANTS PVT. LTD']._id.toString()
  );

  const startDateContract1 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // started 2 months ago
  const endDateContract1 = new Date(new Date(startDateContract1).setFullYear(startDateContract1.getFullYear() + 1));

  let contract1 = await AmcContract.findOne({ businessId, contractNumber: 'AMC-2526-001' });
  if (!contract1) {
    contract1 = await AmcContract.create({
      businessId,
      contractNumber: 'AMC-2526-001',
      quotationId: qConverted._id,
      customerId: customers['AON ENGINEERS AND CONSULTANTS PVT. LTD']._id,
      contractType: 'COMPREHENSIVE',
      coveredUnits: aonEquips.map((eq) => ({
        acEquipmentId: eq._id,
        unitTonnage: eq.tonnage,
        unitBrand: eq.brand,
        unitSerial: eq.serialNumber,
        unitLocation: eq.installationLocation,
      })),
      startDate: startDateContract1,
      endDate: endDateContract1,
      planSnapshot: {
        planId: compPlan._id,
        planName: compPlan.name,
        planType: 'COMPREHENSIVE',
        durationMonths: 12,
        entitlements: compPlan.entitlements,
        partCoverages: compPlan.partCoverages.map((p) => ({
          productId: p.productId,
          productName: 'AC Run Capacitor 50 MFD',
          coverageType: p.coverageType,
          quantityLimitPerYear: p.quantityLimitPerYear,
        })),
        gasCoverage: compPlan.gasCoverage,
        termsAndConditions: compPlan.termsAndConditions,
      },
      financials: {
        contractAmount: 11000,
        discount: 0,
        taxAmount: 1980,
        finalAmount: 12980,
        paidAmount: 12980,
      },
      paymentStatus: 'PAID',
      activationTrigger: 'ADMIN_APPROVAL',
      status: 'ACTIVE',
      notes: 'Active annual fleet maintenance agreement. 2 machines covered.',
      active: true,
    });
  }

  // Link converted quotation back to contract1
  qConverted.convertedContractId = contract1._id;
  await qConverted.save();

  // CONTRACT 2: Expiring Soon Contract (Ending in 12 days, perfect for testing 1-Click Renewal)
  const shreejiEquip = equipments.find(
    (e) => e.customerId.toString() === customers['Shreeji Auto Travels']._id.toString()
  );

  const startDateContract2 = new Date(Date.now() - 353 * 24 * 60 * 60 * 1000); // 353 days ago
  const endDateContract2 = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000); // 12 days left!

  let contract2 = await AmcContract.findOne({ businessId, contractNumber: 'AMC-2526-002' });
  if (!contract2) {
    contract2 = await AmcContract.create({
      businessId,
      contractNumber: 'AMC-2526-002',
      customerId: customers['Shreeji Auto Travels']._id,
      contractType: 'NON_COMPREHENSIVE',
      coveredUnits: shreejiEquip
        ? [
            {
              acEquipmentId: shreejiEquip._id,
              unitTonnage: shreejiEquip.tonnage,
              unitBrand: shreejiEquip.brand,
              unitSerial: shreejiEquip.serialNumber,
              unitLocation: shreejiEquip.installationLocation,
            },
          ]
        : [],
      startDate: startDateContract2,
      endDate: endDateContract2,
      planSnapshot: {
        planId: nonCompPlan._id,
        planName: nonCompPlan.name,
        planType: 'NON_COMPREHENSIVE',
        durationMonths: 12,
        entitlements: nonCompPlan.entitlements,
        partCoverages: [],
        gasCoverage: nonCompPlan.gasCoverage,
        termsAndConditions: nonCompPlan.termsAndConditions,
      },
      financials: {
        contractAmount: 7500,
        discount: 0,
        taxAmount: 1350,
        finalAmount: 8850,
        paidAmount: 8850,
      },
      paymentStatus: 'PAID',
      activationTrigger: 'ADMIN_APPROVAL',
      status: 'ACTIVE',
      notes: 'Expiring soon in 12 days! Click "Renew Contract" to create the successor renewal contract.',
      active: true,
    });
  }

  // 9. Seed Service Visits across different statuses
  // VISIT 1: COMPLETED Visit (Q1 Quarterly Water Service)
  const visit1Num = 'SV-2526-0001';
  await AmcServiceVisit.findOneAndUpdate(
    { businessId, visitNumber: visit1Num },
    {
      businessId,
      visitNumber: visit1Num,
      contractId: contract1._id,
      acEquipmentId: aonEquips[0]._id,
      serviceType: 'WATER_SERVICE',
      scheduledDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      actualServiceDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      technicianId: technicianUsers[0]._id,
      status: 'COMPLETED',
      isBillableExtra: false,
      checklist: {
        filterCleaned: true,
        indoorCoilCleaned: true,
        outdoorCondenserWashed: true,
        electricalTightened: true,
        blowerMotorChecked: true,
        drainPipeChecked: true,
        operatingCurrentAmps: 6.8,
        suctionPressurePsi: 125,
        dischargePressurePsi: 280,
      },
      gasCoveredByAmc: true,
      gasCustomerCharge: 0,
      serviceRating: 5,
      technicianNotes: 'Q1 deep water wash executed. Drain line flushed. Tested at 18°C cooling.',
      customerRemarks: 'Very clean service, cooling restored well.',
      active: true,
    },
    { upsert: true }
  );

  // VISIT 2: SCHEDULED Visit (Q2 Upcoming Quarterly Water Service)
  const visit2Num = 'SV-2526-0002';
  await AmcServiceVisit.findOneAndUpdate(
    { businessId, visitNumber: visit2Num },
    {
      businessId,
      visitNumber: visit2Num,
      contractId: contract1._id,
      acEquipmentId: aonEquips[1]._id,
      serviceType: 'WATER_SERVICE',
      scheduledDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // due in 5 days
      technicianId: technicianUsers[1]._id,
      status: 'SCHEDULED',
      isBillableExtra: false,
      checklist: {
        filterCleaned: false,
        indoorCoilCleaned: false,
        outdoorCondenserWashed: false,
        electricalTightened: false,
        blowerMotorChecked: false,
        drainPipeChecked: false,
      },
      gasCoveredByAmc: true,
      gasCustomerCharge: 0,
      technicianNotes: 'Q2 routine quarterly water service. Call facility manager before arrival.',
      active: true,
    },
    { upsert: true }
  );

  // VISIT 3: BREAKDOWN_REPAIR Visit (Emergency ticket in progress)
  const visit3Num = 'SV-2526-0003';
  await AmcServiceVisit.findOneAndUpdate(
    { businessId, visitNumber: visit3Num },
    {
      businessId,
      visitNumber: visit3Num,
      contractId: contract1._id,
      acEquipmentId: aonEquips[0]._id,
      serviceType: 'BREAKDOWN_REPAIR',
      scheduledDate: new Date(),
      technicianId: technicianUsers[0]._id,
      status: 'IN_PROGRESS',
      isBillableExtra: false,
      checklist: {
        filterCleaned: false,
        indoorCoilCleaned: false,
        outdoorCondenserWashed: false,
        electricalTightened: true,
        blowerMotorChecked: false,
        drainPipeChecked: false,
      },
      gasCoveredByAmc: true,
      gasCustomerCharge: 0,
      technicianNotes: 'Emergency call: Server room temperature rising. Testing capacitor & fan motor.',
      active: true,
    },
    { upsert: true }
  );

  console.log('✅ AMC Seed Data inserted successfully for shopkeeper@jayramji.com!');
  console.log('----------------------------------------------------');
  console.log('📊 Inserted Records Overview:');
  console.log('   • 2 Technicians: Ramesh Kumar & Suresh Sharma');
  console.log('   • 2 AMC Plans: Comprehensive Fleet & Non-Comprehensive Standard');
  console.log('   • 6 Customer AC Units (Daikin Cassette, Voltas, Carrier, Hitachi, Blue Star, Lloyd)');
  console.log('   • 3 AMC Quotations:');
  console.log('       - JRE-Q-2526-4237 (DRAFT - Mahavir Earthmovers)');
  console.log('       - JRE-Q-2526-4238 (SENT - Patel Cold Storage & Logistics)');
  console.log('       - JRE-Q-2526-4239 (CONVERTED_TO_CONTRACT - AON Engineers)');
  console.log('   • 2 AMC Contracts:');
  console.log('       - AMC-2526-001 (ACTIVE - AON Engineers)');
  console.log('       - AMC-2526-002 (EXPIRING SOON in 12 days - Shreeji Auto Travels)');
  console.log('   • 3 Service Visits:');
  console.log('       - SV-2526-0001 (COMPLETED with full inspection checklist)');
  console.log('       - SV-2526-0002 (SCHEDULED due in 5 days)');
  console.log('       - SV-2526-0003 (IN_PROGRESS breakdown call)');
  console.log('----------------------------------------------------');
}

if (require.main === module) {
  seedAmcData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ AMC Seeding error:', err);
      process.exit(1);
    });
}
