/**
 * VAULT — ANALYTICS PAGE  (Phase 3)
 *
 * Reads all data from useAnalytics() hook (which calls analyticsService).
 * Renders five chart types + category table + spending DNA + insights.
 * Zero calculations happen here — this page only renders what the service computes.
 */

import React, { useState } from 'react';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { useAnalytics } from '../hooks/useAnalytics';
import { useApp } from '../context/AppContext';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler);

// ── Shared chart style defaults ───────────────────────────────────────────────
const TOOLTIP_STYLE = {
  backgroundColor: '#0F1629',
  borderColor:     '#1E2D4F',
  borderWidth:     1,
  titleColor:      '#E8EEFF',
  bodyColor:       '#8899BB',
  padding:         12,
  cornerRadius:    10,
  callbacks: {
    label: (ctx) => `  ₹${Number(ctx.raw).toLocaleString('en-IN')}`,
  },
};

const AXIS_STYLE = {
  x: {
    grid:   { color: 'rgba(30,45,79,0.5)', drawBorder: false },
    ticks:  { color: '#5A6A8A', font: { size: 11, family: 'DM Sans' } },
    border: { display: false },
  },
  y: {
    grid:   { color: 'rgba(30,45,79,0.5)', drawBorder: false },
    ticks:  { color: '#5A6A8A', font: { size: 10 }, callback: (v) => `₹${(v/1000).toFixed(0)}k` },
    border: { display: false },
  },
};

const fmt = (n) => `₹${Math.abs(n).toLocaleString('en-IN')}`;

// ── Period selector options ───────────────────────────────────────────────────
const PERIODS = [
  { id: '3m',   label: '3M' },
  { id: '6m',   label: '6M' },
  { id: 'year', label: '1Y' },
];

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview',    label: 'Overview',    icon: '📊' },
  { id: 'categories',  label: 'Categories',  icon: '🏷️' },
  { id: 'trends',      label: 'Trends',      icon: '📈' },
  { id: 'insights',    label: 'Insights',    icon: '💡' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs" style={{ color: '#5A6A8A' }}>{label}</p>
        <span className="text-base">{icon}</span>
      </div>
      <p className="font-semibold text-base leading-tight" style={{ color: color || '#E8EEFF', fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </p>
      {sub && <p className="text-[10px] mt-1" style={{ color: '#5A6A8A' }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, badge, children }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: '#8899BB' }}>{title}</h3>
        {badge && (
          <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: '#151E35', color: '#5A6A8A' }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ComparisonBadge({ change }) {
  if (!change || change.direction === 'flat') {
    return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#151E35', color: '#5A6A8A' }}>—</span>;
  }
  const up   = change.direction === 'up';
  const pct  = Math.abs(change.percent);
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
      background: up ? 'rgba(255,107,107,0.12)' : 'rgba(6,214,160,0.12)',
      color: up ? '#FF6B6B' : '#06D6A0',
    }}>
      {up ? '↑' : '↓'} {pct}%
    </span>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10">
      <span className="text-4xl opacity-30">📊</span>
      <p className="text-sm text-center" style={{ color: '#5A6A8A' }}>{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  OVERVIEW TAB
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ analytics }) {
  const { summary, comparison, charts, healthScore, forecast } = analytics;

  const barOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'top', labels: { color: '#8899BB', font: { size: 11 }, usePointStyle: true } }, tooltip: TOOLTIP_STYLE },
    scales: AXIS_STYLE,
  };

  const ratioOptions = {
    responsive: true, maintainAspectRatio: true,
    cutout: '72%',
    plugins: { legend: { display: false }, tooltip: TOOLTIP_STYLE },
  };

  return (
    <div className="space-y-5">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="Income"    value={fmt(summary.income)}   color="#06D6A0" icon="↑"
          sub={comparison.changes.income?.direction !== 'flat' ? `${comparison.changes.income?.percent > 0 ? '+' : ''}${comparison.changes.income?.percent}% vs last month` : 'vs last month'} />
        <KpiCard label="Expenses"  value={fmt(summary.expenses)} color="#FF6B6B" icon="↓"
          sub={`${comparison.changes.expenses?.percent > 0 ? '+' : ''}${comparison.changes.expenses?.percent ?? 0}% vs last month`} />
        <KpiCard label="Savings"   value={fmt(summary.savings)}  color={summary.savings >= 0 ? '#06D6A0' : '#FF6B6B'} icon="💰"
          sub={`${summary.savingsRate}% rate`} />
        <KpiCard label="Health Score" value={`${healthScore.score}/100`} color={healthScore.score >= 75 ? '#06D6A0' : healthScore.score >= 50 ? '#F0A500' : '#FF6B6B'} icon="❤️"
          sub={`Grade ${healthScore.grade}`} />
      </div>

      {/* Income vs Expenses bar chart */}
      <SectionCard title="Income vs Expenses" badge="7 months">
        {charts.bar ? (
          <div style={{ height: '200px' }}>
            <Bar data={charts.bar} options={barOptions} />
          </div>
        ) : <EmptyChart message="Add income and expense transactions to see comparison" />}
      </SectionCard>

      {/* Ratio ring + cash flow */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-2xl p-4 flex flex-col items-center justify-center" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <p className="text-xs mb-3" style={{ color: '#5A6A8A' }}>Spent vs Saved</p>
          {charts.ratio ? (
            <div style={{ width: '110px', height: '110px', position: 'relative' }}>
              <Doughnut data={charts.ratio} options={ratioOptions} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-medium" style={{ color: '#E8EEFF', fontFamily: 'JetBrains Mono' }}>
                  {summary.savingsRate}%
                </span>
              </div>
            </div>
          ) : <EmptyChart message="—" />}
          <div className="flex gap-3 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#FF6B6B' }} />
              <span className="text-[10px]" style={{ color: '#5A6A8A' }}>Spent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: '#06D6A0' }} />
              <span className="text-[10px]" style={{ color: '#5A6A8A' }}>Saved</span>
            </div>
          </div>
        </div>

        <div className="flex-1 rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          <p className="text-xs mb-3" style={{ color: '#5A6A8A' }}>Cash Flow Forecast</p>
          <p className="text-2xl font-light mb-1" style={{ fontFamily: 'DM Serif Display, serif', color: '#4CC9F0' }}>
            {fmt(forecast.safeToSpend)}
          </p>
          <p className="text-[10px] mb-2" style={{ color: '#5A6A8A' }}>safe to spend</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span style={{ color: '#5A6A8A' }}>Income</span>
              <span style={{ color: '#06D6A0', fontFamily: 'JetBrains Mono' }}>{fmt(forecast.income)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: '#5A6A8A' }}>Spent</span>
              <span style={{ color: '#FF6B6B', fontFamily: 'JetBrains Mono' }}>{fmt(forecast.spent)}</span>
            </div>
            {forecast.upcomingFixed > 0 && (
              <div className="flex justify-between">
                <span style={{ color: '#5A6A8A' }}>Upcoming</span>
                <span style={{ color: '#F0A500', fontFamily: 'JetBrains Mono' }}>{fmt(forecast.upcomingFixed)}</span>
              </div>
            )}
            <div className="w-full h-1 rounded-full mt-1" style={{ background: '#1E2D4F' }}>
              <div className="h-full rounded-full" style={{
                width: `${forecast.monthProgress}%`,
                background: 'linear-gradient(90deg, #4CC9F0, #06D6A0)',
              }} />
            </div>
            <p className="text-[10px]" style={{ color: '#5A6A8A' }}>{forecast.daysLeft} days left in month</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  CATEGORIES TAB
// ─────────────────────────────────────────────────────────────────────────────

function CategoriesTab({ analytics }) {
  const { breakdown, topCategories, charts, summary } = analytics;

  const doughnutOptions = {
    responsive: true, maintainAspectRatio: true,
    cutout: '60%',
    plugins: {
      legend: { display: false },
      tooltip: TOOLTIP_STYLE,
    },
  };

  return (
    <div className="space-y-5">
      {/* Doughnut chart */}
      <SectionCard title="Spending Distribution">
        {charts.category ? (
          <>
            <div style={{ maxWidth: '220px', margin: '0 auto' }}>
              <Doughnut data={charts.category} options={doughnutOptions} />
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {topCategories.map(cat => (
                <div key={cat.id} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                  <span className="text-[10px]" style={{ color: '#8899BB' }}>{cat.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : <EmptyChart message="Add expense transactions to see category breakdown" />}
      </SectionCard>

      {/* Category table — all categories with amounts and bar */}
      <SectionCard title="Category Breakdown" badge={`${breakdown.length} categories`}>
        {breakdown.length === 0 ? (
          <EmptyChart message="No expense data yet" />
        ) : (
          <div className="space-y-3">
            {breakdown.map((cat, i) => (
              <div key={cat.id}>
                <div className="flex items-center gap-3 mb-1.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: cat.color + '22', border: `1px solid ${cat.color}44` }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: '#E8EEFF' }}>{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: '#8899BB', fontFamily: 'JetBrains Mono' }}>
                          {fmt(cat.total)}
                        </span>
                        <span className="text-[10px] w-8 text-right" style={{ color: cat.color }}>
                          {cat.percentage}%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1E2D4F' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${cat.percentage}%`, background: cat.color }} />
                      </div>
                      <span className="text-[10px] flex-shrink-0" style={{ color: '#5A6A8A' }}>
                        {cat.transactionCount} txn{cat.transactionCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  TRENDS TAB
// ─────────────────────────────────────────────────────────────────────────────

function TrendsTab({ analytics }) {
  const { trend, charts, comparison } = analytics;

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top', labels: { color: '#8899BB', font: { size: 11 }, usePointStyle: true } },
      tooltip: TOOLTIP_STYLE,
    },
    scales: AXIS_STYLE,
  };

  const savingsOptions = {
    ...lineOptions,
    plugins: { ...lineOptions.plugins, legend: { display: false } },
  };

  return (
    <div className="space-y-5">
      {/* Month vs month comparison summary */}
      <div className="rounded-2xl p-4" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
        <p className="text-xs font-semibold mb-3" style={{ color: '#8899BB' }}>This Month vs Last Month</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Income',   current: comparison.current?.income,   change: comparison.changes?.income },
            { label: 'Expenses', current: comparison.current?.expenses,  change: comparison.changes?.expenses },
            { label: 'Savings',  current: comparison.current?.savings,   change: comparison.changes?.savings },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-[10px] mb-1" style={{ color: '#5A6A8A' }}>{item.label}</p>
              <p className="text-sm font-medium mb-1" style={{ color: '#E8EEFF', fontFamily: 'JetBrains Mono' }}>
                {item.current != null ? fmt(item.current) : '—'}
              </p>
              <ComparisonBadge change={item.change} />
            </div>
          ))}
        </div>
      </div>

      {/* Income vs Expenses line chart */}
      <SectionCard title="Income vs Expenses Trend" badge="7 months">
        {charts.trend ? (
          <div style={{ height: '190px' }}>
            <Line data={charts.trend} options={lineOptions} />
          </div>
        ) : <EmptyChart message="Add transactions across multiple months to see your trend" />}
      </SectionCard>

      {/* Savings trend line */}
      <SectionCard title="Savings Over Time">
        {charts.savings ? (
          <div style={{ height: '150px' }}>
            <Line data={charts.savings} options={savingsOptions} />
          </div>
        ) : <EmptyChart message="Track multiple months to see savings trend" />}
      </SectionCard>

      {/* Monthly table */}
      {trend && trend.length > 0 && (
        <SectionCard title="Monthly Breakdown">
          <div className="space-y-2">
            {[...trend].reverse().map(p => (
              <div key={`${p.year}-${p.month}`}
                className="flex items-center gap-3 py-2"
                style={{ borderBottom: '1px solid #1E2D4F' }}
              >
                <span className="text-sm w-8 font-medium" style={{ color: '#8899BB' }}>{p.label}</span>
                <div className="flex-1 space-y-1">
                  {p.income > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-1 rounded-full" style={{
                        width: `${Math.round((p.income / Math.max(...trend.map(t => t.income))) * 100)}%`,
                        background: '#06D6A0', minWidth: '4px',
                      }} />
                      <span className="text-[10px]" style={{ color: '#06D6A0', fontFamily: 'JetBrains Mono' }}>{fmt(p.income)}</span>
                    </div>
                  )}
                  {p.expenses > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="h-1 rounded-full" style={{
                        width: `${Math.round((p.expenses / Math.max(...trend.map(t => t.income || t.expenses))) * 100)}%`,
                        background: '#FF6B6B', minWidth: '4px',
                      }} />
                      <span className="text-[10px]" style={{ color: '#FF6B6B', fontFamily: 'JetBrains Mono' }}>{fmt(p.expenses)}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs w-16 text-right font-medium" style={{
                  color: p.savings >= 0 ? '#06D6A0' : '#FF6B6B',
                  fontFamily: 'JetBrains Mono',
                }}>
                  {p.savings > 0 ? '+' : ''}{p.savings !== 0 ? fmt(p.savings) : '—'}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  INSIGHTS TAB
// ─────────────────────────────────────────────────────────────────────────────

function InsightsTab({ analytics }) {
  const { insights, healthScore, spendingDNA } = analytics;

  const insightBg = {
    positive: { bg: 'rgba(6,214,160,0.08)',  border: 'rgba(6,214,160,0.2)',  text: '#06D6A0' },
    warning:  { bg: 'rgba(240,165,0,0.08)',  border: 'rgba(240,165,0,0.2)',  text: '#F0A500' },
    info:     { bg: 'rgba(76,201,240,0.08)', border: 'rgba(76,201,240,0.2)', text: '#4CC9F0' },
    neutral:  { bg: 'rgba(30,45,79,0.4)',    border: 'rgba(30,45,79,0.8)',   text: '#8899BB' },
  };

  return (
    <div className="space-y-5">
      {/* Smart Insights */}
      <SectionCard title="Smart Insights" badge={`${insights.length} this month`}>
        {insights.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-4xl block mb-3">💡</span>
            <p className="text-sm" style={{ color: '#5A6A8A' }}>
              Add more transactions to unlock personalised insights
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map(insight => {
              const style = insightBg[insight.type] || insightBg.neutral;
              return (
                <div key={insight.id} className="flex items-start gap-3 p-3.5 rounded-xl"
                  style={{ background: style.bg, border: `1px solid ${style.border}` }}>
                  <span className="text-xl flex-shrink-0 mt-0.5">{insight.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm leading-snug" style={{ color: '#C0CDE8' }}>{insight.text}</p>
                    {insight.value != null && (
                      <span className="text-[10px] mt-1 inline-block px-2 py-0.5 rounded-full font-medium"
                        style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                        {Math.abs(insight.value)}
                        {typeof insight.value === 'number' && insight.value > 1 ? '%' : ''}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Health Score breakdown */}
      <SectionCard title="Health Score Breakdown">
        <div className="flex items-center gap-4 mb-5">
          <div className="relative w-20 h-20 flex-shrink-0">
            {/* Ring */}
            <svg width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="40" cy="40" r="32" fill="none" stroke="#1E2D4F" strokeWidth="6"/>
              <circle cx="40" cy="40" r="32" fill="none"
                stroke={healthScore.score >= 75 ? '#06D6A0' : healthScore.score >= 50 ? '#F0A500' : '#FF6B6B'}
                strokeWidth="6"
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - healthScore.score / 100)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold leading-none" style={{
                color: healthScore.score >= 75 ? '#06D6A0' : healthScore.score >= 50 ? '#F0A500' : '#FF6B6B',
                fontFamily: 'JetBrains Mono',
              }}>
                {healthScore.score}
              </span>
              <span className="text-[9px] mt-0.5" style={{ color: '#5A6A8A' }}>/ 100</span>
            </div>
          </div>
          <div>
            <p className="text-xl font-semibold" style={{ fontFamily: 'DM Serif Display, serif' }}>
              Grade {healthScore.grade}
            </p>
            <p className="text-sm mt-1" style={{ color: '#8899BB' }}>
              {healthScore.score >= 75 ? 'Excellent financial health'
                : healthScore.score >= 55 ? 'Good, with room to improve'
                : 'Needs attention — review expenses'}
            </p>
          </div>
        </div>

        {healthScore.factors.length > 0 && (
          <div className="space-y-3">
            {healthScore.factors.map(f => (
              <div key={f.label}>
                <div className="flex justify-between items-center text-xs mb-1">
                  <span style={{ color: '#C0CDE8' }}>{f.label}</span>
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#5A6A8A' }}>{f.note}</span>
                    <span style={{ color: '#E8EEFF', fontFamily: 'JetBrains Mono' }}>{f.score}/{f.max}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: '#1E2D4F' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{
                    width: `${(f.score / f.max) * 100}%`,
                    background: f.score >= f.max * 0.8 ? '#06D6A0' : f.score >= f.max * 0.5 ? '#F0A500' : '#FF6B6B',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Spending DNA */}
      <SectionCard title="Spending DNA">
        {spendingDNA.length === 0 ? (
          <EmptyChart message="Add transactions to reveal your spending personality" />
        ) : (
          <div className="space-y-4">
            {spendingDNA.map(dna => (
              <div key={dna.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{dna.icon}</span>
                    <span className="text-sm" style={{ color: '#C0CDE8' }}>{dna.label}</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: dna.color, fontFamily: 'JetBrains Mono' }}>
                    {dna.value}%
                  </span>
                </div>
                <div className="h-2 rounded-full" style={{ background: '#1E2D4F' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${dna.value}%`, background: dna.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ANALYTICS PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function Analytics() {
  const analytics = useAnalytics();
  const { loading, hasData } = analytics;
  const { openAddModal } = useApp();
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="page-enter pb-24">
      {/* Header */}
      <div className="px-5 pt-14 pb-4" style={{ background: '#080C18' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl" style={{ fontFamily: 'DM Serif Display, serif' }}>Analytics</h1>
            <p className="text-xs mt-0.5" style={{ color: '#5A6A8A' }}>
              {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>
          {hasData && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(6,214,160,0.08)', border: '1px solid rgba(6,214,160,0.2)' }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#06D6A0' }} />
              <span className="text-[10px] font-medium" style={{ color: '#06D6A0' }}>Live data</span>
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg text-[10px] font-medium tap-active transition-all"
              style={{
                background: activeTab === tab.id ? 'rgba(240,165,0,0.15)' : 'transparent',
                color: activeTab === tab.id ? '#F0A500' : '#5A6A8A',
                borderBottom: activeTab === tab.id ? '2px solid #F0A500' : '2px solid transparent',
              }}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#1E2D4F', borderTopColor: '#F0A500' }} />
          <span className="text-sm" style={{ color: '#5A6A8A' }}>Calculating analytics...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasData && (
        <div className="flex flex-col items-center py-20 px-8 gap-4 text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
            style={{ background: '#0F1629', border: '1px solid #1E2D4F' }}>📊</div>
          <div>
            <p className="font-semibold mb-2" style={{ color: '#E8EEFF' }}>No analytics yet</p>
            <p className="text-sm" style={{ color: '#8899BB' }}>
              Add transactions to generate your personalised financial analytics.
            </p>
          </div>
          <button onClick={() => openAddModal()}
            className="px-6 py-3 rounded-2xl font-medium text-sm tap-active"
            style={{ background: 'linear-gradient(135deg,#F0A500,#FFD166)', color: '#080C18' }}>
            + Add Transaction
          </button>
        </div>
      )}

      {/* Tab content */}
      {!loading && hasData && (
        <div className="px-5 space-y-1">
          {activeTab === 'overview'   && <OverviewTab   analytics={analytics} />}
          {activeTab === 'categories' && <CategoriesTab analytics={analytics} />}
          {activeTab === 'trends'     && <TrendsTab     analytics={analytics} />}
          {activeTab === 'insights'   && <InsightsTab   analytics={analytics} />}
        </div>
      )}
    </div>
  );
}
