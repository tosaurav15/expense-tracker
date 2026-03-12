/**
 * VAULT — ADD / EDIT TRANSACTION MODAL
 * Slides up from bottom. Saves to IndexedDB via service layer.
 * Two modes: Quick Entry (natural text) and Full Form.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { parseQuickEntry, autoCategory } from '../services/transactionService';

const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'Net Banking', 'Wallet'];
const TRANSACTION_TYPES = [
  { id: 'expense',  label: 'Expense',  color: '#FF6B6B' },
  { id: 'income',   label: 'Income',   color: '#06D6A0' },
  { id: 'transfer', label: 'Transfer', color: '#4CC9F0' },
];

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function AddTransactionModal() {
  const { showAddModal, closeAddModal, showNotif, addTxn, editTxn, editTarget, categories } = useApp();

  const [type, setType]                   = useState('expense');
  const [amount, setAmount]               = useState('');
  const [category, setCategory]           = useState('');
  const [merchant, setMerchant]           = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [date, setDate]                   = useState(todayISO());
  const [notes, setNotes]                 = useState('');
  const [quickText, setQuickText]         = useState('');
  const [quickMode, setQuickMode]         = useState(true);
  const [saving, setSaving]               = useState(false);
  const [errors, setErrors]               = useState({});
  const [visible, setVisible]             = useState(false);
  const inputRef = useRef(null);
  const isEditing = !!editTarget;

  useEffect(() => {
    if (showAddModal) {
      setVisible(true);
      if (editTarget) {
        setType(editTarget.type || 'expense');
        setAmount(String(editTarget.amount));
        setCategory(editTarget.category || '');
        setMerchant(editTarget.merchant || '');
        setPaymentMethod(editTarget.paymentMethod || 'UPI');
        setDate(editTarget.date || todayISO());
        setNotes(editTarget.notes || '');
        setQuickMode(false);
      } else {
        resetForm();
        setQuickMode(true);
      }
      setTimeout(() => inputRef.current?.focus(), 350);
    } else {
      setVisible(false);
    }
  }, [showAddModal, editTarget]);

  const resetForm = () => {
    setAmount(''); setCategory(''); setMerchant('');
    setNotes(''); setQuickText(''); setDate(todayISO());
    setType('expense'); setPaymentMethod('UPI'); setErrors({});
  };

  const handleClose = () => {
    setVisible(false);
    setTimeout(closeAddModal, 300);
    resetForm();
  };

  const handleQuickParse = () => {
    if (!quickText.trim()) return;
    const parsed = parseQuickEntry(quickText);
    if (parsed) {
      if (parsed.amount)   setAmount(String(parsed.amount));
      if (parsed.category) setCategory(parsed.category);
      if (parsed.merchant) setMerchant(parsed.merchant);
      if (parsed.type)     setType(parsed.type);
      setQuickMode(false);
    }
  };

  const handleMerchantBlur = () => {
    if (merchant && !category) {
      const guessed = autoCategory(merchant);
      if (guessed !== 'other') setCategory(guessed);
    }
  };

  const validate = () => {
    const errs = {};
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) errs.amount = 'Enter a valid amount';
    if (!category) errs.category = 'Pick a category';
    if (!date)     errs.date = 'Choose a date';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const data = { amount, type, category, merchant, paymentMethod, date, notes, tags: [] };
    setSaving(true);
    try {
      if (isEditing) {
        await editTxn({ ...data, id: editTarget.id });
        showNotif('Transaction updated ✓');
      } else {
        await addTxn(data);
        showNotif('Transaction saved ✓');
      }
      handleClose();
    } catch (err) {
      showNotif(err.message || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!showAddModal) return null;
  const activeType = TRANSACTION_TYPES.find(t => t.id === type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(4,6,14,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl"
        style={{
          background: '#0F1629',
          border: '1px solid rgba(30,45,79,0.9)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
          maxHeight: '92dvh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2A3A5C' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.2rem' }}>
            {isEditing ? 'Edit Transaction' : 'New Transaction'}
          </h2>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full tap-active" style={{ background: '#1E2D4F' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8899BB" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="px-5 pb-8 space-y-4">
          {/* Type Toggle */}
          <div className="flex p-1 gap-1 rounded-xl" style={{ background: '#080C18' }}>
            {TRANSACTION_TYPES.map(t => (
              <button key={t.id} onClick={() => setType(t.id)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium tap-active"
                style={{
                  background: type === t.id ? t.color + '25' : 'transparent',
                  color: type === t.id ? t.color : '#5A6A8A',
                  border: type === t.id ? `1px solid ${t.color}55` : '1px solid transparent',
                }}
              >{t.label}</button>
            ))}
          </div>

          {/* Quick Entry toggle */}
          {!isEditing && (
            <div className="flex items-center gap-2">
              <button onClick={() => setQuickMode(!quickMode)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full tap-active"
                style={{
                  background: quickMode ? 'rgba(240,165,0,0.12)' : '#151E35',
                  color: quickMode ? '#F0A500' : '#5A6A8A',
                  border: `1px solid ${quickMode ? 'rgba(240,165,0,0.3)' : '#1E2D4F'}`,
                }}
              >⚡ Quick Entry</button>
              <span className="text-xs" style={{ color: '#5A6A8A' }}>
                {quickMode ? '"450 food swiggy"' : 'Tap to switch'}
              </span>
            </div>
          )}

          {/* QUICK MODE */}
          {quickMode && !isEditing ? (
            <div>
              <input ref={inputRef} type="text" value={quickText}
                onChange={e => setQuickText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleQuickParse()}
                placeholder="450 food swiggy"
                className="w-full px-4 py-4 rounded-xl text-xl"
                style={{ background: '#080C18', border: '1px solid #1E2D4F', color: '#E8EEFF', outline: 'none', fontFamily: 'JetBrains Mono, monospace' }}
              />
              <p className="text-xs mt-2 mb-3" style={{ color: '#5A6A8A' }}>
                [amount] [category] [merchant] · Enter or tap below
              </p>
              <button onClick={handleQuickParse} disabled={!quickText.trim()}
                className="w-full py-3 rounded-xl text-sm font-medium tap-active"
                style={{
                  background: quickText.trim() ? 'rgba(240,165,0,0.15)' : '#151E35',
                  border: `1px solid ${quickText.trim() ? 'rgba(240,165,0,0.3)' : '#1E2D4F'}`,
                  color: quickText.trim() ? '#F0A500' : '#5A6A8A',
                }}
              >Parse &amp; Review →</button>
            </div>
          ) : (
            <>
              {/* Amount */}
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: '#8899BB' }}>Amount *</label>
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: '#080C18', border: `1.5px solid ${errors.amount ? '#FF6B6B' : '#1E2D4F'}` }}>
                  <span className="text-2xl font-light" style={{ color: activeType?.color || '#F0A500' }}>₹</span>
                  <input ref={inputRef} type="number" inputMode="decimal" value={amount}
                    onChange={e => { setAmount(e.target.value); setErrors(p => ({...p, amount: null})); }}
                    placeholder="0.00" className="flex-1 text-3xl font-light bg-transparent outline-none"
                    style={{ color: '#E8EEFF', fontFamily: 'DM Serif Display, serif' }}
                  />
                </div>
                {errors.amount && <p className="text-xs mt-1" style={{ color: '#FF6B6B' }}>{errors.amount}</p>}
              </div>

              {/* Category */}
              <div>
                <label className="text-xs mb-2 block font-medium" style={{ color: '#8899BB' }}>
                  Category *{errors.category && <span className="ml-2" style={{ color: '#FF6B6B' }}>{errors.category}</span>}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {categories.slice(0, 12).map(cat => (
                    <button key={cat.id}
                      onClick={() => { setCategory(cat.id); setErrors(p => ({...p, category: null})); }}
                      className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl tap-active"
                      style={{
                        background: category === cat.id ? cat.color + '22' : '#080C18',
                        border: `1.5px solid ${category === cat.id ? cat.color : '#1E2D4F'}`,
                      }}
                    >
                      <span className="text-xl leading-none">{cat.icon}</span>
                      <span className="text-[9px] leading-none text-center" style={{ color: category === cat.id ? cat.color : '#5A6A8A' }}>
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Merchant */}
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: '#8899BB' }}>Merchant</label>
                <input type="text" value={merchant}
                  onChange={e => setMerchant(e.target.value)} onBlur={handleMerchantBlur}
                  placeholder="Swiggy, Amazon, Salary..."
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{ background: '#080C18', border: '1px solid #1E2D4F', color: '#E8EEFF', outline: 'none' }}
                />
              </div>

              {/* Date + Payment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: '#8899BB' }}>Date *</label>
                  <input type="date" value={date} max={todayISO()}
                    onChange={e => setDate(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl text-sm"
                    style={{ background: '#080C18', border: '1px solid #1E2D4F', color: '#E8EEFF', outline: 'none', colorScheme: 'dark' }}
                  />
                </div>
                <div>
                  <label className="text-xs mb-1.5 block font-medium" style={{ color: '#8899BB' }}>Payment</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-3 rounded-xl text-sm"
                    style={{ background: '#080C18', border: '1px solid #1E2D4F', color: '#E8EEFF', outline: 'none' }}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs mb-1.5 block font-medium" style={{ color: '#8899BB' }}>Notes</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Optional note..."
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{ background: '#080C18', border: '1px solid #1E2D4F', color: '#E8EEFF', outline: 'none' }}
                />
              </div>

              {/* Save */}
              <button onClick={handleSave} disabled={saving}
                className="w-full py-4 rounded-2xl font-semibold text-base tap-active mt-1"
                style={{
                  background: saving ? '#2A3A5C' : 'linear-gradient(135deg, #F0A500, #FFD166)',
                  color: saving ? '#5A6A8A' : '#080C18',
                  boxShadow: saving ? 'none' : '0 4px 20px rgba(240,165,0,0.35)',
                }}
              >
                {saving ? 'Saving...' : isEditing ? '✓  Save Changes' : '✓  Save Transaction'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
