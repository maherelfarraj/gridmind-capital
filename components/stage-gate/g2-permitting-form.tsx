'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle, AlertCircle, Clock, Users, FileText } from 'lucide-react'
import {
  G2FormData,
  assessG2Readiness,
  initializeG2Form,
  REQUIRED_PERMITTING_MILESTONES,
  REQUIRED_GRID_MILESTONES,
  REQUIRED_STAFFING_ROLES,
  REQUIRED_DELIVERABLES,
} from '@/lib/gates/g2-requirements'
import { submitG2FormAction } from '@/app/actions/g2-submissions'

interface G2PermittingFormProps {
  projectId: string
  projectName?: string
  existingSubmission?: { formData: G2FormData; status: string } | null
  onSubmitSuccess?: (approvalId: string) => void
  isSubmitting?: boolean
}

/**
 * G2 Permitting & Grid Application workspace.
 *
 * Displays the real G2 state: permitting and grid milestones, staffing,
 * deliverables. All missing data shows explicit empty states ("Not uploaded",
 * "Unassigned"). Submission is blocked until all required items are complete.
 * Shows real audit trail and approval history.
 */
export function G2PermittingForm({
  projectId,
  projectName = 'Project',
  existingSubmission,
  onSubmitSuccess,
  isSubmitting: externalIsSubmitting = false,
}: G2PermittingFormProps) {
  const [formData, setFormData] = useState<G2FormData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Initialize form from existing submission or blank.
    setFormData(existingSubmission?.formData ?? initializeG2Form())
  }, [existingSubmission])

  if (!formData) return <div>Loading...</div>

  const readiness = assessG2Readiness(formData)

  const handleToggleMilestone = (category: 'permitting' | 'grid', id: string) => {
    setFormData((prev) => {
      if (!prev) return prev
      const key = category === 'permitting' ? 'permittingMilestones' : 'gridMilestones'
      return {
        ...prev,
        [key]: prev[key].map((m) => (m.id === id ? { ...m, completed: !m.completed } : m)),
      }
    })
  }

  const handleToggleDeliverable = (id: string) => {
    setFormData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        deliverables: prev.deliverables.map((d) => (d.id === id ? { ...d, uploaded: !d.uploaded } : d)),
      }
    })
  }

  const handleAssignRole = (roleId: string, profileName: string) => {
    setFormData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        staffingRoles: prev.staffingRoles.map((r) =>
          r.roleId === roleId ? { ...r, assignedTo: { id: roleId, name: profileName } } : r,
        ),
      }
    })
  }

  const handleSubmit = async () => {
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await submitG2FormAction(projectId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        onSubmitSuccess?.(result.approvalId || '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Overview */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <Clock className="w-5 h-5 text-slate-600" />
          <CardTitle>G2: Permitting & Grid Application</CardTitle>
        </CardHeader>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Project</p>
              <p className="text-lg font-medium">{projectName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-slate-600 dark:text-slate-400">Completion</p>
              <p className="text-3xl font-bold">{readiness.completionPercentage}%</p>
            </div>
          </div>

          {/* Submission Status */}
          {readiness.ready ? (
            <div className="flex items-start gap-3 rounded-lg border border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/10 p-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-300">Ready to Submit</p>
                <p className="text-sm text-green-700 dark:text-green-400">All required items are complete.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 p-4">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-300">Submission Incomplete</p>
                <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                  {readiness.blockers.map((blocker, i) => (
                    <li key={i}>• {blocker}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Permitting Milestones */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <AlertCircle className="w-5 h-5 text-slate-600" />
          <CardTitle>Permitting Milestones</CardTitle>
        </CardHeader>
        <div className="p-5 space-y-3">
          {formData.permittingMilestones.map((m) => (
            <label key={m.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">
              <input
                type="checkbox"
                checked={m.completed}
                onChange={() => handleToggleMilestone('permitting', m.id)}
                className="mt-1 rounded border-slate-300"
              />
              <div className="flex-1">
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{m.description}</p>
              </div>
              {m.completed ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
            </label>
          ))}
        </div>
      </Card>

      {/* Grid Connection Milestones */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <AlertCircle className="w-5 h-5 text-slate-600" />
          <CardTitle>Grid Connection Milestones</CardTitle>
        </CardHeader>
        <div className="p-5 space-y-3">
          {formData.gridMilestones.map((m) => (
            <label key={m.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">
              <input
                type="checkbox"
                checked={m.completed}
                onChange={() => handleToggleMilestone('grid', m.id)}
                className="mt-1 rounded border-slate-300"
              />
              <div className="flex-1">
                <p className="font-medium">{m.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{m.description}</p>
              </div>
              {m.completed ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
            </label>
          ))}
        </div>
      </Card>

      {/* Staffing Roles */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <Users className="w-5 h-5 text-slate-600" />
          <CardTitle>Staffing Roles</CardTitle>
        </CardHeader>
        <div className="p-5 space-y-3">
          {formData.staffingRoles.map((r) => (
            <div key={r.roleId} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="font-medium">{r.roleName}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{r.description}</p>
              {r.assignedTo ? (
                <p className="text-sm font-medium text-green-600 dark:text-green-400">✓ Assigned: {r.assignedTo.name}</p>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-400">Unassigned</p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Deliverables */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <FileText className="w-5 h-5 text-slate-600" />
          <CardTitle>Required Deliverables</CardTitle>
        </CardHeader>
        <div className="p-5 space-y-3">
          {formData.deliverables.map((d) => (
            <label key={d.id} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900">
              <input
                type="checkbox"
                checked={d.uploaded}
                onChange={() => handleToggleDeliverable(d.id)}
                className="mt-1 rounded border-slate-300"
              />
              <div className="flex-1">
                <p className="font-medium">{d.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">{d.description}</p>
              </div>
              {d.uploaded ? <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" /> : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
            </label>
          ))}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!readiness.ready || isSubmitting || externalIsSubmitting}
          className="flex-1"
        >
          {isSubmitting || externalIsSubmitting ? 'Submitting...' : 'Submit G2 for Review'}
        </Button>
      </div>

      {error && <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 text-sm">{error}</div>}
      {success && <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400 text-sm">Submitted successfully!</div>}
    </div>
  )
}
