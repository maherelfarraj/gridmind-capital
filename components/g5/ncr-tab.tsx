'use client'

import React from 'react'
import { Search, Plus, ChevronDown, ChevronUp, Eye, CheckCircle, Download } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { type NCR, type NcrSeverity, type NcrStatus } from './types'
import { NCR_STATUS, NCR_SEV } from './data'
import { StatusBadge, KpiCard } from './shared'

export function NcrTab({ ncrs }: { ncrs: NCR[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [search,   setSearch]   = React.useState('')
  const [sevF,     setSevF]     = React.useState<NcrSeverity | 'All'>('All')
  const [statF,    setStatF]    = React.useState<NcrStatus | 'All'>('All')

  const filtered = ncrs.filter((n) => {
    const q = search.toLowerCase()
    const matchQ  = n.title.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)
    const matchS  = sevF === 'All' || n.severity === sevF
    const matchSt = statF === 'All' || n.status === statF
    return matchQ && matchS && matchSt
  })

  const totalCost = ncrs.reduce((s, n) => s + n.cost_impact, 0)
  const openCount = ncrs.filter((n) => n.status === 'open').length
  const critical  = ncrs.filter((n) => n.severity === 'critical').length

  const sevData = (['critical', 'major', 'minor'] as NcrSeverity[]).map((s) => ({
    name: NCR_SEV[s].label, value: ncrs.filter((n) => n.severity === s).length, color: NCR_SEV[s].color,
  }))
  const statData = (Object.keys(NCR_STATUS) as NcrStatus[]).map((s) => ({
    name: NCR_STATUS[s].label, value: ncrs.filter((n) => n.status === s).length, color: NCR_STATUS[s].color,
  }))

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total NCRs"  value={ncrs.length} />
        <KpiCard label="Open NCRs"   value={openCount}   color="#ef4444" />
        <KpiCard label="Critical"    value={critical}    color="#dc2626" />
        <KpiCard label="Cost Impact" value={`$${(totalCost / 1000).toFixed(0)}k`} color="#f59e0b" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">NCR by Severity</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={sevData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                label={({ name, percent }) => `${(name ?? '').slice(0, 3)} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false} fontSize={9}>
                {sevData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}`, 'Count']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">NCR by Status</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={statData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v}`, 'NCRs']} />
              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                {statData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search NCRs..."
            className="w-full bg-muted/30 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
        </div>
        <select value={sevF} onChange={(e) => setSevF(e.target.value as NcrSeverity | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Severities</option>
          {(Object.keys(NCR_SEV) as NcrSeverity[]).map((s) => (
            <option key={s} value={s}>{NCR_SEV[s].label}</option>
          ))}
        </select>
        <select value={statF} onChange={(e) => setStatF(e.target.value as NcrStatus | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Statuses</option>
          {(Object.keys(NCR_STATUS) as NcrStatus[]).map((s) => (
            <option key={s} value={s}>{NCR_STATUS[s].label}</option>
          ))}
        </select>
        <button type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
          <Plus className="size-3.5" /> Raise NCR
        </button>
      </div>

      {/* Expandable register */}
      <div className="space-y-2">
        {filtered.map((ncr) => {
          const sev  = NCR_SEV[ncr.severity]
          const stat = NCR_STATUS[ncr.status]
          const isOpen = expanded === ncr.id
          return (
            <div key={ncr.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button type="button" onClick={() => setExpanded(isOpen ? null : ncr.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors text-left">
                <span className="font-mono text-xs text-[#64ffda] shrink-0">{ncr.code}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ncr.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{ncr.discipline} · {ncr.system}</p>
                </div>
                <StatusBadge {...sev} bg={`${sev.color}18`} />
                <StatusBadge {...stat} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Due {ncr.due_date}</span>
                {isOpen ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
              </button>
              {isOpen && (
                <div className="px-5 pb-5 border-t border-border space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                        <p className="text-sm text-foreground leading-relaxed">{ncr.description}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Root Cause</p>
                        <p className="text-sm text-foreground leading-relaxed">{ncr.root_cause}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Corrective Action</p>
                        <p className="text-sm text-foreground leading-relaxed">{ncr.corrective_action}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Raised By',    value: ncr.raised_by },
                        { label: 'Assigned To',  value: ncr.assigned_to },
                        { label: 'Raised Date',  value: ncr.raised_date },
                        { label: 'Due Date',     value: ncr.due_date },
                        { label: 'Cost Impact',  value: ncr.cost_impact > 0 ? `$${ncr.cost_impact.toLocaleString()}` : '—' },
                        { label: 'Verification', value: ncr.verification_required ? 'Required' : 'Not required' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                          <p className="text-sm text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {ncr.status === 'open' && (
                      <button type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 hover:bg-amber-500/20 transition-colors">
                        <Eye className="size-3.5" /> Start Review
                      </button>
                    )}
                    {ncr.status === 'under_review' && (
                      <button type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 text-xs text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors">
                        <CheckCircle className="size-3.5" /> Close NCR
                      </button>
                    )}
                    <button type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                      <Download className="size-3.5" /> Export PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
