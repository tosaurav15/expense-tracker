/**
 * ============================================================
 *  VAULT — SET PIN MODAL  (src/components/SetPinModal.jsx)
 * ============================================================
 *
 *  Used for three actions in Settings:
 *    mode = 'set'     — set a new PIN (first time enabling lock)
 *    mode = 'change'  — change existing PIN (verify old, set new)
 *    mode = 'disable' — disable lock (verify PIN once, then clear)
 *
 *  Flow for each mode:
 *  ────────────────────
 *  SET:
 *    Step 1: Enter new PIN (4+ digits)
 *    Step 2: Confirm the same PIN
 *    → Save
 *
 *  CHANGE:
 *    Step 1: Enter current PIN
 *    Step 2: Enter new PIN
 *    Step 3: Confirm new PIN
 *    → Save
 *
 *  DISABLE:
 *    Step 1: Enter current PIN to confirm
 *    → Clear PIN
 */

import React, { useState, useCallback, useEffect } from 'react';
import { setPin, verifyPin, clearPin, changePin } from '../services/securityService';

const STEPS = {
  set:     ['Enter new PIN', 'Confirm new PIN'],
  change:  ['Enter current PIN', 'Enter new PIN', 'Confirm new PIN'],
  disable: ['Enter current PIN to disable lock'],
};

export default function SetPinModal({ mode = 'set', onSuccess, onClose }) {
  const [step, setStep]         = useState(0);
  const [pin, setPin_]          = useState('');
  const [firstPin, setFirstPin] = useState(''); // stored between steps
  const [oldPin, setOldPin]     = useState('');
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [visible, setVisible]   = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 10); }, []);

  const steps    = STEPS[mode];
  const maxSteps = steps.length;

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleDigit = useCallback(async (digit) => {
    if (saving) return;
    const newPin = pin + digit;
    setPin_(newPin);
    setError('');

    if (newPin.length < 4) return;

    // ── SET mode ──────────────────────────────────────────
    if (mode === 'set') {
      if (step === 0) {
        setFirstPin(newPin);
        setPin_('');
        setStep(1);
        return;
      }
      if (step === 1) {
        if (newPin !== firstPin) {
          triggerShake();
          setPin_('');
          setError("PINs don't match. Try again.");
          setStep(0);
          setFirstPin('');
          return;
        }
        setSaving(true);
        try {
          await setPin(newPin);
          handleClose();
          onSuccess?.('App lock enabled ✓');
        } catch (err) {
          setError(err.message);
          setPin_('');
        } finally {
          setSaving(false);
        }
        return;
      }
    }

    // ── CHANGE mode ───────────────────────────────────────
    if (mode === 'change') {
      if (step === 0) {
        // Verify old PIN
        const result = await verifyPin(newPin);
        if (!result.success) {
          triggerShake();
          setPin_('');
          setError(result.locked ? 'Too many attempts. Wait 30 seconds.' : 'Incorrect PIN.');
          return;
        }
        setOldPin(newPin);
        setPin_('');
        setStep(1);
        return;
      }
      if (step === 1) {
        setFirstPin(newPin);
        setPin_('');
        setStep(2);
        return;
      }
      if (step === 2) {
        if (newPin !== firstPin) {
          triggerShake();
          setPin_('');
          setError("PINs don't match. Try again.");
          setStep(1);
          setFirstPin('');
          return;
        }
        setSaving(true);
        try {
          const result = await changePin(oldPin, newPin);
          if (!result.success) throw new Error(result.error);
          handleClose();
          onSuccess?.('PIN changed ✓');
        } catch (err) {
          setError(err.message);
          setPin_('');
        } finally {
          setSaving(false);
        }
        return;
      }
    }

    // ── DISABLE mode ──────────────────────────────────────
    if (mode === 'disable') {
      const result = await verifyPin(newPin);
      if (!result.success) {
        triggerShake();
        setPin_('');
        setError(result.locked ? 'Too many attempts. Wait 30 seconds.' : 'Wrong PIN.');
        return;
      }
      setSaving(true);
      try {
        await clearPin();
        handleClose();
        onSuccess?.('App lock disabled');
      } catch (err) {
        setError(err.message);
        setPin_('');
      } finally {
        setSaving(false);
      }
    }
  }, [pin, step, mode, firstPin, oldPin, saving]);

  const handleBack = useCallback(() => {
    if (saving) return;
    setPin_(p => p.slice(0, -1));
    setError('');
  }, [saving]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      if (e.key === 'Backspace') handleBack();
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleDigit, handleBack]);

  const progressPct = ((step + (pin.length >= 4 ? 1 : pin.length / 4)) / maxSteps) * 100;

  const modeTitle = { set: 'Set App Lock', change: 'Change PIN', disable: 'Disable App Lock' }[mode];
  const modeIcon  = { set: '🔐', change: '🔑', disable: '🔓' }[mode];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      style={{ background: 'rgba(4,6,14,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl pb-8"
        style={{
          background: '#0F1629',
          border: '1px solid rgba(30,45,79,0.9)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: '#2A3A5C' }} />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pb-4">
          <span className="text-2xl">{modeIcon}</span>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#E8EEFF' }}>{modeTitle}</h2>
            <p className="text-xs" style={{ color: '#5A6A8A' }}>
              Step {step + 1} of {maxSteps} · {steps[step]}
            </p>
          </div>
          <button onClick={handleClose} className="ml-auto tap-active w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: '#151E35', border: '1px solid #1E2D4F' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5A6A8A" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 mb-6">
          <div className="h-1 rounded-full" style={{ background: '#1E2D4F' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #F0A500, #FFD166)' }} />
          </div>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center mb-3">
          <div
            className="flex gap-4"
            style={{ animation: shake ? 'pinShake 0.5s ease' : 'none' }}
          >
            {Array.from({ length: 4 }).map((_, i) => {
              const filled = i < pin.length;
              return (
                <div key={i} className="rounded-full transition-all duration-150"
                  style={{
                    width:      filled ? '14px' : '12px',
                    height:     filled ? '14px' : '12px',
                    background: filled ? '#F0A500' : 'transparent',
                    border:     `2px solid ${filled ? '#F0A500' : '#2A3A5C'}`,
                    boxShadow:  filled ? '0 0 8px rgba(240,165,0,0.6)' : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Error */}
        <div className="h-7 px-6 text-center mb-2">
          {error && <p className="text-xs" style={{ color: '#FF6B6B' }}>{error}</p>}
          {saving && <p className="text-xs" style={{ color: '#5A6A8A' }}>Saving…</p>}
        </div>

        {/* Keypad */}
        <div className="flex justify-center">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(3, 64px)' }}>
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => {
              if (key === '') return <div key={idx} />;
              const isBackspace = key === '⌫';
              return (
                <button
                  key={key}
                  onClick={() => isBackspace ? handleBack() : handleDigit(key)}
                  disabled={saving}
                  className="rounded-xl flex items-center justify-center tap-active"
                  style={{
                    height:     '64px',
                    background: isBackspace ? 'transparent' : '#151E35',
                    border:     isBackspace ? 'none' : '1px solid #1E2D4F',
                    color:      isBackspace ? '#5A6A8A' : '#E8EEFF',
                    fontSize:   '20px',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-5px); }
          60% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
