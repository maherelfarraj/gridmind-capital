'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { createActivity, updateActivity, type ScheduleActivity } from '@/app/actions/schedule'

// ─── Schema ──────────────────────────────────────────────────────
const schema = z
  .object({
    activity_code:    z.string().max(40).optional(),
    name:             z.string().min(2, 'Name is required'),
    phase:            z.string().min(1, 'Select a phase'),
    gate_number:      z.string().optional(),
    planned_start:    z.string().optional(),
    planned_finish:   z.string().optional(),
    duration_days:    z.string().optional(),
    weight:           z.string().optional(),
    percent_complete: z.string().optional(),
    is_milestone:     z.boolean(),
    is_critical:      z.boolean(),
  })
  .refine(
    (v) => !v.planned_start || !v.planned_finish || v.planned_finish >= v.planned_start,
    { message: 'Finish must be on or after start', path: ['planned_finish'] },
  )

type FormValues = z.infer<typeof schema>

const PHASE_OPTIONS = [
  { value: 'Development',   label: 'Development' },
  { value: 'Engineering',   label: 'Engineering' },
  { value: 'Procurement',   label: 'Procurement' },
  { value: 'Construction',  label: 'Construction' },
  { value: 'Commissioning', label: 'Commissioning' },
]

const GATE_OPTIONS = Array.from({ length: 8 }, (_, i) => ({ value: String(i), label: `G${i}` }))

const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'
const fieldCls =
  'w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40'

export function ActivityDialog({
  open,
  onOpenChange,
  projectId,
  activity,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  activity?: ScheduleActivity | null
  onSaved: () => void
}) {
  const { toast } = useToast()
  const isEdit = !!activity

  const {
    register, handleSubmit, control, reset, watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      activity_code: '', name: '', phase: '', gate_number: '',
      planned_start: '', planned_finish: '', duration_days: '',
      weight: '1', percent_complete: '0', is_milestone: false, is_critical: false,
    },
  })

  // Sync form values whenever the dialog opens for a new / different activity.
  React.useEffect(() => {
    if (!open) return
    reset({
      activity_code:    activity?.activity_code ?? '',
      name:             activity?.name ?? '',
      phase:            activity?.phase ?? '',
      gate_number:      activity?.gate_number != null ? String(activity.gate_number) : '',
      planned_start:    activity?.planned_start ?? '',
      planned_finish:   activity?.planned_finish ?? '',
      duration_days:    activity?.duration_days != null ? String(activity.duration_days) : '',
      weight:           activity?.weight != null ? String(activity.weight) : '1',
      percent_complete: activity?.percent_complete != null ? String(activity.percent_complete) : '0',
      is_milestone:     !!activity?.is_milestone,
      is_critical:      !!activity?.is_critical,
    })
  }, [open, activity, reset])

  const isMilestone = watch('is_milestone')

  async function onSubmit(values: FormValues) {
    const payload = {
      activity_code:    values.activity_code?.trim() || null,
      name:             values.name.trim(),
      phase:            values.phase,
      gate_number:      values.gate_number ? Number(values.gate_number) : null,
      planned_start:    values.planned_start || null,
      planned_finish:   values.planned_finish || null,
      duration_days:    values.duration_days ? Number(values.duration_days) : null,
      weight:           values.weight ? Number(values.weight) : 1,
      percent_complete: values.percent_complete ? Number(values.percent_complete) : 0,
      is_milestone:     values.is_milestone,
      is_critical:      values.is_critical,
    }

    const res = isEdit
      ? await updateActivity(activity!.id, payload)
      : await createActivity(projectId, payload)

    if (res.error) {
      toast({ title: 'Save failed', description: res.error, variant: 'danger' })
      return
    }
    toast({ title: isEdit ? 'Activity updated' : 'Activity added', variant: 'success' })
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit activity' : 'Add activity'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the activity details and schedule.' : 'Create a new schedule activity.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Code</label>
              <input {...register('activity_code')} placeholder="ENG-010" className={fieldCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Name *</label>
              <input {...register('name')} placeholder="e.g. 60% design" className={fieldCls} />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phase *</label>
              <Controller
                control={control}
                name="phase"
                render={({ field }) => (
                  <Select
                    options={PHASE_OPTIONS}
                    value={field.value || undefined}
                    onValueChange={(v) => field.onChange(v ?? '')}
                    placeholder="Select phase"
                    fullWidth
                  />
                )}
              />
              {errors.phase && <p className="mt-1 text-xs text-red-500">{errors.phase.message}</p>}
            </div>
            <div>
              <label className={labelCls}>Gate link</label>
              <Controller
                control={control}
                name="gate_number"
                render={({ field }) => (
                  <Select
                    options={GATE_OPTIONS}
                    value={field.value || undefined}
                    onValueChange={(v) => field.onChange(v ?? '')}
                    placeholder="No gate"
                    fullWidth
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Planned start</label>
              <input type="date" {...register('planned_start')} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Planned finish</label>
              <input type="date" {...register('planned_finish')} className={fieldCls} />
              {errors.planned_finish && <p className="mt-1 text-xs text-red-500">{errors.planned_finish.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Duration (days)</label>
              <input type="number" min={0} {...register('duration_days')} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>Weight</label>
              <input type="number" min={0} step="0.5" {...register('weight')} className={fieldCls} />
            </div>
            <div>
              <label className={labelCls}>% complete</label>
              <input type="number" min={0} max={100} {...register('percent_complete')} className={fieldCls} />
            </div>
          </div>

          <div className="flex items-center gap-6 pt-1">
            <Controller
              control={control}
              name="is_milestone"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                  Milestone
                </label>
              )}
            />
            <Controller
              control={control}
              name="is_critical"
              render={({ field }) => (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                  Critical path
                </label>
              )}
            />
          </div>

          {isMilestone && (
            <p className="text-xs text-muted-foreground">
              Milestones render as a diamond at the planned start date.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              {isEdit ? 'Save changes' : 'Add activity'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
