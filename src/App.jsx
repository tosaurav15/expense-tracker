import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import BottomNav from './components/BottomNav';
import AddTransactionModal from './components/AddTransactionModal';
import Toast from './components/Toast';
import ImportTransactions from './components/ImportTransactions';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

function PageRouter() {
  const { activePage, navigate } = useApp();

  // The import page is a full-screen overlay — it hides the bottom nav
  if (activePage === 'import') {
    return (
      <main className="flex-1 overflow-y-auto" style={{ background: '#080C18', minHeight: '100dvh' }}>
        <ImportTransactions onClose={() => navigate('settings')} />
      </main>
    );
  }

  const pages = { dashboard: Dashboard, transactions: Transactions, analytics: Analytics, settings: Settings };
  const Page  = pages[activePage] || Dashboard;
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: '#080C18', minHeight: '100dvh' }}>
      <Page key={activePage} />
    </main>
  );
}

function AppShell() {
  const { activePage } = useApp();
  return (
    <div className="flex flex-col" style={{ background: '#080C18', maxWidth: '480px', margin: '0 auto', minHeight: '100dvh' }}>
      <Toast />
      <PageRouter />
      {/* Hide bottom nav on full-screen import page */}
      {activePage !== 'import' && <BottomNav />}
      <AddTransactionModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
