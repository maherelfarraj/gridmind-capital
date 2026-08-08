'use client'

/**
 * G6 — Construction & Installation Approval Form
 * BATCH 20: Canonical gate 6 (rendered from g4-construction-form.tsx)
 * react-hook-form + zod, shadcn/ui card layout (matches G1 styling).
 */
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, HardHat, ClipboardCheck } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { submitG6FormAction, type G6FormData } from '@/app/actions/gate-submissions'
import { Section, Field, GateFormHeader, SuccessCard, inputCls } from './gate-form-primitives'

const schema = z.object({
  contractorName:   z.string().min(1, 'Required'),
  mobilizationDate: z.string().min(1, 'Required'),
  siteReadiness: z.object({
    access:          z.boolean(),
    permits:         z.boolean(),
    hsePlanApproved: z.boolean(),
    insurance:       z.boolean(),
  }),
  plannedWorkforcePeak: z.string().min(1, 'Required'),
})
type FormValues = z.infer<typeof schema>

const DEFAULT: FormValues = {
  contractorName:   '',
  mobilizationDate: '',
  siteReadiness:    { access: false, permits: false, hsePlanApproved: false, insurance: false },
  plannedWorkforcePeak: '',
}

const CHECKLIST: { key: keyof FormValues['siteReadiness']; label: string }[] = [
  { key: 'access',          label: 'Site access established' },
  { key: 'permits',         label: 'Construction permits obtained' },
  { key: 'hsePlanApproved', label: 'HSE plan approved' },
  { key: 'insurance',       label: 'Insurance in place' },
]

interface Props {
  projectId: string
  projectCode: string
  projectName: string
  initialData?: Partial<G6FormData>
  readOnly?: boolean
}

export function G4ConstructionForm({ projectId, projectCode, projectName, initialData, readOnly = false }: Props) {
  const { toast } = useToast()
  const [submitted, setSubmitted] = React.useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...DEFAULT, ...initialData },
  })

  async function onSubmit(values: FormValues) {
    if (readOnly) return
    const { error } = await submitG6FormAction(values as G6FormData, projectId, projectName)
    if (error) {
      toast({ title: 'Submission failed', description: error, variant: 'danger' })
    } else {
      setSubmitted(true)
      toast({ title: 'G6 Package submitted', description: 'Construction & installation package saved and sent for approval.', variant: 'success' })
    }
  }

  if (submitted) return <SuccessCard gate="G6" projectId={projectId} onReset={() => setSubmitted(false)} />

  return (
    <div className="space-y-6">
      <GateFormHeader
        gate="G6" subtitle="Construction & Installation"
        projectCode={projectCode} projectName={projectName}
        description="Confirm contractor mobilization and site readiness before requesting Gate 6 approval."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Section icon={HardHat} title="Contractor & Mobilization">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contractor Name" required error={errors.contractorName?.message}>
              <input className={inputCls} placeholder="e.g. Bechtel" readOnly={readOnly} {...register('contractorName')} />
            </Field>
            <Field label="Mobilization Date" required error={errors.mobilizationDate?.message}>
              <input className={inputCls} type="date" readOnly={readOnly} {...register('mobilizationDate')} />
            </Field>
            <Field label="Planned Workforce Peak" required error={errors.plannedWorkforcePeak?.message} hint="Peak headcount on site">
              <input className={inputCls} type="number" min="0" step="1" placeholder="850" readOnly={readOnly} {...register('plannedWorkforcePeak')} />
            </Field>
          </div>
        </Section>

        <Section icon={ClipboardCheck} title="Site Readiness Checklist">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CHECKLIST.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border cursor-pointer hover:bg-muted transition">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  className="rounded border-border accent-[#64ffda]"
                  {...register(`siteReadiness.${key}` as const)}
                />
                <span className="text-sm text-foreground">{label}</span>
              </label>
            ))}
          </div>
        </Section>

        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Submit for G6 Approval
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
