'use client'

import React from 'react'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { MOCK_INSPECTIONS, MOCK_PUNCH_ITEMS, MOCK_NCRS, MC_PROGRESS, PUNCH_TREND } from './data'
import { KpiCard } from './shared'

export function AnalyticsTab() {
  const overallMC = Math.round(MC_PROGRESS.reduce((s, r) => s + r.pct, 0) / MC_PROGRESS.length)

  return (
    <div className="space-y-6">
      {/* KPI overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Overall MC %"      value={`${overallMC}%`}  color="#64ffda" />
        <KpiCard label="Total Inspections" value={MOCK_INSPECTIONS.length} />
        <KpiCard label="Open Punch (A)"    value={MOCK_PUNCH_ITEMS.filter((p) => p.category === 'A' && p.status !== 'closed').length} color="#ef4444" />
        <KpiCard label="Open NCRs"         value={MOCK_NCRS.filter((n) => n.status !== 'closed').length} color="#f59e0b" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">MC Progress by System</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MC_PROGRESS} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="system" tick={{ fontSize: 9 }} width={80} />
              <Tooltip formatter={(v) => [`${v}%`, 'Complete']} />
              <Bar dataKey="pct" name="MC %" radius={[0, 4, 4, 0]}>
                {MC_PROGRESS.map((e) => (
                  <Cell key={e.system} fill={e.pct >= 90 ? '#22c55e' : e.pct >= 60 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Punch Item Closure Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={PUNCH_TREND} margin={{ left: -20 }}>
              <defs>
                <linearGradient id="openGrad"  x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="closeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="opened" name="Opened" stroke="#ef4444" fill="url(#openGrad)"  strokeWidth={2} />
              <Area type="monotone" dataKey="closed" name="Closed" stroke="#22c55e" fill="url(#closeGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* NCR cost impact */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">NCR Cost Impact by Item (USD)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={MOCK_NCRS.filter((n) => n.cost_impact > 0).map((n) => ({ code: n.code, cost: n.cost_impact / 1000 }))}
            margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="code" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `$${v}k`} />
            <Tooltip formatter={(v) => [`$${v}k`, 'Cost']} />
            <Bar dataKey="cost" name="Cost (USD k)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
