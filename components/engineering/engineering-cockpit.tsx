'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  Wrench, FileText, CheckCircle2, AlertTriangle, Plus, Search,
  RefreshCw, Loader2, Layers, X, Send, ChevronRight,
} from 'lucide-react'
import { getProjects } from '@/app/actions/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  loadEngineeringDashboard, createRFI, closeRFI,
} from '@/app/actions/engineering'
import type { DrawingRecord, RFIRecord, IFCPackage } from '@/lib/types/action-types'

// ── Status helpers (tolerant of free-text DB values) ────────────────────────

function statusStyle(status: string): string {
  const s = status.toLowerCase()
  if (s === 'approved') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  if (s === 'issued') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (s === 'in_review' || s === 'in-review' || s === 'under-review' || s === 'pending')
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (s === 'rejected' || s === 'overdue') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  if (s === 'superseded') return 'bg-muted text-muted-foreground'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
}

// ── KPI strip ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', color ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function EmptyRow({ colSpan, loading }: { colSpan: number; loading: boolean }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-sm text-muted-foreground">
        {loading ? (
          <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</span>
        ) : (
          'No records yet. Use “Seed Demo” to populate sample data.'
        )}
      </td>
    </tr>
  )
}

// ── Drawings tab ───────────────────────────────────────────────────────────

function DrawingsTab({ drawings, loading }: { drawings: DrawingRecord[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const [discipline, setDiscipline] = useState('all')

  const disciplines = useMemo(() => [...new Set(drawings.map(d => d.discipline))], [drawings])
  const filtered = useMemo(() => drawings.filter(d => {
    if (discipline !== 'all' && d.discipline !== discipline) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.drawing_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [drawings, search, discipline])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search drawings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select
          value={discipline}
          onValueChange={v => setDiscipline(v ?? 'all')}
          options={[{ value: 'all', label: 'All disciplines' }, ...disciplines.map(d => ({ value: d, label: d }))]}
          className="h-8 w-36 text-xs"
        />
      </div>
      <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/60">
            <tr>
              {['Number', 'Title', 'Discipline', 'Rev', 'Status', 'Created'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length === 0 ? <EmptyRow colSpan={6} loading={loading} /> : filtered.map(d => (
              <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs">{d.drawing_number}</td>
                <td className="px-3 py-2.5 font-medium">{d.title}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.discipline}</td>
                <td className="px-3 py-2.5 font-mono text-center">{d.revision}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', statusStyle(d.status))}>{d.status}</span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{new Date(d.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── RFI tab ────────────────────────────────────────────────────────────────

function NewRFIModal({ open, onClose, onCreated, projects }: { open: boolean; onClose: () => void; onCreated: () => void; projects: any[] }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', discipline: 'Civil', description: '', projectId: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.projectId) { toast({ title: 'All fields required', variant: 'danger' }); return }
    setLoading(true)
    const { error } = await createRFI(form)
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'RFI raised', variant: 'success' })
    onCreated(); onClose()
    setForm({ title: '', discipline: 'Civil', description: '', projectId: '' })
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">New RFI</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Project *</label>
          <select value={form.projectId} onChange={(e) => setForm(f => ({ ...f, projectId: e.target.value }))}
            className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-400">
            <option value="">Select a project...</option>
            {projects?.map((p: any) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Subject *</label>
          <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Discipline</label>
          <select value={form.discipline} onChange={e => setForm(f => ({ ...f, discipline: e.target.value }))}
            className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground">
            {['Civil', 'Structural', 'Mechanical', 'Electrical', 'Instrumentation'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
            className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading || !form.projectId}>{loading && <Loader2 className="size-3.5 animate-spin" />} Raise RFI</Button>
        </div>
      </form>
    </div>
  )
}

function RFITab({ rfis, loading, onChanged, projects }: { rfis: RFIRecord[]; loading: boolean; onChanged: () => void; projects: any[] }) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const filtered = useMemo(() => rfis.filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase())), [rfis, search])

  async function handleClose(id: string) {
    const { error } = await closeRFI(id)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'RFI closed', variant: 'success' })
    onChanged()
  }

  return (
    <div className="space-y-4">
      <NewRFIModal open={modal} onClose={() => setModal(false)} onCreated={onChanged} projects={projects} />
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search RFIs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setModal(true)}><Plus size={12} /> New RFI</Button>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
          {loading ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</span> : 'No RFIs yet.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => (
            <div key={r.id} className="rounded-lg border border-border/60 bg-card p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-muted-foreground">{r.ref}</span>
                    {r.is_overdue && <AlertTriangle size={12} className="text-red-500" />}
                    <span className="text-xs text-muted-foreground">{r.discipline} · open {r.days_open}d</span>
                  </div>
                  <p className="font-medium text-sm mt-0.5">{r.title}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', statusStyle(r.is_overdue ? 'overdue' : r.status))}>
                    {r.is_overdue ? 'overdue' : r.status}
                  </span>
                  {r.status !== 'closed' && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => handleClose(r.id)}>Close</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── IFC Packages tab (real engineering_packages) ─────────────────────────────

function PackagesTab({ packages, loading }: { packages: IFCPackage[]; loading: boolean }) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => packages.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.package_number.toLowerCase().includes(search.toLowerCase())
  ), [packages, search])

  return (
    <div className="space-y-4">
      <div className="relative min-w-48 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search packages..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
      </div>
      <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/60">
            <tr>
              {['Package', 'Title', 'Discipline', 'Rev', 'Status', 'Completion'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length === 0 ? <EmptyRow colSpan={6} loading={loading} /> : filtered.map(p => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs">{p.package_number}</td>
                <td className="px-3 py-2.5 font-medium">{p.title}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{p.discipline}</td>
                <td className="px-3 py-2.5 font-mono text-center">{p.revision}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', statusStyle(p.status))}>{p.status}</span>
                </td>
                <td className="px-3 py-2.5 w-40">
                  <div className="flex items-center gap-2">
                    <Progress value={p.completion_pct} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-9 text-right">{p.completion_pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export type EngineeringTab = 'drawings' | 'rfis' | 'packages'

export function EngineeringCockpit({ initialTab = 'drawings' }: { initialTab?: EngineeringTab }) {
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR('engineering-dashboard', loadEngineeringDashboard, { revalidateOnFocus: true })
  const { data: projects = [] } = useSWR('projects-for-cockpit-rfi', () => getProjects())
  const transmittalsHref = projects && projects.length > 0 ? `/projects/${projects[0].id}/transmittals` : null
  const drawings = data?.drawings ?? []
  const rfis = data?.rfis ?? []
  const packages = data?.packages ?? []
  const totalPackages = data?.totalPackages ?? 0
  const approvedPackages = data?.approvedPackages ?? 0
  const openRFIs = data?.openRFIs ?? 0
  const overdueRFIs = data?.overdueRFIs ?? 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Wrench size={20} className="text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Engineering Cockpit</h1>
            <p className="text-sm text-muted-foreground">Drawings, RFIs & IFC Packages</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh"><RefreshCw size={14} /></Button>
        </div>
      </div>

      {/* KPI strip (real data) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="IFC Packages" value={totalPackages} sub={`${approvedPackages} approved`} />
        <KpiCard label="Package Approval Rate" value={totalPackages ? `${Math.round(approvedPackages / totalPackages * 100)}%` : '—'} color="text-green-600" />
        <KpiCard label="Open RFIs" value={openRFIs} sub={overdueRFIs > 0 ? `${overdueRFIs} overdue` : 'None overdue'} color={overdueRFIs > 0 ? 'text-red-500' : undefined} />
        <KpiCard label="Drawings" value={drawings.length} sub="In register" />
      </div>

      {/* Transmittals register nav card */}
      {transmittalsHref && (
        <Link
          href={transmittalsHref}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-4 hover:bg-muted/40 transition-colors"
        >
          <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/30">
            <Send size={18} className="text-sky-600 dark:text-sky-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Transmittals</p>
            <p className="text-xs text-muted-foreground">Formal document transmittal log — issue, track responses & close out.</p>
          </div>
          <ChevronRight size={16} className="text-muted-foreground shrink-0" />
        </Link>
      )}

      {/* Tabs */}
      <Tabs defaultValue={initialTab}>
        <TabsList className="w-fit">
          <TabsTrigger value="drawings" className="gap-1.5"><FileText size={13} /> Drawings</TabsTrigger>
          <TabsTrigger value="rfis" className="gap-1.5"><AlertTriangle size={13} /> RFIs</TabsTrigger>
          <TabsTrigger value="packages" className="gap-1.5"><Layers size={13} /> IFC Packages</TabsTrigger>
        </TabsList>
        <TabsContent value="drawings" className="mt-4"><DrawingsTab drawings={drawings} loading={isLoading} /></TabsContent>
        <TabsContent value="rfis" className="mt-4"><RFITab rfis={rfis} loading={isLoading} onChanged={() => mutate()} projects={projects} /></TabsContent>
        <TabsContent value="packages" className="mt-4"><PackagesTab packages={packages} loading={isLoading} /></TabsContent>
      </Tabs>
    </div>
  )
}
