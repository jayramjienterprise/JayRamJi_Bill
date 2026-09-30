import {
  IExtractedField,
  IBoundingBox,
  FieldStatus,
} from '../../../database/models/PurchaseDraft';


export interface NormalizedNumericResult {
  value: number | null;
  warning: string | null;
}

export interface NormalizedDateResult {
  isoDate: string | null;
  printedText: string | null;
  warning: string | null;
}

/**
 * Safely normalizes numeric/monetary strings from bills into decimal numbers.
 *
 * Rules:
 * - "₹1,250.50" -> 1250.50
 * - "1250" -> 1250
 * - "  -50.00  " -> -50.00
 * - Ambiguous letters (e.g. "1,2O0" where O replaces 0) -> null with warning (NEVER guesses)
 * - Null/empty -> null
 */
export function normalizeNumeric(raw: unknown): NormalizedNumericResult {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, warning: null };
  }

  if (typeof raw === 'number') {
    if (isNaN(raw) || !isFinite(raw)) {
      return { value: null, warning: 'Invalid numeric value' };
    }
    return { value: raw, warning: null };
  }

  if (typeof raw !== 'string') {
    return { value: null, warning: 'Unsupported numeric representation' };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: null, warning: null };
  }

  // Detect ambiguous letters (e.g. capital 'O' or 'l' inside numeric string)
  if (/[a-zA-Z]/.test(trimmed)) {
    // Check if the only letters are currency prefixes (INR, Rs, Rs.)
    const strippedCurrency = trimmed.replace(/\bINR\b/gi, '').replace(/\bRs\.?/gi, '').trim();
    if (/[a-zA-Z]/.test(strippedCurrency)) {
      return {
        value: null,
        warning: `Ambiguous alphanumeric characters detected in numeric field ('${trimmed}'). Value left unassigned for manual review.`,
      };
    }
  }

  // Strip currency symbols (₹, $, Rs, INR), spaces, and thousand-separator commas
  const cleaned = trimmed
    .replace(/[₹$]/g, '')
    .replace(/\bINR\b/gi, '')
    .replace(/\bRs\.?/gi, '')
    .replace(/,/g, '')
    .trim();

  const parsed = Number(cleaned);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return {
      value: null,
      warning: `Unable to safely parse numeric value from '${trimmed}'`,
    };
  }

  return { value: parsed, warning: null };
}

/**
 * Safely normalizes percentage representation (e.g. "18%", "18.00", 18 -> 18)
 */
export function normalizePercentage(raw: unknown): NormalizedNumericResult {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null, warning: null };
  }

  if (typeof raw === 'number') {
    if (isNaN(raw) || raw < 0 || raw > 100) {
      return { value: null, warning: 'Percentage out of 0-100 range' };
    }
    return { value: raw, warning: null };
  }

  if (typeof raw === 'string') {
    const stripped = raw.replace(/%/g, '').trim();
    const result = normalizeNumeric(stripped);
    if (result.value !== null) {
      if (result.value < 0 || result.value > 100) {
        return { value: null, warning: `Percentage ${result.value}% out of valid range (0-100)` };
      }
    }
    return result;
  }

  return { value: null, warning: 'Unsupported percentage representation' };
}

/**
 * Normalizes common Indian invoice dates (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD)
 * into ISO format YYYY-MM-DD while preserving the printed text.
 *
 * Does not guess ambiguous dates.
 */
export function normalizeDate(raw: unknown): NormalizedDateResult {
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return { isoDate: null, printedText: null, warning: null };
  }

  const printedText = raw.trim();

  // 1. ISO format: YYYY-MM-DD
  const isoMatch = printedText.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return {
        isoDate: `${y}-${pad(m)}-${pad(d)}`,
        printedText,
        warning: null,
      };
    }
  }

  // 2. Standard Indian format: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const indMatch = printedText.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (indMatch) {
    const d = parseInt(indMatch[1], 10);
    const m = parseInt(indMatch[2], 10);
    const y = parseInt(indMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      return {
        isoDate: `${y}-${pad(m)}-${pad(d)}`,
        printedText,
        warning: null,
      };
    }
  }

  // 3. Short year Indian format: DD/MM/YY, DD-MM-YY
  const shortYearMatch = printedText.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})$/);
  if (shortYearMatch) {
    const d = parseInt(shortYearMatch[1], 10);
    const m = parseInt(shortYearMatch[2], 10);
    const yy = parseInt(shortYearMatch[3], 10);
    const y = 2000 + yy;
    if (isValidCalendarDate(y, m, d)) {
      return {
        isoDate: `${y}-${pad(m)}-${pad(d)}`,
        printedText,
        warning: null,
      };
    }
  }

  // 4. Textual month format: e.g. "15 Jan 2026", "15-January-2026"
  const textMonthMatch = printedText.match(
    /^(\d{1,2})[\s/-]+([a-zA-Z]{3,9})[\s/-]+(\d{4})$/
  );
  if (textMonthMatch) {
    const d = parseInt(textMonthMatch[1], 10);
    const monthName = textMonthMatch[2].toLowerCase();
    const y = parseInt(textMonthMatch[3], 10);
    const monthMap: Record<string, number> = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12,
    };
    const m = monthMap[monthName];
    if (m && isValidCalendarDate(y, m, d)) {
      return {
        isoDate: `${y}-${pad(m)}-${pad(d)}`,
        printedText,
        warning: null,
      };
    }
  }

  return {
    isoDate: null,
    printedText,
    warning: `Unrecognized or ambiguous date format: '${printedText}'`,
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1990 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonth = [0, 31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month];
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * Normalizes bounding box coordinates into [ymin, xmin, ymax, xmax] format if valid
 */
export function normalizeBoundingBox(
  bbox: unknown,
  pageNumber: number = 1
): IBoundingBox | null {
  if (!bbox) return null;

  if (Array.isArray(bbox) && bbox.length === 4) {
    const nums = bbox.map(Number);
    if (nums.every((n) => !isNaN(n) && isFinite(n))) {
      return {
        pageNumber,
        box2d: [nums[0], nums[1], nums[2], nums[3]],
      };
    }
  }

  return null;
}

/**
 * Normalizes Indian GSTIN (Goods and Services Tax Identification Number).
 *
 * GSTIN structure (15 characters):
 *   [0-1]  State code (2 digits, e.g. "24" = Gujarat)
 *   [2-11] PAN number (10 alphanumeric chars)
 *   [12]   Entity number (1-9 or A-Z, counts registrations per PAN per state)
 *   [13]   Mandatory letter 'Z' (always 'Z' per Indian GST law — NOT the digit 2!)
 *   [14]   Checksum character
 *
 * Applies a single safe deterministic correction:
 * - If position 13 (0-indexed) is the digit '2' or '7' instead of the letter 'Z',
 *   this is a common AI/OCR misread. Correct it to 'Z'.
 * - Does NOT validate the full checksum (avoids false rejections on other errors).
 */
export function normalizeGstin(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim().toUpperCase();
  if (!str) return null;

  // Only apply position-13 correction if the string is exactly 15 characters
  if (str.length !== 15) return str;

  // Position 13 (0-indexed) must always be 'Z' per GSTIN specification.
  // AI models commonly misread 'Z' as digit '2' (closed top of Z) or '7' (similar diagonal).
  if (str[13] !== 'Z' && (str[13] === '2' || str[13] === '7')) {
    return str.substring(0, 13) + 'Z' + str.substring(14);
  }

  return str;
}

/**
 * Factory helper for constructing ExtractedField objects adhering strictly to PurchaseDraft contracts
 */
export function createExtractedField<T>(
  value: T | null,
  options?: {
    confidence?: number;
    status?: FieldStatus;
    bbox?: IBoundingBox | null;
    warning?: string | null;
  }
): IExtractedField<T> {
  const isPresent = value !== null && value !== undefined;
  let status: FieldStatus = options?.status ?? (isPresent ? 'EXTRACTED' : 'MISSING');

  // Requirement 9: Confidence Semantics Hardening
  // Model confidence (even 0.99 or 1.0) must NEVER automatically produce 'VERIFIED'.
  // Extraction status remains 'EXTRACTED' (or 'MISSING') until downstream deterministic
  // financial validation and vendor/product matching/review stages approve the information.
  if (status === 'VERIFIED') {
    status = 'EXTRACTED';
  }

  const confidence = isPresent ? (options?.confidence ?? 0.85) : 0;

  return {
    value: isPresent ? value : null,
    confidence,
    status,
    bbox: options?.bbox ?? null,
    warning: options?.warning ?? null,
  };
}
