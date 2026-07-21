'use client'

import React from 'react'
import { Search } from 'lucide-react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { type TestPlan } from './types'
import { TP_STATUS, MC_PROGRESS } from './data'
import { StatusBadge } from './shared'

export function TestPlansTab({ plans }: { plans: TestPlan[] }) {
  const [search, setSearch] = React.useState('')
  const [statF,  setStatF]  = React.useState<TestPlan['status'] | 'All'>('All')

  const filtered = plans.filter((p) => {
    const q = search.toLowerCase()
    const matchQ = p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    const matchS = statF === 'All' || p.status === statF
    return matchQ && matchS
  })

  const statusData = (Object.keys(TP_STATUS) as TestPlan['status'][]).map((s) => ({
    name: TP_STATUS[s].label, value: plans.filter((p) => p.status === s).length, color: TP_STATUS[s].color,
  }))

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">ITP Status Overview</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={statusData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Plans" radius={[4, 4, 0, 0]}>
                {statusData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">MC Readiness by System</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={MC_PROGRESS} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="system" tick={{ fontSize: 9 }} width={70} />
              <Tooltip formatter={(v) => [`${v}%`, 'MC Complete']} />
              <Bar dataKey="pct" name="MC %" radius={[0, 4, 4, 0]}>
                {MC_PROGRESS.map((e) => (
                  <Cell key={e.system} fill={e.pct >= 90 ? '#22c55e' : e.pct >= 60 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ITPs..."
            className="w-full bg-muted/30 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
        </div>
        <select value={statF} onChange={(e) => setStatF(e.target.value as TestPlan['status'] | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Statuses</option>
          {(Object.keys(TP_STATUS) as TestPlan['status'][]).map((s) => (
            <option key={s} value={s}>{TP_STATUS[s].label}</option>
          ))}
        </select>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((tp) => {
          const ts  = TP_STATUS[tp.status]
          const pct = tp.steps_total > 0 ? Math.round(tp.steps_completed / tp.steps_total * 100) : 0
          return (
            <div key={tp.id} className="rounded-xl border border-border bg-card p-5 hover:border-[#64ffda]/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-mono text-xs text-[#64ffda] block mb-0.5">{tp.code}</span>
                  <p className="text-sm font-semibold text-foreground leading-snug">{tp.title}</p>
                </div>
                <StatusBadge {...ts} />
              </div>
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Steps completed</span>
                  <span className="font-mono font-bold text-foreground">{tp.steps_completed} / {tp.steps_total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: ts.color }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <span>System: <span className="text-foreground">{tp.system}</span></span>
                <span>Type: <span className="text-foreground">{tp.test_type}</span></span>
                <span>Planned: <span className="font-mono text-foreground">{tp.planned_date}</span></span>
                <span>By: <span className="text-foreground truncate">{tp.responsible.split('/')[0].trim()}</span></span>
              </div>
              {tp.result && (
                <p className="text-[10px] text-muted-foreground mt-2 italic">{tp.result}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
