'use client'

import React from 'react'
import { Search, X, Download } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { type Inspection, type InspectionStatus } from './types'
import { INSP_STATUS, DISC_COLORS } from './data'
import { StatusBadge } from './shared'

export function InspectionsTab({ inspections }: { inspections: Inspection[] }) {
  const [search, setSearch] = React.useState('')
  const [discF, setDiscF]   = React.useState('All')
  const [statF, setStatF]   = React.useState<InspectionStatus | 'All'>('All')
  const [detail, setDetail] = React.useState<Inspection | null>(null)

  const disciplines = ['All', ...Array.from(new Set(inspections.map((i) => i.discipline)))]
  const filtered = inspections.filter((i) => {
    const q = search.toLowerCase()
    const matchQ = i.title.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    const matchD = discF === 'All' || i.discipline === discF
    const matchS = statF === 'All' || i.status === statF
    return matchQ && matchD && matchS
  })

  const statCounts = (() => {
    const m: Record<string, number> = {}
    inspections.forEach((i) => { m[i.status] = (m[i.status] ?? 0) + 1 })
    return Object.entries(m).map(([k, v]) => ({
      name: INSP_STATUS[k as InspectionStatus].label, value: v,
      color: INSP_STATUS[k as InspectionStatus].color,
    }))
  })()

  const discCounts = (() => {
    const m: Record<string, number> = {}
    inspections.forEach((i) => { m[i.discipline] = (m[i.discipline] ?? 0) + 1 })
    return Object.entries(m).map(([k, v]) => ({ discipline: k, count: v }))
  })()

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Inspection Status Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statCounts} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                label={({ name, percent }) => `${(name ?? '').slice(0, 5)} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false} fontSize={9}>
                {statCounts.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}`, 'Count']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Inspections by Discipline</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={discCounts} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="discipline" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v}`, 'Count']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {discCounts.map((e) => <Cell key={e.discipline} fill={DISC_COLORS[e.discipline] ?? '#64ffda'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inspections..."
            className="w-full bg-muted/30 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
        </div>
        <select value={discF} onChange={(e) => setDiscF(e.target.value)}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={statF} onChange={(e) => setStatF(e.target.value as InspectionStatus | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Statuses</option>
          {(Object.keys(INSP_STATUS) as InspectionStatus[]).map((s) => (
            <option key={s} value={s}>{INSP_STATUS[s].label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Code', 'Title', 'System', 'Discipline', 'Type', 'Planned', 'Inspector', 'Status', 'Deficiencies', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ins) => {
              const s = INSP_STATUS[ins.status]
              return (
                <tr key={ins.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{ins.code}</td>
                  <td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate">{ins.title}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{ins.system}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ color: DISC_COLORS[ins.discipline] ?? '#64ffda', background: `${DISC_COLORS[ins.discipline] ?? '#64ffda'}18` }}>
                      {ins.discipline}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{ins.type}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ins.planned_date}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{ins.inspector}</td>
                  <td className="px-4 py-3"><StatusBadge {...s} /></td>
                  <td className="px-4 py-3 text-center">
                    {ins.deficiencies > 0
                      ? <span className="text-[11px] font-bold text-red-400">{ins.deficiencies}</span>
                      : <span className="text-[11px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setDetail(ins)} className="text-xs text-[#64ffda] hover:underline">View</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detail slide-in */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setDetail(null)} />
          <div className="w-full max-w-[520px] bg-background border-l border-border shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Inspection Detail</p>
                <p className="text-base font-bold text-foreground">{detail.code}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 px-6 py-5 space-y-5">
              <p className="text-sm font-semibold text-foreground">{detail.title}</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'System',     value: detail.system },
                  { label: 'Discipline', value: detail.discipline },
                  { label: 'Type',       value: detail.type },
                  { label: 'Inspector',  value: detail.inspector },
                  { label: 'Contractor', value: detail.contractor },
                  { label: 'Planned',    value: detail.planned_date },
                  { label: 'Actual',     value: detail.actual_date ?? '—' },
                  { label: 'Status',     value: <StatusBadge {...INSP_STATUS[detail.status]} /> },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                    <div className="text-sm text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              {detail.hold_points.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Hold Points</p>
                  <ul className="space-y-1">
                    {detail.hold_points.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-xs text-foreground">
                        <span className="size-1.5 rounded-full bg-red-400 shrink-0" />{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.witness_points.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Witness Points</p>
                  <ul className="space-y-1">
                    {detail.witness_points.map((w) => (
                      <li key={w} className="flex items-center gap-2 text-xs text-foreground">
                        <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.result_notes && (
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Result Notes</p>
                  <p className="text-sm text-foreground leading-relaxed">{detail.result_notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <Download className="size-3.5" /> Download ITP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
