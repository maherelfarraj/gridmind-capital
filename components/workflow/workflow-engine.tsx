'use client'

import * as React from 'react'
import {
  Play, Pause, CheckCircle2, XCircle, ArrowRight, Plus, Edit3, X,
  Loader2, GitBranch, AlertTriangle, MoreVertical, Clock, Trash2,
  ChevronRight, Save, RefreshCw,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { mockStore } from '@/lib/mock-store'

/* ─── Types ─────────────────────────────────────────────────── */
type WfStatus = 'draft' | 'active' | 'completed' | 'error' | 'paused'
type StepType = 'action' | 'approval' | 'condition' | 'notification' | 'wait'
type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped'

interface WfStep {
  id: string
  label: string
  type: StepType
  assignedRole?: string
  slaHours?: number
  status: StepStatus
  completedAt?: string
  notes?: string
}

interface WorkflowDefinition {
  id: string
  name: string
  category: 'stage-gate' | 'approval' | 'procurement' | 'engineering' | 'commercial' | 'custom'
  description: string
  steps: WfStep[]
  status: WfStatus
  projectId?: string
  projectName?: string
  createdBy: string
  createdAt: string
  lastModified: string
  version: number
  instanceCount: number
}

interface WorkflowInstance {
  id: string
  definitionId: string
  definitionName: string
  projectId: string
  projectName: string
  currentStep: number
  status: WfStatus
  startedAt: string
  completedAt?: string
  steps: WfStep[]
}

/* ─── Mock data ──────────────────────────────────────────────── */
const STEP_TYPES: StepType[] = ['action', 'approval', 'condition', 'notification', 'wait']

const MOCK_DEFINITIONS: WorkflowDefinition[] = [
  {
    id: 'WF-SG-001', name: 'G0→G6 Stage Gate', category: 'stage-gate',
    description: 'Standard EPC stage-gate process covering G0 initiation through G6 Handover & O&M closeout',
    steps: [
      { id: 's1', label: 'G0 Screening & Charter', type: 'approval', assignedRole: 'PMO Director', slaHours: 48, status: 'done', completedAt: '2026-04-01T09:00:00Z' },
      { id: 's2', label: 'G1 Development Approval', type: 'approval', assignedRole: 'Investment Committee', slaHours: 72, status: 'done', completedAt: '2026-05-15T14:00:00Z' },
      { id: 's3', label: 'G2 Design Freeze', type: 'approval', assignedRole: 'Engineering Director', slaHours: 72, status: 'running', notes: 'Awaiting IFC package' },
      { id: 's4', label: 'G3 Procurement Award', type: 'approval', assignedRole: 'PMO Director', slaHours: 48, status: 'pending' },
      { id: 's5', label: 'G4 Construction Start', type: 'action', assignedRole: 'Construction Manager', slaHours: 24, status: 'pending' },
    ],
    status: 'active', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2',
    createdBy: 'Sarah Al-Mansouri', createdAt: '2026-01-15T08:00:00Z', lastModified: '2026-07-01T10:00:00Z',
    version: 3, instanceCount: 1,
  },
  {
    id: 'WF-RFQ-001', name: 'RFQ → PO Procurement', category: 'procurement',
    description: 'Procurement workflow from RFQ issuance through purchase order execution',
    steps: [
      { id: 's1', label: 'Issue RFQ', type: 'action', assignedRole: 'Procurement Lead', slaHours: 24, status: 'done', completedAt: '2026-06-01T09:00:00Z' },
      { id: 's2', label: 'Bid Evaluation', type: 'action', assignedRole: 'Procurement Lead', slaHours: 120, status: 'done', completedAt: '2026-06-20T16:00:00Z' },
      { id: 's3', label: 'Technical Review', type: 'approval', assignedRole: 'Engineering Lead', slaHours: 48, status: 'done', completedAt: '2026-06-25T11:00:00Z' },
      { id: 's4', label: 'Commercial Negotiation', type: 'action', assignedRole: 'Procurement Lead', slaHours: 72, status: 'running' },
      { id: 's5', label: 'Award Approval (DOA)', type: 'approval', assignedRole: 'PMO Director', slaHours: 48, status: 'pending' },
      { id: 's6', label: 'Issue PO', type: 'action', assignedRole: 'Procurement Lead', slaHours: 24, status: 'pending' },
    ],
    status: 'active', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2',
    createdBy: 'Carlos Reyes', createdAt: '2026-05-01T10:00:00Z', lastModified: '2026-06-25T12:00:00Z',
    version: 1, instanceCount: 3,
  },
  {
    id: 'WF-CHNG-001', name: 'Design Change Control', category: 'engineering',
    description: 'Engineering change notice management from initiation to approved IFC revision',
    steps: [
      { id: 's1', label: 'Raise Change Notice', type: 'action', assignedRole: 'Engineering Lead', slaHours: 8, status: 'done', completedAt: '2026-07-05T09:00:00Z' },
      { id: 's2', label: 'Impact Assessment', type: 'action', assignedRole: 'Engineering Lead', slaHours: 24, status: 'done', completedAt: '2026-07-07T14:00:00Z' },
      { id: 's3', label: 'PMO Review', type: 'approval', assignedRole: 'PMO Director', slaHours: 24, status: 'running' },
      { id: 's4', label: 'Implement Change', type: 'action', assignedRole: 'Engineering Lead', slaHours: 48, status: 'pending' },
      { id: 's5', label: 'Close Change Notice', type: 'approval', assignedRole: 'Project Director', slaHours: 24, status: 'pending' },
    ],
    status: 'active', projectId: 'GMC-2026-002', projectName: 'Neom Green Hydrogen Wind',
    createdBy: 'Dr. Yuki Tanaka', createdAt: '2026-07-01T10:00:00Z', lastModified: '2026-07-07T14:00:00Z',
    version: 1, instanceCount: 2,
  },
  {
    id: 'WF-COMM-001', name: 'Variation Order Approval', category: 'commercial',
    description: 'Commercial variation order from contractor claim through DOA approval',
    steps: [
      { id: 's1', label: 'Receive VO Claim', type: 'action', assignedRole: 'Commercial Manager', slaHours: 24, status: 'done' },
      { id: 's2', label: 'Quantification Review', type: 'action', assignedRole: 'QS Lead', slaHours: 48, status: 'pending' },
      { id: 's3', label: 'Commercial Negotiation', type: 'action', assignedRole: 'Commercial Manager', slaHours: 72, status: 'pending' },
      { id: 's4', label: 'DOA Approval', type: 'approval', assignedRole: 'PMO Director', slaHours: 48, status: 'pending' },
    ],
    status: 'draft', createdBy: 'James Okafor', createdAt: '2026-07-10T09:00:00Z', lastModified: '2026-07-10T09:00:00Z', version: 1, instanceCount: 0,
  },
]

const MOCK_INSTANCES: WorkflowInstance[] = [
  { id: 'WFI-001', definitionId: 'WF-SG-001', definitionName: 'G0→G6 Stage Gate', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', currentStep: 2, status: 'active', startedAt: '2026-04-01T09:00:00Z', steps: MOCK_DEFINITIONS[0].steps },
  { id: 'WFI-002', definitionId: 'WF-RFQ-001', definitionName: 'RFQ → PO Procurement', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', currentStep: 3, status: 'active', startedAt: '2026-06-01T09:00:00Z', steps: MOCK_DEFINITIONS[1].steps },
  { id: 'WFI-003', definitionId: 'WF-CHNG-001', definitionName: 'Design Change Control', projectId: 'GMC-2026-002', projectName: 'Neom Green Hydrogen Wind', currentStep: 2, status: 'active', startedAt: '2026-07-05T09:00:00Z', steps: MOCK_DEFINITIONS[2].steps },
]

/* ─── Colors ─────────────────────────────────────────────────── */
const STEP_TYPE_COLORS: Record<StepType, string> = {
  action: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  approval: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  condition: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  notification: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  wait: 'bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground',
}

const STEP_STATUS_ICON: Record<StepStatus, React.ReactNode> = {
  pending: <div className="size-5 rounded-full border-2 border-slate-300 dark:border-border" />,
  running: <div className="size-5 rounded-full bg-sky-500 flex items-center justify-center"><div className="size-2 rounded-full bg-white animate-pulse" /></div>,
  done: <CheckCircle2 className="size-5 text-green-500" />,
  error: <XCircle className="size-5 text-red-500" />,
  skipped: <div className="size-5 rounded-full bg-slate-200 dark:bg-muted flex items-center justify-center"><div className="size-1.5 rounded-full bg-slate-400" /></div>,
}

const WF_STATUS_STYLE: Record<WfStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
}

const CATEGORY_COLORS: Record<string, string> = {
  'stage-gate': '#0ea5e9', 'approval': '#8b5cf6', 'procurement': '#f59e0b',
  'engineering': '#10b981', 'commercial': '#f97316', 'custom': '#64748b',
}

/* ─── Workflow step visualizer ───────────────────────────────── */
function StepVisualizer({ steps, current }: { steps: WfStep[]; current?: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap py-2">
      {steps.map((step, i) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-1 min-w-[80px] max-w-[100px]">
            <div className="flex items-center justify-center">
              {STEP_STATUS_ICON[step.status]}
            </div>
            <span className={cn('text-[10px] text-center leading-tight',
              step.status === 'running' ? 'text-sky-600 font-semibold' :
              step.status === 'done' ? 'text-green-600' : 'text-slate-400 dark:text-muted-foreground'
            )}>
              {step.label}
            </span>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full', STEP_TYPE_COLORS[step.type])}>
              {step.type}
            </span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="size-4 text-slate-300 dark:text-border shrink-0 mb-4" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

/* ─── Definition card ────────────────────────────────────────── */
function DefinitionCard({ def, onActivate, onEdit }: {
  def: WorkflowDefinition
  onActivate: () => void
  onEdit: () => void
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!menuOpen) return
    const h = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [menuOpen])

  const doneSteps = def.steps.filter(s => s.status === 'done').length
  const pct = def.steps.length > 0 ? Math.round(doneSteps / def.steps.length * 100) : 0

  return (
    <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-semibold', WF_STATUS_STYLE[def.status])}>
              {def.status}
            </span>
            <span className="text-xs text-slate-400 dark:text-muted-foreground">v{def.version}</span>
            <span className="text-xs text-slate-400 dark:text-muted-foreground">{def.instanceCount} instance{def.instanceCount !== 1 ? 's' : ''}</span>
          </div>
          <h3 className="font-semibold text-slate-900 dark:text-foreground">{def.name}</h3>
          <p className="text-xs text-slate-500 dark:text-muted-foreground mt-0.5 line-clamp-2">{def.description}</p>
          {def.projectName && <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">{def.projectName}</p>}
        </div>
        <div ref={menuRef} className="relative shrink-0">
          <button onClick={() => setMenuOpen(o => !o)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-accent text-slate-400">
            <MoreVertical className="size-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-30 w-40 bg-white dark:bg-card border border-slate-200 dark:border-border rounded-xl shadow-xl overflow-hidden">
              <button onClick={() => { onEdit(); setMenuOpen(false) }} className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-accent flex items-center gap-2"><Edit3 className="size-3.5" /> Edit</button>
              {def.status === 'draft' && <button onClick={() => { onActivate(); setMenuOpen(false) }} className="w-full text-left px-4 py-2.5 text-sm text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2"><Play className="size-3.5" /> Activate</button>}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 dark:text-muted-foreground mb-1">
          <span>{doneSteps}/{def.steps.length} steps complete</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-[#0a192f] dark:bg-[#64ffda] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Step preview */}
      <div className="overflow-x-auto">
        <StepVisualizer steps={def.steps} />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 dark:text-muted-foreground">
        <span>By {def.createdBy}</span>
        <span>Modified {new Date(def.lastModified).toLocaleDateString()}</span>
      </div>
    </div>
  )
}

/* ─── Workflow editor ────────────────────────────────────────── */
function WorkflowEditor({ def, onSave, onClose }: {
  def: WorkflowDefinition | null
  onSave: (d: WorkflowDefinition) => void
  onClose: () => void
}) {
  // Lazy initializer: the blank definition seeds state exactly once, so the
  // impure Date.now()/new Date() calls run on mount instead of on every render
  // (where they would also be recomputed and thrown away).
  const [editing, setEditing] = React.useState<WorkflowDefinition>(
    () =>
      def ?? {
        id: `WF-CUST-${Date.now()}`, name: '', category: 'custom', description: '',
        steps: [], status: 'draft', createdBy: 'PMO Director',
        createdAt: new Date().toISOString(), lastModified: new Date().toISOString(),
        version: 1, instanceCount: 0,
      },
  )

  function addStep() {
    const newStep: WfStep = { id: `s${Date.now()}`, label: 'New Step', type: 'action', assignedRole: '', slaHours: 24, status: 'pending' }
    setEditing(e => ({ ...e, steps: [...e.steps, newStep] }))
  }

  function updateStep(idx: number, patch: Partial<WfStep>) {
    setEditing(e => ({ ...e, steps: e.steps.map((s, i) => i === idx ? { ...s, ...patch } : s) }))
  }

  function removeStep(idx: number) {
    setEditing(e => ({ ...e, steps: e.steps.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-card rounded-xl shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-border shrink-0">
          <h3 className="font-semibold text-slate-900 dark:text-foreground">{def ? 'Edit Workflow' : 'New Workflow'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-accent"><X className="size-4 text-slate-400" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Workflow Name *</label>
              <input value={editing.name} onChange={e => setEditing(d => ({ ...d, name: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Category</label>
              <select value={editing.category} onChange={e => setEditing(d => ({ ...d, category: e.target.value as WorkflowDefinition['category'] }))}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-sm outline-none focus:border-sky-400">
                {['stage-gate', 'approval', 'procurement', 'engineering', 'commercial', 'custom'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-muted-foreground">Description</label>
            <textarea value={editing.description} onChange={e => setEditing(d => ({ ...d, description: e.target.value }))}
              rows={2} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400 resize-none" />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-foreground">Steps</p>
              <button onClick={addStep} className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-700 font-medium"><Plus className="size-3.5" /> Add Step</button>
            </div>
            <div className="space-y-2">
              {editing.steps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-border bg-slate-50 dark:bg-muted/30">
                  <span className="text-xs text-slate-400 dark:text-muted-foreground w-5 text-center">{idx + 1}</span>
                  <input value={step.label} onChange={e => updateStep(idx, { label: e.target.value })}
                    className="flex-1 rounded border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-2 py-1 text-sm outline-none focus:border-sky-400" />
                  <select value={step.type} onChange={e => updateStep(idx, { type: e.target.value as StepType })}
                    className="rounded border border-slate-200 dark:border-border bg-white dark:bg-card px-2 py-1 text-xs outline-none focus:border-sky-400">
                    {STEP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={step.assignedRole ?? ''} onChange={e => updateStep(idx, { assignedRole: e.target.value })}
                    placeholder="Role" className="w-28 rounded border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-2 py-1 text-xs outline-none focus:border-sky-400" />
                  <input type="number" value={step.slaHours ?? ''} onChange={e => updateStep(idx, { slaHours: Number(e.target.value) })}
                    placeholder="SLA h" className="w-16 rounded border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-2 py-1 text-xs outline-none focus:border-sky-400" />
                  <button onClick={() => removeStep(idx)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="size-3.5" /></button>
                </div>
              ))}
              {editing.steps.length === 0 && (
                <p className="text-sm text-slate-400 dark:text-muted-foreground text-center py-4">No steps yet — click Add Step</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-border shrink-0">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!editing.name.trim()}
            onClick={() => { onSave({ ...editing, lastModified: new Date().toISOString(), version: editing.version + (def ? 1 : 0) }); onClose() }}
            className="gap-2 bg-[#0a192f] hover:bg-[#112240] dark:bg-[#64ffda] dark:text-[#0a192f] text-white"
          >
            <Save className="size-4" /> Save Workflow
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Advance instance modal ─────────────────────────────────── */
function AdvanceModal({ instance, onAdvance, onClose }: { instance: WorkflowInstance; onAdvance: (notes: string) => void; onClose: () => void }) {
  const [notes, setNotes] = React.useState('')
  const currentStep = instance.steps[instance.currentStep]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-card rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <h3 className="font-semibold text-slate-900 dark:text-foreground mb-2">Advance Step</h3>
        <p className="text-sm text-slate-500 dark:text-muted-foreground mb-4">
          Mark &quot;<strong>{currentStep?.label}</strong>&quot; as complete and advance to the next step.
        </p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Optional notes / decision rationale..."
          className="w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none focus:border-sky-400 resize-none mb-4" />
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onAdvance(notes); onClose() }} className="bg-green-600 hover:bg-green-700 text-white">Advance</Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Charts ─────────────────────────────────────────────────── */
function WfCharts({ defs, instances }: { defs: WorkflowDefinition[]; instances: WorkflowInstance[] }) {
  const byCategory = Object.entries(defs.reduce((acc, d) => { acc[d.category] = (acc[d.category] ?? 0) + 1; return acc }, {} as Record<string, number>))
    .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] ?? '#64748b' }))

  const statusData = [
    { name: 'Active', value: defs.filter(d => d.status === 'active').length, color: '#22c55e' },
    { name: 'Draft', value: defs.filter(d => d.status === 'draft').length, color: '#94a3b8' },
    { name: 'Completed', value: defs.filter(d => d.status === 'completed').length, color: '#3b82f6' },
    { name: 'Paused', value: defs.filter(d => d.status === 'paused').length, color: '#f59e0b' },
  ].filter(d => d.value > 0)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-foreground mb-4">Workflows by Category</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={byCategory}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {byCategory.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-foreground mb-4">Workflow Status</p>
        <ResponsiveContainer width="100%" height={160}>
          <PieChart>
            <Pie data={statusData} cx="50%" cy="50%" outerRadius={65} dataKey="value"
              label={({ name, value }) => `${name} (${value})`} labelLine={false}>
              {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ─── Main ────────────────────────────────────────────────────── */
type WfTab = 'definitions' | 'instances' | 'analytics'

export function WorkflowEngine() {
  const [tab, setTab] = React.useState<WfTab>('definitions')
  const [defs, setDefs] = React.useState(MOCK_DEFINITIONS)
  const [instances, setInstances] = React.useState(MOCK_INSTANCES)
  const [editor, setEditor] = React.useState<WorkflowDefinition | null | 'new'>('closed' as unknown as null)
  const [editorOpen, setEditorOpen] = React.useState(false)
  const [advanceTarget, setAdvanceTarget] = React.useState<WorkflowInstance | null>(null)

  function openEditor(def: WorkflowDefinition | null) {
    setEditor(def)
    setEditorOpen(true)
  }

  function saveWorkflow(d: WorkflowDefinition) {
    mockStore.addAuditEntry({ actor: 'PMO Director', action: d.instanceCount === 0 && !defs.find(x => x.id === d.id) ? 'WORKFLOW_CREATED' : 'WORKFLOW_EDITED', entityType: 'workflow', entityId: d.id, result: 'success', details: { name: d.name } })
    setDefs(prev => prev.some(x => x.id === d.id) ? prev.map(x => x.id === d.id ? d : x) : [d, ...prev])
  }

  function activateWorkflow(id: string) {
    setDefs(d => d.map(x => x.id === id ? { ...x, status: 'active' as WfStatus } : x))
    mockStore.addAuditEntry({ actor: 'PMO Director', action: 'WORKFLOW_ACTIVATED', entityType: 'workflow', entityId: id, result: 'success', details: {} })
    mockStore.addNotification({ type: 'workflow_advanced', title: 'Workflow Activated', body: `Workflow ${id} is now active.`, module: 'Workflows', severity: 'info', recipientRole: 'PMO Director', status: 'unread' })
  }

  function advanceInstance(inst: WorkflowInstance, notes: string) {
    setInstances(prev => prev.map(i => {
      if (i.id !== inst.id) return i
      const updatedSteps = i.steps.map((s, idx) => {
        if (idx === i.currentStep) return { ...s, status: 'done' as StepStatus, completedAt: new Date().toISOString(), notes }
        if (idx === i.currentStep + 1) return { ...s, status: 'running' as StepStatus }
        return s
      })
      const nextStep = i.currentStep + 1
      const allDone = nextStep >= i.steps.length
      return { ...i, steps: updatedSteps, currentStep: nextStep, status: allDone ? 'completed' as WfStatus : i.status }
    }))
    mockStore.addAuditEntry({ actor: 'PMO Director', action: 'WORKFLOW_ADVANCED', entityType: 'workflow-instance', entityId: inst.id, projectId: inst.projectId, result: 'success', details: { step: inst.currentStep, notes } })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground">Workflow Engine</h1>
          <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">Define, manage and advance project workflows</p>
        </div>
        <Button onClick={() => openEditor(null)} className="gap-2 bg-[#0a192f] hover:bg-[#112240] dark:bg-[#64ffda] dark:text-[#0a192f] text-white">
          <Plus className="size-4" /> New Workflow
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Workflows', value: defs.length, color: 'text-sky-600' },
          { label: 'Active', value: defs.filter(d => d.status === 'active').length, color: 'text-green-600' },
          { label: 'Instances Running', value: instances.filter(i => i.status === 'active').length, color: 'text-indigo-600' },
          { label: 'Awaiting Action', value: instances.reduce((acc, i) => acc + i.steps.filter(s => s.status === 'running').length, 0), color: 'text-amber-500' },
        ].map(k => (
          <div key={k.label} className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-4">
            <p className="text-sm text-slate-500 dark:text-muted-foreground">{k.label}</p>
            <p className={cn('text-2xl font-bold mt-1', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 dark:border-border">
        {([['definitions', 'Definitions'], ['instances', 'Active Instances'], ['analytics', 'Analytics']] as [WfTab, string][]).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === id ? 'border-[#0a192f] text-[#0a192f] dark:border-[#64ffda] dark:text-[#64ffda]' : 'border-transparent text-slate-500 dark:text-muted-foreground hover:text-slate-700'
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* Definitions */}
      {tab === 'definitions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {defs.map(d => (
            <DefinitionCard
              key={d.id} def={d}
              onActivate={() => activateWorkflow(d.id)}
              onEdit={() => openEditor(d)}
            />
          ))}
        </div>
      )}

      {/* Instances */}
      {tab === 'instances' && (
        <div className="space-y-4">
          {instances.map(inst => {
            const currentStep = inst.steps[inst.currentStep]
            const pct = inst.steps.length > 0 ? Math.round(inst.steps.filter(s => s.status === 'done').length / inst.steps.length * 100) : 0
            return (
              <div key={inst.id} className="bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-semibold', WF_STATUS_STYLE[inst.status])}>{inst.status}</span>
                      <span className="font-mono text-xs text-slate-400">{inst.id}</span>
                    </div>
                    <h3 className="font-semibold text-slate-900 dark:text-foreground">{inst.definitionName}</h3>
                    <p className="text-xs text-sky-600 dark:text-sky-400">{inst.projectName}</p>
                  </div>
                  {currentStep && inst.status === 'active' && (
                    <Button onClick={() => setAdvanceTarget(inst)} className="gap-2 bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3">
                      <ArrowRight className="size-3.5" /> Advance
                    </Button>
                  )}
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-500 dark:text-muted-foreground mb-1">
                    <span>Step {Math.min(inst.currentStep + 1, inst.steps.length)}/{inst.steps.length}</span>
                    <span>{pct}% complete</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {currentStep && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 text-sm">
                    <Clock className="size-4 text-sky-600 shrink-0" />
                    <span className="text-sky-700 dark:text-sky-300"><strong>Current:</strong> {currentStep.label}</span>
                    {currentStep.assignedRole && <span className="text-xs text-sky-600 ml-auto">{currentStep.assignedRole}</span>}
                  </div>
                )}
                <div className="mt-3 overflow-x-auto">
                  <StepVisualizer steps={inst.steps} current={inst.currentStep} />
                </div>
              </div>
            )
          })}
          {instances.length === 0 && (
            <div className="text-center py-16 text-slate-400 dark:text-muted-foreground">No active instances</div>
          )}
        </div>
      )}

      {/* Analytics */}
      {tab === 'analytics' && <WfCharts defs={defs} instances={instances} />}

      {/* Editor */}
      {editorOpen && (
        <WorkflowEditor
          def={typeof editor === 'object' ? editor : null}
          onSave={saveWorkflow}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {/* Advance modal */}
      {advanceTarget && (
        <AdvanceModal
          instance={advanceTarget}
          onAdvance={(notes) => advanceInstance(advanceTarget, notes)}
          onClose={() => setAdvanceTarget(null)}
        />
      )}
    </div>
  )
}
