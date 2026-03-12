/**
 * VAULT — TRANSACTIONS PAGE
 *
 * Displays ALL real transactions from IndexedDB.
 * Supports: search, filter by type/category, edit, delete, swipe actions.
 *
 * When there are no transactions yet, shows an empty state with guidance.
 */

import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';

const fmt = (n) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

// Format date string to human-readable
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

// Category emoji lookup
function getCatIcon(catId, categories) {
  return categories.find(c => c.id === catId)?.icon || '📦';
}

const TYPE_FILTERS = ['All', 'Expense', 'Income', 'Transfer'];

// ── Swipeable row (edit on left, delete on right) ─────────────────────────────
function TxnRow({ txn, categories, onEdit, onDelete, isLast }) {
  const [offsetX, setOffsetX]   = useState(0);
  const [swiping, setSwiping]   = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const startX = useRef(null);

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    setSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    // Limit swipe: left max -80px (reveal delete), right max +80px (reveal edit)
    setOffsetX(Math.max(-80, Math.min(80, dx)));
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (offsetX < -60) {
      setOffsetX(-80); // snap to delete reveal
    } else if (offsetX > 60) {
      setOffsetX(80);  // snap to edit reveal
    } else {
      setOffsetX(0);   // snap back to centre
    }
    startX.current = null;
  };

  const resetSwipe = () => setOffsetX(0);

  const handleDelete = () => {
    if (showConfirm) {
      onDelete(txn.id);
    } else {
      setShowConfirm(true);
      setTimeout(() => setShowConfirm(false), 2000);
    }
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderTop: !isLast ? '1px solid #1E2D4F' : 'none' }}
    >
      {/* Edit action (revealed by swiping right) */}
      <div
        className="absolute inset-y-0 left-0 flex items-center justify-center w-20"
        style={{ background: 'rgba(76,201,240,0.15)' }}
      >
        <button onClick={() => { resetSwipe(); onEdit(txn); }} className="flex flex-col items-center gap-1 tap-active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4CC9F0" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round"/></svg>
          <span className="text-[9px]" style={{ color: '#4CC9F0' }}>Edit</span>
        </button>
      </div>

      {/* Delete action (revealed by swiping left) */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center w-20"
        style={{ background: showConfirm ? 'rgba(255,107,107,0.3)' : 'rgba(255,107,107,0.15)' }}
      >
        <button onClick={handleDelete} className="flex flex-col items-center gap-1 tap-active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round"/><path d="M10 11v6M14 11v6" strokeLinecap="round"/></svg>
          <span className="text-[9px]" style={{ color: '#FF6B6B' }}>{showConfirm ? 'Sure?' : 'Delete'}</span>
        </button>
      </div>

      {/* Main row */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 tap-active"
        style={{
          background: '#0F1629',
          transform: `translateX(${offsetX}px)`,
          transition: swiping ? 'none' : 'transform 0.25s ease',
          userSelect: 'none',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => offsetX === 0 && onEdit(txn)}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: '#151E35' }}>
          {getCatIcon(txn.category, categories)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#E8EEFF' }}>
            {txn.merchant || txn.category || 'Transaction'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs" style={{ color: '#5A6A8A' }}>{txn.category}</span>
            {txn.paymentMethod && (
              <>
                <span style={{ color: '#2A3A5C' }}>·</span>
                <span className="text-xs" style={{ color: '#5A6A8A' }}>{txn.paymentMethod}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-medium text-sm" style={{
            color: txn.type === 'income' ? '#06D6A0' : txn.type === 'transfer' ? '#4CC9F0' : '#FF6B6B',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {txn.type === 'income' ? '+' : '−'}{fmt(txn.amount)}
          </span>
          {txn.notes && (
            <span className="text-[10px] truncate max-w-[80px]" style={{ color: '#5A6A8A' }}>{txn.notes}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center py-20 px-8 text-center gap-4">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
        style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}
      >
        📋
      </div>
      <div>
        <p className="font-semibold mb-1" style={{ color: '#E8EEFF' }}>No transactions yet</p>
        <p className="text-sm" style={{ color: '#5A6A8A' }}>
          Tap the gold <strong style={{ color: '#F0A500' }}>+</strong> button at the bottom to add your first transaction.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="mt-2 px-6 py-3 rounded-2xl font-medium text-sm tap-active"
        style={{ background: 'linear-gradient(135deg,#F0A500,#FFD166)', color: '#080C18' }}
      >
        + Add First Transaction
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Transactions() {
  const { transactions, categories, loading, deleteTxn, openAddModal, showNotif } = useApp();

  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('All');
  const [catFilter, setCatFilter]     = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters
  const filtered = transactions.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      (t.merchant || '').toLowerCase().includes(q) ||
      (t.notes || '').toLowerCase().includes(q) ||
      (t.category || '').toLowerCase().includes(q);
    const matchType = typeFilter === 'All' || t.type === typeFilter.toLowerCase();
    const matchCat  = !catFilter || t.category === catFilter;
    return matchSearch && matchType && matchCat;
  });

  // Group by formatted date
  const grouped = filtered.reduce((acc, t) => {
    const label = formatDate(t.date);
    if (!acc[label]) acc[label] = [];
    acc[label].push(t);
    return acc;
  }, {});

  const totalIn  = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  const handleDelete = async (id) => {
    try {
      await deleteTxn(id);
      showNotif('Transaction deleted');
    } catch {
      showNotif('Could not delete', 'error');
    }
  };

  return (
    <div className="page-enter pb-24">
      {/* Header */}
      <div className="px-5 pt-14 pb-4" style={{ background: '#080C18' }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl" style={{ fontFamily: 'DM Serif Display, serif' }}>Transactions</h1>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-1 rounded-lg"
              style={{ background: '#0F1629', color: '#5A6A8A', border: '1px solid #1E2D4F', fontFamily: 'JetBrains Mono' }}
            >
              {filtered.length} entries
            </span>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl tap-active text-xs"
              style={{
                background: showFilters ? 'rgba(240,165,0,0.15)' : '#151E35',
                border: `1px solid ${showFilters ? 'rgba(240,165,0,0.4)' : '#1E2D4F'}`,
                color: showFilters ? '#F0A500' : '#8899BB',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Filter
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5A6A8A" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/>
          </svg>
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search merchant, category, notes..."
            className="flex-1 text-sm bg-transparent outline-none" style={{ color: '#E8EEFF' }}
          />
          {search && (
            <button onClick={() => setSearch('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A6A8A" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>

        {/* Type pills */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 no-scrollbar">
          {TYPE_FILTERS.map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-medium tap-active"
              style={{
                background: typeFilter === f ? '#F0A500' : '#151E35',
                color: typeFilter === f ? '#080C18' : '#8899BB',
                border: `1px solid ${typeFilter === f ? '#F0A500' : '#1E2D4F'}`,
              }}
            >{f}</button>
          ))}
        </div>

        {/* Category filter panel */}
        {showFilters && (
          <div className="mt-3 p-4 rounded-2xl space-y-3" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
            <p className="text-xs font-medium" style={{ color: '#8899BB' }}>By Category</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCatFilter('')}
                className="px-3 py-1.5 rounded-full text-xs tap-active"
                style={{
                  background: !catFilter ? 'rgba(240,165,0,0.15)' : '#151E35',
                  color: !catFilter ? '#F0A500' : '#8899BB',
                  border: `1px solid ${!catFilter ? 'rgba(240,165,0,0.4)' : '#1E2D4F'}`,
                }}
              >All</button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setCatFilter(cat.id === catFilter ? '' : cat.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs tap-active"
                  style={{
                    background: catFilter === cat.id ? cat.color + '22' : '#151E35',
                    color: catFilter === cat.id ? cat.color : '#8899BB',
                    border: `1px solid ${catFilter === cat.id ? cat.color : '#1E2D4F'}`,
                  }}
                >{cat.icon} {cat.name}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div className="px-5 mb-4">
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
            <div className="text-center">
              <p className="text-[10px] mb-1" style={{ color: '#5A6A8A' }}>Total In</p>
              <p className="text-sm font-medium" style={{ color: '#06D6A0', fontFamily: 'JetBrains Mono' }}>
                {totalIn > 0 ? fmt(totalIn) : '—'}
              </p>
            </div>
            <div className="text-center" style={{ borderLeft: '1px solid #1E2D4F', borderRight: '1px solid #1E2D4F' }}>
              <p className="text-[10px] mb-1" style={{ color: '#5A6A8A' }}>Total Out</p>
              <p className="text-sm font-medium" style={{ color: '#FF6B6B', fontFamily: 'JetBrains Mono' }}>
                {totalOut > 0 ? fmt(totalOut) : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] mb-1" style={{ color: '#5A6A8A' }}>Net</p>
              <p className="text-sm font-medium" style={{
                color: (totalIn - totalOut) >= 0 ? '#06D6A0' : '#FF6B6B',
                fontFamily: 'JetBrains Mono',
              }}>
                {fmt(Math.abs(totalIn - totalOut))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#1E2D4F', borderTopColor: '#F0A500' }} />
          <p className="text-sm" style={{ color: '#5A6A8A' }}>Loading transactions...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && transactions.length === 0 && (
        <EmptyState onAdd={() => openAddModal()} />
      )}

      {/* No search results */}
      {!loading && transactions.length > 0 && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3">
          <span className="text-4xl">🔍</span>
          <p style={{ color: '#5A6A8A' }}>No transactions match your filter</p>
          <button onClick={() => { setSearch(''); setTypeFilter('All'); setCatFilter(''); }}
            className="text-sm tap-active" style={{ color: '#F0A500' }}>Clear filters</button>
        </div>
      )}

      {/* Grouped transaction list */}
      {!loading && (
        <div className="px-5 space-y-4">
          {Object.entries(grouped).map(([date, txns]) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wider" style={{ color: '#5A6A8A', letterSpacing: '0.1em' }}>
                  {date}
                </p>
                <p className="text-xs" style={{ color: '#5A6A8A', fontFamily: 'JetBrains Mono' }}>
                  {txns.filter(t => t.type === 'expense').length > 0 &&
                    `−${fmt(txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0))}`}
                </p>
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1E2D4F' }}>
                {txns.map((txn, i) => (
                  <TxnRow
                    key={txn.id}
                    txn={txn}
                    categories={categories}
                    onEdit={openAddModal}
                    onDelete={handleDelete}
                    isLast={i === txns.length - 1}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Swipe hint — only show if there are transactions */}
      {!loading && transactions.length > 0 && (
        <p className="text-center text-xs mt-6 mb-2" style={{ color: '#2A3A5C' }}>
          ← Swipe transactions to edit or delete →
        </p>
      )}
    </div>
  );
}
