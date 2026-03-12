/**
 * VAULT — RECEIPT PAGE  (src/pages/ReceiptPage.jsx)
 *
 * This is the full-page wrapper for the receipt scanning feature.
 * It simply renders the ImportReceipt component.
 *
 * Keeping a separate page file follows the same pattern as
 * Dashboard, Transactions, Analytics, Settings — one file per route.
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import ImportReceipt from '../components/ImportReceipt';

export default function ReceiptPage() {
  const { navigate } = useApp();
  return (
    <div style={{ background: '#080C18', minHeight: '100dvh' }}>
      <ImportReceipt onClose={() => navigate('dashboard')} />
    </div>
  );
}
