/**
 * ============================================================
 *  VAULT — PDF PARSER  (src/services/pdfParser.js)
 * ============================================================
 *
 *  What this file does:
 *  --------------------
 *  Reads a PDF bank statement and extracts the transaction
 *  table from it using PDF.js (the same PDF reader that
 *  powers Mozilla Firefox's built-in PDF viewer).
 *
 *  How PDF text extraction works:
 *  --------------------------------
 *  PDFs store text as individual positioned "text items" —
 *  imagine hundreds of sticky notes placed at exact X,Y
 *  coordinates on the page. There are no "rows" or "columns".
 *
 *  To reconstruct a table, we:
 *  1. Extract all text items with their Y positions
 *  2. Group items that share the same Y coordinate into "rows"
 *  3. Sort items within each row by X coordinate (left→right)
 *  4. Look for rows that match a transaction pattern
 *     (date + description + numbers)
 *
 *  This works for most bank PDFs that use digital text (not
 *  scanned images). For scanned PDFs, OCR (Phase 5) is needed.
 *
 *  Exported function:
 *  ------------------
 *  parsePDF(file) → Promise<Array<NormalisedTransaction>>
 */

import { normaliseTransaction } from './importService.js';

// ─── MAIN EXPORT ─────────────────────────────────────────────────────────────

/**
 * parsePDF(file)
 *
 * @param {File} file - A .pdf File object from <input type="file">
 * @returns {Promise<Array>} Array of normalised transaction objects
 */
export async function parsePDF(file) {
  // Step 1: Dynamically import pdfjs-dist
  // We import it dynamically so it only loads when the user
  // actually tries to import a PDF (keeps initial load fast)
  let pdfjsLib;
  try {
    pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
  } catch (e) {
    throw new Error(
      'PDF reader library failed to load. Please try a CSV or Excel file instead.'
    );
  }

  // Step 2: Configure the PDF.js worker
  // The worker is a background thread that does the heavy PDF parsing
  // We point it to the pre-built worker file included with pdfjs-dist
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
  }

  // Step 3: Read the PDF file as an ArrayBuffer
  const arrayBuffer = await readFileAsArrayBuffer(file);

  // Step 4: Load the PDF document
  let pdfDoc;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data:             new Uint8Array(arrayBuffer),
      useWorkerFetch:   false,
      isEvalSupported:  false,
      useSystemFonts:   true,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err) {
    throw new Error(
      `Could not open PDF: ${err.message}. ` +
      'Please ensure it is a text-based PDF, not a scanned image.'
    );
  }

  // Step 5: Extract text from all pages
  const allPageTexts = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page    = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    allPageTexts.push(content.items);
  }

  // Step 6: Reconstruct rows from positioned text items
  const rows = reconstructRows(allPageTexts.flat());

  // Step 7: Find transaction rows using pattern matching
  const transactions = extractTransactions(rows);

  if (transactions.length === 0) {
    throw new Error(
      'No transactions could be extracted from this PDF. ' +
      'This may be a scanned document. Try downloading the statement as CSV or Excel instead.'
    );
  }

  return transactions;
}

// ─── TEXT ROW RECONSTRUCTOR ──────────────────────────────────────────────────

/**
 * reconstructRows(textItems)
 *
 * Groups text items by their Y position (vertical coordinate) to
 * reconstruct the original table rows.
 *
 * Items within ~2 units of the same Y value are considered the same row.
 * Items are then sorted left-to-right by X position within each row.
 *
 * @param {Array} textItems - Raw text items from PDF.js getTextContent()
 * @returns {Array<string[]>} Array of rows, each row is an array of text tokens
 */
function reconstructRows(textItems) {
  if (!textItems || textItems.length === 0) return [];

  // Build a map of y-coordinate → text items
  const yMap = new Map();

  for (const item of textItems) {
    if (!item.str || !item.str.trim()) continue;
    const y = Math.round(item.transform[5]); // Y position (rounded to nearest pixel)

    // Group nearby y-values (within 3 units) together
    let key = y;
    for (const existingY of yMap.keys()) {
      if (Math.abs(existingY - y) <= 3) {
        key = existingY;
        break;
      }
    }

    if (!yMap.has(key)) yMap.set(key, []);
    yMap.get(key).push({ text: item.str.trim(), x: item.transform[4] });
  }

  // Sort by Y descending (PDFs have Y=0 at bottom, we want top-first)
  const sortedYs = [...yMap.keys()].sort((a, b) => b - a);

  // For each row, sort items left-to-right by X and return as string array
  return sortedYs.map(y => {
    const items = yMap.get(y);
    items.sort((a, b) => a.x - b.x);
    return items.map(i => i.text).filter(t => t.length > 0);
  });
}

// ─── TRANSACTION EXTRACTOR ───────────────────────────────────────────────────

/**
 * extractTransactions(rows)
 *
 * Scans through the reconstructed rows and identifies which ones
 * are transaction entries (as opposed to headers, summaries, footers).
 *
 * A transaction row is identified by having:
 * - A date-like value
 * - At least one number that could be an amount
 *
 * @param {Array<string[]>} rows
 * @returns {Array} Normalised transaction objects
 */
function extractTransactions(rows) {
  const transactions = [];

  for (const row of rows) {
    if (!row || row.length < 2) continue;

    const rowText = row.join(' ');

    // Skip obvious header/footer rows
    if (isHeaderRow(rowText)) continue;

    // Try to find a date in this row
    const date = extractDateFromRow(row);
    if (!date) continue;

    // Try to find amount(s) in this row
    const amounts = extractAmountsFromRow(row);
    if (amounts.length === 0) continue;

    // The description is everything between the date and the first number
    const description = extractDescription(row, date);

    // Determine type: look for CR/DR markers or use column position heuristics
    const { amount, type } = determineAmountAndType(amounts, row);
    if (!amount || amount <= 0) continue;

    transactions.push(normaliseTransaction({
      amount,
      type,
      date,
      merchant:    description,
      notes:       description,
      source:      'pdf',
    }));
  }

  return transactions;
}

// ─── PATTERN HELPERS ─────────────────────────────────────────────────────────

/**
 * Date patterns we look for in PDF rows
 */
const DATE_PATTERNS = [
  /\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})\b/,   // DD/MM/YYYY
  /\b(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})\b/,      // YYYY/MM/DD
  /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})\b/i,
];

const MONTH_MAP = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
};

function extractDateFromRow(row) {
  const rowText = row.join(' ');
  for (const pattern of DATE_PATTERNS) {
    const match = rowText.match(pattern);
    if (match) {
      return parseMatchedDate(match);
    }
  }
  return null;
}

function parseMatchedDate(match) {
  try {
    const raw = match[0];
    // Textual month: "15 Mar 2026"
    if (/[a-zA-Z]/.test(raw)) {
      const parts = raw.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{2,4})/i);
      if (parts) {
        const d = parseInt(parts[1]);
        const m = MONTH_MAP[parts[2].toLowerCase().slice(0, 3)] || 1;
        const y = parts[3].length === 2 ? '20' + parts[3] : parts[3];
        return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      }
    }
    // Numeric: DD/MM/YYYY
    const dmy = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (dmy) {
      const [, d, m, yRaw] = dmy;
      const y = yRaw.length === 2 ? '20' + yRaw : yRaw;
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    // ISO
    const iso = raw.match(/^(\d{4})[\/\-\.](\d{2})[\/\-\.](\d{2})$/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  } catch (e) { /* */ }
  return null;
}

function extractAmountsFromRow(row) {
  const amounts = [];
  const numPattern = /^-?[\d,]+(\.\d{1,2})?$/;

  for (const token of row) {
    const clean = token.replace(/[₹$,\s]/g, '').replace(/dr|cr/gi, '');
    if (numPattern.test(clean)) {
      const n = parseFloat(clean);
      if (!isNaN(n) && Math.abs(n) > 0.01) {
        amounts.push({ value: Math.abs(n), raw: token });
      }
    }
  }
  return amounts;
}

function determineAmountAndType(amounts, row) {
  if (amounts.length === 0) return { amount: 0, type: 'expense' };

  const rowText = row.join(' ').toLowerCase();

  // Explicit CR/DR markers are the most reliable signal
  const hasCr = /\bcr\b/.test(rowText);
  const hasDr = /\bdr\b/.test(rowText);

  if (hasCr) return { amount: amounts[amounts.length - 1].value, type: 'income' };
  if (hasDr) return { amount: amounts[amounts.length - 1].value, type: 'expense' };

  // Heuristic: if there are two amounts (debit + credit columns),
  // the non-zero one tells us the type
  if (amounts.length >= 2) {
    // Last non-zero amount before balance column
    const txnAmount = amounts[amounts.length > 2 ? amounts.length - 2 : 0];
    // Assume expense unless we can identify credit keywords
    return { amount: txnAmount.value, type: 'expense' };
  }

  // Single amount — default to expense, let auto-categorisation help
  return { amount: amounts[0].value, type: 'expense' };
}

function extractDescription(row, date) {
  // Join everything, remove the date and numbers, keep the textual parts
  return row
    .filter(token => {
      const clean = token.replace(/[₹$,\s]/g, '');
      const isNumber = /^-?[\d.]+$/.test(clean);
      const isDate   = DATE_PATTERNS.some(p => p.test(token));
      return !isNumber && !isDate && token.length > 1;
    })
    .join(' ')
    .trim()
    .slice(0, 100); // cap description at 100 chars
}

const SKIP_PATTERNS = [
  /^(date|description|narration|particulars|debit|credit|balance|amount|opening|closing|total)/i,
  /^page\s+\d+/i,
  /^statement/i,
  /account\s+(number|no|#)/i,
];

function isHeaderRow(text) {
  return SKIP_PATTERNS.some(p => p.test(text.trim()));
}

// ─── FILE READER ─────────────────────────────────────────────────────────────

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = (e) => resolve(e.target.result);
    reader.onerror = ()  => reject(new Error('Could not read PDF file'));
    reader.readAsArrayBuffer(file);
  });
}
