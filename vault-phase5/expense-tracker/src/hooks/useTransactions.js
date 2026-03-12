/**
 * ============================================================
 *  VAULT — useTransactions HOOK  (src/hooks/useTransactions.js)
 * ============================================================
 *
 *  What is a React Hook?
 *  ----------------------
 *  A hook is a special function that lets a UI component
 *  "hook into" some shared logic or data. Instead of each
 *  screen managing the database by itself, they all call
 *  this one hook and get back the same data + functions.
 *
 *  What this hook provides:
 *  ------------------------
 *  transactions   — the live array of transactions from DB
 *  summary        — { income, expenses, savings, savingsRate }
 *  categories     — all available categories
 *  loading        — true while data is being fetched
 *  error          — any error message
 *
 *  addTxn(data)   — save a new transaction
 *  editTxn(data)  — update an existing transaction
 *  deleteTxn(id)  — delete a transaction
 *  refresh()      — re-fetch everything from DB
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getAllTransactions,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getMonthlySummary,
  getAllCategories,
  filterTransactions,
  searchTransactions,
} from '../services/transactionService.js';

export function useTransactions() {
  // ── State ────────────────────────────────────────────────
  const [transactions, setTransactions]   = useState([]);
  const [summary, setSummary]             = useState({ income: 0, expenses: 0, savings: 0, savingsRate: 0, byCategory: {} });
  const [categories, setCategories]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  // ── Load data from IndexedDB ─────────────────────────────
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [txns, cats] = await Promise.all([
        getAllTransactions(),
        getAllCategories(),
      ]);

      // Calculate current month summary
      const now = new Date();
      const monthSummary = await getMonthlySummary(now.getFullYear(), now.getMonth() + 1);

      setTransactions(txns);
      setCategories(cats);
      setSummary(monthSummary);
    } catch (err) {
      console.error('useTransactions: Failed to load', err);
      setError('Could not load transactions. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auto-load on first use ────────────────────────────────
  useEffect(() => {
    refresh();
  }, [refresh]);

  // ── Add a new transaction ─────────────────────────────────
  const addTxn = useCallback(async (data) => {
    const saved = await addTransaction(data);
    await refresh(); // re-fetch so UI updates immediately
    return saved;
  }, [refresh]);

  // ── Edit an existing transaction ──────────────────────────
  const editTxn = useCallback(async (data) => {
    const updated = await updateTransaction(data);
    await refresh();
    return updated;
  }, [refresh]);

  // ── Delete a transaction ──────────────────────────────────
  const deleteTxn = useCallback(async (id) => {
    await deleteTransaction(id);
    await refresh();
  }, [refresh]);

  return {
    transactions,
    summary,
    categories,
    loading,
    error,
    refresh,
    addTxn,
    editTxn,
    deleteTxn,
  };
}

// ─── Specialised hook for filtered/searched transactions ──────────────────────

export function useFilteredTransactions(filters) {
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const data = filters?.search
          ? await searchTransactions(filters.search)
          : await filterTransactions(filters || {});
        if (!cancelled) setResults(data);
      } catch (e) {
        console.error('useFilteredTransactions error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [JSON.stringify(filters)]); // re-run when filters change

  return { results, loading };
}
