import {
  IPurchaseBillExtraction,
  IDraftReconciliation,
  IExtractedLineItem,
} from '../../../database/models/PurchaseDraft';
import {
  validateInvoice,
  InvoiceValidationResult,
  DEFAULT_FINANCIAL_TOLERANCE_PAISE,
  LineItemCalculationInput,
  ValidationStatus,
} from './financialValidator';

export interface DetailedDraftReconciliation extends IDraftReconciliation {
  invoiceValidation: InvoiceValidationResult;
  lineDiscrepancies: Array<{
    lineNumber: number;
    description: string;
    printed: number | null;
    calculated: number;
    difference: number;
    status: ValidationStatus;
    printedLineTotal: number | null;
    calculatedLineTotal: number;
    hasDiscrepancy: boolean;
    messages: string[];
  }>;
  summaryDiscrepancies: Array<{
    fieldName: string;
    printed: number | null;
    calculated: number;
    difference: number;
    status: ValidationStatus;
    hasDiscrepancy: boolean;
  }>;
}

/**
 * Reconciles AI extracted bill data against deterministic backend calculations.
 *
 * CRITICAL FINANCIAL INVARIANT:
 * 1. Financial MATCH signifies mathematical consistency ONLY.
 *    It does NOT imply field extraction is "VERIFIED" or definitely read correctly by AI.
 *    Extraction FieldStatus is preserved independently and never converted to VERIFIED here.
 * 2. Never mutates or overwrites printed extracted values.
 *    Strictly generates comparison reports, calculated mirrors, and discrepancy flags.
 */
export function reconcilePurchaseExtraction(
  extraction: IPurchaseBillExtraction,
  options?: {
    buyerState?: string | null;
    tolerancePaise?: number;
  }
): DetailedDraftReconciliation {
  const tolerance = options?.tolerancePaise ?? DEFAULT_FINANCIAL_TOLERANCE_PAISE;

  // 1. Map extracted line items to calculation inputs without losing printed values
  const linesInput: LineItemCalculationInput[] = extraction.items.map((it, idx) => ({
    id: it.id,
    lineNumber: it.lineNumber ?? idx + 1,
    description: it.description?.value ?? null,
    quantity: it.quantity?.value ?? null,
    unitPrice: it.unitPrice?.value ?? null,
    discountPercent: it.discountPercent?.value ?? null,
    discountAmount: it.discountAmount?.value ?? null,
    taxableAmount: it.taxableAmount?.value ?? null,
    gstRate: it.gstRate?.value ?? null,
    cgstRate: it.cgstRate?.value ?? null,
    cgstAmount: it.cgstAmount?.value ?? null,
    sgstRate: it.sgstRate?.value ?? null,
    sgstAmount: it.sgstAmount?.value ?? null,
    igstRate: it.igstRate?.value ?? null,
    igstAmount: it.igstAmount?.value ?? null,
    cessRate: it.cessRate?.value ?? null,
    cessAmount: it.cessAmount?.value ?? null,
    lineTotal: it.lineTotal?.value ?? null,
    taxMode: it.taxMode ?? extraction.tax?.taxInclusionMode,
  }));

  // 2. Map summary to calculation input
  const totalsInput = {
    subtotal: extraction.summary?.subtotal?.value ?? null,
    totalDiscount: extraction.summary?.totalDiscount?.value ?? null,
    taxableAmount: extraction.summary?.taxableAmount?.value ?? null,
    cgstRate: (extraction.summary as any)?.cgstRate?.value ?? null,
    cgstAmount: extraction.summary?.cgstAmount?.value ?? null,
    sgstRate: (extraction.summary as any)?.sgstRate?.value ?? null,
    sgstAmount: extraction.summary?.sgstAmount?.value ?? null,
    igstRate: (extraction.summary as any)?.igstRate?.value ?? null,
    igstAmount: extraction.summary?.igstAmount?.value ?? null,
    cessAmount: extraction.summary?.cessAmount?.value ?? null,
    totalTax: extraction.summary?.totalTax?.value ?? null,
    roundOff: extraction.summary?.roundOff?.value ?? null,
    grandTotal: extraction.summary?.grandTotal?.value ?? null,
  };

  // 3. Execute deterministic financial validator
  const validation = validateInvoice({
    lines: linesInput,
    totals: totalsInput,
    placeOfSupply: extraction.invoice?.placeOfSupply?.value ?? null,
    supplierState: extraction.supplier?.state?.value ?? extraction.supplier?.stateCode?.value ?? null,
    buyerState: options?.buyerState ?? null,
    tolerancePaise: tolerance,
  });

  // 4. Generate Line-Level Discrepancy Breakdown
  const lineDiscrepancies = validation.lineResults.map((lr, idx) => {
    const rawLine = extraction.items[idx];
    const desc = rawLine?.description?.value || `Line Item #${lr.lineNumber || idx + 1}`;
    const printedTotal = rawLine?.lineTotal?.value ?? null;
    const calcTotal = lr.calculated.lineTotal;
    const hasDiscrepancy = lr.status !== 'MATCH';

    return {
      lineNumber: lr.lineNumber || idx + 1,
      description: desc,
      printed: printedTotal,
      calculated: calcTotal,
      difference: lr.comparisons.lineTotal.difference,
      status: lr.status,
      printedLineTotal: printedTotal,
      calculatedLineTotal: calcTotal,
      hasDiscrepancy,
      messages: lr.messages,
    };
  });

  // 5. Generate Summary-Level Discrepancy Breakdown
  const summaryDiscrepancies: Array<{
    fieldName: string;
    printed: number | null;
    calculated: number;
    difference: number;
    status: ValidationStatus;
    hasDiscrepancy: boolean;
  }> = [
    {
      fieldName: 'Subtotal',
      printed: totalsInput.subtotal,
      calculated: validation.calculated.subtotal,
      difference: validation.comparisons.subtotal.difference,
      status: validation.comparisons.subtotal.status,
      hasDiscrepancy: validation.comparisons.subtotal.status === 'MISMATCH',
    },
  ];

  if (validation.taxMode === 'INTRA_STATE' || totalsInput.cgstAmount !== null || totalsInput.sgstAmount !== null) {
    summaryDiscrepancies.push(
      {
        fieldName: 'CGST',
        printed: totalsInput.cgstAmount,
        calculated: validation.calculated.cgstAmount,
        difference: validation.comparisons.cgstAmount.difference,
        status: validation.comparisons.cgstAmount.status,
        hasDiscrepancy: validation.comparisons.cgstAmount.status === 'MISMATCH',
      },
      {
        fieldName: 'SGST',
        printed: totalsInput.sgstAmount,
        calculated: validation.calculated.sgstAmount,
        difference: validation.comparisons.sgstAmount.difference,
        status: validation.comparisons.sgstAmount.status,
        hasDiscrepancy: validation.comparisons.sgstAmount.status === 'MISMATCH',
      }
    );
  }

  if (validation.taxMode === 'INTER_STATE' || totalsInput.igstAmount !== null) {
    summaryDiscrepancies.push({
      fieldName: 'IGST',
      printed: totalsInput.igstAmount,
      calculated: validation.calculated.igstAmount,
      difference: validation.comparisons.igstAmount.difference,
      status: validation.comparisons.igstAmount.status,
      hasDiscrepancy: validation.comparisons.igstAmount.status === 'MISMATCH',
    });
  }

  summaryDiscrepancies.push(
    {
      fieldName: 'Total GST',
      printed: totalsInput.totalTax,
      calculated: validation.calculated.totalTax,
      difference: validation.comparisons.totalTax.difference,
      status: validation.comparisons.totalTax.status,
      hasDiscrepancy: validation.comparisons.totalTax.status === 'MISMATCH',
    },
    {
      fieldName: 'Grand Total',
      printed: totalsInput.grandTotal,
      calculated: validation.calculated.grandTotal,
      difference: validation.comparisons.grandTotal.difference,
      status: validation.comparisons.grandTotal.status,
      hasDiscrepancy: validation.comparisons.grandTotal.status === 'MISMATCH',
    }
  );

  if (totalsInput.roundOff !== null && totalsInput.roundOff !== undefined && validation.comparisons.roundOff) {
    summaryDiscrepancies.push({
      fieldName: 'Round-off',
      printed: totalsInput.roundOff,
      calculated: validation.calculated.roundOff,
      difference: validation.comparisons.roundOff.difference,
      status: validation.comparisons.roundOff.status,
      hasDiscrepancy: validation.comparisons.roundOff.status === 'MISMATCH',
    });
  }

  // 6. Consolidate Discrepancy Notes
  const discrepancyNotes: string[] = [];

  for (const ld of lineDiscrepancies) {
    if (ld.hasDiscrepancy && ld.messages.length > 0) {
      discrepancyNotes.push(`Item ${ld.lineNumber} (${ld.description}): ${ld.messages.join('; ')}`);
    }
  }

  for (const sd of summaryDiscrepancies) {
    if (sd.hasDiscrepancy) {
      discrepancyNotes.push(`${sd.fieldName} mismatch: printed ${sd.printed}, calculated ${sd.calculated} (diff: ₹${sd.difference})`);
    }
  }

  if (validation.taxMode === 'UNKNOWN') {
    discrepancyNotes.push('Tax mode could not be determined unambiguously.');
  }

  const hasDiscrepancies = discrepancyNotes.length > 0 || !validation.isMathValid;

  return {
    isMathValid: validation.isMathValid,
    hasDiscrepancies,
    discrepancyNotes,
    calculatedSubtotal: validation.calculated.subtotal,
    calculatedCgstAmount: validation.calculated.cgstAmount,
    calculatedSgstAmount: validation.calculated.sgstAmount,
    calculatedIgstAmount: validation.calculated.igstAmount,
    calculatedTaxTotal: validation.calculated.totalTax,
    calculatedGrandTotal: validation.calculated.grandTotal,
    taxMode: validation.taxMode,
    invoiceValidation: validation,
    lineDiscrepancies,
    summaryDiscrepancies,
  };
}

/**
 * Attaches backend calculated values to extracted line items without altering printed numbers
 */
export function populateCalculatedLineValues(
  items: IExtractedLineItem[],
  validation: InvoiceValidationResult
): IExtractedLineItem[] {
  return items.map((it, idx) => {
    const lr = validation.lineResults[idx];
    if (!lr) return it;

    return {
      ...it,
      calculated: {
        taxableAmount: lr.calculated.taxableAmount,
        cgstAmount: lr.calculated.cgstAmount,
        sgstAmount: lr.calculated.sgstAmount,
        igstAmount: lr.calculated.igstAmount,
        cessAmount: lr.calculated.cessAmount,
        lineTotal: lr.calculated.lineTotal,
        discrepancy: lr.comparisons.lineTotal.difference,
      },
    };
  });
}
