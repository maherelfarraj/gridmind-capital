'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ArrowRight, Check, Wand2, Loader2, CheckCircle2,
  Building2, MapPin, DollarSign, Calendar, Users, Flag, FileCheck,
  AlertTriangle, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { mockStore, MOCK_USERS, type GmcProject } from '@/lib/mock-store'

/* ─── Types ─────────────────────────────────────────────────── */
interface WizardData {
  // Step 1 — Identity
  code: string
  name: string
  type: 'PV' | 'PV+BESS' | 'Wind' | 'Wind+BESS' | 'BESS' | ''
  country: string
  region: string
  siteCoordinates: string
  developerSpv: string
  // Step 2 — Capacity
  mwac: string
  mwp: string
  mwh: string
  gridVoltage: string
  codTarget: string
  ppaType: 'PPA' | 'Merchant' | 'Hybrid' | ''
  // Step 3 — Commercial
  currency: string
  capex: string
  equityPct: string
  debtPct: string
  targetIrr: string
  tariffAssumption: string
  // Step 4 — Team
  projectDirector: string
  pmoLead: string
  engineeringLead: string
  procurementLead: string
  constructionManager: string
  financeLead: string
  // Step 5 — Stage Gate
  g1TargetDate: string
  stageGateTemplate: string
}

const INITIAL: WizardData = {
  code: '', name: '', type: '', country: '', region: '', siteCoordinates: '', developerSpv: '',
  mwac: '', mwp: '', mwh: '', gridVoltage: '', codTarget: '', ppaType: '',
  currency: 'USD', capex: '', equityPct: '30', debtPct: '70', targetIrr: '', tariffAssumption: '',
  projectDirector: '', pmoLead: '', engineeringLead: '', procurementLead: '', constructionManager: '', financeLead: '',
  g1TargetDate: '', stageGateTemplate: 'Solar EPC Default',
}

const STEPS = [
  { id: 1, label: 'Identity',            icon: Building2   },
  { id: 2, label: 'Capacity',            icon: Zap         },
  { id: 3, label: 'Commercial',          icon: DollarSign  },
  { id: 4, label: 'Team & Roles',        icon: Users       },
  { id: 5, label: 'Stage-Gate Setup',    icon: Flag        },
  { id: 6, label: 'Review & Create',     icon: FileCheck   },
] as const

const COUNTRIES = ['UAE', 'Saudi Arabia', 'UK', 'Australia', 'Egypt', 'Morocco', 'India', 'Spain', 'USA', 'Germany', 'Japan', 'Brazil', 'South Africa', 'Other']
const GRID_VOLTAGES = ['11kV', '33kV', '66kV', '132kV', '220kV', '275kV', '400kV', '765kV']
const CURRENCIES = ['USD', 'EUR', 'GBP', 'SAR', 'AED', 'AUD', 'INR']
const GATES = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8']

/* ─── Provisioning items ──────────────────────────────────────── */
const PROVISION_ITEMS = [
  'Creating project folder structure',
  'Initialising G0–G8 gate checklists',
  'Provisioning cockpit shells (PMO, Engineering, Procurement, Construction, Commissioning)',
  'Setting up default workflows (Stage Gate, RFQ→PO)',
  'Configuring approval routing rules',
  'Generating report templates',
  'Initialising immutable audit log',
]

/* ─── Field helpers ─────────────────────────────────────────── */
function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700 dark:text-foreground">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500" role="alert">{error}</p>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, mono, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean; className?: string
}) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-input/30 px-3 py-2 text-sm outline-none transition-colors',
        'focus:border-sky-400 focus:ring-2 focus:ring-sky-400/10 dark:focus:border-ring',
        'text-slate-900 dark:text-foreground placeholder:text-slate-400',
        mono && 'font-mono',
        className,
      )}
    />
  )
}

function NativeSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 dark:border-border bg-white dark:bg-card px-3 py-2 text-sm outline-none focus:border-sky-400 dark:focus:border-ring transition-colors text-slate-900 dark:text-foreground"
    >
      <option value="">Select...</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/* ─── Step indicator ─────────────────────────────────────────── */
function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Wizard steps" className="mb-8">
      <div className="hidden md:flex items-center w-full">
        {STEPS.map((step, idx) => {
          const done = current > step.id
          const active = current === step.id
          const Icon = step.icon
          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center shrink-0">
                <div className={cn(
                  'flex items-center justify-center size-9 rounded-full text-sm font-bold transition-all',
                  done ? 'bg-green-500 text-white' : active ? 'bg-[#0a192f] dark:bg-[#64ffda] text-white dark:text-[#0a192f] ring-4 ring-[#0a192f]/15 dark:ring-[#64ffda]/20' : 'bg-white dark:bg-card border-2 border-slate-200 dark:border-border text-slate-400'
                )}>
                  {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                </div>
                <span className={cn('text-xs mt-1.5 whitespace-nowrap font-medium', active ? 'text-slate-900 dark:text-foreground' : 'text-slate-400 dark:text-muted-foreground')}>
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-2 mb-4 rounded-full transition-colors', done ? 'bg-green-400' : 'bg-slate-200 dark:bg-border')} />
              )}
            </React.Fragment>
          )
        })}
      </div>
      {/* Mobile */}
      <div className="md:hidden">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-slate-500">Step {current} of {STEPS.length}</span>
          <span className="font-semibold text-slate-900 dark:text-foreground">{STEPS[current - 1].label}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-[#0a192f] dark:bg-[#64ffda] transition-all" style={{ width: `${(current / STEPS.length) * 100}%` }} />
        </div>
      </div>
    </nav>
  )
}

/* ─── Provisioning screen ─────────────────────────────────────── */
function ProvisioningScreen({ projectCode, projectName, onDone }: { projectCode: string; projectName: string; onDone: () => void }) {
  const [done, setDone] = React.useState<number[]>([])

  React.useEffect(() => {
    PROVISION_ITEMS.forEach((_, i) => {
      setTimeout(() => setDone(d => [...d, i]), (i + 1) * 500)
    })
    setTimeout(onDone, (PROVISION_ITEMS.length + 1) * 500 + 800)
  }, [onDone])

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      <div className="size-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <CheckCircle2 className="size-8 text-green-600" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-foreground">{projectCode} Created</h2>
        <p className="text-slate-500 dark:text-muted-foreground mt-1">Provisioning workspace for <strong>{projectName}</strong>…</p>
      </div>
      <div className="w-full max-w-md space-y-2">
        {PROVISION_ITEMS.map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-border bg-white dark:bg-card">
            {done.includes(i) ? (
              <CheckCircle2 className="size-4 text-green-500 shrink-0" />
            ) : (
              <div className="size-4 rounded-full border-2 border-slate-200 dark:border-border shrink-0" />
            )}
            <span className={cn('text-sm', done.includes(i) ? 'text-slate-700 dark:text-foreground' : 'text-slate-400 dark:text-muted-foreground')}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Validation ──────────────────────────────────────────────── */
function validate(step: number, data: WizardData): Record<string, string> {
  const e: Record<string, string> = {}
  if (step === 1) {
    if (!data.name.trim()) e.name = 'Project name is required.'
    if (!data.type) e.type = 'Project type is required.'
    if (!data.country) e.country = 'Country is required.'
    if (!data.developerSpv.trim()) e.developerSpv = 'Developer/SPV name is required.'
  }
  if (step === 2) {
    if (!data.mwac) e.mwac = 'MWac capacity is required.'
    if (!data.mwp) e.mwp = 'MWp is required.'
    if (!data.codTarget) e.codTarget = 'COD target date is required.'
    if (!data.ppaType) e.ppaType = 'PPA type is required.'
  }
  if (step === 3) {
    if (!data.capex) e.capex = 'CAPEX estimate is required.'
    if (!data.targetIrr) e.targetIrr = 'Target IRR is required.'
  }
  if (step === 4) {
    if (!data.projectDirector) e.projectDirector = 'Project Director is required.'
    if (!data.pmoLead) e.pmoLead = 'PMO Lead is required.'
  }
  if (step === 5) {
    if (!data.g1TargetDate) e.g1TargetDate = 'G1 target date is required.'
  }
  return e
}

/* ─── Main Wizard ─────────────────────────────────────────────── */
export function NewProjectWizardV2() {
  const router = useRouter()
  const [step, setStep] = React.useState(1)
  const [data, setData] = React.useState<WizardData>(() => {
    if (typeof window !== 'undefined') {
      const draft = localStorage.getItem('gmc-wizard-draft')
      if (draft) try { return JSON.parse(draft) } catch { /* ignore */ }
    }
    const yr = new Date().getFullYear()
    const rnd = String(Math.floor(100 + Math.random() * 900))
    return { ...INITIAL, code: `GMC-${yr}-${rnd}` }
  })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [provisioning, setProvisioning] = React.useState(false)
  const [created, setCreated] = React.useState<string | null>(null)

  /* Autosave draft */
  React.useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('gmc-wizard-draft', JSON.stringify(data))
  }, [data])

  function set(field: keyof WizardData, value: string) {
    setData(d => ({ ...d, [field]: value }))
    setErrors(e => { const n = { ...e }; delete n[field]; return n })
  }

  function next() {
    const errs = validate(step, data)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStep(s => Math.min(s + 1, 6))
  }

  function back() { setErrors({}); setStep(s => Math.max(s - 1, 1)) }

  function handleCreate() {
    setSubmitting(true)
    setTimeout(() => {
      const project: GmcProject = {
        id: data.code, code: data.code, name: data.name,
        type: data.type as GmcProject['type'], country: data.country,
        region: data.region, siteCoordinates: data.siteCoordinates,
        developerSpv: data.developerSpv,
        mwac: Number(data.mwac), mwp: Number(data.mwp),
        mwh: data.mwh ? Number(data.mwh) : undefined,
        gridVoltage: data.gridVoltage, codTarget: data.codTarget,
        ppaType: data.ppaType as GmcProject['ppaType'],
        capex: Number(data.capex) * 1_000_000,
        currency: data.currency,
        equityPct: Number(data.equityPct), debtPct: Number(data.debtPct),
        targetIrr: Number(data.targetIrr),
        tariffAssumption: data.tariffAssumption,
        team: {
          projectDirector: data.projectDirector, pmoLead: data.pmoLead,
          engineeringLead: data.engineeringLead, procurementLead: data.procurementLead,
          constructionManager: data.constructionManager, financeLead: data.financeLead,
        },
        currentGate: 'G0', health: 'green', status: 'pending_activation',
        createdAt: new Date().toISOString(),
      }
      mockStore.addProject(project)
      mockStore.auditAndNotify(
        { actor: 'PMO Director', action: 'PROJECT_CREATED', entityType: 'project', entityId: data.code, projectId: data.code, result: 'success', details: { name: data.name } },
        { type: 'approval_requested', title: 'Project Activation Required', body: `New project ${data.code} "${data.name}" requires activation approval.`, module: 'Projects', projectId: data.code, projectName: data.name, severity: 'warning', recipientRole: 'PMO Director', status: 'unread' }
      )
      setCreated(data.code)
      setProvisioning(true)
      setSubmitting(false)
      if (typeof window !== 'undefined') localStorage.removeItem('gmc-wizard-draft')
    }, 400)
  }

  if (provisioning && created) {
    return (
      <ProvisioningScreen
        projectCode={created}
        projectName={data.name}
        onDone={() => router.push(`/projects/${created}`)}
      />
    )
  }

  const userOpts = MOCK_USERS.map(u => ({ value: u.name, label: `${u.name} — ${u.role}` }))

  /* Render step content */
  function renderStep() {
    switch (step) {
      case 1: return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Project Code" required>
            <div className="flex gap-2">
              <TextInput value={data.code} onChange={v => set('code', v)} placeholder="GMC-2026-001" mono className="flex-1" />
              <button type="button" onClick={() => { const yr = new Date().getFullYear(); set('code', `GMC-${yr}-${String(Math.floor(100 + Math.random() * 900))}`) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-border text-xs font-medium text-slate-600 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent shrink-0">
                <Wand2 className="size-3.5" /> Auto
              </button>
            </div>
          </Field>
          <Field label="Project Name" required error={errors.name}>
            <TextInput value={data.name} onChange={v => set('name', v)} placeholder="e.g., Al Dhafra Solar PV – Phase 2" />
          </Field>
          <Field label="Project Type" required error={errors.type}>
            <NativeSelect value={data.type} onChange={v => set('type', v)} options={['PV', 'PV+BESS', 'Wind', 'Wind+BESS', 'BESS'].map(x => ({ value: x, label: x }))} />
          </Field>
          <Field label="Country" required error={errors.country}>
            <NativeSelect value={data.country} onChange={v => set('country', v)} options={COUNTRIES.map(x => ({ value: x, label: x }))} />
          </Field>
          <Field label="Region">
            <TextInput value={data.region} onChange={v => set('region', v)} placeholder="e.g., Abu Dhabi" />
          </Field>
          <Field label="Site Coordinates">
            <TextInput value={data.siteCoordinates} onChange={v => set('siteCoordinates', v)} placeholder="24.4539, 54.3773" />
          </Field>
          <Field label="Developer / SPV Name" required error={errors.developerSpv} >
            <TextInput value={data.developerSpv} onChange={v => set('developerSpv', v)} placeholder="e.g., ADNOC Renewable Energy SPV" />
          </Field>
        </div>
      )

      case 2: return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="MWac (AC capacity)" required error={errors.mwac}>
            <TextInput value={data.mwac} onChange={v => set('mwac', v)} placeholder="e.g., 1500" />
          </Field>
          <Field label="MWp (DC peak)" required error={errors.mwp}>
            <TextInput value={data.mwp} onChange={v => set('mwp', v)} placeholder="e.g., 1800" />
          </Field>
          <Field label="MWh (BESS capacity — if applicable)">
            <TextInput value={data.mwh} onChange={v => set('mwh', v)} placeholder="e.g., 200" />
          </Field>
          <Field label="Grid Connection Voltage">
            <NativeSelect value={data.gridVoltage} onChange={v => set('gridVoltage', v)} options={GRID_VOLTAGES.map(x => ({ value: x, label: x }))} />
          </Field>
          <Field label="COD Target Date" required error={errors.codTarget}>
            <TextInput value={data.codTarget} onChange={v => set('codTarget', v)} placeholder="YYYY-MM-DD" />
          </Field>
          <Field label="PPA Type" required error={errors.ppaType}>
            <NativeSelect value={data.ppaType} onChange={v => set('ppaType', v)} options={['PPA', 'Merchant', 'Hybrid'].map(x => ({ value: x, label: x }))} />
          </Field>
        </div>
      )

      case 3: return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Currency">
            <NativeSelect value={data.currency} onChange={v => set('currency', v)} options={CURRENCIES.map(x => ({ value: x, label: x }))} />
          </Field>
          <Field label="CAPEX Estimate (millions)" required error={errors.capex}>
            <TextInput value={data.capex} onChange={v => set('capex', v)} placeholder="e.g., 1200" />
          </Field>
          <Field label="Equity Split (%)">
            <TextInput value={data.equityPct} onChange={v => { set('equityPct', v); set('debtPct', String(100 - Number(v))) }} placeholder="30" />
          </Field>
          <Field label="Debt Split (%)">
            <TextInput value={data.debtPct} onChange={v => set('debtPct', v)} placeholder="70" />
          </Field>
          <Field label="Target IRR (%)" required error={errors.targetIrr}>
            <TextInput value={data.targetIrr} onChange={v => set('targetIrr', v)} placeholder="e.g., 8.5" />
          </Field>
          <Field label="Tariff / Merchant Assumption">
            <TextInput value={data.tariffAssumption} onChange={v => set('tariffAssumption', v)} placeholder="e.g., $22.35/MWh" />
          </Field>
        </div>
      )

      case 4: return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { key: 'projectDirector' as const, label: 'Project Director', required: true },
            { key: 'pmoLead' as const, label: 'PMO Lead', required: true },
            { key: 'engineeringLead' as const, label: 'Engineering Lead', required: false },
            { key: 'procurementLead' as const, label: 'Procurement Lead', required: false },
            { key: 'constructionManager' as const, label: 'Construction Manager', required: false },
            { key: 'financeLead' as const, label: 'Finance Lead', required: false },
          ].map(f => (
            <Field key={f.key} label={f.label} required={f.required} error={errors[f.key]}>
              <NativeSelect value={data[f.key]} onChange={v => set(f.key, v)} options={userOpts} />
            </Field>
          ))}
        </div>
      )

      case 5: return (
        <div className="space-y-6">
          <Field label="Stage-Gate Template">
            <NativeSelect value={data.stageGateTemplate} onChange={v => set('stageGateTemplate', v)}
              options={['Solar EPC Default', 'Wind EPC Default', 'BESS Fast-Track', 'Custom'].map(x => ({ value: x, label: x }))} />
          </Field>
          <Field label="G1 Target Date" required error={errors.g1TargetDate}>
            <TextInput value={data.g1TargetDate} onChange={v => set('g1TargetDate', v)} placeholder="YYYY-MM-DD" />
          </Field>
          {/* Gate preview */}
          <div className="rounded-xl border border-slate-200 dark:border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-3">Gate Preview — {data.stageGateTemplate}</p>
            <div className="flex items-center gap-1 flex-wrap">
              {GATES.map((g, i) => (
                <React.Fragment key={g}>
                  <div className={cn('flex flex-col items-center gap-1')}>
                    <div className={cn('size-8 rounded-full flex items-center justify-center text-xs font-bold',
                      g === 'G0' ? 'bg-[#0a192f] text-white dark:bg-[#64ffda] dark:text-[#0a192f]' : 'bg-slate-100 dark:bg-muted text-slate-600 dark:text-muted-foreground')}>
                      {g}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-muted-foreground whitespace-nowrap">
                      {['Initiate', 'Development', 'Design', 'Procure', 'Construct', 'Commission', 'Test', 'Handover', 'O&M'][i]}
                    </span>
                  </div>
                  {i < GATES.length - 1 && <div className="flex-1 h-0.5 bg-slate-200 dark:bg-border mb-4 min-w-[8px]" />}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )

      case 6: {
        const checks = [
          { label: 'Project identity complete', ok: !!data.name && !!data.type && !!data.country },
          { label: 'Capacity & technical data entered', ok: !!data.mwac && !!data.codTarget },
          { label: 'Commercial parameters defined', ok: !!data.capex && !!data.targetIrr },
          { label: 'Team assigned', ok: !!data.projectDirector && !!data.pmoLead },
          { label: 'Stage-gate configured', ok: !!data.g1TargetDate },
        ]
        const allGreen = checks.every(c => c.ok)
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Project', value: `${data.code} — ${data.name}` },
                { label: 'Type', value: data.type },
                { label: 'Country / Region', value: [data.country, data.region].filter(Boolean).join(', ') },
                { label: 'Capacity', value: `${data.mwac} MWac / ${data.mwp} MWp${data.mwh ? ` / ${data.mwh} MWh` : ''}` },
                { label: 'COD Target', value: data.codTarget },
                { label: 'PPA Type', value: data.ppaType },
                { label: 'CAPEX', value: `${data.currency} ${Number(data.capex).toLocaleString()}M` },
                { label: 'IRR Target', value: `${data.targetIrr}%` },
                { label: 'Project Director', value: data.projectDirector },
                { label: 'PMO Lead', value: data.pmoLead },
                { label: 'Stage-Gate Template', value: data.stageGateTemplate },
                { label: 'G1 Target', value: data.g1TargetDate },
              ].map(r => (
                <div key={r.label} className="flex gap-2">
                  <span className="text-sm text-slate-500 dark:text-muted-foreground w-36 shrink-0">{r.label}</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-foreground">{r.value || '—'}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-border p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground mb-3">Validation Checklist</p>
              {checks.map(c => (
                <div key={c.label} className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="size-4 text-green-500 shrink-0" /> : <AlertTriangle className="size-4 text-amber-500 shrink-0" />}
                  <span className={cn('text-sm', c.ok ? 'text-slate-700 dark:text-foreground' : 'text-amber-600')}>{c.label}</span>
                </div>
              ))}
              {!allGreen && <p className="text-xs text-amber-600 mt-2">Go back and complete all required fields to enable Create.</p>}
            </div>

            <Button
              onClick={handleCreate}
              disabled={!allGreen || submitting}
              className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
            >
              {submitting ? <><Loader2 className="size-4 animate-spin" /> Creating…</> : <>
                <CheckCircle2 className="size-4" /> Create Project
              </>}
            </Button>
          </div>
        )
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-foreground">New Project</h1>
        <p className="text-sm text-slate-500 dark:text-muted-foreground mt-0.5">Draft auto-saved as you type</p>
      </div>

      <div className="bg-white dark:bg-card rounded-2xl border border-slate-200 dark:border-border shadow-sm p-6 md:p-8">
        <StepIndicator current={step} />
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-foreground">{STEPS[step - 1].label}</h2>
        </div>
        {renderStep()}

        {step < 6 && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100 dark:border-border">
            <Button variant="outline" onClick={step === 1 ? () => router.push('/projects') : back} className="gap-2">
              <ArrowLeft className="size-4" /> {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            <Button onClick={next} className="gap-2 bg-[#0a192f] hover:bg-[#112240] dark:bg-[#64ffda] dark:text-[#0a192f] dark:hover:bg-[#4cd6b5] text-white">
              Next <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
        {step === 6 && (
          <div className="flex justify-start mt-6 pt-6 border-t border-slate-100 dark:border-border">
            <Button variant="outline" onClick={back} className="gap-2">
              <ArrowLeft className="size-4" /> Back
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
