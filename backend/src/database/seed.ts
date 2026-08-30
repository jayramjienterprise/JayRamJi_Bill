import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { env } from '../config/env';
import { User } from './models/User';
import { Business } from './models/Business';
import { BusinessMember } from './models/BusinessMember';
import { Customer } from './models/Customer';
import { Product } from './models/Product';
import { PaymentAccount } from './models/PaymentAccount';
import { Invoice } from './models/Invoice';
import { Payment } from './models/Payment';

export async function seedDatabase() {
  console.log('🌱 Starting JayRamJi database seeding...');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(env.MONGODB_URI);
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash('password123', saltRounds);

  // 1. Create or Update Primary Shopkeeper Admin User
  let user = await User.findOne({ email: 'shopkeeper@jayramji.com' });
  if (!user) {
    user = await User.create({
      name: 'Jay Ramji Owner',
      email: 'shopkeeper@jayramji.com',
      passwordHash,
      status: 'ACTIVE',
    });
  } else {
    user.passwordHash = passwordHash;
    user.status = 'ACTIVE';
    await user.save();
  }

  // Also create/update admin@jayramji.com for convenience
  let adminUser = await User.findOne({ email: 'admin@jayramji.com' });
  if (!adminUser) {
    adminUser = await User.create({
      name: 'Jay Ramji Administrator',
      email: 'admin@jayramji.com',
      passwordHash,
      status: 'ACTIVE',
    });
  } else {
    adminUser.passwordHash = passwordHash;
    adminUser.status = 'ACTIVE';
    await adminUser.save();
  }

  // 2. Create or Update Primary Business
  let business = await Business.findOne({ name: 'Jay Ramji Enterprise' });
  if (!business) {
    business = await Business.create({
      name: 'Jay Ramji Enterprise',
      legalName: 'Jay Ramji Automotive & Engineering Services',
      tagline: 'Vehicle AC, Radiator & Electrical Works',
      gstin: '24AAAAA0000A1Z5',
      address: {
        line1: 'Near GIDC Gate, Mundra Highway Road',
        line2: 'Plot No. 12, Industrial Area',
        city: 'Mundra',
        state: 'Gujarat',
        postalCode: '370421',
        country: 'India',
      },
      contact: {
        phone: '+91 98765 43210',
        email: 'contact@jayramji.com',
        website: 'https://jayramji.com',
      },
      invoiceSettings: {
        prefix: 'JRE',
        nextSequenceNumber: 25,
        defaultPaymentTerms: 'DUE_ON_RECEIPT',
        footerNotes: 'Thank you for your business! All service repairs come with a 30-day workmanship warranty.',
      },
    });
  }

  // 3. Link Membership Roles
  await BusinessMember.findOneAndUpdate(
    { businessId: business._id, userId: user._id },
    { businessId: business._id, userId: user._id, role: 'OWNER' },
    { upsert: true, new: true }
  );

  await BusinessMember.findOneAndUpdate(
    { businessId: business._id, userId: adminUser._id },
    { businessId: business._id, userId: adminUser._id, role: 'OWNER' },
    { upsert: true, new: true }
  );

  // 4. Seed Default Payment Accounts
  const paymentAccountsData = [
    {
      businessId: business._id,
      name: 'Shop GPay / PhonePe UPI',
      displayName: 'Jay Ramji UPI (jayramji@okhdfcbank)',
      type: 'UPI' as const,
      upiId: 'jayramji@okhdfcbank',
      isDefault: true,
      active: true,
    },
    {
      businessId: business._id,
      name: 'HDFC Current Account',
      displayName: 'HDFC Bank (Current A/C ••••5678)',
      type: 'BANK' as const,
      bankName: 'HDFC Bank Ltd',
      accountNumber: '50200012345678',
      ifscCode: 'HDFC0001234',
      branchName: 'Mundra Branch',
      isDefault: false,
      active: true,
    },
    {
      businessId: business._id,
      name: 'ICICI Business Account',
      displayName: 'ICICI Bank (Business A/C ••••9102)',
      type: 'BANK' as const,
      bankName: 'ICICI Bank',
      accountNumber: '001205009102',
      ifscCode: 'ICIC0000012',
      branchName: 'Gandhidham Branch',
      isDefault: false,
      active: true,
    },
    {
      businessId: business._id,
      name: 'Shop Cash Counter Drawer',
      displayName: 'Cash at Counter',
      type: 'CASH' as const,
      isDefault: false,
      active: true,
    },
  ];

  const paymentAccounts: Record<string, any> = {};
  for (const acc of paymentAccountsData) {
    const doc = await PaymentAccount.findOneAndUpdate(
      { businessId: business._id, name: acc.name },
      acc,
      { upsert: true, new: true }
    );
    paymentAccounts[acc.type] = doc;
    paymentAccounts[acc.name] = doc;
  }

  // 5. Seed Sample Customers
  const customersData = [
    {
      businessId: business._id,
      name: 'Priy Mavani',
      companyName: 'Mavani Logistics',
      contact: { phone: '+91 98765 43210', email: 'priy@mavani.com' },
      address: { line1: 'Main Market Road', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    },
    {
      businessId: business._id,
      name: 'Shreeji Auto Travels',
      companyName: 'Shreeji Fleet Transport',
      gstin: '24AABCS1429B1Z8',
      contact: { phone: '+91 98250 99887', email: 'fleet@shreejitravels.com' },
      address: { line1: 'National Highway 8A', city: 'Gandhidham', state: 'Gujarat', postalCode: '370201', country: 'India' },
    },
    {
      businessId: business._id,
      name: 'ABC Engineering Works',
      companyName: 'ABC Heavy Plant & Machinery',
      gstin: '24AABCA2233C1Z2',
      contact: { phone: '+91 94260 11223', email: 'accounts@abcengg.com' },
      address: { line1: 'GIDC Industrial Estate Phase 2', city: 'Anjar', state: 'Gujarat', postalCode: '370110', country: 'India' },
    },
    {
      businessId: business._id,
      name: 'Patel Cold Storage & Logistics',
      companyName: 'Patel Cold Chain Transport',
      gstin: '24AABCP4455D1Z6',
      contact: { phone: '+91 97270 33445', email: 'info@patelcoldstorage.com' },
      address: { line1: 'Port Road Near Bypass', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
    },
    {
      businessId: business._id,
      name: 'Mahavir Earthmovers',
      companyName: 'Mahavir Crane & Excavator Services',
      contact: { phone: '+91 98980 55667', email: 'mahavir.earth@gmail.com' },
      address: { line1: 'Kandla Highway Junction', city: 'Gandhidham', state: 'Gujarat', postalCode: '370201', country: 'India' },
    },
    {
      businessId: business._id,
      name: 'Rajesh Patel',
      contact: { phone: '+91 98223 34455', email: 'rajesh.patel@gmail.com' },
      address: { line1: 'Shanti Nagar Society', city: 'Bhuj', state: 'Gujarat', postalCode: '370001', country: 'India' },
    },
  ];

  const customers: any[] = [];
  for (const cust of customersData) {
    const doc = await Customer.findOneAndUpdate(
      { businessId: business._id, name: cust.name },
      cust,
      { upsert: true, new: true }
    );
    customers.push(doc);
  }

  // 6. Seed Standard Products & Services
  const productsData = [
    {
      businessId: business._id,
      name: 'Car AC Gas Refilling (R134a)',
      type: 'SERVICE' as const,
      category: 'AC Repair',
      uom: 'JOB',
      defaultPriceMinor: 180000, // ₹1,800
      currency: 'INR',
      hsnCode: '9987',
      description: 'Complete evacuation, vacuum test, and refrigerant R134a charging',
    },
    {
      businessId: business._id,
      name: 'Full AC System Service & Compressor Overhaul',
      type: 'SERVICE' as const,
      category: 'AC Repair',
      uom: 'JOB',
      defaultPriceMinor: 350000, // ₹3,500
      currency: 'INR',
      hsnCode: '9987',
      description: 'Compressor cleaning, oil replacement, valve check, and cooling coil service',
    },
    {
      businessId: business._id,
      name: 'Heavy Vehicle Condenser Coil Replacement',
      type: 'PRODUCT' as const,
      category: 'Cooling System',
      uom: 'PCS',
      defaultPriceMinor: 750000, // ₹7,500
      currency: 'INR',
      hsnCode: '8415',
      description: 'Heavy duty aluminium parallel flow condenser core',
    },
    {
      businessId: business._id,
      name: 'Cabin AC Air Filter (High Airflow)',
      type: 'PRODUCT' as const,
      category: 'Spare Parts',
      uom: 'PCS',
      defaultPriceMinor: 65000, // ₹650
      currency: 'INR',
      hsnCode: '8421',
      description: 'OEM replacement activated carbon cabin pollen filter',
    },
    {
      businessId: business._id,
      name: 'Radiator Coolant Flush & Refill',
      type: 'SERVICE' as const,
      category: 'Cooling System',
      uom: 'JOB',
      defaultPriceMinor: 120000, // ₹1,200
      currency: 'INR',
      hsnCode: '9987',
      description: 'Radiator chemical flushing and glycol antifreeze coolant replacement',
    },
    {
      businessId: business._id,
      name: 'HVAC Blower Motor & Resistor Replacement',
      type: 'PRODUCT' as const,
      category: 'Electrical Parts',
      uom: 'PCS',
      defaultPriceMinor: 280000, // ₹2,800
      currency: 'INR',
      hsnCode: '8501',
      description: 'High torque 12V automotive HVAC blower fan assembly',
    },
  ];

  const products: any[] = [];
  for (const prod of productsData) {
    const doc = await Product.findOneAndUpdate(
      { businessId: business._id, name: prod.name },
      prod,
      { upsert: true, new: true }
    );
    products.push(doc);
  }

  // 7. Seed 20 Realistic Finalized Invoices Spanning the Past 1 Year (Sept 2025 to Aug 2026)
  // Clean existing seed invoices to prevent duplication on re-run
  await Invoice.deleteMany({ businessId: business._id });
  await Payment.deleteMany({ businessId: business._id });

  const billsDataset = [
    // 1. Sept 2025
    {
      invNum: 'JRE-000001',
      date: new Date('2025-09-14T11:30:00Z'),
      customer: customers[0],
      items: [
        { product: products[0], qty: 2, priceMinor: 180000 },
        { product: products[3], qty: 1, priceMinor: 60000 },
      ],
      payMethod: 'UPI',
      payAccount: paymentAccounts['Shop GPay / PhonePe UPI'],
      payStatus: 'PAID',
      paidPortion: 1, // 100% paid
    },
    // 2. Oct 2025
    {
      invNum: 'JRE-000002',
      date: new Date('2025-10-20T15:45:00Z'),
      customer: customers[1],
      items: [
        { product: products[1], qty: 2, priceMinor: 350000 },
        { product: products[4], qty: 1, priceMinor: 150000 },
      ],
      payMethod: 'BANK_TRANSFER',
      payAccount: paymentAccounts['HDFC Current Account'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 3. Nov 2025 - Bill A (Cash Full)
    {
      invNum: 'JRE-000003',
      date: new Date('2025-11-08T10:15:00Z'),
      customer: customers[5],
      items: [
        { product: products[0], qty: 1, priceMinor: 180000 },
        { product: products[3], qty: 2, priceMinor: 65000 },
      ],
      payMethod: 'CASH',
      payAccount: paymentAccounts['Shop Cash Counter Drawer'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 4. Nov 2025 - Bill B (Partial)
    {
      invNum: 'JRE-000004',
      date: new Date('2025-11-25T16:00:00Z'),
      customer: customers[2],
      items: [
        { product: products[2], qty: 1, priceMinor: 750000 },
        { product: products[1], qty: 1, priceMinor: 350000 },
      ],
      payMethod: 'BANK_TRANSFER',
      payAccount: paymentAccounts['ICICI Business Account'],
      payStatus: 'PARTIALLY_PAID',
      paidPortion: 0.6, // Paid 60%
    },
    // 5. Dec 2025 - Bill A (UPI Full)
    {
      invNum: 'JRE-000005',
      date: new Date('2025-12-12T14:20:00Z'),
      customer: customers[3],
      items: [
        { product: products[1], qty: 1, priceMinor: 350000 },
        { product: products[5], qty: 1, priceMinor: 280000 },
      ],
      payMethod: 'UPI',
      payAccount: paymentAccounts['Shop GPay / PhonePe UPI'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 6. Dec 2025 - Bill B (Cheque Full)
    {
      invNum: 'JRE-000006',
      date: new Date('2025-12-28T17:30:00Z'),
      customer: customers[1],
      items: [
        { product: products[2], qty: 2, priceMinor: 750000 },
        { product: products[0], qty: 2, priceMinor: 180000 },
      ],
      payMethod: 'CHEQUE',
      payAccount: paymentAccounts['HDFC Current Account'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 7. Jan 2026 - Bill A (UPI Full)
    {
      invNum: 'JRE-000007',
      date: new Date('2026-01-10T12:00:00Z'),
      customer: customers[4],
      items: [
        { product: products[4], qty: 2, priceMinor: 120000 },
        { product: products[3], qty: 1, priceMinor: 65000 },
      ],
      payMethod: 'UPI',
      payAccount: paymentAccounts['Shop GPay / PhonePe UPI'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 8. Jan 2026 - Bill B (Unpaid)
    {
      invNum: 'JRE-000008',
      date: new Date('2026-01-22T16:15:00Z'),
      customer: customers[2],
      items: [
        { product: products[1], qty: 1, priceMinor: 350000 },
        { product: products[5], qty: 1, priceMinor: 280000 },
      ],
      payMethod: 'BANK_TRANSFER',
      payAccount: paymentAccounts['HDFC Current Account'],
      payStatus: 'UNPAID',
      paidPortion: 0,
    },
    // 9. Feb 2026 - Bill A (Bank Full)
    {
      invNum: 'JRE-000009',
      date: new Date('2026-02-05T11:00:00Z'),
      customer: customers[3],
      items: [
        { product: products[2], qty: 1, priceMinor: 750000 },
        { product: products[0], qty: 1, priceMinor: 180000 },
      ],
      payMethod: 'BANK_TRANSFER',
      payAccount: paymentAccounts['ICICI Business Account'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 10. Feb 2026 - Bill B (Cash Full)
    {
      invNum: 'JRE-000010',
      date: new Date('2026-02-18T15:00:00Z'),
      customer: customers[5],
      items: [
        { product: products[0], qty: 2, priceMinor: 180000 },
        { product: products[3], qty: 1, priceMinor: 65000 },
      ],
      payMethod: 'CASH',
      payAccount: paymentAccounts['Shop Cash Counter Drawer'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 11. Mar 2026 - Bill A (UPI Full)
    {
      invNum: 'JRE-000011',
      date: new Date('2026-03-09T13:30:00Z'),
      customer: customers[0],
      items: [
        { product: products[1], qty: 2, priceMinor: 350000 },
        { product: products[5], qty: 2, priceMinor: 280000 },
        { product: products[4], qty: 1, priceMinor: 120000 },
      ],
      payMethod: 'UPI',
      payAccount: paymentAccounts['Shop GPay / PhonePe UPI'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 12. Mar 2026 - Bill B (Partial)
    {
      invNum: 'JRE-000012',
      date: new Date('2026-03-24T18:00:00Z'),
      customer: customers[4],
      items: [
        { product: products[2], qty: 1, priceMinor: 750000 },
        { product: products[0], qty: 1, priceMinor: 180000 },
      ],
      payMethod: 'BANK_TRANSFER',
      payAccount: paymentAccounts['HDFC Current Account'],
      payStatus: 'PARTIALLY_PAID',
      paidPortion: 0.5, // 50% paid
    },
    // 13. Apr 2026 - Bill A (UPI Full)
    {
      invNum: 'JRE-000013',
      date: new Date('2026-04-11T10:45:00Z'),
      customer: customers[1],
      items: [
        { product: products[0], qty: 2, priceMinor: 180000 },
        { product: products[4], qty: 1, priceMinor: 120000 },
      ],
      payMethod: 'UPI',
      payAccount: paymentAccounts['Shop GPay / PhonePe UPI'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 14. Apr 2026 - Bill B (Unpaid)
    {
      invNum: 'JRE-000014',
      date: new Date('2026-04-26T16:30:00Z'),
      customer: customers[2],
      items: [
        { product: products[2], qty: 1, priceMinor: 750000 },
        { product: products[1], qty: 1, priceMinor: 350000 },
      ],
      payMethod: 'BANK_TRANSFER',
      payAccount: paymentAccounts['HDFC Current Account'],
      payStatus: 'UNPAID',
      paidPortion: 0,
    },
    // 15. May 2026 - Bill A (Bank Full)
    {
      invNum: 'JRE-000015',
      date: new Date('2026-05-14T14:00:00Z'),
      customer: customers[3],
      items: [
        { product: products[1], qty: 3, priceMinor: 350000 },
        { product: products[5], qty: 2, priceMinor: 280000 },
      ],
      payMethod: 'BANK_TRANSFER',
      payAccount: paymentAccounts['ICICI Business Account'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 16. Jun 2026 - Bill A (QR Full)
    {
      invNum: 'JRE-000016',
      date: new Date('2026-06-08T11:20:00Z'),
      customer: customers[5],
      items: [
        { product: products[0], qty: 2, priceMinor: 180000 },
        { product: products[5], qty: 1, priceMinor: 280000 },
      ],
      payMethod: 'QR_CODE',
      payAccount: paymentAccounts['Shop GPay / PhonePe UPI'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 17. Jul 2026 - Bill A (Partial)
    {
      invNum: 'JRE-000017',
      date: new Date('2026-07-16T15:10:00Z'),
      customer: customers[0],
      items: [
        { product: products[2], qty: 2, priceMinor: 750000 },
        { product: products[4], qty: 1, priceMinor: 120000 },
      ],
      payMethod: 'BANK_TRANSFER',
      payAccount: paymentAccounts['HDFC Current Account'],
      payStatus: 'PARTIALLY_PAID',
      paidPortion: 0.65,
    },
    // 18. Aug 2026 (Current Month) - Bill A (UPI Full)
    {
      invNum: 'JRE-000018',
      date: new Date('2026-08-10T10:30:00Z'),
      customer: customers[1],
      items: [
        { product: products[1], qty: 1, priceMinor: 350000 },
        { product: products[0], qty: 1, priceMinor: 180000 },
        { product: products[3], qty: 1, priceMinor: 65000 },
      ],
      payMethod: 'UPI',
      payAccount: paymentAccounts['Shop GPay / PhonePe UPI'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
    // 19. Aug 2026 (Current Month) - Bill B (Unpaid Active Due)
    {
      invNum: 'JRE-000019',
      date: new Date('2026-08-22T14:15:00Z'),
      customer: customers[2],
      items: [
        { product: products[2], qty: 1, priceMinor: 750000 },
        { product: products[4], qty: 1, priceMinor: 120000 },
      ],
      payMethod: 'BANK_TRANSFER',
      payAccount: paymentAccounts['HDFC Current Account'],
      payStatus: 'UNPAID',
      paidPortion: 0,
    },
    // 20. Aug 2026 (Current Month) - Bill C (Cash Full Today)
    {
      invNum: 'JRE-000020',
      date: new Date('2026-08-30T09:45:00Z'),
      customer: customers[5],
      items: [
        { product: products[0], qty: 1, priceMinor: 180000 },
        { product: products[5], qty: 1, priceMinor: 280000 },
      ],
      payMethod: 'CASH',
      payAccount: paymentAccounts['Shop Cash Counter Drawer'],
      payStatus: 'PAID',
      paidPortion: 1,
    },
  ];

  for (const b of billsDataset) {
    let grandTotalMinor = 0;
    const items = b.items.map((it) => {
      const lineTotal = it.qty * it.priceMinor;
      grandTotalMinor += lineTotal;
      return {
        productId: it.product._id,
        type: it.product.type,
        description: it.product.name,
        uom: it.product.uom,
        quantity: it.qty,
        unitPriceMinor: it.priceMinor,
        taxableAmountMinor: lineTotal,
        taxes: [],
        taxAmountMinor: 0,
        lineTotalMinor: lineTotal,
      };
    });

    const paidAmountMinor = Math.round(grandTotalMinor * b.paidPortion);
    const dueAmountMinor = grandTotalMinor - paidAmountMinor;

    const invoiceDoc = await Invoice.create({
      businessId: business._id,
      invoiceNumber: b.invNum,
      invoiceDate: b.date,
      status: 'FINALIZED',
      currency: 'INR',
      customerId: b.customer._id,
      customerSnapshot: {
        name: b.customer.name,
        contact: b.customer.contact,
        address: b.customer.address,
      },
      businessSnapshot: {
        name: business.name,
        legalName: business.legalName,
        gstin: business.gstin,
      },
      items,
      totals: {
        subtotalMinor: grandTotalMinor,
        discountMinor: 0,
        taxableAmountMinor: grandTotalMinor,
        taxes: [],
        taxTotalMinor: 0,
        roundingMinor: 0,
        grandTotalMinor,
        currency: 'INR',
      },
      paymentSummary: {
        status: b.payStatus,
        paidAmountMinor,
        dueAmountMinor,
      },
      createdBy: user._id,
      finalizedBy: user._id,
      finalizedAt: b.date,
      createdAt: b.date,
      updatedAt: b.date,
    });

    if (paidAmountMinor > 0) {
      await Payment.create({
        businessId: business._id,
        invoiceId: invoiceDoc._id,
        amountMinor: paidAmountMinor,
        currency: 'INR',
        method: b.payMethod,
        paymentAccountId: b.payAccount?._id || null,
        paymentAccountSnapshot: b.payAccount
          ? {
              name: b.payAccount.name,
              displayName: b.payAccount.displayName,
              type: b.payAccount.type,
              upiId: b.payAccount.upiId || null,
              bankName: b.payAccount.bankName || null,
            }
          : null,
        referenceNumber: b.payMethod === 'UPI' ? `UPI/${b.date.getTime().toString().slice(-8)}` : null,
        paidAt: b.date,
        status: 'CONFIRMED',
        recordedBy: user._id,
        createdAt: b.date,
        updatedAt: b.date,
      });
    }
  }

  console.log(`✅ JayRamJi Database seeded with ${billsDataset.length} historical invoices and payments!`);
  console.log('----------------------------------------------------');
  console.log('👤 Primary Login Credentials:');
  console.log('   Email:    shopkeeper@jayramji.com  (or admin@jayramji.com)');
  console.log('   Password: password123');
  console.log('🏢 Business: Jay Ramji Enterprise');
  console.log(`📊 Invoices Generated: 20 bills across past 12 months`);
  console.log('----------------------------------------------------');
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding error:', err);
      process.exit(1);
    });
}
