'use client'

/**
 * G8 — Handover & O&M Approval Form
 * BATCH 20: Canonical gate 8 (rendered from g7-handover-form.tsx)
 * react-hook-form + zod, shadcn/ui card layout (matches G1 styling).
 */
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, KeyRound, PackageCheck } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { submitG8FormAction, type G8FormData } from '@/app/actions/gate-submissions'
import { Section, Field, GateFormHeader, SuccessCard, inputCls, selectCls, textareaCls } from './gate-form-primitives'

const schema = z.object({
  omContractor:            z.string().min(1, 'Required'),
  handoverCertificateDate: z.string().min(1, 'Required'),
  warrantyPeriodMonths:    z.string().min(1, 'Required'),
  sparePartsDelivered:     z.enum(['yes', 'no']),
  omManualsDelivered:      z.enum(['yes', 'no']),
  finalAcceptanceNotes:    z.string().max(500).optional(),
})
type FormValues = z.infer<typeof schema>

const DEFAULT: FormValues = {
  omContractor:            '',
  handoverCertificateDate: '',
  warrantyPeriodMonths:    '',
  sparePartsDelivered:     'no',
  omManualsDelivered:      'no',
  finalAcceptanceNotes:    '',
}

interface Props {
  projectId: string
  projectCode: string
  projectName: string
  initialData?: Partial<G8FormData>
  readOnly?: boolean
}

export function G7HandoverForm({ projectId, projectCode, projectName, initialData, readOnly = false }: Props) {
  const { toast } = useToast()
  const [submitted, setSubmitted] = React.useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...DEFAULT, ...initialData },
  })

  async function onSubmit(values: FormValues) {
    if (readOnly) return
    const { error } = await submitG8FormAction(values as G8FormData, projectId, projectName)
    if (error) {
      toast({ title: 'Submission failed', description: error, variant: 'danger' })
    } else {
      setSubmitted(true)
      toast({ title: 'G8 Package submitted', description: 'Handover & O&M package saved and sent for approval.', variant: 'success' })
    }
  }

  if (submitted) return <SuccessCard gate="G8" projectId={projectId} onReset={() => setSubmitted(false)} />

  return (
    <div className="space-y-6">
      <GateFormHeader
        gate="G8" subtitle="Handover & O&M"
        projectCode={projectCode} projectName={projectName}
        description="Confirm O&M readiness, warranty, and deliverables before requesting Gate 8 approval."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Section icon={KeyRound} title="O&M & Warranty">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="O&M Contractor" required error={errors.omContractor?.message}>
              <input className={inputCls} placeholder="e.g. NOMAC" readOnly={readOnly} {...register('omContractor')} />
            </Field>
            <Field label="Handover Certificate Date" required error={errors.handoverCertificateDate?.message}>
              <input className={inputCls} type="date" readOnly={readOnly} {...register('handoverCertificateDate')} />
            </Field>
            <Field label="Warranty Period (months)" required error={errors.warrantyPeriodMonths?.message}>
              <input className={inputCls} type="number" min="0" step="1" placeholder="24" readOnly={readOnly} {...register('warrantyPeriodMonths')} />
            </Field>
          </div>
        </Section>

        <Section icon={PackageCheck} title="Deliverables & Acceptance">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Spare Parts Delivered" required error={errors.sparePartsDelivered?.message}>
              <select className={selectCls} disabled={readOnly} {...register('sparePartsDelivered')}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
            <Field label="O&M Manuals Delivered" required error={errors.omManualsDelivered?.message}>
              <select className={selectCls} disabled={readOnly} {...register('omManualsDelivered')}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </Field>
          </div>
          <Field label="Final Acceptance Notes" error={errors.finalAcceptanceNotes?.message}>
            <textarea className={textareaCls} placeholder="Outstanding items, conditional acceptance terms, client sign-off notes..." readOnly={readOnly} {...register('finalAcceptanceNotes')} />
          </Field>
        </Section>

        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Submit for G8 Approval
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
