import { Types } from 'mongoose';
import { Vendor } from '../../../database/models/Vendor';
import { FieldStatus, IVendorMatchAlternative } from '../../../database/models/PurchaseDraft';
import {
  normalizeGstin,
  normalizePan,
  normalizePhone,
  normalizeVendorName,
  calculateHybridSimilarity,
} from './similarityUtils';

export interface VendorMatchInput {
  businessId: string | Types.ObjectId;
  name?: string | null;
  gstin?: string | null;
  pan?: string | null;
  phone?: string | null;
  address?: string | null;
  state?: string | null;
}

/**
 * CANONICAL MATCH SCORE SEMANTICS:
 * - matchingScore: Deterministic heuristic score (0.0 to 1.0) indicating rule/similarity strength.
 * - confidence: Mirrors matchingScore for Phase 2A schema compatibility ONLY.
 *   CRITICAL: It is NOT a calibrated probability.
 */
export interface VendorMatchExecutionResult {
  matchedVendorId: string | null;
  matchedVendorName: string | null;
  matchedVendorGstin: string | null;
  matchingMethod: 'EXACT_GSTIN' | 'PAN_MATCH' | 'EXACT_NAME' | 'FUZZY_NAME_OR_PHONE' | 'NO_MATCH';
  matchingScore: number;
  confidence: number; // Mirrors matchingScore for Phase 2A backward compatibility
  status: FieldStatus;
  reason: string;
  alternatives: IVendorMatchAlternative[];
}

export const DEFAULT_VENDOR_MIN_FUZZY_SCORE = 0.60;
export const DEFAULT_VENDOR_AMBIGUITY_MARGIN = 0.10;
export const DEFAULT_VENDOR_MAX_ALTERNATIVES = 5;

/**
 * Deterministic, Tenant-Scoped Vendor Matching Engine.
 *
 * READ ONLY: Never creates, updates, or mutates any Vendor in the database.
 * NEVER defaults to vendors[0].
 */
export async function matchVendor(
  input: VendorMatchInput,
  options?: {
    minFuzzyScore?: number;
    ambiguityMargin?: number;
    maxAlternatives?: number;
    cachedVendors?: any[];
  }
): Promise<VendorMatchExecutionResult> {
  const minFuzzyScore = options?.minFuzzyScore ?? DEFAULT_VENDOR_MIN_FUZZY_SCORE;
  const ambiguityMargin = options?.ambiguityMargin ?? DEFAULT_VENDOR_AMBIGUITY_MARGIN;
  const maxAlternatives = options?.maxAlternatives ?? DEFAULT_VENDOR_MAX_ALTERNATIVES;

  if (!input.businessId) {
    return {
      matchedVendorId: null,
      matchedVendorName: null,
      matchedVendorGstin: null,
      matchingMethod: 'NO_MATCH',
      matchingScore: 0,
      confidence: 0,
      status: 'MISSING',
      reason: 'businessId is required for tenant-scoped vendor matching.',
      alternatives: [],
    };
  }

  const bId =
    typeof input.businessId === 'string'
      ? new Types.ObjectId(input.businessId)
      : input.businessId;

  // 1. Fetch only active vendors strictly scoped to the tenant businessId
  const activeVendors: any[] =
    options?.cachedVendors ??
    (await Vendor.find({
      businessId: bId,
      isActive: true,
    })
      .select('_id vendorCode name mobile alternateMobile address city state gstNumber isActive')
      .lean());

  if (!activeVendors || activeVendors.length === 0) {
    return {
      matchedVendorId: null,
      matchedVendorName: null,
      matchedVendorGstin: null,
      matchingMethod: 'NO_MATCH',
      matchingScore: 0,
      confidence: 0,
      status: 'MISSING',
      reason: 'No active vendors found for this business tenant.',
      alternatives: [],
    };
  }

  // Pre-normalize inputs
  const gstinAnalysis = normalizeGstin(input.gstin);
  const normalizedInputPan = normalizePan(input.pan) || gstinAnalysis.pan;
  const normalizedInputName = normalizeVendorName(input.name);
  const normalizedInputPhone = normalizePhone(input.phone);

  // ----------------------------------------------------
  // TIER 1: Exact Normalized GSTIN Match
  // ----------------------------------------------------
  if (gstinAnalysis.normalized && gstinAnalysis.isValid) {
    const gstinMatches = activeVendors.filter((v) => {
      const vGstin = normalizeGstin(v.gstNumber);
      return vGstin.normalized === gstinAnalysis.normalized;
    });

    if (gstinMatches.length === 1) {
      const matched = gstinMatches[0];
      return {
        matchedVendorId: matched._id.toString(),
        matchedVendorName: matched.name,
        matchedVendorGstin: matched.gstNumber || null,
        matchingMethod: 'EXACT_GSTIN',
        matchingScore: 1.0,
        confidence: 1.0,
        status: 'VERIFIED',
        reason: 'Exact unique match on normalized GSTIN.',
        alternatives: [],
      };
    }

    if (gstinMatches.length > 1) {
      // Data anomaly: multiple vendors registered with identical GSTIN
      return {
        matchedVendorId: null,
        matchedVendorName: null,
        matchedVendorGstin: null,
        matchingMethod: 'EXACT_GSTIN',
        matchingScore: 1.0,
        confidence: 1.0,
        status: 'REVIEW_REQUIRED',
        reason: 'Multiple active vendors share the exact same GSTIN.',
        alternatives: gstinMatches.slice(0, maxAlternatives).map((v) => ({
          vendorId: v._id.toString(),
          name: v.name,
          gstNumber: v.gstNumber || null,
          similarity: 1.0,
        })),
      };
    }
  }

  // ----------------------------------------------------
  // TIER 2: Exact Registered Identity / PAN Match
  // ----------------------------------------------------
  if (normalizedInputPan) {
    const panMatches = activeVendors.filter((v) => {
      const vGstin = normalizeGstin(v.gstNumber);
      return vGstin.pan === normalizedInputPan;
    });

    if (panMatches.length === 1) {
      const matched = panMatches[0];
      return {
        matchedVendorId: matched._id.toString(),
        matchedVendorName: matched.name,
        matchedVendorGstin: matched.gstNumber || null,
        matchingMethod: 'PAN_MATCH',
        matchingScore: 0.90,
        confidence: 0.90,
        status: 'REVIEW_REQUIRED',
        reason: 'Matched on registered PAN component of GSTIN.',
        alternatives: [],
      };
    }

    if (panMatches.length > 1) {
      return {
        matchedVendorId: null,
        matchedVendorName: null,
        matchedVendorGstin: null,
        matchingMethod: 'PAN_MATCH',
        matchingScore: 0.90,
        confidence: 0.90,
        status: 'REVIEW_REQUIRED',
        reason: 'Multiple active vendors share the same PAN.',
        alternatives: panMatches.slice(0, maxAlternatives).map((v) => ({
          vendorId: v._id.toString(),
          name: v.name,
          gstNumber: v.gstNumber || null,
          similarity: 0.90,
        })),
      };
    }
  }

  // ----------------------------------------------------
  // TIER 3: Exact Normalized Vendor Name Match
  // ----------------------------------------------------
  if (normalizedInputName) {
    const nameMatches = activeVendors.filter((v) => {
      return normalizeVendorName(v.name) === normalizedInputName;
    });

    if (nameMatches.length === 1) {
      const matched = nameMatches[0];
      return {
        matchedVendorId: matched._id.toString(),
        matchedVendorName: matched.name,
        matchedVendorGstin: matched.gstNumber || null,
        matchingMethod: 'EXACT_NAME',
        matchingScore: 0.95,
        confidence: 0.95,
        status: 'REVIEW_REQUIRED', // Exact name requires review; unique ID is needed for VERIFIED
        reason: 'Exact match on normalized vendor name.',
        alternatives: [],
      };
    }

    if (nameMatches.length > 1) {
      return {
        matchedVendorId: null,
        matchedVendorName: null,
        matchedVendorGstin: null,
        matchingMethod: 'EXACT_NAME',
        matchingScore: 0.95,
        confidence: 0.95,
        status: 'REVIEW_REQUIRED',
        reason: 'Multiple active vendors share the exact same normalized name.',
        alternatives: nameMatches.slice(0, maxAlternatives).map((v) => ({
          vendorId: v._id.toString(),
          name: v.name,
          gstNumber: v.gstNumber || null,
          similarity: 0.95,
        })),
      };
    }
  }

  // ----------------------------------------------------
  // TIER 4: Phone / Mobile + Name / Address Supporting Evidence
  // ----------------------------------------------------
  if (normalizedInputPhone) {
    const phoneMatches = activeVendors.filter((v) => {
      const vMobile = normalizePhone(v.mobile);
      const vAltMobile = normalizePhone(v.alternateMobile);
      return (
        (vMobile && vMobile === normalizedInputPhone) ||
        (vAltMobile && vAltMobile === normalizedInputPhone)
      );
    });

    if (phoneMatches.length === 1) {
      const matched = phoneMatches[0];
      const nameSim = normalizedInputName
        ? calculateHybridSimilarity(normalizedInputName, normalizeVendorName(matched.name))
        : 0;

      // Ensure phone match has at least mild supporting name similarity or state match
      const stateMatch =
        input.state &&
        matched.state &&
        input.state.trim().toLowerCase() === matched.state.trim().toLowerCase();

      if (nameSim >= 0.35 || stateMatch || !normalizedInputName) {
        return {
          matchedVendorId: matched._id.toString(),
          matchedVendorName: matched.name,
          matchedVendorGstin: matched.gstNumber || null,
          matchingMethod: 'FUZZY_NAME_OR_PHONE',
          matchingScore: 0.85,
          confidence: 0.85,
          status: 'REVIEW_REQUIRED',
          reason: 'Matched on contact phone number with supporting identity evidence.',
          alternatives: [],
        };
      }
    }
  }

  // ----------------------------------------------------
  // TIER 5: Controlled Fuzzy Name Matching
  // ----------------------------------------------------
  if (normalizedInputName) {
    const scoredCandidates = activeVendors
      .map((v) => {
        const score = calculateHybridSimilarity(normalizedInputName, normalizeVendorName(v.name));
        return {
          vendor: v,
          score,
        };
      })
      .filter((c) => c.score >= minFuzzyScore)
      .sort((a, b) => b.score - a.score);

    if (scoredCandidates.length > 0) {
      const top = scoredCandidates[0];
      const second = scoredCandidates[1];

      const isAmbiguous =
        second && top.score - second.score < ambiguityMargin;

      const alternatives: IVendorMatchAlternative[] = scoredCandidates
        .slice(0, maxAlternatives)
        .map((c) => ({
          vendorId: c.vendor._id.toString(),
          name: c.vendor.name,
          gstNumber: c.vendor.gstNumber || null,
          similarity: c.score,
        }));

      if (!isAmbiguous && top.score >= 0.80) {
        return {
          matchedVendorId: top.vendor._id.toString(),
          matchedVendorName: top.vendor.name,
          matchedVendorGstin: top.vendor.gstNumber || null,
          matchingMethod: 'FUZZY_NAME_OR_PHONE',
          matchingScore: top.score,
          confidence: top.score,
          status: 'REVIEW_REQUIRED',
          reason: `High confidence fuzzy match (${Math.round(top.score * 100)}%) on vendor name.`,
          alternatives: alternatives.slice(1),
        };
      }

      // Ambiguous candidate match: top score close to second, or below confident threshold
      return {
        matchedVendorId: null,
        matchedVendorName: null,
        matchedVendorGstin: null,
        matchingMethod: 'NO_MATCH',
        matchingScore: top.score,
        confidence: top.score,
        status: 'REVIEW_REQUIRED',
        reason: isAmbiguous
          ? `Ambiguous vendor candidates: top candidate score (${Math.round(top.score * 100)}%) is too close to runner-up (${Math.round(second.score * 100)}%).`
          : `Fuzzy candidate score (${Math.round(top.score * 100)}%) is below confident threshold.`,
        alternatives,
      };
    }
  }

  // ----------------------------------------------------
  // NO MATCH
  // ----------------------------------------------------
  return {
    matchedVendorId: null,
    matchedVendorName: null,
    matchedVendorGstin: null,
    matchingMethod: 'NO_MATCH',
    matchingScore: 0,
    confidence: 0,
    status: 'MISSING',
    reason: 'No active vendor matched the extracted document details.',
    alternatives: [],
  };
}
