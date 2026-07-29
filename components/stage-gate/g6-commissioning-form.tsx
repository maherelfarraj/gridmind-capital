'use client'

/**
 * G6 — Commissioning Approval Form
 * react-hook-form + zod, shadcn/ui card layout (matches G1 styling).
 */
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Zap, GraduationCap } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { submitG6FormAction, type G6FormData } from '@/app/actions/gate-submissions'
import { Section, Field, GateFormHeader, SuccessCard, inputCls, selectCls } from './gate-form-primitives'

const schema = z.object({
  testPackagesCount:         z.string().min(1, 'Required'),
  energizationDate:          z.string().min(1, 'Required'),
  performanceTestPlanStatus: z.enum(['not-started', 'draft', 'approved']),
  gridConnectionDate:        z.string().min(1, 'Required'),
  trainingPlanStatus:        z.enum(['not-started', 'draft', 'approved']),
})
type FormValues = z.infer<typeof schema>

const DEFAULT: FormValues = {
  testPackagesCount:         '',
  energizationDate:          '',
  performanceTestPlanStatus: 'not-started',
  gridConnectionDate:        '',
  trainingPlanStatus:        'not-started',
}

interface Props {
  projectId: string
  projectCode: string
  projectName: string
  initialData?: Partial<G6FormData>
  readOnly?: boolean
}

export function G6CommissioningForm({ projectId, projectCode, projectName, initialData, readOnly = false }: Props) {
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
      toast({ title: 'G6 Package submitted', description: 'Commissioning package saved and sent for approval.', variant: 'success' })
    }
  }

  if (submitted) return <SuccessCard gate="G6" projectId={projectId} onReset={() => setSubmitted(false)} />

  return (
    <div className="space-y-6">
      <GateFormHeader
        gate="G7" subtitle="Commissioning & Grid Tests"
        projectCode={projectCode} projectName={projectName}
        description="Confirm test packages, energization plan, and training readiness before requesting Gate 7 approval."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Section icon={Zap} title="Commissioning & Energization">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Test Packages Count" required error={errors.testPackagesCount?.message}>
              <input className={inputCls} type="number" min="0" step="1" placeholder="56" readOnly={readOnly} {...register('testPackagesCount')} />
            </Field>
            <Field label="Energization Date" required error={errors.energizationDate?.message}>
              <input className={inputCls} type="date" readOnly={readOnly} {...register('energizationDate')} />
            </Field>
            <Field label="Grid Connection Date" required error={errors.gridConnectionDate?.message}>
              <input className={inputCls} type="date" readOnly={readOnly} {...register('gridConnectionDate')} />
            </Field>
            <Field label="Performance Test Plan Status" required error={errors.performanceTestPlanStatus?.message}>
              <select className={selectCls} disabled={readOnly} {...register('performanceTestPlanStatus')}>
                <option value="not-started">Not Started</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section icon={GraduationCap} title="Training">
          <Field label="Training Plan Status" required error={errors.trainingPlanStatus?.message}>
            <select className={selectCls} disabled={readOnly} {...register('trainingPlanStatus')}>
              <option value="not-started">Not Started</option>
              <option value="draft">Draft</option>
              <option value="approved">Approved</option>
            </select>
          </Field>
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
