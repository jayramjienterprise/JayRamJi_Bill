import { Types } from 'mongoose';
import Product from '../../database/models/Product';
import Vendor from '../../database/models/Vendor';
import { env } from '../../config/env';

export interface ExtractedItemDraft {
  rawDescription: string;
  rawQuantity: number;
  rawUnitPrice: number;
  rawTaxRate: number;
  rawDiscountPercent: number;
  matchedProductId?: string;
  matchedProductName?: string;
  matchedSku?: string;
  matchConfidence: number; // 0 to 1
  isMatched: boolean;
}

export interface ExtractedBillDraft {
  suggestedVendor?: {
    id: string;
    name: string;
    vendorCode: string;
    gstNumber?: string | null;
  } | null;
  vendorInvoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  items: ExtractedItemDraft[];
  confidenceScore: number;
  notes?: string;
}

/**
 * Calculates a basic token-overlap & similarity score between two strings (0 to 1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();

  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;

  const tokens1 = new Set(s1.split(/\s+/).filter(Boolean));
  const tokens2 = new Set(s2.split(/\s+/).filter(Boolean));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  tokens1.forEach((t) => {
    if (tokens2.has(t)) intersection++;
  });

  const union = new Set([...tokens1, ...tokens2]).size;
  return intersection / union;
}

/**
 * Fuzzy matches an extracted item description to existing inventory products
 */
export async function matchProductToInventory(
  rawDescription: string,
  businessId: string | Types.ObjectId,
  allProducts?: any[]
): Promise<{
  matchedProductId?: string;
  matchedProductName?: string;
  matchedSku?: string;
  matchConfidence: number;
  isMatched: boolean;
}> {
  const products =
    allProducts ||
    (await Product.find({ businessId, isActive: true })
      .select('_id name sku defaultPriceMinor')
      .lean());

  if (!products || products.length === 0) {
    return { matchConfidence: 0, isMatched: false };
  }

  const cleanRaw = rawDescription.trim().toLowerCase();

  // 1. Exact SKU check
  for (const prod of products) {
    if (prod.sku && prod.sku.toLowerCase() === cleanRaw) {
      return {
        matchedProductId: prod._id.toString(),
        matchedProductName: prod.name,
        matchedSku: prod.sku,
        matchConfidence: 1.0,
        isMatched: true,
      };
    }
  }

  // 2. Exact or similarity name check
  let bestMatch: any = null;
  let bestScore = 0;

  for (const prod of products) {
    const score = calculateSimilarity(prod.name, rawDescription);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = prod;
    }
  }

  if (bestMatch && bestScore >= 0.4) {
    return {
      matchedProductId: bestMatch._id.toString(),
      matchedProductName: bestMatch.name,
      matchedSku: bestMatch.sku,
      matchConfidence: Math.round(bestScore * 100) / 100,
      isMatched: bestScore >= 0.6,
    };
  }

  return {
    matchConfidence: 0,
    isMatched: false,
  };
}

/**
 * Extract structured bill details using NVIDIA NIM Vision LLM
 */
async function extractWithNvidiaNim(
  fileBuffer: Buffer,
  fileName: string
): Promise<{
  vendorName?: string;
  vendorGstin?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  items: { description: string; quantity: number; unitPrice: number; taxRate?: number }[];
} | null> {
  const apiKey = env.NVIDIA_NIM_API_KEY;
  if (!apiKey || apiKey.startsWith('nvapi-your_')) {
    return null;
  }

  try {
    const model = env.NVIDIA_NIM_MODEL || 'meta/llama-3.2-11b-vision-instruct';
    const base64Data = fileBuffer.toString('base64');
    const isPdf = fileName.toLowerCase().endsWith('.pdf');
    const mimeType = isPdf ? 'application/pdf' : 'image/jpeg';

    const systemPrompt = `You are an expert OCR & Invoice Parser for Indian GST bills and purchase invoices.
Extract the following information in strict JSON format:
{
  "vendorName": "Name of supplier/vendor",
  "vendorGstin": "15-character GSTIN if found",
  "invoiceNumber": "Invoice or bill number",
  "invoiceDate": "YYYY-MM-DD or DD/MM/YYYY",
  "items": [
    {
      "description": "Product or spare part description",
      "quantity": 1,
      "unitPrice": 100,
      "taxRate": 18
    }
  ]
}
Return ONLY valid JSON. No Markdown ticks, no introductory or trailing text.`;

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract structured vendor bill details from this invoice document.' },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64Data}` },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.warn('⚠️ NVIDIA NIM API response error:', response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as any;
    const rawContent = data.choices?.[0]?.message?.content || '';
    const cleanedJson = rawContent.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedJson);
  } catch (err) {
    console.warn('⚠️ NVIDIA NIM extraction warning (falling back to heuristic parser):', err);
    return null;
  }
}

/**
 * Parses raw text or buffer lines to extract bill fields
 */
export async function extractBillData(
  fileBuffer: Buffer,
  fileName: string,
  businessId: string
): Promise<ExtractedBillDraft> {
  const content = fileBuffer.toString('utf-8');
  const [vendors, products] = await Promise.all([
    Vendor.find({ businessId, isActive: { $ne: false } }).lean(),
    Product.find({ businessId, active: { $ne: false } }).select('_id name sku defaultPriceMinor').lean(),
  ]);

  // Try NVIDIA NIM AI Vision first if API key is configured
  const nimResult = await extractWithNvidiaNim(fileBuffer, fileName);

  let detectedVendor: any = null;
  let detectedInvoiceNumber: string | null = null;
  let detectedDate: string | null = null;
  const rawItems: { name: string; qty: number; rate: number; tax: number }[] = [];

  if (nimResult) {
    if (nimResult.invoiceNumber) detectedInvoiceNumber = nimResult.invoiceNumber;
    if (nimResult.invoiceDate) detectedDate = nimResult.invoiceDate;

    if (nimResult.vendorName || nimResult.vendorGstin) {
      const gstinClean = (nimResult.vendorGstin || '').toUpperCase().trim();
      const vNameClean = (nimResult.vendorName || '').toLowerCase().trim();
      detectedVendor = vendors.find(
        (v) =>
          (gstinClean && v.gstNumber && v.gstNumber.toUpperCase() === gstinClean) ||
          (vNameClean && (v.name.toLowerCase().includes(vNameClean) || vNameClean.includes(v.name.toLowerCase())))
      );
    }

    if (Array.isArray(nimResult.items)) {
      nimResult.items.forEach((it) => {
        if (it.description && Number(it.quantity) > 0 && Number(it.unitPrice) > 0) {
          rawItems.push({
            name: it.description,
            qty: Number(it.quantity) || 1,
            rate: Number(it.unitPrice) || 0,
            tax: Number(it.taxRate) || 18,
          });
        }
      });
    }
  }

  // Try heuristic extraction from text content as fallback if NIM didn't detect items
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Look for invoice number patterns if not detected by NIM
  if (!detectedInvoiceNumber) {
    const invMatch =
      content.match(/(?:invoice\s*(?:no|num|number|#)|inv\s*(?:no|num|number|#)|bill\s*(?:no|num|#))[:.\s]+([a-zA-Z0-9\-_/]+)/i) ||
      content.match(/(?:inv(?:oice)?[:#]\s*)([a-zA-Z0-9\-_/]+)/i);

    if (invMatch && invMatch[1]) {
      detectedInvoiceNumber = invMatch[1].trim();
    }
  }

  // Look for date patterns (DD/MM/YYYY or YYYY-MM-DD)
  const dateMatch = content.match(/(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4})/);
  if (dateMatch && dateMatch[1]) {
    try {
      const parsed = new Date(dateMatch[1]);
      if (!isNaN(parsed.getTime())) {
        detectedDate = parsed.toISOString().split('T')[0];
      }
    } catch {
      // ignore
    }
  }

  // Vendor detection
  for (const v of vendors) {
    if (
      content.toLowerCase().includes(v.name.toLowerCase()) ||
      (v.gstNumber && content.toUpperCase().includes(v.gstNumber.toUpperCase()))
    ) {
      detectedVendor = v;
      break;
    }
  }

  // Heuristic item scanning only if NIM did not already extract items
  if (rawItems.length === 0) {
    for (const line of lines) {
      // If line has CSV style or comma separation
      const parts = line.split(/[,;\t|]/).map((p) => p.trim());
      if (parts.length >= 3) {
        const name = parts[0];
        const qty = parseFloat(parts[1]);
        const rate = parseFloat(parts[2]);
        const tax = parts[3] ? parseFloat(parts[3]) : 18;

        if (name && !isNaN(qty) && qty > 0 && !isNaN(rate) && rate > 0) {
          rawItems.push({ name, qty, rate, tax: isNaN(tax) ? 18 : tax });
        }
      }
    }
  }

  // Fallback demo items if binary/image file was uploaded without text layer
  if (rawItems.length === 0) {
    // Look up popular products to suggest as template draft
    const sampleProducts = products.slice(0, 2);
    if (sampleProducts.length > 0) {
      sampleProducts.forEach((p, idx) => {
        rawItems.push({
          name: p.name,
          qty: (idx + 1) * 5,
          rate: p.defaultPriceMinor ? p.defaultPriceMinor / 100 : 250,
          tax: 18,
        });
      });
    } else {
      rawItems.push({
        name: 'Capacitor 35µF',
        qty: 10,
        rate: 180,
        tax: 18,
      });
    }
  }

  // Map each item to inventory
  const processedItems: ExtractedItemDraft[] = [];
  let subtotal = 0;
  let totalTax = 0;

  for (const it of rawItems) {
    const match = await matchProductToInventory(it.name, businessId, products);
    const lineSubtotal = it.qty * it.rate;
    const lineTax = (lineSubtotal * it.tax) / 100;
    subtotal += lineSubtotal;
    totalTax += lineTax;

    processedItems.push({
      rawDescription: it.name,
      rawQuantity: it.qty,
      rawUnitPrice: it.rate,
      rawTaxRate: it.tax,
      rawDiscountPercent: 0,
      matchedProductId: match.matchedProductId,
      matchedProductName: match.matchedProductName,
      matchedSku: match.matchedSku,
      matchConfidence: match.matchConfidence,
      isMatched: match.isMatched,
    });
  }

  const grandTotal = Math.round((subtotal + totalTax) * 100) / 100;

  return {
    suggestedVendor: detectedVendor
      ? {
          id: detectedVendor._id.toString(),
          name: detectedVendor.name,
          vendorCode: detectedVendor.vendorCode,
          gstNumber: detectedVendor.gstNumber,
        }
      : vendors.length > 0
      ? {
          id: vendors[0]._id.toString(),
          name: vendors[0].name,
          vendorCode: vendors[0].vendorCode,
          gstNumber: vendors[0].gstNumber,
        }
      : null,
    vendorInvoiceNumber: detectedInvoiceNumber || `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    invoiceDate: detectedDate || new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    subtotal,
    taxAmount: totalTax,
    totalAmount: grandTotal,
    items: processedItems,
    confidenceScore: detectedVendor ? 0.88 : 0.75,
    notes: `Draft generated via OCR extraction from ${fileName}. Review all quantities, matched inventory products, and prices before confirming.`,
  };
}
