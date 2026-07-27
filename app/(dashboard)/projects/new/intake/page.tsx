'use client'

/**
 * /projects/new/intake
 * Standalone G0 Opportunity Assessment entry-point.
 *
 * Flow:
 *  1. User completes the 5-step G0IntakeForm.
 *  2. onSubmitted callback fires:
 *     a. createProject   — inserts row into `projects` (phase = 0, gate = 'G0')
 *     b. submitG0FormAction — upserts full form payload into `gate_submissions`
 *     c. createApproval  — creates a pending approval + notifies Executive Sponsor
 *  3. Success overlay with links to new project and approvals inbox.
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle, ArrowRight, Inbox, ExternalLink, AlertTriangle,
} from 'lucide-react'
import { G0IntakeForm } from '@/components/stage-gate/g0-intake-form'
import { createProject } from '@/app/actions/projects'
import { submitG0FormAction, type G0FormData } from '@/app/actions/gate-submissions'

// ─── Metadata (consumed by the parent RSC layout) ─────────────
export const dynamic = 'force-dynamic'

// ─── Success overlay ──────────────────────────────────────────

function SuccessScreen({
  projectId,
  projectCode,
  approvalId,
}: {
  projectId: string
  projectCode: string
  approvalId: string | null
}) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center px-4">
      {/* Icon */}
      <div className="size-20 rounded-full bg-[hsl(var(--accent)/0.12)] flex items-center justify-center ring-1 ring-[hsl(var(--accent)/0.25)]">
        <CheckCircle className="size-10 text-[hsl(var(--accent))]" aria-hidden />
      </div>

      {/* Heading */}
      <div className="space-y-1.5 max-w-sm">
        <h1 className="text-2xl font-bold text-foreground">Opportunity Submitted</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Project{' '}
          <span className="font-mono text-[hsl(var(--accent))] font-semibold">
            {projectCode}
          </span>{' '}
          has been created and the G0 intake package has been sent for Executive Sponsor review.
        </p>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 font-medium">
          <CheckCircle className="size-3" /> Project created
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 font-medium">
          <CheckCircle className="size-3" /> G0 package saved
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 font-medium">
          <Inbox className="size-3" /> Approval pending (48h SLA)
        </span>
      </div>

      {/* CTA buttons — project is still pending approval, so primary action is View Approvals */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        <Link
          href="/approvals"
          className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] hover:opacity-90 transition-opacity px-5 py-2.5 text-sm font-semibold shadow-sm"
        >
          <Inbox className="size-4" /> View G0 Approval <ArrowRight className="size-4" aria-hidden />
        </Link>

        <Link
          href="/projects"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors px-5 py-2.5 text-sm font-semibold text-foreground"
        >
          <ExternalLink className="size-4" /> All Projects
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

export default function G0IntakePage() {
  const router = useRouter()

  const [state, setState] = React.useState<
    | { phase: 'form' }
    | { phase: 'submitting' }
    | { phase: 'success'; projectId: string; projectCode: string; approvalId: string | null }
    | { phase: 'error'; message: string }
  >({ phase: 'form' })

  async function handleFormSubmitted(data: G0FormData) {
    setState({ phase: 'submitting' })

    // ── Step a: create the project row ──────────────────────────
    const projectCode = data.opportunityCode.replace(/^OPP-/, '')
    const projectResult = await createProject({
      name:              data.opportunityName,
      code:              projectCode,
      technology:        data.technologyType || data.technology || 'Solar PV',
      capacity_mw:       parseFloat(data.estimatedCapacityMw || data.capacityMwp || '0') || 0,
      location:          data.siteLocation || '',
      country:           (data.siteLocation || '').split(',').at(-1)?.trim() ?? '',
      budget_usd:        parseFloat(data.budgetMax || data.capexEstimateUsd || '0') || 0,
      start_date:        '',
      target_completion: '',
      description:       data.description || undefined,
    })

    if ('error' in projectResult) {
      setState({ phase: 'error', message: projectResult.error })
      return
    }

    const projectId = projectResult.id

    // ── Step b: save G0 gate submission ─────────────────────────
    const { error: g0Error } = await submitG0FormAction(data, projectId)
    if (g0Error) {
      setState({ phase: 'error', message: g0Error })
      return
    }

    // Approval was created by createProject (same transaction).
    setState({ phase: 'success', projectId, projectCode, approvalId: projectId })
    router.refresh()
  }

  // ── Error state ─────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4 flex flex-col items-center gap-4 text-center">
        <div className="size-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="size-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Submission Failed</h2>
        <p className="text-sm text-muted-foreground max-w-sm">{state.message}</p>
        <button
          type="button"
          onClick={() => setState({ phase: 'form' })}
          className="mt-2 rounded-lg border border-border bg-card hover:bg-muted/60 transition-colors px-5 py-2.5 text-sm font-semibold text-foreground"
        >
          Try Again
        </button>
      </div>
    )
  }

  // ── Success state ────────────────────────────────────────────
  if (state.phase === 'success') {
    return (
      <SuccessScreen
        projectId={state.projectId}
        projectCode={state.projectCode}
        approvalId={state.approvalId}
      />
    )
  }

  // ── Form state (includes 'submitting' — G0IntakeForm handles its own loading) ──
  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Project Intake
        </p>
        <h1 className="text-2xl font-bold text-foreground">New Opportunity Assessment</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Complete all five sections below. On submission, a project record will be created and
          sent to the Executive Sponsor for G0 approval (48-hour SLA).
        </p>
      </div>

      {/* The form — passes onSubmitted so this page owns the multi-action orchestration */}
      <G0IntakeForm
        projectId=""
        projectCode=""
        projectName=""
        onSubmitted={handleFormSubmitted}
        isSubmittingExternal={state.phase === 'submitting'}
      />
    </div>
  )
}
