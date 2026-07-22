'use client'

import { useState, useMemo } from 'react'
import { Wrench, FileText, Upload, CheckCircle2, Clock, AlertTriangle, Plus, Search, Filter, Download, Eye, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { mockStore } from '@/lib/mock-store'

// ── Types ──────────────────────────────────────────────────────────────────

type DrawingStatus = 'issued' | 'in-review' | 'approved' | 'superseded' | 'draft'
type RFIStatus = 'open' | 'answered' | 'closed' | 'overdue'
type SubmittalStatus = 'pending' | 'under-review' | 'approved' | 'rejected' | 'revise-resubmit'

interface Drawing {
  id: string; number: string; title: string; discipline: string
  revision: string; status: DrawingStatus; issuedDate: string; projectId: string
}

interface RFI {
  id: string; number: string; subject: string; raisedBy: string
  status: RFIStatus; priority: 'high' | 'medium' | 'low'
  raisedDate: string; dueDate: string; projectId: string
}

interface Submittal {
  id: string; number: string; title: string; specSection: string
  status: SubmittalStatus; submittedBy: string; submittedDate: string; projectId: string
}

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_DRAWINGS: Drawing[] = [
  { id: 'd1', number: 'CIV-001', title: 'Site Layout Plan', discipline: 'Civil', revision: 'C', status: 'approved', issuedDate: '2026-05-10', projectId: 'p1' },
  { id: 'd2', number: 'STR-002', title: 'Foundation Details', discipline: 'Structural', revision: 'B', status: 'in-review', issuedDate: '2026-06-01', projectId: 'p1' },
  { id: 'd3', number: 'ELE-001', title: 'Single Line Diagram', discipline: 'Electrical', revision: 'A', status: 'issued', issuedDate: '2026-06-15', projectId: 'p2' },
  { id: 'd4', number: 'MEC-003', title: 'HVAC Routing Plan', discipline: 'Mechanical', revision: 'D', status: 'approved', issuedDate: '2026-04-22', projectId: 'p2' },
  { id: 'd5', number: 'CIV-002', title: 'Road Cross Sections', discipline: 'Civil', revision: 'A', status: 'draft', issuedDate: '2026-07-01', projectId: 'p1' },
  { id: 'd6', number: 'STR-005', title: 'Steel Connection Details', discipline: 'Structural', revision: 'B', status: 'superseded', issuedDate: '2026-03-10', projectId: 'p1' },
]

const MOCK_RFIS: RFI[] = [
  { id: 'r1', number: 'RFI-001', subject: 'Clarification on pile cap dimensions', raisedBy: 'Site Team', status: 'open', priority: 'high', raisedDate: '2026-07-01', dueDate: '2026-07-08', projectId: 'p1' },
  { id: 'r2', number: 'RFI-002', subject: 'Cable tray routing conflict at grid A3', raisedBy: 'Electrical Sub', status: 'answered', priority: 'medium', raisedDate: '2026-06-20', dueDate: '2026-06-27', projectId: 'p1' },
  { id: 'r3', number: 'RFI-003', subject: 'Soil bearing capacity assumption', raisedBy: 'Geotechnical', status: 'overdue', priority: 'high', raisedDate: '2026-06-15', dueDate: '2026-06-22', projectId: 'p2' },
  { id: 'r4', number: 'RFI-004', subject: 'Bolt grade specification for anchor bolts', raisedBy: 'Site Team', status: 'closed', priority: 'low', raisedDate: '2026-07-05', dueDate: '2026-07-12', projectId: 'p2' },
]

const MOCK_SUBMITTALS: Submittal[] = [
  { id: 's1', number: 'SUB-001', title: 'Concrete Mix Design', specSection: '03 30 00', status: 'approved', submittedBy: 'Concrete Sub', submittedDate: '2026-05-15', projectId: 'p1' },
  { id: 's2', number: 'SUB-002', title: 'Structural Steel Shop Drawings', specSection: '05 12 00', status: 'under-review', submittedBy: 'Steel Fab', submittedDate: '2026-06-10', projectId: 'p1' },
  { id: 's3', number: 'SUB-003', title: 'HV Cable Type Test Reports', specSection: '26 05 13', status: 'revise-resubmit', submittedBy: 'Electrical Sub', submittedDate: '2026-06-25', projectId: 'p2' },
  { id: 's4', number: 'SUB-004', title: 'Generator Data Sheets', specSection: '26 32 13', status: 'pending', submittedBy: 'MEP Contractor', submittedDate: '2026-07-10', projectId: 'p2' },
]

// ── Status helpers ─────────────────────────────────────────────────────────

const DRAWING_STATUS_STYLE: Record<DrawingStatus, string> = {
  approved:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  issued:      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'in-review': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  superseded:  'bg-muted text-muted-foreground',
  draft:       'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const RFI_STATUS_STYLE: Record<RFIStatus, string> = {
  open:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  answered: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  closed:   'bg-muted text-muted-foreground',
  overdue:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

const SUB_STATUS_STYLE: Record<SubmittalStatus, string> = {
  pending:            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  'under-review':     'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved:           'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  rejected:           'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  'revise-resubmit':  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
}

// ── KPI strip ──────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold mt-1', color ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Drawings tab ───────────────────────────────────────────────────────────

function DrawingsTab() {
  const [search, setSearch] = useState('')
  const [discipline, setDiscipline] = useState('all')

  const filtered = useMemo(() => MOCK_DRAWINGS.filter(d => {
    if (discipline !== 'all' && d.discipline !== discipline) return false
    if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [search, discipline])

  const disciplines = [...new Set(MOCK_DRAWINGS.map(d => d.discipline))]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search drawings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={discipline} onValueChange={(v: string) => setDiscipline(v)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Discipline" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All disciplines</SelectItem>
            {disciplines.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-8 text-xs gap-1.5"><Upload size={12} /> Issue Drawing</Button>
      </div>
      <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/60">
            <tr>
              {['Number','Title','Discipline','Rev','Status','Issued Date',''].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map(d => (
              <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs">{d.number}</td>
                <td className="px-3 py-2.5 font-medium">{d.title}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{d.discipline}</td>
                <td className="px-3 py-2.5 font-mono text-center">{d.revision}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', DRAWING_STATUS_STYLE[d.status])}>
                    {d.status}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{d.issuedDate}</td>
                <td className="px-3 py-2.5">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><Eye size={12} /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── RFI tab ────────────────────────────────────────────────────────────────

function RFITab() {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => MOCK_RFIS.filter(r =>
    !search || r.subject.toLowerCase().includes(search.toLowerCase())
  ), [search])

  const PRIORITY_STYLE = { high: 'text-red-500', medium: 'text-amber-500', low: 'text-muted-foreground' }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search RFIs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5"><Plus size={12} /> New RFI</Button>
      </div>
      <div className="space-y-2">
        {filtered.map(r => (
          <div key={r.id} className="rounded-lg border border-border/60 bg-card p-4 hover:bg-muted/30 transition-colors cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-muted-foreground">{r.number}</span>
                  <AlertTriangle size={12} className={PRIORITY_STYLE[r.priority]} />
                  <span className="text-xs text-muted-foreground capitalize">{r.priority} priority</span>
                </div>
                <p className="font-medium text-sm mt-0.5">{r.subject}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Raised by {r.raisedBy} · Due {r.dueDate}</p>
              </div>
              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase flex-shrink-0', RFI_STATUS_STYLE[r.status])}>
                {r.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Submittals tab ─────────────────────────────────────────────────────────

function SubmittalsTab() {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => MOCK_SUBMITTALS.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  ), [search])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search submittals..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5"><Plus size={12} /> New Submittal</Button>
      </div>
      <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b border-border/60">
            <tr>
              {['Number','Title','Spec Section','Submitted By','Date','Status'].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs">{s.number}</td>
                <td className="px-3 py-2.5 font-medium">{s.title}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{s.specSection}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{s.submittedBy}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.submittedDate}</td>
                <td className="px-3 py-2.5">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase', SUB_STATUS_STYLE[s.status])}>
                    {s.status}
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

// ── Main export ────────────────────────────────────────────────────────────

export function EngineeringCockpit() {
  const approvedDrawings = MOCK_DRAWINGS.filter(d => d.status === 'approved').length
  const openRFIs = MOCK_RFIS.filter(r => r.status === 'open' || r.status === 'overdue').length
  const overdueRFIs = MOCK_RFIS.filter(r => r.status === 'overdue').length
  const pendingSubs = MOCK_SUBMITTALS.filter(s => s.status === 'pending' || s.status === 'under-review').length

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Wrench size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Engineering Cockpit</h1>
            <p className="text-sm text-muted-foreground">Drawings, RFIs & Submittals</p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"><Download size={14} /> Export Register</Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Drawings" value={MOCK_DRAWINGS.length} sub={`${approvedDrawings} approved`} />
        <KpiCard label="Drawing Approval Rate" value={`${Math.round(approvedDrawings / MOCK_DRAWINGS.length * 100)}%`} color="text-green-600" />
        <KpiCard label="Open RFIs" value={openRFIs} sub={overdueRFIs > 0 ? `${overdueRFIs} overdue` : 'None overdue'} color={overdueRFIs > 0 ? 'text-red-500' : undefined} />
        <KpiCard label="Pending Submittals" value={pendingSubs} sub="Awaiting review" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="drawings">
        <TabsList className="w-fit">
          <TabsTrigger value="drawings" className="gap-1.5"><FileText size={13} /> Drawings</TabsTrigger>
          <TabsTrigger value="rfis" className="gap-1.5"><AlertTriangle size={13} /> RFIs</TabsTrigger>
          <TabsTrigger value="submittals" className="gap-1.5"><CheckCircle2 size={13} /> Submittals</TabsTrigger>
        </TabsList>
        <TabsContent value="drawings" className="mt-4"><DrawingsTab /></TabsContent>
        <TabsContent value="rfis" className="mt-4"><RFITab /></TabsContent>
        <TabsContent value="submittals" className="mt-4"><SubmittalsTab /></TabsContent>
      </Tabs>
    </div>
  )
}
