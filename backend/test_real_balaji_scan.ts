import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from './src/config/env';
import { User } from './src/database/models/User';
import { Business } from './src/database/models/Business';
import { Purchase } from './src/database/models/Purchase';
import { purchaseScannerService } from './src/modules/purchase/scanner/purchaseScanner.service';
import { reconcilePurchaseExtraction } from './src/modules/purchase/validation/calculationComparator';

async function runRealBalajiScan() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('[Real Balaji Scan] Connected to DB.');

  // Find user and business
  let user = await User.findOne();
  if (!user) {
    user = await User.create({
      name: 'Owner Balaji',
      email: 'owner@balaji.com',
      passwordHash: 'hash_123',
      status: 'ACTIVE',
    });
  }

  let business = await Business.findOne();
  if (!business) {
    business = await Business.create({
      name: 'Jay Ram Ji Enterprise',
      legalName: 'Jay Ram Ji Enterprise Pvt Ltd',
      address: { line1: 'GIDC', city: 'Mundra', state: 'Gujarat', postalCode: '370421', country: 'India' },
      contact: { phone: '9825100001', email: 'biz@jayramji.com' },
      ownerId: user._id,
      active: true,
      status: 'ACTIVE',
      currency: 'INR',
    });
  }

  const imagePath = path.resolve(__dirname, 'shree_balaji_test.png');
  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(imagePath);
  console.log(`[Real Balaji Scan] Read ${fileBuffer.length} bytes from shree_balaji_test.png`);
  console.log(`[Real Balaji Scan] Starting scan with NVIDIA NIM...`);

  const startTime = Date.now();
  try {
    const draft = await purchaseScannerService.scanAndCreateDraft({
      businessId: business._id.toString(),
      userId: user._id.toString(),
      fileBuffer,
      fileName: 'shree_balaji_invoice.png',
      fileSize: fileBuffer.length,
      mimeType: 'image/png',
    });

    const totalDurationMs = Date.now() - startTime;
    console.log(`[Real Balaji Scan] Draft created successfully in ${totalDurationMs}ms: ${draft.draftNumber}`);

    const ext = draft.extraction;
    const raw = draft.rawExtraction;
    const recon = reconcilePurchaseExtraction(ext);

    console.log('\n============================================================');
    console.log('REAL SCAN RESULT REPORT (PHASE 5.12)');
    console.log('============================================================');

    console.log('1. RAW & NORMALIZED TAX FIELDS:');
    console.log('   Raw Summary Tax:', JSON.stringify({
      subtotal: raw?.summary?.subtotal?.value ?? (raw as any)?.summary?.subtotal,
      cgstRate: raw?.summary?.cgstRate?.value ?? (raw as any)?.summary?.cgstRate,
      cgst: raw?.summary?.cgstAmount?.value ?? (raw as any)?.summary?.cgst,
      sgstRate: raw?.summary?.sgstRate?.value ?? (raw as any)?.summary?.sgstRate,
      sgst: raw?.summary?.sgstAmount?.value ?? (raw as any)?.summary?.sgst,
      totalTax: raw?.summary?.totalTax?.value ?? (raw as any)?.summary?.totalTax,
      grandTotal: raw?.summary?.grandTotal?.value ?? (raw as any)?.summary?.grandTotal,
    }, null, 2));

    console.log('\n2. DOCUMENT GST CLASSIFICATION:');
    console.log(`   CGST Rate: ${draft.extraction?.summary?.cgstRate?.value ?? draft.extraction?.tax?.cgstRate}%`);
    console.log(`   SGST Rate: ${draft.extraction?.summary?.sgstRate?.value ?? draft.extraction?.tax?.sgstRate}%`);
    console.log(`   Total GST Rate: ${draft.extraction?.tax?.totalGstRate}%`);
    console.log(`   Tax Source: ${draft.extraction?.tax?.source}`);
    console.log(`   Tax Evidence Type: ${draft.extraction?.tax?.evidenceType}`);
    console.log(`   Tax Extraction Status: ${draft.extraction?.summary?.taxExtractionStatus}`);

    console.log('\n3. INCLUSIVE / EXCLUSIVE CLASSIFICATION:');
    console.log(`   Tax Mode: ${draft.extraction?.tax?.taxInclusionMode}`);

    console.log('\n4. EXTRACTED LINES:');
    ext.items.forEach((item, idx) => {
      console.log(`   Line ${idx + 1}: ${item.description.value}`);
      console.log(`     Qty: ${item.quantity.value} | Unit: ${item.unit.value} | Unit Price: ₹${item.unitPrice.value}`);
      console.log(`     Printed Taxable: ₹${item.taxableAmount.value} | Line Total: ₹${item.lineTotal.value}`);
      console.log(`     GST Rate: ${item.gstRate.value}% (CGST ${item.cgstRate.value}% + SGST ${item.sgstRate.value}%) | Source: ${item.taxSource}`);
    });

    console.log('\n5. FINANCIAL TOTALS & RECONCILIATION:');
    console.log(`   Bill Subtotal: ₹${ext.summary.subtotal.value}`);
    console.log(`   Calculated Subtotal: ₹${recon.calculatedSubtotal}`);
    console.log(`   CGST: ₹${recon.calculatedCgstAmount} (Printed: ₹${ext.summary.cgstAmount.value})`);
    console.log(`   SGST: ₹${recon.calculatedSgstAmount} (Printed: ₹${ext.summary.sgstAmount.value})`);
    console.log(`   Total GST: ₹${recon.calculatedTaxTotal} (Printed: ₹${ext.summary.totalTax.value})`);
    console.log(`   Bill Grand Total: ₹${ext.summary.grandTotal.value}`);
    console.log(`   Current Calculated Grand Total: ₹${recon.calculatedGrandTotal}`);
    const difference = Math.abs(recon.calculatedGrandTotal - (ext.summary.grandTotal.value || 0));
    console.log(`   Difference: ₹${difference}`);
    console.log(`   Math Valid: ${recon.isMathValid}`);

    console.log('\n6. NIM PERFORMANCE METRICS:');
    console.log(`   Total Scan Duration: ${totalDurationMs}ms`);
    console.log(`   NIM Attempt Count: ${(draft as any).extraction?.metadata?.nimAttemptCount ?? 'N/A'}`);
    console.log(`   Per-Attempt Durations: ${JSON.stringify((draft as any).extraction?.metadata?.nimAttemptDurations ?? [])}`);

    process.exit(0);
  } catch (err: any) {
    const totalDurationMs = Date.now() - startTime;
    console.error(`\n[Real Balaji Scan] Scan failed after ${totalDurationMs}ms!`);
    console.error(`Error: ${err.message}`);
    console.error(`Error Code: ${err.errorCode || err.code || 'UNKNOWN'}`);
    if (err.details) {
      console.error('Error Details:', JSON.stringify(err.details, null, 2));
    }
    // Verify zero side effects
    const purchaseCount = await Purchase.countDocuments({ businessId: business._id });
    console.log(`Side Effects Check - Purchases created: ${purchaseCount} (Expected: 0)`);
    process.exit(0); // Exit cleanly for reporting
  }
}

runRealBalajiScan();
