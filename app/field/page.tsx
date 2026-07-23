'use client'

import * as React from 'react'
import { Sun, Cloud, CloudRain, Wind, Haze, ThermometerSun, Minus, Plus, Save, Send, WifiOff, RefreshCw, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { useField } from '@/components/field/field-context'
import {
  getDailyReport,
  saveDailyReport,
  submitDailyReport,
  type DailyReportDetail,
} from '@/app/actions/field'

const WEATHER_OPTIONS = [
  { value: 'clear',         label: 'Clear',   icon: Sun },
  { value: 'cloudy',        label: 'Cloudy',  icon: Cloud },
  { value: 'rain',          label: 'Rain',    icon: CloudRain },
  { value: 'wind',          label: 'Windy',   icon: Wind },
  { value: 'dust_storm',    label: 'Dust',    icon: Haze },
  { value: 'extreme_heat',  label: 'Heat',    icon: ThermometerSun },
] as const

interface FormState {
  weather: string
  temp_high_c: string
  wind_kmh: string
  workforce_count: number
  equipment_count: number
  work_performed: string
  delays: string
  safety_notes: string
  visitors: string
}

const EMPTY: FormState = {
  weather: '', temp_high_c: '', wind_kmh: '',
  workforce_count: 0, equipment_count: 0,
  work_performed: '', delays: '', safety_notes: '', visitors: '',
}

function fromReport(r: DailyReportDetail): FormState {
  return {
    weather:         r.weather ?? '',
    temp_high_c:     r.temp_high_c != null ? String(r.temp_high_c) : '',
    wind_kmh:        r.wind_kmh != null ? String(r.wind_kmh) : '',
    workforce_count: r.workforce_count ?? 0,
    equipment_count: r.equipment_count ?? 0,
    work_performed:  r.work_performed ?? '',
    delays:          r.delays ?? '',
    safety_notes:    r.safety_notes ?? '',
    visitors:        r.visitors ?? '',
  }
}

const today = () => new Date().toISOString().slice(0, 10)

export default function FieldTodayPage() {
  const { projectId, project, projects, setProjectId, online, canWrite, userId, loadingProjects } = useField()
  const { toast } = useToast()
  const date = today()

  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [reportId, setReportId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<string>('draft')
  const [loading, setLoading] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [hasLocalDraft, setHasLocalDraft] = React.useState(false)

  const draftKey = projectId ? `field-draft-${projectId}-${date}` : null

  // Load the report for the selected project/date.
  React.useEffect(() => {
    if (!projectId || !draftKey) return
    let cancelled = false
    const local = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null

    if (!online) {
      if (local) { setForm(JSON.parse(local)); setHasLocalDraft(true) }
      else { setForm(EMPTY); setHasLocalDraft(false) }
      setReportId(null)
      return
    }

    setLoading(true)
    getDailyReport(projectId, date).then((r) => {
      if (cancelled) return
      if (local) {
        // An unsynced on-device draft takes precedence; offer to sync it.
        setForm(JSON.parse(local))
        setHasLocalDraft(true)
      } else if (r) {
        setForm(fromReport(r))
        setHasLocalDraft(false)
      } else {
        setForm(EMPTY)
        setHasLocalDraft(false)
      }
      setReportId(r?.id ?? null)
      setStatus(r?.status ?? 'draft')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [projectId, date, online, draftKey])

  // Continuously persist to this device while offline.
  React.useEffect(() => {
    if (online || !draftKey) return
    window.localStorage.setItem(draftKey, JSON.stringify(form))
    setHasLocalDraft(true)
  }, [form, online, draftKey])

  const readOnly = !canWrite || status === 'submitted'

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function payload() {
    return {
      report_date:     date,
      weather:         form.weather || null,
      temp_high_c:     form.temp_high_c === '' ? null : Number(form.temp_high_c),
      wind_kmh:        form.wind_kmh === '' ? null : Number(form.wind_kmh),
      workforce_count: form.workforce_count,
      equipment_count: form.equipment_count,
      work_performed:  form.work_performed || null,
      delays:          form.delays || null,
      safety_notes:    form.safety_notes || null,
      visitors:        form.visitors || null,
    }
  }

  function clearLocal() {
    if (draftKey) window.localStorage.removeItem(draftKey)
    setHasLocalDraft(false)
  }

  async function handleSaveDraft() {
    if (!projectId) return
    if (!online) {
      if (draftKey) window.localStorage.setItem(draftKey, JSON.stringify(form))
      setHasLocalDraft(true)
      toast({ title: 'Saved on this device', description: 'It will sync when you reconnect.', variant: 'info' })
      return
    }
    setBusy(true)
    const res = await saveDailyReport(projectId, payload())
    setBusy(false)
    if ('error' in res) { toast({ title: 'Could not save', description: res.error, variant: 'danger' }); return }
    setReportId(res.id)
    clearLocal()
    toast({ title: 'Draft saved', variant: 'success' })
  }

  async function handleSubmit() {
    if (!projectId) return
    if (!online) {
      toast({ title: 'Cannot submit while offline', description: 'Your draft is saved on this device.', variant: 'warning' })
      return
    }
    setBusy(true)
    const saved = await saveDailyReport(projectId, payload())
    if ('error' in saved) { setBusy(false); toast({ title: 'Could not save', description: saved.error, variant: 'danger' }); return }
    const res = await submitDailyReport(saved.id, userId)
    setBusy(false)
    if (res.error) { toast({ title: 'Could not submit', description: res.error, variant: 'danger' }); return }
    setReportId(saved.id)
    setStatus('submitted')
    clearLocal()
    toast({ title: 'Report submitted', variant: 'success' })
  }

  async function handleSync() {
    if (!projectId) return
    setBusy(true)
    const res = await saveDailyReport(projectId, payload())
    setBusy(false)
    if ('error' in res) { toast({ title: 'Sync failed', description: res.error, variant: 'danger' }); return }
    setReportId(res.id)
    clearLocal()
    toast({ title: 'Draft synced', variant: 'success' })
  }

  return (
    <div className="flex flex-col gap-5 py-4">
      {/* Project picker */}
      <div>
        <label htmlFor="field-project" className="mb-1.5 block text-xs font-medium text-muted-foreground">Project</label>
        <select
          id="field-project"
          value={projectId ?? ''}
          onChange={(e) => setProjectId(e.target.value)}
          disabled={loadingProjects || projects.length === 0}
          className="h-12 w-full rounded-xl border border-border bg-card px-3 text-base font-medium text-card-foreground"
        >
          {projects.length === 0 && <option value="">No projects</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
          ))}
        </select>
      </div>

      {/* Date + status */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Daily Report · {date}</p>
        <span className={cn(
          'rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize',
          status === 'submitted' ? 'bg-[#22c55e]/15 text-[#16a34a]' : 'bg-muted text-muted-foreground',
        )}>{status}</span>
      </div>

      {/* Offline / sync banners */}
      {!online && (
        <div className="flex items-center gap-2 rounded-xl border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2.5 text-sm text-[#b45309]">
          <WifiOff className="size-4 shrink-0" aria-hidden="true" />
          <span>Saved on device — will sync when you reconnect.</span>
        </div>
      )}
      {online && hasLocalDraft && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-foreground">
          <span>You have an unsynced on-device draft.</span>
          <button
            onClick={handleSync}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Sync now
          </button>
        </div>
      )}

      {readOnly && !canWrite && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          <span>You have read-only access.</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <fieldset disabled={readOnly} className="flex flex-col gap-5 disabled:opacity-70">
          {/* Weather */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Weather</p>
            <div className="grid grid-cols-3 gap-2">
              {WEATHER_OPTIONS.map((w) => {
                const Icon = w.icon
                const active = form.weather === w.value
                return (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => update('weather', w.value)}
                    className={cn(
                      'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {w.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Temp + wind */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="temp" className="mb-1.5 block text-xs font-medium text-muted-foreground">Temp high (°C)</label>
              <input
                id="temp" type="number" inputMode="numeric" value={form.temp_high_c}
                onChange={(e) => update('temp_high_c', e.target.value)}
                className="h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-card-foreground"
              />
            </div>
            <div>
              <label htmlFor="wind" className="mb-1.5 block text-xs font-medium text-muted-foreground">Wind (km/h)</label>
              <input
                id="wind" type="number" inputMode="numeric" value={form.wind_kmh}
                onChange={(e) => update('wind_kmh', e.target.value)}
                className="h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-card-foreground"
              />
            </div>
          </div>

          {/* Steppers */}
          <Stepper label="Workforce on site" value={form.workforce_count} onChange={(v) => update('workforce_count', v)} disabled={readOnly} />
          <Stepper label="Equipment on site" value={form.equipment_count} onChange={(v) => update('equipment_count', v)} disabled={readOnly} />

          {/* Textareas */}
          <Field label="Work performed">
            <textarea rows={4} value={form.work_performed} onChange={(e) => update('work_performed', e.target.value)}
              className="w-full rounded-xl border border-border bg-card p-3 text-base text-card-foreground" />
          </Field>
          <Field label="Delays / disruptions">
            <textarea rows={3} value={form.delays} onChange={(e) => update('delays', e.target.value)}
              className="w-full rounded-xl border border-border bg-card p-3 text-base text-card-foreground" />
          </Field>
          <Field label="Safety notes">
            <textarea rows={3} value={form.safety_notes} onChange={(e) => update('safety_notes', e.target.value)}
              className="w-full rounded-xl border border-border bg-card p-3 text-base text-card-foreground" />
          </Field>
          <Field label="Visitors">
            <input value={form.visitors} onChange={(e) => update('visitors', e.target.value)}
              className="h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-card-foreground" />
          </Field>
        </fieldset>
      )}

      {/* Actions */}
      {canWrite && status !== 'submitted' && (
        <div className="sticky bottom-2 flex gap-3 pt-2">
          <button
            onClick={handleSaveDraft}
            disabled={busy || !projectId}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-card-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || !projectId}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submit report
          </button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Stepper({ label, value, onChange, disabled }: {
  label: string; value: number; onChange: (v: number) => void; disabled?: boolean
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button" aria-label={`Decrease ${label}`} disabled={disabled || value <= 0}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-card-foreground disabled:opacity-40"
        >
          <Minus className="size-5" aria-hidden="true" />
        </button>
        <input
          type="number" inputMode="numeric" value={value} disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="h-12 flex-1 rounded-xl border border-border bg-card text-center text-lg font-semibold text-card-foreground"
        />
        <button
          type="button" aria-label={`Increase ${label}`} disabled={disabled}
          onClick={() => onChange(value + 1)}
          className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-card-foreground disabled:opacity-40"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
