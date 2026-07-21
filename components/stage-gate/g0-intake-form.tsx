'use client'

/**
 * G0 — Investment Intake Form
 * Captures the required deliverables for Gate 0 (Investment Intake).
 * On submit: saves to gate_submissions table + triggers approval workflow.
 */
import * as React from 'react'
import { Loader2, CheckCircle2, AlertCircle, ChevronRight, Building2, TrendingUp, MapPin, Zap, DollarSign, FileText, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Server action ────────────────────────────────────────────

async function submitG0Form(formData: G0FormData, projectId: string): Promise<{ error: string | null }> {
  'use server'
  const supabase = createAdminClient()
  const { error } = await supabase.from('gate_submissions').upsert({
    project_id:  projectId,
    gate_number: 0,
    form_data:   formData,
    status:      'submitted',
    submitted_at: new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  }, { onConflict: 'project_id,gate_number' })
  return { error: error?.message ?? null }
}

// ─── Types ────────────────────────────────────────────────────

interface G0FormData {
  // Section 1 — Project Identification
  projectSponsor:    string
  hostCountry:       string
  siteCoordinates:   string
  landStatus:        'owned' | 'leased' | 'option' | 'tbd'
  // Section 2 — Technical Concept
  technology:        string
  capacityMwp:       string
  connectionVoltage: string
  storageIncluded:   boolean
  storageMwh:        string
  // Section 3 — Financial Concept
  capexEstimateUsd:  string
  capexBasis:        'desktop' | 'feasibility' | 'pre-feasibility' | 'concept'
  targetIrrPct:      string
  fundingSource:     'equity' | 'debt' | 'mixed' | 'tbd'
  // Section 4 — Strategic Rationale
  strategicFit:      string
  keyRisks:          string
  competitiveEdge:   string
  // Section 5 — Next Steps
  proposedTimeline:  string
  resourcesRequired: string
  requestedDecision: 'proceed-g1' | 'hold' | 'reject'
}

const EMPTY: G0FormData = {
  projectSponsor: '', hostCountry: '', siteCoordinates: '', landStatus: 'tbd',
  technology: '', capacityMwp: '', connectionVoltage: '', storageIncluded: false, storageMwh: '',
  capexEstimateUsd: '', capexBasis: 'concept', targetIrrPct: '', fundingSource: 'tbd',
  strategicFit: '', keyRisks: '', competitiveEdge: '',
  proposedTimeline: '', resourcesRequired: '', requestedDecision: 'proceed-g1',
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

const inputCls = 'w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition'
const selectCls = 'w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition'
const textareaCls = 'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40 focus:border-[#64ffda]/60 transition resize-y min-h-[80px]'

// ─── Main component ───────────────────────────────────────────

interface Props {
  projectId:   string
  projectCode: string
  projectName: string
  onSubmitted?: () => void
  initialData?: Partial<G0FormData>
  readOnly?: boolean
}

export function G0IntakeForm({ projectId, projectCode, projectName, onSubmitted, initialData, readOnly = false }: Props) {
  const { toast } = useToast()
  const [form, setForm]     = React.useState<G0FormData>({ ...EMPTY, ...initialData })
  const [status, setStatus] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [step, setStep]     = React.useState(0)

  const SECTIONS = [
    'Project Identification',
    'Technical Concept',
    'Financial Concept',
    'Strategic Rationale',
    'Next Steps & Decision',
  ]

  function set<K extends keyof G0FormData>(key: K, value: G0FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (readOnly) return
    setStatus('saving')
    const { error } = await submitG0Form(form, projectId)
    if (error) {
      setStatus('error')
      toast({ title: 'Submission failed', description: error, variant: 'danger' })
    } else {
      setStatus('saved')
      toast({ title: 'G0 Intake submitted', description: 'Gate 0 package saved and ready for review.', variant: 'success' })
      onSubmitted?.()
    }
  }

  const completionPct = React.useMemo(() => {
    const required: (keyof G0FormData)[] = ['projectSponsor','hostCountry','technology','capacityMwp','capexEstimateUsd','targetIrrPct','strategicFit','keyRisks','proposedTimeline']
    const filled = required.filter((k) => form[k] && String(form[k]).trim() !== '').length
    return Math.round((filled / required.length) * 100)
  }, [form])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-[#64ffda] bg-[#64ffda]/10 px-2 py-0.5 rounded">G0</span>
            <span className="text-xs text-muted-foreground">Investment Intake</span>
          </div>
          <h2 className="text-xl font-bold text-foreground">{projectCode} — {projectName}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Complete all sections before submitting for Gate 0 review.</p>
        </div>
        {/* Completion ring */}
        <div className="flex items-center gap-2">
          <div className="relative size-12">
            <svg className="size-12 -rotate-90" viewBox="0 0 36 36" aria-hidden>
              <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted/40" />
              <circle
                cx="18" cy="18" r="15.9155" fill="none"
                stroke="#64ffda" strokeWidth="2.5"
                strokeDasharray={`${completionPct} ${100 - completionPct}`}
                strokeLinecap="round"
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-[#64ffda]">{completionPct}%</span>
          </div>
          <span className="text-xs text-muted-foreground">Complete</span>
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex gap-1 flex-wrap">
        {SECTIONS.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setStep(i)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              step === i
                ? 'bg-[#64ffda]/10 text-[#64ffda] border border-[#64ffda]/30'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span className={cn('size-4 rounded-full flex items-center justify-center text-[10px] font-bold', step === i ? 'bg-[#64ffda] text-[#0a192f]' : 'bg-muted text-muted-foreground')}>{i + 1}</span>
            {s}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Section 1 */}
        {step === 0 && (
          <Section icon={Building2} title="Project Identification">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Project Sponsor" required>
                <input className={inputCls} value={form.projectSponsor} onChange={(e) => set('projectSponsor', e.target.value)} placeholder="e.g. GridMind Capital MENA" readOnly={readOnly} />
              </Field>
              <Field label="Host Country" required>
                <input className={inputCls} value={form.hostCountry} onChange={(e) => set('hostCountry', e.target.value)} placeholder="e.g. United Arab Emirates" readOnly={readOnly} />
              </Field>
              <Field label="Site Coordinates / Location" hint="Decimal degrees or address">
                <input className={inputCls} value={form.siteCoordinates} onChange={(e) => set('siteCoordinates', e.target.value)} placeholder="24.4539° N, 54.3773° E" readOnly={readOnly} />
              </Field>
              <Field label="Land Status">
                <select className={selectCls} value={form.landStatus} onChange={(e) => set('landStatus', e.target.value as G0FormData['landStatus'])} disabled={readOnly}>
                  <option value="owned">Owned</option>
                  <option value="leased">Leased / Concession</option>
                  <option value="option">Option to Purchase</option>
                  <option value="tbd">TBD</option>
                </select>
              </Field>
            </div>
          </Section>
        )}

        {/* Section 2 */}
        {step === 1 && (
          <Section icon={Zap} title="Technical Concept">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Technology" required>
                <select className={selectCls} value={form.technology} onChange={(e) => set('technology', e.target.value)} disabled={readOnly}>
                  <option value="">Select technology</option>
                  <option value="Solar PV">Solar PV</option>
                  <option value="Wind">Wind Onshore</option>
                  <option value="Wind Offshore">Wind Offshore</option>
                  <option value="BESS">BESS (Battery Storage)</option>
                  <option value="Hybrid PV+BESS">Hybrid PV + BESS</option>
                  <option value="Hydro">Hydro</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Capacity (MWp / MW)" required>
                <input className={inputCls} type="number" min="0" step="0.1" value={form.capacityMwp} onChange={(e) => set('capacityMwp', e.target.value)} placeholder="400" readOnly={readOnly} />
              </Field>
              <Field label="Grid Connection Voltage (kV)">
                <input className={inputCls} value={form.connectionVoltage} onChange={(e) => set('connectionVoltage', e.target.value)} placeholder="132 kV" readOnly={readOnly} />
              </Field>
              <Field label="Storage Included?">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.storageIncluded}
                    onChange={(e) => set('storageIncluded', e.target.checked)}
                    disabled={readOnly}
                    className="rounded border-border accent-[#64ffda]"
                  />
                  <span className="text-sm text-foreground">Yes, include co-located BESS</span>
                </label>
              </Field>
              {form.storageIncluded && (
                <Field label="Storage Capacity (MWh)">
                  <input className={inputCls} type="number" min="0" step="0.1" value={form.storageMwh} onChange={(e) => set('storageMwh', e.target.value)} placeholder="1600" readOnly={readOnly} />
                </Field>
              )}
            </div>
          </Section>
        )}

        {/* Section 3 */}
        {step === 2 && (
          <Section icon={DollarSign} title="Financial Concept">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="CAPEX Estimate (USD)" required hint="Total installed cost">
                <input className={inputCls} type="number" min="0" step="1000000" value={form.capexEstimateUsd} onChange={(e) => set('capexEstimateUsd', e.target.value)} placeholder="400000000" readOnly={readOnly} />
              </Field>
              <Field label="Estimate Basis">
                <select className={selectCls} value={form.capexBasis} onChange={(e) => set('capexBasis', e.target.value as G0FormData['capexBasis'])} disabled={readOnly}>
                  <option value="concept">Concept (±40%)</option>
                  <option value="pre-feasibility">Pre-Feasibility (±25%)</option>
                  <option value="feasibility">Feasibility (±15%)</option>
                  <option value="desktop">Desktop Study</option>
                </select>
              </Field>
              <Field label="Target Project IRR (%)" required>
                <input className={inputCls} type="number" min="0" max="100" step="0.1" value={form.targetIrrPct} onChange={(e) => set('targetIrrPct', e.target.value)} placeholder="12.5" readOnly={readOnly} />
              </Field>
              <Field label="Funding Source">
                <select className={selectCls} value={form.fundingSource} onChange={(e) => set('fundingSource', e.target.value as G0FormData['fundingSource'])} disabled={readOnly}>
                  <option value="equity">Equity Only</option>
                  <option value="debt">Project Finance / Debt</option>
                  <option value="mixed">Mixed (Equity + Debt)</option>
                  <option value="tbd">TBD</option>
                </select>
              </Field>
            </div>
          </Section>
        )}

        {/* Section 4 */}
        {step === 3 && (
          <Section icon={TrendingUp} title="Strategic Rationale">
            <Field label="Strategic Fit" required hint="Why does this project fit GridMind Capital's strategy?">
              <textarea className={textareaCls} value={form.strategicFit} onChange={(e) => set('strategicFit', e.target.value)} placeholder="Describe alignment with portfolio strategy, country focus, and technology mix..." readOnly={readOnly} />
            </Field>
            <Field label="Key Risks" required hint="Top 3���5 risks at this early stage">
              <textarea className={textareaCls} value={form.keyRisks} onChange={(e) => set('keyRisks', e.target.value)} placeholder="1. Grid curtailment risk...\n2. Permitting timeline...\n3. Land acquisition..." readOnly={readOnly} />
            </Field>
            <Field label="Competitive Advantage">
              <textarea className={textareaCls} value={form.competitiveEdge} onChange={(e) => set('competitiveEdge', e.target.value)} placeholder="What is our edge over other bidders or developers?" readOnly={readOnly} />
            </Field>
          </Section>
        )}

        {/* Section 5 */}
        {step === 4 && (
          <Section icon={Users} title="Next Steps & Requested Decision">
            <Field label="Proposed Development Timeline" required hint="Key milestones from now to FID">
              <textarea className={textareaCls} value={form.proposedTimeline} onChange={(e) => set('proposedTimeline', e.target.value)} placeholder="Q1 2026: Site survey\nQ2 2026: Feasibility study\nQ3 2026: EIA...\nQ4 2026: FID" readOnly={readOnly} />
            </Field>
            <Field label="Resources Required" required hint="Team, budget, external advisors needed to reach G1">
              <textarea className={textareaCls} value={form.resourcesRequired} onChange={(e) => set('resourcesRequired', e.target.value)} placeholder="1× project manager, 1× technical advisor, USD 250k budget for feasibility..." readOnly={readOnly} />
            </Field>
            <Field label="Requested Gate Decision">
              <div className="flex flex-wrap gap-2">
                {([
                  { value: 'proceed-g1', label: 'Proceed to G1', color: '#64ffda' },
                  { value: 'hold',       label: 'Hold / Further Study', color: '#f59e0b' },
                  { value: 'reject',     label: 'Do Not Proceed', color: '#ef4444' },
                ] as const).map(({ value, label, color }) => (
                  <label key={value} className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm',
                    form.requestedDecision === value
                      ? 'border-current font-medium'
                      : 'border-border text-muted-foreground hover:border-muted-foreground',
                  )} style={form.requestedDecision === value ? { color, borderColor: color, backgroundColor: `${color}10` } : {}}>
                    <input type="radio" name="requestedDecision" value={value} checked={form.requestedDecision === value} onChange={() => set('requestedDecision', value)} disabled={readOnly} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
          </Section>
        )}

        {/* Navigation + Submit */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition-colors"
          >
            Previous
          </button>

          {step < SECTIONS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(SECTIONS.length - 1, s + 1))}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-[#64ffda]/10 text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors font-medium"
            >
              Next <ChevronRight className="size-3.5" aria-hidden />
            </button>
          ) : !readOnly ? (
            <Button
              type="submit"
              disabled={status === 'saving' || completionPct < 70}
              className="flex items-center gap-2"
            >
              {status === 'saving'
                ? <><Loader2 className="size-3.5 animate-spin" aria-hidden /> Submitting…</>
                : status === 'saved'
                ? <><CheckCircle2 className="size-3.5" aria-hidden /> Submitted</>
                : 'Submit G0 Package'}
            </Button>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-green-400 font-medium">
              <CheckCircle2 className="size-4" aria-hidden />
              Submitted (read-only)
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
