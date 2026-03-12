/**
 * ============================================================
 *  VAULT — MERCHANT LEARNING SERVICE
 *  (src/services/merchantLearningService.js)
 * ============================================================
 *
 *  What this does in plain English:
 *  ---------------------------------
 *  Vault remembers which category you assign to each merchant.
 *
 *  Example:
 *    First time you buy something from Swiggy → the app guesses "Food"
 *    You confirm it → the app stores: swiggy → food, confidence: 1
 *
 *    Next time Swiggy appears (in a receipt scan, bank import, or
 *    manual entry) → the app already knows it's "Food" and
 *    auto-fills it — no guessing needed.
 *
 *    If you ever correct a category → confidence increases and
 *    the new category takes precedence.
 *
 *  The key insight: your corrections teach the app, so it gets
 *  smarter for YOUR spending patterns over time.
 *
 *  ─────────────────────────────────────────────────────────
 *  Where is this data stored?
 *  ─────────────────────────────────────────────────────────
 *  In IndexedDB, in the "merchant_learning" store added in
 *  database version 2. 100% on your device, never uploaded.
 *
 *  ─────────────────────────────────────────────────────────
 *  EXPORTED FUNCTIONS
 *  ─────────────────────────────────────────────────────────
 *
 *  normalizeMerchantName(name)
 *    → 'amazon marketplace' → 'amazon'
 *    Strips numbers, punctuation, common suffixes
 *
 *  getMerchantCategory(merchantName)
 *    → category string, or null if unknown
 *    Checks learned DB first, then static map, then returns null
 *
 *  saveMerchantCategory(merchantName, category, source)
 *    → saves to IndexedDB; if already exists, increases confidence
 *
 *  updateCategoryLearning(merchantName, newCategory)
 *    → called when user edits a category. Boosts confidence for
 *       the correct answer and marks source as 'user'
 *
 *  detectKnownMerchant(rawText)
 *    → tries to find any known merchant pattern inside a string
 *       Useful for OCR text that has extra noise
 *
 *  getAllLearnings()
 *    → returns all stored merchant→category pairs (for display)
 *
 *  getLearningStats()
 *    → { totalMerchants, userTaught, autoDetected, topCategories }
 */

import { dbGet, dbPut, dbGetAll } from './database.js';

const STORE = 'merchant_learning';

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — STATIC SEED MAP
//  (same as transactionService but this service takes precedence for learned ones)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The built-in merchant knowledge base.
 * These are the starting seeds — the app knows these before any learning.
 * Covers 80+ common Indian merchants across all categories.
 *
 * Format: 'normalized_keyword' → 'category_id'
 */
const STATIC_MERCHANT_MAP = {
  // ── Food & Delivery ──────────────────────────────────────
  swiggy: 'food',        zomato: 'food',        dominos: 'food',
  dominoes: 'food',      'burger king': 'food', mcdonalds: 'food',
  kfc: 'food',           subway: 'food',        pizzahut: 'food',
  starbucks: 'food',     dunkin: 'food',        haldirams: 'food',
  barbeque: 'food',      biryani: 'food',       chaayos: 'food',
  freshmenu: 'food',     box8: 'food',          faasos: 'food',

  // ── Groceries ────────────────────────────────────────────
  bigbasket: 'groceries', blinkit: 'groceries', zepto: 'groceries',
  dmart: 'groceries',     grofers: 'groceries', jiomart: 'groceries',
  natures: 'groceries',   licious: 'groceries', milkbasket: 'groceries',
  spencers: 'groceries',  easyday: 'groceries', star: 'groceries',

  // ── Transport ────────────────────────────────────────────
  uber: 'transport',  ola: 'transport',   rapido: 'transport',
  metro: 'transport', irctc: 'transport', redbus: 'transport',
  makemytrip: 'transport', goibibo: 'transport', indigo: 'transport',
  airasia: 'transport', spicejet: 'transport', vistara: 'transport',
  petrol: 'transport', bpcl: 'transport',  hpcl: 'transport',
  iocl: 'transport',  fastag: 'transport',

  // ── Shopping ─────────────────────────────────────────────
  amazon: 'shopping',   flipkart: 'shopping', myntra: 'shopping',
  ajio: 'shopping',     meesho: 'shopping',   snapdeal: 'shopping',
  nykaa: 'shopping',    tatacliq: 'shopping', firstcry: 'shopping',
  pepperfry: 'shopping', ikea: 'shopping',    croma: 'shopping',
  reliance: 'shopping', trends: 'shopping',   zara: 'shopping',
  hm: 'shopping',       uniqlo: 'shopping',

  // ── Entertainment ────────────────────────────────────────
  netflix: 'entertainment', spotify: 'entertainment', prime: 'entertainment',
  hotstar: 'entertainment', zee5: 'entertainment',    sonyliv: 'entertainment',
  youtube: 'entertainment', jiocinema: 'entertainment', pvr: 'entertainment',
  inox: 'entertainment',   bookmyshow: 'entertainment',

  // ── Bills & Utilities ────────────────────────────────────
  airtel: 'bills',      jio: 'bills',        bsnl: 'bills',
  vodafone: 'bills',    vi: 'bills',         electricity: 'bills',
  tatapower: 'bills',   adani: 'bills',      bescom: 'bills',
  msedcl: 'bills',      insurance: 'bills',  lic: 'bills',
  bajaj: 'bills',       hdfc: 'bills',       icici: 'bills',
  kotak: 'bills',       axis: 'bills',

  // ── Health ───────────────────────────────────────────────
  pharmacy: 'health',   medplus: 'health',   apollopharmacy: 'health',
  netmeds: 'health',    pharmeasy: 'health', tata1mg: 'health',
  hospital: 'health',   clinic: 'health',    doctor: 'health',
  fitness: 'health',    cult: 'health',      gympass: 'health',

  // ── Income ───────────────────────────────────────────────
  salary: 'salary',     payroll: 'salary',   neft: 'salary',
  imps: 'salary',       credited: 'salary',

  // ── Investment ───────────────────────────────────────────
  zerodha: 'investment', groww: 'investment', upstox: 'investment',
  kuvera: 'investment',  sip: 'investment',   mutual: 'investment',

  // ── Rent ─────────────────────────────────────────────────
  rent: 'rent',         nobroker: 'rent',    housing: 'rent',

  // ── Education ────────────────────────────────────────────
  udemy: 'education',   coursera: 'education', unacademy: 'education',
  byjus: 'education',   upgrad: 'education',   school: 'education',
  college: 'education', university: 'education',
};

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — MERCHANT NAME NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * normalizeMerchantName(name)
 *
 * Strips all the "noise" from a merchant name so that variations
 * of the same merchant all map to the same identifier.
 *
 * Examples:
 *   'AMAZON.IN'          → 'amazon'
 *   'Amazon Seller Services Pvt Ltd'  → 'amazon'
 *   'AMZN*Marketplace'   → 'amzn'  (different root — kept separate)
 *   'Swiggy Order #4521' → 'swiggy'
 *   'UBER* TRIP'         → 'uber'
 *   'Starbucks Coffee #12' → 'starbucks'
 *
 * @param {string} name - raw merchant string
 * @returns {string} normalised identifier (lowercase, trimmed)
 */
export function normalizeMerchantName(name) {
  if (!name || typeof name !== 'string') return 'unknown';

  return name
    .toLowerCase()
    // Remove UPI transaction IDs (long digit strings)
    .replace(/\d{8,}/g, '')
    // Remove common legal suffixes
    .replace(/\b(pvt|ltd|llp|inc|corp|services|private|limited|india|technologies|solutions)\b/g, '')
    // Remove special chars except spaces
    .replace(/[^a-z0-9\s]/g, ' ')
    // Collapse spaces
    .replace(/\s+/g, ' ')
    .trim()
    // Take the first meaningful word as the root
    // (e.g. "swiggy food order" → "swiggy")
    .split(' ')[0] || 'unknown';
}

/**
 * extractMerchantRoot(name)
 *
 * More aggressive version — returns just the FIRST recognisable word.
 * Used for matching against the static map.
 */
function extractMerchantRoot(name) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
  // Try each word in the string against the static map
  const words = normalized.split(/\s+/);
  for (const word of words) {
    if (word.length >= 3 && STATIC_MERCHANT_MAP[word]) {
      return word;
    }
  }
  // Also try 2-word combinations (e.g. "burger king")
  for (let i = 0; i < words.length - 1; i++) {
    const pair = `${words[i]} ${words[i + 1]}`;
    if (STATIC_MERCHANT_MAP[pair]) return pair;
  }
  return normalized.split(' ')[0];
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — READ: GET CATEGORY FOR A MERCHANT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getMerchantCategory(merchantName)
 *
 * Three-tier lookup:
 *
 *   Tier 1 — User-learned (IndexedDB):
 *     If the user has ever manually categorised this merchant,
 *     that overrides everything.
 *
 *   Tier 2 — Static map (STATIC_MERCHANT_MAP):
 *     If the merchant is in our built-in list, use that.
 *
 *   Tier 3 — null:
 *     We don't know. Caller can fall back to 'other'.
 *
 * @param {string} merchantName
 * @returns {Promise<string|null>} category id or null
 */
export async function getMerchantCategory(merchantName) {
  if (!merchantName) return null;

  const normalized = normalizeMerchantName(merchantName);

  // ── Tier 1: Check user-learned database ──────────────────
  try {
    const learned = await dbGet(STORE, normalized);
    if (learned && learned.category) {
      return learned.category;
    }
  } catch (err) {
    // DB not ready yet — fall through to static
  }

  // ── Tier 2: Check static merchant map ────────────────────
  const root = extractMerchantRoot(merchantName);
  if (STATIC_MERCHANT_MAP[root]) {
    return STATIC_MERCHANT_MAP[root];
  }

  // Also check the full normalized string against static map
  for (const [keyword, category] of Object.entries(STATIC_MERCHANT_MAP)) {
    if (normalized.includes(keyword) || merchantName.toLowerCase().includes(keyword)) {
      return category;
    }
  }

  // ── Tier 3: Unknown ───────────────────────────────────────
  return null;
}

/**
 * detectKnownMerchant(rawText)
 *
 * Scans a string (like OCR output or a bank statement description)
 * and tries to find ANY known merchant pattern inside it.
 *
 * Unlike getMerchantCategory which expects a clean name,
 * this accepts messy multi-line text.
 *
 * Returns: { merchant: string, category: string } or null
 *
 * @param {string} rawText
 * @returns {{ merchant: string, category: string } | null}
 */
export async function detectKnownMerchant(rawText) {
  if (!rawText) return null;
  const lower = rawText.toLowerCase();

  // Check static map first (fastest — no async needed)
  for (const [keyword, category] of Object.entries(STATIC_MERCHANT_MAP)) {
    if (lower.includes(keyword)) {
      // Capitalize for display
      const merchantDisplay = keyword.charAt(0).toUpperCase() + keyword.slice(1);
      return { merchant: merchantDisplay, category };
    }
  }

  // Check user-learned merchants
  try {
    const allLearned = await dbGetAll(STORE);
    for (const entry of allLearned) {
      if (lower.includes(entry.id)) {
        const display = entry.id.charAt(0).toUpperCase() + entry.id.slice(1);
        return { merchant: display, category: entry.category };
      }
      // Check known variants
      if (Array.isArray(entry.variants)) {
        for (const variant of entry.variants) {
          if (lower.includes(variant.toLowerCase())) {
            const display = entry.id.charAt(0).toUpperCase() + entry.id.slice(1);
            return { merchant: display, category: entry.category };
          }
        }
      }
    }
  } catch (err) {
    console.warn('merchantLearning: detectKnownMerchant DB error', err);
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — WRITE: SAVE / UPDATE MERCHANT LEARNING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * saveMerchantCategory(merchantName, category, source)
 *
 * Creates or updates a merchant→category entry in IndexedDB.
 *
 * If the merchant already exists:
 *   - same category → confidence increases by 1
 *   - different category → confidence RESETS to 1 for the new category
 *     (user's explicit choice overrides previous learning)
 *
 * @param {string} merchantName  - raw or normalized merchant name
 * @param {string} category      - category id (e.g. 'food')
 * @param {'user'|'auto'} source - 'user' = explicitly chosen, 'auto' = guessed
 */
export async function saveMerchantCategory(merchantName, category, source = 'auto') {
  if (!merchantName || !category || category === 'other') return;

  const id = normalizeMerchantName(merchantName);
  if (!id || id === 'unknown') return;

  try {
    const existing = await dbGet(STORE, id);
    const today    = new Date().toISOString().split('T')[0];

    if (existing) {
      // Update existing record
      const isSameCategory = existing.category === category;
      const record = {
        ...existing,
        category,
        confidence: isSameCategory ? (existing.confidence || 1) + 1 : 1,
        source:     source === 'user' ? 'user' : existing.source,
        lastSeen:   today,
        variants:   addVariant(existing.variants, merchantName),
      };
      await dbPut(STORE, record);
    } else {
      // Create new record
      const record = {
        id,
        category,
        confidence: source === 'user' ? 2 : 1,  // user entries start with higher confidence
        source,
        firstSeen: today,
        lastSeen:  today,
        variants:  [merchantName],
      };
      await dbPut(STORE, record);
    }
  } catch (err) {
    console.warn('merchantLearning: Failed to save', id, err);
  }
}

/**
 * updateCategoryLearning(merchantName, newCategory)
 *
 * Called when the USER explicitly changes a transaction's category.
 * This is the highest-confidence signal — the user is teaching Vault.
 *
 * Sets source to 'user' and uses a high confidence value.
 *
 * @param {string} merchantName
 * @param {string} newCategory
 */
export async function updateCategoryLearning(merchantName, newCategory) {
  if (!merchantName || !newCategory) return;
  await saveMerchantCategory(merchantName, newCategory, 'user');
  console.log(`Vault Learning: ${normalizeMerchantName(merchantName)} → ${newCategory} (user taught)`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — QUERY: BULK OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getAllLearnings()
 *
 * Returns all merchant→category pairs from IndexedDB.
 * Used by the Settings screen to show the user what Vault has learned.
 *
 * Results are sorted by confidence (most reliable first).
 */
export async function getAllLearnings() {
  try {
    const all = await dbGetAll(STORE);
    return all.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  } catch {
    return [];
  }
}

/**
 * getLearningStats()
 *
 * Returns a summary for the Settings screen:
 * {
 *   totalMerchants: 42,
 *   userTaught:     15,   ← user explicitly corrected these
 *   autoDetected:   27,   ← auto-learned from static map
 *   topCategories: [{ category: 'food', count: 8 }, ...]
 * }
 */
export async function getLearningStats() {
  try {
    const all = await getAllLearnings();
    const userTaught    = all.filter(e => e.source === 'user').length;
    const autoDetected  = all.filter(e => e.source !== 'user').length;

    // Count by category
    const catCount = {};
    all.forEach(e => { catCount[e.category] = (catCount[e.category] || 0) + 1; });
    const topCategories = Object.entries(catCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return {
      totalMerchants: all.length,
      userTaught,
      autoDetected,
      topCategories,
    };
  } catch {
    return { totalMerchants: 0, userTaught: 0, autoDetected: 0, topCategories: [] };
  }
}

/**
 * deleteMerchantLearning(merchantName)
 * Removes a single learned entry (for the Settings "forget" action).
 */
export async function deleteMerchantLearning(merchantName) {
  const id = normalizeMerchantName(merchantName);
  try {
    const { dbDelete } = await import('./database.js');
    await dbDelete(STORE, id);
  } catch (err) {
    console.warn('merchantLearning: Failed to delete', id, err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Add a name variant to the variants array (max 10, no duplicates) */
function addVariant(existing, newVariant) {
  const arr = Array.isArray(existing) ? existing : [];
  if (!arr.includes(newVariant)) {
    return [...arr, newVariant].slice(-10);
  }
  return arr;
}
