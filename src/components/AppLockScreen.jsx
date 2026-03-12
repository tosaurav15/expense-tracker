/**
 * ============================================================
 *  VAULT — APP LOCK SCREEN  (src/components/AppLockScreen.jsx)
 * ============================================================
 *
 *  Shown before the app loads if PIN lock is enabled.
 *  The entire app is hidden behind this until the correct PIN is entered.
 *
 *  UX design decisions:
 *  ---------------------
 *  • Large keypad keys (44px+ tap targets — NNGroup mobile guideline)
 *  • PIN dots show filled/empty state visually
 *  • Subtle shake animation on wrong PIN (haptic-like feedback)
 *  • Lockout countdown if too many wrong attempts
 *  • Backspace key for corrections
 *  • No "forgot PIN" — by design (Vault is privacy-first; a reset
 *    would be a security hole). User can clear data if they forget.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { verifyPin, getLockoutStatus } from '../services/securityService';

const PIN_LENGTH = 4; // fixed 4-digit PIN display (supports 4-8 digit PINs)

export default function AppLockScreen({ onUnlock }) {
  const [pin, setPin]           = useState('');
  const [error, setError]       = useState('');
  const [shake, setShake]       = useState(false);
  const [checking, setChecking] = useState(false);
  const [lockedSecs, setLockedSecs] = useState(0);

  // ── Countdown timer during lockout ───────────────────────
  useEffect(() => {
    let timer;
    if (lockedSecs > 0) {
      timer = setInterval(() => {
        setLockedSecs(s => {
          if (s <= 1) { clearInterval(timer); return 0; }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [lockedSecs]);

  // ── Check lockout on mount ────────────────────────────────
  useEffect(() => {
    getLockoutStatus().then(secs => { if (secs > 0) setLockedSecs(secs); });
  }, []);

  // ── Trigger shake animation ───────────────────────────────
  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  // ── Handle digit press ────────────────────────────────────
  const handleDigit = useCallback(async (digit) => {
    if (checking || lockedSecs > 0) return;

    const newPin = pin + digit;
    setPin(newPin);
    setError('');

    // Auto-submit when PIN reaches minimum length
    // (Supports both 4 and longer PINs — auto-check at 4, but user can enter more)
    if (newPin.length >= 4) {
      setChecking(true);
      try {
        const result = await verifyPin(newPin);

        if (result.success) {
          onUnlock();
          return;
        }

        // Wrong PIN
        triggerShake();
        setPin('');

        if (result.locked) {
          setLockedSecs(30);
          setError('Too many attempts. Try again in 30 seconds.');
        } else if (result.attemptsLeft !== undefined) {
          setError(
            result.attemptsLeft === 0
              ? 'Account locked for 30 seconds.'
              : `Wrong PIN. ${result.attemptsLeft} attempt${result.attemptsLeft !== 1 ? 's' : ''} left.`
          );
        } else {
          setError('Wrong PIN. Please try again.');
        }
      } catch (err) {
        setError('Verification failed. Please try again.');
        setPin('');
      } finally {
        setChecking(false);
      }
    }
  }, [pin, checking, lockedSecs, onUnlock]);

  // ── Handle backspace ──────────────────────────────────────
  const handleBack = useCallback(() => {
    if (checking || lockedSecs > 0) return;
    setPin(p => p.slice(0, -1));
    setError('');
  }, [checking, lockedSecs]);

  // ── Keyboard support ─────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key);
      if (e.key === 'Backspace') handleBack();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleDigit, handleBack]);

  const isLocked = lockedSecs > 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: '#080C18', maxWidth: '480px', margin: '0 auto' }}
    >
      {/* Logo / branding */}
      <div className="mb-10 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(240,165,0,0.15), rgba(240,165,0,0.05))',
            border: '1px solid rgba(240,165,0,0.3)',
          }}
        >
          🔐
        </div>
        <h1
          className="text-2xl mb-1"
          style={{ fontFamily: 'DM Serif Display, serif', color: '#E8EEFF' }}
        >
          Vault
        </h1>
        <p className="text-sm" style={{ color: '#5A6A8A' }}>
          {isLocked ? 'Too many attempts' : 'Enter your PIN'}
        </p>
      </div>

      {/* PIN dots */}
      <div
        className="flex gap-4 mb-6"
        style={{
          animation: shake ? 'pinShake 0.5s ease' : 'none',
        }}
      >
        {Array.from({ length: Math.max(PIN_LENGTH, pin.length || PIN_LENGTH) }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <div
              key={i}
              className="rounded-full transition-all duration-150"
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

      {/* Error / lockout message */}
      <div className="h-8 mb-4 px-8 text-center">
        {error && (
          <p className="text-sm" style={{ color: '#FF6B6B' }}>{error}</p>
        )}
        {isLocked && !error && (
          <p className="text-sm" style={{ color: '#F0A500' }}>
            Try again in {lockedSecs}s
          </p>
        )}
        {checking && (
          <p className="text-sm" style={{ color: '#5A6A8A' }}>Checking…</p>
        )}
      </div>

      {/* Keypad */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(3, 72px)' }}
      >
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, idx) => {
          if (key === '') {
            return <div key={idx} />;  // empty cell for grid alignment
          }

          const isBackspace = key === '⌫';
          const isDisabled  = isLocked || checking;

          return (
            <button
              key={key}
              onClick={() => isBackspace ? handleBack() : handleDigit(key)}
              disabled={isDisabled}
              className="rounded-2xl flex items-center justify-center tap-active"
              style={{
                height:     '72px',
                background: isDisabled
                  ? '#0F1629'
                  : isBackspace
                    ? 'transparent'
                    : 'rgba(15, 22, 41, 0.8)',
                border:     isBackspace
                  ? 'none'
                  : `1px solid ${isDisabled ? '#1A2640' : '#1E2D4F'}`,
                color:      isDisabled ? '#2A3A5C' : isBackspace ? '#5A6A8A' : '#E8EEFF',
                fontSize:   isBackspace ? '22px' : '22px',
                fontFamily: 'JetBrains Mono, monospace',
                fontWeight: '400',
                cursor:     isDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.1s ease',
              }}
            >
              {key}
            </button>
          );
        })}
      </div>

      {/* Lockout countdown bar */}
      {isLocked && (
        <div className="mt-8 w-48">
          <div
            className="h-1 rounded-full overflow-hidden"
            style={{ background: '#1E2D4F' }}
          >
            <div
              className="h-full rounded-full"
              style={{
                background: '#F0A500',
                width:      `${(lockedSecs / 30) * 100}%`,
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>
      )}

      {/* Privacy note */}
      <p
        className="text-[10px] mt-12 px-8 text-center"
        style={{ color: '#2A3A5C' }}
      >
        PIN is stored as a SHA-256 hash · never uploaded
      </p>

      {/* Shake animation */}
      <style>{`
        @keyframes pinShake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
