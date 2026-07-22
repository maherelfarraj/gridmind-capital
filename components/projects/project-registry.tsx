'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, SlidersHorizontal, MoreVertical, Archive, Copy, ExternalLink,
  FolderKanban, CheckCircle2, AlertTriangle, XCircle, Loader2, X
} from 'lucide-react'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { mockStore, type GmcProject } from '@/lib/mock-store'
import { getProjects, archiveProject, duplicateProject } from '@/app/actions/projects'
import type { Project } from '@/components/projects/projects-list-page'

/** Map a live DB row to the display shape used by the registry UI. */
function toGmcProject(p: Project): GmcProject {
  const phaseToType: Record<string, GmcProject['type']> = {
    solar: 'PV', pv: 'PV', wind: 'Wind', bess: 'BESS', storage: 'BESS',
  }
  const tok = (p.client_name ?? '').toLowerCase()
  const type = Object.entries(phaseToType).find(([k]) => tok.includes(k))?.[1] ?? 'PV'
  const statusMap: Record<string, GmcProject['status']> = {
    active: 'active', draft: 'draft', 'on-hold': 'on-hold', completed: 'completed',
    cancelled: 'archived', archived: 'archived',
  }
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    type,
    country: 'N/A',
    region: 'N/A',
    siteCoordinates: 'N/A',
    developerSpv: p.client_name ?? 'N/A',
    mwac: 0,
    mwp: 0,
    gridVoltage: 'N/A',
    codTarget: p.target_cod ?? '',
    ppaType: 'PPA',
    capex: p.budget_amount ?? 0,
    currency: 'USD',
    equityPct: 0,
    debtPct: 0,
    targetIrr: 0,
    tariffAssumption: 'N/A',
    team: { projectDirector: '', pmoLead: '', engineeringLead: '', procurementLead: '', constructionManager: '', financeLead: '' },
    currentGate: p.gate ?? 'G0',
    health: 'green',
    status: statusMap[p.status] ?? 'active',
    createdAt: new Date().toISOString(),
  }
}

/* ─── Types ─────────────────────────────────────────────────── */
type HealthColor = 'green' | 'amber' | 'red'

/* ─── Helpers ───────────────────────────────────────────────── */
function fmtBudget(n: number, cur: string): string {
  const sym = cur === 'USD' ? '$' : cur === 'GBP' ? '£' : cur === 'EUR' ? '€' : cur + ' '
  if (n >= 1e9) return `${sym}${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${sym}${(n / 1e6).toFixed(0)}M`
  return `${sym}${n.toLocaleString()}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* ─── Gate badge ─────────────────────────────────────────────── */
function GateBadge({ gate }: { gate: string }) {
  const colors: Record<string, string> = {
    G0: 'bg-slate-100 text-slate-700', G1: 'bg-sky-100 text-sky-700',
    G2: 'bg-blue-100 text-blue-700',   G3: 'bg-indigo-100 text-indigo-700',
    G4: 'bg-violet-100 text-violet-700', G5: 'bg-purple-100 text-purple-700',
    G6: 'bg-green-100 text-green-700',
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold', colors[gate] ?? 'bg-slate-100 text-slate-700')}>
      {gate}
    </span>
  )
}

/* ─── Health indicator ───────────────────────────────────────── */
function HealthDot({ health }: { health: HealthColor }) {
  const map = { green: 'bg-green-500', amber: 'bg-amber-400', red: 'bg-red-500' }
  const label = { green: 'On Track', amber: 'At Risk', red: 'Off Track' }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full shrink-0', map[health])} />
      <span className="text-sm text-slate-600 dark:text-muted-foreground">{label[health]}</span>
    </span>
  )
}

/* ─── Archive confirm modal ──────────────────────────────────── */
function ArchiveModal({ project, onConfirm, onClose }: { project: GmcProject; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-card rounded-xl shadow-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="size-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
            <Archive className="size-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-foreground">Archive Project</h3>
            <p className="text-sm text-slate-500 dark:text-muted-foreground mt-1">
              Archive <strong>{project.name}</strong>? This will be logged in the audit trail and cannot be undone without admin access.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            Archive Project
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Row actions ────────────────────────────────────────────── */
function RowActions({ project, onOpen, onClone, onArchive }: {
  project: GmcProject
  onOpen: () => void
  onClone: () => void
  onArchive: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-accent text-slate-400 dark:text-muted-foreground transition-colors"
        aria-label="Row actions"
      >
        <MoreVertical className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-44 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl shadow-xl overflow-hidden">
          <button onClick={() => { onOpen(); setOpen(false) }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-accent flex items-center gap-2">
            <ExternalLink className="size-3.5" /> Open
          </button>
          <button onClick={() => { onClone(); setOpen(false) }} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-foreground hover:bg-slate-50 dark:hover:bg-accent flex items-center gap-2">
            <Copy className="size-3.5" /> Clone as Draft
          </button>
          <button onClick={() => { onArchive(); setOpen(false) }} className="w-full text-left px-4 py-2.5 text-sm text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2">
            <Archive className="size-3.5" /> Archive
          </button>
        </div>
      )}
    </div>
  )
}

/* ─── Toast ──────────────────────────────────────────────────── */
function useToast() {
  const [toasts, setToasts] = React.useState<{ id: string; msg: string; type: 'success' | 'info' | 'warning' }[]>([])
  function show(msg: string, type: 'success' | 'info' | 'warning' = 'success') {
    const id = `t-${Date.now()}`
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }
  return { toasts, show }
}

/* ─── Main Component ─────────────────────────────────────────── */
export function ProjectRegistry() {
  const router = useRouter()
  const { toasts, show } = useToast()
  const [search, setSearch] = React.useState('')
  const [filterType, setFilterType] = React.useState<string>('All')
  const [filterGate, setFilterGate] = React.useState<string>('All')
  const [filterHealth, setFilterHealth] = React.useState<string>('All')
  const [filterOpen, setFilterOpen] = React.useState(false)
  const [archiveTarget, setArchiveTarget] = React.useState<GmcProject | null>(null)

  // Live data — SWR fetches from real DB; falls back to mock when empty
  const { data: liveRows, mutate } = useSWR<Project[]>(
    'project-registry-live',
    () => getProjects({ status: null }),
    { revalidateOnFocus: true },
  )
  const projects: GmcProject[] = React.useMemo(() => {
    if (liveRows && liveRows.length > 0) {
      return liveRows
        .filter(p => p.status !== 'cancelled' && p.status !== 'archived')
        .map(toGmcProject)
    }
    return mockStore.getProjects().filter(p => p.status !== 'archived')
  }, [liveRows])

  const filtered = React.useMemo(() => {
    return projects.filter(p => {
      if (search) {
        const q = search.toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false
      }
      if (filterType !== 'All' && p.type !== filterType) return false
      if (filterGate !== 'All' && p.currentGate !== filterGate) return false
      if (filterHealth !== 'All' && p.health !== filterHealth.toLowerCase()) return false
      return true
    })
  }, [projects, search, filterType, filterGate, filterHealth])

  function handleOpen(p: GmcProject) {
    router.push(`/projects/${p.id}`)
  }

  async function handleClone(p: GmcProject) {
    const result = await duplicateProject(p.id)
    if ('error' in result && result.error) {
      show(`Clone failed: ${result.error}`, 'error')
      return
    }
    mutate()
    show(`Cloned "${p.name}" as a new draft`, 'info')
  }

  async function handleArchive(p: GmcProject) {
    const result = await archiveProject(p.id)
    if (result.error) {
      show(`Archive failed: ${result.error}`, 'error')
      return
    }
    mutate()
    setArchiveTarget(null)
    show(`"${p.name}" archived`, 'warning')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground">Project Registry</h1>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">{projects.length} active projects</p>
        </div>
        <Button onClick={() => router.push('/projects/new')} className="gap-2 bg-[#0a192f] hover:bg-[#112240] dark:bg-[#64ffda] dark:text-[#0a192f] dark:hover:bg-[#4cd6b5] text-white">
          <Plus className="size-4" /> New Project
        </Button>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card text-sm outline-none focus:border-sky-400 dark:focus:border-ring transition-colors"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"><X className="size-3.5" /></button>}
        </div>
        <div className="relative">
          <button
            onClick={() => setFilterOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-slate-200 dark:border-border bg-white dark:bg-card text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent transition-colors"
          >
            <SlidersHorizontal className="size-4" /> Filters
          </button>
          {filterOpen && (
            <div className="absolute right-0 top-full mt-2 z-30 w-64 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl shadow-xl p-4 space-y-4">
              {[
                { label: 'Type', value: filterType, set: setFilterType, opts: ['All', 'PV', 'PV+BESS', 'Wind', 'Wind+BESS', 'BESS'] },
                { label: 'Gate', value: filterGate, set: setFilterGate, opts: ['All', 'G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] },
                { label: 'Health', value: filterHealth, set: setFilterHealth, opts: ['All', 'Green', 'Amber', 'Red'] },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-1.5">{f.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {f.opts.map(o => (
                      <button key={o} onClick={() => f.set(o)}
                        className={cn('px-2 py-0.5 rounded-full text-xs font-medium border transition-colors',
                          f.value === o ? 'bg-[#0a192f] text-white border-transparent dark:bg-[#64ffda] dark:text-[#0a192f]'
                            : 'border-slate-200 dark:border-border text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent'
                        )}>{o}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 rounded-xl border border-dashed border-slate-200 dark:border-border">
          <FolderKanban className="size-12 text-slate-300 dark:text-muted-foreground" />
          <p className="text-slate-500 dark:text-muted-foreground font-medium">
            {projects.length === 0 ? 'No projects yet' : 'No projects match your filters'}
          </p>
          {projects.length === 0 && (
            <Button onClick={() => router.push('/projects/new')} className="gap-2 bg-[#0a192f] text-white dark:bg-[#64ffda] dark:text-[#0a192f]">
              <Plus className="size-4" /> Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-border bg-slate-50 dark:bg-muted/40">
                  {['Project ID', 'Name', 'Type', 'Country', 'MW', 'Gate', 'Health', 'Budget', 'Project Director', 'Created', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    onClick={() => handleOpen(p)}
                    className={cn(
                      'border-b border-slate-100 dark:border-border/50 cursor-pointer transition-colors hover:bg-sky-50/50 dark:hover:bg-accent/30',
                      i % 2 === 0 ? 'bg-white dark:bg-background' : 'bg-slate-50/50 dark:bg-card/50'
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-muted-foreground whitespace-nowrap">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-foreground max-w-[220px] truncate">{p.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded text-xs font-medium">{p.type}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-muted-foreground whitespace-nowrap">{p.country}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-muted-foreground whitespace-nowrap">{p.mwac.toLocaleString()} MW</td>
                    <td className="px-4 py-3"><GateBadge gate={p.currentGate} /></td>
                    <td className="px-4 py-3"><HealthDot health={p.health} /></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-muted-foreground whitespace-nowrap">{fmtBudget(p.capex, p.currency)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-muted-foreground whitespace-nowrap">{p.team.projectDirector}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-muted-foreground whitespace-nowrap text-xs">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <RowActions project={p} onOpen={() => handleOpen(p)} onClone={() => handleClone(p)} onArchive={() => setArchiveTarget(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Archive modal */}
      {archiveTarget && (
        <ArchiveModal project={archiveTarget} onConfirm={() => handleArchive(archiveTarget)} onClose={() => setArchiveTarget(null)} />
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={cn(
            'px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white pointer-events-auto',
            t.type === 'success' ? 'bg-green-600' : t.type === 'warning' ? 'bg-amber-600' : 'bg-sky-600'
          )}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
