/**
 * VAULT — SETTINGS PAGE  (Phase 6 update)
 * Live security controls, backup/export, merchant intelligence stats.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import SetPinModal from '../components/SetPinModal';
import { isPinEnabled, clearPin } from '../services/securityService';
import { exportToCSV, exportToExcel, exportEncryptedBackup, importVaultBackup, getBackupStats } from '../services/backupService';
import { getLearningStats } from '../services/merchantLearningService';
import { generateBackupKey } from '../services/encryptionService';

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────────────

function ToggleSwitch({ value, onChange, disabled }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      className="relative w-12 h-6 rounded-full transition-all tap-active flex-shrink-0"
      style={{
        background: value ? '#F0A500' : '#1E2D4F',
        boxShadow:  value ? '0 0 12px rgba(240,165,0,0.4)' : 'none',
        opacity:    disabled ? 0.4 : 1,
      }}
    >
      <div className="absolute top-1 w-4 h-4 rounded-full transition-all"
        style={{ background: value ? '#080C18' : '#5A6A8A', left: value ? '26px' : '4px' }}
      />
    </button>
  );
}

function SettingsRow({ icon, title, subtitle, right, onPress, danger }) {
  return (
    <button
      className="w-full flex items-center gap-3 px-4 py-4 tap-active text-left"
      onClick={onPress}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
        style={{ background: danger ? 'rgba(255,107,107,0.12)' : '#1E2D4F' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: danger ? '#FF6B6B' : '#E8EEFF' }}>{title}</p>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: '#5A6A8A' }}>{subtitle}</p>}
      </div>
      {right !== undefined ? right : (
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
      <p className="text-xs uppercase tracking-wider px-1 mb-2"
        style={{ color: '#5A6A8A', letterSpacing: '0.12em' }}>
        {title}
      </p>
      <div className="rounded-2xl overflow-hidden"
        style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
        {React.Children.map(children, (child, i) => (
          child ? (
            <div style={{ borderTop: i > 0 ? '1px solid #131D35' : 'none' }}>
              {child}
            </div>
          ) : null
        ))}
      </div>
    </div>
  );
}

// ─── BACKUP PASSWORD MODAL ───────────────────────────────────────────────────

function BackupPasswordModal({ action, onConfirm, onClose }) {
  const [password, setPassword] = useState('');
  const [generated, setGenerated] = useState(false);
  const [visible, setVisible]   = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300); };

  const genKey = () => {
    setPassword(generateBackupKey());
    setGenerated(true);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center"
      style={{ background: 'rgba(4,6,14,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && handleClose()}>
      <div className="w-full max-w-lg rounded-t-3xl pb-8 px-6"
        style={{
          background: '#0F1629', border: '1px solid rgba(30,45,79,0.9)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
        }}>
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2A3A5C' }} />
        </div>
        <h2 className="text-base font-semibold mb-1" style={{ color: '#E8EEFF' }}>
          {action === 'export' ? 'Set Backup Password' : 'Enter Backup Password'}
        </h2>
        <p className="text-xs mb-4" style={{ color: '#5A6A8A' }}>
          {action === 'export'
            ? 'You\'ll need this password to restore the backup. Store it safely.'
            : 'Enter the password used when this backup was created.'}
        </p>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={action === 'export' ? 'Min. 4 characters' : 'Backup password'}
          className="w-full px-4 py-3.5 rounded-xl text-sm outline-none mb-3"
          style={{ background: '#151E35', border: '1px solid #1E2D4F', color: '#E8EEFF' }}
          autoFocus
        />
        {action === 'export' && (
          <button onClick={genKey}
            className="w-full py-2.5 rounded-xl text-xs mb-4 tap-active"
            style={{ background: '#151E35', border: '1px solid #1E2D4F', color: generated ? '#06D6A0' : '#8899BB' }}>
            {generated ? `✓ Key generated: ${password}` : '🎲 Generate a strong key for me'}
          </button>
        )}
        {generated && (
          <div className="p-3 rounded-xl mb-4"
            style={{ background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.2)' }}>
            <p className="text-xs" style={{ color: '#FF6B6B' }}>
              ⚠️ Save this key somewhere safe. Without it, you cannot restore your backup.
            </p>
          </div>
        )}
        <button
          onClick={() => password.length >= 4 && onConfirm(password)}
          disabled={password.length < 4}
          className="w-full py-3.5 rounded-2xl font-medium text-sm tap-active"
          style={{
            background: password.length >= 4 ? 'linear-gradient(135deg,#F0A500,#FFD166)' : '#1E2D4F',
            color: password.length >= 4 ? '#080C18' : '#5A6A8A',
          }}>
          {action === 'export' ? 'Encrypt & Export' : 'Decrypt & Restore'}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN SETTINGS PAGE ──────────────────────────────────────────────────────

export default function Settings() {
  const { navigate, transactions, categories, refresh, showNotif } = useApp();

  // Security state
  const [pinEnabled, setPinEnabled]   = useState(false);
  const [pinModal, setPinModal]       = useState(null); // 'set' | 'change' | 'disable' | null

  // Backup state
  const [backupAction, setBackupAction] = useState(null); // 'export' | 'restore' | null
  const [restoring, setRestoring]       = useState(false);
  const restoreInputRef = useRef(null);

  // Intelligence stats
  const [learnStats, setLearnStats]   = useState(null);

  // Load PIN status on mount
  useEffect(() => {
    isPinEnabled().then(setPinEnabled);
    getLearningStats().then(setLearnStats);
  }, []);

  // ── Security handlers ───────────────────────────────────
  const handlePinToggle = () => {
    if (pinEnabled) {
      setPinModal('disable');
    } else {
      setPinModal('set');
    }
  };

  const handlePinSuccess = (msg) => {
    showNotif(msg);
    isPinEnabled().then(setPinEnabled);
    setPinModal(null);
  };

  // ── Backup / export handlers ────────────────────────────
  const handleExportCSV = () => {
    try {
      exportToCSV(transactions);
      showNotif('CSV exported ✓');
    } catch (err) {
      showNotif(err.message, 'error');
    }
  };

  const handleExportExcel = async () => {
    try {
      await exportToExcel(transactions, categories);
      showNotif('Excel file exported ✓');
    } catch (err) {
      showNotif(err.message, 'error');
    }
  };

  const handleExportVault = async (password) => {
    try {
      await exportEncryptedBackup(transactions, categories, password);
      setBackupAction(null);
      showNotif('Encrypted backup exported ✓');
    } catch (err) {
      showNotif(err.message, 'error');
    }
  };

  const handleRestoreFile = async (file) => {
    setBackupAction('restore');
  };

  const handleRestoreVault = async (password) => {
    const file = restoreInputRef.current?.files?.[0];
    if (!file) { showNotif('Please select a backup file first', 'error'); return; }

    setRestoring(true);
    try {
      const data = await importVaultBackup(file, password);
      // Save all restored transactions to the database
      const { addTransaction } = await import('../services/transactionService.js');
      for (const txn of data.transactions) {
        try { await addTransaction({ ...txn, id: undefined }); } catch { /* skip duplicates */ }
      }
      await refresh();
      setBackupAction(null);
      showNotif(`Restored ${data.transactionCount} transactions ✓`);
    } catch (err) {
      showNotif(err.message, 'error');
    } finally {
      setRestoring(false);
    }
  };

  // ── Clear all data ───────────────────────────────────────
  const handleClearData = async () => {
    if (!window.confirm('Permanently erase ALL Vault data? This cannot be undone.')) return;
    try {
      const { dbGetAll, dbDelete } = await import('../services/database.js');
      const txns = await dbGetAll('transactions');
      for (const t of txns) await dbDelete('transactions', t.id);
      await clearPin();
      await refresh();
      showNotif('All data erased');
    } catch (err) {
      showNotif('Could not erase data: ' + err.message, 'error');
    }
  };

  const stats = getBackupStats(transactions);

  return (
    <div className="page-enter pb-28">
      <div className="px-5 pt-14 pb-5">
        <h1 className="text-2xl mb-1" style={{ fontFamily: 'DM Serif Display, serif' }}>Settings</h1>
        <p className="text-sm" style={{ color: '#5A6A8A' }}>
          Vault · Phase 6 · {transactions.length} transactions stored
        </p>
      </div>

      <div className="px-5">

        {/* Privacy Dashboard */}
        <div className="rounded-2xl p-4 mb-5"
          style={{
            background: 'linear-gradient(135deg, rgba(6,214,160,0.08), rgba(76,201,240,0.05))',
            border: '1px solid rgba(6,214,160,0.2)',
          }}>
          <div className="flex items-center gap-2 mb-3">
            <span>🔒</span>
            <span className="font-semibold text-sm" style={{ color: '#06D6A0' }}>Privacy Dashboard</span>
            {pinEnabled && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: 'rgba(240,165,0,0.15)', color: '#F0A500', border: '1px solid rgba(240,165,0,0.3)' }}>
                🔐 PIN ACTIVE
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Internet Access',  value: 'OFF',        ok: true },
              { label: 'Tracking Scripts', value: 'NONE',       ok: true },
              { label: 'Advertisements',   value: 'NONE',       ok: true },
              { label: 'App Lock',         value: pinEnabled ? 'ENABLED' : 'OFF', ok: pinEnabled },
            ].map(item => (
              <div key={item.label} className="p-2.5 rounded-xl"
                style={{ background: item.ok ? 'rgba(6,214,160,0.06)' : 'rgba(255,107,107,0.06)' }}>
                <p className="text-[10px] mb-1" style={{ color: '#5A6A8A' }}>{item.label}</p>
                <p className="text-xs font-semibold"
                  style={{ color: item.ok ? '#06D6A0' : '#FF6B6B' }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <Section title="Security">
          <SettingsRow
            icon="🔐"
            title="App Lock (PIN)"
            subtitle={pinEnabled ? 'Tap to disable · PIN required on open' : 'Require PIN to open Vault'}
            right={<ToggleSwitch value={pinEnabled} onChange={handlePinToggle} />}
          />
          {pinEnabled && (
            <SettingsRow
              icon="🔑"
              title="Change PIN"
              subtitle="Update your security PIN"
              onPress={() => setPinModal('change')}
            />
          )}
          <SettingsRow
            icon="🛡️"
            title="AES-256 Encryption"
            subtitle="Used for encrypted backups · Web Crypto API"
            right={<span className="text-xs px-2 py-1 rounded-lg"
              style={{ background: 'rgba(6,214,160,0.12)', color: '#06D6A0' }}>ON</span>}
          />
        </Section>

        {/* Merchant Intelligence */}
        {learnStats && (
          <Section title="Smart Learning">
            <div className="px-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Merchants Learned', value: learnStats.totalMerchants, color: '#F0A500' },
                  { label: 'User-Taught',        value: learnStats.userTaught,    color: '#06D6A0' },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl"
                    style={{ background: '#151E35', border: '1px solid #1E2D4F' }}>
                    <p className="text-xl font-light mb-0.5"
                      style={{ color: s.color, fontFamily: 'DM Serif Display, serif' }}>
                      {s.value}
                    </p>
                    <p className="text-xs" style={{ color: '#5A6A8A' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {learnStats.topCategories?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {learnStats.topCategories.map(c => (
                    <span key={c.category}
                      className="px-2 py-0.5 rounded-full text-[10px]"
                      style={{ background: '#151E35', color: '#8899BB', border: '1px solid #1E2D4F' }}>
                      {c.category} · {c.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Data & Backup */}
        <Section title="Data & Backup">
          {/* Backup stats */}
          {transactions.length > 0 && (
            <div className="px-4 pt-4 pb-2">
              <div className="p-3 rounded-xl"
                style={{ background: '#151E35', border: '1px solid #1E2D4F' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#8899BB' }}>
                  {stats.transactionCount} transactions · {stats.dateRange}
                </p>
                <div className="flex gap-4">
                  <span className="text-xs" style={{ color: '#FF6B6B' }}>
                    ↓ ₹{stats.totalExpenses.toLocaleString('en-IN')} spent
                  </span>
                  <span className="text-xs" style={{ color: '#06D6A0' }}>
                    ↑ ₹{stats.totalIncome.toLocaleString('en-IN')} earned
                  </span>
                </div>
              </div>
            </div>
          )}

          <SettingsRow
            icon="🔐"
            title="Export Encrypted Backup"
            subtitle="AES-256 · save .vault file"
            onPress={() => setBackupAction('export')}
          />
          <SettingsRow
            icon="📂"
            title="Restore from Backup"
            subtitle="Import a .vault file"
            onPress={() => restoreInputRef.current?.click()}
          />
          <SettingsRow
            icon="📊"
            title="Export to CSV"
            subtitle="Open in Excel / Numbers"
            onPress={handleExportCSV}
          />
          <SettingsRow
            icon="📋"
            title="Export to Excel"
            subtitle="Download .xlsx spreadsheet"
            onPress={handleExportExcel}
          />
        </Section>

        {/* Import */}
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
            subtitle="OCR from camera or photo"
            onPress={() => navigate('receipt')}
          />
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <SettingsRow icon="💱" title="Currency" subtitle="INR (₹)" right={null} />
          <SettingsRow icon="🌙" title="Dark Mode" subtitle="Always on"
            right={<ToggleSwitch value={true} onChange={() => {}} />}
          />
          <SettingsRow icon="🏷️" title="Manage Categories" subtitle="Add, rename, merge" />
          <SettingsRow icon="🔔" title="Recurring Alerts" subtitle="Coming soon" />
        </Section>

        {/* About */}
        <Section title="About">
          <SettingsRow icon="ℹ️" title="About Vault" subtitle="Phase 6 · Privacy-first expense tracker" right={null} />
        </Section>

        {/* Danger zone */}
        <div className="mb-8">
          <button
            onClick={handleClearData}
            className="w-full py-4 rounded-2xl text-sm font-medium tap-active"
            style={{
              background: 'rgba(255,107,107,0.08)',
              border: '1px solid rgba(255,107,107,0.25)',
              color: '#FF6B6B',
            }}>
            🗑️ Erase All Data Permanently
          </button>
          <p className="text-[10px] text-center mt-2" style={{ color: '#5A6A8A' }}>
            This cannot be undone. Data stays only on your device.
          </p>
        </div>
      </div>

      {/* Hidden restore file input */}
      <input
        ref={restoreInputRef}
        type="file"
        accept=".vault"
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) setBackupAction('restore'); }}
      />

      {/* PIN modal */}
      {pinModal && (
        <SetPinModal
          mode={pinModal}
          onSuccess={handlePinSuccess}
          onClose={() => setPinModal(null)}
        />
      )}

      {/* Backup password modal */}
      {backupAction === 'export' && (
        <BackupPasswordModal
          action="export"
          onConfirm={handleExportVault}
          onClose={() => setBackupAction(null)}
        />
      )}
      {backupAction === 'restore' && (
        <BackupPasswordModal
          action="restore"
          onConfirm={handleRestoreVault}
          onClose={() => setBackupAction(null)}
        />
      )}
    </div>
  );
}
