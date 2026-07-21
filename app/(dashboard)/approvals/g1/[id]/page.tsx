'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ArrowLeft } from 'lucide-react'
import { G1ApprovalWorkflow } from '@/components/approvals/g1-approval-workflow'
import type {
  Approver, Deliverable, AuditLog,
} from '@/components/approvals/g1-approval-workflow'
import type { DecisionType } from '@/components/approvals/g1-approval-workflow'
import { getApprovalById, decideApproval } from '@/app/actions/approvals'
import type { UserProfile } from '@/components/approvals/g0-approval-review'

// ── Illustrative defaults ─────────────────────────────────────

const DEMO_APPROVERS: Approver[] = [
  {
    id: 'apr-1', level: 1, role: 'Project Manager',
    status: 'approved', decision: 'proceed', rationale: 'All feasibility outputs reviewed and satisfactory.',
    decided_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    due_date: new Date(Date.now() + 86400000 * 5).toISOString(),
    is_current: false, is_chairperson: false,
    user: { id: 'pm-1', name: 'M. Al-Farsi', email: 'mfarsi@gridmind.capital', role: 'Project Manager', department: 'Projects', initials: 'MA', avatarColor: '#64ffda' },
  },
  {
    id: 'apr-2', level: 2, role: 'Commercial Director',
    status: 'under_review', decision: null, rationale: null, decided_at: null,
    due_date: new Date(Date.now() + 86400000 * 2).toISOString(),
    is_current: true, is_chairperson: false,
    user: { id: 'cd-1', name: 'A. Carter', email: 'acarter@gridmind.capital', role: 'Commercial Director', department: 'Commercial', initials: 'AC', avatarColor: '#3b82f6' },
  },
  {
    id: 'apr-3', level: 3, role: 'Executive Sponsor',
    status: 'pending', decision: null, rationale: null, decided_at: null,
    due_date: new Date(Date.now() + 86400000 * 7).toISOString(),
    is_current: false, is_chairperson: true,
    user: { id: 'es-1', name: 'Dr. J. Rivera', email: 'jrivera@gridmind.capital', role: 'Executive Sponsor', department: 'Executive', initials: 'JR', avatarColor: '#f59e0b' },
  },
]

const DEMO_DELIVERABLES: Deliverable[] = [
  { id: 'd1', name: 'Feasibility Study Report', description: 'Full feasibility report including resource assessment, yield analysis, and LCOE.', required: true,  status: 'approved', file_name: 'Feasibility_Study_v2.pdf',           uploaded_at: new Date(Date.now() - 86400000 * 5).toISOString(), reviewed_by: 'M. Al-Farsi' },
  { id: 'd2', name: 'Financial Model (Base Case)', description: 'Project finance model with IRR, NPV, DSCR, and debt sizing. Version must be ≥1.0.', required: true,  status: 'approved', file_name: 'FinModel_BaseCase_v1.2.xlsx',        uploaded_at: new Date(Date.now() - 86400000 * 4).toISOString(), reviewed_by: 'A. Carter' },
  { id: 'd3', name: 'Grid Connection Study',      description: 'Indicative grid study confirming connection point, voltage, and capacity available.', required: true,  status: 'uploaded', file_name: 'Grid_Connection_Study_Draft.pdf', uploaded_at: new Date(Date.now() - 86400000 * 1).toISOString(), reviewed_by: null },
  { id: 'd4', name: 'Environmental Scoping Report', description: 'Initial EIA scoping opinion or environmental baseline study.', required: true,  status: 'pending',  file_name: null, uploaded_at: null, reviewed_by: null },
  { id: 'd5', name: 'Land Title / Option Agreement', description: 'Executed land option agreement or evidence of land title.', required: true,  status: 'approved', file_name: 'Land_Option_Executed.pdf',              uploaded_at: new Date(Date.now() - 86400000 * 3).toISOString(), reviewed_by: 'M. Al-Farsi' },
  { id: 'd6', name: 'Permitting Programme',         description: 'Regulatory and permitting roadmap with key milestones.', required: false, status: 'uploaded', file_name: 'Permitting_Programme_v1.pptx',           uploaded_at: new Date(Date.now() - 86400000 * 2).toISOString(), reviewed_by: null },
  { id: 'd7', name: 'Offtake / PPA Term Sheet',     description: 'Indicative term sheet from prospective offtaker or PPA framework.', required: false, status: 'pending',  file_name: null, uploaded_at: null, reviewed_by: null },
]

const DEMO_AUDIT: AuditLog[] = [
  { id: 'a1', actor: 'System',     action: 'G1 Review Opened',     detail: 'Gate 1 approval workflow initiated.',               created_at: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: 'a2', actor: 'M. Al-Farsi', action: 'Deliverable Uploaded', detail: 'Feasibility Study Report uploaded.',               created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'a3', actor: 'A. Carter',   action: 'Deliverable Uploaded', detail: 'Financial Model (Base Case) uploaded.',            created_at: new Date(Date.now() - 86400000 * 4).toISOString() },
  { id: 'a4', actor: 'M. Al-Farsi', action: 'L1 Decision: Proceed', detail: 'All feasibility outputs reviewed and satisfactory.', created_at: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'a5', actor: 'System',      action: 'Reminder Sent',        detail: 'Reminder sent to A. Carter (Level 2).',            created_at: new Date(Date.now() - 86400000 * 1).toISOString() },
]

const CURRENT_USER: UserProfile = {
  id: 'cd-1', name: 'A. Carter', email: 'acarter@gridmind.capital',
  role: 'Commercial Director', department: 'Commercial', initials: 'AC', avatarColor: '#3b82f6',
}

// ─────────────────────────────────────────────────────────────

export default function G1ApprovalPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params?.id ?? ''

  const { data: approval, isLoading } = useSWR(
    id ? `g1-approval-${id}` : null,
    () => getApprovalById(id),
    { revalidateOnFocus: false },
  )

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="size-8 rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-sky-500 animate-spin" />
      </div>
    )
  }

  // ── Build project from approval metadata or fallback ────
  const project = {
    id: id,
    name:        approval?.title ?? 'Development Approval',
    code:        approval?.object_type ? `G1-${approval.object_type.toUpperCase()}` : `G1-${id.slice(0, 8).toUpperCase()}`,
    technology:  'Solar PV',
    capacity_mw: 400,
    location:    'KSA / NEOM Region',
    capex_usd:   approval?.amount ?? 380_000_000,
    target_irr:  12.4,
  }

  // ── Handlers ─────────────────────────────────────────────

  async function handleDecide(decision: DecisionType, rationale: string, conditions?: string[]) {
    await decideApproval({
      id,
      decision,
      rationale: conditions?.length
        ? `${rationale}\n\nConditions:\n${conditions.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
        : rationale,
    })
  }

  async function handleEscalate(approverId: string) {
    console.log('[v0] Escalating approver:', approverId)
  }

  async function handleRemind(approverId: string) {
    console.log('[v0] Sending reminder to approver:', approverId)
  }

  async function handleGeneratePackage() {
    console.log('[v0] Generating G1 approval package for:', id)
  }

  async function handleUploadDeliverable(deliverableId: string, file: File) {
    console.log('[v0] Uploading deliverable:', deliverableId, file.name)
  }

  return (
    <div className="space-y-4">
      {/* Back */}
      <button
        type="button"
        onClick={() => router.push('/approvals')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Approvals
      </button>

      <G1ApprovalWorkflow
        project={project}
        deliverables={DEMO_DELIVERABLES}
        approvers={DEMO_APPROVERS}
        auditTrail={DEMO_AUDIT}
        currentApprover={CURRENT_USER}
        isChairperson={false}
        onSubmitDecision={handleDecide}
        onEscalate={handleEscalate}
        onRemind={handleRemind}
        onGeneratePackage={handleGeneratePackage}
        onUploadDeliverable={handleUploadDeliverable}
      />
    </div>
  )
}
