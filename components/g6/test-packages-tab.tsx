'use client'
import React from 'react'
import {
  CheckCircle, XCircle, RefreshCw, Loader2, Cog, Droplets, Zap, Activity,
  Flame, Wind, Shield, Droplet, AlertOctagon, ArrowUp, ArrowDown,
  Search, ChevronRight, X, FileText, User, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TestPackage, TestPackageStatus, TestPriority, TestSystem } from './types'
import { STATUS_META, PRIORITY_META, SYSTEM_META, META_FALLBACK } from './data'

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function SystemIcon({ system, size = 20 }: { system: TestSystem; size?: number }) {
  const meta = SYSTEM_META[system]
  const icons: Record<TestSystem, React.ReactNode> = {
    turbine_generator:       <Cog size={size} />,
    cooling_water:           <Droplets size={size} />,
    electrical_power:        <Zap size={size} />,
    control_instrumentation: <Activity size={size} />,
    fuel_supply:             <Flame size={size} />,
    hvac:                    <Wind size={size} />,
    fire_protection:         <Shield size={size} />,
    water_treatment:         <Droplet size={size} />,
  }
  return (
    <span className="inline-flex items-center justify-center rounded-lg p-1.5"
      style={{ background: meta.bg, color: meta.color }}>
      {icons[system]}
    </span>
  )
}

function StatusBadge({ status }: { status: TestPackageStatus }) {
  const m = STATUS_META[status]
  const icons: Partial<Record<TestPackageStatus, React.ReactNode>> = {
    in_progress:     <Loader2 size={10} className="animate-spin" />,
    complete:        <CheckCircle size={10} />,
    failed:          <XCircle size={10} />,
    retest_required: <RefreshCw size={10} />,
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: m.color, background: m.bg }}>
      {icons[status]}{m.label}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: TestPriority }) {
  const m = PRIORITY_META[priority]
  const icons: Record<TestPriority, React.ReactNode> = {
    critical: <AlertOctagon size={10} />,
    high:     <Flame size={10} />,
    medium:   <ArrowUp size={10} />,
    low:      <ArrowDown size={10} />,
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ color: m.color, background: m.bg }}>
      {icons[priority]}{m.label}
    </span>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ pkg, onClose }: { pkg: TestPackage; onClose: () => void }) {
  const [tab, setTab] = React.useState<'overview' | 'procedures' | 'records' | 'failures' | 'signoffs'>('overview')
  const panelTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'procedures', label: 'Procedures' },
    { id: 'records', label: 'Test Records' },
    { id: 'failures', label: 'Failures' },
    { id: 'signoffs', label: 'Sign-Offs' },
  ] as const

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative ml-auto h-full w-full max-w-[700px] bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div>
            <p className="text-xs font-mono text-slate-400">{pkg.code}</p>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">{pkg.title}</h2>
            <div className="flex gap-2 mt-1.5">
              <StatusBadge status={pkg.status} />
              <PriorityBadge priority={pkg.priority} />
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-1"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-200 px-6 shrink-0 overflow-x-auto">
          {panelTabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={cn('py-2.5 px-3 text-xs font-medium border-b-2 whitespace-nowrap transition-colors',
                tab === t.id ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === 'overview' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600">{pkg.description}</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'System', value: SYSTEM_META[pkg.system].label },
                  { label: 'Priority', value: PRIORITY_META[pkg.priority].label },
                  { label: 'Planned Start', value: pkg.planned_start },
                  { label: 'Planned End', value: pkg.planned_end },
                  { label: 'Actual Start', value: pkg.actual_start ?? '—' },
                  { label: 'Actual End', value: pkg.actual_end ?? '—' },
                  { label: 'Lead Engineer', value: pkg.lead },
                  { label: 'Tests Complete', value: `${pkg.tests_complete} / ${pkg.tests_total}` },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{f.label}</p>
                    <p className="text-sm text-slate-800 mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>
              {pkg.ref_docs.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Reference Documents</p>
                  <div className="flex flex-wrap gap-2">
                    {pkg.ref_docs.map((d) => (
                      <span key={d} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                        <FileText size={11} />{d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'procedures' && (
            pkg.procedures.length === 0
              ? <p className="text-sm text-slate-400 text-center py-8">No procedures on record for this package.</p>
              : <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400">
                    {['ID', 'Description', 'Standard', 'Acceptance Criteria', 'Status'].map((h) =>
                      <th key={h} className="py-2 pr-3 text-left font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>{pkg.procedures.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-mono text-slate-500">{p.id.toUpperCase()}</td>
                      <td className="py-2 pr-3 text-slate-700">{p.description}</td>
                      <td className="py-2 pr-3 text-slate-500">{p.standard}</td>
                      <td className="py-2 pr-3 text-slate-500">{p.acceptance_criteria}</td>
                      <td className="py-2">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize"
                          style={{ color: p.status === 'complete' ? '#16a34a' : p.status === 'failed' ? '#dc2626' : '#d97706', background: p.status === 'complete' ? '#dcfce7' : p.status === 'failed' ? '#fee2e2' : '#fef3c7' }}>
                          {p.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
          )}

          {tab === 'records' && (
            pkg.records.length === 0
              ? <p className="text-sm text-slate-400 text-center py-8">No test records yet.</p>
              : <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400">
                    {['Test ID', 'Date', 'Technician', 'Value', 'Max', 'Result', 'Cert'].map((h) =>
                      <th key={h} className="py-2 pr-3 text-left font-semibold">{h}</th>)}
                  </tr></thead>
                  <tbody>{pkg.records.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <td className="py-2 pr-3 font-mono text-slate-500">{r.test_id}</td>
                      <td className="py-2 pr-3 text-slate-600">{r.date}</td>
                      <td className="py-2 pr-3 text-slate-600">{r.technician}</td>
                      <td className="py-2 pr-3 font-mono font-bold text-slate-800">{r.value ?? '—'} {r.unit}</td>
                      <td className="py-2 pr-3 font-mono text-slate-400">{r.acceptance_max ?? '—'} {r.unit}</td>
                      <td className="py-2 pr-3">
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', r.result === 'pass' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                          {r.result.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2">{r.certificate ? <span className="text-teal-600 underline cursor-pointer">{r.certificate}</span> : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
          )}

          {tab === 'failures' && (
            pkg.failures.length === 0
              ? <p className="text-sm text-slate-400 text-center py-8">No failures recorded.</p>
              : <div className="space-y-4">{pkg.failures.map((f) => (
                <div key={f.id} className="rounded-xl border border-red-200 bg-red-50/30 p-4 space-y-2">
                  <p className="text-xs font-semibold text-red-700">{f.test_id} — {f.description}</p>
                  <div className="grid grid-cols-1 gap-2 text-xs text-slate-600">
                    <div><span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Root Cause: </span>{f.root_cause}</div>
                    <div><span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Corrective Action: </span>{f.corrective_action}</div>
                    {f.ncr_ref && <div><span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">NCR: </span><span className="text-amber-600">{f.ncr_ref}</span></div>}
                    <div><span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Retest Result: </span>{f.retest_result ?? 'Pending'}</div>
                  </div>
                </div>
              ))}</div>
          )}

          {tab === 'signoffs' && (
            <div className="space-y-3">{pkg.sign_offs.map((s) => (
              <div key={s.role} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-3">
                  <User size={16} className="text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{s.role}</p>
                    <p className="text-xs text-slate-500">{s.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.date && <span className="text-xs text-slate-400 flex items-center gap-1"><Calendar size={11}/>{s.date}</span>}
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', s.status === 'signed' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>
                    {s.status === 'signed' ? 'Signed' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TestPackagesTab({ packages }: { packages: TestPackage[] }) {
  const [search, setSearch] = React.useState('')
  const [systemFilter, setSystemFilter] = React.useState<TestSystem | 'all'>('all')
  const [statusFilter, setStatusFilter] = React.useState<TestPackageStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = React.useState<TestPriority | 'all'>('all')
  const [selected, setSelected] = React.useState<TestPackage | null>(null)

  const filtered = packages.filter((p) => {
    const q = search.toLowerCase()
    const mQ = !q || p.code.toLowerCase().includes(q) || p.title.toLowerCase().includes(q)
    const mS = systemFilter === 'all' || p.system === systemFilter
    const mSt = statusFilter === 'all' || p.status === statusFilter
    const mP = priorityFilter === 'all' || p.priority === priorityFilter
    return mQ && mS && mSt && mP
  })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Filter bar */}
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search test packages..."
            className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-400 w-52" />
        </div>
        <select value={systemFilter} onChange={(e) => setSystemFilter(e.target.value as TestSystem | 'all')}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none">
          <option value="all">All Systems</option>
          {(Object.keys(SYSTEM_META) as TestSystem[]).map((s) => <option key={s} value={s}>{SYSTEM_META[s].label}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TestPackageStatus | 'all')}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none">
          <option value="all">All Statuses</option>
          {(Object.keys(STATUS_META) as TestPackageStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TestPriority | 'all')}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none">
          <option value="all">All Priorities</option>
          {(Object.keys(PRIORITY_META) as TestPriority[]).map((p) => <option key={p} value={p}>{PRIORITY_META[p].label}</option>)}
        </select>
      </div>

      {/* Card grid */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((pkg) => {
          const pct = pkg.tests_total > 0 ? Math.round((pkg.tests_complete / pkg.tests_total) * 100) : 0
          const sm = STATUS_META[pkg.status]
          return (
            <div key={pkg.id} onClick={() => setSelected(pkg)}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <SystemIcon system={pkg.system} size={16} />
                  <span className="text-[10px] font-mono text-slate-400">{pkg.code}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={pkg.status} />
                  <PriorityBadge priority={pkg.priority} />
                </div>
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mt-2 leading-snug">{pkg.title}</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">{pkg.description}</p>

              <p className="text-xs text-slate-500 mt-3">{pkg.tests_complete} of {pkg.tests_total} tests complete</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: sm.color }} />
              </div>
              {pkg.tests_total > 0 && (
                <p className="text-xs text-slate-500 mt-1.5">Pass: {pkg.pass} &nbsp;·&nbsp; Fail: {pkg.fail} &nbsp;·&nbsp; Retest: {pkg.retest}</p>
              )}
              {pkg.next_test && (
                <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1"><ChevronRight size={11} />{pkg.next_test}</p>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="size-5 rounded-full bg-teal-100 text-teal-700 text-[10px] font-bold flex items-center justify-center">{pkg.lead.charAt(0)}</span>
                  <span className="text-xs text-slate-600">{pkg.lead}</span>
                </div>
                <span className="text-xs text-slate-400">{pkg.updated}</span>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="col-span-3 py-12 text-center text-slate-400 text-sm">No test packages match the current filters.</div>
        )}
      </div>

      {selected && <DetailPanel pkg={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
