'use client'

/**
 * G5 — Procurement & Manufacturing Approval Form
 * BATCH 20: Canonical gate 5 (rendered from g3-procurement-form.tsx)
 * react-hook-form + zod, shadcn/ui card layout (matches G1 styling).
 */
import * as React from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, ShoppingCart, Plus, X, Users } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { submitG5FormAction, type G5FormData } from '@/app/actions/gate-submissions'
import { Section, Field, GateFormHeader, SuccessCard, inputCls, selectCls, textareaCls } from './gate-form-primitives'

const schema = z.object({
  contractingStrategy:    z.enum(['EPC', 'EPCM', 'multi-package']),
  bidders:                z.array(z.object({ name: z.string().min(1, 'Required') })).min(1, 'Add at least one bidder'),
  targetAwardDate:        z.string().min(1, 'Required'),
  estimatedContractValue: z.string().min(1, 'Required'),
  longLeadItemsNotes:     z.string().max(500).optional(),
})
type FormValues = z.infer<typeof schema>

const DEFAULT: FormValues = {
  contractingStrategy:    'EPC',
  bidders:                [{ name: '' }],
  targetAwardDate:        '',
  estimatedContractValue: '',
  longLeadItemsNotes:     '',
}

interface Props {
  projectId: string
  projectCode: string
  projectName: string
  initialData?: Partial<G5FormData>
  readOnly?: boolean
}

export function G3ProcurementForm({ projectId, projectCode, projectName, initialData, readOnly = false }: Props) {
  const { toast } = useToast()
  const [submitted, setSubmitted] = React.useState(false)

  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...DEFAULT, ...initialData },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'bidders' })

  async function onSubmit(values: FormValues) {
    if (readOnly) return
    const { error } = await submitG5FormAction(values as G5FormData, projectId, projectName)
    if (error) {
      toast({ title: 'Submission failed', description: error, variant: 'danger' })
    } else {
      setSubmitted(true)
      toast({ title: 'G5 Package submitted', description: 'Procurement & manufacturing package saved and sent for approval.', variant: 'success' })
    }
  }

  if (submitted) return <SuccessCard gate="G5" projectId={projectId} onReset={() => setSubmitted(false)} />

  return (
    <div className="space-y-6">
      <GateFormHeader
        gate="G5" subtitle="Procurement & Manufacturing"
        projectCode={projectCode} projectName={projectName}
        description="Confirm the contracting strategy, bidders, and award plan before requesting Gate 5 approval."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Section icon={ShoppingCart} title="Contracting Strategy">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Contracting Strategy" required error={errors.contractingStrategy?.message}>
              <select className={selectCls} disabled={readOnly} {...register('contractingStrategy')}>
                <option value="EPC">EPC (single turnkey contractor)</option>
                <option value="EPCM">EPCM (managed, reimbursable)</option>
                <option value="multi-package">Multi-package</option>
              </select>
            </Field>
            <Field label="Target Award Date" required error={errors.targetAwardDate?.message}>
              <input className={inputCls} type="date" readOnly={readOnly} {...register('targetAwardDate')} />
            </Field>
            <Field label="Estimated Contract Value (USD)" required error={errors.estimatedContractValue?.message}>
              <input className={inputCls} type="number" min="0" step="1000" placeholder="250000000" readOnly={readOnly} {...register('estimatedContractValue')} />
            </Field>
          </div>
        </Section>

        <Section icon={Users} title="Bidders">
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <input
                    className={inputCls}
                    placeholder={`Bidder ${i + 1} (e.g. Larsen & Toubro)`}
                    readOnly={readOnly}
                    {...register(`bidders.${i}.name` as const)}
                  />
                  {errors.bidders?.[i]?.name && (
                    <p className="text-[11px] text-red-500 mt-1" role="alert">{errors.bidders[i]?.name?.message}</p>
                  )}
                </div>
                {!readOnly && fields.length > 1 && (
                  <button type="button" onClick={() => remove(i)} className="h-9 px-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition" aria-label="Remove bidder">
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            {errors.bidders?.root && (
              <p className="text-[11px] text-red-500" role="alert">{errors.bidders.root.message}</p>
            )}
            {!readOnly && (
              <button type="button" onClick={() => append({ name: '' })} className="flex items-center gap-1.5 text-xs font-medium text-[#64ffda] hover:underline">
                <Plus className="size-3.5" aria-hidden /> Add bidder
              </button>
            )}
          </div>

          <Field label="Long-Lead Items Notes" error={errors.longLeadItemsNotes?.message} hint="Transformers, switchgear, turbines, etc.">
            <textarea className={textareaCls} placeholder="1. Main power transformers — 14 month lead\n2. GIS switchgear — 12 month lead..." readOnly={readOnly} {...register('longLeadItemsNotes')} />
          </Field>
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
