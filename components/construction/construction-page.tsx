'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import useSWR from 'swr'
import {
  Plus, RefreshCw, Loader2, Hammer, HardHat, ClipboardList,
  CheckCircle2, AlertTriangle, X, ClipboardCheck, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  loadConstructionDashboard, closePunchItem, recordInspection,
} from '@/app/actions/construction'
import type { WorkPackage, InspectionRecord, PunchItem } from '@/lib/types/action-types'
import { DailyReportsSection } from './daily-reports-section'

// ── Dynamic chart import ──────────────────────────────────────
const ConstructionChartsWrapper = dynamic(
  () => import('./construction-charts-wrapper'),
  { ssr: false, loading: () => <div className="h-80 bg-muted animate-pulse rounded" /> }
)

// ─── Constants ────────────────────────────────────────────────

const HEALTH_META: Record<string, { color: string }> = {
  green: { color: '#22c55e' },
  amber: { color: '#f59e0b' },
  red:   { color: '#ef4444' },
}
const DISC_COLORS = ['#64ffda', '#3b82f6', '#f97316', '#a855f7', '#22c55e', '#f59e0b']

// ─── New inspection modal ──────────────────────────────────────

function NewInspectionModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({ title: '', type: 'safety', result: 'pass', location: '' })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title) { toast({ title: 'Title required', variant: 'danger' }); return }
    setLoading(true)
    const { error } = await recordInspection(form)
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Inspection recorded', variant: 'success' })
    onCreated(); onClose()
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Record Inspection</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        {[
          { label: 'Title *', key: 'title', type: 'text' },
          { label: 'Location', key: 'location', type: 'text' },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <input type={type} value={form[key as keyof typeof form]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
        ))}
        {[
          { label: 'Type', key: 'type', options: ['safety', 'quality', 'environmental'] },
          { label: 'Result', key: 'result', options: ['pass', 'fail', 'hold', 'pending'] },
        ].map(({ label, key, options }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1 capitalize">{label}</label>
            <select value={form[key as keyof typeof form]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 capitalize">
              {options.map((o) => <option key={o} className="capitalize">{o}</option>)}
            </select>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>{loading && <Loader2 className="size-3.5 animate-spin" />} Record</Button>
        </div>
      </form>
    </div>
  )
}

// ─── WP row ────────────────────────────────────────────────────

function WPRow({ item }: { item: WorkPackage }) {
  const hm = HEALTH_META[item.health] ?? HEALTH_META.green
  const variance = item.actual_pct - item.planned_pct
  return (
    <tr className="border-b border-border hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{item.wp_code}</td>
      <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[180px] truncate">{item.title}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{item.discipline}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{item.contractor}</td>
      <td className="px-4 py-3">
        <div className="space-y-1 min-w-[80px]">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Plan {item.planned_pct}%</span>
            <span>Act {item.actual_pct}%</span>
          </div>
          <div className="relative h-1.5 bg-muted rounded-full">
            <div className="absolute h-1.5 rounded-full bg-muted-foreground/40" style={{ width: `${item.planned_pct}%` }} />
            <div className="absolute h-1.5 rounded-full bg-[#64ffda]" style={{ width: `${item.actual_pct}%` }} />
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs font-semibold" style={{ color: variance >= 0 ? '#22c55e' : '#ef4444' }}>
        {variance >= 0 ? '+' : ''}{variance}%
      </td>
      <td className="px-4 py-3">
        <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: hm.color }} />
      </td>
    </tr>
  )
}

// ─── Punch item row ─────────────────────────────────────────────

function PunchRow({ item, onClose }: { item: PunchItem; onClose: (id: string) => void }) {
  return (
    <tr className="border-b border-border hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{item.ref}</td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold',
          item.category === 'A' ? 'bg-[#ef4444]/15 text-[#ef4444]' : 'bg-[#f59e0b]/15 text-[#f59e0b]')}>
          Cat {item.category}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[200px] truncate">{item.title}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{item.discipline}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{item.assigned_to}</td>
      <td className="px-4 py-3">
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold',
          item.status === 'closed' ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-[#ef4444]/10 text-[#ef4444]')}>
          {item.status === 'closed' ? 'Closed' : 'Open'}
        </span>
      </td>
      <td className="px-4 py-3">
        {item.status !== 'closed' && (
          <button onClick={() => onClose(item.id)}
            className="text-xs px-2 py-1 rounded bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            Close
          </button>
        )}
      </td>
    </tr>
  )
}

// ��── Main page ────────────────────────────────────────────────

export function ConstructionPage() {
  const { toast } = useToast()
  const [tab, setTab]       = React.useState<'wp' | 'inspections' | 'punch'>('wp')
  const [inspModal, setInspModal] = React.useState(false)
  const { data, isLoading, mutate } = useSWR('construction-dashboard', loadConstructionDashboard, { revalidateOnFocus: true })

  async function handleClosePunch(id: string) {
    const { error } = await closePunchItem(id)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Punch item closed', variant: 'success' })
    mutate()
  }

  const overallPct = (() => {
    const wps = data?.workPackages ?? []
    if (!wps.length) return 0
    return Math.round(wps.reduce((s, w) => s + w.actual_pct, 0) / wps.length)
  })()

  const kpis = [
    { label: 'Work Packages',  value: data?.totalWPs     ?? 0, color: '#64ffda', icon: Hammer       },
    { label: 'Completed WPs',  value: data?.completedWPs ?? 0, color: '#22c55e', icon: CheckCircle2 },
    { label: 'Open Punches',   value: data?.openPunches  ?? 0, color: '#f59e0b', icon: ClipboardList },
    { label: 'Cat A Punches',  value: data?.catAPunches  ?? 0, color: '#ef4444', icon: AlertTriangle },
  ]

  return (
    <>
      <NewInspectionModal open={inspModal} onClose={() => setInspModal(false)} onCreated={() => mutate()} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Construction</h1>
            <p className="text-sm text-muted-foreground mt-0.5">G4–G5 · Work packages, HSE inspections, and punch lists</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()}><RefreshCw className="size-3.5" /></Button>
            <Button size="sm" onClick={() => setInspModal(true)}><Plus className="size-4" /> Record Inspection</Button>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="rounded-xl bg-card border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Overall Construction Progress</span>
            <span className="text-xl font-bold text-[#64ffda]">{overallPct}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-3 rounded-full bg-[#64ffda] transition-all duration-500" style={{ width: `${overallPct}%` }} />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="rounded-xl bg-card border border-border p-4" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
                <Icon className="size-4" style={{ color }} aria-hidden />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
        </div>

        {/* Charts - dynamically loaded */}
        <ConstructionChartsWrapper data={data} isLoading={isLoading} />

        {/* Live badge */}
        <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
          (data?.totalWPs ?? 0) > 0 ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted text-muted-foreground')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', (data?.totalWPs ?? 0) > 0 ? 'bg-[#22c55e]' : 'bg-muted-foreground')} />
          {(data?.totalWPs ?? 0) > 0 ? 'Live data' : 'Illustrative — seed demo to populate'}
        </span>

        {/* Tabs */}
        <div role="tablist" className="flex gap-1 border-b border-border">
          {[
            { id: 'wp'          as const, label: `Work Packages (${data?.totalWPs ?? 0})` },
            { id: 'inspections' as const, label: `Inspections (${data?.inspections?.length ?? 0})` },
            { id: 'punch'       as const, label: `Punch List (${data?.openPunches ?? 0} open)` },
          ].map(({ id, label }) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === id ? 'border-[#64ffda] text-[#64ffda]' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {label}
            </button>
          ))}
        </div>

        {/* Work Packages */}
        {tab === 'wp' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.workPackages?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Hammer className="size-12 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No work packages</p>
                  <p className="text-xs text-muted-foreground">Create work packages via the construction module.</p>
                </div>
              ) : (
                <table className="w-full min-w-[700px] text-sm" role="table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {['WP Code', 'Title', 'Discipline', 'Contractor', 'Progress', 'Variance', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{data!.workPackages.map((w) => <WPRow key={w.id} item={w} />)}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Inspections */}
        {tab === 'inspections' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.inspections?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <HardHat className="size-12 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No inspections recorded</p>
                  <Button size="sm" onClick={() => setInspModal(true)}><Plus className="size-4" /> Record Inspection</Button>
                </div>
              ) : (
                <table className="w-full min-w-[600px] text-sm" role="table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {['Ref', 'Title', 'Type', 'Location', 'Date', 'Result'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data!.inspections.map((i) => (
                      <tr key={i.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{i.ref}</td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground max-w-[180px] truncate">{i.title}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{i.type}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{i.location}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{i.date?.slice(0, 10)}</td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold capitalize',
                            i.result === 'pass' ? 'bg-[#22c55e]/10 text-[#22c55e]' :
                            i.result === 'fail' ? 'bg-[#ef4444]/10 text-[#ef4444]' :
                            i.result === 'hold' ? 'bg-[#f59e0b]/10 text-[#f59e0b]' :
                            'bg-muted text-muted-foreground')}>
                            {i.result ?? 'Pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Punch list */}
        {tab === 'punch' && (
          <Card className="overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading…</div>
              ) : (data?.punchItems?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <ClipboardList className="size-12 text-muted-foreground/30" />
                  <p className="text-sm font-semibold text-foreground">No punch items</p>
                  <p className="text-xs text-muted-foreground">Punch items appear here once recorded.</p>
                </div>
              ) : (
                <table className="w-full min-w-[700px] text-sm" role="table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {['Ref', 'Cat', 'Title', 'Discipline', 'Assigned', 'Status', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{data!.punchItems.map((p) => <PunchRow key={p.id} item={p} onClose={handleClosePunch} />)}</tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quality / ITP nav card */}
        <Card className="rounded-xl border border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                  <ClipboardCheck className="size-5 text-teal-700 dark:text-teal-400" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Quality / ITP Register</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Inspection &amp; Test Plans, hold points, pass rates and open NCRs per project.
                  </p>
                </div>
              </div>
              <Link
                href="/projects"
                className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0"
              >
                Open ITP <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Daily reports (field mode → construction) */}
        <DailyReportsSection />
      </div>
    </>
  )
}
