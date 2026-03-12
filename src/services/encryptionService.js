/**
 * ============================================================
 *  VAULT — ENCRYPTION SERVICE  (src/services/encryptionService.js)
 * ============================================================
 *
 *  Provides AES-256-GCM encryption/decryption for backup files.
 *
 *  What is AES-256-GCM?
 *  ---------------------
 *  It's the gold standard for symmetric encryption:
 *  • AES-256   = 256-bit key, effectively unbreakable by brute force
 *  • GCM mode  = also authenticates the data (detects tampering)
 *
 *  How it works when you export a backup:
 *  ----------------------------------------
 *  1. User enters a backup password
 *  2. We derive a 256-bit key from that password using PBKDF2
 *     (PBKDF2 makes brute-forcing slow — 100,000 iterations)
 *  3. We generate a random 12-byte IV (initialisation vector)
 *     Every encryption produces a different output even for the same data
 *  4. Encrypt the JSON data with AES-256-GCM
 *  5. Package: { iv, salt, data } → base64 → .vault file
 *
 *  When you import the backup:
 *  ----------------------------
 *  1. User enters the same password
 *  2. We re-derive the key from password + stored salt
 *  3. Decrypt → original JSON
 *  4. If the password is wrong → decryption fails with an error
 *
 *  All of this uses the browser's built-in Web Crypto API.
 *  Zero external libraries needed.
 *
 *  ─────────────────────────────────────────────────────────
 *  EXPORTED FUNCTIONS
 *  ─────────────────────────────────────────────────────────
 *
 *  encryptData(data, password)
 *    → Promise<string>  base64-encoded encrypted payload
 *
 *  decryptData(encryptedB64, password)
 *    → Promise<any>  the original data object
 *
 *  generateBackupKey()
 *    → string  a random 20-character alphanumeric key
 *    (for users who want Vault to generate a key for them)
 */

// ─── KEY DERIVATION ──────────────────────────────────────────────────────────

/**
 * deriveKey(password, salt)
 *
 * Turns a human password into a cryptographic key using PBKDF2.
 * Salt prevents pre-computed (rainbow table) attacks.
 *
 * @param {string}     password
 * @param {Uint8Array} salt — 16 random bytes
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt:       salt,
      iterations: 100_000,   // slow by design — makes brute-force hard
      hash:       'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── ENCRYPT ─────────────────────────────────────────────────────────────────

/**
 * encryptData(data, password)
 *
 * Serialises `data` to JSON, then encrypts it with AES-256-GCM.
 * Returns a base64 string safe to write to a .vault file.
 *
 * The output format is:
 * Base64( JSON({ version, salt_hex, iv_hex, ciphertext_hex }) )
 *
 * @param {any}    data      — anything JSON-serialisable
 * @param {string} password  — user's backup password
 * @returns {Promise<string>}
 */
export async function encryptData(data, password) {
  if (!password || password.length < 4) {
    throw new Error('Backup password must be at least 4 characters.');
  }

  const json       = JSON.stringify(data);
  const plaintext  = new TextEncoder().encode(json);

  // Generate random salt (for key derivation) and IV (for encryption)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));

  const key        = await deriveKey(password, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  // Package everything needed for decryption
  const payload = {
    version:    2,                                    // format version
    algorithm:  'AES-256-GCM',
    kdf:        'PBKDF2-SHA256-100000',
    salt:       bufToHex(salt),
    iv:         bufToHex(iv),
    ciphertext: bufToHex(ciphertext),
    createdAt:  new Date().toISOString(),
  };

  // Return as base64 — safe for file download
  return btoa(JSON.stringify(payload));
}

// ─── DECRYPT ─────────────────────────────────────────────────────────────────

/**
 * decryptData(encryptedB64, password)
 *
 * Reverses encryptData. Returns the original data object.
 * Throws if the password is wrong or the file is corrupted.
 *
 * @param {string} encryptedB64
 * @param {string} password
 * @returns {Promise<any>}
 */
export async function decryptData(encryptedB64, password) {
  let payload;
  try {
    payload = JSON.parse(atob(encryptedB64));
  } catch {
    throw new Error('Invalid backup file format. The file may be corrupted.');
  }

  if (!payload.salt || !payload.iv || !payload.ciphertext) {
    throw new Error('Backup file is missing required fields.');
  }

  const salt       = hexToBuf(payload.salt);
  const iv         = hexToBuf(payload.iv);
  const ciphertext = hexToBuf(payload.ciphertext);

  let key;
  try {
    key = await deriveKey(password, salt);
  } catch {
    throw new Error('Failed to derive encryption key.');
  }

  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
  } catch {
    // AES-GCM authentication failure = wrong password or tampered file
    throw new Error('Incorrect password, or the backup file has been tampered with.');
  }

  try {
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new Error('Decrypted data is not valid JSON.');
  }
}

// ─── KEY GENERATOR ───────────────────────────────────────────────────────────

/**
 * generateBackupKey()
 *
 * Generates a random 20-character alphanumeric password.
 * Used when the user wants Vault to create a strong key for them.
 *
 * Format: XXXXX-XXXXX-XXXXX-XXXXX  (groups of 5 for readability)
 *
 * @returns {string}
 */
export function generateBackupKey() {
  const chars   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  const segment = () => Array.from(
    { length: 5 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function bufToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes.buffer;
}
