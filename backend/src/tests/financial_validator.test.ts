import {
  validateLineItem,
  validateInvoice,
  determineTaxMode,
  DEFAULT_FINANCIAL_TOLERANCE_RUPEES,
  toPaise,
  toRupees,
  compareAmounts,
} from '../modules/purchase/validation/financialValidator';
import { reconcilePurchaseExtraction } from '../modules/purchase/validation/calculationComparator';
import { IPurchaseBillExtraction } from '../database/models/PurchaseDraft';

describe('Phase 2B — Deterministic Financial Validation Engine', () => {
  describe('A. Internal Monetary Representation (Rupees <-> Integer Paise)', () => {
    it('should accurately convert decimal rupees to integer paise without floating point error', () => {
      expect(toPaise(100.1)).toBe(10010);
      expect(toPaise(0.05)).toBe(5);
      expect(toPaise(1234.56)).toBe(123456);
      expect(toPaise(null)).toBe(0);
      expect(toPaise(undefined)).toBe(0);
    });

    it('should accurately convert integer paise back to decimal rupees', () => {
      expect(toRupees(10010)).toBe(100.1);
      expect(toRupees(5)).toBe(0.05);
      expect(toRupees(123456)).toBe(1234.56);
    });

    it('should use default named tolerance constant of ₹0.05', () => {
      expect(DEFAULT_FINANCIAL_TOLERANCE_RUPEES).toBe(0.05);
      const res = compareAmounts(100.04, 10000); // Diff is ₹0.04 <= ₹0.05
      expect(res.status).toBe('MATCH');
    });
  });

  describe('B. 25 Specified Financial Calculation & Tax Tests', () => {
    // TEST 1: Qty 10 × ₹100, GST 18%, CGST 9%, SGST 9% => Expected total ₹1180
    it('TEST 1: Qty 10 × ₹100, GST 18%, CGST 9%, SGST 9% -> Expected total ₹1180', () => {
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100,
          cgstRate: 9,
          cgstAmount: 90,
          sgstRate: 9,
          sgstAmount: 90,
          lineTotal: 1180,
        },
        { taxMode: 'INTRA_STATE' }
      );

      expect(result.status).toBe('MATCH');
      expect(result.isMathValid).toBe(true);
      expect(result.calculated.grossAmount).toBe(1000);
      expect(result.calculated.taxableAmount).toBe(1000);
      expect(result.calculated.cgstAmount).toBe(90);
      expect(result.calculated.sgstAmount).toBe(90);
      expect(result.calculated.totalTax).toBe(180);
      expect(result.calculated.lineTotal).toBe(1180);
    });

    // TEST 2: Qty 10 × ₹100, IGST 18% => Expected total ₹1180
    it('TEST 2: Qty 10 × ₹100, IGST 18% -> Expected total ₹1180', () => {
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100,
          igstRate: 18,
          igstAmount: 180,
          lineTotal: 1180,
        },
        { taxMode: 'INTER_STATE' }
      );

      expect(result.status).toBe('MATCH');
      expect(result.isMathValid).toBe(true);
      expect(result.calculated.grossAmount).toBe(1000);
      expect(result.calculated.igstAmount).toBe(180);
      expect(result.calculated.cgstAmount).toBe(0);
      expect(result.calculated.sgstAmount).toBe(0);
      expect(result.calculated.lineTotal).toBe(1180);
    });

    // TEST 3: Discount percentage
    it('TEST 3: Discount percentage calculation (10% discount on ₹1000 gross)', () => {
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100,
          discountPercent: 10,
          taxableAmount: 900,
          gstRate: 18,
          cgstRate: 9,
          cgstAmount: 81,
          sgstRate: 9,
          sgstAmount: 81,
          lineTotal: 1062,
        },
        { taxMode: 'INTRA_STATE' }
      );

      expect(result.status).toBe('MATCH');
      expect(result.calculated.grossAmount).toBe(1000);
      expect(result.calculated.discountAmount).toBe(100);
      expect(result.calculated.taxableAmount).toBe(900);
      expect(result.calculated.lineTotal).toBe(1062);
    });

    // TEST 4: Printed discount amount differs from calculated discount
    it('TEST 4: Printed discount amount differs from calculated discount', () => {
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100,
          discountPercent: 10, // expects ₹100
          discountAmount: 150, // printed ₹150 (differs!)
          lineTotal: 1003,
        },
        { taxMode: 'INTRA_STATE' }
      );

      expect(result.status).toBe('MISMATCH');
      expect(result.comparisons.discount?.status).toBe('MISMATCH');
      expect(result.messages.some((m) => m.includes('Printed discount (150) does not match'))).toBe(true);
    });

    // TEST 5: CGST amount mismatch
    it('TEST 5: CGST amount mismatch', () => {
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100,
          cgstRate: 9,
          cgstAmount: 100, // Expected 90, printed 100
          sgstRate: 9,
          sgstAmount: 90,
          lineTotal: 1180,
        },
        { taxMode: 'INTRA_STATE' }
      );

      expect(result.status).toBe('MISMATCH');
      expect(result.comparisons.cgst?.status).toBe('MISMATCH');
      expect(result.comparisons.cgst?.difference).toBe(10);
    });

    // TEST 6: SGST amount mismatch
    it('TEST 6: SGST amount mismatch', () => {
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100,
          cgstRate: 9,
          cgstAmount: 90,
          sgstRate: 9,
          sgstAmount: 95, // Expected 90, printed 95
          lineTotal: 1180,
        },
        { taxMode: 'INTRA_STATE' }
      );

      expect(result.status).toBe('MISMATCH');
      expect(result.comparisons.sgst?.status).toBe('MISMATCH');
      expect(result.comparisons.sgst?.difference).toBe(5);
    });

    // TEST 7: IGST amount mismatch
    it('TEST 7: IGST amount mismatch', () => {
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100,
          igstRate: 18,
          igstAmount: 200, // Expected 180, printed 200
          lineTotal: 1180,
        },
        { taxMode: 'INTER_STATE' }
      );

      expect(result.status).toBe('MISMATCH');
      expect(result.comparisons.igst?.status).toBe('MISMATCH');
      expect(result.comparisons.igst?.difference).toBe(20);
    });

    // TEST 8: CESS amount
    it('TEST 8: CESS amount validation', () => {
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100, // gross ₹1000
          cgstRate: 14,
          cgstAmount: 140,
          sgstRate: 14,
          sgstAmount: 140,
          cessRate: 12,
          cessAmount: 120, // 12% of ₹1000 = ₹120
          lineTotal: 1400,
        },
        { taxMode: 'INTRA_STATE' }
      );

      expect(result.status).toBe('MATCH');
      expect(result.calculated.cessAmount).toBe(120);
      expect(result.calculated.lineTotal).toBe(1400);
    });

    // TEST 9: Line rounding difference <= ₹0.05
    it('TEST 9: Line rounding difference <= ₹0.05 is accepted as MATCH', () => {
      // Calculated: ₹1000 + 18% = ₹1180.00
      // Printed: ₹1180.03 (difference = ₹0.03 <= ₹0.05)
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100,
          gstRate: 18,
          lineTotal: 1180.03,
        },
        { taxMode: 'INTER_STATE' }
      );

      expect(result.status).toBe('MATCH');
      expect(result.isMathValid).toBe(true);
      expect(result.comparisons.lineTotal.status).toBe('MATCH');
      expect(result.comparisons.lineTotal.difference).toBe(0.03);
    });

    // TEST 10: Line difference > ₹0.05
    it('TEST 10: Line difference > ₹0.05 is flagged as MISMATCH', () => {
      // Calculated: ₹1180.00, Printed: ₹1180.15 (diff = ₹0.15 > ₹0.05)
      const result = validateLineItem(
        {
          quantity: 10,
          unitPrice: 100,
          gstRate: 18,
          lineTotal: 1180.15,
        },
        { taxMode: 'INTER_STATE' }
      );

      expect(result.status).toBe('MISMATCH');
      expect(result.isMathValid).toBe(false);
      expect(result.comparisons.lineTotal.status).toBe('MISMATCH');
    });

    // TEST 11: Invoice grand total mismatch
    it('TEST 11: Invoice grand total mismatch', () => {
      const inv = validateInvoice({
        lines: [
          { quantity: 1, unitPrice: 1000, igstRate: 18, lineTotal: 1180 },
        ],
        totals: {
          subtotal: 1000,
          grandTotal: 1250, // Expected 1180, printed 1250
        },
      });

      expect(inv.status).toBe('MISMATCH');
      expect(inv.comparisons.grandTotal.status).toBe('MISMATCH');
      expect(inv.comparisons.grandTotal.difference).toBe(70);
    });

    // TEST 12: Round-off positive
    it('TEST 12: Round-off positive (e.g. calculated ₹100.40, round-off +₹0.60 -> ₹101)', () => {
      const inv = validateInvoice({
        lines: [
          { quantity: 1, unitPrice: 100.4, lineTotal: 100.4 },
        ],
        totals: {
          subtotal: 100.4,
          roundOff: 0.6,
          grandTotal: 101,
        },
      });

      expect(inv.status).toBe('MATCH');
      expect(inv.calculated.roundOff).toBe(0.6);
      expect(inv.calculated.grandTotal).toBe(101);
    });

    // TEST 13: Round-off negative
    it('TEST 13: Round-off negative (e.g. calculated ₹100.47, round-off -₹0.47 -> ₹100)', () => {
      const inv = validateInvoice({
        lines: [
          { quantity: 1, unitPrice: 100.47, lineTotal: 100.47 },
        ],
        totals: {
          subtotal: 100.47,
          roundOff: -0.47,
          grandTotal: 100,
        },
      });

      expect(inv.status).toBe('MATCH');
      expect(inv.calculated.roundOff).toBe(-0.47);
      expect(inv.calculated.grandTotal).toBe(100);
    });

    // TEST 14: Missing quantity
    it('TEST 14: Missing quantity returns INSUFFICIENT_DATA without guessing', () => {
      const result = validateLineItem({
        quantity: null,
        unitPrice: 100,
        lineTotal: 100,
      });

      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.isMathValid).toBe(false);
      expect(result.messages[0]).toContain('Quantity is missing');
    });

    // TEST 15: Missing unit price
    it('TEST 15: Missing unit price returns INSUFFICIENT_DATA without guessing', () => {
      const result = validateLineItem({
        quantity: 5,
        unitPrice: null,
        lineTotal: 500,
      });

      expect(result.status).toBe('INSUFFICIENT_DATA');
      expect(result.isMathValid).toBe(false);
      expect(result.messages[0]).toContain('Unit price is missing');
    });

    // TEST 16: Zero quantity
    it('TEST 16: Zero quantity returns INVALID_DATA', () => {
      const result = validateLineItem({
        quantity: 0,
        unitPrice: 100,
        lineTotal: 0,
      });

      expect(result.status).toBe('INVALID_DATA');
      expect(result.messages[0]).toContain('Quantity must be greater than zero');
    });

    // TEST 17: Negative quantity
    it('TEST 17: Negative quantity returns INVALID_DATA', () => {
      const result = validateLineItem({
        quantity: -2,
        unitPrice: 100,
        lineTotal: -200,
      });

      expect(result.status).toBe('INVALID_DATA');
      expect(result.messages[0]).toContain('Quantity cannot be negative');
    });

    // TEST 18: Negative price
    it('TEST 18: Negative price returns INVALID_DATA', () => {
      const result = validateLineItem({
        quantity: 2,
        unitPrice: -50,
        lineTotal: -100,
      });

      expect(result.status).toBe('INVALID_DATA');
      expect(result.messages[0]).toContain('Unit price cannot be negative');
    });

    // TEST 19: Multiple line items
    it('TEST 19: Multiple line items aggregated correctly in invoice totals', () => {
      const inv = validateInvoice({
        lines: [
          { quantity: 2, unitPrice: 500, igstRate: 18, igstAmount: 180, lineTotal: 1180 },
          { quantity: 4, unitPrice: 250, igstRate: 18, igstAmount: 180, lineTotal: 1180 },
        ],
        totals: {
          subtotal: 2000,
          igstAmount: 360,
          totalTax: 360,
          grandTotal: 2360,
        },
      });

      expect(inv.status).toBe('MATCH');
      expect(inv.calculated.subtotal).toBe(2000);
      expect(inv.calculated.igstAmount).toBe(360);
      expect(inv.calculated.grandTotal).toBe(2360);
    });

    // TEST 20: Different GST rates across line items
    it('TEST 20: Different GST rates across line items (e.g. 18% and 5%)', () => {
      const inv = validateInvoice({
        lines: [
          { quantity: 1, unitPrice: 1000, igstRate: 18, igstAmount: 180, lineTotal: 1180 }, // Item 1 @ 18%
          { quantity: 2, unitPrice: 500, igstRate: 5, igstAmount: 50, lineTotal: 1050 },    // Item 2 @ 5%
        ],
        totals: {
          subtotal: 2000,
          igstAmount: 230,
          totalTax: 230,
          grandTotal: 2230,
        },
      });

      expect(inv.status).toBe('MATCH');
      expect(inv.calculated.subtotal).toBe(2000);
      expect(inv.calculated.totalTax).toBe(230);
      expect(inv.calculated.grandTotal).toBe(2230);
    });

    // TEST 21: Invoice with explicit CGST/SGST components
    it('TEST 21: Invoice with explicit CGST/SGST components', () => {
      const taxMode = determineTaxMode({
        lines: [
          { quantity: 1, unitPrice: 1000, cgstRate: 9, cgstAmount: 90, sgstRate: 9, sgstAmount: 90, lineTotal: 1180 },
        ],
      });

      expect(taxMode).toBe('INTRA_STATE');
    });

    // TEST 22: Invoice with explicit IGST
    it('TEST 22: Invoice with explicit IGST', () => {
      const taxMode = determineTaxMode({
        lines: [
          { quantity: 1, unitPrice: 1000, igstRate: 18, igstAmount: 180, lineTotal: 1180 },
        ],
      });

      expect(taxMode).toBe('INTER_STATE');
    });

    // TEST 23: Ambiguous tax mode
    it('TEST 23: Ambiguous tax mode returns UNKNOWN without guessing', () => {
      const taxMode = determineTaxMode({
        lines: [
          { quantity: 1, unitPrice: 1000, gstRate: 18, lineTotal: 1180 },
        ],
        // No explicit CGST/SGST, no IGST, no state info
      });

      expect(taxMode).toBe('UNKNOWN');
    });

    // TEST 24: No GST / tax-exempt line
    it('TEST 24: No GST / tax-exempt line (GST 0%, tax 0 -> lineTotal = taxable)', () => {
      const result = validateLineItem(
        {
          quantity: 5,
          unitPrice: 200,
          gstRate: 0,
          lineTotal: 1000,
        },
        { taxMode: 'INTRA_STATE' }
      );

      expect(result.status).toBe('MATCH');
      expect(result.calculated.totalTax).toBe(0);
      expect(result.calculated.lineTotal).toBe(1000);
    });

    // TEST 25: CESS present
    it('TEST 25: CESS present (percentage and fixed amount both validated)', () => {
      const result = validateLineItem(
        {
          quantity: 1,
          unitPrice: 10000,
          cgstRate: 14,
          cgstAmount: 1400,
          sgstRate: 14,
          sgstAmount: 1400,
          cessRate: 15,
          cessAmount: 1500, // 15% of 10,000 = 1500
          lineTotal: 14300,
        },
        { taxMode: 'INTRA_STATE' }
      );

      expect(result.status).toBe('MATCH');
      expect(result.calculated.cessAmount).toBe(1500);
      expect(result.calculated.lineTotal).toBe(14300);
    });
  });

  describe('C. Calculation Comparator & Reconciliation Integration', () => {
    it('should reconcile complete extraction without modifying printed numbers', () => {
      const sampleExtraction: IPurchaseBillExtraction = {
        supplier: {
          name: { value: 'Schneider Electric', confidence: 0.99, status: 'EXTRACTED' },
          gstin: { value: '24AAACS1234A1Z1', confidence: 0.99, status: 'EXTRACTED' },
          pan: { value: 'AAACS1234A', confidence: 0.95, status: 'EXTRACTED' },
          address: { value: 'Vadodara', confidence: 0.9, status: 'EXTRACTED' },
          city: { value: 'Vadodara', confidence: 0.9, status: 'EXTRACTED' },
          state: { value: 'Gujarat', confidence: 0.95, status: 'EXTRACTED' },
          stateCode: { value: '24', confidence: 0.95, status: 'EXTRACTED' },
          pincode: { value: '390001', confidence: 0.9, status: 'EXTRACTED' },
          phone: { value: '9825100000', confidence: 0.85, status: 'EXTRACTED' },
          email: { value: 'sales@schneider.com', confidence: 0.85, status: 'EXTRACTED' },
        },
        invoice: {
          invoiceNumber: { value: 'INV-SE-991', confidence: 0.98, status: 'EXTRACTED' },
          invoiceDate: { value: '2026-09-18', confidence: 0.98, status: 'EXTRACTED' },
          dueDate: { value: '2026-10-18', confidence: 0.9, status: 'EXTRACTED' },
          poNumber: { value: 'PO-11', confidence: 0.9, status: 'EXTRACTED' },
          ewayBillNumber: { value: '112233445566', confidence: 0.9, status: 'EXTRACTED' },
          placeOfSupply: { value: 'Gujarat', confidence: 0.95, status: 'EXTRACTED' },
          isReverseCharge: { value: false, confidence: 0.99, status: 'EXTRACTED' },
        },
        items: [
          {
            id: 'line-1',
            lineNumber: 1,
            description: { value: 'Circuit Breaker 63A', confidence: 0.98, status: 'EXTRACTED' },
            skuOrCode: { value: 'MCB-63A', confidence: 0.95, status: 'EXTRACTED' },
            hsnSac: { value: '8536', confidence: 0.95, status: 'EXTRACTED' },
            quantity: { value: 10, confidence: 0.99, status: 'EXTRACTED' },
            unit: { value: 'NOS', confidence: 0.95, status: 'EXTRACTED' },
            unitPrice: { value: 450, confidence: 0.98, status: 'EXTRACTED' }, // 10 * 450 = 4500
            discountPercent: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            discountAmount: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
            taxableAmount: { value: 4500, confidence: 0.98, status: 'EXTRACTED' },
            gstRate: { value: 18, confidence: 0.98, status: 'EXTRACTED' },
            cgstRate: { value: 9, confidence: 0.95, status: 'EXTRACTED' },
            cgstAmount: { value: 405, confidence: 0.95, status: 'EXTRACTED' },
            sgstRate: { value: 9, confidence: 0.95, status: 'EXTRACTED' },
            sgstAmount: { value: 405, confidence: 0.95, status: 'EXTRACTED' },
            igstRate: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
            igstAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
            cessRate: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
            cessAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
            lineTotal: { value: 5310, confidence: 0.99, status: 'EXTRACTED' },
          },
        ],
        summary: {
          subtotal: { value: 4500, confidence: 0.98, status: 'EXTRACTED' },
          totalDiscount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
          taxableAmount: { value: 4500, confidence: 0.98, status: 'EXTRACTED' },
          cgstAmount: { value: 405, confidence: 0.95, status: 'EXTRACTED' },
          sgstAmount: { value: 405, confidence: 0.95, status: 'EXTRACTED' },
          igstAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
          cessAmount: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
          totalTax: { value: 810, confidence: 0.98, status: 'EXTRACTED' },
          roundOff: { value: 0, confidence: 0.95, status: 'EXTRACTED' },
          grandTotal: { value: 5310, confidence: 0.99, status: 'EXTRACTED' },
          amountPaid: { value: 0, confidence: 0.9, status: 'EXTRACTED' },
          balanceDue: { value: 5310, confidence: 0.95, status: 'EXTRACTED' },
        },
        payment: {
          paymentMode: { value: 'BANK_TRANSFER', confidence: 0.9, status: 'EXTRACTED' },
          bankName: { value: 'ICICI Bank', confidence: 0.9, status: 'EXTRACTED' },
          bankAccountNumber: { value: '1234567890', confidence: 0.9, status: 'EXTRACTED' },
          bankIfsc: { value: 'ICIC0001234', confidence: 0.9, status: 'EXTRACTED' },
          upiId: { value: null, confidence: 0, status: 'MISSING' },
          transactionReference: { value: null, confidence: 0, status: 'MISSING' },
        },
        additional: {
          notes: { value: 'Warranty 1 year', confidence: 0.9, status: 'EXTRACTED' },
          termsAndConditions: { value: 'Net 30', confidence: 0.9, status: 'EXTRACTED' },
          vehicleNumber: { value: null, confidence: 0, status: 'MISSING' },
        },
      };

      const reconciliation = reconcilePurchaseExtraction(sampleExtraction, {
        buyerState: 'Gujarat',
      });

      expect(reconciliation.isMathValid).toBe(true);
      expect(reconciliation.hasDiscrepancies).toBe(false);
      expect(reconciliation.discrepancyNotes).toHaveLength(0);
      expect(reconciliation.calculatedSubtotal).toBe(4500);
      expect(reconciliation.calculatedTaxTotal).toBe(810);
      expect(reconciliation.calculatedGrandTotal).toBe(5310);
      expect(reconciliation.lineDiscrepancies[0].hasDiscrepancy).toBe(false);

      // Verify printed extraction was completely untouched
      expect(sampleExtraction.items[0].lineTotal.value).toBe(5310);
      expect(sampleExtraction.summary.grandTotal.value).toBe(5310);
    });
  });

  describe('D. Phase 2B.1 — Tax Mode Precedence & Conflict Tests', () => {
    // 1. CGST+SGST with matching states
    it('should return INTRA_STATE for CGST+SGST with matching states', () => {
      const mode = determineTaxMode({
        lines: [{ quantity: 1, unitPrice: 100, cgstRate: 9, sgstRate: 9 }],
        supplierState: 'Gujarat',
        buyerState: 'Gujarat',
      });
      expect(mode).toBe('INTRA_STATE');
    });

    // 2. CGST+SGST with differing states: printed tax components take precedence
    it('should return INTRA_STATE for CGST+SGST even with differing states (printed tax precedence)', () => {
      const mode = determineTaxMode({
        lines: [{ quantity: 1, unitPrice: 100, cgstRate: 9, sgstRate: 9 }],
        supplierState: 'Maharashtra',
        buyerState: 'Gujarat', // Differing states, but explicit CGST+SGST printed
      });
      expect(mode).toBe('INTRA_STATE');
    });

    // 3. IGST with matching states: printed tax components take precedence
    it('should return INTER_STATE for explicit IGST even with matching states (printed tax precedence)', () => {
      const mode = determineTaxMode({
        lines: [{ quantity: 1, unitPrice: 100, igstRate: 18 }],
        supplierState: 'Gujarat',
        buyerState: 'Gujarat', // Matching states, but explicit IGST printed
      });
      expect(mode).toBe('INTER_STATE');
    });

    // 4. IGST with differing states
    it('should return INTER_STATE for explicit IGST with differing states', () => {
      const mode = determineTaxMode({
        lines: [{ quantity: 1, unitPrice: 100, igstRate: 18 }],
        supplierState: 'Maharashtra',
        buyerState: 'Gujarat',
      });
      expect(mode).toBe('INTER_STATE');
    });

    // 5. Ambiguous state information (no explicit tax components and ambiguous states)
    it('should return UNKNOWN when tax components are absent and states are ambiguous', () => {
      const mode = determineTaxMode({
        lines: [{ quantity: 1, unitPrice: 100, gstRate: 18 }], // combined rate only, no split
        supplierState: null,
        buyerState: null,
      });
      expect(mode).toBe('UNKNOWN');
    });

    // 6. Contradictory CGST/SGST + IGST
    it('should return UNKNOWN and flag conflict when both CGST/SGST and IGST exist simultaneously', () => {
      const mode = determineTaxMode({
        lines: [
          { quantity: 1, unitPrice: 100, cgstRate: 9, sgstRate: 9, igstRate: 18 },
        ],
        supplierState: 'Gujarat',
        buyerState: 'Gujarat',
      });
      expect(mode).toBe('UNKNOWN');

      // Validating invoice with contradictory tax components flags warning
      const inv = validateInvoice({
        lines: [
          { quantity: 1, unitPrice: 100, cgstRate: 9, sgstRate: 9, igstRate: 18, lineTotal: 136 },
        ],
      });
      expect(inv.taxMode).toBe('UNKNOWN');
      expect(inv.status).toBe('MISMATCH');
      expect(inv.messages.some((m) => m.toLowerCase().includes('tax mode') || m.includes('UNKNOWN'))).toBe(true);
    });
  });

  describe('E. Phase 2B.1 — Rounding Test Coverage', () => {
    // 1. Per-line rounding
    it('should correctly validate per-line rounding without floating point drift', () => {
      // Qty 3 × 33.33 = 99.99
      // Tax 18% = 17.9982 -> rounded to 18.00 (1800 paise)
      // Line total = 99.99 + 18.00 = 117.99
      const result = validateLineItem(
        {
          quantity: 3,
          unitPrice: 33.33,
          igstRate: 18,
          lineTotal: 117.99,
        },
        { taxMode: 'INTER_STATE' }
      );

      expect(result.status).toBe('MATCH');
      expect(result.calculated.grossAmount).toBe(99.99);
      expect(result.calculated.igstAmount).toBe(18);
      expect(result.calculated.lineTotal).toBe(117.99);
    });

    // 2. Invoice-level rounding
    it('should support invoice-level rounding with small fractional delta', () => {
      // Line: Qty 1 × 100.46 = 100.46
      // Grand Total rounded to 100 with explicit round-off -0.46
      const inv = validateInvoice({
        lines: [{ quantity: 1, unitPrice: 100.46, lineTotal: 100.46 }],
        totals: {
          subtotal: 100.46,
          roundOff: -0.46,
          grandTotal: 100,
        },
      });

      expect(inv.status).toBe('MATCH');
      expect(inv.calculated.roundOff).toBe(-0.46);
      expect(inv.calculated.grandTotal).toBe(100);
    });

    // 3. Explicit positive round-off
    it('should validate explicit positive round-off', () => {
      // Subtotal 100.40, round-off +0.60 -> grand total 101.00
      const inv = validateInvoice({
        lines: [{ quantity: 1, unitPrice: 100.4, lineTotal: 100.4 }],
        totals: {
          subtotal: 100.4,
          roundOff: 0.6,
          grandTotal: 101,
        },
      });

      expect(inv.status).toBe('MATCH');
      expect(inv.comparisons.roundOff?.status).toBe('MATCH');
      expect(inv.calculated.roundOff).toBe(0.6);
      expect(inv.calculated.grandTotal).toBe(101);
    });

    // 4. Explicit negative round-off
    it('should validate explicit negative round-off', () => {
      // Subtotal 100.47, round-off -0.47 -> grand total 100.00
      const inv = validateInvoice({
        lines: [{ quantity: 1, unitPrice: 100.47, lineTotal: 100.47 }],
        totals: {
          subtotal: 100.47,
          roundOff: -0.47,
          grandTotal: 100,
        },
      });

      expect(inv.status).toBe('MATCH');
      expect(inv.comparisons.roundOff?.status).toBe('MATCH');
      expect(inv.calculated.roundOff).toBe(-0.47);
      expect(inv.calculated.grandTotal).toBe(100);
    });

    // 5. Multiple fractional line values
    it('should accurately aggregate multiple fractional line values in paise', () => {
      // Line 1: 3 × 10.33 = 30.99, GST 5% (1.5495 -> 1.55) = 32.54
      // Line 2: 7 × 15.67 = 109.69, GST 12% (13.1628 -> 13.16) = 122.85
      // Line 3: 2 × 49.99 = 99.98, GST 18% (17.9964 -> 18.00) = 117.98
      // Sum Subtotal: 30.99 + 109.69 + 99.98 = 240.66
      // Sum Tax: 1.55 + 13.16 + 18.00 = 32.71
      // Grand Total: 273.37
      const inv = validateInvoice({
        lines: [
          { quantity: 3, unitPrice: 10.33, igstRate: 5, lineTotal: 32.54 },
          { quantity: 7, unitPrice: 15.67, igstRate: 12, lineTotal: 122.85 },
          { quantity: 2, unitPrice: 49.99, igstRate: 18, lineTotal: 117.98 },
        ],
        totals: {
          subtotal: 240.66,
          totalTax: 32.71,
          grandTotal: 273.37,
        },
      });

      expect(inv.status).toBe('MATCH');
      expect(inv.calculated.subtotal).toBe(240.66);
      expect(inv.calculated.totalTax).toBe(32.71);
      expect(inv.calculated.grandTotal).toBe(273.37);
    });

    // 6. Calculated total vs printed total mismatch
    it('should flag MISMATCH when calculated total differs from printed total beyond tolerance', () => {
      const inv = validateInvoice({
        lines: [{ quantity: 10, unitPrice: 50, lineTotal: 500 }],
        totals: {
          subtotal: 500,
          grandTotal: 510, // Diff = 10 (> 0.05 tolerance)
        },
      });

      expect(inv.status).toBe('MISMATCH');
      expect(inv.comparisons.grandTotal.status).toBe('MISMATCH');
      expect(inv.comparisons.grandTotal.difference).toBe(10);
    });

    // 7. Printed round-off vs calculated round-off discrepancy
    it('should detect discrepancy when printed round-off contradicts actual delta', () => {
      // Subtotal 100.40, printed grandTotal 101.00 -> delta is +0.60
      // Printed round-off is erroneously reported as +0.50
      const inv = validateInvoice({
        lines: [{ quantity: 1, unitPrice: 100.4, lineTotal: 100.4 }],
        totals: {
          subtotal: 100.4,
          roundOff: 0.5, // Erroneous: should be 0.60
          grandTotal: 101,
        },
      });

      expect(inv.status).toBe('MISMATCH');
      expect(inv.comparisons.roundOff?.status).toBe('MISMATCH');
      expect(Math.abs(inv.comparisons.roundOff?.difference ?? 0)).toBe(0.1);
    });
  });

  describe('F. Phase 2B.1 — Financial MATCH ≠ Extraction VERIFIED & Comparator Invariants', () => {
    it('should preserve printed, calculated, difference, status in comparator results', () => {
      const sampleExtraction = {
        supplier: {
          name: { value: 'Siemens India', confidence: 0.98, status: 'EXTRACTED' },
          state: { value: 'Maharashtra', confidence: 0.95, status: 'EXTRACTED' },
        },
        invoice: {
          invoiceNumber: { value: 'SIEM-9921', confidence: 0.99, status: 'EXTRACTED' },
          invoiceDate: { value: '2026-03-20', confidence: 0.95, status: 'EXTRACTED' },
          placeOfSupply: { value: 'Maharashtra', confidence: 0.95, status: 'EXTRACTED' },
        },
        items: [
          {
            id: 'line-item-1',
            lineNumber: 1,
            description: { value: 'Switchgear Unit', confidence: 0.95, status: 'EXTRACTED' },
            quantity: { value: 2, confidence: 0.99, status: 'EXTRACTED' },
            unitPrice: { value: 500, confidence: 0.98, status: 'EXTRACTED' },
            taxableAmount: { value: 1000, confidence: 0.98, status: 'EXTRACTED' },
            cgstRate: { value: 9, confidence: 0.95, status: 'EXTRACTED' },
            cgstAmount: { value: 90, confidence: 0.95, status: 'EXTRACTED' },
            sgstRate: { value: 9, confidence: 0.95, status: 'EXTRACTED' },
            sgstAmount: { value: 90, confidence: 0.95, status: 'EXTRACTED' },
            lineTotal: { value: 1180, confidence: 0.99, status: 'EXTRACTED' },
          },
        ],
        summary: {
          subtotal: { value: 1000, confidence: 0.98, status: 'EXTRACTED' },
          taxableAmount: { value: 1000, confidence: 0.98, status: 'EXTRACTED' },
          totalTax: { value: 180, confidence: 0.98, status: 'EXTRACTED' },
          grandTotal: { value: 1180, confidence: 0.99, status: 'EXTRACTED' },
        },
      } as unknown as IPurchaseBillExtraction;

      const reconciliation = reconcilePurchaseExtraction(sampleExtraction);

      // 1. Structure check: printed, calculated, difference, status
      expect(reconciliation.summaryDiscrepancies[0]).toMatchObject({
        fieldName: 'Subtotal',
        printed: 1000,
        calculated: 1000,
        difference: 0,
        status: 'MATCH',
      });

      expect(reconciliation.lineDiscrepancies[0]).toMatchObject({
        lineNumber: 1,
        printed: 1180,
        calculated: 1180,
        difference: 0,
        status: 'MATCH',
      });

      // 2. Critical Invariant: Mathematical MATCH does NOT mutate FieldStatus from EXTRACTED to VERIFIED
      expect(sampleExtraction.items[0].lineTotal.status).toBe('EXTRACTED');
      expect(sampleExtraction.items[0].quantity.status).toBe('EXTRACTED');
      expect(sampleExtraction.items[0].unitPrice.status).toBe('EXTRACTED');
      expect(sampleExtraction.summary.grandTotal.status).toBe('EXTRACTED');
    });
  });
});
