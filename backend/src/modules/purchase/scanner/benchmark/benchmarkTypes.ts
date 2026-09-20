/**
 * Types & Interfaces for Phase 5 Real-Bill Accuracy Benchmark & Evaluation Engine
 */

export interface BenchmarkSupplierGT {
  name: string | null;
  gstin: string | null;
  pan: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  stateCode: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
}

export interface BenchmarkInvoiceGT {
  invoiceNumber: string | null;
  invoiceDate: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  poNumber: string | null;
  ewayBillNumber: string | null;
  placeOfSupply: string | null;
  isReverseCharge: boolean | null;
}

export interface BenchmarkItemGT {
  description: string;
  skuOrCode: string | null;
  hsnSac: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  lineTotal: number;
}

export interface BenchmarkSummaryGT {
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
  amountPaid: number;
  balanceDue: number;
}

export interface BenchmarkPaymentGT {
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE' | 'CREDIT' | 'OTHER' | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  upiId: string | null;
}

export interface BenchmarkDocumentGroundTruth {
  id: string;
  documentName: string;
  documentType:
    | 'GST_TAX_INVOICE'
    | 'INTERSTATE_IGST_INVOICE'
    | 'THERMAL_RECEIPT'
    | 'MULTIPAGE_INVOICE'
    | 'MIXED_TAX_RATES'
    | 'DISCOUNT_HEAVY'
    | 'CESS_INVOICE'
    | 'ROUND_OFF_INVOICE'
    | 'HSN_SKU_DENSE'
    | 'POOR_QUALITY_FADED'
    | 'ALTERNATIVE_DATE_FORMAT'
    | 'MISSING_OPTIONAL_FIELDS'
    | 'ADVERSARIAL_INJECTION';
  pageCount: number;
  supplier: BenchmarkSupplierGT;
  invoice: BenchmarkInvoiceGT;
  items: BenchmarkItemGT[];
  summary: BenchmarkSummaryGT;
  payment: BenchmarkPaymentGT;
  notes?: string | null;
  isAdversarial?: boolean;
  expectedAdversarialBehavior?: string;
}

export interface FieldAccuracyMetric {
  totalExpectedFields: number;
  matchedFields: number;
  accuracyRate: number;
  fieldBreakdown: Record<
    string,
    {
      expected: any;
      actual: any;
      matched: boolean;
      confidence?: number;
    }
  >;
}

export interface LineItemMetrics {
  expectedCount: number;
  detectedCount: number;
  matchedCount: number;
  missedCount: number;
  extraCount: number;
  mergedCount: number;
  splitCount: number;
  recall: number;
  precision: number;
  f1Score: number;
  attributeAccuracies: {
    description: number;
    quantity: number;
    unit: number;
    unitPrice: number;
    discount: number;
    hsn: number;
    gstRate: number;
    taxAmount: number;
    lineTotal: number;
  };
}

export interface FinancialValidationResult {
  printedTotal: number;
  calculatedTotal: number;
  difference: number;
  isMathValid: boolean;
  hasDiscrepancies: boolean;
  discrepancySeverity: 'NONE' | 'ROUNDING_TOLERANCE' | 'MATERIAL';
}

export interface TaxAccuracyMetrics {
  intraStateCorrect: boolean;
  interStateCorrect: boolean;
  cgstAccuracy: number;
  sgstAccuracy: number;
  igstAccuracy: number;
  cessAccuracy: number;
  overallTaxAccuracy: number;
}

export interface MatchingMetrics {
  vendorMatchingMethod: string;
  vendorMatchStatus: string;
  vendorMatchedCorrectly: boolean;
  productMatchStatuses: {
    skuOrCode: string | null;
    status: string;
    matchedCorrectly: boolean;
  }[];
  verifiedCount: number;
  reviewRequiredCount: number;
  missingCount: number;
}

export interface ConfidenceCalibrationBucket {
  bucketRange: string; // e.g., '0.90-1.00'
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
}

export type FailureCategory =
  | 'OCR_READING_ERROR'
  | 'WRONG_FIELD_ASSOCIATION'
  | 'MISSING_FIELD'
  | 'HALLUCINATED_FIELD'
  | 'LINE_DETECTION_ERROR'
  | 'TAX_INTERPRETATION_ERROR'
  | 'DATE_INTERPRETATION_ERROR'
  | 'VENDOR_MATCHING_ERROR'
  | 'PRODUCT_MATCHING_ERROR'
  | 'FINANCIAL_RECONCILIATION_DISCREPANCY'
  | 'DOCUMENT_PREPROCESSING_ISSUE'
  | 'API_FAILURE_OR_TIMEOUT';

export interface FailureRecord {
  documentId: string;
  category: FailureCategory;
  fieldOrItem: string;
  expected: any;
  actual: any;
  explanation: string;
}

export interface BenchmarkEvaluationReport {
  timestamp: string;
  datasetSize: number;
  documentTypesTested: string[];
  fieldAccuracies: {
    headerAccuracy: number;
    vendorAccuracy: number;
    invoiceAccuracy: number;
    lineItemsAccuracy: number;
    taxAccuracy: number;
    summaryAccuracy: number;
    paymentAccuracy: number;
    overallFieldAccuracy: number;
  };
  lineItemPerformance: {
    overallRecall: number;
    overallPrecision: number;
    overallF1: number;
    missedLinesTotal: number;
    extraLinesTotal: number;
    mergedLinesTotal: number;
    splitLinesTotal: number;
  };
  financialPerformance: {
    exactMatchCount: number;
    roundingMatchCount: number;
    materialDiscrepancyCount: number;
    exactMatchRate: number;
  };
  matchingPerformance: {
    vendorVerifiedRate: number;
    vendorReviewRequiredRate: number;
    productVerifiedRate: number;
    productReviewRequiredRate: number;
  };
  confidenceCalibration: ConfidenceCalibrationBucket[];
  adversarialDefense: {
    injectionAttemptCount: number;
    injectionsResistedCount: number;
    defenseSuccessRate: number;
  };
  failureTaxonomy: Record<FailureCategory, number>;
  failures: FailureRecord[];
}
