/**
 * Deterministic String Normalization & Similarity Utilities
 * for Vendor and Product Matching
 */

/**
 * Calculates Levenshtein Distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalizes Levenshtein distance to a similarity ratio between 0.0 and 1.0
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, Math.min(1, 1 - dist / maxLen));
}

/**
 * Token-based Dice coefficient similarity (0.0 to 1.0)
 */
export function tokenDiceSimilarity(str1: string, str2: string): number {
  const tokens1 = new Set(str1.toLowerCase().split(/\s+/).filter(Boolean));
  const tokens2 = new Set(str2.toLowerCase().split(/\s+/).filter(Boolean));

  if (tokens1.size === 0 && tokens2.size === 0) return 1.0;
  if (tokens1.size === 0 || tokens2.size === 0) return 0.0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) {
      intersection++;
    }
  }

  return (2 * intersection) / (tokens1.size + tokens2.size);
}

/**
 * Extracts standard electrical and mechanical specifications from product text
 */
export function extractSpecifications(text: string): Record<string, string> {
  const clean = text.toLowerCase();
  const specs: Record<string, string> = {};

  // 1. Voltage (e.g. 450V, 250V, 415V, 220V, 12V, 24V)
  const voltMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*v(?:ac|dc)?\b/);
  if (voltMatch) {
    specs['voltage'] = `${voltMatch[1]}v`;
  }

  // 2. Horsepower (e.g. 0.5HP, 1HP, 2HP, 5HP)
  const hpMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*hp\b/);
  if (hpMatch) {
    specs['horsepower'] = `${hpMatch[1]}hp`;
  }

  // 3. Star rating (e.g. 3 Star, 5 Star)
  const starMatch = clean.match(/\b([1-5])\s*star\b/);
  if (starMatch) {
    specs['star_rating'] = `${starMatch[1]}star`;
  }

  // 4. Capacity / Microfarad (e.g. 35uF, 50uF, 2.5uF)
  const capMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:uf|µf|mfd)\b/);
  if (capMatch) {
    specs['capacity'] = `${capMatch[1]}uf`;
  }

  // 5. Current / Amperes (e.g. 25A, 32A, 16A, 63A)
  const ampMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:a|amp|amps|ampere|amperes)\b/);
  if (ampMatch) {
    specs['current'] = `${ampMatch[1]}a`;
  }

  // 6. Tonnage (e.g. 1.5 Ton, 2.0 Ton, 1 Ton)
  const tonMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:ton|tr)\b/);
  if (tonMatch) {
    specs['tonnage'] = `${tonMatch[1]}ton`;
  }

  // 7. Wattage / Kilowatts (e.g. 100W, 1.5kW)
  const wattMatch = clean.match(/\b(\d+(?:\.\d+)?)\s*(?:w|watt|watts|kw)\b/);
  if (wattMatch) {
    specs['wattage'] = `${wattMatch[1]}${clean.includes('kw') ? 'kw' : 'w'}`;
  }

  return specs;
}

export interface SpecificationConflictResult {
  hasConflict: boolean;
  conflicts: string[];
  asymmetricSpecs: string[];
}

/**
 * Detects whether two product descriptions contain conflicting specifications
 */
export function detectSpecificationConflicts(
  str1: string,
  str2: string
): SpecificationConflictResult {
  const specs1 = extractSpecifications(str1);
  const specs2 = extractSpecifications(str2);

  const conflicts: string[] = [];
  const asymmetricSpecs: string[] = [];

  const allKeys = new Set([...Object.keys(specs1), ...Object.keys(specs2)]);

  for (const key of allKeys) {
    const val1 = specs1[key];
    const val2 = specs2[key];

    if (val1 !== undefined && val2 !== undefined) {
      if (val1 !== val2) {
        conflicts.push(`${key}: ${val1} vs ${val2}`);
      }
    } else if (val1 !== undefined || val2 !== undefined) {
      asymmetricSpecs.push(`${key}: ${val1 ?? val2}`);
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
    asymmetricSpecs,
  };
}

/**
 * Combined similarity combining token overlap (Jaccard/Dice) and Levenshtein similarity
 * with specification awareness to prevent substring dominance over conflicting specs.
 */
export function calculateHybridSimilarity(str1: string, str2: string): number {
  const s1 = str1.trim().toLowerCase();
  const s2 = str2.trim().toLowerCase();

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const specAnalysis = detectSpecificationConflicts(s1, s2);

  const tokenScore = tokenDiceSimilarity(s1, s2);
  const levScore = levenshteinSimilarity(s1, s2);
  const combined = 0.6 * tokenScore + 0.4 * levScore;

  // If there is an explicit specification conflict (e.g. 450V vs 250V, 1HP vs 2HP, 3 Star vs 5 Star):
  // 1. Substring boost MUST NOT be applied (prevents substring similarity from overriding conflicting specs).
  // 2. Do NOT eliminate useful candidates, but cap score so it never enters high confidence (max 0.70).
  if (specAnalysis.hasConflict) {
    return Math.round(Math.min(0.70, combined) * 100) / 100;
  }

  // Substring containment gives a baseline only if:
  // 1. Shorter string is at least 4 characters OR matches a full word token in the longer string
  // 2. Length ratio is meaningful (>= 0.35) so tiny fragments (e.g. single letters) don't dominate
  // 3. No conflicting specifications
  const minLen = Math.min(s1.length, s2.length);
  const maxLen = Math.max(s1.length, s2.length);
  const lengthRatio = minLen / maxLen;
  const shorter = s1.length <= s2.length ? s1 : s2;
  const longer = s1.length <= s2.length ? s2 : s1;

  const isWholeWordMatch = new RegExp(`\\b${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(longer);

  if (longer.includes(shorter) && (minLen >= 4 || isWholeWordMatch) && lengthRatio >= 0.35) {
    if (specAnalysis.asymmetricSpecs.length > 0) {
      return Math.round((0.68 + 0.10 * lengthRatio) * 100) / 100;
    }

    return Math.round((0.80 + 0.20 * lengthRatio) * 100) / 100;
  }

  // 60% token overlap + 40% character distance
  return Math.round(combined * 100) / 100;
}

/**
 * Normalizes Indian GSTIN
 * Trim, uppercase, remove accidental surrounding/internal whitespace
 */
export function normalizeGstin(rawGstin: string | null | undefined): {
  normalized: string | null;
  isValid: boolean;
  pan: string | null;
} {
  if (!rawGstin) {
    return { normalized: null, isValid: false, pan: null };
  }

  // Trim and remove any whitespace
  const cleaned = rawGstin.trim().replace(/\s+/g, '').toUpperCase();

  // Valid 15-character GSTIN format:
  // 2 digits state code + 10 chars PAN + 1 entity code + 1 'Z' + 1 checksum char
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const isValid = gstinRegex.test(cleaned);

  let pan: string | null = null;
  if (isValid) {
    pan = cleaned.substring(2, 12);
  } else if (cleaned.length === 10 && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleaned)) {
    pan = cleaned;
  }

  return {
    normalized: cleaned,
    isValid,
    pan,
  };
}

/**
 * Normalizes PAN string
 */
export function normalizePan(rawPan: string | null | undefined): string | null {
  if (!rawPan) return null;
  const cleaned = rawPan.trim().replace(/\s+/g, '').toUpperCase();
  if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleaned)) {
    return cleaned;
  }
  return null;
}

/**
 * Normalizes phone number to 10 digits
 */
export function normalizePhone(rawPhone: string | null | undefined): string | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length > 10 && digits.startsWith('91')) {
    const trimmed = digits.substring(2);
    if (trimmed.length === 10) return trimmed;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  return digits.length >= 7 ? digits : null;
}

/**
 * Normalizes Vendor Name safely
 * Handles common abbreviations (Pvt Ltd, Co, Enterprises) without erasing identity
 */
export function normalizeVendorName(rawName: string | null | undefined): string {
  if (!rawName) return '';

  let cleaned = rawName
    .trim()
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ');

  // Standardize common entity suffix aliases safely
  cleaned = cleaned
    .replace(/\bprivate\s+limited\b/g, 'pvt ltd')
    .replace(/\bprivate\s+ltd\b/g, 'pvt ltd')
    .replace(/\blimited\b/g, 'ltd')
    .replace(/\bcorporation\b/g, 'corp')
    .replace(/\bcompany\b/g, 'co')
    .replace(/\benterprises\b/g, 'enterprise');

  return cleaned.trim();
}

/**
 * Normalizes Product SKU safely
 */
export function normalizeSku(rawSku: string | null | undefined): string | null {
  if (!rawSku) return null;
  const cleaned = rawSku.trim().toLowerCase().replace(/[\s\-_]/g, '');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Normalizes Barcode safely
 * Trims whitespace, preserves numeric content without fabricating leading zeros
 */
export function normalizeBarcode(rawBarcode: string | null | undefined): string | null {
  if (!rawBarcode) return null;
  const cleaned = rawBarcode.trim();
  // Do not modify numeric structure, do not add leading zeros
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Normalizes Product Name / Description
 * Preserves capacity, voltage, ratings, dimensions, model numbers
 */
export function normalizeProductName(rawName: string | null | undefined): string {
  if (!rawName) return '';

  let cleaned = rawName
    .trim()
    .toLowerCase()
    .replace(/[,;]/g, ' ')
    // Normalize microfarad representation (e.g. 35 uf, 35uf, 35 µf, 35µf -> 35uf)
    .replace(/(\d+)\s*(?:µ|u)f\b/gi, '$1uf')
    // Normalize tons (e.g. 1.5 ton, 1.5tr -> 1.5ton)
    .replace(/(\d+(?:\.\d+)?)\s*tr\b/gi, '$1ton')
    .replace(/\s+/g, ' ');

  return cleaned.trim();
}

/**
 * Normalizes Unit of Measurement (UOM)
 */
export function normalizeUom(rawUom: string | null | undefined): string | null {
  if (!rawUom) return null;
  const cleaned = rawUom.trim().toUpperCase();

  const aliases: Record<string, string> = {
    'PIECES': 'PCS',
    'PIECE': 'PCS',
    'PC': 'PCS',
    'NOS': 'NOS',
    'NUMBERS': 'NOS',
    'NUMBER': 'NOS',
    'KGS': 'KG',
    'KILOGRAM': 'KG',
    'KILOGRAMS': 'KG',
    'SETS': 'SET',
    'BOXES': 'BOX',
    'PACKS': 'PKT',
    'PACKET': 'PKT',
    'PACKETS': 'PKT',
    'METERS': 'MTR',
    'METER': 'MTR',
  };

  return aliases[cleaned] || cleaned;
}
