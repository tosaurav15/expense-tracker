/**
 * ============================================================
 *  VAULT — BACKUP SERVICE  (src/services/backupService.js)
 * ============================================================
 *
 *  Handles all data export and restore operations.
 *
 *  Export formats:
 *  ───────────────
 *  CSV          — open in Excel / Numbers, importable by other apps
 *  Excel XLSX   — full spreadsheet with formatting
 *  .vault JSON  — encrypted, only Vault can restore (AES-256-GCM)
 *
 *  Why three formats?
 *    • CSV/Excel — for interoperability, moving data out of Vault
 *    • .vault    — for safe migration to a new device (encrypted)
 *
 *  ─────────────────────────────────────────────────────────
 *  EXPORTED FUNCTIONS
 *  ─────────────────────────────────────────────────────────
 *
 *  exportToCSV(transactions)
 *    → triggers a .csv file download
 *
 *  exportToExcel(transactions, categories)
 *    → triggers a .xlsx file download
 *
 *  exportEncryptedBackup(transactions, categories, password)
 *    → triggers a .vault file download
 *
 *  importVaultBackup(file, password)
 *    → decrypts and returns { transactions, categories }
 *
 *  getBackupStats(transactions)
 *    → { transactionCount, dateRange, totalExpenses, totalIncome }
 */

import { encryptData, decryptData } from './encryptionService.js';

// ─── CSV EXPORT ──────────────────────────────────────────────────────────────

/**
 * exportToCSV(transactions)
 *
 * Converts the transaction array to a CSV string and downloads it.
 * Uses BOM (byte order mark) so Excel opens it correctly on Windows.
 */
export function exportToCSV(transactions) {
  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions to export.');
  }

  const headers = ['Date', 'Type', 'Category', 'Merchant', 'Amount', 'Payment Method', 'Notes'];

  const rows = transactions
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(t => [
      t.date,
      t.type,
      t.category,
      `"${(t.merchant || '').replace(/"/g, '""')}"`,  // escape quotes
      t.amount,
      t.paymentMethod || '',
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ]);

  const csv = [
    '\uFEFF' + headers.join(','),   // BOM + header row
    ...rows.map(r => r.join(',')),
  ].join('\n');

  downloadFile(
    csv,
    `vault-export-${dateStamp()}.csv`,
    'text/csv;charset=utf-8;'
  );
}

// ─── EXCEL EXPORT ────────────────────────────────────────────────────────────

/**
 * exportToExcel(transactions, categories)
 *
 * Creates a proper .xlsx file with two sheets:
 *   Sheet 1: Transactions (all data)
 *   Sheet 2: Category Summary (totals per category)
 */
export async function exportToExcel(transactions, categories = []) {
  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions to export.');
  }

  // Lazy-load xlsx only when needed
  const XLSX = await import('xlsx');

  // ── Sheet 1: All transactions ─────────────────────────────
  const txnRows = [
    ['Date', 'Type', 'Category', 'Merchant', 'Amount (₹)', 'Payment Method', 'Notes'],
    ...transactions
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(t => [
        t.date,
        t.type,
        t.category,
        t.merchant || '',
        t.amount,
        t.paymentMethod || '',
        t.notes || '',
      ]),
  ];

  // ── Sheet 2: Category summary ─────────────────────────────
  const catTotals = {};
  transactions.forEach(t => {
    if (t.type === 'expense') {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    }
  });

  const catRows = [
    ['Category', 'Total Spent (₹)', 'Transaction Count'],
    ...Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => [
        cat,
        total,
        transactions.filter(t => t.category === cat && t.type === 'expense').length,
      ]),
  ];

  // ── Build workbook ────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.aoa_to_sheet(txnRows);
  // Auto-fit column widths
  ws1['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Transactions');

  const ws2 = XLSX.utils.aoa_to_sheet(catRows);
  ws2['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Category Summary');

  // ── Download ──────────────────────────────────────────────
  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `vault-export-${dateStamp()}.xlsx`);
}

// ─── ENCRYPTED .vault EXPORT ──────────────────────────────────────────────────

/**
 * exportEncryptedBackup(transactions, categories, password)
 *
 * Encrypts all app data (transactions + categories + metadata)
 * using AES-256-GCM and downloads as a .vault file.
 *
 * @param {Array}  transactions
 * @param {Array}  categories
 * @param {string} password  — chosen by the user
 */
export async function exportEncryptedBackup(transactions, categories, password) {
  if (!password || password.length < 4) {
    throw new Error('Please set a backup password of at least 4 characters.');
  }
  if (!transactions || transactions.length === 0) {
    throw new Error('No transactions to back up.');
  }

  const backupPayload = {
    appName:          'Vault',
    backupVersion:    1,
    exportedAt:       new Date().toISOString(),
    transactionCount: transactions.length,
    transactions,
    categories,
  };

  const encrypted = await encryptData(backupPayload, password);

  // Wrap in a .vault envelope so we can identify the file format
  const vaultFile = JSON.stringify({
    format:    'vault-encrypted-backup',
    version:   1,
    createdAt: new Date().toISOString(),
    hint:      'Open with Vault app · Settings → Restore from Backup',
    payload:   encrypted,
  });

  downloadFile(
    vaultFile,
    `vault-backup-${dateStamp()}.vault`,
    'application/json'
  );
}

// ─── RESTORE FROM .vault ──────────────────────────────────────────────────────

/**
 * importVaultBackup(file, password)
 *
 * Reads a .vault file, decrypts it, and returns the backup data.
 * Caller is responsible for saving to IndexedDB.
 *
 * @param {File}   file
 * @param {string} password
 * @returns {Promise<{ transactions, categories }>}
 */
export async function importVaultBackup(file, password) {
  const text = await readFileAsText(file);

  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid Vault backup.');
  }

  if (envelope.format !== 'vault-encrypted-backup') {
    throw new Error('This file was not created by Vault. Please use a .vault backup file.');
  }

  const decrypted = await decryptData(envelope.payload, password);

  if (!decrypted.transactions) {
    throw new Error('Backup file does not contain transaction data.');
  }

  return {
    transactions: decrypted.transactions || [],
    categories:   decrypted.categories   || [],
    exportedAt:   decrypted.exportedAt,
    transactionCount: decrypted.transactionCount || decrypted.transactions.length,
  };
}

// ─── BACKUP STATS ─────────────────────────────────────────────────────────────

/**
 * getBackupStats(transactions)
 * Returns a quick summary for the export confirmation dialog.
 */
export function getBackupStats(transactions) {
  if (!transactions || transactions.length === 0) {
    return { transactionCount: 0, dateRange: 'No data', totalExpenses: 0, totalIncome: 0 };
  }

  const sorted  = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const oldest  = sorted[0].date;
  const newest  = sorted[sorted.length - 1].date;

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + t.amount, 0);

  return {
    transactionCount: transactions.length,
    dateRange:        `${oldest} → ${newest}`,
    totalExpenses,
    totalIncome,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

function downloadBlob(blob, filename) {
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  return new Date().toISOString().split('T')[0];
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Could not read backup file'));
    reader.readAsText(file, 'UTF-8');
  });
}
