'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { G0ApprovalReview } from '@/components/approvals/g0-approval-review'
import { G3ApprovalReview } from '@/components/approvals/g3-approval-review'
import {
  decideApproval,
  delegateApproval,
  getOpportunityApprovalDetail,
  getGateApprovalDetail,
  getEligibleDelegates,
} from '@/app/actions/approvals'
import { getSignaturesForEntity } from '@/app/actions/signatures'
import type { SignatureDraft } from '@/app/actions/signatures'
import type { UserProfile } from '@/components/approvals/g0-approval-review'

export default function ApprovalDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id     = params?.id ?? ''

  // A gate approval and an opportunity (G0) approval are disjoint object_types.
  // Each loader returns null for the wrong type (and short-circuits cheaply), so
  // fetching both and rendering whichever resolves keeps one route for both.
  const { data: gateDetail, isLoading: gateLoading } = useSWR(
    id ? `gate-approval-detail-${id}` : null,
    () => getGateApprovalDetail(id),
    { revalidateOnFocus: false },
  )

  const { data: detail, error, isLoading: oppLoading } = useSWR(
    id ? `approval-detail-${id}` : null,
    () => getOpportunityApprovalDetail(id),
    { revalidateOnFocus: false },
  )

  const isLoading = gateLoading || oppLoading

  const { data: signatures = [] } = useSWR(
    id ? `approval-signatures-${id}` : null,
    () => getSignaturesForEntity('gate_approval', id),
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

  // ── Gate (G3) approval ───────────────────────────────────
  if (gateDetail) {
    return (
      <G3ApprovalReview
        detail={gateDetail}
        existingSignatures={signatures}
        onDecide={async (decision, rationale, conditions, signatureDraft) => {
          const { error } = await decideApproval({ id, decision, rationale, conditions, signatureDraft })
          if (error) throw new Error(error)
        }}
        onDelegate={async (delegateId, reason) => {
          const { error } = await delegateApproval({ id, delegateId, reason })
          if (error) throw new Error(error)
        }}
        loadDelegates={() => getEligibleDelegates(id)}
      />
    )
  }

  // ── Not found ────────────────────────────────────────────
  if (error || !detail) {
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

  const { approval, opportunity, requester: requesterView, linkedProject } = detail

  // The requester is the REAL profile resolved server-side, or an explicit
  // "Requester unavailable" marker — never a fabricated "Project Manager".
  const requester: UserProfile = {
    id:          requesterView.id,
    name:        requesterView.name,
    email:       requesterView.email,
    role:        requesterView.role,
    department:  requesterView.department,
    initials:    requesterView.initials,
    avatarColor: '#a5f3fc',
  }

  const approvalRecord = {
    id:          approval.id,
    title:       approval.title,
    status:      approval.status,
    priority:    approval.priority,
    object_type: approval.object_type,
    created_at:  approval.created_at,
    description: approval.description,
  }

  // ── Server action wiring ─────────────────────────────────

  async function handleDecide(
    decision: 'proceed' | 'conditional_proceed' | 'hold' | 'reject',
    rationale: string,
    conditions?: Array<{ title: string; due_date: string }>,
    signatureDraft?: SignatureDraft,
  ) {
    // The draft is persisted inside decideApproval, after its guards pass, so an
    // abandoned or rejected decision never leaves a signature row behind.
    const { error } = await decideApproval({ id, decision, rationale, conditions, signatureDraft })
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
      requester={requester}
      linkedProject={linkedProject}
      onDecide={handleDecide}
      onDelegate={handleDelegate}
      onRequestInfo={handleRequestInfo}
      projectId={linkedProject.id}
      projectName={linkedProject.name ?? undefined}
      existingSignatures={signatures}
    />
  )
}
