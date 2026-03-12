/**
 * VAULT — BOTTOM NAV  (Phase 5 update)
 *
 * Layout: Home | History | [+FAB] | Scan | Analytics | Settings
 *
 * The gold FAB in the centre always opens the Add Transaction modal.
 * "Scan" tab navigates to the receipt scanning page.
 */

import React from 'react';
import { useApp } from '../context/AppContext';

const NAV_ITEMS_LEFT = [
  {
    id: 'dashboard',
    label: 'Home',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/>
        <path d="M9 21V12h6v9" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'transactions',
    label: 'History',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="18" rx="2" fill={active ? 'rgba(240,165,0,0.15)' : 'none'}/>
        <path d="M8 2v4M16 2v4M3 10h18" strokeLinecap="round"/>
        <path d="M8 14h4M8 18h8" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const NAV_ITEMS_RIGHT = [
  {
    id: 'receipt',
    label: 'Scan',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
          fill={active ? 'rgba(240,165,0,0.15)' : 'none'} strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="13" r="4" fill={active ? 'rgba(240,165,0,0.3)' : 'none'}/>
        <circle cx="12" cy="13" r="1.5" fill={active ? 'currentColor' : 'none'}/>
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 20h18" strokeLinecap="round"/>
        <rect x="5" y="12" width="3" height="8" rx="1" fill={active ? 'currentColor' : 'none'}/>
        <rect x="10.5" y="7" width="3" height="13" rx="1" fill={active ? 'currentColor' : 'none'}/>
        <rect x="16" y="4" width="3" height="16" rx="1" fill={active ? 'currentColor' : 'none'}/>
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (active) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="3" fill={active ? 'currentColor' : 'none'}/>
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" strokeLinecap="round"/>
      </svg>
    ),
  },
];

function NavButton({ item, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 py-1 tap-active"
      style={{ color: isActive ? '#F0A500' : '#5A6A8A', minWidth: '44px', flex: 1 }}
    >
      <div className="relative">
        {item.icon(isActive)}
        {isActive && (
          <span
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
            style={{ background: '#F0A500' }}
          />
        )}
      </div>
      <span className="text-[9px] font-medium leading-none" style={{ fontFamily: 'DM Sans, sans-serif' }}>
        {item.label}
      </span>
    </button>
  );
}

export default function BottomNav() {
  const { activePage, navigate, setShowAddModal } = useApp();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: 'rgba(8, 12, 24, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(30, 45, 79, 0.8)',
      }}
    >
      <div className="flex items-center justify-around px-1 pt-2 pb-1 max-w-lg mx-auto relative"
        style={{ gap: '2px' }}>

        {/* Left items */}
        {NAV_ITEMS_LEFT.map(item => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activePage === item.id}
            onClick={() => navigate(item.id)}
          />
        ))}

        {/* Centre FAB */}
        <button
          onClick={() => setShowAddModal(true)}
          className="relative -mt-7 flex items-center justify-center w-13 h-13 rounded-full tap-active flex-shrink-0"
          style={{
            width: '52px',
            height: '52px',
            background: 'linear-gradient(135deg, #F0A500, #FFD166)',
            boxShadow: '0 0 20px rgba(240, 165, 0, 0.5), 0 4px 12px rgba(0,0,0,0.4)',
          }}
          aria-label="Add transaction"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#080C18" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>

        {/* Right items */}
        {NAV_ITEMS_RIGHT.map(item => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activePage === item.id}
            onClick={() => navigate(item.id)}
          />
        ))}
      </div>
    </nav>
  );
}
