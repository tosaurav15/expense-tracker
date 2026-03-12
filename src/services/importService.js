/**
 * ============================================================
 *  VAULT — IMPORT SERVICE  (src/services/importService.js)
 * ============================================================
 *
 *  This is the "traffic controller" of the import system.
 *
 *  When a user uploads a file, this service:
 *  1. Looks at the file extension and MIME type → decides format
 *  2. Routes to the correct parser (CSV, Excel, or PDF)
 *  3. Takes whatever the parser returns and normalises it
 *     into the standard Vault transaction shape
 *  4. Applies auto-categorisation to each transaction
 *  5. Returns a preview list for the user to review
 *
 *  The UI never talks to csvParser/excelParser/pdfParser directly.
 *  Everything goes through this file.
 *
 *  Why a single entry point?
 *  --------------------------
 *  If we ever add a new format (e.g. OFX, JSON), we only need
 *  to add one new parser and register it here. The UI stays
 *  exactly the same.
 *
 *  ─────────────────────────────────────────────────────────
 *  EXPORTED FUNCTIONS
 *  ─────────────────────────────────────────────────────────
 *
 *  detectFileType(file)
 *    → 'csv' | 'excel' | 'pdf' | 'unsupported'
 *
 *  importFile(file)
 *    → Promise<ImportResult>
 *      ImportResult = {
 *        transactions: NormalisedTransaction[],
 *        fileType: string,
 *        fileName: string,
 *        totalFound: number,
 *        warnings: string[],
 *      }
 *
 *  normaliseTransaction(rawData)
 *    → NormalisedTransaction
 *      (used by all three parsers to produce a consistent shape)
 *
 *  saveImportedTransactions(transactions)
 *    → Promise<{ saved, skipped, errors }>
 *      Saves all confirmed transactions to IndexedDB
 */

import { autoCategory }    from './transactionService.js';
import { addTransaction }  from './transactionService.js';

// ─── FILE TYPE DETECTOR ──────────────────────────────────────────────────────

/**
 * detectFileType(file)
 *
 * Looks at both the file extension and the MIME type to identify
 * what kind of file this is.
 *
 * Why both? Because browsers sometimes report wrong MIME types,
 * and users sometimes rename files. Checking both is more reliable.
 *
 * @param {File} file
 * @returns {'csv' | 'excel' | 'pdf' | 'unsupported'}
 */
export function detectFileType(file) {
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();

  // CSV detection
  if (name.endsWith('.csv') || type === 'text/csv' || type === 'application/csv') {
    return 'csv';
  }

  // Excel detection (.xlsx = modern Excel, .xls = legacy Excel)
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls')  ||
    type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    type === 'application/vnd.ms-excel'
  ) {
    return 'excel';
  }

  // PDF detection
  if (name.endsWith('.pdf') || type === 'application/pdf') {
    return 'pdf';
  }

  return 'unsupported';
}

// ─── MAIN IMPORT FUNCTION ────────────────────────────────────────────────────

/**
 * importFile(file)
 *
 * The single function the UI calls. It handles everything:
 * detect → parse → normalise → return for preview.
 *
 * @param {File} file
 * @returns {Promise<ImportResult>}
 */
export async function importFile(file) {
  const fileType = detectFileType(file);

  if (fileType === 'unsupported') {
    throw new Error(
      `"${file.name}" is not a supported format. ` +
      'Please upload a CSV, Excel (.xlsx), or PDF bank statement.'
    );
  }

  // File size guard (50MB limit — bank statements are usually <5MB)
  const MAX_SIZE_MB = 50;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(
      `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). ` +
      `Maximum supported size is ${MAX_SIZE_MB}MB.`
    );
  }

  const warnings = [];
  let rawTransactions = [];

  // Route to the correct parser
  try {
    if (fileType === 'csv') {
      const { parseCSV }   = await import('./csvParser.js');
      rawTransactions = await parseCSV(file);

    } else if (fileType === 'excel') {
      const { parseExcel } = await import('./excelParser.js');
      rawTransactions = await parseExcel(file);

    } else if (fileType === 'pdf') {
      const { parsePDF }   = await import('./pdfParser.js');
      rawTransactions = await parsePDF(file);
    }
  } catch (err) {
    // Re-throw with a user-friendly prefix
    throw new Error(`Import failed: ${err.message}`);
  }

  if (!rawTransactions || rawTransactions.length === 0) {
    throw new Error(
      'No transactions were found in this file. ' +
      'Please check that it is a bank statement with transaction data.'
    );
  }

  // Filter out any obviously invalid entries
  const valid   = rawTransactions.filter(isValidTransaction);
  const invalid = rawTransactions.length - valid.length;

  if (invalid > 0) {
    warnings.push(`${invalid} rows were skipped due to missing or invalid data.`);
  }

  // Warn if file is very large (lots of transactions)
  if (valid.length > 500) {
    warnings.push(`${valid.length} transactions found. Import may take a few seconds.`);
  }

  return {
    transactions: valid,
    fileType,
    fileName:     file.name,
    totalFound:   valid.length,
    warnings,
  };
}

// ─── NORMALISE TRANSACTION ───────────────────────────────────────────────────

/**
 * normaliseTransaction(rawData)
 *
 * Takes whatever a parser produces and ensures it matches
 * the exact shape that addTransaction() expects.
 *
 * This is the "adapter" between parsers and the database.
 *
 * Input (rawData) can have any subset of these fields:
 *   amount, type, date, merchant, notes, category, paymentMethod, source
 *
 * Output is always a complete, consistent object.
 *
 * @param {object} rawData
 * @returns {NormalisedTransaction}
 */
export function normaliseTransaction(rawData) {
  const amount = parseFloat(rawData.amount) || 0;
  const type   = normaliseType(rawData.type);
  const date   = normaliseDate(rawData.date);

  // Clean up the merchant/description text
  const merchant = cleanMerchantName(rawData.merchant || rawData.description || '');

  // Auto-categorise based on merchant name (uses Phase 2's autoCategory function)
  const category = rawData.category || autoCategory(merchant);

  return {
    // Note: id and createdAt/updatedAt are added by addTransaction()
    // We don't set them here — the DB layer owns those fields
    amount,
    type,
    category,
    merchant,
    paymentMethod: rawData.paymentMethod || 'Bank Import',
    date,
    notes:         (rawData.notes || merchant || '').trim().slice(0, 200),
    tags:          ['imported', rawData.source || 'file'],
    // importSource is extra metadata we attach to imported transactions
    importSource:  rawData.source || 'file',
  };
}

// ─── SAVE IMPORTED TRANSACTIONS ─────────────────────────────────────────────

/**
 * saveImportedTransactions(transactions)
 *
 * Takes the confirmed list (after user reviews the preview) and
 * saves each one to IndexedDB using the existing addTransaction()
 * function from transactionService — exactly as if the user typed them.
 *
 * Returns a summary of what was saved and what failed.
 *
 * @param {Array}    transactions - The confirmed transaction list
 * @param {Function} onProgress   - Optional callback(current, total) for progress updates
 * @returns {Promise<{ saved, skipped, errors }>}
 */
export async function saveImportedTransactions(transactions, onProgress) {
  let saved   = 0;
  let skipped = 0;
  const errors = [];
  const total = transactions.length;

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i];

    try {
      await addTransaction(txn);
      saved++;
    } catch (err) {
      // Don't abort the whole import for one bad transaction
      skipped++;
      errors.push({ index: i, message: err.message, txn });
      console.warn(`Import: Skipped transaction ${i}:`, err.message);
    }

    // Report progress every 10 transactions
    if (onProgress && (i % 10 === 0 || i === total - 1)) {
      onProgress(i + 1, total);
    }
  }

  return { saved, skipped, errors };
}

// ─── DEDUPLICATION HELPER ────────────────────────────────────────────────────

/**
 * deduplicateTransactions(incoming, existing)
 *
 * Checks imported transactions against ones already in the database
 * to avoid creating duplicates.
 *
 * A transaction is considered a duplicate if another transaction on the
 * same date has the same amount (within ₹1) and same merchant name.
 *
 * @param {Array} incoming - Transactions about to be imported
 * @param {Array} existing - Transactions already in the database
 * @returns {{ unique: Array, duplicates: Array }}
 */
export function deduplicateTransactions(incoming, existing) {
  const unique     = [];
  const duplicates = [];

  for (const txn of incoming) {
    const isDuplicate = existing.some(ex =>
      ex.date === txn.date &&
      Math.abs(ex.amount - txn.amount) < 1 &&
      ex.merchant.toLowerCase().trim() === txn.merchant.toLowerCase().trim()
    );

    if (isDuplicate) {
      duplicates.push(txn);
    } else {
      unique.push(txn);
    }
  }

  return { unique, duplicates };
}

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

function normaliseType(raw) {
  if (!raw) return 'expense';
  const s = String(raw).toLowerCase().trim();
  if (s === 'income' || s === 'credit' || s === 'cr') return 'income';
  if (s === 'transfer') return 'transfer';
  return 'expense';
}

function normaliseDate(raw) {
  if (!raw) return new Date().toISOString().split('T')[0];
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) return raw;
  const d = new Date(raw);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return new Date().toISOString().split('T')[0];
}

function cleanMerchantName(raw) {
  return String(raw || '')
    .trim()
    // Remove UPI transaction reference numbers (UPI/12345678/...)
    .replace(/UPI\/\d+\//gi, 'UPI ')
    // Remove NEFT/IMPS reference codes
    .replace(/(NEFT|IMPS|RTGS)[\/\-]\w+/gi, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

function isValidTransaction(txn) {
  return (
    txn &&
    typeof txn.amount === 'number' &&
    txn.amount > 0 &&
    txn.date &&
    /^\d{4}-\d{2}-\d{2}$/.test(txn.date)
  );
}
