import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

function ToggleSwitch({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="relative w-12 h-6 rounded-full transition-all tap-active flex-shrink-0"
      style={{
        background: value ? '#F0A500' : '#1E2D4F',
        boxShadow: value ? '0 0 12px rgba(240,165,0,0.4)' : 'none',
      }}
    >
      <div
        className="absolute top-1 w-4 h-4 rounded-full transition-all"
        style={{
          background: value ? '#080C18' : '#5A6A8A',
          left: value ? '26px' : '4px',
        }}
      />
    </button>
  );
}

function SettingsRow({ icon, title, subtitle, right, onPress }) {
  return (
    <button
      className="w-full flex items-center gap-3 px-4 py-4 tap-active text-left"
      onClick={onPress}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
        style={{ background: '#1E2D4F' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: '#E8EEFF' }}>{title}</p>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#5A6A8A' }}>{subtitle}</p>}
      </div>
      {right || (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2A3A5C" strokeWidth="2">
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-xs uppercase tracking-wider px-1 mb-2" style={{ color: '#5A6A8A', letterSpacing: '0.12em' }}>
        {title}
      </p>
      <div className="rounded-2xl overflow-hidden divide-y" style={{ background: '#0F1629', border: '1px solid #1E2D4F', divideColor: '#1E2D4F' }}>
        {children}
      </div>
    </div>
  );
}

export default function Settings() {
  const { navigate, transactions, refresh } = useApp();
  const [appLock, setAppLock] = useState(false);
  const [biometric, setBiometric] = useState(false);
  const [encrypt, setEncrypt] = useState(true);
  const [darkMode, setDarkMode] = useState(true);
  const [currency, setCurrency] = useState('INR (₹)');

  return (
    <div className="page-enter pb-24">
      <div className="px-5 pt-14 pb-5" style={{ background: '#080C18' }}>
        <h1 className="text-2xl mb-1" style={{ fontFamily: 'DM Serif Display, serif' }}>Settings</h1>
        <p className="text-sm" style={{ color: '#5A6A8A' }}>Vault · Phase 4 · {transactions.length} transactions stored</p>
      </div>

      <div className="px-5">
        {/* Privacy Dashboard */}
        <div
          className="rounded-2xl p-4 mb-5"
          style={{
            background: 'linear-gradient(135deg, rgba(6,214,160,0.08), rgba(76,201,240,0.05))',
            border: '1px solid rgba(6,214,160,0.2)',
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span>🔒</span>
            <span className="font-semibold text-sm" style={{ color: '#06D6A0' }}>Privacy Dashboard</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Internet Access', value: 'OFF', ok: true },
              { label: 'Tracking Scripts', value: 'NONE', ok: true },
              { label: 'Advertisements', value: 'NONE', ok: true },
              { label: 'Data Storage', value: 'Local Only', ok: true },
            ].map(item => (
              <div
                key={item.label}
                className="p-2.5 rounded-xl"
                style={{ background: 'rgba(6,214,160,0.06)' }}
              >
                <p className="text-[10px] mb-1" style={{ color: '#5A6A8A' }}>{item.label}</p>
                <p className="text-xs font-semibold" style={{ color: '#06D6A0' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <Section title="Security">
          <SettingsRow
            icon="🔐"
            title="App Lock (PIN)"
            subtitle="Require PIN to open Vault"
            right={<ToggleSwitch value={appLock} onChange={setAppLock} />}
          />
          <SettingsRow
            icon="👆"
            title="Biometric Unlock"
            subtitle="Use fingerprint or Face ID"
            right={<ToggleSwitch value={biometric} onChange={setBiometric} />}
          />
          <SettingsRow
            icon="🛡️"
            title="AES-256 Encryption"
            subtitle="Data encrypted at rest"
            right={<ToggleSwitch value={encrypt} onChange={setEncrypt} />}
          />
          <SettingsRow
            icon="🔑"
            title="Change PIN"
            subtitle="Update your security PIN"
          />
        </Section>

        <Section title="Data & Backup">
          <SettingsRow icon="💾" title="Export Encrypted Backup" subtitle="Save .vault backup file" />
          <SettingsRow icon="📂" title="Restore from Backup" subtitle="Import a .vault file" />
          <SettingsRow icon="📊" title="Export to CSV" subtitle="Download transaction history" />
          <SettingsRow icon="📋" title="Export to Excel" subtitle="Download .xlsx spreadsheet" />
        </Section>

        <Section title="Import">
          <SettingsRow
            icon="🏦"
            title="Import Bank Statement"
            subtitle="PDF, CSV, or Excel — parsed on-device"
            onPress={() => navigate('import')}
          />
          <SettingsRow
            icon="📷"
            title="Scan Receipt"
            subtitle="OCR from camera or photo · Coming soon"
          />
        </Section>

        <Section title="Preferences">
          <SettingsRow icon="💱" title="Currency" subtitle={currency} />
          <SettingsRow
            icon="🌙"
            title="Dark Mode"
            subtitle="Always on (premium look)"
            right={<ToggleSwitch value={darkMode} onChange={setDarkMode} />}
          />
          <SettingsRow icon="🏷️" title="Manage Categories" subtitle="Add, rename, merge categories" />
          <SettingsRow icon="🔔" title="Recurring Alerts" subtitle="Notify before recurring bills" />
        </Section>

        <Section title="About">
          <SettingsRow icon="ℹ️" title="About Vault" subtitle="Version 1.0 · Phase 1 Alpha" />
          <SettingsRow icon="🗑️" title="Clear All Data" subtitle="Wipe everything from device" />
        </Section>

        {/* Danger zone */}
        <div className="mb-8">
          <button
            className="w-full py-4 rounded-2xl text-sm font-medium tap-active"
            style={{
              background: 'rgba(255, 107, 107, 0.1)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              color: '#FF6B6B',
            }}
          >
            🗑️ Erase All Data Permanently
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: '#5A6A8A' }}>
            This cannot be undone. Your data stays only on your device.
          </p>
        </div>
      </div>
    </div>
  );
}
