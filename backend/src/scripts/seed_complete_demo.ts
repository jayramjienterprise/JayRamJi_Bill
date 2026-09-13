import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import { seedDatabase } from '../database/seed';
import { seedAmcData } from '../database/seed_amc';
import { User } from '../database/models/User';
import { Business } from '../database/models/Business';
import { BusinessMember } from '../database/models/BusinessMember';
import { Vendor } from '../database/models/Vendor';
import { Purchase } from '../database/models/Purchase';
import { PurchaseReceipt } from '../database/models/PurchaseReceipt';
import { Product } from '../database/models/Product';

async function seedCompleteDemo() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/jayramji_bill';
  console.log('🔌 Connecting to MongoDB for Demo Seeding:', uri);
  await mongoose.connect(uri);

  console.log('\n🧹 Cleaning non-demo/extraneous accounts and competitor data...');
  // Clean competitor workshop and non-demo users if any
  const competitorBiz = await Business.findOne({ name: /Competitor/i });
  if (competitorBiz) {
    await BusinessMember.deleteMany({ businessId: competitorBiz._id });
    await Business.deleteOne({ _id: competitorBiz._id });
    console.log('  - Removed Competitor Workshop');
  }
  await User.deleteMany({ email: { $in: ['other@shop.com'] } });

  console.log('\n📦 Step 1: Running primary seed (Business, Customers, Products, 20 Invoices & Payments)...');
  await seedDatabase();

  console.log('\n❄️ Step 2: Running AMC seed (AC Equipment, Plans, Quotations, Contracts, Visits)...');
  await seedAmcData();

  console.log('\n🛒 Step 3: Seeding Purchase Management & Vendor Demo Data...');
  const demoUser = await User.findOne({ email: 'shopkeeper@jayramji.com' });
  const demoBiz = await Business.findOne({ name: 'Jay Ramji Enterprise' });

  if (!demoUser || !demoBiz) {
    throw new Error('Demo user or business not found after initial seed');
  }

  // Clear existing purchases & vendors for a fresh demo state
  await PurchaseReceipt.deleteMany({ businessId: demoBiz._id });
  await Purchase.deleteMany({ businessId: demoBiz._id });
  await Vendor.deleteMany({ businessId: demoBiz._id });

  // 1. Create Vendors
  const vendorsData = [
    {
      businessId: demoBiz._id,
      vendorCode: 'VND-001',
      name: 'Gujarat CoolAir Spares Pvt Ltd',
      contactPerson: 'Bhavesh Patel',
      mobile: '98250 12345',
      email: 'sales@gujaratcoolair.com',
      address: 'Plot 45, GIDC Industrial Estate, Phase 1',
      city: 'Mundra',
      state: 'Gujarat',
      pincode: '370421',
      gstNumber: '24AABCG1234F1Z9',
      paymentTerms: 'NET_30',
      isActive: true,
    },
    {
      businessId: demoBiz._id,
      vendorCode: 'VND-002',
      name: 'Subros OEM Refrigeration Parts',
      contactPerson: 'Mahesh Sharma',
      mobile: '97240 67890',
      email: 'orders@subrosrefrigeration.in',
      address: 'National Highway 8A, Near Transport Nagar',
      city: 'Gandhidham',
      state: 'Gujarat',
      pincode: '370201',
      gstNumber: '24AAECS9876E1Z4',
      paymentTerms: 'DUE_ON_RECEIPT',
      isActive: true,
    },
    {
      businessId: demoBiz._id,
      vendorCode: 'VND-003',
      name: 'Blue Star Industrial Tools & Components',
      contactPerson: 'Karan Dave',
      mobile: '99090 54321',
      email: 'karan@bluestartools.com',
      address: 'Commercial Complex, Tagore Road',
      city: 'Rajkot',
      state: 'Gujarat',
      pincode: '360002',
      gstNumber: '24AACFB5544D1Z2',
      paymentTerms: 'NET_15',
      isActive: true,
    },
  ];

  const createdVendors: any[] = [];
  for (const vData of vendorsData) {
    const v = await Vendor.create(vData);
    createdVendors.push(v);
  }
  console.log(`  ✅ Created ${createdVendors.length} demo vendors`);

  // 2. Fetch existing products to link with purchases
  const products = await Product.find({ businessId: demoBiz._id });
  const p1 = products.find(p => p.name.includes('Condenser')) || products[0];
  const p2 = products.find(p => p.name.includes('Filter')) || products[1];

  // 3. Create Sample Completed Purchase Order
  const po1Date = new Date('2026-08-15T10:00:00Z');
  const item1Id = new mongoose.Types.ObjectId();
  const item2Id = new mongoose.Types.ObjectId();

  const po1 = await Purchase.create({
    businessId: demoBiz._id,
    purchaseNumber: 'PO-2026-0001',
    purchaseType: 'DIRECT_PURCHASE',
    vendorId: createdVendors[0]._id,
    vendorInvoiceNumber: 'INV-GCA-8891',
    purchaseDate: po1Date,
    status: 'CONFIRMED',
    receivingStatus: 'RECEIVED',
    paymentStatus: 'PAID',
    subtotal: 65000,
    discountAmount: 0,
    taxAmount: 11700,
    totalAmount: 76700,
    paidAmount: 76700,
    outstandingAmount: 0,
    items: [
      {
        _id: item1Id,
        productId: p1._id,
        productNameSnapshot: p1.name,
        skuSnapshot: p1.sku || 'SKU-COND-01',
        orderedQuantity: 10,
        receivedQuantity: 10,
        remainingQuantity: 0,
        unitPurchasePrice: 5500,
        discountPercent: 0,
        discountAmount: 0,
        taxRate: 18,
        taxAmount: 9900,
        totalAmount: 64900,
        receivingStatus: 'RECEIVED',
      },
      {
        _id: item2Id,
        productId: p2._id,
        productNameSnapshot: p2.name,
        skuSnapshot: p2.sku || 'SKU-FLTR-02',
        orderedQuantity: 25,
        receivedQuantity: 25,
        remainingQuantity: 0,
        unitPurchasePrice: 400,
        discountPercent: 0,
        discountAmount: 0,
        taxRate: 18,
        taxAmount: 1800,
        totalAmount: 11800,
        receivingStatus: 'RECEIVED',
      },
    ],
    createdBy: demoUser._id,
  });

  // Create Goods Receipt for PO1
  await PurchaseReceipt.create({
    businessId: demoBiz._id,
    purchaseId: po1._id,
    receiptNumber: 'GRN-2026-0001',
    receivedBy: demoUser._id,
    receivedAt: new Date('2026-08-18T14:30:00Z'),
    deliveryChallanNumber: 'DC-8891',
    items: [
      {
        purchaseItemId: item1Id,
        productId: p1._id,
        productNameSnapshot: p1.name,
        quantityReceived: 10,
        unitPurchasePrice: 5500,
      },
      {
        purchaseItemId: item2Id,
        productId: p2._id,
        productNameSnapshot: p2.name,
        quantityReceived: 25,
        unitPurchasePrice: 400,
      },
    ],
    notes: 'Received in good condition, OEM seals intact.',
  });

  // 4. Create Sample Ordered Purchase Order (Awaiting Delivery)
  const po2Date = new Date('2026-09-05T11:00:00Z');
  const item3Id = new mongoose.Types.ObjectId();

  await Purchase.create({
    businessId: demoBiz._id,
    purchaseNumber: 'PO-2026-0002',
    purchaseType: 'ORDERED_PURCHASE',
    vendorId: createdVendors[1]._id,
    vendorInvoiceNumber: 'SUB-INV-4412',
    purchaseDate: po2Date,
    dueDate: new Date('2026-09-25T10:00:00Z'),
    status: 'CONFIRMED',
    receivingStatus: 'NOT_RECEIVED',
    paymentStatus: 'PARTIALLY_PAID',
    subtotal: 28000,
    discountAmount: 0,
    taxAmount: 5040,
    totalAmount: 33040,
    paidAmount: 15000,
    outstandingAmount: 18040,
    items: [
      {
        _id: item3Id,
        productId: p1._id,
        productNameSnapshot: p1.name,
        skuSnapshot: p1.sku || 'SKU-COND-01',
        orderedQuantity: 5,
        receivedQuantity: 0,
        remainingQuantity: 5,
        unitPurchasePrice: 5600,
        discountPercent: 0,
        discountAmount: 0,
        taxRate: 18,
        taxAmount: 5040,
        totalAmount: 33040,
        receivingStatus: 'NOT_RECEIVED',
      },
    ],
    createdBy: demoUser._id,
  });
  console.log('  ✅ Created demo Purchase Orders and Goods Receipt');

  // Ensure password is set to JayRamJi@2026Secure!
  const passwordHash = await bcrypt.hash('JayRamJi@2026Secure!', 10);
  demoUser.passwordHash = passwordHash;
  demoUser.status = 'ACTIVE';
  await demoUser.save();

  console.log('\n======================================================');
  console.log('🎉 DEMO DATA SEEDING COMPLETE!');
  console.log('======================================================');
  console.log('👤 Demo User Account:');
  console.log('   Email:    shopkeeper@jayramji.com');
  console.log('   Password: JayRamJi@2026Secure!');
  console.log('🏢 Business:  Jay Ramji Enterprise');
  console.log('📊 Summary:');
  console.log('   - 20 Finalized Invoices & Payments (past 12 months)');
  console.log('   - 6 Standard AC Services & Products');
  console.log('   - 6 Demo Customers with GST & Contact info');
  console.log('   - 4 Payment Accounts (UPI, HDFC, ICICI, Cash Drawer)');
  console.log('   - Full AMC Module (Equipments, Plans, Contracts, Visits, Technicians)');
  console.log('   - Full Purchase Module (3 Vendors, 2 POs, 1 Goods Receipt)');
  console.log('======================================================\n');

  await mongoose.disconnect();
}

seedCompleteDemo().catch((err) => {
  console.error('❌ Error during demo seeding:', err);
  process.exit(1);
});
