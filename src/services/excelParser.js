/**
 * ============================================================
 *  VAULT — EXCEL PARSER  (src/services/excelParser.js)
 * ============================================================
 *
 *  What this file does:
 *  --------------------
 *  Reads an Excel file (.xlsx or .xls) — typically a bank
 *  statement download — and extracts transactions from it.
 *
 *  What is an Excel file?
 *  -----------------------
 *  Excel files (.xlsx) are spreadsheets. Banks let you
 *  download your statement as an Excel file. This parser:
 *
 *  1. Reads the binary Excel file in your browser
 *  2. Finds the sheet that contains transactions
 *  3. Detects the header row (banks often add logo rows at top)
 *  4. Extracts each transaction row
 *  5. Returns standard Vault transaction objects
 *
 *  The xlsx library does all the heavy lifting of reading
 *  the binary format — we just work with the resulting data.
 *
 *  Exported function:
 *  ------------------
 *  parseExcel(file) → Promise<Array<NormalisedTransaction>>
 */

import * as XLSX from 'xlsx';
import { normaliseTransaction } from './importService.js';

// Column name candidates (same logic as CSV parser)
const DATE_COLUMNS   = ['date', 'txn date', 'transaction date', 'value date',
                         'posting date', 'trans date', 'tran date'];
const DESC_COLUMNS   = ['description', 'narration', 'particulars', 'remarks',
                         'details', 'transaction details', 'txn description'];
const DEBIT_COLUMNS  = ['debit', 'debit amount', 'withdrawal', 'withdrawal amt',
                         'dr amount', 'dr', 'amount(dr)', 'debit(inr)'];
const CREDIT_COLUMNS = ['credit', 'credit amount', 'deposit', 'deposit amt',
                         'cr amount', 'cr', 'amount(cr)', 'credit(inr)'];
const AMOUNT_COLUMNS = ['amount', 'transaction amount', 'txn amount', 'amt'];

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * parseExcel(file)
 *
 * @param {File} file - A .xlsx or .xls File object
 * @returns {Promise<Array>} Array of normalised transaction objects
 */
export async function parseExcel(file) {
  // Step 1: Read file as binary array buffer
  const buffer = await readFileAsArrayBuffer(file);

  // Step 2: Parse with xlsx library
  // The xlsx library can read the binary format and turn it into data
  const workbook = XLSX.read(buffer, {
    type:       'array',
    cellDates:  true,   // convert Excel date serials to JS Date objects
    cellText:   false,
  });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel file has no sheets.');
  }

  // Step 3: Find the best sheet (the one with the most rows, likely transactions)
  let bestSheet = null;
  let bestRowCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const rowCount = range.e.r - range.s.r + 1;
    if (rowCount > bestRowCount) {
      bestRowCount = rowCount;
      bestSheet = sheet;
    }
  }

  if (!bestSheet) {
    throw new Error('Could not find any data in the Excel file.');
  }

  // Step 4: Convert sheet to array of arrays (raw rows)
  // raw: true keeps numbers as numbers, dates as dates
  const rawRows = XLSX.utils.sheet_to_json(bestSheet, {
    header:    1,      // return arrays, not objects
    raw:       false,  // format dates as strings
    dateNF:    'yyyy-mm-dd',
    defval:    '',
  });

  if (!rawRows || rawRows.length < 2) {
    throw new Error('Excel sheet has no data rows.');
  }

  // Step 5: Find the header row (first row that contains date-like and amount-like headers)
  const headerRowIndex = findHeaderRow(rawRows);
  if (headerRowIndex === -1) {
    throw new Error(
      'Could not find a header row with date and amount columns. ' +
      'Please ensure the file is a standard bank statement.'
    );
  }

  // Step 6: Map header names to column indexes
  const headers = rawRows[headerRowIndex].map(h =>
    String(h || '').trim().toLowerCase().replace(/\s+/g, ' ')
  );
  const colMap = detectColumnIndexes(headers);

  // Step 7: Convert data rows to transactions
  const transactions = [];

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.every(cell => !cell)) continue; // skip empty rows

    try {
      const txn = rowToTransaction(row, colMap);
      if (txn) transactions.push(txn);
    } catch (err) {
      console.warn('Excel: Skipping row', i, '—', err.message);
    }
  }

  if (transactions.length === 0) {
    throw new Error('No valid transactions found in the Excel file.');
  }

  return transactions;
}

// ─── HEADER ROW FINDER ───────────────────────────────────────────────────────

/**
 * findHeaderRow(rows)
 *
 * Scans down from the top of the sheet looking for the first row
 * that contains recognisable column headers (date, amount, etc.).
 * Banks often put their logo or account details in the first few rows.
 *
 * Returns the row index, or -1 if not found.
 */
function findHeaderRow(rows) {
  const allCandidates = [
    ...DATE_COLUMNS, ...DESC_COLUMNS,
    ...DEBIT_COLUMNS, ...CREDIT_COLUMNS, ...AMOUNT_COLUMNS,
  ];

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    const cells = row.map(c => String(c || '').trim().toLowerCase());
    // If this row contains at least 2 known header names, it's likely the header
    const matches = cells.filter(c => allCandidates.includes(c)).length;
    if (matches >= 2) return i;
  }
  return -1;
}

// ─── COLUMN INDEX DETECTOR ───────────────────────────────────────────────────

function detectColumnIndexes(headers) {
  const findIdx = (candidates) => {
    const idx = headers.findIndex(h => candidates.includes(h.trim()));
    return idx === -1 ? null : idx;
  };
  return {
    date:        findIdx(DATE_COLUMNS),
    description: findIdx(DESC_COLUMNS),
    debit:       findIdx(DEBIT_COLUMNS),
    credit:      findIdx(CREDIT_COLUMNS),
    amount:      findIdx(AMOUNT_COLUMNS),
  };
}

// ─── ROW CONVERTER ───────────────────────────────────────────────────────────

function rowToTransaction(row, colMap) {
  // ── Amount ────────────────────────────────────────────────
  let amount = 0;
  let type   = 'expense';

  if (colMap.debit !== null || colMap.credit !== null) {
    const debitRaw  = colMap.debit  !== null ? cleanNumber(row[colMap.debit])  : 0;
    const creditRaw = colMap.credit !== null ? cleanNumber(row[colMap.credit]) : 0;

    if (creditRaw > 0) {
      amount = creditRaw;
      type   = 'income';
    } else if (debitRaw > 0) {
      amount = debitRaw;
      type   = 'expense';
    } else {
      return null;
    }
  } else if (colMap.amount !== null) {
    const raw = cleanNumber(row[colMap.amount]);
    if (raw === 0) return null;
    amount = Math.abs(raw);
    type   = raw < 0 ? 'expense' : 'income';
  } else {
    return null;
  }

  // ── Date ──────────────────────────────────────────────────
  const rawDate = colMap.date !== null ? row[colMap.date] : '';
  const date    = parseDate(String(rawDate || '').trim());
  if (!date) return null;

  // ── Description ───────────────────────────────────────────
  const description = colMap.description !== null
    ? String(row[colMap.description] || '').trim()
    : '';

  return normaliseTransaction({
    amount,
    type,
    date,
    merchant: description,
    notes:    description,
    source:   'excel',
  });
}

// ─── DATE PARSER ─────────────────────────────────────────────────────────────

function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const y = yRaw.length === 2 ? '20' + yRaw : yRaw;
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().split('T')[0];
  return null;
}

// ─── NUMBER CLEANER ──────────────────────────────────────────────────────────

function cleanNumber(raw) {
  if (!raw && raw !== 0) return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).replace(/[₹$€£,\s"']/g, '').trim();
  const isDr = /\bdr\b/i.test(s);
  const isCr = /\bcr\b/i.test(s);
  const n = parseFloat(s.replace(/[a-zA-Z]/g, ''));
  if (isNaN(n)) return 0;
  return isDr ? -Math.abs(n) : isCr ? Math.abs(n) : n;
}

// ─── FILE READER ─────────────────────────────────────────────────────────────

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(new Uint8Array(e.target.result));
    reader.onerror = ()  => reject(new Error('Could not read Excel file'));
    reader.readAsArrayBuffer(file);
  });
}
