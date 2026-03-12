import React, { createContext, useContext, useState, useCallback } from 'react';
import { useTransactions } from '../hooks/useTransactions';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [activePage, setActivePage]       = useState('dashboard');
  const [showAddModal, setShowAddModal]   = useState(false);
  const [editTarget, setEditTarget]       = useState(null);
  const [notification, setNotification]  = useState(null);
  // ── Security: tracks whether the user has passed the PIN lock screen ──
  const [isUnlocked, setIsUnlocked]       = useState(false);

  const db = useTransactions();

  const navigate   = useCallback((page) => setActivePage(page), []);
  const unlock     = useCallback(() => setIsUnlocked(true), []);

  const showNotif = useCallback((msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const openAddModal = useCallback((txn = null) => {
    setEditTarget(txn);
    setShowAddModal(true);
  }, []);

  const closeAddModal = useCallback(() => {
    setShowAddModal(false);
    setEditTarget(null);
  }, []);

  return (
    <AppContext.Provider value={{
      activePage, navigate,
      showAddModal, openAddModal, closeAddModal, setShowAddModal,
      editTarget,
      notification, showNotif,
      isUnlocked, unlock,
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
