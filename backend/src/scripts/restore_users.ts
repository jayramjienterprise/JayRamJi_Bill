import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

async function restoreUsers() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to Atlas:', uri ? uri.substring(0, 30) + '...' : 'NONE');
  await mongoose.connect(uri!);
  const db = mongoose.connection.db!;

  const newSecurePassword = 'JayRamJi@2026Secure!';
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(newSecurePassword, saltRounds);

  // Business 1: "Jay Ramji Enterprise" (39 invoices, customers, products, AMC, purchases)
  // Owner ID: 6a940427e080799ac47693a4 -> shopkeeper@jayramji.com
  const b1 = new Types.ObjectId('6a940428e080799ac47693b0');
  const idShopkeeper = new Types.ObjectId('6a940427e080799ac47693a4');

  // Business 2: "Jay Ramji enterprise's Shop" (6 invoices)
  // Owner ID: 6a96462930a941933679e8ee -> jayramjienterprise@gmail.com
  const b2 = new Types.ObjectId('6a96462930a941933679e8f0');
  const idJayRamJiOwner = new Types.ObjectId('6a96462930a941933679e8ee');

  const usersToRestore = [
    {
      _id: idShopkeeper,
      name: 'Jay Ramji Shopkeeper',
      email: 'shopkeeper@jayramji.com',
      phone: '+91 98765 43210',
      passwordHash,
      status: 'ACTIVE',
      createdAt: new Date('2025-08-01T00:00:00Z'),
      updatedAt: new Date(),
    },
    {
      _id: idJayRamJiOwner,
      name: 'Jay Ramji Enterprise Owner',
      email: 'jayramjienterprise@gmail.com',
      phone: '84693 26901',
      passwordHash,
      status: 'ACTIVE',
      createdAt: new Date('2025-08-01T00:00:00Z'),
      updatedAt: new Date(),
    },
    {
      _id: new Types.ObjectId('6a940427e080799ac47693aa'),
      name: 'Jay Ramji Administrator',
      email: 'admin@jayramji.com',
      phone: null,
      passwordHash,
      status: 'ACTIVE',
      createdAt: new Date('2025-08-01T00:00:00Z'),
      updatedAt: new Date(),
    },
    {
      _id: new Types.ObjectId('6aa315bda44d2298fb7a6b40'),
      name: 'Ramesh Kumar (Lead Technician)',
      email: 'ramesh.tech@jayramji.com',
      phone: '+91 98765 11223',
      passwordHash,
      status: 'ACTIVE',
      createdAt: new Date('2025-08-01T00:00:00Z'),
      updatedAt: new Date(),
    },
    {
      _id: new Types.ObjectId('6aa315bda44d2298fb7a6b47'),
      name: 'Suresh Sharma (HVAC Specialist)',
      email: 'suresh.tech@jayramji.com',
      phone: '+91 98250 44556',
      passwordHash,
      status: 'ACTIVE',
      createdAt: new Date('2025-08-01T00:00:00Z'),
      updatedAt: new Date(),
    },
  ];

  console.log('Clearing old swapped user docs to avoid unique key collisions...');
  await db.collection('users').deleteMany({
    _id: { $in: usersToRestore.map(u => u._id) },
  });

  console.log('Inserting correct individual user docs...');
  await db.collection('users').insertMany(usersToRestore);
  usersToRestore.forEach(u => console.log(`✅ User created: ${u.email} -> ID: ${u._id.toString()}`));

  // Strictly individual business memberships (no cross-linking):
  // 1. shopkeeper@jayramji.com belongs exclusively to Business 1 ("Jay Ramji Enterprise", 39 invoices)
  // 2. jayramjienterprise@gmail.com belongs exclusively to Business 2 ("Jay Ramji enterprise's Shop", 6 invoices)
  console.log('\nConfiguring strict individual business memberships (no cross-linking)...');

  // Clean up any cross-linking
  const removedCrossLinks = await db.collection('business_members').deleteMany({
    $or: [
      { userId: idShopkeeper, businessId: b2 },
      { userId: idJayRamJiOwner, businessId: b1 },
    ],
  });
  console.log(`Removed cross-linked memberships count: ${removedCrossLinks.deletedCount}`);

  // Ensure shopkeeper@jayramji.com is OWNER of Business 1
  await db.collection('business_members').updateOne(
    { businessId: b1, userId: idShopkeeper },
    {
      $set: {
        role: 'OWNER',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
  console.log(`✅ Membership: shopkeeper@jayramji.com (${idShopkeeper}) -> Jay Ramji Enterprise (${b1}) [OWNER]`);

  // Ensure jayramjienterprise@gmail.com is OWNER of Business 2
  await db.collection('business_members').updateOne(
    { businessId: b2, userId: idJayRamJiOwner },
    {
      $set: {
        role: 'OWNER',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
  console.log(`✅ Membership: jayramjienterprise@gmail.com (${idJayRamJiOwner}) -> Jay Ramji enterprise's Shop (${b2}) [OWNER]`);

  console.log('\n--- VERIFYING INDIVIDUAL ACCOUNTS ---');
  const allMembers = await db.collection('business_members').find({}).toArray();
  for (const m of allMembers) {
    const user = await db.collection('users').findOne({ _id: m.userId });
    const biz = await db.collection('businesses').findOne({ _id: m.businessId });
    console.log(`- Member: ${user?.email} (${m.role}) -> Business: ${biz?.name}`);
  }

  await mongoose.disconnect();
  console.log('\n🎉 Successfully updated accounts to their actual individual data!');
}

restoreUsers().catch(console.error);
