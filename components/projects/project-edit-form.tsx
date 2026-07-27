'use client'

import * as React from 'react'
import { updateProject } from '@/app/actions/projects'

/**
 * Structural shape of the fields this form edits. Declared locally rather than
 * reusing ProjectData/Project so the form works with either of the two project
 * types in this codebase (they differ on `capacity` vs `capacityMw`).
 */
export interface EditableProject {
  id: string
  name?: string
  country?: string
  location?: string
  technology?: string
  /** NULL/undefined = not recorded yet; a real 0 is a value and is preserved. */
  capacityMw?: number | null
  budgetUsd?: number | null
  /** Accepts a Date or ISO string; normalised by toDateInput before display. */
  targetCod?: string | Date
  description?: string
}

interface ProjectEditFormProps {
  project: EditableProject
  /** Called after a successful save so the parent can revalidate SWR. */
  onSaved?: () => void
  onCancel?: () => void
  /** Viewers get a read-only notice instead of the form. */
  readOnly?: boolean
}

const FIELD_CLASS =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground ' +
  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40'

const LABEL_CLASS = 'block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5'

/** Normalise an ISO timestamp or date into the `yyyy-MM-dd` a date input requires. */
function toDateInput(value: string | Date | undefined): string {
  if (!value) return ''
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

export function ProjectEditForm({ project, onSaved, onCancel, readOnly }: ProjectEditFormProps) {
  const [name, setName]         = React.useState(project.name ?? '')
  const [country, setCountry]   = React.useState(project.country ?? '')
  const [location, setLocation] = React.useState(project.location ?? '')
  const [technology, setTechnology] = React.useState(project.technology ?? '')
  // An empty input means "not set"; a real 0 must round-trip as "0", not blank.
  // (The old `!== 0` test existed only because NULL used to arrive coerced to 0.)
  const [capacity, setCapacity] = React.useState(
    project.capacityMw != null ? String(project.capacityMw) : '',
  )
  const [budget, setBudget]     = React.useState(
    project.budgetUsd != null ? String(project.budgetUsd) : '',
  )
  const [targetCod, setTargetCod] = React.useState(toDateInput(project.targetCod))
  const [description, setDescription] = React.useState(project.description ?? '')

  const [saving, setSaving] = React.useState(false)
  const [error, setError]   = React.useState<string | null>(null)
  const [saved, setSaved]   = React.useState(false)

  // Re-sync when a different project is loaded into the panel.
  React.useEffect(() => {
    setName(project.name ?? '')
    setCountry(project.country ?? '')
    setLocation(project.location ?? '')
    setTechnology(project.technology ?? '')
    setCapacity(project.capacityMw != null ? String(project.capacityMw) : '')
    setBudget(project.budgetUsd != null ? String(project.budgetUsd) : '')
    setTargetCod(toDateInput(project.targetCod))
    setDescription(project.description ?? '')
    setError(null)
    setSaved(false)
  }, [project])

  if (readOnly) {
    return (
      <p className="text-sm text-muted-foreground">
        You have read-only access to this project, so its details cannot be edited.
      </p>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)

    if (!name.trim()) {
      setError('Project name is required.')
      return
    }
    // Reject non-numeric / negative input before it reaches the DB.
    // An emptied field sends `null` (explicitly clear back to "Not set"), NOT
    // `undefined` — updateProject skips undefined keys, so clearing a budget
    // would otherwise be silently ignored.
    const capNum = capacity.trim() === '' ? null : Number(capacity)
    if (capNum !== null && (Number.isNaN(capNum) || capNum < 0)) {
      setError('Capacity must be a positive number.')
      return
    }
    const budgetNum = budget.trim() === '' ? null : Number(budget)
    if (budgetNum !== null && (Number.isNaN(budgetNum) || budgetNum < 0)) {
      setError('Budget must be a positive number.')
      return
    }

    setSaving(true)
    const res = await updateProject(project.id, {
      name: name.trim(),
      country,
      location,
      technology,
      capacity_mw: capNum,
      budget_usd: budgetNum,
      target_completion: targetCod,
      description,
    })
    setSaving(false)

    if (res.error) {
      setError(res.error)
      return
    }
    setSaved(true)
    onSaved?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={LABEL_CLASS} htmlFor="pe-name">Project name</label>
        <input id="pe-name" className={FIELD_CLASS} value={name}
          onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="pe-tech">Technology</label>
        <input id="pe-tech" className={FIELD_CLASS} value={technology}
          placeholder="e.g. Solar PV" onChange={(e) => setTechnology(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="pe-country">Country</label>
          <input id="pe-country" className={FIELD_CLASS} value={country}
            onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="pe-location">Location</label>
          <input id="pe-location" className={FIELD_CLASS} value={location}
            onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="pe-cap">Capacity (MW)</label>
          <input id="pe-cap" type="number" min="0" step="any" className={FIELD_CLASS}
            value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="pe-budget">Budget (USD)</label>
          <input id="pe-budget" type="number" min="0" step="any" className={FIELD_CLASS}
            value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="pe-cod">Target COD</label>
        <input id="pe-cod" type="date" className={FIELD_CLASS} value={targetCod}
          onChange={(e) => setTargetCod(e.target.value)} />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="pe-desc">Description</label>
        <textarea id="pe-desc" rows={3} className={FIELD_CLASS} value={description}
          onChange={(e) => setDescription(e.target.value)} />
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </p>
      )}
      {saved && !error && (
        <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
          Changes saved.
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={saving}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
