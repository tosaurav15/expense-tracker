/**
 * ============================================================
 *  VAULT — TRANSACTION SERVICE  (src/services/transactionService.js)
 * ============================================================
 *
 *  This file contains ALL operations related to transactions.
 *  Think of it as the "receptionist" — the UI never talks
 *  directly to the database; it always goes through here.
 *
 *  Why a service layer?
 *  --------------------
 *  - One place to validate data before saving
 *  - One place to apply business rules (e.g. generate IDs)
 *  - Easy to test and debug
 *  - If we ever change the database, only this file changes
 *
 *  Functions exported:
 *  -------------------
 *  addTransaction(data)      → saves a new transaction
 *  updateTransaction(data)   → edits an existing transaction
 *  deleteTransaction(id)     → removes a transaction permanently
 *  getTransaction(id)        → fetches one transaction by id
 *  getAllTransactions()       → fetches all transactions
 *  getTransactionsByMonth()  → fetches transactions for a month
 *  getMonthlySummary()       → calculates income / expenses / savings
 *  searchTransactions(query) → full-text search across transactions
 *  getAllCategories()         → fetches all categories
 */

import { dbGet, dbGetAll, dbAdd, dbPut, dbDelete, dbGetByIndex } from './database.js';

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const STORE = 'transactions';

// Merchant → Category mapping for auto-categorisation
// Phase 5 will make this smarter, but we start with known merchants
const MERCHANT_CATEGORY_MAP = {
  // Food & Delivery
  swiggy: 'food', zomato: 'food', dominos: 'food', mcdonalds: 'food',
  'burger king': 'food', subway: 'food', kfc: 'food', pizza: 'food',
  starbucks: 'food', dunkin: 'food', chai: 'food', coffee: 'food',
  // Groceries
  bigbasket: 'groceries', blinkit: 'groceries', zepto: 'groceries',
  dmart: 'groceries', reliance: 'groceries', more: 'groceries',
  // Transport
  uber: 'transport', ola: 'transport', rapido: 'transport', metro: 'transport',
  bus: 'transport', train: 'transport', irctc: 'transport', petrol: 'transport',
  // Shopping
  amazon: 'shopping', flipkart: 'shopping', myntra: 'shopping',
  ajio: 'shopping', meesho: 'shopping', snapdeal: 'shopping',
  // Entertainment
  netflix: 'entertainment', spotify: 'entertainment', prime: 'entertainment',
  hotstar: 'entertainment', youtube: 'entertainment', zee5: 'entertainment',
  pvr: 'entertainment', inox: 'entertainment',
  // Bills
  airtel: 'bills', jio: 'bills', bsnl: 'bills', vodafone: 'bills',
  electricity: 'bills', water: 'bills', gas: 'bills', insurance: 'bills',
  // Health
  pharmacy: 'health', medical: 'health', hospital: 'health', doctor: 'health',
  // Salary
  salary: 'salary', payroll: 'salary',
};

// ─── ID GENERATOR ────────────────────────────────────────────────────────────

/**
 * generateId()
 * Creates a unique string ID for each transaction.
 * Example output: "txn_1709800000000_ab3f"
 *
 * We use timestamp + random suffix to guarantee uniqueness.
 */
function generateId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 6);
  return `txn_${timestamp}_${random}`;
}

// ─── DATA VALIDATOR ──────────────────────────────────────────────────────────

/**
 * validateTransaction(data)
 *
 * Checks that required fields are present and sensible.
 * Returns { valid: true } or { valid: false, error: 'message' }
 */
function validateTransaction(data) {
  if (!data.amount || isNaN(data.amount)) {
    return { valid: false, error: 'Amount must be a number' };
  }
  if (parseFloat(data.amount) <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }
  if (!data.type || !['income', 'expense', 'transfer'].includes(data.type)) {
    return { valid: false, error: 'Type must be income, expense, or transfer' };
  }
  if (!data.date) {
    return { valid: false, error: 'Date is required' };
  }
  return { valid: true };
}

// ─── AUTO CATEGORISE ─────────────────────────────────────────────────────────

/**
 * autoCategory(merchant)
 *
 * Given a merchant name, returns a best-guess category.
 * Looks for partial matches — so "Swiggy Food" still maps to 'food'.
 *
 * Returns the category id string, or 'other' if not recognised.
 */
export function autoCategory(merchant) {
  if (!merchant) return 'other';
  const lower = merchant.toLowerCase();
  for (const [keyword, category] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return 'other';
}

// ─── PARSE QUICK ENTRY TEXT ──────────────────────────────────────────────────

/**
 * parseQuickEntry(text)
 *
 * Parses a natural-language string like "450 food swiggy"
 * into a structured transaction object.
 *
 * Rules:
 *  - First token that looks like a number → amount
 *  - Remaining tokens → try to match category, rest is merchant
 *
 * Returns partial transaction data (still needs date, paymentMethod, etc.)
 */
export function parseQuickEntry(text) {
  if (!text || !text.trim()) return null;

  const parts = text.trim().split(/\s+/);
  const result = { type: 'expense' };

  // Find the amount (first numeric token)
  let amountIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    const num = parseFloat(parts[i].replace(/[₹,]/g, ''));
    if (!isNaN(num) && num > 0) {
      result.amount = num;
      amountIndex = i;
      break;
    }
  }

  if (amountIndex === -1) return null; // no amount found

  // Remaining parts after the amount
  const rest = parts.filter((_, i) => i !== amountIndex);

  if (rest.length === 0) {
    result.category = 'other';
    result.merchant = '';
  } else if (rest.length === 1) {
    // Could be category or merchant — try category first
    const catMatch = guessCategory(rest[0]);
    if (catMatch !== 'other') {
      result.category = catMatch;
      result.merchant = '';
    } else {
      result.merchant = rest[0];
      result.category = autoCategory(rest[0]);
    }
  } else {
    // First word might be category hint, rest is merchant
    const catHint = guessCategory(rest[0]);
    if (catHint !== 'other') {
      result.category = catHint;
      result.merchant = rest.slice(1).join(' ');
    } else {
      // All of it is merchant name
      result.merchant = rest.join(' ');
      result.category = autoCategory(result.merchant);
    }
  }

  return result;
}

// Maps common typed words to category ids
function guessCategory(word) {
  const map = {
    food: 'food', eat: 'food', lunch: 'food', dinner: 'food', breakfast: 'food',
    grocery: 'groceries', groceries: 'groceries', sabzi: 'groceries',
    transport: 'transport', travel: 'transport', cab: 'transport', auto: 'transport',
    shop: 'shopping', shopping: 'shopping', clothes: 'shopping',
    bill: 'bills', bills: 'bills', recharge: 'bills', electricity: 'bills',
    ent: 'entertainment', movie: 'entertainment', ott: 'entertainment',
    salary: 'salary', income: 'salary',
    health: 'health', medicine: 'health', medical: 'health',
    invest: 'investment', sip: 'investment', mf: 'investment',
    rent: 'rent',
  };
  return map[word.toLowerCase()] || 'other';
}

// ─── CRUD OPERATIONS ─────────────────────────────────────────────────────────

/**
 * addTransaction(data)
 *
 * Creates and saves a brand new transaction.
 *
 * @param {object} data - The form data from the UI
 * @returns {object} The saved transaction (with id, createdAt added)
 */
export async function addTransaction(data) {
  // Validate first
  const check = validateTransaction(data);
  if (!check.valid) throw new Error(check.error);

  // Build the complete transaction record
  const transaction = {
    id:            generateId(),
    amount:        parseFloat(data.amount),
    type:          data.type,                          // 'income' | 'expense' | 'transfer'
    category:      data.category || autoCategory(data.merchant || ''),
    merchant:      (data.merchant || '').trim(),
    paymentMethod: data.paymentMethod || 'UPI',
    date:          data.date || new Date().toISOString().split('T')[0], // YYYY-MM-DD
    notes:         (data.notes || '').trim(),
    tags:          Array.isArray(data.tags) ? data.tags : [],
    createdAt:     new Date().toISOString(),
    updatedAt:     new Date().toISOString(),
  };

  await dbAdd(STORE, transaction);
  console.log('Vault: Transaction saved →', transaction.id);
  return transaction;
}

/**
 * updateTransaction(data)
 *
 * Updates an existing transaction. The record must have an `id` field.
 *
 * @param {object} data - Updated transaction data (must include id)
 * @returns {object} The updated transaction
 */
export async function updateTransaction(data) {
  if (!data.id) throw new Error('Cannot update: transaction id is missing');

  const check = validateTransaction(data);
  if (!check.valid) throw new Error(check.error);

  // Fetch the existing record to preserve createdAt
  const existing = await dbGet(STORE, data.id);
  if (!existing) throw new Error(`Transaction ${data.id} not found`);

  const updated = {
    ...existing,              // keep original fields (especially createdAt)
    amount:        parseFloat(data.amount),
    type:          data.type,
    category:      data.category || autoCategory(data.merchant || ''),
    merchant:      (data.merchant || '').trim(),
    paymentMethod: data.paymentMethod || existing.paymentMethod,
    date:          data.date || existing.date,
    notes:         (data.notes || '').trim(),
    tags:          Array.isArray(data.tags) ? data.tags : existing.tags,
    updatedAt:     new Date().toISOString(),
  };

  await dbPut(STORE, updated);
  console.log('Vault: Transaction updated →', updated.id);
  return updated;
}

/**
 * deleteTransaction(id)
 *
 * Permanently deletes a transaction.
 *
 * @param {string} id - The transaction id
 * @returns {boolean} true if deleted
 */
export async function deleteTransaction(id) {
  if (!id) throw new Error('Cannot delete: id is missing');
  await dbDelete(STORE, id);
  console.log('Vault: Transaction deleted →', id);
  return true;
}

/**
 * getTransaction(id)
 *
 * Fetches a single transaction by its id.
 *
 * @param {string} id
 * @returns {object|null} The transaction, or null if not found
 */
export async function getTransaction(id) {
  return await dbGet(STORE, id);
}

/**
 * getAllTransactions()
 *
 * Returns ALL transactions sorted newest-first.
 */
export async function getAllTransactions() {
  const all = await dbGetAll(STORE);
  // Sort by date descending (newest first)
  return all.sort((a, b) => {
    const dateCompare = new Date(b.date) - new Date(a.date);
    if (dateCompare !== 0) return dateCompare;
    // If same date, sort by createdAt
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

/**
 * getTransactionsByMonth(year, month)
 *
 * Returns all transactions for a specific month.
 * Month is 1-indexed (January = 1, December = 12).
 *
 * Example: getTransactionsByMonth(2026, 3) → March 2026
 */
export async function getTransactionsByMonth(year, month) {
  const all = await getAllTransactions();

  return all.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });
}

/**
 * getMonthlySummary(year, month)
 *
 * Calculates income, expenses, and savings for the month.
 * Also calculates a breakdown by category.
 *
 * Returns:
 * {
 *   income: 75000,
 *   expenses: 34200,
 *   savings: 40800,
 *   savingsRate: 54.4,
 *   byCategory: { food: 8400, transport: 3100, ... }
 * }
 */
export async function getMonthlySummary(year, month) {
  const txns = await getTransactionsByMonth(year, month);

  let income = 0;
  let expenses = 0;
  const byCategory = {};

  txns.forEach(t => {
    if (t.type === 'income') {
      income += t.amount;
    } else if (t.type === 'expense') {
      expenses += t.amount;
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    }
  });

  const savings = income - expenses;
  const savingsRate = income > 0 ? parseFloat(((savings / income) * 100).toFixed(1)) : 0;

  return { income, expenses, savings, savingsRate, byCategory, transactionCount: txns.length };
}

/**
 * searchTransactions(query)
 *
 * Searches all transactions whose merchant or notes contain the query string.
 * Case-insensitive.
 */
export async function searchTransactions(query) {
  if (!query || !query.trim()) return getAllTransactions();

  const all = await getAllTransactions();
  const q = query.toLowerCase().trim();

  return all.filter(t =>
    (t.merchant && t.merchant.toLowerCase().includes(q)) ||
    (t.notes && t.notes.toLowerCase().includes(q)) ||
    (t.category && t.category.toLowerCase().includes(q)) ||
    (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q)))
  );
}

/**
 * filterTransactions(filters)
 *
 * Applies multiple filters at once.
 *
 * filters object:
 * {
 *   type: 'expense' | 'income' | 'transfer' | null,
 *   category: 'food' | ... | null,
 *   dateFrom: 'YYYY-MM-DD' | null,
 *   dateTo:   'YYYY-MM-DD' | null,
 *   paymentMethod: 'UPI' | ... | null,
 *   search: 'text' | null,
 * }
 */
export async function filterTransactions(filters = {}) {
  let all = await getAllTransactions();

  if (filters.type) {
    all = all.filter(t => t.type === filters.type);
  }
  if (filters.category) {
    all = all.filter(t => t.category === filters.category);
  }
  if (filters.dateFrom) {
    all = all.filter(t => t.date >= filters.dateFrom);
  }
  if (filters.dateTo) {
    all = all.filter(t => t.date <= filters.dateTo);
  }
  if (filters.paymentMethod) {
    all = all.filter(t => t.paymentMethod === filters.paymentMethod);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    all = all.filter(t =>
      (t.merchant || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q)
    );
  }

  return all;
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

/**
 * getAllCategories()
 * Returns all categories from the database.
 */
export async function getAllCategories() {
  return await dbGetAll('categories');
}

/**
 * addCategory(data)
 * Adds a custom user-defined category.
 */
export async function addCategory(data) {
  const category = {
    id:    data.id || data.name.toLowerCase().replace(/\s+/g, '_'),
    name:  data.name,
    icon:  data.icon || '📦',
    color: data.color || '#5A6A8A',
  };
  await dbPut('categories', category);
  return category;
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────

/**
 * getSetting(key)
 * Reads a single app setting by key.
 */
export async function getSetting(key) {
  const record = await dbGet('settings', key);
  return record ? record.value : null;
}

/**
 * setSetting(key, value)
 * Saves an app setting.
 */
export async function setSetting(key, value) {
  await dbPut('settings', { key, value });
}
