'use client'

/**
 * G1 — Development Approval Form
 * Captures the required deliverables for Gate 1 (Development Approval).
 * Requires completed feasibility, permitting plan, and financial model.
 */
import * as React from 'react'
import { Loader2, CheckCircle2, AlertCircle, ChevronRight, FileText, Map, BarChart3, Shield, Users, Clipboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { submitG1FormAction, type G1FormData } from '@/app/actions/gate-submissions'

const EMPTY: G1FormData = {
  feasibilityStatus: 'commissioned', feasibilityContractor: '', windSolarResource: 'satellite',
  p50YieldGwh: '', p90YieldGwh: '', gridStudyStatus: 'not-started', connectionPointKv: '',
  eiaStatus: 'not-started', eiaConsultant: '', keyPermitsMissing: '', landSecured: false, landNotes: '',
  modelVersion: '1.0', baseIrrPct: '', baseDscrMin: '', lcoeUsdMwh: '', debtEquityRatio: '70/30',
  projectFinanceReady: false,
  offtakeType: 'tbd', offtakeCounterparty: '', offtakeTerm: '', tariffUsdMwh: '', contractorShortlist: '',
  projectDirector: '', oeConsultant: '', fidTargetDate: '', codTargetDate: '',
  totalCapexFinalUsd: '', contingencyPct: '10', requestedDecision: 'conditional',
}

// ─── Sub-components ───────────────────────────────────────────

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center gap-3">
        <div className="size-8 rounded-lg bg-[#64ffda]/10 flex items-center justify-center shrink-0">
          <Icon className="size-4 text-[#64ffda]" aria-hidden />
        </div>
        <CardTitle className="text-sm font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">
        {label}{required && <span className="text-red-400 ml-0.5" aria-hidden>*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function StatusBadge({ status, options }: { status: string; options: { value: string; label: string; color: string }[] }) {
  const opt = options.find((o) => o.value === status)
  if (!opt) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold" style={{ color: opt.color, backgroundColor: `${opt.color}18` }}>
      {opt.label}
    </span>
  )
}

const inputCls = 'w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition'
const selectCls = 'w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition'
const textareaCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition resize-y min-h-[72px]'

const STATUS_OPTIONS = [
  { value: 'complete',     label: 'Complete',     color: '#22c55e' },
  { value: 'in-progress',  label: 'In Progress',  color: '#3b82f6' },
  { value: 'commissioned', label: 'Commissioned', color: '#f59e0b' },
  { value: 'not-started',  label: 'Not Started',  color: '#94a3b8' },
  { value: 'approved',     label: 'Approved',     color: '#22c55e' },
  { value: 'submitted',    label: 'Submitted',    color: '#3b82f6' },
  { value: 'measured',     label: 'Measured',     color: '#22c55e' },
  { value: 'modelled',     label: 'Modelled',     color: '#3b82f6' },
  { value: 'satellite',    label: 'Satellite',    color: '#f59e0b' },
]

// ─── Main component ───────────────────────────────────────────

interface Props {
  projectId:   string
  projectCode: string
  projectName: string
  onSubmitted?: () => void
  initialData?: Partial<G1FormData>
  readOnly?: boolean
}

export function G1DevelopmentForm({ projectId, projectCode, projectName, onSubmitted, initialData, readOnly = false }: Props) {
  const { toast } = useToast()
  const [form, setForm]     = React.useState<G1FormData>({ ...EMPTY, ...initialData })
  const [status, setStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [step, setStep]     = React.useState(0)

  const SECTIONS = [
    'Feasibility Studies',
    'Permitting & Environmental',
    'Financial Model',
    'Offtake & Commercial',
    'Organisation & Timeline',
  ]

  function set<K extends keyof G1FormData>(key: K, value: G1FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly) return
    setStatus('saving')
    const { error } = await submitG1FormAction(form, projectId)
    if (error) {
      setStatus('error')
      toast({ title: 'Submission failed', description: error, variant: 'danger' })
    } else {
      setStatus('saved')
      toast({ title: 'G1 Package submitted', description: 'Gate 1 package saved and ready for review.', variant: 'success' })
      onSubmitted?.()
    }
  }

  const completionPct = React.useMemo(() => {
    const required: (keyof G1FormData)[] = [
      'feasibilityContractor','p50YieldGwh','gridStudyStatus','eiaConsultant',
      'baseIrrPct','baseDscrMin','offtakeCounterparty','projectDirector','fidTargetDate','codTargetDate','totalCapexFinalUsd',
    ]
    const filled = required.filter((k) => form[k] !== undefined && form[k] !== '' && form[k] !== false).length
    return Math.round((filled / required.length) * 100)
  }, [form])

  // Deliverables checklist
  const checklist = [
    { label: 'Feasibility Study',          done: form.feasibilityStatus === 'complete' },
    { label: 'Resource Assessment',        done: ['measured','modelled'].includes(form.windSolarResource) },
    { label: 'Grid Impact Study',          done: form.gridStudyStatus === 'complete' },
    { label: 'EIA / Environmental Study',  done: ['approved','submitted'].includes(form.eiaStatus) },
    { label: 'Financial Model v1.0+',      done: !!form.baseIrrPct && !!form.baseDscrMin },
    { label: 'Offtake / PPA Term Sheet',   done: form.offtakeType !== 'tbd' && !!form.offtakeCounterparty },
    { label: 'Land Secured',               done: form.landSecured },
    { label: 'Project Director Appointed', done: !!form.projectDirector },
  ]
  const checklistPct = Math.round((checklist.filter(c => c.done).length / checklist.length) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-[#64ffda] bg-[#64ffda]/10 px-2 py-0.5 rounded">G1</span>
            <span className="text-xs text-muted-foreground">Development Approval</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">{projectCode} — {projectName}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Complete all deliverables before requesting Gate 1 approval.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative size-12">
            <svg className="size-12 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/40" />
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#64ffda" strokeWidth="2.5"
                strokeDasharray={`${completionPct} ${100 - completionPct}`} strokeLinecap="round" className="transition-all duration-500" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#64ffda]">{completionPct}%</span>
          </div>
          <span className="text-xs text-muted-foreground">Complete</span>
        </div>
      </div>

      {/* Deliverables checklist card */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center gap-3">
          <Clipboard className="size-4 text-[#64ffda]" aria-hidden />
          <CardTitle className="text-sm font-semibold">G1 Mandatory Deliverables ({checklistPct}%)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {checklist.map(({ label, done }) => (
              <div key={label} className={cn('flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg border', done ? 'border-green-500/30 bg-green-500/5 text-foreground' : 'border-border text-muted-foreground')}>
                {done
                  ? <CheckCircle2 className="size-3.5 text-green-500 shrink-0" aria-hidden />
                  : <div className="size-3.5 rounded-full border border-muted-foreground/40 shrink-0" />}
                {label}
              </div>
            ))}
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-[#64ffda] rounded-full transition-all duration-500" style={{ width: `${checklistPct}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Step tabs */}
      <div className="flex gap-1 flex-wrap">
        {SECTIONS.map((s, i) => (
          <button key={i} type="button" onClick={() => setStep(i)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              step === i ? 'bg-[#64ffda]/10 text-[#64ffda] border border-[#64ffda]/30' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}>
            <span className={cn('size-4 rounded-full flex items-center justify-center text-[10px] font-bold', step === i ? 'bg-[#64ffda] text-[#0a192f]' : 'bg-muted text-muted-foreground')}>{i + 1}</span>
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1 — Feasibility */}
        {step === 0 && (
          <Section icon={FileText} title="Feasibility Studies">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Feasibility Study Status">
                <select className={selectCls} value={form.feasibilityStatus} onChange={(e) => set('feasibilityStatus', e.target.value as G1FormData['feasibilityStatus'])} disabled={readOnly}>
                  <option value="commissioned">Commissioned</option>
                  <option value="in-progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </Field>
              <Field label="Feasibility Contractor" required>
                <input className={inputCls} value={form.feasibilityContractor} onChange={(e) => set('feasibilityContractor', e.target.value)} placeholder="e.g. WSP Global" readOnly={readOnly} />
              </Field>
              <Field label="Resource Assessment Type">
                <select className={selectCls} value={form.windSolarResource} onChange={(e) => set('windSolarResource', e.target.value as G1FormData['windSolarResource'])} disabled={readOnly}>
                  <option value="satellite">Satellite Data</option>
                  <option value="modelled">Modelled (Mesoscale)</option>
                  <option value="measured">Measured (Met Mast / LiDAR)</option>
                  <option value="not-started">Not Started</option>
                </select>
              </Field>
              <Field label="Grid Impact Study Status">
                <select className={selectCls} value={form.gridStudyStatus} onChange={(e) => set('gridStudyStatus', e.target.value as G1FormData['gridStudyStatus'])} disabled={readOnly}>
                  <option value="not-started">Not Started</option>
                  <option value="in-progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </Field>
              <Field label="P50 Yield (GWh/yr)" required>
                <input className={inputCls} type="number" min="0" step="0.1" value={form.p50YieldGwh} onChange={(e) => set('p50YieldGwh', e.target.value)} placeholder="820" readOnly={readOnly} />
              </Field>
              <Field label="P90 Yield (GWh/yr)">
                <input className={inputCls} type="number" min="0" step="0.1" value={form.p90YieldGwh} onChange={(e) => set('p90YieldGwh', e.target.value)} placeholder="760" readOnly={readOnly} />
              </Field>
            </div>
          </Section>
        )}

        {/* Section 2 — Permitting */}
        {step === 1 && (
          <Section icon={Map} title="Permitting & Environmental">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="EIA Status">
                <select className={selectCls} value={form.eiaStatus} onChange={(e) => set('eiaStatus', e.target.value as G1FormData['eiaStatus'])} disabled={readOnly}>
                  <option value="not-started">Not Started</option>
                  <option value="in-progress">In Progress</option>
                  <option value="submitted">Submitted to Authority</option>
                  <option value="approved">Approved</option>
                </select>
              </Field>
              <Field label="EIA / Environmental Consultant" required>
                <input className={inputCls} value={form.eiaConsultant} onChange={(e) => set('eiaConsultant', e.target.value)} placeholder="e.g. ERM Group" readOnly={readOnly} />
              </Field>
              <Field label="Land Secured?">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.landSecured} onChange={(e) => set('landSecured', e.target.checked)} disabled={readOnly} className="rounded border-border accent-[#64ffda]" />
                  <span className="text-sm text-foreground">Yes, land title / concession secured</span>
                </label>
              </Field>
            </div>
            <Field label="Key Permits Missing / Pending" hint="List permits not yet obtained">
              <textarea className={textareaCls} value={form.keyPermitsMissing} onChange={(e) => set('keyPermitsMissing', e.target.value)} placeholder="1. Generation licence (expected Q2 2026)\n2. Import permit for transformers..." readOnly={readOnly} />
            </Field>
            <Field label="Land / Site Notes">
              <textarea className={textareaCls} value={form.landNotes} onChange={(e) => set('landNotes', e.target.value)} placeholder="Lease agreement signed with Ministry of Energy, 50-year term..." readOnly={readOnly} />
            </Field>
          </Section>
        )}

        {/* Section 3 — Financial Model */}
        {step === 2 && (
          <Section icon={BarChart3} title="Financial Model">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Model Version">
                <input className={inputCls} value={form.modelVersion} onChange={(e) => set('modelVersion', e.target.value)} placeholder="1.2" readOnly={readOnly} />
              </Field>
              <Field label="Base Case Project IRR (%)" required>
                <input className={inputCls} type="number" min="0" max="100" step="0.01" value={form.baseIrrPct} onChange={(e) => set('baseIrrPct', e.target.value)} placeholder="12.8" readOnly={readOnly} />
              </Field>
              <Field label="Min DSCR (x)" required hint="Debt Service Coverage Ratio">
                <input className={inputCls} type="number" min="0" step="0.01" value={form.baseDscrMin} onChange={(e) => set('baseDscrMin', e.target.value)} placeholder="1.35" readOnly={readOnly} />
              </Field>
              <Field label="LCOE (USD/MWh)">
                <input className={inputCls} type="number" min="0" step="0.1" value={form.lcoeUsdMwh} onChange={(e) => set('lcoeUsdMwh', e.target.value)} placeholder="28.5" readOnly={readOnly} />
              </Field>
              <Field label="Debt / Equity Ratio">
                <select className={selectCls} value={form.debtEquityRatio} onChange={(e) => set('debtEquityRatio', e.target.value)} disabled={readOnly}>
                  <option value="100/0">100% Equity</option>
                  <option value="50/50">50/50</option>
                  <option value="60/40">60/40</option>
                  <option value="70/30">70/30 (standard)</option>
                  <option value="75/25">75/25</option>
                  <option value="80/20">80/20</option>
                </select>
              </Field>
              <Field label="Project Finance Ready?">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.projectFinanceReady} onChange={(e) => set('projectFinanceReady', e.target.checked)} disabled={readOnly} className="rounded border-border accent-[#64ffda]" />
                  <span className="text-sm text-foreground">Financial model bankable / lender-ready</span>
                </label>
              </Field>
            </div>
          </Section>
        )}

        {/* Section 4 — Offtake */}
        {step === 3 && (
          <Section icon={Shield} title="Offtake & Commercial">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Offtake Type">
                <select className={selectCls} value={form.offtakeType} onChange={(e) => set('offtakeType', e.target.value as G1FormData['offtakeType'])} disabled={readOnly}>
                  <option value="tbd">TBD</option>
                  <option value="ppa">PPA (Power Purchase Agreement)</option>
                  <option value="fita">FiT / Auction Award</option>
                  <option value="merchant">Merchant / Spot Market</option>
                  <option value="hybrid">Hybrid PPA + Merchant</option>
                </select>
              </Field>
              <Field label="Offtake Counterparty" required>
                <input className={inputCls} value={form.offtakeCounterparty} onChange={(e) => set('offtakeCounterparty', e.target.value)} placeholder="e.g. Abu Dhabi Power Corp (ADPower)" readOnly={readOnly} />
              </Field>
              <Field label="Offtake Term (years)">
                <input className={inputCls} type="number" min="0" step="1" value={form.offtakeTerm} onChange={(e) => set('offtakeTerm', e.target.value)} placeholder="25" readOnly={readOnly} />
              </Field>
              <Field label="Agreed Tariff (USD/MWh)">
                <input className={inputCls} type="number" min="0" step="0.01" value={form.tariffUsdMwh} onChange={(e) => set('tariffUsdMwh', e.target.value)} placeholder="16.5" readOnly={readOnly} />
              </Field>
            </div>
            <Field label="EPC Contractor Shortlist">
              <textarea className={textareaCls} value={form.contractorShortlist} onChange={(e) => set('contractorShortlist', e.target.value)} placeholder="1. Masdar / Sterling & Wilson\n2. Larsen & Toubro\n3. SEPCO Electric Power" readOnly={readOnly} />
            </Field>
          </Section>
        )}

        {/* Section 5 — Organisation & Timeline */}
        {step === 4 && (
          <Section icon={Users} title="Organisation & Timeline">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Project Director" required>
                <input className={inputCls} value={form.projectDirector} onChange={(e) => set('projectDirector', e.target.value)} placeholder="Name" readOnly={readOnly} />
              </Field>
              <Field label="Owner's Engineer (OE)">
                <input className={inputCls} value={form.oeConsultant} onChange={(e) => set('oeConsultant', e.target.value)} placeholder="e.g. Black & Veatch" readOnly={readOnly} />
              </Field>
              <Field label="FID Target Date" required>
                <input className={inputCls} type="date" value={form.fidTargetDate} onChange={(e) => set('fidTargetDate', e.target.value)} readOnly={readOnly} />
              </Field>
              <Field label="COD Target Date" required>
                <input className={inputCls} type="date" value={form.codTargetDate} onChange={(e) => set('codTargetDate', e.target.value)} readOnly={readOnly} />
              </Field>
              <Field label="Total CAPEX — Final Estimate (USD)" required>
                <input className={inputCls} type="number" min="0" step="1000000" value={form.totalCapexFinalUsd} onChange={(e) => set('totalCapexFinalUsd', e.target.value)} placeholder="385000000" readOnly={readOnly} />
              </Field>
              <Field label="Contingency (%)">
                <input className={inputCls} type="number" min="0" max="100" step="0.5" value={form.contingencyPct} onChange={(e) => set('contingencyPct', e.target.value)} placeholder="10" readOnly={readOnly} />
              </Field>
            </div>
            <Field label="Requested Gate Decision">
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'approve-fid', label: 'Approve for FID',      color: '#64ffda' },
                  { value: 'conditional', label: 'Conditional Approval',  color: '#f59e0b' },
                  { value: 'hold',        label: 'Hold / Further Study',  color: '#3b82f6' },
                  { value: 'terminate',   label: 'Terminate Project',     color: '#ef4444' },
                ] as const).map(({ value, label, color }) => (
                  <label key={value} className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm',
                    form.requestedDecision === value ? 'border-current font-medium' : 'border-border text-muted-foreground hover:border-muted-foreground',
                  )} style={form.requestedDecision === value ? { color, borderColor: color, backgroundColor: `${color}10` } : {}}>
                    <input type="radio" name="g1RequestedDecision" value={value} checked={form.requestedDecision === value} onChange={() => set('requestedDecision', value)} disabled={readOnly} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
          </Section>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors">
            Previous
          </button>
          {step < SECTIONS.length - 1 ? (
            <button type="button" onClick={() => setStep((s) => Math.min(SECTIONS.length - 1, s + 1))}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#64ffda]/10 text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors font-medium">
              Next <ChevronRight className="size-3.5" aria-hidden />
            </button>
          ) : !readOnly ? (
            <Button type="submit" disabled={status === 'saving' || completionPct < 70} className="flex items-center gap-2">
              {status === 'saving'
                ? <><Loader2 className="size-3.5 animate-spin" aria-hidden /> Submitting…</>
                : status === 'saved'
                ? <><CheckCircle2 className="size-3.5" aria-hidden /> Submitted</>
                : 'Submit G1 Package'}
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-green-400 font-medium">
              <CheckCircle2 className="size-4" aria-hidden /> Submitted (read-only)
            </span>
          )}
        </div>

        {status === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            Submission failed. Please try again.
          </div>
        )}
      </form>
    </div>
  )
}
