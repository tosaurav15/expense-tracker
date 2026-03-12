# Vault — Private Expense Tracker (Phase 1)

A premium, mobile-first personal finance PWA. No cloud. No ads. No tracking. 100% offline.

## How to Run

### Step 1: Install Node.js
Download from: https://nodejs.org (LTS version)

### Step 2: Open Terminal and navigate here
cd expense-tracker

### Step 3: Install (first time only)
npm install

### Step 4: Start the app
npm run dev

### Step 5: Open browser
Go to: http://localhost:5173

## Install as Mobile App
- iPhone: Safari → Share → Add to Home Screen
- Android: Chrome → Menu → Add to Home Screen
- Desktop: Chrome install button (⊕) in address bar

## Project Structure
src/context/     - App state management
src/components/  - BottomNav, AddTransactionModal, Toast
src/pages/       - Dashboard, Transactions, Analytics, Settings
src/utils/       - Mock data (replaced by real DB in Phase 2)
public/          - manifest.json, sw.js (PWA files)

## Phase Roadmap
Phase 1: UI shell (DONE)
Phase 2: IndexedDB database + real transactions
Phase 3: Dashboard with live data
Phase 4: PDF/CSV/Excel import
Phase 5: Auto-categorization
Phase 6: AES-256 encryption + PIN lock
Phase 7: Full offline service worker
Phase 8: Encrypted backup & restore
