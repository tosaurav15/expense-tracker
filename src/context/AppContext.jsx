/**
 * ============================================================
 *  VAULT — APP CONTEXT  (src/context/AppContext.jsx)
 * ============================================================
 *
 *  The AppContext is the "brain" of the app.
 *  It holds global state that ANY screen can read or update:
 *
 *  • Which page is visible (activePage)
 *  • Whether the Add Transaction modal is open
 *  • Toast notifications
 *  • The shared database hook (transactions, summary, etc.)
 *
 *  Any component can call useApp() to access all of this.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useTransactions } from '../hooks/useTransactions';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [activePage, setActivePage]       = useState('dashboard');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [editTarget, setEditTarget]       = useState(null); // transaction being edited
  const [notification, setNotification]  = useState(null);

  // ── Database layer — shared across the entire app ────────
  const db = useTransactions();

  // ── Navigation ───────────────────────────────────────────
  const navigate = useCallback((page) => setActivePage(page), []);

  // ── Notifications (toast messages) ───────────────────────
  const showNotif = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // ── Open add modal (optionally pre-filled for editing) ───
  const openAddModal = useCallback((txn = null) => {
    setEditTarget(txn);   // null = new transaction, object = edit existing
    setShowAddModal(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    setEditTarget(null);
  }, []);

  return (
    <AppContext.Provider value={{
      // Navigation
      activePage, navigate,
      // Modal
      showAddModal, openAddModal, closeAddModal,
      setShowAddModal,
      editTarget,
      // Notifications
      notification, showNotif,
      // Database (transactions, summary, categories, loading, addTxn, editTxn, deleteTxn, refresh)
      ...db,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};
