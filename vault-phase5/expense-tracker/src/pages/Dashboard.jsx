/**
 * VAULT — DASHBOARD
 *
 * Reads real data from IndexedDB via the AppContext (useApp hook).
 * Falls back to an "empty / welcome" state when no data exists yet.
 */

import React from 'react';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler,
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { useApp } from '../context/AppContext';
import { useAnalytics } from '../hooks/useAnalytics';
import { MOCK_MONTHLY_TREND } from '../utils/mockData'; // fallback until multi-month data exists

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler);

const fmt = (n) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

const CHART_TOOLTIP = {
  backgroundColor: '#0F1629',
  borderColor: '#1E2D4F',
  borderWidth: 1,
  titleColor: '#E8EEFF',
  bodyColor: '#8899BB',
  padding: 10,
  callbacks: { label: (ctx) => ` ₹${ctx.raw.toLocaleString('en-IN')}` },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthRing({ score }) {
  const r = 32, circ = 2 * Math.PI * r;
  const color = score >= 75 ? '#06D6A0' : score >= 50 ? '#F0A500' : '#FF6B6B';
  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#1E2D4F" strokeWidth="6"/>
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circ} strokeDashoffset={circ - (score / 100) * circ}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold leading-none" style={{ color, fontFamily: 'JetBrains Mono, monospace' }}>{score}</span>
        <span className="text-[8px] leading-none mt-0.5" style={{ color: '#5A6A8A' }}>SCORE</span>
      </div>
    </div>
  );
}

// Welcome card shown when there are no transactions at all
function WelcomeCard({ onAdd }) {
  return (
    <div className="px-5 py-8 flex flex-col items-center text-center gap-4">
      <div
        className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
        style={{ background: 'linear-gradient(135deg,rgba(240,165,0,0.15),rgba(240,165,0,0.05))', border: '1px solid rgba(240,165,0,0.2)' }}
      >
        🏦
      </div>
      <div>
        <h2 className="text-xl mb-2" style={{ fontFamily: 'DM Serif Display, serif' }}>Welcome to Vault</h2>
        <p className="text-sm leading-relaxed" style={{ color: '#8899BB' }}>
          Your private finance companion.<br/>Add your first transaction to get started.
        </p>
      </div>
      <button
        onClick={onAdd}
        className="mt-1 px-8 py-4 rounded-2xl font-semibold text-base tap-active"
        style={{ background: 'linear-gradient(135deg,#F0A500,#FFD166)', color: '#080C18', boxShadow: '0 4px 20px rgba(240,165,0,0.35)' }}
      >
        + Add First Transaction
      </button>
      <div className="flex flex-col items-start gap-2 w-full mt-2 p-4 rounded-2xl" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: '#8899BB' }}>Quick Entry examples:</p>
        {['450 food swiggy', '1200 groceries bigbasket', '75000 salary'].map(ex => (
          <div key={ex} className="flex items-center gap-2">
            <span style={{ color: '#F0A500' }}>⚡</span>
            <code className="text-xs" style={{ color: '#C0CDE8', fontFamily: 'JetBrains Mono' }}>{ex}</code>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { summary, transactions, categories, loading, openAddModal } = useApp();
  // Pull analytics from Phase 3 service — provides charts, insights, health score, etc.
  const analytics = useAnalytics();

  const hasData    = transactions.length > 0;
  const recentTxns = transactions.slice(0, 8);

  // Use analytics service for category breakdown (replaces manual byCategory calc)
  const catChartData = React.useMemo(() => {
    if (!analytics.topCategories || analytics.topCategories.length === 0) return null;
    return {
      labels: analytics.topCategories.map(c => c.name),
      colors: analytics.topCategories.map(c => c.color),
      values: analytics.topCategories.map(c => c.total),
    };
  }, [analytics.topCategories]);

  // Doughnut chart
  const doughnutData = catChartData ? {
    labels: catChartData.labels,
    datasets: [{
      data: catChartData.values,
      backgroundColor: catChartData.colors.map(c => c + 'CC'),
      borderColor: catChartData.colors,
      borderWidth: 1.5,
    }],
  } : null;

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: true, cutout: '68%',
    plugins: { legend: { display: false }, tooltip: CHART_TOOLTIP },
  };

  // Line chart: use real trend from analytics if data exists, else show mock shape with label
  const trendHasRealData = analytics.trend && analytics.trend.some(p => p.income > 0 || p.expenses > 0);

  const lineData = trendHasRealData && analytics.charts.trend
    ? analytics.charts.trend
    : {
    labels: MOCK_MONTHLY_TREND.map(m => m.month),
    datasets: [
      {
        label: 'Income', data: MOCK_MONTHLY_TREND.map(m => m.income),
        borderColor: '#06D6A0', backgroundColor: 'rgba(6,214,160,0.08)',
        fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#06D6A0', borderWidth: 2,
      },
      {
        label: 'Expenses', data: MOCK_MONTHLY_TREND.map(m => m.expense),
        borderColor: '#FF6B6B', backgroundColor: 'rgba(255,107,107,0.08)',
        fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#FF6B6B', borderWidth: 2,
      },
    ],
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#8899BB', usePointStyle: true, font: { size: 11 } } },
      tooltip: CHART_TOOLTIP,
    },
    scales: {
      x: { grid: { color: 'rgba(30,45,79,0.5)' }, ticks: { color: '#5A6A8A', font: { size: 11 } }, border: { display: false } },
      y: { grid: { color: 'rgba(30,45,79,0.5)' }, ticks: { color: '#5A6A8A', font: { size: 10 }, callback: v => `₹${(v/1000).toFixed(0)}k` }, border: { display: false } },
    },
  };

  // Group recent transactions by date label
  const grouped = recentTxns.reduce((acc, t) => {
    const d = new Date(t.date + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const label = d.toDateString() === today.toDateString() ? 'Today'
      : d.toDateString() === yesterday.toDateString() ? 'Yesterday'
      : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (!acc[label]) acc[label] = [];
    acc[label].push(t);
    return acc;
  }, {});

  // Use the analytics service for health score and forecast (Phase 3 upgrade)
  const healthScore   = analytics.hasData ? analytics.healthScore.score : 0;
  const healthGrade   = analytics.hasData ? analytics.healthScore.grade : '—';
  const safeToSpend   = analytics.hasData ? analytics.forecast.safeToSpend : 0;
  const analyticsInsights = analytics.insights || [];

  return (
    <div className="page-enter pb-24">
      {/* Header */}
      <div className="px-5 pt-14 pb-6 relative overflow-hidden" style={{ background: 'linear-gradient(180deg,#0F1629 0%,#080C18 100%)' }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle,#F0A500,transparent)' }}
        />
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-sm mb-1" style={{ color: '#5A6A8A' }}>
              {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <h1 className="text-3xl leading-tight" style={{ fontFamily: 'DM Serif Display, serif', color: '#E8EEFF' }}>
              {hasData ? 'Your Finances' : 'Welcome'}
            </h1>
          </div>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg,#F0A500,#FFD166)', color: '#080C18' }}>
            V
          </div>
        </div>

        {/* Main balance card */}
        {hasData ? (
          <div className="rounded-2xl p-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(145deg,#151E35,#0F1629)', border: '1px solid #1E2D4F', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div className="absolute inset-0 opacity-5 pointer-events-none"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg,#F0A500 0,#F0A500 1px,transparent 0,transparent 50%)', backgroundSize: '20px 20px' }}
            />
            <div className="relative">
              <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#5A6A8A', letterSpacing: '0.15em' }}>Monthly Savings</p>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-light" style={{ fontFamily: 'DM Serif Display, serif', color: '#E8EEFF' }}>
                  {fmt(summary.savings)}
                </span>
                <span className="text-sm mb-1 px-2 py-0.5 rounded-full"
                  style={{ background: summary.savings >= 0 ? 'rgba(6,214,160,0.15)' : 'rgba(255,107,107,0.15)', color: summary.savings >= 0 ? '#06D6A0' : '#FF6B6B' }}>
                  {summary.savingsRate}%
                </span>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 rounded-2xl p-3.5" style={{ background: 'rgba(6,214,160,0.06)', border: '1px solid rgba(6,214,160,0.15)' }}>
                  <div className="text-lg mb-1">↑</div>
                  <div className="text-xs mb-1" style={{ color: '#5A6A8A' }}>Income</div>
                  <div className="font-semibold text-sm" style={{ color: '#06D6A0', fontFamily: 'JetBrains Mono' }}>{fmt(summary.income)}</div>
                </div>
                <div className="flex-1 rounded-2xl p-3.5" style={{ background: 'rgba(255,107,107,0.06)', border: '1px solid rgba(255,107,107,0.15)' }}>
                  <div className="text-lg mb-1">↓</div>
                  <div className="text-xs mb-1" style={{ color: '#5A6A8A' }}>Expenses</div>
                  <div className="font-semibold text-sm" style={{ color: '#FF6B6B', fontFamily: 'JetBrains Mono' }}>{fmt(summary.expenses)}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'rgba(240,165,0,0.06)', border: '1px dashed rgba(240,165,0,0.3)' }}>
            <span className="text-2xl">💡</span>
            <p className="text-sm" style={{ color: '#8899BB' }}>Add transactions to see your financial summary here.</p>
          </div>
        )}
      </div>

      <div className="px-5 space-y-5">
        {/* Empty / Welcome */}
        {!hasData && !loading && <WelcomeCard onAdd={() => openAddModal()} />}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12 gap-3">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1E2D4F', borderTopColor: '#F0A500' }} />
            <span className="text-sm" style={{ color: '#5A6A8A' }}>Loading your data...</span>
          </div>
        )}

        {/* Health + Safe to spend */}
        {hasData && (
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
              <p className="text-xs mb-3" style={{ color: '#5A6A8A' }}>Health Score</p>
              <div className="flex items-center gap-3">
                <HealthRing score={healthScore} />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium" style={{ color: '#E8EEFF' }}>
                      {healthScore >= 75 ? 'Excellent' : healthScore >= 50 ? 'Good' : 'Needs work'}
                    </p>
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{
                      background: 'rgba(240,165,0,0.15)', color: '#F0A500',
                      fontFamily: 'JetBrains Mono',
                    }}>
                      {healthGrade}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: '#5A6A8A' }}>
                    {summary.savingsRate}% savings rate
                  </p>
                </div>
              </div>
            </div>
            <div className="flex-1 rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
              <p className="text-xs mb-3" style={{ color: '#5A6A8A' }}>Safe to Spend</p>
              <p className="text-2xl font-light mb-1" style={{ fontFamily: 'DM Serif Display, serif', color: '#4CC9F0' }}>
                {fmt(safeToSpend)}
              </p>
              <div className="w-full rounded-full h-1.5" style={{ background: '#1E2D4F' }}>
                <div className="h-full rounded-full" style={{
                  width: summary.income > 0 ? `${Math.min(100, (summary.expenses / summary.income) * 100)}%` : '0%',
                  background: 'linear-gradient(90deg,#06D6A0,#4CC9F0)',
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {hasData && doughnutData && (
          <div className="rounded-2xl p-5" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#8899BB' }}>Spending by Category</h3>
            <div className="flex gap-5 items-center">
              <div className="w-28 h-28 flex-shrink-0">
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
              <div className="flex-1 space-y-2">
                {catChartData.labels.map((label, i) => {
                  const total = catChartData.values.reduce((a, v) => a + v, 0);
                  const pct = total > 0 ? Math.round((catChartData.values[i] / total) * 100) : 0;
                  return (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span style={{ color: '#C0CDE8' }}>
                          {categories.find(c => c.name === label)?.icon || '📦'} {label}
                        </span>
                        <span style={{ color: '#8899BB', fontFamily: 'JetBrains Mono' }}>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: '#1E2D4F' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: catChartData.colors[i] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Monthly Trend — always shown for context */}
        <div className="rounded-2xl p-5" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: '#8899BB' }}>Monthly Trend</h3>
            {!trendHasRealData && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#151E35', color: '#5A6A8A' }}>Sample data</span>}
          </div>
          <div style={{ height: '160px' }}>
            <Line data={lineData} options={lineOptions} />
          </div>
        </div>

        {/* Smart Insights from analyticsService — only shown when real data exists */}
        {hasData && analyticsInsights.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: '#8899BB' }}>Smart Insights</h3>
              <span className="text-xs" style={{ color: '#5A6A8A' }}>{analyticsInsights.length} this month</span>
            </div>
            <div className="space-y-2">
              {analyticsInsights.map(insight => {
                const colours = {
                  positive: { bg: 'rgba(6,214,160,0.08)',  border: 'rgba(6,214,160,0.2)' },
                  warning:  { bg: 'rgba(240,165,0,0.08)',  border: 'rgba(240,165,0,0.2)' },
                  info:     { bg: 'rgba(76,201,240,0.08)', border: 'rgba(76,201,240,0.2)' },
                  neutral:  { bg: 'rgba(30,45,79,0.4)',    border: 'rgba(30,45,79,0.8)'  },
                };
                const c = colours[insight.type] || colours.neutral;
                return (
                  <div key={insight.id} className="flex items-start gap-3 p-3.5 rounded-xl"
                    style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                    <span className="text-base flex-shrink-0 mt-0.5">{insight.icon}</span>
                    <p className="text-sm leading-snug" style={{ color: '#C0CDE8' }}>{insight.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        {hasData && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: '#8899BB' }}>Recent</h3>
              <button className="text-xs tap-active" style={{ color: '#F0A500' }}>
                {transactions.length} total
              </button>
            </div>
            {Object.entries(grouped).map(([dateLabel, txns]) => (
              <div key={dateLabel} className="mb-4">
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#5A6A8A', letterSpacing: '0.1em' }}>{dateLabel}</p>
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1E2D4F' }}>
                  {txns.map((txn, i) => (
                    <div key={txn.id}
                      className="flex items-center gap-3 px-4 py-3.5 tap-active"
                      onClick={() => openAddModal(txn)}
                      style={{ background: '#0F1629', borderTop: i > 0 ? '1px solid #1E2D4F' : 'none' }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: '#151E35' }}>
                        {categories.find(c => c.id === txn.category)?.icon || '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#E8EEFF' }}>
                          {txn.merchant || txn.category || 'Transaction'}
                        </p>
                        <p className="text-xs" style={{ color: '#5A6A8A' }}>{txn.category}</p>
                      </div>
                      <span className="font-medium text-sm flex-shrink-0"
                        style={{ color: txn.type === 'income' ? '#06D6A0' : '#FF6B6B', fontFamily: 'JetBrains Mono' }}>
                        {txn.type === 'income' ? '+' : '−'}{fmt(txn.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Privacy badge */}
        <div className="flex items-center gap-3 p-4 rounded-2xl mb-2"
          style={{ background: 'rgba(6,214,160,0.06)', border: '1px solid rgba(6,214,160,0.15)' }}>
          <span className="text-xl">🔒</span>
          <div>
            <p className="text-xs font-medium" style={{ color: '#06D6A0' }}>100% Private</p>
            <p className="text-xs" style={{ color: '#5A6A8A' }}>
              {hasData ? `${transactions.length} transactions stored locally on your device` : 'All data stored locally on your device'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
