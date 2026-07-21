'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts'
import {
  ArrowLeft, Plus, RefreshCw, Loader2, Users, TrendingUp, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import {
  loadStakeholdersDashboard, createStakeholder, seedStakeholdersDemoData,
} from '@/app/actions/projects'
import type { Stakeholder } from '@/app/actions/projects'

// ─── Constants ─────────────────────────────────────────────────

const ENGAGEMENT_META: Record<string, { color: string; label: string }> = {
  high:      { color: '#22c55e', label: 'High' },
  medium:    { color: '#3b82f6', label: 'Medium' },
  low:       { color: '#f59e0b', label: 'Low' },
  resistant: { color: '#ef4444', label: 'Resistant' },
}
const ROLE_COLORS = ['#64ffda', '#3b82f6', '#f97316', '#a855f7', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899']

// ─── Quadrant label helper ──────────────────────────────────────

function quadrantLabel(influence: number, interest: number): string {
  const highInf = influence >= 3
  const highInt = interest >= 3
  if (highInf && highInt)  return 'Manage Closely'
  if (highInf && !highInt) return 'Keep Satisfied'
  if (!highInf && highInt) return 'Keep Informed'
  return 'Monitor'
}

// ─── Add Stakeholder Modal ──────────────────────────────────────

function AddStakeholderModal({ open, onClose, projectId, onCreated }: {
  open: boolean; onClose: () => void; projectId: string; onCreated: () => void
}) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    name: '', organisation: '', role: 'Client',
    influence: 3, interest: 3, engagement: 'medium', notes: '',
  })
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })) }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.organisation) {
      toast({ title: 'Name and organisation are required', variant: 'danger' }); return
    }
    setLoading(true)
    const { error } = await createStakeholder({ project_id: projectId, ...form })
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'Stakeholder added', variant: 'success' })
    onCreated(); onClose()
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Add Stakeholder</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Name *</label>
            <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ministry of Energy"
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Organisation *</label>
            <input type="text" value={form.organisation} onChange={(e) => set('organisation', e.target.value)} placeholder="e.g. Government"
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Role</label>
            <input type="text" value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Regulator"
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Engagement</label>
            <select value={form.engagement} onChange={(e) => set('engagement', e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40">
              {['high', 'medium', 'low', 'resistant'].map((e) => (
                <option key={e} value={e} className="capitalize">{e.charAt(0).toUpperCase() + e.slice(1)}</option>
              ))}
            </select>
          </div>
          {/* Influence + Interest sliders */}
          {[
            { label: 'Influence', key: 'influence' as const },
            { label: 'Interest',  key: 'interest'  as const },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {label}: <span className="text-foreground font-bold">{form[key]}</span>
              </label>
              <input type="range" min={1} max={5} value={form[key]}
                onChange={(e) => set(key, Number(e.target.value))}
                className="w-full accent-[#64ffda]" />
            </div>
          ))}
          <div className="col-span-2">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Key interests, concerns, engagement plan…"
              className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            Add Stakeholder
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Custom scatter dot ─────────────────────────────────────────

function ScatterDot(props: {
  cx?: number; cy?: number; fill?: string; payload?: Stakeholder & { engagement: string }
}) {
  const { cx = 0, cy = 0, payload } = props
  const meta = ENGAGEMENT_META[payload?.engagement ?? 'medium']
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill={`${meta.color}30`} stroke={meta.color} strokeWidth={1.5} />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={9} fill={meta.color} fontWeight="600">
        {(payload?.name ?? '').slice(0, 2).toUpperCase()}
      </text>
    </g>
  )
}

// ─── Main component ─────────────────────────────────────────────

export function StakeholdersPage({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = React.useState(false)
  const [seeding, setSeeding]     = React.useState(false)

  const { data, isLoading, mutate } = useSWR(
    `stakeholders-${projectId}`,
    () => loadStakeholdersDashboard(projectId),
    { revalidateOnFocus: true },
  )

  async function handleSeed() {
    setSeeding(true)
    const { error } = await seedStakeholdersDemoData(projectId)
    setSeeding(false)
    if (error) { toast({ title: 'Seed failed', description: error, variant: 'danger' }); return }
    toast({ title: 'Demo data seeded', variant: 'success' })
    mutate()
  }

  const items      = data?.items      ?? []
  const byType     = data?.byType     ?? []
  const byEngagement = data?.byEngagement ?? []
  const matrixData = data?.matrixData ?? []

  const kpis = [
    { label: 'Total',           value: data?.total          ?? 0, color: '#64ffda' },
    { label: 'High Engagement', value: data?.highEngagement ?? 0, color: '#22c55e' },
  ]

  // Quadrant engagement plan
  const quadrants = ['Manage Closely', 'Keep Satisfied', 'Keep Informed', 'Monitor'] as const
  const quadrantItems: Record<string, Stakeholder[]> = {
    'Manage Closely': items.filter((s) => s.influence >= 3 && s.interest >= 3),
    'Keep Satisfied': items.filter((s) => s.influence >= 3 && s.interest < 3),
    'Keep Informed':  items.filter((s) => s.influence < 3  && s.interest >= 3),
    'Monitor':        items.filter((s) => s.influence < 3  && s.interest < 3),
  }
  const quadrantColors: Record<string, string> = {
    'Manage Closely': '#22c55e', 'Keep Satisfied': '#3b82f6',
    'Keep Informed':  '#f59e0b', 'Monitor':        '#94a3b8',
  }

  return (
    <>
      <AddStakeholderModal open={modalOpen} onClose={() => setModalOpen(false)} projectId={projectId} onCreated={() => mutate()} />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
              <ArrowLeft className="size-3.5" /> Back to project
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Stakeholder Matrix</h1>
            <p className="text-sm text-muted-foreground mt-0.5">G1 · Influence/interest mapping and engagement planning</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh"><RefreshCw className="size-3.5" /></Button>
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="size-3.5 animate-spin" /> : 'Seed Demo'}
            </Button>
            <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-4" /> Add Stakeholder</Button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ label, value, color }) => (
            <div key={label} className="rounded-xl bg-card border border-border p-4" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium block mb-1">{label}</span>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </div>
          ))}
          {/* Quadrant summary chips */}
          {quadrants.slice(0, 2).map((q) => (
            <div key={q} className="rounded-xl bg-card border border-border p-4" style={{ borderLeftColor: quadrantColors[q], borderLeftWidth: 3 }}>
              <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium block mb-1">{q}</span>
              <p className="text-2xl font-bold text-foreground">{quadrantItems[q].length}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Influence/Interest scatter */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Influence / Interest Matrix</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : matrixData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data — seed demo first</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" dataKey="interest"  domain={[0.5, 5.5]} name="Interest"  label={{ value: 'Interest',  position: 'insideBottom', offset: -8, fontSize: 10, fill: 'var(--muted-foreground)' }} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="number" dataKey="influence" domain={[0.5, 5.5]} name="Influence" label={{ value: 'Influence', angle: -90, position: 'insideLeft', offset: 8, fontSize: 10, fill: 'var(--muted-foreground)' }} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <ZAxis range={[200, 200]} />
                    <Tooltip
                      cursor={{ strokeDasharray: '3 3' }}
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={(v, name) => [v, name]}
                      content={({ payload }) => {
                        const p = payload?.[0]?.payload
                        if (!p) return null
                        const meta = ENGAGEMENT_META[p.engagement ?? 'medium']
                        return (
                          <div className="bg-card border border-border rounded-lg p-2.5 text-xs shadow-lg">
                            <p className="font-semibold text-foreground mb-1">{p.name}</p>
                            <p className="text-muted-foreground">Influence: {p.influence} · Interest: {p.interest}</p>
                            <p style={{ color: meta.color }}>{quadrantLabel(p.influence, p.interest)}</p>
                          </div>
                        )
                      }}
                    />
                    <Scatter data={matrixData} shape={<ScatterDot />} />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Stakeholders by role */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Stakeholders by Role</CardTitle>
            </CardHeader>
            <CardContent className="h-56">
              {isLoading ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" /> Loading…</div>
              ) : byType.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                      {byType.map((_, i) => <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
            items.length > 0 ? 'bg-[#22c55e]/10 text-[#22c55e]' : 'bg-muted text-muted-foreground',
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full', items.length > 0 ? 'bg-[#22c55e]' : 'bg-muted-foreground')} />
            {items.length > 0 ? 'Live data' : 'Illustrative — seed demo to populate'}
          </span>
        </div>

        {/* Quadrant engagement plan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {quadrants.map((q) => (
            <div key={q} className="rounded-xl bg-card border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: quadrantColors[q] }} />
                <h3 className="text-sm font-semibold text-foreground">{q}</h3>
                <span className="ml-auto text-xs text-muted-foreground">{quadrantItems[q].length} stakeholder{quadrantItems[q].length !== 1 ? 's' : ''}</span>
              </div>
              {quadrantItems[q].length === 0 ? (
                <p className="text-xs text-muted-foreground italic">None assigned</p>
              ) : (
                <div className="space-y-1.5">
                  {quadrantItems[q].map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                        style={{ background: `${quadrantColors[q]}20`, color: quadrantColors[q] }}>
                        {s.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{s.role} · {s.organisation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Stakeholder register table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Stakeholder Register</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 rounded-lg bg-muted/40 animate-pulse" />
              ))}</div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="size-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold text-foreground">No stakeholders yet</p>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>Seed Demo</Button>
                  <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="size-3.5" /> Add Stakeholder</Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Name', 'Organisation', 'Role', 'Influence', 'Interest', 'Engagement'].map((h) => (
                        <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((s) => {
                      const meta = ENGAGEMENT_META[s.engagement] ?? ENGAGEMENT_META.medium
                      return (
                        <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
                                style={{ background: `${meta.color}20`, color: meta.color }}>
                                {s.name.slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-foreground font-medium truncate max-w-[120px]">{s.name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-muted-foreground">{s.organisation}</td>
                          <td className="py-2.5 px-3 text-muted-foreground">{s.role}</td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={cn('h-1.5 w-2 rounded-sm', i < s.influence ? 'bg-[#64ffda]' : 'bg-muted/40')} />
                            ))}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={cn('h-1.5 w-2 rounded-sm', i < s.interest ? 'bg-[#3b82f6]' : 'bg-muted/40')} />
                            ))}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                              style={{ background: `${meta.color}20`, color: meta.color }}>{meta.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
