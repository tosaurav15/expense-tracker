/**
 * ============================================================
 *  VAULT — useAnalytics HOOK  (src/hooks/useAnalytics.js)
 * ============================================================
 *
 *  What this does:
 *  ---------------
 *  Watches the transaction list (which the app already keeps in
 *  memory via AppContext) and re-runs all analytics calculations
 *  whenever any transaction changes.
 *
 *  How to use in any component:
 *  ─────────────────────────────
 *  import { useAnalytics } from '../hooks/useAnalytics';
 *
 *  function MyComponent() {
 *    const { summary, insights, healthScore, charts, ... } = useAnalytics();
 *    // now use any of these values directly in JSX
 *  }
 *
 *  What it returns:
 *  ────────────────
 *  summary        — { income, expenses, savings, savingsRate }  for current month
 *  breakdown      — array of ALL categories with totals & percentages
 *  topCategories  — top 5 categories (with an "Others" rollup)
 *  trend          — 7-month array of { label, income, expenses, savings }
 *  comparison     — current vs previous month { current, previous, changes }
 *  insights       — array of plain-English insight objects
 *  healthScore    — { score, grade, factors }
 *  spendingDNA    — array of 4 behavioural dimensions
 *  forecast       — { income, spent, upcomingFixed, safeToSpend, daysLeft }
 *  charts         — pre-built Chart.js data objects { category, trend, bar, savings, ratio }
 *  loading        — true while computing (usually instant)
 *  hasData        — true if the user has at least one transaction
 */

import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getFullAnalytics } from '../services/analyticsService';

export function useAnalytics() {
  // Pull raw data from the shared app context
  // (AppContext already keeps transactions + categories in sync with IndexedDB)
  const { transactions, categories, loading: dbLoading } = useApp();

  // useMemo means: only re-run the calculations when transactions or categories change.
  // This is a performance optimisation — we don't want to re-crunch numbers
  // on every single render, only when the underlying data actually changes.
  const analytics = useMemo(() => {
    // If we have no data yet (still loading, or truly empty), return safe defaults
    if (!transactions || transactions.length === 0) {
      return {
        summary:       { income: 0, expenses: 0, savings: 0, savingsRate: 0, transactionCount: 0 },
        breakdown:     [],
        topCategories: [],
        trend:         [],
        comparison:    { current: {}, previous: {}, changes: {} },
        insights:      [],
        healthScore:   { score: 0, grade: 'F', factors: [] },
        spendingDNA:   [],
        forecast:      { income: 0, spent: 0, upcomingFixed: 0, safeToSpend: 0, daysLeft: 0, onTrack: true },
        charts:        { category: null, trend: null, bar: null, savings: null, ratio: null },
        hasData:       false,
      };
    }

    // Run all calculations via analyticsService
    const result = getFullAnalytics(transactions, categories);
    return { ...result, hasData: transactions.length > 0 };

  }, [transactions, categories]);
  // ↑ Only recalculates when these two arrays change

  return {
    ...analytics,
    loading: dbLoading,
  };
}
