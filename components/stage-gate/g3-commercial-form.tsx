'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Circle, AlertCircle, Briefcase, DollarSign, Users, FileText } from 'lucide-react'
import { G3FormData, REQUIRED_COMMERCIAL_MILESTONES, REQUIRED_FINANCIAL_CHECKPOINTS, REQUIRED_DELIVERABLES, REQUIRED_STAFFING_ROLES, initializeG3Form, assessG3Readiness } from '@/lib/gates/g3-requirements'
import { submitG3FormAction } from '@/app/actions/g3-submissions'

interface G3CommercialFormProps {
  projectId: string
  projectName: string
  existingSubmission?: { formData?: G3FormData; status?: string } | null
}

export function G3CommercialForm({ projectId, projectName, existingSubmission }: G3CommercialFormProps) {
  const [formData, setFormData] = useState<G3FormData>(initializeG3Form())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [readiness, setReadiness] = useState(assessG3Readiness(null))

  // Initialize form from existing submission or blank
  useEffect(() => {
    if (existingSubmission?.formData) {
      setFormData(existingSubmission.formData)
    }
    setIsLoading(false)
  }, [existingSubmission])

  // Recalculate readiness whenever form changes
  useEffect(() => {
    setReadiness(assessG3Readiness(formData))
  }, [formData])

  const isApproved = existingSubmission?.status === 'approved'
  const isSubmitted = existingSubmission?.status === 'submitted'
  const isEditable = !isApproved && !isSubmitted

  const handleSubmit = async () => {
    if (!isEditable || !readiness.ready) return

    setIsSubmitting(true)
    try {
      const result = await submitG3FormAction(projectId, formData)
      if ('error' in result && result.error) {
        alert(`Error: ${result.error}`)
      } else {
        alert('G3 submitted for approval!')
      }
    } catch (err) {
      alert('Failed to submit G3')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <div className="p-4">Loading...</div>

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <Briefcase className="w-5 h-5 text-slate-600" />
          <CardTitle>G3: Commercial & Financial Close</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span>Project: {projectName}</span>
            <span className="text-slate-600">Completion: {readiness.completionPercentage}%</span>
          </div>
          {isApproved && <p className="text-sm text-green-600 mt-2">✓ Approved</p>}
          {isSubmitted && <p className="text-sm text-blue-600 mt-2">⏳ Pending Approval</p>}
        </CardContent>
      </Card>

      {/* Commercial Milestones */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <DollarSign className="w-5 h-5 text-slate-600" />
          <CardTitle>Commercial Milestones (5 required, need 4)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {formData.commercialMilestones.map((milestone) => (
            <div key={milestone.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50">
              <input
                type="checkbox"
                checked={milestone.completed}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    commercialMilestones: formData.commercialMilestones.map((m) =>
                      m.id === milestone.id ? { ...m, completed: e.target.checked } : m,
                    ),
                  })
                }}
                disabled={!isEditable}
                className="cursor-pointer"
              />
              {milestone.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300" />
              )}
              <div className="flex-1">
                <div className="font-medium text-sm">{milestone.name}</div>
                <div className="text-xs text-slate-500">{milestone.description}</div>
              </div>
            </div>
          ))}
          <div className="text-xs text-slate-600 pt-2">
            {formData.commercialMilestones.filter((m) => m.completed).length}/
            {REQUIRED_COMMERCIAL_MILESTONES.length} completed
          </div>
        </CardContent>
      </Card>

      {/* Financial Checkpoints */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <DollarSign className="w-5 h-5 text-slate-600" />
          <CardTitle>Financial Checkpoints (5 required, need 4)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {formData.financialCheckpoints.map((checkpoint) => (
            <div key={checkpoint.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50">
              <input
                type="checkbox"
                checked={checkpoint.completed}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    financialCheckpoints: formData.financialCheckpoints.map((c) =>
                      c.id === checkpoint.id ? { ...c, completed: e.target.checked } : c,
                    ),
                  })
                }}
                disabled={!isEditable}
                className="cursor-pointer"
              />
              {checkpoint.completed ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300" />
              )}
              <div className="flex-1">
                <div className="font-medium text-sm">{checkpoint.name}</div>
                <div className="text-xs text-slate-500">{checkpoint.description}</div>
              </div>
            </div>
          ))}
          <div className="text-xs text-slate-600 pt-2">
            {formData.financialCheckpoints.filter((c) => c.completed).length}/
            {REQUIRED_FINANCIAL_CHECKPOINTS.length} completed
          </div>
        </CardContent>
      </Card>

      {/* Deliverables */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <FileText className="w-5 h-5 text-slate-600" />
          <CardTitle>Required Deliverables (all 6 required)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {formData.deliverables.map((deliverable) => (
            <div key={deliverable.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50">
              <input
                type="checkbox"
                checked={deliverable.uploaded}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    deliverables: formData.deliverables.map((d) =>
                      d.id === deliverable.id
                        ? {
                            ...d,
                            uploaded: e.target.checked,
                            uploadedAt: e.target.checked ? new Date().toISOString() : null,
                          }
                        : d,
                    ),
                  })
                }}
                disabled={!isEditable}
                className="cursor-pointer"
              />
              {deliverable.uploaded ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Circle className="w-5 h-5 text-slate-300" />
              )}
              <div className="flex-1">
                <div className="font-medium text-sm">{deliverable.name}</div>
                <div className="text-xs text-slate-500">{deliverable.description}</div>
                {!deliverable.uploaded && <div className="text-xs text-orange-600">Not uploaded</div>}
              </div>
            </div>
          ))}
          <div className="text-xs text-slate-600 pt-2">
            {formData.deliverables.filter((d) => d.uploaded).length}/{REQUIRED_DELIVERABLES.length} uploaded
          </div>
        </CardContent>
      </Card>

      {/* Staffing */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <Users className="w-5 h-5 text-slate-600" />
          <CardTitle>Staffing (all 4 roles required)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {formData.staffingRoles.map((role) => (
            <div key={role.roleId} className="p-2 rounded hover:bg-slate-50">
              <div className="font-medium text-sm flex items-center gap-2">
                {role.assignedTo ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-slate-300" />}
                {role.roleName}
              </div>
              <div className="text-xs text-slate-500">{role.description}</div>
              {isEditable ? (
                <Input
                  placeholder="Enter assigned person's name"
                  value={role.assignedTo?.name || ''}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      staffingRoles: formData.staffingRoles.map((r) =>
                        r.roleId === role.roleId
                          ? {
                              ...r,
                              assignedTo: e.target.value.trim()
                                ? { id: `${role.roleId}-${Date.now()}`, name: e.target.value }
                                : null,
                            }
                          : r,
                      ),
                    })
                  }}
                  className="mt-1 h-8 text-xs"
                />
              ) : (
                <div className="text-xs text-slate-600 mt-1">
                  {role.assignedTo?.name || 'Not assigned'}
                </div>
              )}
            </div>
          ))}
          <div className="text-xs text-slate-600 pt-2">
            {formData.staffingRoles.filter((r) => r.assignedTo).length}/{REQUIRED_STAFFING_ROLES.length} assigned
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Executive Summary (required)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Provide an executive summary of the commercial and financial close status..."
            value={formData.executiveSummary || ''}
            onChange={(e) => setFormData({ ...formData, executiveSummary: e.target.value })}
            disabled={!isEditable}
            className="min-h-24"
          />
          <div className="text-xs text-slate-600 mt-2">
            {formData.executiveSummary?.trim() ? '✓ Summary provided' : 'Summary required'}
          </div>
        </CardContent>
      </Card>

      {/* Blockers */}
      {readiness.blockers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3 flex-row items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-sm">Items Requiring Action</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-amber-900">
              {readiness.blockers.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span>•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!isApproved && isEditable && (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !readiness.ready}
            className="flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit G3 for Approval'}
          </Button>
        )}
        {isApproved && (
          <div className="text-sm text-green-600 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            G3 Approved - Project Advanced to G4
          </div>
        )}
      </div>
    </div>
  )
}
