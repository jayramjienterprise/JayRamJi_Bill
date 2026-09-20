import { z } from 'zod';

// ----------------------------------------------------
// Base Primitive Schemas
// ----------------------------------------------------

export const fieldStatusSchema = z.enum([
  'EXTRACTED',
  'VERIFIED',
  'REVIEW_REQUIRED',
  'MISSING',
  'INVALID',
]);

export const boundingBoxSchema = z.object({
  pageNumber: z.number().int().min(1),
  box2d: z.tuple([z.number(), z.number(), z.number(), z.number()]),
});

/**
 * Generic factory for ExtractedField schema ensuring nullability and confidence bounds
 */
export function createExtractedFieldZodSchema<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema.nullable(),
    confidence: z.number().min(0).max(1),
    status: fieldStatusSchema,
    bbox: boundingBoxSchema.nullable().optional(),
    warning: z.string().nullable().optional(),
  });
}

// ----------------------------------------------------
// Extraction Component Schemas
// ----------------------------------------------------

export const supplierExtractionSchema = z.object({
  name: createExtractedFieldZodSchema(z.string()),
  gstin: createExtractedFieldZodSchema(z.string()),
  pan: createExtractedFieldZodSchema(z.string()),
  address: createExtractedFieldZodSchema(z.string()),
  city: createExtractedFieldZodSchema(z.string()),
  state: createExtractedFieldZodSchema(z.string()),
  stateCode: createExtractedFieldZodSchema(z.string()),
  pincode: createExtractedFieldZodSchema(z.string()),
  phone: createExtractedFieldZodSchema(z.string()),
  email: createExtractedFieldZodSchema(z.string()),
});

export const buyerExtractionSchema = z.object({
  name: createExtractedFieldZodSchema(z.string()),
  address: createExtractedFieldZodSchema(z.string()),
  city: createExtractedFieldZodSchema(z.string()),
  state: createExtractedFieldZodSchema(z.string()),
  stateCode: createExtractedFieldZodSchema(z.string()),
  pincode: createExtractedFieldZodSchema(z.string()),
  gstin: createExtractedFieldZodSchema(z.string()),
});

export const invoiceMetaExtractionSchema = z.object({
  invoiceNumber: createExtractedFieldZodSchema(z.string()),
  invoiceDate: createExtractedFieldZodSchema(z.string()),
  dueDate: createExtractedFieldZodSchema(z.string()),
  poNumber: createExtractedFieldZodSchema(z.string()),
  ewayBillNumber: createExtractedFieldZodSchema(z.string()),
  placeOfSupply: createExtractedFieldZodSchema(z.string()),
  isReverseCharge: createExtractedFieldZodSchema(z.boolean()),
  alternativeDates: z.array(z.string()).optional().default([]),
  dateConflict: z.boolean().optional().default(false),
});

export const productMatchAlternativeSchema = z.object({
  productId: z.string().min(1),
  productName: z.string(),
  sku: z.string().nullable(),
  score: z.number().min(0).max(1),
});

export const productMatchResultSchema = z.object({
  productId: z.string().nullable(),
  productName: z.string().nullable(),
  sku: z.string().nullable(),
  uom: z.string().nullable(),
  currentStock: z.number().nullable(),
  lastPurchasePrice: z.number().min(0).nullable(), // In Rupees
  matchingMethod: z.enum([
    'EXACT_SKU',
    'EXACT_BARCODE',
    'EXACT_NAME',
    'HSN_AND_DESCRIPTION',
    'FUZZY_DESCRIPTION',
    'UNMATCHED',
  ]),
  confidence: z.number().min(0).max(1),
  isMatched: z.boolean(),
  status: fieldStatusSchema,
  alternatives: z.array(productMatchAlternativeSchema).optional().default([]),
});

export const calculatedLineValuesSchema = z.object({
  taxableAmount: z.number().min(0),
  cgstAmount: z.number().min(0),
  sgstAmount: z.number().min(0),
  igstAmount: z.number().min(0),
  cessAmount: z.number().min(0),
  lineTotal: z.number().min(0),
  discrepancy: z.number(),
});

export const extractedLineItemSchema = z.object({
  id: z.string().min(1, 'Line item ID is required'),
  lineNumber: z.number().int().min(1),
  description: createExtractedFieldZodSchema(z.string()),
  skuOrCode: createExtractedFieldZodSchema(z.string()),
  hsnSac: createExtractedFieldZodSchema(z.string()),
  quantity: createExtractedFieldZodSchema(z.number().min(0, 'Quantity cannot be negative')),
  unit: createExtractedFieldZodSchema(z.string()),
  unitPrice: createExtractedFieldZodSchema(z.number().min(0, 'Unit price cannot be negative')),
  discountPercent: createExtractedFieldZodSchema(
    z.number().min(0, 'Discount % must be 0-100').max(100, 'Discount % must be 0-100')
  ),
  discountAmount: createExtractedFieldZodSchema(z.number().min(0, 'Discount amount cannot be negative')),
  taxableAmount: createExtractedFieldZodSchema(z.number().min(0, 'Taxable amount cannot be negative')),
  gstRate: createExtractedFieldZodSchema(z.number().min(0, 'GST rate cannot be negative')),
  cgstRate: createExtractedFieldZodSchema(z.number().min(0)),
  cgstAmount: createExtractedFieldZodSchema(z.number().min(0)),
  sgstRate: createExtractedFieldZodSchema(z.number().min(0)),
  sgstAmount: createExtractedFieldZodSchema(z.number().min(0)),
  igstRate: createExtractedFieldZodSchema(z.number().min(0)),
  igstAmount: createExtractedFieldZodSchema(z.number().min(0)),
  cessRate: createExtractedFieldZodSchema(z.number().min(0)),
  cessAmount: createExtractedFieldZodSchema(z.number().min(0)),
  lineTotal: createExtractedFieldZodSchema(z.number().min(0, 'Line total cannot be negative')),
  calculated: calculatedLineValuesSchema.optional(),
  productMatch: productMatchResultSchema.optional(),
});

export const summaryExtractionSchema = z.object({
  subtotal: createExtractedFieldZodSchema(z.number().min(0, 'Subtotal cannot be negative')),
  totalDiscount: createExtractedFieldZodSchema(z.number().min(0, 'Total discount cannot be negative')),
  taxableAmount: createExtractedFieldZodSchema(z.number().min(0, 'Taxable amount cannot be negative')),
  cgstRate: createExtractedFieldZodSchema(z.number().min(0)).optional(),
  cgstAmount: createExtractedFieldZodSchema(z.number().min(0)),
  sgstRate: createExtractedFieldZodSchema(z.number().min(0)).optional(),
  sgstAmount: createExtractedFieldZodSchema(z.number().min(0)),
  igstRate: createExtractedFieldZodSchema(z.number().min(0)).optional(),
  igstAmount: createExtractedFieldZodSchema(z.number().min(0)),
  cessAmount: createExtractedFieldZodSchema(z.number().min(0)),
  totalTax: createExtractedFieldZodSchema(z.number().min(0)),
  roundOff: createExtractedFieldZodSchema(z.number()),
  grandTotal: createExtractedFieldZodSchema(z.number().min(0, 'Grand total cannot be negative')),
  amountPaid: createExtractedFieldZodSchema(z.number().min(0)),
  balanceDue: createExtractedFieldZodSchema(z.number()),
});

export const paymentDetailsExtractionSchema = z.object({
  paymentMode: createExtractedFieldZodSchema(
    z.enum(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT', 'OTHER'])
  ),
  bankName: createExtractedFieldZodSchema(z.string()),
  bankAccountNumber: createExtractedFieldZodSchema(z.string()),
  bankIfsc: createExtractedFieldZodSchema(z.string()),
  upiId: createExtractedFieldZodSchema(z.string()),
  transactionReference: createExtractedFieldZodSchema(z.string()),
});

export const additionalDetailsExtractionSchema = z.object({
  notes: createExtractedFieldZodSchema(z.string()),
  termsAndConditions: createExtractedFieldZodSchema(z.string()),
  vehicleNumber: createExtractedFieldZodSchema(z.string()),
});

export const purchaseBillExtractionSchema = z.object({
  supplier: supplierExtractionSchema,
  buyer: buyerExtractionSchema.optional(),
  invoice: invoiceMetaExtractionSchema,
  items: z.array(extractedLineItemSchema),
  summary: summaryExtractionSchema,
  payment: paymentDetailsExtractionSchema,
  additional: additionalDetailsExtractionSchema,
});

export const vendorMatchAlternativeSchema = z.object({
  vendorId: z.string().min(1),
  name: z.string(),
  gstNumber: z.string().nullable(),
  similarity: z.number().min(0).max(1),
});

export const vendorMatchResultSchema = z.object({
  matchedVendorId: z.string().nullable(),
  matchedVendorName: z.string().nullable(),
  matchedVendorGstin: z.string().nullable(),
  matchingMethod: z.enum([
    'EXACT_GSTIN',
    'PAN_MATCH',
    'EXACT_NAME',
    'FUZZY_NAME_OR_PHONE',
    'NO_MATCH',
  ]),
  confidence: z.number().min(0).max(1),
  status: fieldStatusSchema,
  alternatives: z.array(vendorMatchAlternativeSchema).optional().default([]),
});

export const draftReconciliationSchema = z.object({
  isMathValid: z.boolean(),
  hasDiscrepancies: z.boolean(),
  discrepancyNotes: z.array(z.string()),
  calculatedSubtotal: z.number(),
  calculatedTaxTotal: z.number(),
  calculatedGrandTotal: z.number(),
});

export const originalFileSchema = z.object({
  fileName: z.string().min(1),
  fileSize: z.number().min(1),
  mimeType: z.string().min(1),
  fileUrl: z.string().url(),
  publicId: z.string().min(1),
  pageCount: z.number().int().min(1).default(1),
  previewImages: z.array(z.string().url()).default([]),
});

// ----------------------------------------------------
// Complete PurchaseDraft Document Validation Schema
// ----------------------------------------------------

export const purchaseDraftSchema = z.object({
  businessId: z.string().min(1, 'Business ID is required'),
  draftNumber: z.string().min(1, 'Draft number is required'),
  originalFile: originalFileSchema,
  rawExtraction: purchaseBillExtractionSchema,
  extraction: purchaseBillExtractionSchema,
  reconciliation: draftReconciliationSchema,
  vendorMatch: vendorMatchResultSchema,
  status: z.enum([
    'PROCESSING',
    'DRAFT_READY',
    'VALIDATION_ERROR',
    'CONFIRMING',
    'CONVERTED',
    'EXPIRED',
  ]),
  idempotencyKey: z.string().nullable().optional(),
  confirmedPurchaseId: z.string().nullable().optional(),
  confirmedAt: z.date().nullable().optional(),
  confirmedBy: z.string().nullable().optional(),
  createdBy: z.string().min(1, 'CreatedBy user ID is required'),
  expiresAt: z.date(),
});

// ----------------------------------------------------
// Security: Separation of Editable vs Protected Fields
// ----------------------------------------------------

/**
 * List of server-controlled fields that MUST NEVER be accepted from client updates
 */
export const SERVER_CONTROLLED_DRAFT_FIELDS = [
  'businessId',
  'draftNumber',
  'originalFile',
  'rawExtraction',
  'reconciliation',
  'status',
  'createdBy',
  'confirmedPurchaseId',
  'confirmedAt',
  'confirmedBy',
  'expiresAt',
  'createdAt',
  'updatedAt',
] as const;

export const editableDraftLineItemSchema = z.object({
  id: z.string().min(1),
  lineNumber: z.number().int().min(1).optional(),
  productId: z.string().nullable().optional(),
  description: z.string().optional(),
  skuOrCode: z.string().nullable().optional(),
  hsnSac: z.string().nullable().optional(),
  quantity: z.number().min(0, 'Quantity cannot be negative').optional(),
  unit: z.string().nullable().optional(),
  unitPrice: z.number().min(0, 'Unit price cannot be negative').optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  taxRate: z.number().min(0).optional(),
});

export const editableDraftSummarySchema = z.object({
  subtotal: z.number().min(0).optional(),
  totalDiscount: z.number().min(0).optional(),
  taxableAmount: z.number().min(0).optional(),
  cgstRate: z.number().min(0).optional(),
  cgstAmount: z.number().min(0).optional(),
  sgstRate: z.number().min(0).optional(),
  sgstAmount: z.number().min(0).optional(),
  igstRate: z.number().min(0).optional(),
  igstAmount: z.number().min(0).optional(),
  totalTax: z.number().min(0).optional(),
  roundOff: z.number().optional(),
  grandTotal: z.number().min(0).optional(),
});

export const userCorrectionEntrySchema = z.object({
  field: z.string(),
  originalValue: z.any().optional(),
  newValue: z.any().optional(),
  changedAt: z.string().or(z.date()).optional(),
  reason: z.string().nullable().optional(),
});

/**
 * Zod schema defining strictly the allowed user-editable draft update payload
 */
export const editableDraftFieldsSchema = z
  .object({
    vendorId: z.string().nullable().optional(),
    vendorInvoiceNumber: z.string().trim().nullable().optional(),
    invoiceDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    poNumber: z.string().trim().nullable().optional(),
    ewayBillNumber: z.string().trim().nullable().optional(),
    placeOfSupply: z.string().trim().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
    items: z.array(editableDraftLineItemSchema).optional(),
    summary: editableDraftSummarySchema.optional(),
    manualOverride: z.boolean().optional(),
    userCorrections: z.array(userCorrectionEntrySchema).optional(),
    // Client can explicitly acknowledge duplicate invoice warning
    allowDuplicateInvoice: z.boolean().optional(),
  })
  .strict(); // Rejects any payload containing unexpected or server-controlled fields!

export const confirmDraftSchema = z.object({
  vendorId: z.string().nullable().optional(),
  vendorInvoiceNumber: z.string().trim().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  purchaseDate: z.string().nullable().optional(),
  purchaseType: z.enum(['DIRECT_PURCHASE', 'ORDERED_PURCHASE']).default('DIRECT_PURCHASE'),
  directReceivedFull: z.boolean().default(false),
  paymentMethod: z.string().nullable().optional(),
  paymentReference: z.string().nullable().optional(),
  allowDuplicateInvoice: z.boolean().default(false),
  notes: z.string().trim().nullable().optional(),
  manualOverride: z.boolean().optional(),
  summary: editableDraftSummarySchema.optional(),
  items: z
    .array(
      editableDraftLineItemSchema.extend({
        orderedQuantity: z.number().min(0).optional(),
        unitPurchasePrice: z.number().min(0).optional(),
      })
    )
    .optional(),
});

export type EditableDraftFields = z.infer<typeof editableDraftFieldsSchema>;
export type ConfirmDraftInput = z.infer<typeof confirmDraftSchema>;
