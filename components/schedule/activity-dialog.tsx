'use client'

import * as React from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
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
    status:           z.string().optional(),
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

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed',   label: 'Completed' },
]

/** Mirror of the server-side derivation so the status field tracks the slider. */
function statusFromPercent(pct: number): string {
  if (pct <= 0)   return 'not_started'
  if (pct >= 100) return 'completed'
  return 'in_progress'
}

const labelCls = 'block text-xs font-medium text-muted-foreground mb-1'
const fieldCls =
  'w-full h-9 rounded-lg border border-border bg-muted/30 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/40'

export function ActivityDialog({
  open,
  onOpenChange,
  projectId,
  activity,
  onSaved,
  pickerActivities,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  activity?: ScheduleActivity | null
  onSaved: () => void
  /** When provided (and no fixed `activity`), the dialog runs in "Update progress"
   *  mode: it shows an activity picker at the top. The parent pre-filters this list. */
  pickerActivities?: ScheduleActivity[] | null
}) {
  const { toast } = useToast()

  // Progress mode = opened from the "Update progress" header button.
  const picker = !activity && !!pickerActivities
  const [pickedId, setPickedId] = React.useState<string | null>(null)

  // The activity the form is actually editing (fixed row, or the picked one).
  const effective = activity ?? (pickerActivities?.find((a) => a.id === pickedId) ?? null)
  const targetId = effective?.id ?? null

  const {
    register, handleSubmit, control, reset, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      activity_code: '', name: '', phase: '', gate_number: '',
      planned_start: '', planned_finish: '', duration_days: '',
      weight: '1', percent_complete: '0', status: 'not_started',
      is_milestone: false, is_critical: false,
    },
  })

  // Clear the picker selection each time the dialog re-opens in progress mode.
  React.useEffect(() => {
    if (open && picker) setPickedId(null)
  }, [open, picker])

  // Sync form values whenever the dialog opens for a new / different activity.
  React.useEffect(() => {
    if (!open) return
    reset({
      activity_code:    effective?.activity_code ?? '',
      name:             effective?.name ?? '',
      phase:            effective?.phase ?? '',
      gate_number:      effective?.gate_number != null ? String(effective.gate_number) : '',
      planned_start:    effective?.planned_start ?? '',
      planned_finish:   effective?.planned_finish ?? '',
      duration_days:    effective?.duration_days != null ? String(effective.duration_days) : '',
      weight:           effective?.weight != null ? String(effective.weight) : '1',
      percent_complete: effective?.percent_complete != null ? String(effective.percent_complete) : '0',
      status:           effective?.status ?? 'not_started',
      is_milestone:     !!effective?.is_milestone,
      is_critical:      !!effective?.is_critical,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetId, reset])

  const isMilestone = watch('is_milestone')

  const heading     = picker ? 'Update progress' : activity ? 'Edit activity' : 'Add activity'
  const description  = picker
    ? 'Choose an activity and update its progress.'
    : activity ? 'Update the activity details and schedule.' : 'Create a new schedule activity.'
  const submitLabel = picker ? 'Save progress' : activity ? 'Save changes' : 'Add activity'

  const pickerOptions = (pickerActivities ?? []).map((a) => ({
    value: a.id,
    label: `${a.activity_code ? a.activity_code + ' · ' : ''}${a.name}`,
  }))

  // In progress mode, hide the detail fields until an activity is chosen.
  const showFields = !picker || !!pickedId

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
      status:           values.status || null,
      is_milestone:     values.is_milestone,
      is_critical:      values.is_critical,
    }

    // `updateActivity` writes a progress_updates row automatically when
    // percent_complete changes (see app/actions/schedule.ts).
    const res = effective
      ? await updateActivity(effective.id, payload)
      : await createActivity(projectId, payload)

    if (res.error) {
      toast({ title: 'Save failed', description: res.error, variant: 'danger' })
      return
    }
    toast({
      title: picker ? 'Progress updated' : activity ? 'Activity updated' : 'Activity added',
      variant: 'success',
    })
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="relative max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {picker && (
            <div>
              <label className={labelCls}>Activity *</label>
              <Select
                options={pickerOptions}
                value={pickedId ?? undefined}
                onValueChange={(v) => setPickedId(v ?? null)}
                placeholder={pickerOptions.length ? 'Select an activity' : 'No open activities'}
                fullWidth
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Showing in-progress and not-started activities.
              </p>
            </div>
          )}

          {showFields && (
            <>
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

              {/* % complete — slider + number input, kept in sync */}
              <Controller
                control={control}
                name="percent_complete"
                render={({ field }) => {
                  const num = Math.max(0, Math.min(100, Math.round(Number(field.value || 0))))
                  const apply = (n: number) => {
                    const clamped = Math.max(0, Math.min(100, Math.round(Number.isNaN(n) ? 0 : n)))
                    field.onChange(String(clamped))
                    // Keep the status field in step with the slider.
                    setValue('status', statusFromPercent(clamped), { shouldDirty: true })
                  }
                  return (
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className={labelCls + ' mb-0'}>% complete</label>
                        <span className="text-xs font-semibold tabular-nums text-foreground">{num}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Slider
                          value={[num]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(v) => apply(Array.isArray(v) ? v[0] : (v as number))}
                          className="flex-1"
                          aria-label="Percent complete"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={num}
                          onChange={(e) => apply(Number(e.target.value))}
                          className={fieldCls + ' w-20 text-center'}
                          aria-label="Percent complete value"
                        />
                      </div>
                    </div>
                  )
                }}
              />

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
                  <label className={labelCls}>Status</label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select
                        options={STATUS_OPTIONS}
                        value={field.value || undefined}
                        onValueChange={(v) => field.onChange(v ?? '')}
                        placeholder="Status"
                        fullWidth
                      />
                    )}
                  />
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
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={isSubmitting || (picker && !pickedId)}>
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
