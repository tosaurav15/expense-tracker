/**
 * ============================================================
 *  VAULT — IMPORT TRANSACTIONS  (src/components/ImportTransactions.jsx)
 * ============================================================
 *
 *  This component is a multi-step wizard for importing bank statements.
 *
 *  The 5 stages are:
 *  ─────────────────
 *  Stage 1 — IDLE
 *    Shows the upload area with drag-and-drop and a file picker button.
 *    Lists supported formats and tips.
 *
 *  Stage 2 — PARSING
 *    Shows an animated loading indicator while the file is being read.
 *    The user cannot interact with anything during this stage.
 *
 *  Stage 3 — PREVIEW
 *    Shows a table of all detected transactions.
 *    User can:
 *      - See how many were found
 *      - Review each transaction (amount, date, merchant, category)
 *      - Edit a transaction's category or type (tap to change)
 *      - Toggle individual rows on/off (exclude ones they don't want)
 *      - See any warnings (e.g. potential duplicates)
 *    Then tap "Import X transactions" to confirm.
 *
 *  Stage 4 — IMPORTING
 *    Progress bar while transactions are being saved to IndexedDB one by one.
 *
 *  Stage 5 — DONE
 *    Shows a success summary (how many saved, how many skipped).
 *    Option to import another file or close.
 *
 *  Stage ERROR
 *    Shows the error message with a clear retry option.
 */

import React, { useState, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { importFile, saveImportedTransactions, deduplicateTransactions, detectFileType } from '../services/importService';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = '.csv,.xlsx,.xls,.pdf';

const FORMAT_INFO = [
  {
    ext:   'CSV',
    icon:  '📄',
    color: '#06D6A0',
    tip:   'Download from your bank\'s net banking portal under "Statements"',
  },
  {
    ext:   'Excel',
    icon:  '📊',
    color: '#4CC9F0',
    tip:   'Most banks offer .xlsx download alongside CSV',
  },
  {
    ext:   'PDF',
    icon:  '📑',
    color: '#F0A500',
    tip:   'Monthly PDF statement — works best with digital (not scanned) PDFs',
  },
];

// Type color helper
const typeColor = (t) =>
  t === 'income' ? '#06D6A0' : t === 'transfer' ? '#4CC9F0' : '#FF6B6B';

// Format ₹ number
const fmt = (n) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 1 — IDLE (Upload area)
// ─────────────────────────────────────────────────────────────────────────────

function UploadStage({ onFile, onBack }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = ()    => setDragging(false);
  const handleInputChange = (e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); };

  return (
    <div className="page-enter">
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-xl tap-active flex-shrink-0"
              style={{ background: '#151E35', border: '1px solid #1E2D4F' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8899BB" strokeWidth="2">
                <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <div>
            <h2 className="text-xl" style={{ fontFamily: 'DM Serif Display, serif' }}>
              Import Transactions
            </h2>
            <p className="text-sm" style={{ color: '#8899BB' }}>
              Upload a bank statement to import all transactions at once.
            </p>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div className="px-5 mb-5">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className="rounded-2xl flex flex-col items-center justify-center py-10 px-6 text-center cursor-pointer tap-active transition-all"
          style={{
            border: `2px dashed ${dragging ? '#F0A500' : '#1E2D4F'}`,
            background: dragging ? 'rgba(240,165,0,0.06)' : '#0F1629',
            minHeight: '180px',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
            style={{
              background: dragging ? 'rgba(240,165,0,0.15)' : '#151E35',
              border: `1px solid ${dragging ? '#F0A500' : '#1E2D4F'}`,
              transition: 'all 0.2s',
            }}
          >
            {dragging ? '📂' : '☁️'}
          </div>
          <p className="font-semibold mb-1" style={{ color: '#E8EEFF' }}>
            {dragging ? 'Drop your file here' : 'Tap to choose file'}
          </p>
          <p className="text-xs" style={{ color: '#5A6A8A' }}>
            or drag and drop · CSV, Excel, PDF
          </p>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleInputChange}
            className="hidden"
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Format cards */}
      <div className="px-5 mb-5">
        <p className="text-xs uppercase tracking-wider mb-3" style={{ color: '#5A6A8A', letterSpacing: '0.1em' }}>
          Supported formats
        </p>
        <div className="space-y-2">
          {FORMAT_INFO.map(f => (
            <div
              key={f.ext}
              className="flex items-center gap-3 p-3.5 rounded-xl"
              style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: f.color + '18', border: `1px solid ${f.color}33` }}
              >
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: '#E8EEFF' }}>{f.ext}</p>
                <p className="text-xs" style={{ color: '#5A6A8A' }}>{f.tip}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy note */}
      <div className="px-5">
        <div
          className="flex items-start gap-3 p-4 rounded-xl"
          style={{ background: 'rgba(6,214,160,0.06)', border: '1px solid rgba(6,214,160,0.15)' }}
        >
          <span className="text-lg flex-shrink-0">🔒</span>
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: '#06D6A0' }}>100% Private</p>
            <p className="text-xs leading-relaxed" style={{ color: '#5A6A8A' }}>
              Your file is read entirely in your browser. Nothing is uploaded to any server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 2 — PARSING (loading)
// ─────────────────────────────────────────────────────────────────────────────

function ParsingStage({ fileName, fileType }) {
  const typeLabels = { csv: 'CSV file', excel: 'Excel spreadsheet', pdf: 'PDF statement' };

  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-5">
      <div className="relative w-20 h-20">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
          style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}
        >
          {fileType === 'pdf' ? '📑' : fileType === 'excel' ? '📊' : '📄'}
        </div>
        <div
          className="absolute -right-2 -bottom-2 w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: '#080C18', border: '2px solid #080C18' }}
        >
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: '#1E2D4F', borderTopColor: '#F0A500' }}
          />
        </div>
      </div>

      <div>
        <p className="font-semibold mb-1" style={{ color: '#E8EEFF' }}>
          Reading {typeLabels[fileType] || 'file'}…
        </p>
        <p className="text-sm" style={{ color: '#5A6A8A' }}>
          {fileName}
        </p>
      </div>

      <div className="space-y-1.5 text-xs" style={{ color: '#5A6A8A' }}>
        <p>📍 Detecting transaction columns</p>
        <p>🔍 Extracting rows and amounts</p>
        <p>🏷️ Auto-categorising merchants</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 3 — PREVIEW TABLE
// ─────────────────────────────────────────────────────────────────────────────

function PreviewStage({ result, categories, transactions: existingTxns, onConfirm, onReset }) {
  const [rows, setRows]            = useState(() =>
    result.transactions.map((t, i) => ({ ...t, _idx: i, _selected: true }))
  );
  const [checkDupes]               = useState(true);

  // Detect potential duplicates against already-saved transactions
  const { duplicates } = checkDupes
    ? deduplicateTransactions(result.transactions, existingTxns)
    : { duplicates: [] };

  const dupSet = new Set(
    duplicates.map(d => `${d.date}|${d.amount}|${d.merchant}`)
  );

  const isDupe = (txn) => dupSet.has(`${txn.date}|${txn.amount}|${txn.merchant}`);

  // Toggle a single row selection
  const toggleRow = (idx) =>
    setRows(prev => prev.map(r => r._idx === idx ? { ...r, _selected: !r._selected } : r));

  // Toggle all
  const allSelected = rows.every(r => r._selected);
  const toggleAll   = () => setRows(prev => prev.map(r => ({ ...r, _selected: !allSelected })));

  // Update a category for a single row
  const setCategory = (idx, catId) =>
    setRows(prev => prev.map(r => r._idx === idx ? { ...r, category: catId } : r));

  // Update type for a single row
  const setType = (idx, type) =>
    setRows(prev => prev.map(r => r._idx === idx ? { ...r, type } : r));

  const selectedRows = rows.filter(r => r._selected);
  const dupeCount    = rows.filter(r => isDupe(r) && r._selected).length;

  const totalIncome  = selectedRows.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = selectedRows.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={onReset}
            className="w-8 h-8 flex items-center justify-center rounded-xl tap-active flex-shrink-0"
            style={{ background: '#151E35', border: '1px solid #1E2D4F' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8899BB" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#E8EEFF' }}>
              Review Transactions
            </h2>
            <p className="text-xs" style={{ color: '#5A6A8A' }}>{result.fileName}</p>
          </div>
        </div>

        {/* Summary pills */}
        <div className="flex gap-2 flex-wrap">
          <span
            className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(240,165,0,0.15)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.3)' }}
          >
            {result.totalFound} found
          </span>
          <span
            className="px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0', border: '1px solid rgba(6,214,160,0.25)' }}
          >
            {selectedRows.length} selected
          </span>
          {dupeCount > 0 && (
            <span
              className="px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ background: 'rgba(255,107,107,0.12)', color: '#FF6B6B', border: '1px solid rgba(255,107,107,0.25)' }}
            >
              ⚠️ {dupeCount} possible duplicates
            </span>
          )}
        </div>
      </div>

      {/* Warnings */}
      {result.warnings.map((w, i) => (
        <div key={i} className="mx-5 mb-3 flex items-start gap-2 p-3 rounded-xl"
          style={{ background: 'rgba(240,165,0,0.08)', border: '1px solid rgba(240,165,0,0.2)' }}>
          <span className="text-base flex-shrink-0">⚠️</span>
          <p className="text-xs" style={{ color: '#F0A500' }}>{w}</p>
        </div>
      ))}

      {/* Totals bar */}
      <div className="px-5 mb-3">
        <div className="grid grid-cols-2 gap-2 p-3 rounded-xl" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <div className="text-center">
            <p className="text-[10px] mb-0.5" style={{ color: '#5A6A8A' }}>Selected Income</p>
            <p className="text-sm font-medium" style={{ color: '#06D6A0', fontFamily: 'JetBrains Mono' }}>
              {totalIncome > 0 ? fmt(totalIncome) : '—'}
            </p>
          </div>
          <div className="text-center" style={{ borderLeft: '1px solid #1E2D4F' }}>
            <p className="text-[10px] mb-0.5" style={{ color: '#5A6A8A' }}>Selected Expenses</p>
            <p className="text-sm font-medium" style={{ color: '#FF6B6B', fontFamily: 'JetBrains Mono' }}>
              {totalExpense > 0 ? fmt(totalExpense) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Select all toggle */}
      <div className="px-5 mb-2 flex items-center justify-between">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-xs tap-active"
          style={{ color: '#8899BB' }}
        >
          <div
            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
            style={{
              background: allSelected ? '#F0A500' : 'transparent',
              border: `1.5px solid ${allSelected ? '#F0A500' : '#2A3A5C'}`,
            }}
          >
            {allSelected && (
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="#080C18" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
        <p className="text-xs" style={{ color: '#5A6A8A' }}>Tap row to toggle · tap category to edit</p>
      </div>

      {/* Transaction list */}
      <div className="px-5 space-y-2 pb-36">
        {rows.map((row) => {
          const dupe = isDupe(row);
          const cat  = categories.find(c => c.id === row.category);

          return (
            <div
              key={row._idx}
              className="rounded-xl overflow-hidden tap-active"
              style={{
                border: `1px solid ${row._selected ? (dupe ? '#FF6B6B55' : '#1E2D4F') : '#0F1629'}`,
                opacity: row._selected ? 1 : 0.45,
                transition: 'all 0.15s ease',
              }}
              onClick={() => toggleRow(row._idx)}
            >
              <div className="flex items-center gap-3 px-3 py-3" style={{ background: '#0F1629' }}>
                {/* Checkbox */}
                <div
                  className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    background: row._selected ? '#F0A500' : 'transparent',
                    border: `1.5px solid ${row._selected ? '#F0A500' : '#2A3A5C'}`,
                  }}
                  onClick={(e) => { e.stopPropagation(); toggleRow(row._idx); }}
                >
                  {row._selected && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="#080C18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                {/* Category icon (tap to cycle) */}
                <button
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 tap-active"
                  style={{ background: '#151E35', border: `1px solid ${cat?.color || '#1E2D4F'}44` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Cycle through categories
                    const currentIdx = categories.findIndex(c => c.id === row.category);
                    const nextCat = categories[(currentIdx + 1) % categories.length];
                    setCategory(row._idx, nextCat.id);
                  }}
                  title="Tap to change category"
                >
                  {cat?.icon || '📦'}
                </button>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#E8EEFF' }}>
                    {row.merchant || 'Unknown'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Type toggle */}
                    <button
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium tap-active"
                      style={{
                        background: typeColor(row.type) + '22',
                        color: typeColor(row.type),
                        border: `1px solid ${typeColor(row.type)}44`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setType(row._idx, row.type === 'expense' ? 'income' : 'expense');
                      }}
                      title="Tap to toggle type"
                    >
                      {row.type}
                    </button>
                    <span className="text-[10px]" style={{ color: '#5A6A8A' }}>
                      {cat?.name || row.category}
                    </span>
                    {dupe && (
                      <span className="text-[10px]" style={{ color: '#FF6B6B' }}>⚠️ possible dupe</span>
                    )}
                  </div>
                </div>

                {/* Amount + date */}
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-medium" style={{
                    color: typeColor(row.type),
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {row.type === 'income' ? '+' : '−'}{fmt(row.amount)}
                  </p>
                  <p className="text-[10px]" style={{ color: '#5A6A8A' }}>{row.date}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky confirm bar */}
      <div
        className="fixed bottom-0 left-0 right-0 px-5 pb-8 pt-4 max-w-lg mx-auto"
        style={{
          background: 'linear-gradient(to top, #080C18 70%, transparent)',
          zIndex: 30,
        }}
      >
        <button
          onClick={() => onConfirm(selectedRows)}
          disabled={selectedRows.length === 0}
          className="w-full py-4 rounded-2xl font-semibold text-base tap-active"
          style={{
            background: selectedRows.length > 0
              ? 'linear-gradient(135deg, #F0A500, #FFD166)'
              : '#1E2D4F',
            color: selectedRows.length > 0 ? '#080C18' : '#5A6A8A',
            boxShadow: selectedRows.length > 0 ? '0 4px 20px rgba(240,165,0,0.35)' : 'none',
          }}
        >
          {selectedRows.length > 0
            ? `Import ${selectedRows.length} transaction${selectedRows.length !== 1 ? 's' : ''} →`
            : 'Select at least one transaction'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 4 — IMPORTING (progress)
// ─────────────────────────────────────────────────────────────────────────────

function ImportingStage({ progress, total }) {
  const pct = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-6">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="48" cy="48" r="40" fill="none" stroke="#1E2D4F" strokeWidth="6"/>
          <circle cx="48" cy="48" r="40" fill="none"
            stroke="#F0A500" strokeWidth="6"
            strokeDasharray={2 * Math.PI * 40}
            strokeDashoffset={2 * Math.PI * 40 * (1 - pct / 100)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold" style={{ color: '#F0A500', fontFamily: 'JetBrains Mono' }}>
            {pct}%
          </span>
        </div>
      </div>

      <div>
        <p className="font-semibold mb-1" style={{ color: '#E8EEFF' }}>Saving transactions…</p>
        <p className="text-sm" style={{ color: '#5A6A8A' }}>
          {progress} of {total} saved
        </p>
      </div>

      <p className="text-xs" style={{ color: '#2A3A5C' }}>
        All data stays on your device
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAGE 5 — DONE
// ─────────────────────────────────────────────────────────────────────────────

function DoneStage({ result, onImportAnother, onClose }) {
  return (
    <div className="flex flex-col items-center py-16 px-8 text-center gap-5">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
        style={{ background: 'rgba(6,214,160,0.12)', border: '1px solid rgba(6,214,160,0.3)' }}
      >
        ✅
      </div>

      <div>
        <h2 className="text-xl mb-1" style={{ fontFamily: 'DM Serif Display, serif' }}>
          Import complete!
        </h2>
        <p className="text-sm" style={{ color: '#8899BB' }}>
          Your transactions have been saved to Vault.
        </p>
      </div>

      {/* Stats */}
      <div
        className="w-full grid grid-cols-2 gap-3 p-4 rounded-2xl"
        style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}
      >
        <div className="text-center">
          <p className="text-3xl font-light mb-1" style={{ fontFamily: 'DM Serif Display, serif', color: '#06D6A0' }}>
            {result.saved}
          </p>
          <p className="text-xs" style={{ color: '#5A6A8A' }}>Transactions saved</p>
        </div>
        <div className="text-center" style={{ borderLeft: '1px solid #1E2D4F' }}>
          <p className="text-3xl font-light mb-1" style={{ fontFamily: 'DM Serif Display, serif', color: result.skipped > 0 ? '#F0A500' : '#5A6A8A' }}>
            {result.skipped}
          </p>
          <p className="text-xs" style={{ color: '#5A6A8A' }}>Skipped</p>
        </div>
      </div>

      {result.skipped > 0 && (
        <p className="text-xs" style={{ color: '#5A6A8A' }}>
          {result.skipped} transaction{result.skipped !== 1 ? 's' : ''} were skipped due to missing data.
        </p>
      )}

      <div className="flex flex-col gap-3 w-full mt-2">
        <button
          onClick={onImportAnother}
          className="w-full py-3.5 rounded-2xl font-medium text-sm tap-active"
          style={{ background: 'linear-gradient(135deg,#F0A500,#FFD166)', color: '#080C18' }}
        >
          Import Another File
        </button>
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl font-medium text-sm tap-active"
          style={{ background: '#151E35', border: '1px solid #1E2D4F', color: '#8899BB' }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  ERROR STAGE
// ─────────────────────────────────────────────────────────────────────────────

function ErrorStage({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center py-16 px-8 text-center gap-5">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
        style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)' }}
      >
        ⚠️
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2" style={{ color: '#E8EEFF' }}>Import Failed</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#8899BB' }}>{message}</p>
      </div>
      <div className="w-full space-y-3">
        <button
          onClick={onRetry}
          className="w-full py-3.5 rounded-2xl font-medium text-sm tap-active"
          style={{ background: 'linear-gradient(135deg,#F0A500,#FFD166)', color: '#080C18' }}
        >
          Try Another File
        </button>
        <div
          className="p-3 rounded-xl text-xs text-left space-y-1"
          style={{ background: '#0F1629', border: '1px solid #1E2D4F', color: '#5A6A8A' }}
        >
          <p className="font-medium" style={{ color: '#8899BB' }}>💡 Troubleshooting tips:</p>
          <p>• For PDFs, try downloading as CSV from your bank portal</p>
          <p>• For CSV files, ensure the first row has column headers</p>
          <p>• The file should contain Date, Amount, and Description columns</p>
          <p>• Scanned PDF images cannot be parsed — use CSV instead</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN COMPONENT — ORCHESTRATES ALL STAGES
// ─────────────────────────────────────────────────────────────────────────────

export default function ImportTransactions({ onClose }) {
  const { categories, transactions, refresh, showNotif, navigate } = useApp();

  const [stage, setStage]               = useState('idle');
  const [parseResult, setParseResult]   = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [errorMsg, setErrorMsg]         = useState('');
  const [progress, setProgress]         = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  // Store file metadata upfront so ParsingStage shows correct name/type immediately
  const [pendingFileName, setPendingFileName] = useState('');
  const [pendingFileType, setPendingFileType] = useState('file');

  // ── HANDLE FILE SELECTED ───────────────────────────────────
  const handleFile = useCallback(async (file) => {
    // Capture file info NOW, before the async parse, so the loading screen is informative
    setPendingFileName(file.name);
    setPendingFileType(detectFileType(file));
    setStage('parsing');

    try {
      const result = await importFile(file);
      setParseResult(result);
      setStage('preview');
    } catch (err) {
      setErrorMsg(err.message);
      setStage('error');
    }
  }, []);

  // ── HANDLE CONFIRM (user taps "Import N transactions") ─────
  const handleConfirm = useCallback(async (selectedTransactions) => {
    setProgressTotal(selectedTransactions.length);
    setProgress(0);
    setStage('importing');

    try {
      const result = await saveImportedTransactions(
        selectedTransactions,
        (current, total) => setProgress(current)
      );

      // Refresh the global transaction list so Dashboard + Analytics update
      await refresh();

      setImportResult(result);
      setStage('done');

      showNotif(`${result.saved} transactions imported ✓`);
    } catch (err) {
      setErrorMsg(err.message);
      setStage('error');
    }
  }, [refresh, showNotif]);

  const handleReset = () => {
    setStage('idle');
    setParseResult(null);
    setImportResult(null);
    setErrorMsg('');
    setProgress(0);
    setPendingFileName('');
    setPendingFileType('file');
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('settings');  // go back to where the user launched import from
    }
  };

  return (
    <div className="pb-24">
      {stage === 'idle'      && <UploadStage   onFile={handleFile} onBack={handleClose} />}
      {stage === 'parsing'   && <ParsingStage  fileName={pendingFileName || '…'} fileType={pendingFileType} />}
      {stage === 'preview'   && parseResult && (
        <PreviewStage
          result={parseResult}
          categories={categories}
          transactions={transactions}
          onConfirm={handleConfirm}
          onReset={handleReset}
        />
      )}
      {stage === 'importing' && <ImportingStage progress={progress} total={progressTotal} />}
      {stage === 'done'      && importResult && (
        <DoneStage
          result={importResult}
          onImportAnother={handleReset}
          onClose={handleClose}
        />
      )}
      {stage === 'error' && (
        <ErrorStage message={errorMsg} onRetry={handleReset} />
      )}
    </div>
  );
}
