'use client'

import { useState } from 'react'
import { updateProjectProvenance } from '@/app/actions/projects'
import { fieldLabel, sourceLabel, isVerified, sourceColorClass, EDITABLE_SOURCES, TRACKED_FIELDS, type TrackedField, type ProvenanceSource } from '@/lib/provenance'
import { NOT_SET_LABEL } from '@/lib/format-nullable'
import type { ProjectData } from '@/components/project/project-command-center'

interface ProvenanceEditorProps {
  project: ProjectData & { provenance?: Record<string, any> }
  readOnly: boolean
  onSaved?: () => void
  mutate?: () => void
}

export function ProvenanceEditor({ project, readOnly, onSaved, mutate }: ProvenanceEditorProps) {
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)

  const provenance = project.provenance ?? {}

  const getFieldValue = (field: TrackedField): string => {
    const val = (project as any)[field]
    if (val == null || val === '' || val === 0) return NOT_SET_LABEL

    // Format dates
    if (field === 'start_date' || field === 'target_completion') {
      if (typeof val === 'string') {
        try {
          return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        } catch {
          return String(val)
        }
      }
    }

    // Format capacity/bess with units
    if (field === 'capacity_mw') return `${val} MW`
    if (field === 'bess_mwh') return `${val} MWh`

    // Format budget as USD
    if (field === 'budget_usd') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(Number(val))
    }

    return String(val)
  }

  const getSourceBadge = (field: TrackedField) => {
    const entry = provenance[field]
    const source = entry?.source ?? null

    if (source === 'pilot_assumption') {
      return <span className={`text-[11px] font-normal ${sourceColorClass(source)}`}>ⓘ assumption</span>
    }

    if (isVerified(source)) {
      return <span className={`text-[11px] font-normal ${sourceColorClass(source)}`}>✓ verified</span>
    }

    return <span className="text-[11px] font-normal text-neutral-400">unrecorded</span>
  }

  const handleSourceChange = async (field: TrackedField, newSource: ProvenanceSource) => {
    setSaving((prev) => ({ ...prev, [field]: true }))
    setError(null)

    try {
      await updateProjectProvenance(project.id, field, newSource)
      if (mutate) mutate()
      if (onSaved) onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update provenance')
    } finally {
      setSaving((prev) => ({ ...prev, [field]: false }))
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <div className="space-y-4">
        <p className="text-sm text-neutral-600">
          Manage data sources for lender-facing fields. Move fields from pilot assumptions to verified sources as they&apos;re confirmed.
        </p>

        <div className="space-y-3">
          {TRACKED_FIELDS.map((field) => (
            <div key={field} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium text-neutral-900">{fieldLabel(field)}</span>
                  <span className="text-sm font-normal text-neutral-600">{getFieldValue(field)}</span>
                </div>
                <div className="mt-1">{getSourceBadge(field)}</div>
              </div>

              {!readOnly && (
                <div className="ml-4 flex items-center gap-2">
                  <select
                    value={provenance[field]?.source ?? 'pilot_assumption'}
                    onChange={(e) => handleSourceChange(field, e.target.value as ProvenanceSource)}
                    disabled={saving[field]}
                    className="rounded border border-neutral-300 bg-white px-2 py-1 text-sm font-medium text-neutral-900 hover:border-neutral-400 disabled:opacity-50"
                  >
                    <option value="pilot_assumption">Pilot Assumption</option>
                    {EDITABLE_SOURCES.map((src) => (
                      <option key={src} value={src}>
                        {sourceLabel(src as ProvenanceSource)}
                      </option>
                    ))}
                  </select>
                  {saving[field] && <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {readOnly && (
        <p className="text-sm text-neutral-500">
          You do not have permission to edit provenance sources. Contact your project administrator.
        </p>
      )}
    </div>
  )
}
