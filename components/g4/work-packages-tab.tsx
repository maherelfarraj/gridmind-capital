'use client'

import React from 'react'
import { Search, X, Clock, DollarSign, Users, CheckCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { WorkPackage, PRIORITY_META, STATUS_META } from './data'

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n)

export function WorkPackagesTab({ packages }: { packages: WorkPackage[] }) {
  const [search,   setSearch]   = React.useState('')
  const [disc,     setDisc]     = React.useState('All')
  const [status,   setStatus]   = React.useState('All')
  const [priority, setPriority] = React.useState('All')
  const [selected, setSelected] = React.useState<WorkPackage | null>(null)
  const [wpTab,    setWpTab]    = React.useState('Overview')

  const DISCIPLINES = ['All', 'Civil', 'Mechanical', 'Electrical', 'Instrumentation', 'Piping', 'Structural', 'Architectural', 'Commissioning']
  const STATUSES    = ['All', 'Not Started', 'In Progress', 'Complete', 'On Hold', 'Blocked']
  const PRIORITIES  = ['All', 'Critical', 'High', 'Medium', 'Low']
  const WP_DETAIL_TABS = ['Overview', 'Schedule', 'Resources', 'Costs', 'Progress', 'Issues', 'Documents']

  const filtered = packages.filter((p) => {
    const matchSearch   = search === '' || p.title.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
    const matchDisc     = disc === 'All' || p.discipline === disc
    const matchStatus   = status === 'All' || p.status === status
    const matchPriority = priority === 'All' || p.priority === priority
    return matchSearch && matchDisc && matchStatus && matchPriority
  })

  const progressColor = (pct: number, st: string) => {
    if (st === 'Complete') return 'bg-green-500'
    if (st === 'Blocked')  return 'bg-red-500'
    if (st === 'On Hold')  return 'bg-amber-400'
    if (pct > 50)          return 'bg-blue-500'
    return 'bg-orange-500'
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-3 px-5 py-4 border-b border-slate-100">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search work packages..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400" />
          </div>
          {([['Discipline', DISCIPLINES, disc, setDisc], ['Status', STATUSES, status, setStatus], ['Priority', PRIORITIES, priority, setPriority]] as const).map(([label, opts, val, fn]) => (
            <select key={label as string} value={val as string} onChange={(e) => (fn as (v: string) => void)(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400">
              {(opts as string[]).map((o) => <option key={o}>{o}</option>)}
            </select>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {filtered.map((wp) => {
            const pm = PRIORITY_META[wp.priority] ?? PRIORITY_META.Medium
            const sm = STATUS_META[wp.status]     ?? STATUS_META['Not Started']
            return (
              <div key={wp.id} onClick={() => setSelected(wp)}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{wp.wbs_code}</span>
                    <Badge className={pm.color}>{pm.icon}{pm.label}</Badge>
                  </div>
                  <Badge className={sm.color}>{sm.icon}{sm.label}</Badge>
                </div>
                <p className="text-sm font-semibold text-slate-900 mt-2 leading-snug">{wp.title}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{wp.description}</p>
                <div className="mt-3">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', progressColor(wp.progress_percent, wp.status))}
                      style={{ width: `${wp.progress_percent}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{wp.progress_percent}% complete</p>
                </div>
                <div className="flex gap-4 mt-3">
                  <span className="flex items-center gap-1 text-xs text-slate-600">
                    <Clock className="size-3 text-slate-400" />{wp.actual_hours.toLocaleString()} / {wp.planned_hours.toLocaleString()}h
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-600">
                    <DollarSign className="size-3 text-slate-400" />{fmt(wp.actual_cost)} / {fmt(wp.budget_amount)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-600">
                    <Users className="size-3 text-slate-400" />{wp.team_size}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">{wp.start_date}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{wp.discipline}</span>
                  <span className="text-[11px] text-slate-400">{wp.end_date}</span>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-slate-400 text-sm">No work packages match your filters.</div>
          )}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelected(null)} />
          <div className="w-full max-w-[600px] bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{selected.wbs_code} · {selected.discipline}</p>
                <p className="text-base font-bold text-slate-900 leading-snug">{selected.title}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600"><X className="size-5" /></button>
            </div>
            <div className="flex gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50">
              <Badge className={PRIORITY_META[selected.priority]?.color ?? 'bg-slate-100 text-slate-700'}>{PRIORITY_META[selected.priority]?.icon}{selected.priority}</Badge>
              <Badge className={STATUS_META[selected.status]?.color   ?? 'bg-slate-100 text-slate-700'}>{STATUS_META[selected.status]?.icon}{selected.status}</Badge>
              <Badge className="bg-orange-100 text-orange-700">{selected.progress_percent}% complete</Badge>
            </div>
            <div className="flex overflow-x-auto border-b border-slate-100 bg-white px-4">
              {WP_DETAIL_TABS.map((t) => (
                <button key={t} type="button" onClick={() => setWpTab(t)}
                  className={cn('px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2',
                    wpTab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
              {wpTab === 'Overview' && (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Description</p>
                    <p className="text-slate-700 leading-relaxed">{selected.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Start Date',  value: selected.start_date },
                      { label: 'End Date',    value: selected.end_date },
                      { label: 'Budget',      value: fmt(selected.budget_amount) },
                      { label: 'Actual Cost', value: fmt(selected.actual_cost) },
                      { label: 'Planned Hrs', value: selected.planned_hours.toLocaleString() },
                      { label: 'Actual Hrs',  value: selected.actual_hours.toLocaleString() },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                        <p className="font-semibold text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {wpTab === 'Schedule' && (
                <div className="space-y-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Milestones</p>
                  {selected.milestones.length === 0 && <p className="text-slate-400 text-xs">No milestones defined.</p>}
                  {selected.milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <div className={cn('size-6 rounded-full flex items-center justify-center flex-shrink-0',
                        m.status === 'Complete' ? 'bg-green-100' : m.status === 'In Progress' ? 'bg-blue-100' : 'bg-slate-100')}>
                        {m.status === 'Complete'
                          ? <CheckCircle className="size-3.5 text-green-600" />
                          : m.status === 'In Progress'
                          ? <Loader2 className="size-3.5 text-blue-600 animate-spin" />
                          : <Clock className="size-3.5 text-slate-400" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.date}</p>
                      </div>
                      <Badge className={STATUS_META[m.status]?.color ?? 'bg-slate-100 text-slate-600'}>{m.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {wpTab === 'Resources' && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Team</p>
                  <p className="text-slate-700"><span className="font-bold text-orange-600">{selected.team_size}</span> personnel assigned</p>
                  <p className="text-xs text-slate-400 mt-1">Full resource loading available in the Resources tab.</p>
                </div>
              )}
              {wpTab === 'Costs' && (
                <div className="space-y-3">
                  {[
                    { label: 'Budget (BAC)',  value: fmt(selected.budget_amount), color: 'text-slate-700' },
                    { label: 'Actual Cost',   value: fmt(selected.actual_cost),   color: 'text-orange-600' },
                    { label: 'Remaining',     value: fmt(selected.budget_amount - selected.actual_cost), color: selected.actual_cost > selected.budget_amount ? 'text-red-600' : 'text-green-600' },
                    { label: 'Burn Rate',     value: `${((selected.actual_cost / selected.budget_amount) * 100).toFixed(0)}%`, color: 'text-slate-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100">
                      <p className="text-slate-500 text-xs">{label}</p>
                      <p className={cn('font-bold text-sm', color)}>{value}</p>
                    </div>
                  ))}
                </div>
              )}
              {wpTab === 'Progress' && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${selected.progress_percent}%` }} />
                    </div>
                    <span className="font-bold text-orange-600 text-sm">{selected.progress_percent}%</span>
                  </div>
                  <p className="text-xs text-slate-400">Actual hours: {selected.actual_hours.toLocaleString()} / {selected.planned_hours.toLocaleString()} planned</p>
                </div>
              )}
              {wpTab === 'Issues' && (
                <div className="space-y-3">
                  {selected.issues.length === 0 && <p className="text-slate-400 text-xs">No open issues.</p>}
                  {selected.issues.map((iss) => (
                    <div key={iss.id} className="flex items-start gap-3 border border-slate-100 rounded-xl p-3">
                      <Badge className={PRIORITY_META[iss.priority]?.color ?? 'bg-slate-100 text-slate-700'}>{iss.priority}</Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{iss.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Owner: {iss.owner}</p>
                      </div>
                      <Badge className={STATUS_META[iss.status]?.color ?? 'bg-slate-100 text-slate-700'}>{iss.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {wpTab === 'Documents' && (
                <div className="space-y-2">
                  {selected.documents.length === 0 && <p className="text-slate-400 text-xs">No documents attached.</p>}
                  {selected.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                      <div>
                        <p className="text-sm text-slate-800 font-medium">{doc.name}</p>
                        <p className="text-xs text-slate-400">{doc.type} · {doc.date}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700">{doc.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
