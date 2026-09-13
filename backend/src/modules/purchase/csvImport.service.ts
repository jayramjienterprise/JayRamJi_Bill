import { Types } from 'mongoose';
import Product from '../../database/models/Product';
import { matchProductToInventory } from './billExtraction.service';

export interface ParsedCsvRow {
  rowNumber: number;
  rawText: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPurchasePrice: number;
  discountPercent: number;
  taxRate: number;
  totalAmount: number;
  matchedProductId?: string;
  matchedProductName?: string;
  isValid: boolean;
  errors: string[];
}

export interface ParseCsvResult {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: ParsedCsvRow[];
}

/**
 * Parses CSV lines for purchase items import
 */
export async function parsePurchaseItemsCsv(
  csvContent: string,
  businessId: string | Types.ObjectId
): Promise<ParseCsvResult> {
  const products = await Product.find({ businessId, active: { $ne: false } })
    .select('_id name sku defaultPriceMinor')
    .lean();

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      totalRows: 0,
      validRowsCount: 0,
      invalidRowsCount: 0,
      rows: [],
    };
  }

  // Check header line
  let startIndex = 0;
  const firstLineLower = lines[0].toLowerCase();
  if (
    firstLineLower.includes('product') ||
    firstLineLower.includes('item') ||
    firstLineLower.includes('qty') ||
    firstLineLower.includes('price') ||
    firstLineLower.includes('sku')
  ) {
    startIndex = 1; // skip header
  }

  const resultRows: ParsedCsvRow[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    const columns = rawLine.split(',').map((col) => col.trim().replace(/^["']|["']$/g, ''));

    // Expected format:
    // [0] Product Name, [1] SKU (optional), [2] Quantity, [3] Unit Price, [4] Discount %, [5] Tax %
    const rowErrors: string[] = [];

    const rawName = columns[0] || '';
    const rawSku = columns[1] || '';
    const rawQty = parseFloat(columns[2] || '0');
    const rawPrice = parseFloat(columns[3] || '0');
    const rawDiscount = parseFloat(columns[4] || '0');
    const rawTax = parseFloat(columns[5] || '18');

    if (!rawName && !rawSku) {
      rowErrors.push('Product Name or SKU is required');
    }

    if (isNaN(rawQty) || rawQty <= 0) {
      rowErrors.push('Quantity must be greater than 0');
    }

    if (isNaN(rawPrice) || rawPrice < 0) {
      rowErrors.push('Unit Price cannot be negative');
    }

    // Try finding matching product in inventory
    const searchParam = rawSku || rawName;
    const match = await matchProductToInventory(searchParam, businessId, products);

    let totalAmount = 0;
    if (rowErrors.length === 0) {
      const lineSubtotal = rawQty * rawPrice;
      const discountAmt = (lineSubtotal * (isNaN(rawDiscount) ? 0 : rawDiscount)) / 100;
      const taxable = lineSubtotal - discountAmt;
      const taxAmt = (taxable * (isNaN(rawTax) ? 18 : rawTax)) / 100;
      totalAmount = Math.round((taxable + taxAmt) * 100) / 100;
    }

    resultRows.push({
      rowNumber: i + 1,
      rawText: rawLine,
      productName: rawName || match.matchedProductName || 'Unnamed Product',
      sku: rawSku || match.matchedSku,
      quantity: isNaN(rawQty) ? 0 : rawQty,
      unitPurchasePrice: isNaN(rawPrice) ? 0 : rawPrice,
      discountPercent: isNaN(rawDiscount) ? 0 : Math.max(0, rawDiscount),
      taxRate: isNaN(rawTax) ? 18 : Math.max(0, rawTax),
      totalAmount,
      matchedProductId: match.matchedProductId,
      matchedProductName: match.matchedProductName,
      isValid: rowErrors.length === 0,
      errors: rowErrors,
    });
  }

  const validRowsCount = resultRows.filter((r) => r.isValid).length;
  const invalidRowsCount = resultRows.length - validRowsCount;

  return {
    totalRows: resultRows.length,
    validRowsCount,
    invalidRowsCount,
    rows: resultRows,
  };
}
