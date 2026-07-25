'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis, CartesianGrid,
} from 'recharts'
import {
  Plus, RefreshCw, Loader2, AlertTriangle, Shield, TrendingDown, X, ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  loadRisksDashboard, createRisk, closeRisk, getRiskOwnerOptions,
} from '@/app/actions/risks'
import type { RiskRecord } from '@/lib/types/action-types'

// ─── Constants ────────────────────────────────────────────────

const RAG_META: Record<string, { color: string; label: string }> = {
  green: { color: '#22c55e', label: 'Low'    },
  amber: { color: '#f59e0b', label: 'Medium' },
  red:   { color: '#ef4444', label: 'High'   },
}
const RAG_FALLBACK = { color: '#94a3b8', label: 'Unknown' }
const CAT_COLORS = ['#64ffda', '#3b82f6', '#f97316', '#a855f7', '#22c55e', '#f59e0b']
const CATEGORIES = ['Technical', 'Schedule', 'Commercial', 'Procurement', 'Regulatory', 'External', 'HSE']

// heatmap cell bg colours: score = row*col, 1..25
function heatColor(prob: number, imp: number) {
  const s = prob * imp
  if (s >= 12) return '#ef4444'
  if (s >= 5)  return '#f59e0b'
  return '#22c55e'
}

// ─── New risk modal ────────────────────────────────────────────

function NewRiskModal({ open, onClose, onCreated, projectId }: {
  open: boolean; onClose: () => void; onCreated: () => void; projectId?: string
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    title: '', category: 'Technical', probability: 3, impact: 3, ownerId: '', mitigation: '',
  })
  // Owner is a uuid picked from real profiles — `risks.owner_id` is a FK to
  // profiles, so free text can't be stored. Only fetched while the modal is open.
  const { data: owners, isLoading: ownersLoading } = useSWR(
    open ? `risk-owners-${projectId ?? 'all'}` : null,
    () => getRiskOwnerOptions(projectId),
  )
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.ownerId) { toast({ title: 'Title and owner are required', variant: 'danger' }); return }
    setLoading(true)
    const { error } = await createRisk({ ...form, project_id: projectId })
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Risk created', variant: 'success' })
    setForm({ title: '', category: 'Technical', probability: 3, impact: 3, ownerId: '', mitigation: '' })
    onCreated(); onClose()
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">New Risk</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="risk-title" className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
            <input id="risk-title" type="text" value={form.title} onChange={(e) => set('title', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div>
            <label htmlFor="risk-owner" className="block text-xs font-medium text-muted-foreground mb-1">Owner *</label>
            <select id="risk-owner" value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}
              disabled={ownersLoading}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 disabled:opacity-60">
              <option value="">{ownersLoading ? 'Loading people…' : 'Select an owner…'}</option>
              {/* Project team members are listed first, then the wider tenant. */}
              {(owners ?? []).some((o) => o.onTeam) && (
                <optgroup label="Project team">
                  {(owners ?? []).filter((o) => o.onTeam).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}{o.role ? ` — ${o.role}` : ''}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label={projectId ? 'Other people' : 'People'}>
                {(owners ?? []).filter((o) => !o.onTeam).map((o) => (
                  <option key={o.id} value={o.id}>{o.name}{o.role ? ` — ${o.role}` : ''}</option>
                ))}
              </optgroup>
            </select>
            {!ownersLoading && (owners?.length ?? 0) === 0 && (
              <p className="text-[11px] text-muted-foreground mt-1">No people found in this tenant.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
            <select value={form.category} onChange={(e) => set('category', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40">
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          {(['probability', 'impact'] as const).map((k) => (
            <div key={k}>
              <label className="block text-xs font-medium text-muted-foreground mb-1 capitalize">{k} (1–5)</label>
              <input type="range" min={1} max={5} value={form[k]} onChange={(e) => set(k, Number(e.target.value))}
                className="w-full accent-[#64ffda]" />
              <span className="text-xs text-muted-foreground">{form[k]} / 5</span>
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Mitigation</label>
            <textarea rows={2} value={form.mitigation} onChange={(e) => set('mitigation', e.target.value)}
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />} Create Risk
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── 5×5 Heatmap ──────────────────────────────────────────────

function RiskHeatmap({ matrix }: { matrix: { probability: number; impact: number; title: string; id: string; score: number }[] }) {
  const LABELS = ['1 Rare', '2 Unlikely', '3 Possible', '4 Likely', '5 Almost Certain']
  const IMP    = ['1 Insignif.', '2 Minor', '3 Moderate', '4 Major', '5 Catastrophic']

  // count per cell
  const counts: Record<string, number> = {}
  matrix.forEach((d) => {
    const key = `${d.probability}_${d.impact}`
    counts[key] = (counts[key] ?? 0) + 1
  })

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[300px]">
        <div className="flex mb-1">
          <div className="w-8 shrink-0" />
          {IMP.map((l) => (
            <div key={l} className="flex-1 text-center text-[9px] text-muted-foreground leading-tight px-0.5">{l}</div>
          ))}
        </div>
        {[5, 4, 3, 2, 1].map((p) => (
          <div key={p} className="flex mb-1 items-center">
            <div className="w-8 shrink-0 text-[9px] text-muted-foreground text-right pr-1">{LABELS[p - 1]?.split(' ')[0]}</div>
            {[1, 2, 3, 4, 5].map((imp) => {
              const c = counts[`${p}_${imp}`] ?? 0
              return (
                <div key={imp} className="flex-1 mx-0.5 rounded aspect-square flex items-center justify-center text-xs font-bold text-white transition-all"
                  style={{ backgroundColor: `${heatColor(p, imp)}${c > 0 ? '' : '30'}`, border: `1px solid ${heatColor(p, imp)}40` }}
                  title={`P${p}×I${imp} = ${p * imp}${c > 0 ? ` (${c} risks)` : ''}`}>
                  {c > 0 ? c : <span className="text-[8px] opacity-30">{p * imp}</span>}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Risk row ──────────────────────────────────────────────────

function RiskRow({ item, onClose }: { item: RiskRecord; onClose: (id: string) => void }) {
  const [exp, setExp] = React.useState(false)
  const rag = RAG_META[item.rag] ?? RAG_FALLBACK
  return (
    <div className="border-b border-border last:border-0">
      <button type="button" onClick={() => setExp((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: rag.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-[#64ffda]">{item.code}</span>
            <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
          </div>
          <div className="flex gap-3 mt-0.5 text-[11px] text-muted-foreground">
            <span>{item.category}</span>
            <span>P:{item.probability} × I:{item.impact} = <strong>{item.score}</strong></span>
            <span>{item.owner}</span>
          </div>
        </div>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded shrink-0"
          style={{ color: rag.color, backgroundColor: `${rag.color}15` }}>{rag.label}</span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform shrink-0', exp && 'rotate-180')} />
      </button>
      {exp && (
        <div className="px-4 pb-3 pt-1 bg-muted/10 border-t border-border/50 space-y-2">
          <p className="text-sm text-muted-foreground">{item.mitigation || 'No mitigation documented.'}</p>
          {item.status === 'open' && (
            <Button size="sm" variant="outline" onClick={() => onClose(item.id)}>
              <Shield className="size-3.5" /> Close / Mitigate
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export function RisksPage({ projectId }: { projectId?: string }) {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = React.useState(false)
  const [tab, setTab] = React.useState<'register' | 'matrix'>('register')

  const { data, isLoading, mutate } = useSWR(
    projectId ? `risks-${projectId}` : 'risks-dashboard',
    () => loadRisksDashboard(projectId),
    { revalidateOnFocus: true },
  )

  async function handleClose(id: string) {
    const { error } = await closeRisk(id)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Risk closed', variant: 'success' })
    mutate()
  }

  const kpis = [
    { label: 'Total Risks',     value: data?.total          ?? 0, color: '#64ffda', icon: AlertTriangle },
    { label: 'Open',            value: data?.open           ?? 0, color: '#3b82f6', icon: Shield        },
    { label: 'High / Critical', value: data?.highOrCritical ?? 0, color: '#ef4444', icon: AlertTriangle },
  ]

  return (
    <>
      <NewRiskModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => mutate()} projectId={projectId} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Risk Register</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Project risks, probability-impact matrix, and mitigation plans</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()}><RefreshCw className="size-3.5" /></Button>
            <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4" /> New Risk</Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
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

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Risks by Category</CardTitle></CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : (data?.byCategory?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data — seed demo first</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.byCategory} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" name="Risks" radius={[4, 4, 0, 0]}>
                      {(data?.byCategory ?? []).map((_, i) => <Cell key={i} fill={CAT_COLORS[i % CAT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Risk Bands</CardTitle></CardHeader>
            <CardContent className="h-48">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : (data?.byBand?.every((b) => b.value === 0) ?? true) ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data!.byBand.filter((b) => b.value > 0)} dataKey="value" nameKey="name"
                      cx="50%" cy="50%" outerRadius={70}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {(data?.byBand ?? []).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live badge */}
        <span className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
          (data?.total ?? 0) > 0 ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted text-muted-foreground',
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', (data?.total ?? 0) > 0 ? 'bg-[#22c55e]' : 'bg-muted-foreground')} />
          {(data?.total ?? 0) > 0 ? 'Live data' : 'Illustrative — seed demo to populate'}
        </span>

        {/* Tabs */}
        <div role="tablist" className="flex gap-1 border-b border-border">
          {(['register', 'matrix'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn('px-4 py-2 text-sm font-medium border-b-2 -mb-px capitalize transition-colors',
                tab === t ? 'border-[#64ffda] text-[#64ffda]' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t === 'register' ? 'Risk Register' : '5×5 Heatmap'}
            </button>
          ))}
        </div>

        {tab === 'register' && (
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : (data?.items?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <TrendingDown className="size-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-foreground">No risks registered</p>
                  <Button size="sm" className="mt-4" onClick={() => setModalOpen(true)}><Plus className="size-4" /> New Risk</Button>
                </div>
              ) : (
                data!.items.map((r) => <RiskRow key={r.id} item={r} onClose={handleClose} />)
              )}
            </CardContent>
          </Card>
        )}

        {tab === 'matrix' && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Probability × Impact Heatmap</CardTitle>
              <p className="text-xs text-muted-foreground">Numbers in cells = risk count</p>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : (
                <RiskHeatmap matrix={data?.matrixData ?? []} />
              )}
              <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
                {[{ c: '#22c55e', l: 'Low (1–4)' }, { c: '#f59e0b', l: 'Medium (5–9)' }, { c: '#ef4444', l: 'High (10–25)' }].map(({ c, l }) => (
                  <span key={l} className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: c }} />{l}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
