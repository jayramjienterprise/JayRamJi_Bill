import { z } from 'zod';
import { IPurchaseBillExtraction } from '../../../database/models/PurchaseDraft';


/**
 * Bounding box coordinate tuple [ymin, xmin, ymax, xmax] (normalized 0 to 1000 or 0 to 1)
 */
export const rawBoundingBoxSchema = z.union([
  z.tuple([z.number(), z.number(), z.number(), z.number()]),
  z.object({
    ymin: z.number(),
    xmin: z.number(),
    ymax: z.number(),
    xmax: z.number(),
  }).transform((b) => [b.ymin, b.xmin, b.ymax, b.xmax] as [number, number, number, number]),
]);

export const rawNimSupplierSchema = z.object({
  name: z.string().nullable().optional(),
  legalName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  stateCode: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  pan: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
}).passthrough().default({});

export const rawNimBuyerSchema = z.object({
  name: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  stateCode: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
}).passthrough().default({});

export const rawNimInvoiceSchema = z.object({
  invoiceNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  poNumber: z.string().nullable().optional(),
  ewayBillNumber: z.string().nullable().optional(),
  placeOfSupply: z.string().nullable().optional(),
  isReverseCharge: z.union([z.boolean(), z.string()]).nullable().optional(),
  alternativeDates: z.array(z.string()).nullable().optional(),
  dateConflict: z.boolean().nullable().optional(),
}).passthrough().default({});

export const rawNimLineItemSchema = z.object({
  lineNumber: z.union([z.number(), z.string()]).nullable().optional(),
  description: z.string().nullable().optional(),
  skuOrCode: z.string().nullable().optional(),
  hsnSac: z.string().nullable().optional(),
  quantity: z.union([z.number(), z.string()]).nullable().optional(),
  unit: z.string().nullable().optional(),
  unitPrice: z.union([z.number(), z.string()]).nullable().optional(),
  discountPercent: z.union([z.number(), z.string()]).nullable().optional(),
  discountAmount: z.union([z.number(), z.string()]).nullable().optional(),
  taxableAmount: z.union([z.number(), z.string()]).nullable().optional(),
  gstRate: z.union([z.number(), z.string()]).nullable().optional(),
  cgstRate: z.union([z.number(), z.string()]).nullable().optional(),
  cgstAmount: z.union([z.number(), z.string()]).nullable().optional(),
  sgstRate: z.union([z.number(), z.string()]).nullable().optional(),
  sgstAmount: z.union([z.number(), z.string()]).nullable().optional(),
  igstRate: z.union([z.number(), z.string()]).nullable().optional(),
  igstAmount: z.union([z.number(), z.string()]).nullable().optional(),
  cessRate: z.union([z.number(), z.string()]).nullable().optional(),
  cessAmount: z.union([z.number(), z.string()]).nullable().optional(),
  lineTotal: z.union([z.number(), z.string()]).nullable().optional(),
  pageNumber: z.number().int().min(1).nullable().optional(),
  bbox: rawBoundingBoxSchema.nullable().optional(),
}).passthrough();

export const rawNimSummarySchema = z.object({
  subtotal: z.union([z.number(), z.string()]).nullable().optional(),
  totalDiscount: z.union([z.number(), z.string()]).nullable().optional(),
  taxableAmount: z.union([z.number(), z.string()]).nullable().optional(),
  cgstRate: z.union([z.number(), z.string()]).nullable().optional(),
  cgstAmount: z.union([z.number(), z.string()]).nullable().optional(),
  sgstRate: z.union([z.number(), z.string()]).nullable().optional(),
  sgstAmount: z.union([z.number(), z.string()]).nullable().optional(),
  igstRate: z.union([z.number(), z.string()]).nullable().optional(),
  igstAmount: z.union([z.number(), z.string()]).nullable().optional(),
  cessAmount: z.union([z.number(), z.string()]).nullable().optional(),
  totalTax: z.union([z.number(), z.string()]).nullable().optional(),
  roundOff: z.union([z.number(), z.string()]).nullable().optional(),
  grandTotal: z.union([z.number(), z.string()]).nullable().optional(),
  amountPaid: z.union([z.number(), z.string()]).nullable().optional(),
  balanceDue: z.union([z.number(), z.string()]).nullable().optional(),
}).passthrough().default({});

export const rawNimPaymentSchema = z.object({
  paymentMode: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankIfsc: z.string().nullable().optional(),
  upiId: z.string().nullable().optional(),
  transactionReference: z.string().nullable().optional(),
}).passthrough().default({});

export const rawNimAdditionalSchema = z.object({
  notes: z.string().nullable().optional(),
  termsAndConditions: z.string().nullable().optional(),
  vehicleNumber: z.string().nullable().optional(),
}).passthrough().default({});

export const rawNimExtractionResponseSchema = z.object({
  supplier: rawNimSupplierSchema,
  buyer: rawNimBuyerSchema.optional(),
  invoice: rawNimInvoiceSchema,
  items: z.array(rawNimLineItemSchema).default([]),
  summary: rawNimSummarySchema,
  payment: rawNimPaymentSchema,
  additional: rawNimAdditionalSchema,
}).passthrough();

export type RawNimExtractionResponse = z.infer<typeof rawNimExtractionResponseSchema>;
export type RawNimLineItem = z.infer<typeof rawNimLineItemSchema>;

export interface NimDocumentPagePayload {
  pageNumber: number;
  mimeType: 'image/png';
  base64Data: string;
}

export interface NimExtractionRequest {
  model: string;
  pages: NimDocumentPagePayload[];
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface NimExtractionResult {
  rawResponse: RawNimExtractionResponse;
  normalizedExtraction: IPurchaseBillExtraction;
  metadata: {
    durationMs: number;
    modelUsed: string;
    pageCount: number;
    warnings: string[];
    repaired: boolean;
    retryAttempted?: boolean;
    initialNimDurationMs?: number;
    initialParseDurationMs?: number;
    repairNimDurationMs?: number;
    repairParseDurationMs?: number;
    retryNimDurationMs?: number;
    retryParseDurationMs?: number;
  };
}
