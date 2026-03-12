/**
 * ============================================================
 *  VAULT — DATABASE SERVICE  (src/services/database.js)
 * ============================================================
 *
 *  What is IndexedDB?
 *  ------------------
 *  IndexedDB is a built-in database that lives inside your browser.
 *  Think of it like a filing cabinet that only YOUR device can see.
 *  No server, no cloud, no internet needed — ever.
 *
 *  How this file is organised:
 *  ---------------------------
 *  1. DB_CONFIG    — the "blueprint" for our database
 *  2. openDB()     — opens (or creates) the database
 *  3. getDB()      — returns a cached connection (so we only open once)
 *  4. Helper functions used by transactionService.js
 */

// ─── 1. DATABASE BLUEPRINT ───────────────────────────────────────────────────

const DB_CONFIG = {
  name: 'expense_tracker',   // name of the database on your device
  version: 1,                // if you ever add new tables, bump this number
  stores: {
    transactions: {
      keyPath: 'id',         // "id" is the unique identifier for each row
      indexes: [
        { name: 'by_date',    keyPath: 'date' },       // lets us sort/filter by date
        { name: 'by_type',    keyPath: 'type' },       // lets us filter income vs expense
        { name: 'by_category',keyPath: 'category' },  // lets us filter by category
        { name: 'by_created', keyPath: 'createdAt' }, // lets us sort newest-first
      ],
    },
    categories: {
      keyPath: 'id',
      indexes: [],
    },
    settings: {
      keyPath: 'key',        // stores app settings as key-value pairs
      indexes: [],
    },
  },
};

// ─── 2. OPEN THE DATABASE ────────────────────────────────────────────────────

/**
 * openDB()
 *
 * Opens the IndexedDB database. If it doesn't exist yet, creates it.
 * If the version number changed, upgrades the schema.
 *
 * Returns a Promise that resolves to the database connection object.
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_CONFIG.name, DB_CONFIG.version);

    // ── Called when the DB is brand new OR when version number increases ──
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create each store (table) defined in our blueprint
      Object.entries(DB_CONFIG.stores).forEach(([storeName, config]) => {
        // Only create the store if it doesn't already exist
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, {
            keyPath: config.keyPath,
          });

          // Create indexes (like database "columns" you can search by)
          config.indexes.forEach(({ name, keyPath }) => {
            store.createIndex(name, keyPath, { unique: false });
          });

          console.log(`Vault DB: Created store "${storeName}"`);
        }
      });

      // Seed default categories on first install
      seedDefaultCategories(event.target.transaction);
    };

    request.onsuccess = (event) => {
      console.log('Vault DB: Connected to expense_tracker database ✓');
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      console.error('Vault DB: Failed to open database', event.target.error);
      reject(event.target.error);
    };
  });
}

// ─── 3. CACHED CONNECTION ────────────────────────────────────────────────────

// We store the open connection here so we don't re-open it on every call
let _dbInstance = null;

/**
 * getDB()
 *
 * Returns the shared database connection.
 * Opens it once, then reuses it forever.
 */
export async function getDB() {
  if (!_dbInstance) {
    _dbInstance = await openDB();
  }
  return _dbInstance;
}

// ─── 4. LOW-LEVEL HELPERS ────────────────────────────────────────────────────

/**
 * dbGet(storeName, key)
 * Reads one record by its id.
 */
export async function dbGet(storeName, key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * dbGetAll(storeName)
 * Reads ALL records from a store and returns them as an array.
 */
export async function dbGetAll(storeName) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * dbAdd(storeName, record)
 * Inserts a new record. Throws if the id already exists.
 */
export async function dbAdd(storeName, record) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.add(record);
    req.onsuccess = () => resolve(req.result);  // returns the new id
    req.onerror = () => reject(req.error);
  });
}

/**
 * dbPut(storeName, record)
 * Inserts a record, or REPLACES it if the id already exists.
 * Used for both "create" and "update" operations.
 */
export async function dbPut(storeName, record) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(record);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * dbDelete(storeName, key)
 * Permanently deletes one record by its id.
 */
export async function dbDelete(storeName, key) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * dbGetByIndex(storeName, indexName, value)
 * Reads all records where a specific field equals a specific value.
 * Example: get all transactions where type === 'expense'
 */
export async function dbGetByIndex(storeName, indexName, value) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

// ─── 5. DEFAULT CATEGORIES SEED ──────────────────────────────────────────────

/**
 * seedDefaultCategories(transaction)
 *
 * On first install, we pre-load 10 default categories
 * so the user doesn't start with an empty app.
 *
 * This runs inside the upgrade transaction — safe and atomic.
 */
function seedDefaultCategories(transaction) {
  const store = transaction.objectStore('categories');

  const defaults = [
    { id: 'food',           name: 'Food',           icon: '🍕', color: '#F0A500' },
    { id: 'transport',      name: 'Transport',       icon: '🚗', color: '#4CC9F0' },
    { id: 'shopping',       name: 'Shopping',        icon: '🛍️', color: '#9B5DE5' },
    { id: 'bills',          name: 'Bills',           icon: '💡', color: '#FF6B6B' },
    { id: 'entertainment',  name: 'Entertainment',   icon: '🎬', color: '#06D6A0' },
    { id: 'salary',         name: 'Salary',          icon: '💼', color: '#06D6A0' },
    { id: 'investment',     name: 'Investment',      icon: '📈', color: '#4CC9F0' },
    { id: 'rent',           name: 'Rent',            icon: '🏠', color: '#FF6B6B' },
    { id: 'health',         name: 'Health',          icon: '❤️', color: '#FF6B6B' },
    { id: 'groceries',      name: 'Groceries',       icon: '🛒', color: '#F0A500' },
    { id: 'education',      name: 'Education',       icon: '📚', color: '#4CC9F0' },
    { id: 'other',          name: 'Other',           icon: '📦', color: '#5A6A8A' },
  ];

  defaults.forEach(cat => store.put(cat));
  console.log('Vault DB: Default categories seeded ✓');
}
