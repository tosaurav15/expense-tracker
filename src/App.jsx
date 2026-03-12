import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import BottomNav from './components/BottomNav';
import AddTransactionModal from './components/AddTransactionModal';
import Toast from './components/Toast';
import ImportTransactions from './components/ImportTransactions';
import AppLockScreen from './components/AppLockScreen';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import ReceiptPage from './pages/ReceiptPage';
import { isPinEnabled } from './services/securityService';

function PageRouter() {
  const { activePage, navigate } = useApp();

  if (activePage === 'import') {
    return (
      <main className="flex-1 overflow-y-auto" style={{ background: '#080C18', minHeight: '100dvh' }}>
        <ImportTransactions onClose={() => navigate('settings')} />
      </main>
    );
  }

  const pages = {
    dashboard:    Dashboard,
    transactions: Transactions,
    analytics:    Analytics,
    settings:     Settings,
    receipt:      ReceiptPage,
  };
  const Page = pages[activePage] || Dashboard;
  return (
    <main className="flex-1 overflow-y-auto" style={{ background: '#080C18', minHeight: '100dvh' }}>
      <Page key={activePage} />
    </main>
  );
}

function AppShell() {
  const { activePage, isUnlocked, unlock } = useApp();
  const [pinEnabled, setPinEnabled]        = useState(null); // null = still checking
  const hideNav = activePage === 'import';

  // Check on mount whether PIN lock is enabled
  useEffect(() => {
    isPinEnabled().then(enabled => setPinEnabled(enabled));
  }, []);

  // Show nothing while we check (avoids flash of content)
  if (pinEnabled === null) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ background: '#080C18', minHeight: '100dvh', maxWidth: '480px', margin: '0 auto' }}
      >
        <div
          className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: '#1E2D4F', borderTopColor: '#F0A500' }}
        />
      </div>
    );
  }

  // Show lock screen if PIN is set and app hasn't been unlocked this session
  if (pinEnabled && !isUnlocked) {
    return <AppLockScreen onUnlock={unlock} />;
  }

  return (
    <div className="flex flex-col" style={{ background: '#080C18', maxWidth: '480px', margin: '0 auto', minHeight: '100dvh' }}>
      <Toast />
      <PageRouter />
      {!hideNav && <BottomNav />}
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
