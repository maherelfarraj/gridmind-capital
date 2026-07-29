'use client'

/**
 * G4 — Detailed Design (IFC) Engineering Approval Form
 * BATCH 20: Canonical gate 4 (rendered from g2-engineering-form.tsx)
 * react-hook-form + zod, shadcn/ui card layout (matches G1 styling).
 */
import * as React from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, FileText, Plus, X, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { submitG2FormAction, type G2FormData } from '@/app/actions/gate-submissions'
import { Section, Field, GateFormHeader, SuccessCard, inputCls, selectCls, textareaCls } from './gate-form-primitives'

const DISCIPLINES = ['Civil', 'Structural', 'Mechanical', 'Electrical', 'Instrumentation & Control', 'Process', 'HVAC', 'Telecom']

const schema = z.object({
  engineeringPackagesPlanned: z.string().min(1, 'Required'),
  disciplinesInvolved:        z.array(z.string()).min(1, 'Select at least one discipline'),
  ifcTargetDate:              z.string().min(1, 'Required'),
  keyDeliverables:            z.array(z.object({ value: z.string().min(1, 'Required') })).min(1, 'Add at least one deliverable'),
  designBasisNotes:           z.string().max(500).optional(),
})
type FormValues = z.infer<typeof schema>

const DEFAULT: FormValues = {
  engineeringPackagesPlanned: '',
  disciplinesInvolved:        [],
  ifcTargetDate:              '',
  keyDeliverables:            [{ value: '' }],
  designBasisNotes:           '',
}

interface Props {
  projectId: string
  projectCode: string
  projectName: string
  initialData?: Partial<G2FormData>
  readOnly?: boolean
}

export function G2EngineeringForm({ projectId, projectCode, projectName, initialData, readOnly = false }: Props) {
  const { toast } = useToast()
  const [submitted, setSubmitted] = React.useState(false)

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...DEFAULT, ...initialData },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'keyDeliverables' })

  async function onSubmit(values: FormValues) {
    if (readOnly) return
    const { error } = await submitG2FormAction(values as G2FormData, projectId, projectName)
    if (error) {
      toast({ title: 'Submission failed', description: error, variant: 'danger' })
    } else {
      setSubmitted(true)
      toast({ title: 'G4 Package submitted', description: 'Detailed design package saved and sent for approval.', variant: 'success' })
    }
  }

  if (submitted) return <SuccessCard gate="G4" projectId={projectId} onReset={() => setSubmitted(false)} />

  return (
    <div className="space-y-6">
      <GateFormHeader
        gate="G4" subtitle="Detailed Design (IFC)"
        projectCode={projectCode} projectName={projectName}
        description="Confirm the engineering scope, disciplines, and design basis before requesting Gate 4 approval."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Section icon={Layers} title="Engineering Scope">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Engineering Packages (planned count)" required error={errors.engineeringPackagesPlanned?.message}>
              <input className={inputCls} type="number" min="0" step="1" placeholder="12" readOnly={readOnly} {...register('engineeringPackagesPlanned')} />
            </Field>
            <Field label="IFC Target Date" required error={errors.ifcTargetDate?.message} hint="Issued-For-Construction target">
              <input className={inputCls} type="date" readOnly={readOnly} {...register('ifcTargetDate')} />
            </Field>
          </div>

          <Field label="Disciplines Involved" required error={errors.disciplinesInvolved?.message}>
            <Controller
              control={control}
              name="disciplinesInvolved"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {DISCIPLINES.map((d) => {
                    const active = field.value.includes(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={readOnly}
                        onClick={() => field.onChange(active ? field.value.filter((v) => v !== d) : [...field.value, d])}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                          active
                            ? 'bg-[#64ffda]/10 text-[#64ffda] border-[#64ffda]/40'
                            : 'text-muted-foreground border-border hover:bg-muted',
                        )}
                      >
                        {d}
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </Field>
        </Section>

        <Section icon={FileText} title="Key Deliverables">
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    className={inputCls}
                    placeholder={`Deliverable ${i + 1} (e.g. Overall Plot Plan)`}
                    readOnly={readOnly}
                    {...register(`keyDeliverables.${i}.value` as const)}
                  />
                  {errors.keyDeliverables?.[i]?.value && (
                    <p className="text-[11px] text-red-500 mt-1" role="alert">{errors.keyDeliverables[i]?.value?.message}</p>
                  )}
                </div>
                {!readOnly && fields.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="h-9 px-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition" aria-label="Remove deliverable">
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {errors.keyDeliverables?.root && (
              <p className="text-[11px] text-red-500" role="alert">{errors.keyDeliverables.root.message}</p>
            )}
            {!readOnly && (
              <button type="button" onClick={() => append({ value: '' })} className="flex items-center gap-1.5 text-xs font-medium text-[#64ffda] hover:underline">
                <Plus className="size-3.5" aria-hidden /> Add deliverable
              </button>
            )}
          </div>

          <Field label="Design Basis Notes" error={errors.designBasisNotes?.message}>
            <textarea className={textareaCls} placeholder="Design codes, standards, key assumptions, and interfaces..." readOnly={readOnly} {...register('designBasisNotes')} />
          </Field>
        </Section>

        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Submit for G4 Approval
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
