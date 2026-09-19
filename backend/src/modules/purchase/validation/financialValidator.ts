/**
 * Deterministic Financial Validation Engine for Purchase Bills
 *
 * Rules:
 * 1. Decimal Rupees at the contract boundary -> Integer Paise internally -> Decimal Rupees at output.
 * 2. Absolute deterministic arithmetic without IEEE-754 floating-point drift.
 * 3. Never invent missing quantities, prices, or rates.
 * 4. Named tolerance constant for rounding differences (default: ₹0.05).
 */

export const DEFAULT_FINANCIAL_TOLERANCE_RUPEES = 0.05;
export const DEFAULT_FINANCIAL_TOLERANCE_PAISE = 5;

export type ValidationStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'INSUFFICIENT_DATA'
  | 'INVALID_DATA';

export type TaxMode = 'INTRA_STATE' | 'INTER_STATE' | 'UNKNOWN';

export interface ComparisonFieldResult {
  status: ValidationStatus;
  printed: number | null;
  calculated: number | null;
  difference: number; // in Rupees, rounded to 2 decimals
  differenceMinor: number; // in Paise (integer)
  message: string;
}

export interface LineItemCalculationInput {
  id?: string;
  lineNumber?: number;
  description?: string | null;
  quantity: number | null;
  unitPrice: number | null; // in Rupees
  discountPercent?: number | null;
  discountAmount?: number | null; // in Rupees
  taxableAmount?: number | null; // printed taxable
  gstRate?: number | null; // combined %
  cgstRate?: number | null;
  cgstAmount?: number | null; // in Rupees
  sgstRate?: number | null;
  sgstAmount?: number | null; // in Rupees
  igstRate?: number | null;
  igstAmount?: number | null; // in Rupees
  cessRate?: number | null;
  cessAmount?: number | null; // in Rupees
  lineTotal?: number | null; // printed total
}

export interface LineItemValidationResult {
  id?: string;
  lineNumber?: number;
  status: ValidationStatus;
  isMathValid: boolean;
  messages: string[];
  calculated: {
    grossAmount: number; // in Rupees
    discountAmount: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalTax: number;
    lineTotal: number;
  };
  comparisons: {
    discount?: ComparisonFieldResult;
    taxable?: ComparisonFieldResult;
    cgst?: ComparisonFieldResult;
    sgst?: ComparisonFieldResult;
    igst?: ComparisonFieldResult;
    cess?: ComparisonFieldResult;
    lineTotal: ComparisonFieldResult;
  };
}

export interface InvoiceTotalsCalculationInput {
  subtotal?: number | null;
  totalDiscount?: number | null;
  taxableAmount?: number | null;
  cgstAmount?: number | null;
  sgstAmount?: number | null;
  igstAmount?: number | null;
  cessAmount?: number | null;
  totalTax?: number | null;
  roundOff?: number | null;
  grandTotal?: number | null;
}

export interface InvoiceValidationResult {
  status: ValidationStatus;
  isMathValid: boolean;
  taxMode: TaxMode;
  messages: string[];
  calculated: {
    subtotal: number;
    totalDiscount: number;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    cessAmount: number;
    totalTax: number;
    roundOff: number;
    grandTotal: number;
  };
  lineResults: LineItemValidationResult[];
  comparisons: {
    subtotal: ComparisonFieldResult;
    totalDiscount: ComparisonFieldResult;
    taxableAmount: ComparisonFieldResult;
    cgstAmount: ComparisonFieldResult;
    sgstAmount: ComparisonFieldResult;
    igstAmount: ComparisonFieldResult;
    cessAmount: ComparisonFieldResult;
    totalTax: ComparisonFieldResult;
    roundOff?: ComparisonFieldResult;
    grandTotal: ComparisonFieldResult;
  };
}

// ----------------------------------------------------
// Monetary Helper Functions (Rupees <-> Integer Paise)
// ----------------------------------------------------

export function toPaise(rupees: number | null | undefined): number {
  if (rupees === null || rupees === undefined || isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return Math.round(paise) / 100;
}

/**
 * Compare printed vs calculated values using integer paise arithmetic
 */
export function compareAmounts(
  printed: number | null | undefined,
  calculatedPaise: number,
  tolerancePaise: number = DEFAULT_FINANCIAL_TOLERANCE_PAISE,
  fieldName: string = 'Amount'
): ComparisonFieldResult {
  const calculated = toRupees(calculatedPaise);

  if (printed === null || printed === undefined || isNaN(printed)) {
    return {
      status: 'INSUFFICIENT_DATA',
      printed: null,
      calculated,
      difference: calculated,
      differenceMinor: calculatedPaise,
      message: `${fieldName} is not printed on the document.`,
    };
  }

  const printedPaise = toPaise(printed);
  const diffMinor = printedPaise - calculatedPaise;
  const absDiffMinor = Math.abs(diffMinor);
  const diffRupees = toRupees(diffMinor);

  if (absDiffMinor <= tolerancePaise) {
    return {
      status: 'MATCH',
      printed,
      calculated,
      difference: diffRupees,
      differenceMinor: diffMinor,
      message: `${fieldName} matches calculated value (within tolerance).`,
    };
  }

  return {
    status: 'MISMATCH',
    printed,
    calculated,
    difference: diffRupees,
    differenceMinor: diffMinor,
    message: `${fieldName} printed (${printed}) differs from calculated value (${calculated}).`,
  };
}

/**
 * Determine GST Tax Mode deterministically
 */
export function determineTaxMode(params: {
  lines: LineItemCalculationInput[];
  invoiceTotals?: InvoiceTotalsCalculationInput;
  placeOfSupply?: string | null;
  supplierState?: string | null;
  buyerState?: string | null;
}): TaxMode {
  const { lines, invoiceTotals, placeOfSupply, supplierState, buyerState } = params;

  // 0. If zero tax exists on all lines and totals, default tax mode cleanly without ambiguity
  const anyTax =
    lines.some(
      (l) =>
        (l.gstRate !== null && l.gstRate !== undefined && l.gstRate > 0) ||
        (l.cgstRate !== null && l.cgstRate !== undefined && l.cgstRate > 0) ||
        (l.sgstRate !== null && l.sgstRate !== undefined && l.sgstRate > 0) ||
        (l.igstRate !== null && l.igstRate !== undefined && l.igstRate > 0) ||
        (l.cgstAmount !== null && l.cgstAmount !== undefined && l.cgstAmount > 0) ||
        (l.sgstAmount !== null && l.sgstAmount !== undefined && l.sgstAmount > 0) ||
        (l.igstAmount !== null && l.igstAmount !== undefined && l.igstAmount > 0) ||
        (l.cessAmount !== null && l.cessAmount !== undefined && l.cessAmount > 0)
    ) ||
    Boolean(
      (invoiceTotals?.totalTax && invoiceTotals.totalTax > 0) ||
        (invoiceTotals?.cgstAmount && invoiceTotals.cgstAmount > 0) ||
        (invoiceTotals?.sgstAmount && invoiceTotals.sgstAmount > 0) ||
        (invoiceTotals?.igstAmount && invoiceTotals.igstAmount > 0)
    );

  if (!anyTax) {
    return 'INTRA_STATE';
  }

  // 1. Explicit line-level or total-level tax presence
  const hasIgst = lines.some((l) => (l.igstRate !== null && l.igstRate !== undefined && l.igstRate > 0) || (l.igstAmount !== null && l.igstAmount !== undefined && l.igstAmount > 0)) ||
    Boolean(invoiceTotals?.igstAmount && invoiceTotals.igstAmount > 0);

  const hasCgstOrSgst = lines.some(
    (l) => (l.cgstRate !== null && l.cgstRate !== undefined && l.cgstRate > 0) ||
      (l.sgstRate !== null && l.sgstRate !== undefined && l.sgstRate > 0) ||
      (l.cgstAmount !== null && l.cgstAmount !== undefined && l.cgstAmount > 0) ||
      (l.sgstAmount !== null && l.sgstAmount !== undefined && l.sgstAmount > 0)
  ) || Boolean((invoiceTotals?.cgstAmount && invoiceTotals.cgstAmount > 0) || (invoiceTotals?.sgstAmount && invoiceTotals.sgstAmount > 0));

  // If contradictory tax components exist, return UNKNOWN rather than forcing a mode
  if (hasCgstOrSgst && hasIgst) {
    return 'UNKNOWN';
  }

  // Precedence 1: Explicit printed CGST + SGST -> strong INTRA_STATE evidence
  if (hasCgstOrSgst && !hasIgst) {
    return 'INTRA_STATE';
  }

  // Precedence 2: Explicit printed IGST -> strong INTER_STATE evidence
  if (hasIgst && !hasCgstOrSgst) {
    return 'INTER_STATE';
  }

  // Precedence 3: If explicit tax components are absent, use reliable place-of-supply / supplier-state information
  if (supplierState && (buyerState || placeOfSupply)) {
    const targetState = (placeOfSupply || buyerState)!.trim().toLowerCase();
    const sourceState = supplierState.trim().toLowerCase();

    if (targetState && sourceState) {
      if (sourceState === targetState) {
        return 'INTRA_STATE';
      } else {
        return 'INTER_STATE';
      }
    }
  }

  // Precedence 4: If still ambiguous -> UNKNOWN
  return 'UNKNOWN';
}

// ----------------------------------------------------
// Core Deterministic Line Item Validator
// ----------------------------------------------------

export function validateLineItem(
  item: LineItemCalculationInput,
  options?: {
    taxMode?: TaxMode;
    tolerancePaise?: number;
  }
): LineItemValidationResult {
  const tolerance = options?.tolerancePaise ?? DEFAULT_FINANCIAL_TOLERANCE_PAISE;
  const taxMode = options?.taxMode ?? 'UNKNOWN';
  const messages: string[] = [];

  // 1. Check for Missing / Invalid Quantity or Unit Price
  if (item.quantity === null || item.quantity === undefined) {
    return {
      id: item.id,
      lineNumber: item.lineNumber,
      status: 'INSUFFICIENT_DATA',
      isMathValid: false,
      messages: ['Quantity is missing.'],
      calculated: {
        grossAmount: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
        totalTax: 0,
        lineTotal: 0,
      },
      comparisons: {
        lineTotal: {
          status: 'INSUFFICIENT_DATA',
          printed: item.lineTotal ?? null,
          calculated: null,
          difference: 0,
          differenceMinor: 0,
          message: 'Cannot calculate line total because quantity is missing.',
        },
      },
    };
  }

  if (item.unitPrice === null || item.unitPrice === undefined) {
    return {
      id: item.id,
      lineNumber: item.lineNumber,
      status: 'INSUFFICIENT_DATA',
      isMathValid: false,
      messages: ['Unit price is missing.'],
      calculated: {
        grossAmount: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
        totalTax: 0,
        lineTotal: 0,
      },
      comparisons: {
        lineTotal: {
          status: 'INSUFFICIENT_DATA',
          printed: item.lineTotal ?? null,
          calculated: null,
          difference: 0,
          differenceMinor: 0,
          message: 'Cannot calculate line total because unit price is missing.',
        },
      },
    };
  }

  // 2. Strict Negative / Zero Validation
  if (item.quantity < 0) {
    return {
      id: item.id,
      lineNumber: item.lineNumber,
      status: 'INVALID_DATA',
      isMathValid: false,
      messages: ['Quantity cannot be negative.'],
      calculated: {
        grossAmount: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
        totalTax: 0,
        lineTotal: 0,
      },
      comparisons: {
        lineTotal: {
          status: 'INVALID_DATA',
          printed: item.lineTotal ?? null,
          calculated: null,
          difference: 0,
          differenceMinor: 0,
          message: 'Negative quantity is invalid.',
        },
      },
    };
  }

  if (item.quantity === 0) {
    return {
      id: item.id,
      lineNumber: item.lineNumber,
      status: 'INVALID_DATA',
      isMathValid: false,
      messages: ['Quantity must be greater than zero.'],
      calculated: {
        grossAmount: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
        totalTax: 0,
        lineTotal: 0,
      },
      comparisons: {
        lineTotal: {
          status: 'INVALID_DATA',
          printed: item.lineTotal ?? null,
          calculated: null,
          difference: 0,
          differenceMinor: 0,
          message: 'Quantity of zero is invalid.',
        },
      },
    };
  }

  if (item.unitPrice < 0) {
    return {
      id: item.id,
      lineNumber: item.lineNumber,
      status: 'INVALID_DATA',
      isMathValid: false,
      messages: ['Unit price cannot be negative.'],
      calculated: {
        grossAmount: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
        totalTax: 0,
        lineTotal: 0,
      },
      comparisons: {
        lineTotal: {
          status: 'INVALID_DATA',
          printed: item.lineTotal ?? null,
          calculated: null,
          difference: 0,
          differenceMinor: 0,
          message: 'Negative unit price is invalid.',
        },
      },
    };
  }

  if (item.discountPercent !== null && item.discountPercent !== undefined && (item.discountPercent < 0 || item.discountPercent > 100)) {
    return {
      id: item.id,
      lineNumber: item.lineNumber,
      status: 'INVALID_DATA',
      isMathValid: false,
      messages: ['Discount percentage must be between 0 and 100.'],
      calculated: {
        grossAmount: 0,
        discountAmount: 0,
        taxableAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        cessAmount: 0,
        totalTax: 0,
        lineTotal: 0,
      },
      comparisons: {
        lineTotal: {
          status: 'INVALID_DATA',
          printed: item.lineTotal ?? null,
          calculated: null,
          difference: 0,
          differenceMinor: 0,
          message: 'Invalid discount percentage.',
        },
      },
    };
  }

  // 3. Gross Calculation (Integer Paise)
  // quantity can be decimal (e.g. 2.5 meters), unitPrice in Rupees -> Paise
  const grossPaise = Math.round(item.quantity * Math.round(item.unitPrice * 100));

  // 4. Discount Calculation & Comparison
  let calculatedDiscountPaise = 0;
  let discountComparison: ComparisonFieldResult | undefined = undefined;

  if (item.discountPercent !== null && item.discountPercent !== undefined && item.discountPercent > 0) {
    calculatedDiscountPaise = Math.round((grossPaise * item.discountPercent) / 100);
  }

  if (item.discountAmount !== null && item.discountAmount !== undefined) {
    const printedDiscPaise = toPaise(item.discountAmount);
    if (item.discountPercent !== null && item.discountPercent !== undefined && item.discountPercent > 0) {
      discountComparison = compareAmounts(item.discountAmount, calculatedDiscountPaise, tolerance, 'Discount');
      if (discountComparison.status === 'MISMATCH') {
        messages.push(`Printed discount (${item.discountAmount}) does not match discount % calculation (${toRupees(calculatedDiscountPaise)}).`);
      }
    }
    // Use printed discount amount for line math as source of truth
    calculatedDiscountPaise = printedDiscPaise;
  }

  // 5. Taxable Amount Calculation
  const calculatedTaxablePaise = Math.max(0, grossPaise - calculatedDiscountPaise);
  let taxableComparison: ComparisonFieldResult | undefined = undefined;
  if (item.taxableAmount !== null && item.taxableAmount !== undefined) {
    taxableComparison = compareAmounts(item.taxableAmount, calculatedTaxablePaise, tolerance, 'Taxable amount');
    if (taxableComparison.status === 'MISMATCH') {
      messages.push(`Printed taxable amount (${item.taxableAmount}) differs from gross - discount (${toRupees(calculatedTaxablePaise)}).`);
    }
  }

  // 6. Tax Components Calculation
  let calcCgstPaise = 0;
  let calcSgstPaise = 0;
  let calcIgstPaise = 0;
  let calcCessPaise = 0;

  let cgstComparison: ComparisonFieldResult | undefined = undefined;
  let sgstComparison: ComparisonFieldResult | undefined = undefined;
  let igstComparison: ComparisonFieldResult | undefined = undefined;
  let cessComparison: ComparisonFieldResult | undefined = undefined;

  // 6a. CGST
  if (item.cgstRate !== null && item.cgstRate !== undefined && item.cgstRate > 0) {
    calcCgstPaise = Math.round((calculatedTaxablePaise * item.cgstRate) / 100);
    if (item.cgstAmount !== null && item.cgstAmount !== undefined) {
      cgstComparison = compareAmounts(item.cgstAmount, calcCgstPaise, tolerance, 'CGST');
      if (cgstComparison.status === 'MISMATCH') {
        messages.push(`Printed CGST (${item.cgstAmount}) differs from calculated CGST (${toRupees(calcCgstPaise)}).`);
      }
    }
  } else if (item.cgstAmount !== null && item.cgstAmount !== undefined && item.cgstAmount > 0) {
    calcCgstPaise = toPaise(item.cgstAmount);
  }

  // 6b. SGST
  if (item.sgstRate !== null && item.sgstRate !== undefined && item.sgstRate > 0) {
    calcSgstPaise = Math.round((calculatedTaxablePaise * item.sgstRate) / 100);
    if (item.sgstAmount !== null && item.sgstAmount !== undefined) {
      sgstComparison = compareAmounts(item.sgstAmount, calcSgstPaise, tolerance, 'SGST');
      if (sgstComparison.status === 'MISMATCH') {
        messages.push(`Printed SGST (${item.sgstAmount}) differs from calculated SGST (${toRupees(calcSgstPaise)}).`);
      }
    }
  } else if (item.sgstAmount !== null && item.sgstAmount !== undefined && item.sgstAmount > 0) {
    calcSgstPaise = toPaise(item.sgstAmount);
  }

  // 6c. IGST
  if (item.igstRate !== null && item.igstRate !== undefined && item.igstRate > 0) {
    calcIgstPaise = Math.round((calculatedTaxablePaise * item.igstRate) / 100);
    if (item.igstAmount !== null && item.igstAmount !== undefined) {
      igstComparison = compareAmounts(item.igstAmount, calcIgstPaise, tolerance, 'IGST');
      if (igstComparison.status === 'MISMATCH') {
        messages.push(`Printed IGST (${item.igstAmount}) differs from calculated IGST (${toRupees(calcIgstPaise)}).`);
      }
    }
  } else if (item.igstAmount !== null && item.igstAmount !== undefined && item.igstAmount > 0) {
    calcIgstPaise = toPaise(item.igstAmount);
  }

  // 6d. CESS
  if (item.cessRate !== null && item.cessRate !== undefined && item.cessRate > 0) {
    calcCessPaise = Math.round((calculatedTaxablePaise * item.cessRate) / 100);
    if (item.cessAmount !== null && item.cessAmount !== undefined) {
      cessComparison = compareAmounts(item.cessAmount, calcCessPaise, tolerance, 'CESS');
      if (cessComparison.status === 'MISMATCH') {
        messages.push(`Printed CESS (${item.cessAmount}) differs from calculated CESS (${toRupees(calcCessPaise)}).`);
      }
    }
  } else if (item.cessAmount !== null && item.cessAmount !== undefined && item.cessAmount > 0) {
    calcCessPaise = toPaise(item.cessAmount);
  }

  // 6e. Combined GST Rate Fallback (if individual components not provided)
  if (calcCgstPaise === 0 && calcSgstPaise === 0 && calcIgstPaise === 0 && item.gstRate !== null && item.gstRate !== undefined && item.gstRate > 0) {
    if (taxMode === 'INTER_STATE') {
      calcIgstPaise = Math.round((calculatedTaxablePaise * item.gstRate) / 100);
    } else if (taxMode === 'INTRA_STATE') {
      calcCgstPaise = Math.round((calculatedTaxablePaise * (item.gstRate / 2)) / 100);
      calcSgstPaise = Math.round((calculatedTaxablePaise * (item.gstRate / 2)) / 100);
    } else {
      // Ambiguous Tax Mode
      messages.push(`Combined GST rate (${item.gstRate}%) present, but tax mode is UNKNOWN.`);
    }
  }

  // 7. Line Total Calculation & Comparison
  const calcLineTotalPaise = calculatedTaxablePaise + calcCgstPaise + calcSgstPaise + calcIgstPaise + calcCessPaise;
  const lineTotalComparison = compareAmounts(item.lineTotal, calcLineTotalPaise, tolerance, 'Line total');

  if (lineTotalComparison.status === 'MISMATCH') {
    messages.push(`Printed line total (${item.lineTotal}) differs from calculated total (${toRupees(calcLineTotalPaise)}).`);
  }

  // Determine Overall Line Status
  let overallStatus: ValidationStatus = 'MATCH';
  if (messages.length > 0) {
    overallStatus = 'MISMATCH';
  }

  return {
    id: item.id,
    lineNumber: item.lineNumber,
    status: overallStatus,
    isMathValid: overallStatus === 'MATCH',
    messages,
    calculated: {
      grossAmount: toRupees(grossPaise),
      discountAmount: toRupees(calculatedDiscountPaise),
      taxableAmount: toRupees(calculatedTaxablePaise),
      cgstAmount: toRupees(calcCgstPaise),
      sgstAmount: toRupees(calcSgstPaise),
      igstAmount: toRupees(calcIgstPaise),
      cessAmount: toRupees(calcCessPaise),
      totalTax: toRupees(calcCgstPaise + calcSgstPaise + calcIgstPaise + calcCessPaise),
      lineTotal: toRupees(calcLineTotalPaise),
    },
    comparisons: {
      discount: discountComparison,
      taxable: taxableComparison,
      cgst: cgstComparison,
      sgst: sgstComparison,
      igst: igstComparison,
      cess: cessComparison,
      lineTotal: lineTotalComparison,
    },
  };
}

// ----------------------------------------------------
// Core Deterministic Invoice-Level Validator
// ----------------------------------------------------

export function validateInvoice(params: {
  lines: LineItemCalculationInput[];
  totals?: InvoiceTotalsCalculationInput;
  placeOfSupply?: string | null;
  supplierState?: string | null;
  buyerState?: string | null;
  tolerancePaise?: number;
}): InvoiceValidationResult {
  const tolerance = params.tolerancePaise ?? DEFAULT_FINANCIAL_TOLERANCE_PAISE;
  const taxMode = determineTaxMode(params);

  // 1. Validate all line items
  const lineResults: LineItemValidationResult[] = params.lines.map((line, idx) =>
    validateLineItem(
      {
        ...line,
        lineNumber: line.lineNumber ?? idx + 1,
      },
      { taxMode, tolerancePaise: tolerance }
    )
  );

  // 2. Aggregate line sums in integer paise
  let sumSubtotalPaise = 0;
  let sumDiscountPaise = 0;
  let sumTaxablePaise = 0;
  let sumCgstPaise = 0;
  let sumSgstPaise = 0;
  let sumIgstPaise = 0;
  let sumCessPaise = 0;
  let sumTaxPaise = 0;
  let sumLineTotalPaise = 0;

  for (const lr of lineResults) {
    sumSubtotalPaise += toPaise(lr.calculated.grossAmount);
    sumDiscountPaise += toPaise(lr.calculated.discountAmount);
    sumTaxablePaise += toPaise(lr.calculated.taxableAmount);
    sumCgstPaise += toPaise(lr.calculated.cgstAmount);
    sumSgstPaise += toPaise(lr.calculated.sgstAmount);
    sumIgstPaise += toPaise(lr.calculated.igstAmount);
    sumCessPaise += toPaise(lr.calculated.cessAmount);
    sumTaxPaise += toPaise(lr.calculated.totalTax);
    sumLineTotalPaise += toPaise(lr.calculated.lineTotal);
  }

  // 3. Round-off handling
  let calculatedRoundOffPaise = 0;
  let calculatedGrandTotalPaise = sumLineTotalPaise;
  let roundOffComparison: ComparisonFieldResult | undefined = undefined;

  if (params.totals?.roundOff !== null && params.totals?.roundOff !== undefined) {
    calculatedRoundOffPaise = toPaise(params.totals.roundOff);
    calculatedGrandTotalPaise = sumLineTotalPaise + calculatedRoundOffPaise;

    // Validate printed round-off consistency
    // If grand total was printed, expected round-off is printed grand total - sum of line totals
    let expectedRoundOffPaise: number;
    if (params.totals.grandTotal !== null && params.totals.grandTotal !== undefined) {
      expectedRoundOffPaise = toPaise(params.totals.grandTotal) - sumLineTotalPaise;
    } else {
      const unroundedGrandTotalRupees = toRupees(sumLineTotalPaise);
      const expectedRoundedGrandTotalRupees = Math.round(unroundedGrandTotalRupees);
      expectedRoundOffPaise = toPaise(expectedRoundedGrandTotalRupees) - sumLineTotalPaise;
    }

    roundOffComparison = compareAmounts(
      params.totals.roundOff,
      expectedRoundOffPaise,
      tolerance,
      'Round-off'
    );
  }

  // 4. Invoice Total Comparisons
  const totals = params.totals || {};
  const subtotalComparison = compareAmounts(totals.subtotal, sumSubtotalPaise, tolerance, 'Subtotal');
  const discountComparison = compareAmounts(totals.totalDiscount, sumDiscountPaise, tolerance, 'Total discount');
  const taxableComparison = compareAmounts(totals.taxableAmount, sumTaxablePaise, tolerance, 'Taxable amount');
  const cgstComparison = compareAmounts(totals.cgstAmount, sumCgstPaise, tolerance, 'CGST total');
  const sgstComparison = compareAmounts(totals.sgstAmount, sumSgstPaise, tolerance, 'SGST total');
  const igstComparison = compareAmounts(totals.igstAmount, sumIgstPaise, tolerance, 'IGST total');
  const cessComparison = compareAmounts(totals.cessAmount, sumCessPaise, tolerance, 'CESS total');
  const totalTaxComparison = compareAmounts(totals.totalTax, sumTaxPaise, tolerance, 'Total tax');
  const grandTotalComparison = compareAmounts(totals.grandTotal, calculatedGrandTotalPaise, tolerance, 'Grand total');

  const messages: string[] = [];

  if (taxMode === 'UNKNOWN') {
    messages.push('Tax mode could not be determined unambiguously.');
  }

  const comparisonsList = [
    subtotalComparison,
    discountComparison,
    taxableComparison,
    cgstComparison,
    sgstComparison,
    igstComparison,
    cessComparison,
    totalTaxComparison,
    grandTotalComparison,
  ];

  if (roundOffComparison && roundOffComparison.status === 'MISMATCH') {
    messages.push(roundOffComparison.message);
  }

  for (const c of comparisonsList) {
    if (c.status === 'MISMATCH') {
      messages.push(c.message);
    }
  }

  const anyLineInvalid = lineResults.some((lr) => lr.status === 'INVALID_DATA');
  const anyLineInsufficient = lineResults.some((lr) => lr.status === 'INSUFFICIENT_DATA');
  const anyLineMismatch = lineResults.some((lr) => lr.status === 'MISMATCH');
  const anyTotalMismatch = comparisonsList.some((c) => c.status === 'MISMATCH');

  let overallStatus: ValidationStatus = 'MATCH';
  if (anyLineInvalid) {
    overallStatus = 'INVALID_DATA';
  } else if (anyLineInsufficient) {
    overallStatus = 'INSUFFICIENT_DATA';
  } else if (anyLineMismatch || anyTotalMismatch || messages.length > 0) {
    overallStatus = 'MISMATCH';
  }

  return {
    status: overallStatus,
    isMathValid: overallStatus === 'MATCH',
    taxMode,
    messages,
    calculated: {
      subtotal: toRupees(sumSubtotalPaise),
      totalDiscount: toRupees(sumDiscountPaise),
      taxableAmount: toRupees(sumTaxablePaise),
      cgstAmount: toRupees(sumCgstPaise),
      sgstAmount: toRupees(sumSgstPaise),
      igstAmount: toRupees(sumIgstPaise),
      cessAmount: toRupees(sumCessPaise),
      totalTax: toRupees(sumTaxPaise),
      roundOff: toRupees(calculatedRoundOffPaise),
      grandTotal: toRupees(calculatedGrandTotalPaise),
    },
    lineResults,
    comparisons: {
      subtotal: subtotalComparison,
      totalDiscount: discountComparison,
      taxableAmount: taxableComparison,
      cgstAmount: cgstComparison,
      sgstAmount: sgstComparison,
      igstAmount: igstComparison,
      cessAmount: cessComparison,
      totalTax: totalTaxComparison,
      roundOff: roundOffComparison,
      grandTotal: grandTotalComparison,
    },
  };
}
