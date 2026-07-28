'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import {
  ShoppingCart, FileText, Package, Truck, Plus, Search,
  RefreshCw, Loader2, X, ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import {
  loadProcurementDashboard, issueRFQ, advancePOStatus,
} from '@/app/actions/procurement'
import type { RFQRecord, PORecord } from '@/lib/types/action-types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function statusStyle(status: string): string {
  const s = status.toLowerCase()
  if (s === 'awarded' || s === 'delivered' || s === 'closed') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  if (s === 'issued') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  if (s === 'acknowledged' || s === 'evaluated') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
  if (s === 'closed_rfq' || s === 'closed-rfq') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  if (s === 'disputed' || s === 'cancelled' || s === 'rejected') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
}

function fmtUsd(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v}`
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', color ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ── RFQ tab ──────────────────────────────────────────────────────────────────

function NewRFQModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ title: '', vendor: '', amount_usd: '', close_date: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.vendor) { toast({ title: 'Title and vendor required', variant: 'danger' }); return }
    setLoading(true)
    // For now, tenant-wide pages cannot call actions without project context
    // Project-scoped pages would pass projectId here
    const { error } = await issueRFQ({
      title: form.title, vendor: form.vendor,
      amount_usd: Number(form.amount_usd) || 0, close_date: form.close_date,
      projectId: '',
    })
    setLoading(false)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'RFQ issued', variant: 'success' })
    onCreated(); onClose()
    setForm({ title: '', vendor: '', amount_usd: '', close_date: '' })
  }
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Issue RFQ</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        {[
          { label: 'Title *', key: 'title', type: 'text' },
          { label: 'Vendor *', key: 'vendor', type: 'text' },
          { label: 'Amount (USD)', key: 'amount_usd', type: 'number' },
          { label: 'Close date', key: 'close_date', type: 'date' },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
            <Input type={type} value={form[key as keyof typeof form]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="h-9 text-sm" />
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={loading}>{loading && <Loader2 className="size-3.5 animate-spin" />} Issue RFQ</Button>
        </div>
      </form>
    </div>
  )
}

function RFQTab({ rfqs, loading, onChanged }: { rfqs: RFQRecord[]; loading: boolean; onChanged: () => void }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [modal, setModal] = useState(false)

  const statuses = useMemo(() => [...new Set(rfqs.map(r => r.status))], [rfqs])
  const filtered = useMemo(() => rfqs.filter(r => {
    if (status !== 'all' && r.status !== status) return false
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) && !r.rfq_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [rfqs, search, status])

  return (
    <div className="space-y-4">
      <NewRFQModal open={modal} onClose={() => setModal(false)} onCreated={onChanged} />
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search RFQs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={status} onValueChange={v => setStatus(v ?? 'all')}
          options={[{ value: 'all', label: 'All statuses' }, ...statuses.map(s => ({ value: s, label: s }))]} className="w-36" />
        <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setModal(true)}><Plus size={12} /> New RFQ</Button>
      </div>
      <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/60">
            <tr>
              {['RFQ Number', 'Title', 'Vendor', 'Value', 'Score', 'Status'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">
                {loading ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</span> : 'No RFQs yet. Use “Seed Demo” to populate.'}
              </td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs">{r.rfq_number}</td>
                <td className="px-3 py-2.5 font-medium max-w-48 truncate">{r.title}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{r.vendor}</td>
                <td className="px-3 py-2.5 text-xs font-medium">{fmtUsd(r.amount_usd)}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.score != null ? r.score : '—'}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', statusStyle(r.status))}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── PO tab ─────────────────────────────────────────────────────────────────

const PO_LIFECYCLE = ['draft', 'issued', 'acknowledged', 'delivered', 'closed']

function POTab({ pos, loading, onChanged }: { pos: PORecord[]; loading: boolean; onChanged: () => void }) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const filtered = useMemo(() => pos.filter(po =>
    !search || po.description.toLowerCase().includes(search.toLowerCase()) || po.vendor.toLowerCase().includes(search.toLowerCase())
  ), [pos, search])

  async function advance(id: string) {
    setBusy(id)
    const { error } = await advancePOStatus(id)
    setBusy(null)
    if (error) { toast({ title: 'Error', description: error, variant: 'danger' }); return }
    toast({ title: 'PO advanced', variant: 'success' })
    onChanged()
  }

  return (
    <div className="space-y-4">
      <div className="relative min-w-48 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
          {loading ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</span> : 'No purchase orders yet.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(po => {
            const idx = PO_LIFECYCLE.indexOf(po.status.toLowerCase())
            const pct = idx < 0 ? 0 : Math.round((idx / (PO_LIFECYCLE.length - 1)) * 100)
            const canAdvance = idx >= 0 && idx < PO_LIFECYCLE.length - 1
            return (
              <div key={po.id} className="rounded-lg border border-border/60 bg-card p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{po.po_number}</span>
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', statusStyle(po.status))}>{po.status}</span>
                    </div>
                    <p className="font-medium text-sm mt-0.5">{po.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{po.vendor}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold">{fmtUsd(po.amount_usd)}</p>
                    <p className="text-xs text-muted-foreground">{po.expected_delivery ? `Due ${po.expected_delivery}` : 'No date'}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span className="capitalize">Lifecycle · {po.status}</span>
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
                {canAdvance && (
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={busy === po.id} onClick={() => advance(po.id)}>
                      {busy === po.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                      Advance to {PO_LIFECYCLE[idx + 1]}
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Vendors tab (aggregated from POs + RFQs) ─────────────────────────────────

function VendorTab({ pos, rfqs, loading }: { pos: PORecord[]; rfqs: RFQRecord[]; loading: boolean }) {
  const [search, setSearch] = useState('')

  const vendors = useMemo(() => {
    const map = new Map<string, { name: string; poCount: number; poValue: number; rfqCount: number; open: number }>()
    for (const p of pos) {
      const e = map.get(p.vendor) ?? { name: p.vendor, poCount: 0, poValue: 0, rfqCount: 0, open: 0 }
      e.poCount += 1; e.poValue += p.amount_usd
      if (!['closed', 'delivered'].includes(p.status.toLowerCase())) e.open += 1
      map.set(p.vendor, e)
    }
    for (const r of rfqs) {
      const e = map.get(r.vendor) ?? { name: r.vendor, poCount: 0, poValue: 0, rfqCount: 0, open: 0 }
      e.rfqCount += 1
      map.set(r.vendor, e)
    }
    return [...map.values()].sort((a, b) => b.poValue - a.poValue)
  }, [pos, rfqs])

  const filtered = useMemo(() => vendors.filter(v => !search || v.name.toLowerCase().includes(search.toLowerCase())), [vendors, search])

  return (
    <div className="space-y-4">
      <div className="relative min-w-48 max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-10 text-center text-sm text-muted-foreground">
          {loading ? <span className="inline-flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading…</span> : 'No vendors yet — vendors appear once RFQs/POs exist.'}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(v => (
            <div key={v.name} className="rounded-lg border border-border/60 bg-card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-medium text-sm leading-tight">{v.name}</p>
                {v.open > 0 && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 flex-shrink-0">
                    {v.open} open
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{v.poCount} PO{v.poCount !== 1 ? 's' : ''} · {v.rfqCount} RFQ{v.rfqCount !== 1 ? 's' : ''}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                <span className="text-xs text-muted-foreground">Committed</span>
                <span className="text-sm font-bold">{fmtUsd(v.poValue)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────��──────────���──────

export type ProcurementTab = 'rfqs' | 'pos' | 'vendors'

export function ProcurementCockpit({ initialTab = 'rfqs' }: { initialTab?: ProcurementTab }) {
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR('procurement-dashboard', loadProcurementDashboard, { revalidateOnFocus: true })
  const rfqs = data?.rfqs ?? []
  const pos = data?.pos ?? []
  const totalPOs = data?.totalPOs ?? 0
  const poValue = data?.poValue ?? 0
  const openRFQs = data?.openRFQs ?? 0
  const uniqueVendors = useMemo(() => new Set([...rfqs.map(r => r.vendor), ...pos.map(p => p.vendor)]).size, [rfqs, pos])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><ShoppingCart size={20} className="text-primary" /></div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Procurement Cockpit</h1>
            <p className="text-sm text-muted-foreground">RFQs, Purchase Orders & Vendors</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => mutate()} aria-label="Refresh"><RefreshCw size={14} /></Button>
        </div>
      </div>

      {/* KPI strip (real data) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total PO Value" value={fmtUsd(poValue)} sub="Committed spend" />
        <KpiCard label="Open RFQs" value={openRFQs} sub="Draft / issued" color={openRFQs > 0 ? 'text-amber-500' : undefined} />
        <KpiCard label="Purchase Orders" value={totalPOs} sub="Total issued" />
        <KpiCard label="Vendors" value={uniqueVendors} sub="Engaged" color="text-green-600" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue={initialTab}>
        <TabsList className="w-fit">
          <TabsTrigger value="rfqs" className="gap-1.5"><FileText size={13} /> RFQs</TabsTrigger>
          <TabsTrigger value="pos" className="gap-1.5"><Package size={13} /> Purchase Orders</TabsTrigger>
          <TabsTrigger value="vendors" className="gap-1.5"><Truck size={13} /> Vendors</TabsTrigger>
        </TabsList>
        <TabsContent value="rfqs" className="mt-4"><RFQTab rfqs={rfqs} loading={isLoading} onChanged={() => mutate()} /></TabsContent>
        <TabsContent value="pos" className="mt-4"><POTab pos={pos} loading={isLoading} onChanged={() => mutate()} /></TabsContent>
        <TabsContent value="vendors" className="mt-4"><VendorTab pos={pos} rfqs={rfqs} loading={isLoading} /></TabsContent>
      </Tabs>
    </div>
  )
}
