'use client'

/**
 * G5 — Mechanical Completion Approval Form
 * react-hook-form + zod, shadcn/ui card layout (matches G1 styling).
 */
import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Wrench, ListChecks } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { submitG5FormAction, type G5FormData } from '@/app/actions/gate-submissions'
import { Section, Field, GateFormHeader, SuccessCard, inputCls, selectCls } from '../gate-form-primitives'

const schema = z.object({
  systemsCount:            z.string().min(1, 'Required'),
  punchItemsOpenCount:     z.string().min(1, 'Required'),
  mcCertificateTargetDate: z.string().min(1, 'Required'),
  walkdownDate:            z.string().min(1, 'Required'),
  asBuiltStatus:           z.enum(['not-started', 'in-progress', 'complete']),
})
type FormValues = z.infer<typeof schema>

const DEFAULT: FormValues = {
  systemsCount:            '',
  punchItemsOpenCount:     '',
  mcCertificateTargetDate: '',
  walkdownDate:            '',
  asBuiltStatus:           'not-started',
}

interface Props {
  projectId: string
  projectCode: string
  projectName: string
  initialData?: Partial<G5FormData>
  readOnly?: boolean
}

export function G5MechanicalCompletionForm({ projectId, projectCode, projectName, initialData, readOnly = false }: Props) {
  const { toast } = useToast()
  const [submitted, setSubmitted] = React.useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...DEFAULT, ...initialData },
  })

  async function onSubmit(values: FormValues) {
    if (readOnly) return
    const { error } = await submitG5FormAction(values as G5FormData, projectId, projectName)
    if (error) {
      toast({ title: 'Submission failed', description: error, variant: 'danger' })
    } else {
      setSubmitted(true)
      toast({ title: 'G5 Package submitted', description: 'Mechanical completion package saved and sent for approval.', variant: 'success' })
    }
  }

  if (submitted) return <SuccessCard gate="G5" projectId={projectId} onReset={() => setSubmitted(false)} />

  return (
    <div className="space-y-6">
      <GateFormHeader
        gate="G5" subtitle="Mechanical Completion"
        projectCode={projectCode} projectName={projectName}
        description="Confirm systems status, punch list, and walkdown readiness before requesting Gate 5 approval."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Section icon={Wrench} title="Completion Status">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Systems Count" required error={errors.systemsCount?.message}>
              <input className={inputCls} type="number" min="0" step="1" placeholder="42" readOnly={readOnly} {...register('systemsCount')} />
            </Field>
            <Field label="Punch Items Open Count" required error={errors.punchItemsOpenCount?.message}>
              <input className={inputCls} type="number" min="0" step="1" placeholder="18" readOnly={readOnly} {...register('punchItemsOpenCount')} />
            </Field>
          </div>
        </Section>

        <Section icon={ListChecks} title="Certification & Walkdown">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="MC Certificate Target Date" required error={errors.mcCertificateTargetDate?.message}>
              <input className={inputCls} type="date" readOnly={readOnly} {...register('mcCertificateTargetDate')} />
            </Field>
            <Field label="Walkdown Date" required error={errors.walkdownDate?.message}>
              <input className={inputCls} type="date" readOnly={readOnly} {...register('walkdownDate')} />
            </Field>
            <Field label="As-Built Status" required error={errors.asBuiltStatus?.message}>
              <select className={selectCls} disabled={readOnly} {...register('asBuiltStatus')}>
                <option value="not-started">Not Started</option>
                <option value="in-progress">In Progress</option>
                <option value="complete">Complete</option>
              </select>
            </Field>
          </div>
        </Section>

        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Submit for G5 Approval
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
