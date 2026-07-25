'use client'
import React from 'react'
import { Search, ChevronDown, ChevronUp, AlertTriangle, Link2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { cn } from '@/lib/utils'
import type { CommFailure, FailureStatus, FailureSeverity } from './types'
import { FAIL_STATUS_META, FAIL_SEV_META, META_FALLBACK } from './data'

export function FailuresTab({ failures }: { failures: CommFailure[] }) {
  const [search, setSearch] = React.useState('')
  const [sevFilter, setSevFilter] = React.useState<FailureSeverity | 'all'>('all')
  const [statusFilter, setStatusFilter] = React.useState<FailureStatus | 'all'>('all')
  const [expanded, setExpanded] = React.useState<string | null>(null)

  const filtered = failures.filter((f) => {
    const q = search.toLowerCase()
    const mQ = !q || f.code.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.package_ref.toLowerCase().includes(q)
    const mS = sevFilter === 'all' || f.severity === sevFilter
    const mSt = statusFilter === 'all' || f.status === statusFilter
    return mQ && mS && mSt
  })

  // Chart data
  const sevData = (['critical', 'major', 'minor'] as FailureSeverity[]).map((s) => ({
    name: FAIL_SEV_META[s].label,
    count: failures.filter((f) => f.severity === s).length,
    fill: FAIL_SEV_META[s].color,
  })).filter((d) => d.count > 0)

  const statusData = (Object.keys(FAIL_STATUS_META) as FailureStatus[]).map((s) => ({
    name: FAIL_STATUS_META[s].label,
    value: failures.filter((f) => f.status === s).length,
    fill: FAIL_STATUS_META[s].color,
  })).filter((d) => d.value > 0)

  const open = failures.filter((f) => f.status !== 'closed').length
  const critical = failures.filter((f) => f.severity === 'critical').length

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Failures', value: failures.length, color: '#475569', bg: '#f1f5f9' },
          { label: 'Open', value: open, color: '#dc2626', bg: '#fee2e2' },
          { label: 'Critical', value: critical, color: '#991b1b', bg: '#fecaca' },
          { label: 'Closed', value: failures.filter((f) => f.status === 'closed').length, color: '#16a34a', bg: '#dcfce7' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
            <span className="p-2 rounded-lg" style={{ background: k.bg, color: k.color }}><AlertTriangle size={16} /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{k.label}</p>
              <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Failures by Severity</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={sevData} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip formatter={(v) => [v, 'Failures']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {sevData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Status Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}
                label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                labelLine={false}
                fontSize={10}>
                {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={(v) => [v, 'Failures']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search failures..."
            className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-400 w-52" />
        </div>
        <select value={sevFilter} onChange={(e) => setSevFilter(e.target.value as FailureSeverity | 'all')}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none">
          <option value="all">All Severities</option>
          {(['critical', 'major', 'minor'] as FailureSeverity[]).map((s) => <option key={s} value={s}>{FAIL_SEV_META[s].label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as FailureStatus | 'all')}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none">
          <option value="all">All Statuses</option>
          {(Object.keys(FAIL_STATUS_META) as FailureStatus[]).map((s) => <option key={s} value={s}>{FAIL_STATUS_META[s].label}</option>)}
        </select>
      </div>

      {/* Failure list */}
      <div className="space-y-3">
        {filtered.map((f) => {
          const sm  = FAIL_STATUS_META[f.status]   ?? META_FALLBACK(f.status)
          const sev = FAIL_SEV_META[f.severity]    ?? META_FALLBACK(f.severity)
          const isOpen = expanded === f.id
          return (
            <div key={f.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-start gap-4">
                <span className="p-2 rounded-lg shrink-0 mt-0.5" style={{ background: sev.bg, color: sev.color }}>
                  <AlertTriangle size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-xs font-mono font-bold text-slate-500">{f.code}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: sev.color, background: sev.bg }}>{sev.label}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: sm.color, background: sm.bg }}>{sm.label}</span>
                    <span className="text-xs text-slate-400">Package: {f.package_ref}</span>
                    {f.ncr_ref && (
                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Link2 size={9} />{f.ncr_ref}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-800">{f.description}</p>
                  <p className="text-xs text-slate-400 mt-1">Raised by {f.raised_by} &nbsp;·&nbsp; {f.raised_date} &nbsp;·&nbsp; Due: {f.due_date}</p>
                </div>
                <button type="button" onClick={() => setExpanded(isOpen ? null : f.id)}
                  className="text-slate-400 hover:text-slate-600 shrink-0 mt-1">
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-slate-100 bg-slate-50/40 pt-4 space-y-3 text-xs text-slate-600">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Root Cause</p>
                    <p>{f.root_cause}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Corrective Action</p>
                    <p>{f.corrective_action}</p>
                  </div>
                  {f.retest_date && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Retest Date</p>
                      <p>{f.retest_date}</p>
                    </div>
                  )}
                  {f.closed_date && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Closed</p>
                      <p>{f.closed_date}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm bg-white rounded-xl border border-slate-200">No failures match the current filters.</div>
        )}
      </div>
    </div>
  )
}
