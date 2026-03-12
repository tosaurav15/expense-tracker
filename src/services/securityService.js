/**
 * ============================================================
 *  VAULT — SECURITY SERVICE  (src/services/securityService.js)
 * ============================================================
 *
 *  Handles the app's PIN lock feature.
 *
 *  How PIN storage works (important privacy note):
 *  ------------------------------------------------
 *  We NEVER store the PIN itself. Instead, we store a
 *  SHA-256 hash of the PIN. SHA-256 is a one-way function —
 *  you can go from PIN → hash, but not hash → PIN.
 *
 *  When the user enters their PIN to unlock:
 *    1. We hash what they typed
 *    2. We compare that hash to the stored hash
 *    3. If they match → correct PIN
 *    4. The raw PIN never touches storage
 *
 *  All of this uses the Web Crypto API — built into every
 *  modern browser, no library needed, fully offline.
 *
 *  Where is it stored?
 *  -------------------
 *  In IndexedDB "settings" store under these keys:
 *    vault_pin_hash    — the SHA-256 hash of the PIN
 *    vault_pin_enabled — boolean, whether lock is active
 *
 *  ─────────────────────────────────────────────────────────
 *  EXPORTED FUNCTIONS
 *  ─────────────────────────────────────────────────────────
 *
 *  setPin(pin)
 *    → hashes the PIN and stores it; enables app lock
 *
 *  verifyPin(pin)
 *    → returns true if the entered PIN matches stored hash
 *
 *  isPinEnabled()
 *    → returns true if app lock is turned on
 *
 *  clearPin()
 *    → removes PIN hash and disables lock
 *
 *  changePin(oldPin, newPin)
 *    → verifies old PIN first, then sets new one
 */

import { dbGet, dbPut } from './database.js';

const STORE        = 'settings';
const KEY_HASH     = 'vault_pin_hash';
const KEY_ENABLED  = 'vault_pin_enabled';
const KEY_ATTEMPTS = 'vault_pin_attempts';
const MAX_ATTEMPTS = 5;     // lock out after 5 wrong tries
const LOCKOUT_MS   = 30000; // 30 second lockout

// ─── HASHING ─────────────────────────────────────────────────────────────────

/**
 * hashPin(pin)
 *
 * Converts a PIN string into a SHA-256 hex digest.
 * We add a fixed salt so the hash can't be reverse-looked-up
 * from a rainbow table.
 *
 * @param {string} pin
 * @returns {Promise<string>} hex string like "a3f9b..."
 */
async function hashPin(pin) {
  const salt    = 'vault-privacy-salt-v1';
  const data    = new TextEncoder().encode(salt + pin);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  // Convert ArrayBuffer → hex string
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── PIN MANAGEMENT ──────────────────────────────────────────────────────────

/**
 * setPin(pin)
 *
 * Enables app lock with the given PIN.
 * Validates: must be 4–8 digits.
 *
 * @param {string} pin
 * @throws if pin is invalid
 */
export async function setPin(pin) {
  if (!pin || !/^\d{4,8}$/.test(pin)) {
    throw new Error('PIN must be 4 to 8 digits.');
  }
  const hash = await hashPin(pin);
  await dbPut(STORE, { key: KEY_HASH,    value: hash });
  await dbPut(STORE, { key: KEY_ENABLED, value: true });
  await dbPut(STORE, { key: KEY_ATTEMPTS, value: { count: 0, lockedUntil: null } });
  console.log('Vault Security: PIN lock enabled');
}

/**
 * verifyPin(pin)
 *
 * Returns true if the entered PIN matches the stored hash.
 * Tracks failed attempts and enforces lockout.
 *
 * @param {string} pin
 * @returns {Promise<{ success: boolean, attemptsLeft?: number, lockedUntil?: number }>}
 */
export async function verifyPin(pin) {
  // Check lockout first
  const attemptsRecord = await dbGet(STORE, KEY_ATTEMPTS);
  const attempts = attemptsRecord?.value || { count: 0, lockedUntil: null };

  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    const secondsLeft = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
    return { success: false, locked: true, secondsLeft };
  }

  // Hash and compare
  const stored = await dbGet(STORE, KEY_HASH);
  if (!stored?.value) return { success: false };

  const entered = await hashPin(pin);

  if (entered === stored.value) {
    // Correct — reset attempt counter
    await dbPut(STORE, { key: KEY_ATTEMPTS, value: { count: 0, lockedUntil: null } });
    return { success: true };
  }

  // Wrong PIN — increment attempts
  const newCount = attempts.count + 1;
  const lockedUntil = newCount >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;
  await dbPut(STORE, { key: KEY_ATTEMPTS, value: { count: newCount, lockedUntil } });

  const attemptsLeft = MAX_ATTEMPTS - newCount;
  return { success: false, attemptsLeft: Math.max(0, attemptsLeft), locked: !!lockedUntil };
}

/**
 * isPinEnabled()
 * @returns {Promise<boolean>}
 */
export async function isPinEnabled() {
  try {
    const rec = await dbGet(STORE, KEY_ENABLED);
    return rec?.value === true;
  } catch {
    return false;
  }
}

/**
 * clearPin()
 * Disables app lock and removes all PIN data.
 */
export async function clearPin() {
  await dbPut(STORE, { key: KEY_HASH,     value: null });
  await dbPut(STORE, { key: KEY_ENABLED,  value: false });
  await dbPut(STORE, { key: KEY_ATTEMPTS, value: { count: 0, lockedUntil: null } });
  console.log('Vault Security: PIN lock disabled');
}

/**
 * changePin(oldPin, newPin)
 * Verifies the old PIN before setting the new one.
 *
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function changePin(oldPin, newPin) {
  const check = await verifyPin(oldPin);
  if (!check.success) {
    return { success: false, error: 'Current PIN is incorrect.' };
  }
  try {
    await setPin(newPin);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * getLockoutStatus()
 * Returns remaining lockout seconds (0 if not locked).
 */
export async function getLockoutStatus() {
  try {
    const rec = await dbGet(STORE, KEY_ATTEMPTS);
    const attempts = rec?.value || { count: 0, lockedUntil: null };
    if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
      return Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
    }
    return 0;
  } catch {
    return 0;
  }
}
