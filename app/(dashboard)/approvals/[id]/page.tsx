'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { G0ApprovalReview } from '@/components/approvals/g0-approval-review'
import { decideApproval, delegateApproval, getApprovalById } from '@/app/actions/approvals'
import type { UserProfile } from '@/components/approvals/g0-approval-review'
import type { G0FormData } from '@/app/actions/gate-submissions'

// Default requester — in production, populate from session
const DEFAULT_REQUESTER: UserProfile = {
  id:          'pm@gridmind.capital',
  name:        'Project Manager',
  email:       'pm@gridmind.capital',
  role:        'Project Manager',
  department:  'Operations',
  initials:    'PM',
  avatarColor: '#a5f3fc',
}

export default function ApprovalDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id     = params?.id ?? ''

  const { data: approval, error, isLoading } = useSWR(
    id ? `approval-detail-${id}` : null,
    () => getApprovalById(id),
    { revalidateOnFocus: false },
  )

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <span className="size-8 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-sky-500 animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading approval...</p>
        </div>
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────
  if (error || !approval) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          Approval <span className="font-mono text-slate-700 dark:text-slate-300">{id}</span> was not found.
        </p>
        <button
          type="button"
          onClick={() => router.push('/approvals')}
          className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Back to Approvals
        </button>
      </div>
    )
  }

  // ── Parse embedded G0 form data from description ─────────
  // submitG0FormAction stores raw JSON in gate_submissions.form_data;
  // createApproval stores a text description. We surface what we can.
  const rawDesc = approval.description ?? ''
  let opportunity: Partial<G0FormData> = {}
  const jsonMatch = rawDesc.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try { opportunity = JSON.parse(jsonMatch[0]) } catch { /* ignore malformed */ }
  }

  // Fallback: synthesise minimal opportunity from approval metadata
  if (!opportunity.opportunityName) {
    opportunity = {
      opportunityName:    approval.title ?? 'Opportunity',
      opportunityCode:    `OPP-${(approval.object_type ?? 'G0').toUpperCase()}-2026`,
      source:             'Direct Client',
      priority:           approval.priority === 'critical' ? 'Critical'
                        : approval.priority === 'high'     ? 'High'
                        : 'Medium',
      technologyType:     'Solar PV',
      estimatedCapacityMw:'',
      siteLocation:       '',
      gridConnection:     '',
      landAvailability:   '',
      environmentalFlags: [],
      clientName:         '',
      clientType:         '',
      budgetMin:          '',
      budgetMax:          approval.amount != null ? String(approval.amount) : '',
      currency:           'USD',
      fundingStatus:      '',
      ppaStatus:          '',
      expectedIrr:        '',
      overallRisk:        'Medium',
      risks:              [],
      stakeholders:       [],
    }
  }

  const approvalRecord = {
    id:          approval.id,
    title:       approval.title ?? 'G0 Approval',
    status:      (approval.status ?? 'pending') as 'pending' | 'approved' | 'rejected' | 'delegated',
    priority:    approval.priority ?? 'normal',
    object_type: approval.object_type ?? 'G0',
    created_at:  approval.created_at ?? new Date().toISOString(),
    description: approval.description ?? null,
  }

  // ── Server action wiring ─────────────────────────────────

  async function handleDecide(
    decision: 'proceed' | 'conditional_proceed' | 'hold' | 'reject',
    rationale: string,
    conditions?: string,
  ) {
    const { error } = await decideApproval({ id, decision, rationale, conditions })
    if (error) throw new Error(error)
  }

  async function handleDelegate(delegateId: string, reason: string) {
    const { error } = await delegateApproval({ id, delegateId, reason })
    if (error) throw new Error(error)
  }

  async function handleRequestInfo(_message: string) {
    // Future: create a comment thread on this approval
  }

  return (
    <G0ApprovalReview
      approval={approvalRecord}
      opportunity={opportunity}
      requester={DEFAULT_REQUESTER}
      onDecide={handleDecide}
      onDelegate={handleDelegate}
      onRequestInfo={handleRequestInfo}
    />
  )
}
