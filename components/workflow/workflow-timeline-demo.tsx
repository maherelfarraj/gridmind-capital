'use client'

import * as React from 'react'
import { WorkflowTimeline, type WorkflowLogEntry } from './workflow-timeline'

const ACTORS = {
  sara:  { id: 'u1', name: 'Sara Al-Hassan',  role: 'Project Director',    avatarInitials: 'SH' },
  james: { id: 'u2', name: 'James Okonkwo',   role: 'Senior Engineer',     avatarInitials: 'JO' },
  priya: { id: 'u3', name: 'Priya Nair',      role: 'Procurement Manager', avatarInitials: 'PN' },
  luca:  { id: 'u4', name: 'Luca Ferreira',   role: 'HSE Officer',         avatarInitials: 'LF' },
  admin: { id: 'u5', name: 'System Admin',    role: 'Platform',            avatarInitials: 'SA' },
}

const now = Date.now()
const t = (minsAgo: number) => new Date(now - minsAgo * 60_000)

export const DEMO_LOGS: WorkflowLogEntry[] = [
  {
    id: 'wl-01',
    action: 'project.create',
    objectType: 'project',
    objectLabel: 'SRF-2024-001 · Sirius 400MW Solar Farm',
    actor: ACTORS.admin,
    timestamp: t(14400),
    stateAfter: 'Draft',
    detail: 'Project registered in GREOS. Opportunity ID: OPP-2024-089.',
  },
  {
    id: 'wl-02',
    action: 'workflow.submit',
    objectType: 'gate',
    objectLabel: 'G0 — Opportunity Accepted',
    actor: ACTORS.sara,
    timestamp: t(8640),
    stateBefore: 'Draft',
    stateAfter: 'Submitted',
    detail: 'Stage-gate package compiled and submitted for board review.',
  },
  {
    id: 'wl-03',
    action: 'workflow.approve',
    objectType: 'gate',
    objectLabel: 'G0 — Opportunity Accepted',
    actor: ACTORS.sara,
    timestamp: t(7200),
    stateBefore: 'Submitted',
    stateAfter: 'Approved',
    reason: 'Opportunity meets investment criteria. IRR 14.2%, strong grid connection secured.',
  },
  {
    id: 'wl-04',
    action: 'workflow.submit',
    objectType: 'document',
    objectLabel: 'Project Execution Plan v1.0',
    actor: ACTORS.james,
    timestamp: t(5760),
    stateBefore: 'Draft',
    stateAfter: 'Submitted',
    detail: 'PEP submitted for IFC review. 142 pages, 8 appendices.',
  },
  {
    id: 'wl-05',
    action: 'approval.approve',
    objectType: 'document',
    objectLabel: 'Project Execution Plan v1.0',
    actor: ACTORS.sara,
    timestamp: t(4320),
    stateBefore: 'Submitted',
    stateAfter: 'Approved',
    reason: 'PEP approved with minor comments on Section 6 (Commissioning Schedule).',
  },
  {
    id: 'wl-06',
    action: 'workflow.submit',
    objectType: 'budget',
    objectLabel: 'CAPEX Budget Rev B — $480M',
    actor: ACTORS.priya,
    timestamp: t(2880),
    stateBefore: 'Draft',
    stateAfter: 'Under Review',
    detail: 'Revised budget following subcontractor tender returns. Net +$12M vs Rev A.',
  },
  {
    id: 'wl-07',
    action: 'workflow.escalate',
    objectType: 'budget',
    objectLabel: 'CAPEX Budget Rev B — $480M',
    actor: ACTORS.sara,
    timestamp: t(2160),
    stateBefore: 'Under Review',
    stateAfter: 'Escalated',
    reason: 'Budget variance exceeds 5% threshold. Escalated to Executive Committee for sign-off.',
  },
  {
    id: 'wl-08',
    action: 'comment.create',
    objectType: 'risk',
    objectLabel: 'RSK-047 · Grid Curtailment Risk',
    actor: ACTORS.james,
    timestamp: t(1440),
    detail: 'Updated probability from Medium to High following DNO capacity assessment.',
  },
  {
    id: 'wl-09',
    action: 'workflow.submit',
    objectType: 'hse-event',
    objectLabel: 'HSE-2024-034 · Near Miss — Excavation',
    actor: ACTORS.luca,
    timestamp: t(720),
    stateBefore: 'Draft',
    stateAfter: 'Submitted',
    detail: 'Near-miss incident at grid connection trench, Zone C. No injuries. RIDDOR reportable.',
  },
  {
    id: 'wl-10',
    action: 'approval.reject',
    objectType: 'change-order',
    objectLabel: 'CO-2024-018 · Inverter Brand Substitution',
    actor: ACTORS.sara,
    timestamp: t(360),
    stateBefore: 'Submitted',
    stateAfter: 'Rejected',
    reason: 'Proposed substitute inverter lacks DNVGL type approval. Resubmit with certification package.',
  },
  {
    id: 'wl-11',
    action: 'workflow.approve',
    objectType: 'contract',
    objectLabel: 'CTR-2024-006 · EPC Main Contract — ACME Renewables',
    actor: ACTORS.priya,
    timestamp: t(90),
    stateBefore: 'Under Review',
    stateAfter: 'Approved',
    reason: 'Contract executed. Final lump sum £285.4M. Performance bond received.',
  },
  {
    id: 'wl-12',
    action: 'comment.create',
    objectType: 'approval',
    objectLabel: 'APR-2024-052 · G1 Baseline Approval',
    actor: ACTORS.james,
    timestamp: t(15),
    detail: 'Checklist items 12–15 now confirmed closed. G1 package is ready for final sign-off.',
  },
]

export function WorkflowTimelineDemoSection() {
  const [showActor, setShowActor]   = React.useState(true)
  const [loading,   setLoading]     = React.useState(false)
  const [logs,      setLogs]        = React.useState<WorkflowLogEntry[]>(DEMO_LOGS)

  function simulateLoad() {
    setLoading(true)
    setLogs([])
    setTimeout(() => {
      setLogs(DEMO_LOGS)
      setLoading(false)
    }, 1400)
  }

  return (
    <section aria-labelledby="wt-heading" className="space-y-4">
      {/* ── Header row ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="wt-heading" className="text-base font-semibold text-foreground">
            Workflow Timeline
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            SRF-2024-001 · Sirius 400MW Solar Farm · Audit trail
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showActor}
              onChange={e => setShowActor(e.target.checked)}
              className="h-3.5 w-3.5 accent-primary rounded"
              aria-label="Show actor details"
            />
            Show actors
          </label>
          <button
            type="button"
            onClick={simulateLoad}
            className="text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Timeline ── */}
      <WorkflowTimeline
        logs={logs}
        showActor={showActor}
        loading={loading}
        initialVisible={8}
      />
    </section>
  )
}
