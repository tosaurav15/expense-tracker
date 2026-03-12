/**
 * ============================================================
 *  VAULT — RECEIPT PARSER  (src/services/receiptParser.js)
 * ============================================================
 *
 *  What this does:
 *  ---------------
 *  Takes messy, unstructured OCR text like this:
 *
 *    STARBUCKS COFFEE
 *    Coffee House, Koramangala
 *    02/03/2026  14:32
 *    Cappuccino Tall       180.00
 *    Blueberry Muffin      100.00
 *    SUBTOTAL              280.00
 *    GST 5%                 14.00
 *    TOTAL                 294.00
 *    Thank you for visiting!
 *
 *  And extracts:
 *    merchant: "Starbucks"
 *    amount:   294.00
 *    date:     "2026-03-02"
 *    category: "food"   ← from merchantLearningService
 *
 *  Strategy (what to look for in OCR text):
 *  -----------------------------------------
 *  MERCHANT  → First non-empty line that contains letters (not numbers)
 *  AMOUNT    → The number near "TOTAL", "GRAND", "NET PAYABLE"
 *              If no total label found → the LARGEST number on the receipt
 *  DATE      → Any string that looks like a date
 *
 *  ─────────────────────────────────────────────────────────
 *  EXPORTED FUNCTIONS
 *  ─────────────────────────────────────────────────────────
 *
 *  parseReceipt(ocrResult, learnedMerchant?)
 *    → Promise<TransactionDraft>
 *
 *    TransactionDraft = {
 *      merchant:    string,
 *      amount:      number,
 *      date:        string,   ← YYYY-MM-DD
 *      type:        'expense',
 *      category:    string,
 *      confidence:  { merchant, amount, date }  ← how sure we are
 *      rawText:     string,   ← original OCR text for debugging
 *    }
 */

import { detectKnownMerchant, getMerchantCategory } from './merchantLearningService.js';

// ─── PATTERNS ────────────────────────────────────────────────────────────────

// Patterns that indicate a line contains a "total" amount
const TOTAL_PATTERNS = [
  /\b(grand\s*total|net\s*payable|total\s*amount|amount\s*due|total\s*bill)\b/i,
  /\btotal\b/i,
  /\bpayable\b/i,
  /\bnet\s+amount\b/i,
  /\bgrand\b/i,
];

// Date formats found on Indian receipts
const DATE_PATTERNS = [
  { re: /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/, type: 'dmy' },
  { re: /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/,   type: 'ymd' },
  { re: /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})\b/i, type: 'dmonY' },
];

const MONTH_MAP = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };

// Lines to skip when extracting the merchant name
const SKIP_LINE_PATTERNS = [
  /^(thank|welcome|visit|have a|please|gst|vat|tax|invoice|receipt|bill|reg|cin|gstin|phone|tel|mobile|email|www|http)/i,
  /^\d+$/,                     // line that is only a number
  /^[^a-zA-Z]*$/,              // line with no letters
];

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * parseReceipt(ocrResult)
 *
 * @param {object} ocrResult - from ocrService.runOCR()
 *   { text, lines, confidence, words }
 *
 * @returns {Promise<TransactionDraft>}
 */
export async function parseReceipt(ocrResult) {
  const { lines = [], text = '' } = ocrResult;

  // ── Extract merchant ──────────────────────────────────────
  const { merchant, merchantConfidence } = extractMerchant(lines, text);

  // ── Extract amount ────────────────────────────────────────
  const { amount, amountConfidence }   = extractAmount(lines);

  // ── Extract date ──────────────────────────────────────────
  const { date, dateConfidence }       = extractDate(lines, text);

  // ── Determine category ────────────────────────────────────
  // First check if we recognise the merchant from the full text
  const learnedMatch = await detectKnownMerchant(text);
  let category = learnedMatch?.category || null;

  // If not found in full text, try just the merchant name
  if (!category && merchant) {
    category = await getMerchantCategory(merchant);
  }

  category = category || 'other';

  // Use the better merchant name if detected
  const finalMerchant = learnedMatch?.merchant || merchant || 'Unknown Merchant';

  return {
    merchant:   finalMerchant,
    amount,
    date,
    type:       'expense',
    category,
    paymentMethod: 'Cash',    // receipts are usually cash; user can change it
    notes:      `Receipt: ${finalMerchant}`,
    tags:       ['receipt', 'scanned'],
    confidence: {
      merchant: merchantConfidence,
      amount:   amountConfidence,
      date:     dateConfidence,
      overall:  Math.round((merchantConfidence + amountConfidence + dateConfidence) / 3),
    },
    rawText: text,
  };
}

// ─── MERCHANT EXTRACTOR ───────────────────────────────────────────────────────

/**
 * extractMerchant(lines, fullText)
 *
 * Finds the merchant name by scanning the top of the receipt.
 * The business name is almost always in the first few lines.
 *
 * Strategy:
 *   1. Skip lines that are addresses, phone numbers, or tax info
 *   2. The first remaining line with ≥3 letters is the merchant name
 *   3. If it's all caps (like "STARBUCKS COFFEE"), title-case it
 */
function extractMerchant(lines, fullText) {
  // Try first 8 lines (business name is always near the top)
  for (const line of lines.slice(0, 8)) {
    const clean = line.trim();
    if (!clean || clean.length < 3) continue;

    // Skip lines matching the skip patterns
    if (SKIP_LINE_PATTERNS.some(p => p.test(clean))) continue;

    // Skip lines that are mostly numbers (prices, phone numbers)
    const letters = clean.replace(/[^a-zA-Z]/g, '');
    if (letters.length < 3) continue;

    // This looks like a name — clean it up
    const merchant = cleanMerchantLine(clean);
    if (merchant.length >= 2) {
      return { merchant, merchantConfidence: 75 };
    }
  }

  // Fallback: look for a known merchant anywhere in the text
  const words = fullText.toLowerCase().split(/\s+/);
  for (const word of words) {
    if (word.length >= 4 && /^[a-z]+$/.test(word)) {
      const capitalized = word.charAt(0).toUpperCase() + word.slice(1);
      return { merchant: capitalized, merchantConfidence: 40 };
    }
  }

  return { merchant: 'Unknown', merchantConfidence: 0 };
}

/** Clean up a merchant name line */
function cleanMerchantLine(line) {
  let s = line
    .replace(/[\d#@*|_\\]/g, '')    // remove stray characters
    .replace(/\s+/g, ' ')
    .trim();

  // If all caps → title case (STARBUCKS → Starbucks)
  if (s === s.toUpperCase() && s.length > 2) {
    s = s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  return s.slice(0, 50);  // cap at 50 chars
}

// ─── AMOUNT EXTRACTOR ─────────────────────────────────────────────────────────

/**
 * extractAmount(lines)
 *
 * Strategy:
 *   1. Look for a line containing "TOTAL" + a number → highest confidence
 *   2. Look for the LARGEST number on the receipt → fallback
 *   3. Look for numbers preceded by ₹ symbol
 *
 * Returns amount as a number (always positive).
 */
function extractAmount(lines) {
  // Strategy 1: Find a line that contains a total keyword
  for (const pattern of TOTAL_PATTERNS) {
    for (const line of lines) {
      if (!pattern.test(line)) continue;
      const nums = extractNumbersFromLine(line);
      if (nums.length > 0) {
        return { amount: nums[nums.length - 1], amountConfidence: 90 };
      }
    }
  }

  // Strategy 2: Largest number on the receipt
  let largestNumber = 0;
  let largestConfidence = 0;

  for (const line of lines) {
    const nums = extractNumbersFromLine(line);
    for (const n of nums) {
      // Avoid obvious quantities like table number "1", quantity "2", etc.
      if (n > largestNumber && n >= 5 && n < 1000000) {
        largestNumber      = n;
        largestConfidence  = 60;
      }
    }
  }

  if (largestNumber > 0) {
    return { amount: largestNumber, amountConfidence: largestConfidence };
  }

  return { amount: 0, amountConfidence: 0 };
}

/** Extract all numbers from a line of text */
function extractNumbersFromLine(line) {
  const cleaned = line.replace(/[₹$€£,]/g, '');
  const matches = cleaned.match(/\d+(\.\d{1,2})?/g) || [];
  return matches
    .map(m => parseFloat(m))
    .filter(n => !isNaN(n) && n > 0);
}

// ─── DATE EXTRACTOR ───────────────────────────────────────────────────────────

/**
 * extractDate(lines, fullText)
 *
 * Scans all lines for a date pattern.
 * Returns YYYY-MM-DD string (ISO format).
 * Falls back to today's date if no date found.
 */
function extractDate(lines, fullText) {
  const combined = lines.join(' ');

  for (const { re, type } of DATE_PATTERNS) {
    const match = combined.match(re);
    if (!match) continue;

    try {
      let year, month, day;

      if (type === 'dmy') {
        day   = parseInt(match[1]);
        month = parseInt(match[2]);
        year  = parseInt(match[3]);
        if (year < 100) year += 2000;
      } else if (type === 'ymd') {
        year  = parseInt(match[1]);
        month = parseInt(match[2]);
        day   = parseInt(match[3]);
      } else if (type === 'dmonY') {
        day   = parseInt(match[1]);
        month = MONTH_MAP[match[2].toLowerCase().slice(0, 3)] || 1;
        year  = parseInt(match[3]);
        if (year < 100) year += 2000;
      }

      // Validate the date makes sense
      if (year >= 2000 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return { date: iso, dateConfidence: 85 };
      }
    } catch { /* try next pattern */ }
  }

  // No date found — use today
  const today = new Date().toISOString().split('T')[0];
  return { date: today, dateConfidence: 30 };
}
