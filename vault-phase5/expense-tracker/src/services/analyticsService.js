/**
 * ============================================================
 *  VAULT — ANALYTICS SERVICE  (src/services/analyticsService.js)
 * ============================================================
 *
 *  This file is the "number-crunching brain" of the app.
 *  It receives raw transaction data and produces every
 *  metric, chart dataset, and insight the UI needs.
 *
 *  IMPORTANT DESIGN RULE:
 *  ──────────────────────
 *  This file contains ZERO UI code. It only works with
 *  plain numbers, strings, and arrays. The Dashboard and
 *  Analytics pages just call these functions and display
 *  whatever they return — they never do math themselves.
 *
 *  Think of it like a spreadsheet engine:
 *  • You give it raw data (transactions)
 *  • It gives you calculated results (totals, percentages, insights)
 *  • The UI just draws those results on screen
 *
 *  ──────────────────────────────────────────────────────────
 *  EXPORTED FUNCTIONS (alphabetical)
 *  ──────────────────────────────────────────────────────────
 *
 *  calculateMonthlySummary(transactions, year, month)
 *    → income, expenses, savings, savingsRate, transactionCount
 *
 *  getCategoryBreakdown(transactions, categories)
 *    → array of { id, name, icon, color, total, percentage }
 *      sorted largest → smallest
 *
 *  getTopCategories(transactions, categories, n)
 *    → same shape as getCategoryBreakdown, limited to top N
 *
 *  getMonthlyTrend(transactions, monthCount)
 *    → array of { month, label, income, expenses, savings }
 *      for the last N months, oldest → newest
 *
 *  getMonthlyComparison(transactions, year, month)
 *    → { current, previous, changes: { income%, expenses%, savings% } }
 *
 *  generateInsights(transactions, categories, year, month)
 *    → array of { id, text, type, icon, value }
 *      human-readable sentences ready to render
 *
 *  buildCategoryChartData(breakdown)
 *    → Chart.js-ready doughnut/pie dataset
 *
 *  buildTrendChartData(trend)
 *    → Chart.js-ready line chart datasets (income + expenses)
 *
 *  buildBarChartData(trend)
 *    → Chart.js-ready grouped bar chart datasets
 *
 *  buildIncomeExpenseRatio(summary)
 *    → Chart.js-ready doughnut showing income vs expenses
 *
 *  calculateHealthScore(summary, trend)
 *    → number 0–100 with a breakdown of contributing factors
 *
 *  getSpendingDNA(transactions)
 *    → object describing the user's spending personality
 *
 *  getCashFlowForecast(transactions, year, month)
 *    → { income, spent, upcomingFixed, safeToSpend }
 */

import { getAllTransactions, getAllCategories, getTransactionsByMonth } from './transactionService.js';

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 1 — MONTHLY SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * calculateMonthlySummary(transactions, year, month)
 *
 * Takes an array of transactions and filters to the requested month,
 * then sums income and expenses separately.
 *
 * Savings formula:
 *   Savings     = Income − Expenses
 *   Savings Rate = (Savings ÷ Income) × 100   [rounded to 1 decimal]
 *
 * @param {Array}  transactions  - full transaction array
 * @param {number} year          - e.g. 2026
 * @param {number} month         - 1 = January … 12 = December
 * @returns {object}
 */
export function calculateMonthlySummary(transactions, year, month) {
  const monthTxns = filterByMonth(transactions, year, month);

  let income   = 0;
  let expenses = 0;

  monthTxns.forEach(t => {
    if (t.type === 'income')        income   += t.amount;
    else if (t.type === 'expense')  expenses += t.amount;
    // 'transfer' is intentionally excluded from both totals
  });

  const savings     = income - expenses;
  const savingsRate = income > 0
    ? parseFloat(((savings / income) * 100).toFixed(1))
    : 0;

  return {
    income,
    expenses,
    savings,
    savingsRate,
    transactionCount: monthTxns.length,
    expenseTransactionCount: monthTxns.filter(t => t.type === 'expense').length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 2 — CATEGORY BREAKDOWN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getCategoryBreakdown(transactions, categories, year, month)
 *
 * For each spending category, calculates:
 *  - total amount spent
 *  - percentage of total spending
 *
 * Only considers EXPENSE transactions.
 * Results are sorted from highest to lowest spending.
 *
 * Example output item:
 * {
 *   id: 'food',
 *   name: 'Food',
 *   icon: '🍕',
 *   color: '#F0A500',
 *   total: 8400,
 *   percentage: 24.6,
 *   transactionCount: 12,
 * }
 *
 * @param {Array}  transactions - full transaction array
 * @param {Array}  categories   - categories array from DB
 * @param {number} year         - optional; if omitted, uses all time
 * @param {number} month        - optional
 */
export function getCategoryBreakdown(transactions, categories, year, month) {
  // Filter to the right period
  let txns = transactions;
  if (year && month) txns = filterByMonth(transactions, year, month);

  // Only count expenses
  const expenses = txns.filter(t => t.type === 'expense');
  const totalSpend = expenses.reduce((sum, t) => sum + t.amount, 0);

  // Group by category
  const catMap = {};
  expenses.forEach(t => {
    const key = t.category || 'other';
    if (!catMap[key]) catMap[key] = { total: 0, count: 0 };
    catMap[key].total += t.amount;
    catMap[key].count += 1;
  });

  // Merge with category metadata (name, icon, colour)
  const result = Object.entries(catMap).map(([id, data]) => {
    const meta = categories.find(c => c.id === id) || {
      id, name: capitalize(id), icon: '📦', color: '#5A6A8A',
    };
    return {
      id,
      name: meta.name,
      icon: meta.icon,
      color: meta.color,
      total: data.total,
      percentage: totalSpend > 0
        ? parseFloat(((data.total / totalSpend) * 100).toFixed(1))
        : 0,
      transactionCount: data.count,
    };
  });

  // Sort: highest spending first
  return result.sort((a, b) => b.total - a.total);
}

/**
 * getTopCategories(transactions, categories, n, year, month)
 * Same as getCategoryBreakdown but returns only the top N.
 * Remaining categories are merged into an "Others" entry.
 */
export function getTopCategories(transactions, categories, n = 5, year, month) {
  const all = getCategoryBreakdown(transactions, categories, year, month);
  if (all.length <= n) return all;

  const top = all.slice(0, n);
  const rest = all.slice(n);
  const othersTotal = rest.reduce((s, c) => s + c.total, 0);
  const totalSpend  = all.reduce((s, c) => s + c.total, 0);

  if (othersTotal > 0) {
    top.push({
      id: 'others',
      name: 'Others',
      icon: '📦',
      color: '#5A6A8A',
      total: othersTotal,
      percentage: totalSpend > 0
        ? parseFloat(((othersTotal / totalSpend) * 100).toFixed(1))
        : 0,
      transactionCount: rest.reduce((s, c) => s + c.transactionCount, 0),
    });
  }
  return top;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 3 — MONTHLY TREND
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getMonthlyTrend(transactions, monthCount)
 *
 * Returns one data point per month for the last `monthCount` months.
 * Each point contains income, expenses, and savings for that month.
 * The array is ordered oldest → newest (left to right on a chart).
 *
 * Example output (monthCount = 3, current month is March):
 * [
 *   { year:2026, month:1, label:'Jan', income:75000, expenses:38000, savings:37000 },
 *   { year:2026, month:2, label:'Feb', income:75000, expenses:36000, savings:39000 },
 *   { year:2026, month:3, label:'Mar', income:75000, expenses:34200, savings:40800 },
 * ]
 *
 * @param {Array}  transactions - full transaction array
 * @param {number} monthCount   - how many months back to include (default 7)
 */
export function getMonthlyTrend(transactions, monthCount = 7) {
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now  = new Date();
  const result = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    // Work backwards from the current month
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // getMonth() is 0-indexed

    const summary = calculateMonthlySummary(transactions, y, m);

    result.push({
      year:     y,
      month:    m,
      label:    MONTH_NAMES[m - 1],
      income:   summary.income,
      expenses: summary.expenses,
      savings:  summary.savings,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 4 — MONTHLY COMPARISON (current vs previous month)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getMonthlyComparison(transactions, year, month)
 *
 * Compares the requested month against the previous calendar month.
 *
 * Returns:
 * {
 *   current:  { income, expenses, savings, savingsRate },
 *   previous: { income, expenses, savings, savingsRate },
 *   changes: {
 *     income:   { amount: 5000, percent: 7.1, direction: 'up' },
 *     expenses: { amount: -3000, percent: -8.1, direction: 'down' },
 *     savings:  { amount: 8000, percent: 24.2, direction: 'up' },
 *   }
 * }
 *
 * "direction" is 'up', 'down', or 'flat'
 */
export function getMonthlyComparison(transactions, year, month) {
  // Figure out the previous month (handle January → December year rollback)
  const prevDate  = new Date(year, month - 2, 1); // month-2 because JS month is 0-indexed
  const prevYear  = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  const current  = calculateMonthlySummary(transactions, year, month);
  const previous = calculateMonthlySummary(transactions, prevYear, prevMonth);

  const changes = {
    income:   calcChange(previous.income,   current.income),
    expenses: calcChange(previous.expenses, current.expenses),
    savings:  calcChange(previous.savings,  current.savings),
  };

  return { current, previous, changes };
}

/**
 * calcChange(from, to)
 * Internal helper. Calculates the delta between two numbers.
 * Returns { amount, percent, direction }
 */
function calcChange(from, to) {
  const amount  = to - from;
  const percent = from !== 0
    ? parseFloat(((amount / Math.abs(from)) * 100).toFixed(1))
    : (to > 0 ? 100 : 0);
  const direction = amount > 1 ? 'up' : amount < -1 ? 'down' : 'flat';
  return { amount, percent, direction };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 5 — SPENDING INSIGHTS  (human-readable sentences)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateInsights(transactions, categories, year, month)
 *
 * Analyses the data and produces a list of plain-English observations.
 * Each insight has:
 *   id       — unique string
 *   text     — the sentence to display
 *   type     — 'positive' | 'warning' | 'info' | 'neutral'
 *   icon     — emoji to display alongside
 *   value    — optional number for badge display
 *
 * The insights are ordered by priority (most impactful first).
 */
export function generateInsights(transactions, categories, year, month) {
  const insights = [];
  const comparison = getMonthlyComparison(transactions, year, month);
  const { current, previous, changes } = comparison;
  const breakdown = getCategoryBreakdown(transactions, categories, year, month);

  // ── Insight 1: Overall spending vs last month ─────────────────────────────
  if (previous.expenses > 0) {
    const { percent, direction } = changes.expenses;
    if (direction === 'up' && percent > 5) {
      insights.push({
        id: 'overall_up',
        text: `You spent ${Math.abs(percent)}% more this month compared to last month.`,
        type: 'warning',
        icon: '📈',
        value: Math.abs(percent),
      });
    } else if (direction === 'down' && Math.abs(percent) > 5) {
      insights.push({
        id: 'overall_down',
        text: `Great discipline! You spent ${Math.abs(percent)}% less than last month.`,
        type: 'positive',
        icon: '🎯',
        value: Math.abs(percent),
      });
    } else {
      insights.push({
        id: 'overall_flat',
        text: `Your spending is consistent with last month — within ${Math.abs(percent)}%.`,
        type: 'neutral',
        icon: '📊',
        value: Math.abs(percent),
      });
    }
  }

  // ── Insight 2: Savings rate ───────────────────────────────────────────────
  if (current.income > 0) {
    const rate = current.savingsRate;
    if (rate >= 40) {
      insights.push({
        id: 'savings_excellent',
        text: `Excellent savings rate of ${rate}%! You're saving more than ₹${fmt(current.savings)} this month.`,
        type: 'positive',
        icon: '🏆',
        value: rate,
      });
    } else if (rate >= 20) {
      insights.push({
        id: 'savings_good',
        text: `Good savings rate of ${rate}%. The recommended target is 20–30%.`,
        type: 'positive',
        icon: '💰',
        value: rate,
      });
    } else if (rate > 0) {
      insights.push({
        id: 'savings_low',
        text: `Your savings rate is ${rate}%. Try targeting 20% — that's ₹${fmt(current.income * 0.2)} per month.`,
        type: 'warning',
        icon: '⚠️',
        value: rate,
      });
    } else if (rate < 0) {
      insights.push({
        id: 'savings_negative',
        text: `You've spent ₹${fmt(Math.abs(current.savings))} more than your income this month. Review your expenses.`,
        type: 'warning',
        icon: '🚨',
        value: rate,
      });
    }
  }

  // ── Insight 3: Top spending category ─────────────────────────────────────
  if (breakdown.length > 0) {
    const top = breakdown[0];

    // Compare this category to last month
    const prevBreakdown = getCategoryBreakdown(transactions, categories, ...prevMonthArgs(year, month));
    const prevTopCat    = prevBreakdown.find(c => c.id === top.id);

    if (prevTopCat && prevTopCat.total > 0) {
      const catChange = calcChange(prevTopCat.total, top.total);
      if (catChange.direction === 'up' && catChange.percent > 10) {
        insights.push({
          id: `cat_up_${top.id}`,
          text: `${top.icon} ${top.name} spending increased by ${Math.abs(catChange.percent)}% vs last month (₹${fmt(top.total)}).`,
          type: 'warning',
          icon: top.icon,
          value: catChange.percent,
        });
      } else if (catChange.direction === 'down' && Math.abs(catChange.percent) > 10) {
        insights.push({
          id: `cat_down_${top.id}`,
          text: `${top.icon} You cut ${top.name} spending by ${Math.abs(catChange.percent)}% this month. Good control!`,
          type: 'positive',
          icon: top.icon,
          value: catChange.percent,
        });
      }
    }

    if (top.percentage > 40) {
      insights.push({
        id: `cat_dominant_${top.id}`,
        text: `${top.name} makes up ${top.percentage}% of your total spending. Consider reviewing this category.`,
        type: 'info',
        icon: '🔍',
        value: top.percentage,
      });
    }
  }

  // ── Insight 4: Transaction frequency ─────────────────────────────────────
  if (current.transactionCount >= 3) {
    const dailyAvg = parseFloat((current.expenses / new Date().getDate()).toFixed(0));
    insights.push({
      id: 'daily_avg',
      text: `Your average daily spending this month is ₹${fmt(dailyAvg)}.`,
      type: 'info',
      icon: '📅',
      value: dailyAvg,
    });
  }

  // ── Insight 5: No income recorded ────────────────────────────────────────
  if (current.expenses > 0 && current.income === 0) {
    insights.push({
      id: 'no_income',
      text: `No income recorded this month. Add your salary or income source to see your savings rate.`,
      type: 'info',
      icon: '💼',
    });
  }

  // ── Insight 6: Spending-free days ─────────────────────────────────────────
  const currentMonthTxns = filterByMonth(transactions, year, month);
  const datesWithExpense  = new Set(
    currentMonthTxns.filter(t => t.type === 'expense').map(t => t.date)
  );
  const daysElapsed    = new Date().getDate();
  const noSpendDays    = daysElapsed - datesWithExpense.size;
  if (noSpendDays >= 3) {
    insights.push({
      id: 'no_spend_days',
      text: `You had ${noSpendDays} spending-free days this month. Keep it up!`,
      type: 'positive',
      icon: '🌿',
      value: noSpendDays,
    });
  }

  // Return at most 5 insights, most impactful first
  return insights.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 6 — CHART DATA BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildCategoryChartData(breakdown)
 *
 * Converts a getCategoryBreakdown() result into a Chart.js-ready
 * dataset for a doughnut or pie chart.
 *
 * @param {Array} breakdown - from getCategoryBreakdown() or getTopCategories()
 * @returns {object} Chart.js `data` object
 */
export function buildCategoryChartData(breakdown) {
  if (!breakdown || breakdown.length === 0) return null;

  return {
    labels: breakdown.map(c => c.name),
    datasets: [{
      data:            breakdown.map(c => c.total),
      backgroundColor: breakdown.map(c => c.color + 'CC'),  // CC = 80% opacity
      borderColor:     breakdown.map(c => c.color),
      borderWidth:     1.5,
      hoverBorderWidth: 2.5,
      hoverOffset:     6,
    }],
  };
}

/**
 * buildTrendChartData(trend)
 *
 * Converts a getMonthlyTrend() result into a Chart.js line chart dataset.
 * Produces two lines: income (green) and expenses (red).
 *
 * @param {Array} trend - from getMonthlyTrend()
 * @returns {object} Chart.js `data` object
 */
export function buildTrendChartData(trend) {
  if (!trend || trend.length === 0) return null;

  const labels = trend.map(p => p.label);

  return {
    labels,
    datasets: [
      {
        label:                'Income',
        data:                 trend.map(p => p.income),
        borderColor:          '#06D6A0',
        backgroundColor:      'rgba(6, 214, 160, 0.08)',
        fill:                 true,
        tension:              0.4,
        pointRadius:          4,
        pointHoverRadius:     6,
        pointBackgroundColor: '#06D6A0',
        pointBorderColor:     '#080C18',
        pointBorderWidth:     2,
        borderWidth:          2.5,
      },
      {
        label:                'Expenses',
        data:                 trend.map(p => p.expenses),
        borderColor:          '#FF6B6B',
        backgroundColor:      'rgba(255, 107, 107, 0.08)',
        fill:                 true,
        tension:              0.4,
        pointRadius:          4,
        pointHoverRadius:     6,
        pointBackgroundColor: '#FF6B6B',
        pointBorderColor:     '#080C18',
        pointBorderWidth:     2,
        borderWidth:          2.5,
      },
    ],
  };
}

/**
 * buildSavingsTrendData(trend)
 *
 * Single-line chart showing just savings over time.
 * The fill turns green when positive, muted when negative.
 */
export function buildSavingsTrendData(trend) {
  if (!trend || trend.length === 0) return null;

  return {
    labels: trend.map(p => p.label),
    datasets: [{
      label:                'Savings',
      data:                 trend.map(p => p.savings),
      borderColor:          '#F0A500',
      backgroundColor:      'rgba(240, 165, 0, 0.1)',
      fill:                 true,
      tension:              0.4,
      pointRadius:          4,
      pointHoverRadius:     6,
      pointBackgroundColor: '#F0A500',
      pointBorderColor:     '#080C18',
      pointBorderWidth:     2,
      borderWidth:          2.5,
    }],
  };
}

/**
 * buildBarChartData(trend)
 *
 * Converts trend data into a grouped bar chart (income vs expenses side by side).
 */
export function buildBarChartData(trend) {
  if (!trend || trend.length === 0) return null;

  return {
    labels: trend.map(p => p.label),
    datasets: [
      {
        label:           'Income',
        data:            trend.map(p => p.income),
        backgroundColor: 'rgba(6, 214, 160, 0.75)',
        borderColor:     '#06D6A0',
        borderWidth:     1,
        borderRadius:    6,
        borderSkipped:   false,
      },
      {
        label:           'Expenses',
        data:            trend.map(p => p.expenses),
        backgroundColor: 'rgba(255, 107, 107, 0.75)',
        borderColor:     '#FF6B6B',
        borderWidth:     1,
        borderRadius:    6,
        borderSkipped:   false,
      },
    ],
  };
}

/**
 * buildIncomeExpenseRatio(summary)
 *
 * Simple two-slice doughnut showing how much of income was spent.
 * Used on the dashboard summary card.
 */
export function buildIncomeExpenseRatio(summary) {
  if (!summary || summary.income === 0) return null;

  const spent   = Math.min(summary.expenses, summary.income);
  const saved   = Math.max(0, summary.income - summary.expenses);

  return {
    labels: ['Spent', 'Saved'],
    datasets: [{
      data:            [spent, saved],
      backgroundColor: ['rgba(255,107,107,0.8)', 'rgba(6,214,160,0.8)'],
      borderColor:     ['#FF6B6B', '#06D6A0'],
      borderWidth:     1.5,
    }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 7 — HEALTH SCORE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * calculateHealthScore(summary, trend)
 *
 * Produces a 0–100 score with contributing factor breakdown.
 *
 * Scoring components (each worth up to 25 points):
 *   Savings rate    — 25 pts if ≥30%, 15 pts if ≥15%, 5 pts if >0
 *   Budget control  — 25 pts if expenses < 70% of income
 *   Consistency     — 25 pts if variance between months is low
 *   Activity        — 25 pts for having enough tracked transactions
 *
 * @param {object} summary  - from calculateMonthlySummary()
 * @param {Array}  trend    - from getMonthlyTrend()
 * @returns {{ score, grade, factors }}
 */
export function calculateHealthScore(summary, trend) {
  const factors = [];
  let totalScore = 0;

  // ── Component 1: Savings rate (25 pts) ───────────────────
  const savingsRate = summary.savingsRate || 0;
  let savingsPts = 0;
  if      (savingsRate >= 30) savingsPts = 25;
  else if (savingsRate >= 20) savingsPts = 20;
  else if (savingsRate >= 10) savingsPts = 12;
  else if (savingsRate > 0)   savingsPts = 6;
  else if (savingsRate < 0)   savingsPts = 0;
  totalScore += savingsPts;
  factors.push({
    label: 'Savings rate',
    score: savingsPts,
    max:   25,
    note:  savingsRate >= 20 ? 'On target' : savingsRate > 0 ? 'Below target' : 'Spending over income',
  });

  // ── Component 2: Budget control (25 pts) ─────────────────
  let budgetPts = 0;
  if (summary.income > 0) {
    const spendRatio = summary.expenses / summary.income;
    if      (spendRatio <= 0.50) budgetPts = 25;
    else if (spendRatio <= 0.65) budgetPts = 20;
    else if (spendRatio <= 0.80) budgetPts = 12;
    else if (spendRatio <= 1.00) budgetPts = 6;
    else                          budgetPts = 0;
  }
  totalScore += budgetPts;
  factors.push({
    label: 'Spending control',
    score: budgetPts,
    max:   25,
    note:  budgetPts >= 20 ? 'Well controlled' : budgetPts >= 10 ? 'Manageable' : 'Overspending risk',
  });

  // ── Component 3: Trend consistency (25 pts) ───────────────
  let consistencyPts = 0;
  if (trend && trend.length >= 2) {
    const expenseSeries = trend.filter(p => p.expenses > 0).map(p => p.expenses);
    if (expenseSeries.length >= 2) {
      const avg = expenseSeries.reduce((s, v) => s + v, 0) / expenseSeries.length;
      const variance = expenseSeries.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / expenseSeries.length;
      const stdDev   = Math.sqrt(variance);
      const cv = avg > 0 ? stdDev / avg : 1; // coefficient of variation (lower = more consistent)

      if      (cv < 0.10) consistencyPts = 25;
      else if (cv < 0.20) consistencyPts = 20;
      else if (cv < 0.35) consistencyPts = 12;
      else                 consistencyPts = 5;
    }
  } else {
    consistencyPts = 10; // neutral if not enough data
  }
  totalScore += consistencyPts;
  factors.push({
    label: 'Monthly consistency',
    score: consistencyPts,
    max:   25,
    note:  consistencyPts >= 20 ? 'Very consistent' : consistencyPts >= 10 ? 'Some variation' : 'High volatility',
  });

  // ── Component 4: Activity / tracking (25 pts) ────────────
  const txnCount = summary.transactionCount || 0;
  let activityPts = 0;
  if      (txnCount >= 20) activityPts = 25;
  else if (txnCount >= 10) activityPts = 20;
  else if (txnCount >= 5)  activityPts = 12;
  else if (txnCount >= 1)  activityPts = 6;
  totalScore += activityPts;
  factors.push({
    label: 'Tracking activity',
    score: activityPts,
    max:   25,
    note:  activityPts >= 20 ? 'Well tracked' : txnCount === 0 ? 'Add transactions' : 'Keep recording',
  });

  // ── Grade ─────────────────────────────────────────────────
  const score = Math.min(100, Math.round(totalScore));
  const grade = score >= 85 ? 'A'
    : score >= 70 ? 'B'
    : score >= 55 ? 'C'
    : score >= 40 ? 'D'
    : 'F';

  return { score, grade, factors };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 8 — SPENDING DNA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getSpendingDNA(transactions, categories, year, month)
 *
 * Analyses what kind of spender the user is.
 * Returns 4 behavioural dimensions as 0–100 scores.
 *
 * Dimensions:
 *   Saver tendency    — how much of income is preserved
 *   Lifestyle spend   — discretionary vs essential spending ratio
 *   Impulse purchases — frequency of small, unplanned purchases
 *   Fixed discipline  — consistency in paying recurring bills on time
 */
export function getSpendingDNA(transactions, categories, year, month) {
  const txns = filterByMonth(transactions, year, month);
  const expenses = txns.filter(t => t.type === 'expense');
  const income   = txns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExp = expenses.reduce((s, t) => s + t.amount, 0);

  // Categorise each expense as essential vs discretionary
  const ESSENTIAL_CATS    = new Set(['rent','bills','health','groceries','education']);
  const DISCRETIONARY_CATS = new Set(['food','shopping','entertainment','transport']);

  const essentialTotal     = expenses.filter(t => ESSENTIAL_CATS.has(t.category)).reduce((s, t) => s + t.amount, 0);
  const discretionaryTotal = expenses.filter(t => DISCRETIONARY_CATS.has(t.category)).reduce((s, t) => s + t.amount, 0);

  // Saver tendency: 0 = spent everything, 100 = saved everything
  const saverScore = income > 0
    ? Math.max(0, Math.min(100, Math.round(((income - totalExp) / income) * 100 + 50)))
    : 50;

  // Lifestyle score: how much is discretionary out of total spending
  const lifestyleScore = totalExp > 0
    ? Math.round((discretionaryTotal / totalExp) * 100)
    : 30;

  // Impulse score: small transactions (< ₹500) as a % of all transactions
  const smallTxns    = expenses.filter(t => t.amount < 500).length;
  const impulseScore = expenses.length > 0
    ? Math.round((smallTxns / expenses.length) * 100)
    : 20;

  // Fixed discipline: essential spending regularity
  const fixedScore = totalExp > 0
    ? Math.round((essentialTotal / totalExp) * 100)
    : 50;

  return [
    { label: 'Saver tendency',    value: saverScore,    color: '#06D6A0', icon: '💰' },
    { label: 'Lifestyle spending', value: lifestyleScore, color: '#F0A500', icon: '✨' },
    { label: 'Impulse purchases',  value: impulseScore,   color: '#FF6B6B', icon: '⚡' },
    { label: 'Fixed discipline',   value: fixedScore,     color: '#4CC9F0', icon: '📌' },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 9 — CASH FLOW FORECAST
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getCashFlowForecast(transactions, year, month)
 *
 * Projects safe remaining spend for the rest of the month.
 *
 * Formula:
 *   Safe to spend = Income − Spent so far − Estimated upcoming fixed expenses
 *
 * "Upcoming fixed expenses" = recurring categories not yet paid this month
 *   estimated from previous month's spending in those categories.
 */
export function getCashFlowForecast(transactions, year, month) {
  const currentTxns  = filterByMonth(transactions, year, month);
  const income       = currentTxns.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const spent        = currentTxns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // Estimate upcoming recurring expenses from last month's bills/rent
  const prevDate    = new Date(year, month - 2, 1);
  const prevTxns    = filterByMonth(transactions, prevDate.getFullYear(), prevDate.getMonth() + 1);
  const recurringCats = ['rent', 'bills'];
  const upcomingFixed = prevTxns
    .filter(t => t.type === 'expense' && recurringCats.includes(t.category))
    // Only count if this month hasn't already paid that category
    .filter(t => !currentTxns.some(c => c.type === 'expense' && c.category === t.category))
    .reduce((s, t) => s + t.amount, 0);

  const safeToSpend = Math.max(0, income - spent - upcomingFixed);

  // What percentage of the month has passed
  const today          = new Date();
  const daysInMonth    = new Date(year, month, 0).getDate();
  const daysPassed     = today.getDate();
  const monthProgress  = parseFloat(((daysPassed / daysInMonth) * 100).toFixed(0));

  // Are we on track? (Spending should scale with days passed)
  const expectedSpend  = income > 0 ? income * (daysPassed / daysInMonth) : 0;
  const onTrack        = expectedSpend === 0 || spent <= expectedSpend * 1.1;

  return {
    income,
    spent,
    upcomingFixed,
    safeToSpend,
    monthProgress,
    onTrack,
    daysLeft: daysInMonth - daysPassed,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  SECTION 10 — AGGREGATE (one function to call all of the above)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getFullAnalytics(transactions, categories)
 *
 * Convenience function: runs ALL analytics in one pass for the current month.
 *
 * The Dashboard and Analytics page call this once and destructure what they need.
 * This avoids running filterByMonth() multiple times separately.
 *
 * Returns:
 * {
 *   summary, breakdown, topCategories, trend,
 *   comparison, insights, healthScore,
 *   spendingDNA, forecast,
 *   charts: { category, trend, bar, savings, ratio }
 * }
 */
export function getFullAnalytics(transactions, categories) {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1;

  const summary      = calculateMonthlySummary(transactions, year, month);
  const breakdown    = getCategoryBreakdown(transactions, categories, year, month);
  const topCategories = getTopCategories(transactions, categories, 5, year, month);
  const trend        = getMonthlyTrend(transactions, 7);
  const comparison   = getMonthlyComparison(transactions, year, month);
  const insights     = generateInsights(transactions, categories, year, month);
  const healthScore  = calculateHealthScore(summary, trend);
  const spendingDNA  = getSpendingDNA(transactions, categories, year, month);
  const forecast     = getCashFlowForecast(transactions, year, month);

  // Pre-built chart datasets
  const charts = {
    category: buildCategoryChartData(topCategories),
    trend:     buildTrendChartData(trend),
    bar:       buildBarChartData(trend),
    savings:   buildSavingsTrendData(trend),
    ratio:     buildIncomeExpenseRatio(summary),
  };

  return {
    summary,
    breakdown,
    topCategories,
    trend,
    comparison,
    insights,
    healthScore,
    spendingDNA,
    forecast,
    charts,
    year,
    month,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Filter transactions to a specific year+month */
function filterByMonth(transactions, year, month) {
  return transactions.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date + 'T00:00:00');
    return d.getFullYear() === year && (d.getMonth() + 1) === month;
  });
}

/** Get year/month of the previous calendar month as array [year, month] */
function prevMonthArgs(year, month) {
  const d = new Date(year, month - 2, 1);
  return [d.getFullYear(), d.getMonth() + 1];
}

/** Capitalise first letter */
function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

/** Format number as ₹ string (no symbol — caller adds it) */
function fmt(n) {
  return Math.abs(n).toLocaleString('en-IN');
}
