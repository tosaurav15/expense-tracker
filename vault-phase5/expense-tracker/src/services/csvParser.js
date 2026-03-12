/**
 * ============================================================
 *  VAULT — CSV PARSER  (src/services/csvParser.js)
 * ============================================================
 *
 *  What this file does:
 *  --------------------
 *  Reads a CSV (Comma-Separated Values) file — the kind you
 *  download from your bank's website — and converts each row
 *  into a standard Vault transaction object.
 *
 *  What is a CSV?
 *  --------------
 *  A CSV file looks like this:
 *
 *    Date,Description,Debit,Credit,Balance
 *    15/03/2026,Swiggy Order,350,,24650
 *    14/03/2026,Salary Credit,,75000,25000
 *
 *  Every bank formats their CSV slightly differently, so this
 *  parser uses a "smart column detector" that tries many
 *  common column name variations automatically.
 *
 *  Supported bank formats (auto-detected):
 *  ----------------------------------------
 *  • HDFC Bank
 *  • ICICI Bank
 *  • SBI
 *  • Axis Bank
 *  • Kotak Bank
 *  • Generic (any CSV with date + amount columns)
 *
 *  Exported function:
 *  ------------------
 *  parseCSV(file) → Promise<Array<NormalisedTransaction>>
 */

import Papa from 'papaparse';
import { normaliseTransaction } from './importService.js';

// ─── COLUMN NAME MAPS ────────────────────────────────────────────────────────
// Each bank uses different column headers. We try all known variations.

const DATE_COLUMNS    = ['date', 'txn date', 'transaction date', 'value date',
                          'posting date', 'trans date', 'tran date', 'txndate'];

const DESC_COLUMNS    = ['description', 'narration', 'particulars', 'remarks',
                          'details', 'transaction details', 'txn description',
                          'transaction narration', 'detail'];

const DEBIT_COLUMNS   = ['debit', 'debit amount', 'withdrawal', 'withdrawal amt',
                          'dr amount', 'dr', 'amount(dr)', 'debit(inr)',
                          'withdrawal amount', 'dr amt'];

const CREDIT_COLUMNS  = ['credit', 'credit amount', 'deposit', 'deposit amt',
                          'cr amount', 'cr', 'amount(cr)', 'credit(inr)',
                          'deposit amount', 'cr amt'];

const AMOUNT_COLUMNS  = ['amount', 'transaction amount', 'txn amount', 'amt',
                          'transaction amt'];

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * parseCSV(file)
 *
 * @param {File} file - A File object from an <input type="file">
 * @returns {Promise<Array>} Array of normalised transaction objects
 */
export async function parseCSV(file) {
  // Step 1: Read the file text
  const text = await readFileAsText(file);

  // Step 2: Use PapaParse to turn CSV text into a JavaScript array
  // PapaParse handles edge-cases like quoted commas, BOM markers, etc.
  const result = Papa.parse(text, {
    header:           true,    // use first row as column names
    skipEmptyLines:   true,    // ignore blank lines
    dynamicTyping:    false,   // keep everything as strings (we parse manually)
    transformHeader:  h => h.trim().toLowerCase().replace(/\s+/g, ' '),
  });

  if (!result.data || result.data.length === 0) {
    throw new Error('CSV file appears to be empty or has no data rows.');
  }

  // Step 3: Detect which columns hold which values
  const headers = Object.keys(result.data[0]);
  const colMap  = detectColumns(headers);

  if (!colMap.date) {
    throw new Error(
      'Could not find a date column. Expected headers like "Date", "Txn Date", or "Transaction Date".'
    );
  }
  if (!colMap.debit && !colMap.credit && !colMap.amount) {
    throw new Error(
      'Could not find amount columns. Expected "Debit/Credit", "Withdrawal/Deposit", or "Amount".'
    );
  }

  // Step 4: Convert each row into a Vault transaction
  const transactions = [];

  for (const row of result.data) {
    try {
      const txn = rowToTransaction(row, colMap);
      if (txn) transactions.push(txn);
    } catch (err) {
      // Skip unparseable rows silently — bank CSVs often have summary rows
      console.warn('CSV: Skipping row —', err.message, row);
    }
  }

  if (transactions.length === 0) {
    throw new Error(
      'No valid transactions found. The file may be a summary page, not a transaction list.'
    );
  }

  return transactions;
}

// ─── COLUMN DETECTOR ─────────────────────────────────────────────────────────

/**
 * detectColumns(headers)
 *
 * Given the list of column names from the CSV, finds which column
 * name maps to which logical field (date, description, debit, credit, amount).
 *
 * Returns an object like:
 * { date: 'txn date', description: 'narration', debit: 'debit amount', credit: 'credit amount' }
 */
function detectColumns(headers) {
  const find = (candidates) =>
    headers.find(h => candidates.includes(h.toLowerCase().trim())) || null;

  return {
    date:        find(DATE_COLUMNS),
    description: find(DESC_COLUMNS),
    debit:       find(DEBIT_COLUMNS),
    credit:      find(CREDIT_COLUMNS),
    amount:      find(AMOUNT_COLUMNS),
  };
}

// ─── ROW CONVERTER ───────────────────────────────────────────────────────────

/**
 * rowToTransaction(row, colMap)
 *
 * Converts one CSV row (a plain object from PapaParse) into
 * a normalised Vault transaction.
 *
 * Returns null if the row has no usable amount (e.g. header or summary rows).
 */
function rowToTransaction(row, colMap) {
  // ── Extract amount ────────────────────────────────────────
  let amount = 0;
  let type   = 'expense';

  if (colMap.debit || colMap.credit) {
    // Bank statement style: separate debit and credit columns
    const debitRaw  = colMap.debit  ? cleanNumber(row[colMap.debit])  : 0;
    const creditRaw = colMap.credit ? cleanNumber(row[colMap.credit]) : 0;

    if (creditRaw > 0) {
      amount = creditRaw;
      type   = 'income';
    } else if (debitRaw > 0) {
      amount = debitRaw;
      type   = 'expense';
    } else {
      return null; // row has no amount — skip it
    }
  } else if (colMap.amount) {
    // Single amount column — negative = expense, positive = income
    const raw = cleanNumber(row[colMap.amount]);
    if (raw === 0) return null;
    amount = Math.abs(raw);
    type   = raw < 0 ? 'expense' : 'income';
  } else {
    return null;
  }

  // ── Extract date ──────────────────────────────────────────
  const rawDate = row[colMap.date] ? row[colMap.date].trim() : '';
  const date    = parseDate(rawDate);
  if (!date) return null; // skip rows with unparseable dates

  // ── Extract description ───────────────────────────────────
  const description = colMap.description
    ? (row[colMap.description] || '').trim()
    : '';

  // ── Build normalised object ───────────────────────────────
  return normaliseTransaction({
    amount,
    type,
    date,
    merchant: description,
    notes:    description,
    source:   'csv',
  });
}

// ─── DATE PARSER ─────────────────────────────────────────────────────────────

/**
 * parseDate(raw)
 *
 * Banks format dates in many ways. We try the most common ones:
 *   DD/MM/YYYY  →  15/03/2026
 *   DD-MM-YYYY  →  15-03-2026
 *   MM/DD/YYYY  →  03/15/2026
 *   YYYY-MM-DD  →  2026-03-15  (ISO)
 *   DD Mon YYYY →  15 Mar 2026
 *   Mon DD YYYY →  Mar 15, 2026
 *
 * Returns a string in YYYY-MM-DD format, or null if unrecognised.
 */
function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();

  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY (most Indian banks)
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const y = yRaw.length === 2 ? '20' + yRaw : yRaw;
    const date = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
    if (!isNaN(date)) return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }

  // Try native Date parsing as a fallback
  const d = new Date(s);
  if (!isNaN(d)) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

// ─── NUMBER CLEANER ──────────────────────────────────────────────────────────

/**
 * cleanNumber(raw)
 *
 * Converts a string like "₹1,234.56 DR" to the number -1234.56
 * Handles Indian number formatting (1,23,456.78)
 */
function cleanNumber(raw) {
  if (!raw || raw === '' || raw === '-' || raw === '--') return 0;
  // Remove currency symbols, spaces, quotes
  let s = String(raw).replace(/[₹$€£,\s"']/g, '').trim();
  // Detect DR/CR suffix used by some banks
  const isDr = /\bdr\b/i.test(s);
  const isCr = /\bcr\b/i.test(s);
  s = s.replace(/[a-zA-Z]/g, '').trim();
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return isDr ? -Math.abs(n) : isCr ? Math.abs(n) : n;
}

// ─── FILE READER HELPER ──────────────────────────────────────────────────────

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = ()  => reject(new Error('Could not read file'));
    reader.readAsText(file, 'UTF-8');
  });
}
