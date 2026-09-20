import { Types } from 'mongoose';
import { Product } from '../../../database/models/Product';
import { FieldStatus, IProductMatchAlternative } from '../../../database/models/PurchaseDraft';
import {
  normalizeSku,
  normalizeBarcode,
  normalizeProductName,
  normalizeUom,
  calculateHybridSimilarity,
  detectSpecificationConflicts,
} from './similarityUtils';

export interface ProductMatchInput {
  businessId: string | Types.ObjectId;
  description?: string | null;
  skuOrCode?: string | null;
  barcode?: string | null;
  hsnSac?: string | null;
  unit?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
}

/**
 * CANONICAL MATCH SCORE SEMANTICS:
 * - matchingScore: Deterministic heuristic score (0.0 to 1.0) indicating rule/similarity strength.
 * - confidence: Mirrors matchingScore for Phase 2A schema compatibility ONLY.
 *   CRITICAL: It is NOT a calibrated probability.
 */
export interface ProductMatchExecutionResult {
  productId: string | null;
  productName: string | null;
  sku: string | null;
  uom: string | null;
  currentStock: number | null;
  lastPurchasePrice: number | null; // in decimal Rupees
  matchingMethod:
    | 'EXACT_SKU'
    | 'EXACT_BARCODE'
    | 'EXACT_NAME'
    | 'HSN_AND_DESCRIPTION'
    | 'FUZZY_DESCRIPTION'
    | 'UNMATCHED';
  matchingScore: number;
  confidence: number; // Mirrors matchingScore for Phase 2A backward compatibility
  isMatched: boolean;
  status: FieldStatus;
  reason: string;
  alternatives: IProductMatchAlternative[];
}

export const DEFAULT_PRODUCT_MIN_FUZZY_SCORE = 0.60;
export const DEFAULT_PRODUCT_AMBIGUITY_MARGIN = 0.10;
export const DEFAULT_PRODUCT_MAX_ALTERNATIVES = 5;

/**
 * Deterministic, Tenant-Scoped Product Matching Engine.
 *
 * READ ONLY: Never creates, updates, or mutates any Product in the database.
 * NEVER selects an arbitrary product fallback.
 */
export async function matchProduct(
  input: ProductMatchInput,
  options?: {
    minFuzzyScore?: number;
    ambiguityMargin?: number;
    maxAlternatives?: number;
    cachedProducts?: any[];
  }
): Promise<ProductMatchExecutionResult> {
  const minFuzzyScore = options?.minFuzzyScore ?? DEFAULT_PRODUCT_MIN_FUZZY_SCORE;
  const ambiguityMargin = options?.ambiguityMargin ?? DEFAULT_PRODUCT_AMBIGUITY_MARGIN;
  const maxAlternatives = options?.maxAlternatives ?? DEFAULT_PRODUCT_MAX_ALTERNATIVES;

  if (!input.businessId) {
    return {
      productId: null,
      productName: null,
      sku: null,
      uom: null,
      currentStock: null,
      lastPurchasePrice: null,
      matchingMethod: 'UNMATCHED',
      matchingScore: 0,
      confidence: 0,
      isMatched: false,
      status: 'MISSING',
      reason: 'businessId is required for tenant-scoped product matching.',
      alternatives: [],
    };
  }

  const bId =
    typeof input.businessId === 'string'
      ? new Types.ObjectId(input.businessId)
      : input.businessId;

  // 1. Fetch only active, non-deleted products strictly scoped to the tenant businessId
  const activeProducts: any[] =
    options?.cachedProducts ??
    (await Product.find({
      businessId: bId,
      active: true,
      deletedAt: null,
    })
      .select('_id name sku description uom defaultPriceMinor lastPurchasePriceMinor stockQuantity hsnCode barcode active deletedAt')
      .lean());

  if (!activeProducts || activeProducts.length === 0) {
    return {
      productId: null,
      productName: null,
      sku: null,
      uom: null,
      currentStock: null,
      lastPurchasePrice: null,
      matchingMethod: 'UNMATCHED',
      matchingScore: 0,
      confidence: 0,
      isMatched: false,
      status: 'MISSING',
      reason: 'No active products found in inventory for this business tenant.',
      alternatives: [],
    };
  }

  // Pre-normalize inputs
  const normalizedInputSku = normalizeSku(input.skuOrCode);
  const normalizedInputBarcode = normalizeBarcode(input.barcode);
  const normalizedInputName = normalizeProductName(input.description);
  const cleanInputHsn = input.hsnSac ? input.hsnSac.trim() : null;
  const normalizedInputUom = normalizeUom(input.unit);

  const buildResult = (
    matched: any,
    method: ProductMatchExecutionResult['matchingMethod'],
    score: number,
    status: FieldStatus,
    baseReason: string,
    alternatives: IProductMatchAlternative[] = []
  ): ProductMatchExecutionResult => {
    let finalReason = baseReason;

    // Check UOM discrepancy as supporting context
    if (normalizedInputUom && matched.uom) {
      const prodUom = normalizeUom(matched.uom);
      if (prodUom && prodUom !== normalizedInputUom) {
        finalReason += ` Warning: Invoice unit (${normalizedInputUom}) differs from catalog UOM (${prodUom}).`;
      }
    }

    // Check HSN conflict if catalog product has hsnCode
    if (cleanInputHsn && matched.hsnCode) {
      const prodHsn = matched.hsnCode.toString().trim();
      if (prodHsn && prodHsn !== cleanInputHsn) {
        finalReason += ` Warning: Extracted HSN (${cleanInputHsn}) differs from catalog HSN (${prodHsn}).`;
      }
    }

    const lastPriceRupees =
      matched.lastPurchasePriceMinor !== null && matched.lastPurchasePriceMinor !== undefined
        ? matched.lastPurchasePriceMinor / 100
        : matched.defaultPriceMinor !== null && matched.defaultPriceMinor !== undefined
        ? matched.defaultPriceMinor / 100
        : null;

    return {
      productId: matched._id.toString(),
      productName: matched.name,
      sku: matched.sku || null,
      uom: matched.uom || null,
      currentStock: matched.stockQuantity ?? null,
      lastPurchasePrice: lastPriceRupees,
      matchingMethod: method,
      matchingScore: score,
      confidence: score,
      isMatched: true,
      status,
      reason: finalReason,
      alternatives,
    };
  };

  // ----------------------------------------------------
  // TIER 1: Exact SKU / Catalog Code Match
  // ----------------------------------------------------
  if (normalizedInputSku) {
    const skuMatches = activeProducts.filter((p) => {
      const pSku = normalizeSku(p.sku);
      return pSku && pSku === normalizedInputSku;
    });

    if (skuMatches.length === 1) {
      return buildResult(
        skuMatches[0],
        'EXACT_SKU',
        1.0,
        'VERIFIED',
        'Exact match on SKU / catalog code.'
      );
    }

    if (skuMatches.length > 1) {
      return {
        productId: null,
        productName: null,
        sku: null,
        uom: null,
        currentStock: null,
        lastPurchasePrice: null,
        matchingMethod: 'EXACT_SKU',
        matchingScore: 1.0,
        confidence: 1.0,
        isMatched: false,
        status: 'REVIEW_REQUIRED',
        reason: 'Multiple active products share the same SKU code.',
        alternatives: skuMatches.slice(0, maxAlternatives).map((p) => ({
          productId: p._id.toString(),
          productName: p.name,
          sku: p.sku || null,
          score: 1.0,
        })),
      };
    }
  }

  // ----------------------------------------------------
  // TIER 2: Exact Barcode Match
  // ----------------------------------------------------
  if (normalizedInputBarcode) {
    const barcodeMatches = activeProducts.filter((p) => {
      const pBarcode = normalizeBarcode(p.barcode);
      return pBarcode && pBarcode === normalizedInputBarcode;
    });

    if (barcodeMatches.length === 1) {
      return buildResult(
        barcodeMatches[0],
        'EXACT_BARCODE',
        1.0,
        'VERIFIED',
        'Exact match on barcode.'
      );
    }

    if (barcodeMatches.length > 1) {
      return {
        productId: null,
        productName: null,
        sku: null,
        uom: null,
        currentStock: null,
        lastPurchasePrice: null,
        matchingMethod: 'EXACT_BARCODE',
        matchingScore: 1.0,
        confidence: 1.0,
        isMatched: false,
        status: 'REVIEW_REQUIRED',
        reason: 'Multiple active products share the same barcode.',
        alternatives: barcodeMatches.slice(0, maxAlternatives).map((p) => ({
          productId: p._id.toString(),
          productName: p.name,
          sku: p.sku || null,
          score: 1.0,
        })),
      };
    }
  }

  // ----------------------------------------------------
  // TIER 3: Exact Normalized Product Name Match
  // ----------------------------------------------------
  if (normalizedInputName) {
    const nameMatches = activeProducts.filter((p) => {
      return normalizeProductName(p.name) === normalizedInputName;
    });

    if (nameMatches.length === 1) {
      return buildResult(
        nameMatches[0],
        'EXACT_NAME',
        0.95,
        'REVIEW_REQUIRED', // Exact name requires review; unique identifier needed for VERIFIED
        'Exact match on normalized product name.'
      );
    }

    if (nameMatches.length > 1) {
      return {
        productId: null,
        productName: null,
        sku: null,
        uom: null,
        currentStock: null,
        lastPurchasePrice: null,
        matchingMethod: 'EXACT_NAME',
        matchingScore: 0.95,
        confidence: 0.95,
        isMatched: false,
        status: 'REVIEW_REQUIRED',
        reason: 'Multiple active products share the exact same normalized name.',
        alternatives: nameMatches.slice(0, maxAlternatives).map((p) => ({
          productId: p._id.toString(),
          productName: p.name,
          sku: p.sku || null,
          score: 0.95,
        })),
      };
    }
  }

  // ----------------------------------------------------
  // TIER 4: HSN + Description Similarity Match
  // ----------------------------------------------------
  if (cleanInputHsn) {
    const hsnMatches = activeProducts.filter((p) => {
      return p.hsnCode && p.hsnCode.toString().trim() === cleanInputHsn;
    });

    if (hsnMatches.length > 0) {
      if (!normalizedInputName) {
        // HSN alone must NEVER automatically identify a product!
        return {
          productId: null,
          productName: null,
          sku: null,
          uom: null,
          currentStock: null,
          lastPurchasePrice: null,
          matchingMethod: 'UNMATCHED',
          matchingScore: 0.50,
          confidence: 0.50,
          isMatched: false,
          status: 'REVIEW_REQUIRED',
          reason: 'HSN code alone cannot identify a specific product without description evidence.',
          alternatives: hsnMatches.slice(0, maxAlternatives).map((p) => ({
            productId: p._id.toString(),
            productName: p.name,
            sku: p.sku || null,
            score: 0.50,
          })),
        };
      }

      // Compute description similarity among HSN matching candidates
      const scoredHsnCandidates = hsnMatches
        .map((p) => {
          const nameSim = calculateHybridSimilarity(normalizedInputName, normalizeProductName(p.name));
          const descSim = p.description
            ? calculateHybridSimilarity(normalizedInputName, normalizeProductName(p.description))
            : 0;
          const score = Math.max(nameSim, descSim);
          return { product: p, score };
        })
        .sort((a, b) => b.score - a.score);

      const topHsn = scoredHsnCandidates[0];

      // If HSN matches but description strongly conflicts (< 0.30), reject auto-match
      if (topHsn.score < 0.30) {
        return {
          productId: null,
          productName: null,
          sku: null,
          uom: null,
          currentStock: null,
          lastPurchasePrice: null,
          matchingMethod: 'UNMATCHED',
          matchingScore: topHsn.score,
          confidence: topHsn.score,
          isMatched: false,
          status: 'REVIEW_REQUIRED',
          reason: 'HSN matches catalog category, but product description strongly conflicts.',
          alternatives: scoredHsnCandidates.slice(0, maxAlternatives).map((c) => ({
            productId: c.product._id.toString(),
            productName: c.product.name,
            sku: c.product.sku || null,
            score: c.score,
          })),
        };
      }

      // If description similarity is strong (>= 0.65)
      if (topHsn.score >= 0.65) {
        const secondHsn = scoredHsnCandidates[1];
        const isAmbiguous = secondHsn && topHsn.score - secondHsn.score < ambiguityMargin;

        if (!isAmbiguous) {
          const compositeScore = Math.round((0.75 + topHsn.score * 0.20) * 100) / 100;
          const alternatives: IProductMatchAlternative[] = scoredHsnCandidates
            .slice(1, maxAlternatives)
            .map((c) => ({
              productId: c.product._id.toString(),
              productName: c.product.name,
              sku: c.product.sku || null,
              score: c.score,
            }));

          return buildResult(
            topHsn.product,
            'HSN_AND_DESCRIPTION',
            compositeScore,
            'REVIEW_REQUIRED',
            `Matched on HSN (${cleanInputHsn}) with supporting description similarity (${Math.round(topHsn.score * 100)}%).`,
            alternatives
          );
        }
      }
    }
  }

  // ----------------------------------------------------
  // TIER 5: Controlled Fuzzy Description Matching
  // ----------------------------------------------------
  if (normalizedInputName) {
    const scoredCandidates = activeProducts
      .map((p) => {
        const nameSim = calculateHybridSimilarity(normalizedInputName, normalizeProductName(p.name));
        const descSim = p.description
          ? calculateHybridSimilarity(normalizedInputName, normalizeProductName(p.description))
          : 0;
        const bestScore = Math.max(nameSim, descSim);
        return {
          product: p,
          score: bestScore,
        };
      })
      .filter((c) => c.score >= minFuzzyScore)
      .sort((a, b) => b.score - a.score);

    if (scoredCandidates.length > 0) {
      const top = scoredCandidates[0];
      const second = scoredCandidates[1];

      const isAmbiguous = second && top.score - second.score < ambiguityMargin;

      const alternatives: IProductMatchAlternative[] = scoredCandidates
        .slice(0, maxAlternatives)
        .map((c) => ({
          productId: c.product._id.toString(),
          productName: c.product.name,
          sku: c.product.sku || null,
          score: c.score,
        }));

      // Check for specification conflict on the top candidate
      const topSpecAnalysis = detectSpecificationConflicts(
        normalizedInputName,
        normalizeProductName(top.product.name)
      );

      if (topSpecAnalysis.hasConflict) {
        return {
          productId: null,
          productName: null,
          sku: null,
          uom: null,
          currentStock: null,
          lastPurchasePrice: null,
          matchingMethod: 'UNMATCHED',
          matchingScore: top.score,
          confidence: top.score,
          isMatched: false,
          status: 'REVIEW_REQUIRED',
          reason: `Conflicting product specification detected (${topSpecAnalysis.conflicts.join(', ')}). Requires manual verification.`,
          alternatives,
        };
      }

      if (!isAmbiguous && top.score >= minFuzzyScore) {
        return buildResult(
          top.product,
          'FUZZY_DESCRIPTION',
          top.score,
          'REVIEW_REQUIRED',
          `Fuzzy match on description (${Math.round(top.score * 100)}%).`,
          alternatives.slice(1)
        );
      }

      // Ambiguous candidates or below confident threshold
      return {
        productId: null,
        productName: null,
        sku: null,
        uom: null,
        currentStock: null,
        lastPurchasePrice: null,
        matchingMethod: 'UNMATCHED',
        matchingScore: top.score,
        confidence: top.score,
        isMatched: false,
        status: 'REVIEW_REQUIRED',
        reason: isAmbiguous
          ? `Ambiguous product candidates: top match score (${Math.round(top.score * 100)}%) is too close to runner-up (${Math.round(second.score * 100)}%).`
          : `Top candidate score (${Math.round(top.score * 100)}%) is below confident threshold.`,
        alternatives,
      };
    }
  }

  // ----------------------------------------------------
  // UNMATCHED
  // ----------------------------------------------------
  return {
    productId: null,
    productName: null,
    sku: null,
    uom: null,
    currentStock: null,
    lastPurchasePrice: null,
    matchingMethod: 'UNMATCHED',
    matchingScore: 0,
    confidence: 0,
    isMatched: false,
    status: 'MISSING',
    reason: 'No active product matched extracted description/SKU.',
    alternatives: [],
  };
}
