'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, Circle, AlertCircle, Briefcase, DollarSign, Users, FileText, ChevronDown } from 'lucide-react'
import {
  G3FormData,
  REQUIRED_COMMERCIAL_MILESTONES,
  REQUIRED_FINANCIAL_CHECKPOINTS,
  REQUIRED_DELIVERABLES,
  REQUIRED_STAFFING_ROLES,
  initializeG3Form,
  assessG3Readiness,
  isCategoryAllowedForDeliverable,
  isRoleCodeAllowedForStaffing,
  DELIVERABLE_CATEGORY_MAP,
  STAFFING_ROLE_CODE_MAP,
} from '@/lib/gates/g3-requirements'
import { submitG3FormAction, loadG3EligibleDocuments, loadG3ProjectTeamMembers } from '@/app/actions/g3-submissions'

interface G3CommercialFormProps {
  projectId: string
  projectName: string
  existingSubmission?: {
    formData?: G3FormData
    submissionStatus?: string | null
    gateStatus?: string | null
  } | null
}

export function G3CommercialForm({ projectId, projectName, existingSubmission }: G3CommercialFormProps) {
  const [formData, setFormData] = useState<G3FormData>(initializeG3Form())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [readiness, setReadiness] = useState(assessG3Readiness(null))
  const [documents, setDocuments] = useState<Array<{ id: string; title: string; category: string | null; uploader: string; uploadedAt: string }>>([])
  const [teamMembers, setTeamMembers] = useState<Array<{ profileId: string; name: string; role: string; roleCode: string }>>([])
  const [expandedDeliverableId, setExpandedDeliverableId] = useState<string | null>(null)
  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null)

  // Load eligible documents and team members on mount
  useEffect(() => {
    const loadData = async () => {
      const [docsResult, teamResult] = await Promise.all([
        loadG3EligibleDocuments(projectId),
        loadG3ProjectTeamMembers(projectId),
      ])
      
      if (docsResult.documents) setDocuments(docsResult.documents)
      if (teamResult.members) setTeamMembers(teamResult.members)
      
      if (existingSubmission?.formData) {
        setFormData(existingSubmission.formData)
      }
      setIsLoading(false)
    }
    
    loadData()
  }, [projectId, existingSubmission])

  // Recalculate readiness whenever form changes
  useEffect(() => {
    setReadiness(assessG3Readiness(formData))
  }, [formData])

  const gateStatus = existingSubmission?.gateStatus
  const submissionStatus = existingSubmission?.submissionStatus
  const isApproved = submissionStatus === 'approved'
  const isPending = submissionStatus === 'submitted'
  const isGateLocked = gateStatus !== 'in_review'
  const isEditable = !isGateLocked && !isApproved && !isPending

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
          {isPending && <p className="text-sm text-blue-600 mt-2">⏳ Pending Approval</p>}
        </CardContent>
      </Card>

      {/* Commercial Milestones */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <DollarSign className="w-5 h-5 text-slate-600" />
          <CardTitle>Commercial Milestones — all 5 required</CardTitle>
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
          <CardTitle>Financial Checkpoints — all 5 required</CardTitle>
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
        <CardContent className="space-y-3">
          {formData.deliverables.map((deliverable) => {
            const selectedDoc = documents.find((d) => d.id === deliverable.documentId)
            return (
              <div key={deliverable.id} className="border rounded p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {deliverable.documentId ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300" />
                      )}
                      {deliverable.name}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{deliverable.description}</div>
                    {selectedDoc ? (
                      <div className="text-xs text-green-600 mt-2">
                        ✓ {selectedDoc.title} (by {selectedDoc.uploader}, {selectedDoc.uploadedAt})
                      </div>
                    ) : (
                      <div className="text-xs text-orange-600 mt-2">No document selected</div>
                    )}
                  </div>
                </div>
                {isEditable && (
                  <button
                    onClick={() =>
                      setExpandedDeliverableId(
                        expandedDeliverableId === deliverable.id ? null : deliverable.id,
                      )
                    }
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {selectedDoc ? 'Change' : 'Select'} Document
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        expandedDeliverableId === deliverable.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}
                {expandedDeliverableId === deliverable.id && isEditable && (() => {
                  // Only documents whose category is allowed for THIS deliverable are selectable.
                  const eligibleDocs = documents.filter((doc) =>
                    isCategoryAllowedForDeliverable(deliverable.id, doc.category),
                  )
                  const allowed = DELIVERABLE_CATEGORY_MAP[deliverable.id]?.join(', ') ?? 'n/a'
                  return (
                    <div className="mt-3 space-y-1 border-t pt-2">
                      {eligibleDocs.length > 0 ? (
                        eligibleDocs.map((doc) => (
                          <button
                            key={doc.id}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                deliverables: formData.deliverables.map((d) =>
                                  d.id === deliverable.id ? { ...d, documentId: doc.id } : d,
                                ),
                              })
                              setExpandedDeliverableId(null)
                            }}
                            className="w-full text-left text-xs p-2 rounded hover:bg-blue-50 border"
                          >
                            {doc.title} ({doc.category ?? 'uncategorized'} · {doc.uploader}, {doc.uploadedAt})
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 p-2">
                          No eligible documents. This deliverable requires a document categorized as:{' '}
                          <span className="font-mono">{allowed}</span>.
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
          <div className="text-xs text-slate-600 pt-2">
            {formData.deliverables.filter((d) => d.documentId).length}/{REQUIRED_DELIVERABLES.length} with documents
          </div>
        </CardContent>
      </Card>

      {/* Staffing */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center gap-3">
          <Users className="w-5 h-5 text-slate-600" />
          <CardTitle>Staffing (all 4 roles required)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {formData.staffingRoles.map((role) => {
            const selectedMember = teamMembers.find((m) => m.profileId === role.assignedProfileId)
            return (
              <div key={role.roleId} className="border rounded p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {role.assignedProfileId ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300" />
                      )}
                      {role.roleName}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{role.description}</div>
                    {selectedMember ? (
                      <div className="text-xs text-green-600 mt-2">
                        ✓ {selectedMember.name} ({selectedMember.role})
                      </div>
                    ) : (
                      <div className="text-xs text-orange-600 mt-2">Not assigned</div>
                    )}
                  </div>
                </div>
                {isEditable && (
                  <button
                    onClick={() =>
                      setExpandedRoleId(expandedRoleId === role.roleId ? null : role.roleId)
                    }
                    className="mt-2 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {selectedMember ? 'Change' : 'Assign'} Team Member
                    <ChevronDown
                      className={`w-3 h-3 transition-transform ${
                        expandedRoleId === role.roleId ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                )}
                {expandedRoleId === role.roleId && isEditable && (() => {
                  // Only members assigned through an allowed roles.code for THIS seat are selectable.
                  const eligibleMembers = teamMembers.filter((member) =>
                    isRoleCodeAllowedForStaffing(role.roleId, member.roleCode),
                  )
                  const allowed = STAFFING_ROLE_CODE_MAP[role.roleId]?.join(', ') ?? 'n/a'
                  return (
                    <div className="mt-3 space-y-1 border-t pt-2">
                      {eligibleMembers.length > 0 ? (
                        eligibleMembers.map((member) => (
                          <button
                            key={member.profileId}
                            onClick={() => {
                              setFormData({
                                ...formData,
                                staffingRoles: formData.staffingRoles.map((r) =>
                                  r.roleId === role.roleId ? { ...r, assignedProfileId: member.profileId } : r,
                                ),
                              })
                              setExpandedRoleId(null)
                            }}
                            className="w-full text-left text-xs p-2 rounded hover:bg-blue-50 border"
                          >
                            {member.name} ({member.role} · {member.roleCode})
                          </button>
                        ))
                      ) : (
                        <div className="text-xs text-slate-500 p-2">
                          No eligible members. This seat requires a team member assigned through role code:{' '}
                          <span className="font-mono">{allowed}</span>.
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
          <div className="text-xs text-slate-600 pt-2">
            {formData.staffingRoles.filter((r) => r.assignedProfileId).length}/{REQUIRED_STAFFING_ROLES.length} assigned
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

      {/* Locked explanation: make the prerequisite chain explicit */}
      {isGateLocked && !isApproved && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-3 flex-row items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <CardTitle className="text-sm">G3 is locked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-900">
            <p>
              This gate opens only after the earlier gates are approved. G3 (Commercial &amp; Financial
              Close) requires <strong>G1 (Origination &amp; Feasibility)</strong> and{' '}
              <strong>G2 (Permitting &amp; Grid Application)</strong> to be completed and approved first.
            </p>
            <p className="text-xs text-amber-800">
              Current G3 status: <span className="font-mono">{gateStatus ?? 'not started'}</span>. The form
              becomes editable once G3 reaches <span className="font-mono">in_review</span>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {isGateLocked && !isApproved && (
          <div className="text-sm text-amber-600 flex-1 text-center py-2">
            🔒 Gate locked - not open for submission
          </div>
        )}
        {isEditable && (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !readiness.ready}
            className="flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit G3 for Approval'}
          </Button>
        )}
        {isPending && (
          <div className="text-sm text-blue-600 flex-1 text-center py-2">
            ⏳ Submission pending review by required approvers
          </div>
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
