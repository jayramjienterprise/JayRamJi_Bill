/**
 * Canonical Purchase Financial Calculations Utility
 *
 * Rules:
 * 1. Integer paise calculations where applicable to avoid floating-point drift.
 * 2. Absolute consistency between Create Purchase page and AI Purchase Bill Scanner.
 * 3. Never round decimal unit prices (e.g. ₹7.50).
 * 4. Distinct handling for grossLineAmount, discount, taxableAmount, tax, and lineTotal.
 * 5. Full support for both GST-exclusive and GST-inclusive pricing.
 */

export type LineTaxMode = 'EXCLUSIVE' | 'INCLUSIVE' | 'TAX_EXCLUSIVE' | 'TAX_INCLUSIVE';

export interface LineCalculationInput {
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  taxRate?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  isPreTaxLine?: boolean;
  taxMode?: LineTaxMode;
}

export interface LineCalculationOutput {
  grossAmount: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  taxAmount: number;
  lineTotal: number;
  taxMode: 'EXCLUSIVE' | 'INCLUSIVE';
}

export interface PurchaseTotalsInput {
  items: LineCalculationOutput[];
  isIntraState?: boolean;
  amountPaid?: number;
  printedGrandTotal?: number | null;
  printedSubtotal?: number | null;
  totalSource?: 'PRINTED_BILL' | 'DETERMINISTIC_CALCULATION' | 'DETERMINISTIC_CALCULATION_PENDING' | 'USER_OVERRIDE';
  manualOverride?: boolean;
  overrideSummary?: {
    subtotal?: number;
    taxableAmount?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    totalTax?: number;
    grandTotal?: number;
  };
}

export interface PurchaseTotalsOutput {
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTax: number;
  calculatedGrandTotal: number;
  grandTotal: number;
  printedGrandTotal: number | null;
  grandTotalDifference: number;
  isGrandTotalMatch: boolean;
  printedSubtotal: number | null;
  subtotalDifference: number;
  isSubtotalMatch: boolean;
  finalPurchaseTotal: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
}

/**
 * Deterministically calculates single line item amounts
 */
export function calculateLineItem(input: LineCalculationInput): LineCalculationOutput {
  const qty = Math.max(0, Number(input.quantity) || 0);
  const unitPrice = Math.max(0, Number(input.unitPrice) || 0);
  const discPct = Math.min(100, Math.max(0, Number(input.discountPercent) || 0));
  const gstRate = Math.max(0, Number(input.taxRate) || 0);
  const isInclusive = input.taxMode === 'INCLUSIVE' || input.taxMode === 'TAX_INCLUSIVE';

  // Integer paise arithmetic
  const unitPricePaise = Math.round(unitPrice * 100);
  const grossPaise = Math.round(qty * unitPricePaise);

  let discPaise = 0;
  if (input.discountAmount !== undefined && input.discountAmount !== null && input.discountAmount > 0) {
    discPaise = Math.round(input.discountAmount * 100);
  } else if (discPct > 0) {
    discPaise = Math.round((grossPaise * discPct) / 100);
  }

  // Determine effective tax rate
  let effectiveTaxRate = gstRate;
  const hasSplitRates = (input.cgstRate !== undefined && input.cgstRate > 0) ||
                        (input.sgstRate !== undefined && input.sgstRate > 0) ||
                        (input.igstRate !== undefined && input.igstRate > 0);
  if (hasSplitRates) {
    effectiveTaxRate = (input.cgstRate || 0) + (input.sgstRate || 0) + (input.igstRate || 0);
  }

  let taxablePaise = 0;
  let taxPaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  let lineTotalPaise = 0;

  if (isInclusive) {
    // Inclusive tax formula:
    // taxable = (gross - discount) / (1 + taxRate / 100)
    const effectiveGrossPaise = Math.max(0, grossPaise - discPaise);
    if (effectiveTaxRate > 0) {
      taxablePaise = Math.round(effectiveGrossPaise / (1 + effectiveTaxRate / 100));
      taxPaise = effectiveGrossPaise - taxablePaise;
    } else {
      taxablePaise = effectiveGrossPaise;
      taxPaise = 0;
    }
    lineTotalPaise = effectiveGrossPaise;

    // Distribute tax between CGST/SGST or IGST
    if (input.cgstRate !== undefined || input.sgstRate !== undefined) {
      const cRate = input.cgstRate || 0;
      const sRate = input.sgstRate || 0;
      const totalSplit = cRate + sRate;
      if (totalSplit > 0) {
        cgstPaise = Math.round((taxPaise * cRate) / totalSplit);
        sgstPaise = taxPaise - cgstPaise;
      }
    } else if (input.igstRate !== undefined && input.igstRate > 0) {
      igstPaise = taxPaise;
    } else {
      cgstPaise = Math.round(taxPaise / 2);
      sgstPaise = taxPaise - cgstPaise;
    }
  } else {
    // Exclusive tax formula:
    // taxable = gross - discount
    // tax = taxable * taxRate / 100
    // lineTotal = taxable + tax
    taxablePaise = Math.max(0, grossPaise - discPaise);

    if (input.cgstRate !== undefined && input.cgstRate > 0) {
      cgstPaise = Math.round((taxablePaise * input.cgstRate) / 100);
    }
    if (input.sgstRate !== undefined && input.sgstRate > 0) {
      sgstPaise = Math.round((taxablePaise * input.sgstRate) / 100);
    }
    if (input.igstRate !== undefined && input.igstRate > 0) {
      igstPaise = Math.round((taxablePaise * input.igstRate) / 100);
    }

    if (cgstPaise === 0 && sgstPaise === 0 && igstPaise === 0 && gstRate > 0) {
      const halfRate = gstRate / 2;
      cgstPaise = Math.round((taxablePaise * halfRate) / 100);
      sgstPaise = Math.round((taxablePaise * halfRate) / 100);
    }

    taxPaise = cgstPaise + sgstPaise + igstPaise;
    lineTotalPaise = input.isPreTaxLine ? taxablePaise : taxablePaise + taxPaise;
  }

  return {
    grossAmount: grossPaise / 100,
    discountAmount: discPaise / 100,
    taxableAmount: taxablePaise / 100,
    cgstAmount: cgstPaise / 100,
    sgstAmount: sgstPaise / 100,
    igstAmount: igstPaise / 100,
    taxAmount: taxPaise / 100,
    lineTotal: lineTotalPaise / 100,
    taxMode: isInclusive ? 'INCLUSIVE' : 'EXCLUSIVE',
  };
}

/**
 * Deterministically calculates overall purchase totals, comparison against printed bill,
 * and payment breakdown.
 */
export function calculatePurchaseTotals(input: PurchaseTotalsInput): PurchaseTotalsOutput {
  const {
    items,
    isIntraState = true,
    amountPaid = 0,
    printedGrandTotal = null,
    printedSubtotal = null,
    totalSource = 'PRINTED_BILL',
    manualOverride = false,
    overrideSummary,
  } = input;

  let subtotal = 0;
  let totalDiscount = 0;
  let taxableAmount = 0;
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  for (const it of items) {
    subtotal += it.grossAmount;
    totalDiscount += it.discountAmount;
    taxableAmount += it.taxableAmount;
    if (isIntraState) {
      cgstAmount += it.cgstAmount;
      sgstAmount += it.sgstAmount;
    } else {
      igstAmount += it.igstAmount > 0 ? it.igstAmount : it.taxAmount;
    }
  }

  subtotal = Math.round(subtotal * 100) / 100;
  totalDiscount = Math.round(totalDiscount * 100) / 100;
  taxableAmount = Math.round(taxableAmount * 100) / 100;
  cgstAmount = Math.round(cgstAmount * 100) / 100;
  sgstAmount = Math.round(sgstAmount * 100) / 100;
  igstAmount = Math.round(igstAmount * 100) / 100;

  let totalTax = Math.round((cgstAmount + sgstAmount + igstAmount) * 100) / 100;
  const calculatedGrandTotal = Math.round((taxableAmount + totalTax) * 100) / 100;
  let grandTotal = calculatedGrandTotal;

  if (manualOverride && overrideSummary) {
    if (overrideSummary.taxableAmount !== undefined) taxableAmount = overrideSummary.taxableAmount;
    if (overrideSummary.subtotal !== undefined) subtotal = overrideSummary.subtotal;
    if (overrideSummary.cgstAmount !== undefined) cgstAmount = overrideSummary.cgstAmount;
    if (overrideSummary.sgstAmount !== undefined) sgstAmount = overrideSummary.sgstAmount;
    if (overrideSummary.igstAmount !== undefined) igstAmount = overrideSummary.igstAmount;
    if (overrideSummary.totalTax !== undefined) totalTax = overrideSummary.totalTax;
    if (overrideSummary.grandTotal !== undefined) grandTotal = overrideSummary.grandTotal;
  }

  // Comparisons
  const cleanPrintedGrand = printedGrandTotal !== null && printedGrandTotal !== undefined && !isNaN(printedGrandTotal)
    ? Math.round(printedGrandTotal * 100) / 100
    : null;
  const grandTotalDifference = cleanPrintedGrand !== null
    ? Math.round((calculatedGrandTotal - cleanPrintedGrand) * 100) / 100
    : 0;
  const isGrandTotalMatch = cleanPrintedGrand !== null && Math.abs(grandTotalDifference) <= 0.05;

  const cleanPrintedSub = printedSubtotal !== null && printedSubtotal !== undefined && !isNaN(printedSubtotal)
    ? Math.round(printedSubtotal * 100) / 100
    : null;
  const subtotalDifference = cleanPrintedSub !== null
    ? Math.round((taxableAmount - cleanPrintedSub) * 100) / 100
    : 0;
  const isSubtotalMatch = cleanPrintedSub !== null && Math.abs(subtotalDifference) <= 0.05;

  // Final Purchase Total determination:
  // If user explicitly accepted calculated total or if override active, or if totals match
  let finalPurchaseTotal = calculatedGrandTotal;
  if (manualOverride && overrideSummary?.grandTotal !== undefined) {
    finalPurchaseTotal = overrideSummary.grandTotal;
  } else if (totalSource === 'DETERMINISTIC_CALCULATION') {
    finalPurchaseTotal = calculatedGrandTotal;
  } else if (isGrandTotalMatch && cleanPrintedGrand !== null) {
    finalPurchaseTotal = cleanPrintedGrand;
  } else {
    // If pending or printed, default to calculated for safety or current active
    finalPurchaseTotal = calculatedGrandTotal;
  }

  const cleanPaid = Math.max(0, Number(amountPaid) || 0);
  const balanceDue = Math.max(0, Math.round((finalPurchaseTotal - cleanPaid) * 100) / 100);

  let paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' = 'UNPAID';
  if (cleanPaid >= finalPurchaseTotal && finalPurchaseTotal > 0) {
    paymentStatus = 'PAID';
  } else if (cleanPaid > 0) {
    paymentStatus = 'PARTIALLY_PAID';
  }

  return {
    subtotal,
    totalDiscount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalTax,
    calculatedGrandTotal,
    grandTotal,
    printedGrandTotal: cleanPrintedGrand,
    grandTotalDifference,
    isGrandTotalMatch,
    printedSubtotal: cleanPrintedSub,
    subtotalDifference,
    isSubtotalMatch,
    finalPurchaseTotal,
    amountPaid: cleanPaid,
    balanceDue,
    paymentStatus,
  };
}

/**
 * Consistent Indian Currency Formatter (e.g. ₹7,500.00, ₹2,68,450.00)
 */
export function formatIndianCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '₹0.00';
  }
  const formatted = Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : ''}₹${formatted}`;
}
