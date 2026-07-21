'use client'

import React from 'react'
import { Search, X, CheckCircle, Send } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { type PunchItem, type PunchCategory, type PunchStatus } from './types'
import { PUNCH_STATUS, PUNCH_CAT, DISC_COLORS, PUNCH_TREND } from './data'
import { StatusBadge, KpiCard } from './shared'

export function PunchListTab({ items }: { items: PunchItem[] }) {
  const [search, setSearch]  = React.useState('')
  const [catF,   setCatF]    = React.useState<PunchCategory | 'All'>('All')
  const [statF,  setStatF]   = React.useState<PunchStatus | 'All'>('All')
  const [discF,  setDiscF]   = React.useState('All')
  const [detail, setDetail]  = React.useState<PunchItem | null>(null)

  const disciplines = ['All', ...Array.from(new Set(items.map((i) => i.discipline)))]
  const filtered = items.filter((i) => {
    const q = search.toLowerCase()
    const matchQ = i.description.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    const matchC = catF === 'All' || i.category === catF
    const matchS = statF === 'All' || i.status === statF
    const matchD = discF === 'All' || i.discipline === discF
    return matchQ && matchC && matchS && matchD
  })

  const PROJECT_PUNCH_TOTAL  = 320
  const PROJECT_PUNCH_OPEN   = 45
  const PROJECT_PUNCH_CLOSED = PROJECT_PUNCH_TOTAL - PROJECT_PUNCH_OPEN
  const PROJECT_PUNCH_CAT_A  = 12
  const PROJECT_PUNCH_CAT_B  = 28
  const PROJECT_PUNCH_CAT_C  = PROJECT_PUNCH_OPEN - PROJECT_PUNCH_CAT_A - PROJECT_PUNCH_CAT_B

  const catData = [
    { category: 'Cat A', open: PROJECT_PUNCH_CAT_A, closed: 88  },
    { category: 'Cat B', open: PROJECT_PUNCH_CAT_B, closed: 156 },
    { category: 'Cat C', open: PROJECT_PUNCH_CAT_C, closed: 31  },
  ]

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Items"  value={PROJECT_PUNCH_TOTAL}  sub="all categories" />
        <KpiCard label="Open Cat A"   value={PROJECT_PUNCH_CAT_A}  color="#ef4444" sub="must close before MC" />
        <KpiCard label="Open Cat B"   value={PROJECT_PUNCH_CAT_B}  color="#f59e0b" sub="before commissioning" />
        <KpiCard label="Closed"       value={PROJECT_PUNCH_CLOSED} color="#22c55e"
          sub={`${Math.round(PROJECT_PUNCH_CLOSED / PROJECT_PUNCH_TOTAL * 100)}% closure rate`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Punch Items by Category</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={catData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="open"   name="Open"   fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="closed" name="Closed" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Weekly Punch Trend</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={PUNCH_TREND} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="opened"      name="Opened"      stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="closed"      name="Closed"      stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="outstanding" name="Outstanding" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search punch items..."
            className="w-full bg-muted/30 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
        </div>
        {(['All', 'A', 'B', 'C'] as (PunchCategory | 'All')[]).map((c) => (
          <button key={c} type="button" onClick={() => setCatF(c)}
            className={cn('px-3 py-2 rounded-lg text-xs font-semibold border transition-colors',
              catF === c ? 'border-[#64ffda]/50 bg-[#64ffda]/10 text-[#64ffda]' : 'border-border text-muted-foreground hover:text-foreground')}>
            {c === 'All' ? 'All Cats' : `Cat ${c}`}
          </button>
        ))}
        <select value={statF} onChange={(e) => setStatF(e.target.value as PunchStatus | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Statuses</option>
          {(Object.keys(PUNCH_STATUS) as PunchStatus[]).map((s) => (
            <option key={s} value={s}>{PUNCH_STATUS[s].label}</option>
          ))}
        </select>
        <select value={discF} onChange={(e) => setDiscF(e.target.value)}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Register */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Code', 'Cat', 'Description', 'Discipline', 'System', 'Location', 'Raised', 'Due', 'Assigned To', 'Priority', 'Status', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const ps  = PUNCH_STATUS[p.status]
              const pc  = PUNCH_CAT[p.category]
              const pri = p.priority === 'high' ? '#ef4444' : p.priority === 'medium' ? '#f59e0b' : '#22c55e'
              return (
                <tr key={p.id} className={cn('border-b border-border hover:bg-muted/20 transition-colors',
                  p.category === 'A' && p.status === 'open' && 'bg-red-500/3')}>
                  <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{p.code}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: pc.color, background: `${pc.color}20` }}>{pc.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground max-w-[240px]">
                    <p className="truncate" title={p.description}>{p.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ color: DISC_COLORS[p.discipline] ?? '#64ffda', background: `${DISC_COLORS[p.discipline] ?? '#64ffda'}18` }}>
                      {p.discipline}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.system}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{p.location}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.raised_date}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.due_date}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{p.assigned_to}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full"
                      style={{ color: pri, background: `${pri}18` }}>{p.priority}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge {...ps} /></td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setDetail(p)} className="text-xs text-[#64ffda] hover:underline">View</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Punch detail panel */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setDetail(null)} />
          <div className="w-full max-w-[540px] bg-background border-l border-border shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Punch List Item</p>
                <p className="text-base font-bold text-foreground">{detail.code}
                  <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: PUNCH_CAT[detail.category].color, background: `${PUNCH_CAT[detail.category].color}20` }}>
                    {PUNCH_CAT[detail.category].label}
                  </span>
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 px-6 py-5 space-y-5">
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                <p className="text-sm text-foreground leading-relaxed">{detail.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Discipline',  value: detail.discipline },
                  { label: 'System',      value: detail.system },
                  { label: 'Location',    value: detail.location },
                  { label: 'Drawing Ref', value: detail.drawing_ref },
                  { label: 'Raised By',   value: detail.raised_by },
                  { label: 'Assigned To', value: detail.assigned_to },
                  { label: 'Raised Date', value: detail.raised_date },
                  { label: 'Due Date',    value: detail.due_date },
                  { label: 'Closed Date', value: detail.closed_date ?? '—' },
                  { label: 'Status',      value: <StatusBadge {...PUNCH_STATUS[detail.status]} /> },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                    <div className="text-sm text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                {detail.status !== 'closed' && (
                  <button type="button"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 text-sm text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors">
                    <CheckCircle className="size-3.5" /> Close Item
                  </button>
                )}
                <button type="button"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <Send className="size-3.5" /> Send Notification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
