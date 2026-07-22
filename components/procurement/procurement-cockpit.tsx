'use client'

import { useState, useMemo } from 'react'
import { ShoppingCart, FileText, Package, TruckIcon, Plus, Search, Download, Eye, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

type PRStatus   = 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled'
type POStatus   = 'issued' | 'acknowledged' | 'partially-delivered' | 'fully-delivered' | 'closed'
type VendorTier = 'approved' | 'preferred' | 'restricted' | 'pending'

interface PurchaseRequisition {
  id: string; number: string; description: string; requestedBy: string
  category: string; estimatedValue: number; currency: string
  status: PRStatus; createdDate: string; requiredDate: string
}

interface PurchaseOrder {
  id: string; number: string; vendor: string; description: string
  value: number; currency: string; status: POStatus
  issuedDate: string; deliveryDate: string; deliveredPct: number
}

interface Vendor {
  id: string; name: string; category: string; country: string
  tier: VendorTier; rating: number; activeOrders: number; contactEmail: string
}

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_PRS: PurchaseRequisition[] = [
  { id: 'pr1', number: 'PR-2026-001', description: 'HV Switchgear Panel 33kV', requestedBy: 'Electrical Dept', category: 'Electrical', estimatedValue: 850000, currency: 'SAR', status: 'approved', createdDate: '2026-06-01', requiredDate: '2026-08-15' },
  { id: 'pr2', number: 'PR-2026-002', description: 'Structural Steel I-Beams Grade 50', requestedBy: 'Civil Dept', category: 'Structural', estimatedValue: 320000, currency: 'SAR', status: 'submitted', createdDate: '2026-06-10', requiredDate: '2026-07-30' },
  { id: 'pr3', number: 'PR-2026-003', description: 'SCADA System Software License', requestedBy: 'IT Dept', category: 'Software', estimatedValue: 95000, currency: 'SAR', status: 'draft', createdDate: '2026-07-01', requiredDate: '2026-09-01' },
  { id: 'pr4', number: 'PR-2026-004', description: 'Concrete Admixtures 50T', requestedBy: 'Site Team', category: 'Civil', estimatedValue: 42000, currency: 'SAR', status: 'rejected', createdDate: '2026-05-20', requiredDate: '2026-06-30' },
  { id: 'pr5', number: 'PR-2026-005', description: 'Safety PPE Bulk Order Q3', requestedBy: 'HSE Dept', category: 'Safety', estimatedValue: 28500, currency: 'SAR', status: 'approved', createdDate: '2026-07-05', requiredDate: '2026-07-20' },
]

const MOCK_POS: PurchaseOrder[] = [
  { id: 'po1', number: 'PO-2026-001', vendor: 'Al-Zamil Steel Industries', description: 'Structural Steel Supply', value: 1250000, currency: 'SAR', status: 'partially-delivered', issuedDate: '2026-05-15', deliveryDate: '2026-08-30', deliveredPct: 60 },
  { id: 'po2', number: 'PO-2026-002', vendor: 'Siemens Saudi Arabia', description: 'HV Switchgear 33kV', value: 890000, currency: 'SAR', status: 'acknowledged', issuedDate: '2026-06-20', deliveryDate: '2026-09-15', deliveredPct: 0 },
  { id: 'po3', number: 'PO-2026-003', vendor: 'Saudi Readymix Concrete', description: 'Ready Mix Concrete Supply', value: 340000, currency: 'SAR', status: 'fully-delivered', issuedDate: '2026-04-01', deliveryDate: '2026-06-30', deliveredPct: 100 },
  { id: 'po4', number: 'PO-2026-004', vendor: 'ABB Saudi Arabia Ltd', description: 'LV Distribution Boards', value: 215000, currency: 'SAR', status: 'issued', issuedDate: '2026-07-10', deliveryDate: '2026-10-01', deliveredPct: 0 },
]

const MOCK_VENDORS: Vendor[] = [
  { id: 'v1', name: 'Al-Zamil Steel Industries', category: 'Structural', country: 'Saudi Arabia', tier: 'preferred', rating: 4.7, activeOrders: 2, contactEmail: 'procurement@alzamil.com' },
  { id: 'v2', name: 'Siemens Saudi Arabia', category: 'Electrical', country: 'Saudi Arabia', tier: 'approved', rating: 4.5, activeOrders: 1, contactEmail: 'projects@siemens.sa' },
  { id: 'v3', name: 'Saudi Readymix Concrete', category: 'Civil', country: 'Saudi Arabia', tier: 'approved', rating: 4.2, activeOrders: 0, contactEmail: 'sales@saudireadymix.com' },
  { id: 'v4', name: 'ABB Saudi Arabia Ltd', category: 'Electrical', country: 'Saudi Arabia', tier: 'preferred', rating: 4.6, activeOrders: 1, contactEmail: 'orders@abb.sa' },
  { id: 'v5', name: 'Gulf Cables & Electrical', category: 'Electrical', country: 'Saudi Arabia', tier: 'restricted', rating: 3.1, activeOrders: 0, contactEmail: 'info@gulfcables.com' },
  { id: 'v6', name: 'Al-Rashid Trading', category: 'General', country: 'Saudi Arabia', tier: 'pending', rating: 0, activeOrders: 0, contactEmail: 'contact@alrashid.com' },
]

// ── Status helpers ─────────────────────────────────────────────────────────

const PR_STATUS_STYLE: Record<PRStatus, string> = {
  draft:      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  submitted:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved:   'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled:  'bg-muted text-muted-foreground',
}

const PO_STATUS_STYLE: Record<POStatus, string> = {
  issued:               'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  acknowledged:         'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'partially-delivered':'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  'fully-delivered':    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed:               'bg-muted text-muted-foreground',
}

const VENDOR_TIER_STYLE: Record<VendorTier, string> = {
  preferred:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  approved:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  restricted: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  pending:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

// ── KPI card ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', color ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

function formatSAR(v: number) {
  return `SAR ${(v / 1000).toFixed(0)}K`
}

// ── Purchase Requisitions ──────────────────────────────────────────────────

function PRTab() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(() => MOCK_PRS.filter(pr => {
    if (status !== 'all' && pr.status !== status) return false
    if (search && !pr.description.toLowerCase().includes(search.toLowerCase()) && !pr.number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [search, status])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search PRs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={status} onValueChange={v => { if (v) setStatus(v) }}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(['draft','submitted','approved','rejected'] as PRStatus[]).map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-8 text-xs gap-1.5"><Plus size={12} /> New PR</Button>
      </div>
      <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/60">
            <tr>
              {['PR Number','Description','Category','Requested By','Value','Required By','Status'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map(pr => (
              <tr key={pr.id} className="hover:bg-muted/30 transition-colors cursor-pointer">
                <td className="px-3 py-2.5 font-mono text-xs">{pr.number}</td>
                <td className="px-3 py-2.5 font-medium max-w-48 truncate">{pr.description}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{pr.category}</td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{pr.requestedBy}</td>
                <td className="px-3 py-2.5 text-xs font-medium">{formatSAR(pr.estimatedValue)}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{pr.requiredDate}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', PR_STATUS_STYLE[pr.status])}>
                    {pr.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Purchase Orders ────────────────────────────────────────────────────────

function POTab() {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => MOCK_POS.filter(po =>
    !search || po.description.toLowerCase().includes(search.toLowerCase()) || po.vendor.toLowerCase().includes(search.toLowerCase())
  ), [search])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search orders..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5"><Plus size={12} /> Issue PO</Button>
      </div>
      <div className="space-y-3">
        {filtered.map(po => (
          <div key={po.id} className="rounded-lg border border-border/60 bg-card p-4 hover:bg-muted/20 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">{po.number}</span>
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', PO_STATUS_STYLE[po.status])}>
                    {po.status}
                  </span>
                </div>
                <p className="font-medium text-sm mt-0.5">{po.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{po.vendor}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold">{formatSAR(po.value)}</p>
                <p className="text-xs text-muted-foreground">Due {po.deliveryDate}</p>
              </div>
            </div>
            {po.deliveredPct > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Delivery progress</span>
                  <span>{po.deliveredPct}%</span>
                </div>
                <Progress value={po.deliveredPct} className="h-1.5" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Vendor Register ────────────────────────────────────────────────────────

function VendorTab() {
  const [search, setSearch] = useState('')
  const [tier, setTier] = useState('all')

  const filtered = useMemo(() => MOCK_VENDORS.filter(v => {
    if (tier !== 'all' && v.tier !== tier) return false
    if (search && !v.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [search, tier])

  function StarRating({ rating }: { rating: number }) {
    if (rating === 0) return <span className="text-xs text-muted-foreground">Not rated</span>
    return (
      <span className="text-xs font-medium text-amber-500">
        {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))} {rating.toFixed(1)}
      </span>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search vendors..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={tier} onValueChange={v => { if (v) setTier(v) }}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Tier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            {(['preferred','approved','restricted','pending'] as VendorTier[]).map(t => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-8 text-xs gap-1.5"><Plus size={12} /> Add Vendor</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(v => (
          <div key={v.id} className="rounded-lg border border-border/60 bg-card p-4 hover:bg-muted/20 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-medium text-sm leading-tight">{v.name}</p>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase flex-shrink-0', VENDOR_TIER_STYLE[v.tier])}>
                {v.tier}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{v.category} · {v.country}</p>
            <div className="mt-2">
              <StarRating rating={v.rating} />
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
              <span className="text-xs text-muted-foreground">{v.activeOrders} active order{v.activeOrders !== 1 ? 's' : ''}</span>
              <a href={`mailto:${v.contactEmail}`} className="text-xs text-primary hover:underline" onClick={e => e.stopPropagation()}>
                Contact
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export function ProcurementCockpit() {
  const totalPOValue = MOCK_POS.reduce((s, po) => s + po.value, 0)
  const openPRs = MOCK_PRS.filter(pr => pr.status === 'submitted' || pr.status === 'draft').length
  const activeDeliveries = MOCK_POS.filter(po => po.status === 'partially-delivered' || po.status === 'acknowledged').length
  const preferredVendors = MOCK_VENDORS.filter(v => v.tier === 'preferred' || v.tier === 'approved').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ShoppingCart size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Procurement Cockpit</h1>
            <p className="text-sm text-muted-foreground">Requisitions, Orders & Vendors</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Download size={14} /> Export Register</Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total PO Value" value={`SAR ${(totalPOValue / 1000000).toFixed(1)}M`} sub="Committed spend" />
        <KpiCard label="Open PRs" value={openPRs} sub="Pending approval" color={openPRs > 0 ? 'text-amber-500' : undefined} />
        <KpiCard label="Active Deliveries" value={activeDeliveries} sub="In transit / partial" />
        <KpiCard label="Approved Vendors" value={preferredVendors} sub={`of ${MOCK_VENDORS.length} total`} color="text-green-600" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prs">
        <TabsList className="w-fit">
          <TabsTrigger value="prs" className="gap-1.5"><FileText size={13} /> Requisitions</TabsTrigger>
          <TabsTrigger value="pos" className="gap-1.5"><Package size={13} /> Purchase Orders</TabsTrigger>
          <TabsTrigger value="vendors" className="gap-1.5"><TruckIcon size={13} /> Vendors</TabsTrigger>
        </TabsList>
        <TabsContent value="prs" className="mt-4"><PRTab /></TabsContent>
        <TabsContent value="pos" className="mt-4"><POTab /></TabsContent>
        <TabsContent value="vendors" className="mt-4"><VendorTab /></TabsContent>
      </Tabs>
    </div>
  )
}
