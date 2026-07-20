'use client'

import * as React from 'react'
import {
  HelpCircle, BookOpen, Search, X, ChevronDown,
  Zap, LayoutDashboard, Briefcase, Wrench, ShoppingCart,
  HardHat, Activity, DollarSign, Settings, FileText,
  CheckCircle2, AlertTriangle, Users, GitBranch, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */
export type HelpModule =
  | 'general'
  | 'intake'
  | 'commercial'
  | 'engineering'
  | 'procurement'
  | 'construction'
  | 'commissioning'
  | 'om'
  | 'finance'
  | 'admin'

export type UserRole =
  | 'PROJECT_DIRECTOR'
  | 'PROJECT_MANAGER'
  | 'ENGINEER'
  | 'PROCUREMENT_OFFICER'
  | 'SITE_MANAGER'
  | 'FINANCE_ANALYST'
  | 'ADMIN'
  | 'VIEWER'

export interface HelpTopic {
  id: string
  title: string
  body: string
  module: HelpModule
  icon: React.ElementType
  roles?: UserRole[] // undefined = visible to all
  tags?: string[]
}

export interface HelpHubPanelProps {
  /** Currently active module context — shown as context badge */
  context?: string
  /** Restrict topic visibility by role. Undefined shows all. */
  userRole?: UserRole
  /** Which tab is pre-selected on open */
  defaultModule?: HelpModule | 'all'
}

/* ─────────────────────────────────────────────────────
   TOPIC DATA
───────────────────────────────────────────────────── */
const TOPICS: HelpTopic[] = [
  // GENERAL
  {
    id: 'gen-1',
    title: 'Getting started with GridMind Capital',
    module: 'general',
    icon: Zap,
    body: `GridMind Capital is a Renewable EPC Operating System built to manage the full project lifecycle from initial intake through to operations & maintenance.

Navigate using the sidebar on the left. The top bar shows your current page context, pending approvals, and notifications.

Quick tips:
• Use ⌘K (or Ctrl+K) to open global search.
• Click your avatar in the sidebar to view your profile and role permissions.
• The Stage-Gate stepper on each project page shows your current gate and required deliverables.`,
    tags: ['navigation', 'overview', 'quick start'],
  },
  {
    id: 'gen-2',
    title: 'Understanding stage-gate approvals',
    module: 'general',
    icon: GitBranch,
    body: `GridMind uses a G0–G9 stage-gate framework to govern project progression.

Each gate requires specific deliverables and approvals before a project can advance:
• G0 – Opportunity Accepted: Initial feasibility and sponsor sign-off.
• G1 – Project Baseline Approved: Scope, budget, and schedule locked.
• G2 – Engineering IFC Release: Issued-for-Construction drawings released.
• G3 – Procurement Award: All major contracts placed.
• G4 – Construction Mobilization: Site ready, contractor on site.
• G5 – Mechanical Completion: All equipment installed and tested.
• G6 – Commissioning Completion: System commissioned and ready.
• G7 – Handover & Warranty: Asset transferred to O&M.
• G8 – Operations Performance Review: First-year performance confirmed.
• G9 – AI/Enterprise Optimization: Continuous improvement active.

Segregation of duty rules apply — the creator of a workflow cannot be the sole approver.`,
    tags: ['gates', 'approvals', 'workflow'],
  },
  {
    id: 'gen-3',
    title: 'Role-based access control',
    module: 'general',
    icon: Shield,
    roles: ['PROJECT_DIRECTOR', 'ADMIN'],
    body: `Access to modules and actions is governed by your assigned role.

Available roles:
• PROJECT_DIRECTOR — Full access including gate approvals and budget overrides.
• PROJECT_MANAGER — Manage project data, raise change orders, view all modules.
• ENGINEER — Access engineering, BIM, and commissioning modules.
• PROCUREMENT_OFFICER — Manage tenders, purchase orders, and vendor registry.
• SITE_MANAGER — Construction, HSE, and inspection modules.
• FINANCE_ANALYST — Finance, budget, and commitment modules.
• ADMIN — Platform configuration, user management, and audit logs.
• VIEWER — Read-only access to permitted modules.

Contact your ADMIN to update your role assignment.`,
    tags: ['roles', 'permissions', 'access'],
  },
  {
    id: 'gen-4',
    title: 'Audit logs and governance trail',
    module: 'general',
    icon: FileText,
    roles: ['PROJECT_DIRECTOR', 'ADMIN', 'FINANCE_ANALYST'],
    body: `Every write operation in GridMind is recorded in the immutable audit log.

Each entry captures:
• Actor (who performed the action)
• Action type (create, approve, reject, escalate)
• Entity (what was changed)
• State before and after
• Timestamp and IP

Access audit logs via Admin → Audit Trail. Logs can be exported as CSV or PDF for compliance purposes.

Audit records cannot be deleted or modified — they form the permanent governance trail required for DOA (Delegation of Authority) and regulatory reporting.`,
    tags: ['audit', 'compliance', 'governance'],
  },

  // INTAKE
  {
    id: 'int-1',
    title: 'Creating a new project',
    module: 'intake',
    icon: Briefcase,
    body: `To create a new project, navigate to Projects → New Project or click the + button in the Projects sidebar section.

Required fields:
• Project name and code (auto-generated or manual)
• Client name and contract reference
• Technology type (Solar PV, Wind, BESS, Hybrid, Grid)
• Target capacity (MW)
• Location (country, region, GPS coordinates)
• Project Director assignment

The project enters G0 – Opportunity Accepted status upon creation. A workflow instance is automatically started and the assigned Project Director must approve within 5 business days.`,
    tags: ['create', 'new project', 'intake'],
  },
  {
    id: 'int-2',
    title: 'Opportunity assessment checklist',
    module: 'intake',
    icon: CheckCircle2,
    body: `Before advancing from G0 to G1, complete the opportunity assessment:

1. Land / site: Confirm land tenure or lease option agreement is in place.
2. Grid: Obtain preliminary grid connection study or reservation letter.
3. Permits: Identify all required permits and indicative timelines.
4. EPC feasibility: High-level budget and schedule from EPC contractor.
5. Financial model: Preliminary IRR/NPV at agreed tariff/PPA assumptions.
6. Risk register: Initial risk identification and top-3 mitigations.

Upload all supporting documents against the project record before submitting for G0 approval. Missing documents will cause the gate review to be held.`,
    tags: ['checklist', 'G0', 'assessment'],
  },

  // COMMERCIAL
  {
    id: 'com-1',
    title: 'Managing contracts and variations',
    module: 'commercial',
    icon: FileText,
    body: `Commercial contracts are managed under Commercial → Contracts Register.

Contract lifecycle:
1. Draft — prepared by commercial team.
2. Submitted — sent for internal legal review.
3. Under Review — legal and Project Director reviewing.
4. Approved — signed and executed.
5. Active — in performance period.
6. Closed — completed or terminated.

Variation Orders (VOs) must be raised against a specific contract. Each VO goes through the workflow: draft → submit → approve (DOA threshold applies). VOs above the Project Manager DOA threshold require Project Director sign-off.

EOT (Extension of Time) claims are linked to programme milestones — use the Construction → Schedule module to cross-reference.`,
    tags: ['contracts', 'variations', 'EOT', 'commercial'],
  },
  {
    id: 'com-2',
    title: 'Delegation of Authority (DOA) thresholds',
    module: 'commercial',
    icon: Shield,
    roles: ['PROJECT_DIRECTOR', 'PROJECT_MANAGER', 'ADMIN'],
    body: `All financial approvals are governed by the DOA matrix.

Approval thresholds (ZAR):
• < R500k — Project Manager can approve independently.
• R500k – R5M — Joint approval: Project Manager + Finance Analyst.
• R5M – R50M — Project Director required.
• > R50M — Board approval required (escalated automatically).

DOA rules are enforced at the workflow engine level — the system will block out-of-DOA approvals and escalate automatically.

To view the full DOA matrix, go to Admin → DOA Matrix.`,
    tags: ['DOA', 'approval', 'thresholds', 'finance'],
  },

  // ENGINEERING
  {
    id: 'eng-1',
    title: 'Drawing register and revision control',
    module: 'engineering',
    icon: Wrench,
    body: `Engineering drawings are managed under Engineering → Drawing Register.

Revision status codes:
• A — For Information (FI)
• B — For Review (FR)
• C — For Approval (FA)
• D — For Construction (IFC)
• E — As-Built (AB)

Only IFC (D-status) drawings are permitted for construction use. Using superseded revisions is a non-conformance.

To upload a new revision: open the drawing record, click Add Revision, select the file, set the status code, and submit. The workflow will route for review and approval based on the drawing discipline and status.`,
    tags: ['drawings', 'IFC', 'revision', 'engineering'],
  },
  {
    id: 'eng-2',
    title: 'RFI and submittal process',
    module: 'engineering',
    icon: AlertTriangle,
    body: `Requests for Information (RFIs) and Submittals are tracked under Engineering.

RFI process:
1. Contractor raises RFI with description and reference drawings.
2. Engineer reviews and responds within agreed SLA (typically 5 days).
3. If answer changes design, a drawing revision is triggered.
4. Overdue RFIs are flagged in red on the dashboard.

Submittal process:
1. Contractor submits material/equipment data sheet for review.
2. Engineer reviews and returns with code: A (approved), B (approved with comments), C (revise and resubmit), D (rejected).
3. Only A and B codes permit installation to proceed.

Both RFIs and Submittals are linked to the relevant drawing and contract.`,
    tags: ['RFI', 'submittals', 'review', 'engineering'],
  },

  // PROCUREMENT
  {
    id: 'pro-1',
    title: 'Tender and purchase order workflow',
    module: 'procurement',
    icon: ShoppingCart,
    body: `Procurement is managed under the Procurement module.

Tender process:
1. Procurement Officer creates a tender package with scope of work, BOQ, and evaluation criteria.
2. Tender is approved by Project Manager (DOA applies).
3. Invited bidders receive tender documents via the Vendor Portal.
4. Bids are evaluated using the weighted scoring matrix.
5. Award recommendation is prepared and submitted for approval.
6. Purchase Order (PO) is raised and sent to successful vendor.

PO amendments follow the same DOA rules as contract variations. All communications with vendors must be conducted through the system to maintain the audit trail.`,
    tags: ['tender', 'PO', 'procurement', 'vendor'],
  },
  {
    id: 'pro-2',
    title: 'Receiving and goods inspection',
    module: 'procurement',
    icon: CheckCircle2,
    body: `All deliveries must be recorded in Procurement → Receiving Register.

Receiving process:
1. Record delivery against the relevant PO line.
2. Record condition (Good / Damaged / Partial / Rejected).
3. Upload delivery note and inspection photos.
4. Trigger an inspection workflow if goods are damaged.
5. Approve receipt to update stock levels.

Damaged goods trigger an automatic NCR (Non-Conformance Report) in the HSE module and notify the Project Manager. The vendor is notified via the Vendor Portal with a formal claim if applicable.`,
    tags: ['receiving', 'inspection', 'delivery', 'procurement'],
  },

  // CONSTRUCTION
  {
    id: 'con-1',
    title: 'Daily progress reporting',
    module: 'construction',
    icon: HardHat,
    body: `Construction progress is tracked daily under Construction → Progress Reports.

Each daily report captures:
• Workforce on site (headcount by trade)
• Equipment deployed
• Areas of work completed (% progress per activity)
• Material consumed vs planned
• Issues, delays, and weather conditions

Reports must be submitted by the Site Manager before 18:00 each working day. Missed reports trigger an automated notification to the Project Manager. Programme updates from daily reports feed into the schedule S-curve automatically.`,
    tags: ['progress', 'daily report', 'construction', 'site'],
  },
  {
    id: 'con-2',
    title: 'HSE incident reporting',
    module: 'construction',
    icon: AlertTriangle,
    body: `All HSE incidents must be reported immediately in Construction → HSE.

Incident severity classification:
• Near Miss — No injury, potential risk identified.
• First Aid — Minor injury treated on site.
• Medical Treatment — Requires off-site medical treatment.
• Lost Time Injury (LTI) — Results in lost working time.
• Fatality — Immediate project suspension, regulatory notification required.

For LTI and Fatality events, the system automatically:
1. Notifies the Project Director and HSE Manager.
2. Suspends the relevant work area in the schedule.
3. Opens a mandatory investigation workflow.
4. Escalates to the board if fatality.

Do not attempt to close an incident report without completing the root cause analysis.`,
    tags: ['HSE', 'incident', 'safety', 'LTI'],
    roles: ['PROJECT_DIRECTOR', 'SITE_MANAGER', 'PROJECT_MANAGER'],
  },

  // COMMISSIONING
  {
    id: 'coms-1',
    title: 'Test pack and punch list process',
    module: 'commissioning',
    icon: Activity,
    body: `Commissioning activities are managed under the Commissioning module.

Test pack workflow:
1. Create a test pack for each system or subsystem.
2. Assign a commissioning engineer and inspector.
3. Complete all pre-commissioning checks and record results.
4. Sign off the test pack — requires both commissioning engineer and independent inspector.

Punch list items:
• Category A — Must be completed before energisation (hard stop).
• Category B — Must be completed before handover (soft stop).
• Category C — Must be completed within warranty period.

Category A punch items block gate advancement at G5 and G6. They cannot be waived.`,
    tags: ['test pack', 'punch list', 'commissioning', 'handover'],
  },

  // O&M
  {
    id: 'om-1',
    title: 'Preventive maintenance scheduling',
    module: 'om',
    icon: Settings,
    body: `Maintenance is managed under O&M → Maintenance Schedules.

Maintenance types:
• Preventive (PM) — Scheduled based on time or meter reading.
• Corrective (CM) — Raised from a defect or alarm.
• Predictive (PdM) — AI-triggered based on performance anomaly.

Creating a PM schedule:
1. Select the asset from the Asset Register.
2. Define the task list and required materials.
3. Set recurrence (daily / weekly / monthly / annual).
4. Assign responsible technician.
5. System auto-generates work orders at the defined interval.

Overdue PM work orders are escalated to the O&M Manager after 24 hours.`,
    tags: ['maintenance', 'PM', 'work order', 'O&M'],
  },

  // FINANCE
  {
    id: 'fin-1',
    title: 'Budget and cost control',
    module: 'finance',
    icon: DollarSign,
    body: `Project finances are managed under the Finance module.

Budget structure:
• Approved Budget (Control Budget) — Baseline approved at G1.
• Commitments — Awarded contracts and POs.
• Actuals — Certified invoices and payments.
• Forecast to Complete (FTC) — PM estimate to finish.
• Variance — Control Budget minus (Actuals + FTC).

Earned Value Management (EVM) metrics are calculated automatically:
• PV (Planned Value), EV (Earned Value), AC (Actual Cost)
• CPI (Cost Performance Index) = EV / AC
• SPI (Schedule Performance Index) = EV / PV

A CPI < 0.9 or SPI < 0.85 triggers an automatic cost review workflow.`,
    tags: ['budget', 'EVM', 'cost control', 'finance'],
  },
  {
    id: 'fin-2',
    title: 'Invoice approval and payment certification',
    module: 'finance',
    icon: CheckCircle2,
    roles: ['FINANCE_ANALYST', 'PROJECT_DIRECTOR', 'PROJECT_MANAGER'],
    body: `Invoice processing is managed under Finance → Actuals.

Invoice workflow:
1. Contractor submits invoice via the Vendor Portal.
2. Quantity Surveyor certifies the claimed quantities and amounts.
3. Finance Analyst checks against PO and contract rates.
4. Project Manager approves for payment (DOA applies).
5. Finance processes payment and records the actual.

Payment certificates are generated automatically upon approval and sent to the vendor. Late payment triggers an automated notification at the 14-day mark.

Disputed invoices must have a formal written reason — verbal disputes are not recorded in the system.`,
    tags: ['invoice', 'payment', 'certification', 'finance'],
  },

  // ADMIN
  {
    id: 'adm-1',
    title: 'User management and onboarding',
    module: 'admin',
    icon: Users,
    roles: ['ADMIN'],
    body: `User management is available under Admin → Users.

To add a new user:
1. Click Invite User and enter their email address.
2. Select their role from the role dropdown.
3. Assign them to one or more projects.
4. Click Send Invitation.

The user receives an email with a secure one-time link to set their password. New users are provisioned with read-only access until their role is confirmed.

To deactivate a user, open their profile and click Deactivate. Their data and audit trail are preserved. Deactivated users cannot log in but their historical actions remain visible.`,
    tags: ['users', 'invite', 'onboarding', 'admin'],
  },
  {
    id: 'adm-2',
    title: 'System configuration and defaults',
    module: 'admin',
    icon: Settings,
    roles: ['ADMIN'],
    body: `Platform-wide settings are managed under Admin → Settings.

Configurable options:
• Tenant name, logo, and brand colour.
• Default currency and number format.
• DOA matrix thresholds (requires Board approval to change).
• Gate review SLA durations.
• Notification preferences and escalation rules.
• API gateway connection credentials.
• AI model selection and inference settings.

Changes to the DOA matrix are audit-logged and require two-person authorisation (ADMIN + PROJECT_DIRECTOR).

For SSO configuration or SAML setup, contact your GridMind implementation consultant.`,
    tags: ['settings', 'configuration', 'admin', 'SSO'],
  },
]

/* ─────────────────────────────────────────────────────
   MODULE TABS CONFIG
───────────────────────────────────────────────────── */
interface ModuleTab {
  key: HelpModule | 'all'
  label: string
  icon: React.ElementType
}

const MODULE_TABS: ModuleTab[] = [
  { key: 'all',           label: 'All Topics',    icon: BookOpen },
  { key: 'general',       label: 'General',       icon: Zap },
  { key: 'intake',        label: 'Intake',        icon: Briefcase },
  { key: 'commercial',    label: 'Commercial',    icon: FileText },
  { key: 'engineering',   label: 'Engineering',   icon: Wrench },
  { key: 'procurement',   label: 'Procurement',   icon: ShoppingCart },
  { key: 'construction',  label: 'Construction',  icon: HardHat },
  { key: 'commissioning', label: 'Commissioning', icon: Activity },
  { key: 'om',            label: 'O&M',           icon: Settings },
  { key: 'finance',       label: 'Finance',       icon: DollarSign },
  { key: 'admin',         label: 'Admin',         icon: LayoutDashboard },
]

const MODULE_BADGE_CLASS: Record<HelpModule, string> = {
  general:       'bg-[#64748b]/15 text-[#64748b] border-[#64748b]/25',
  intake:        'bg-[#64748b]/15 text-[#64748b] border-[#64748b]/25',
  commercial:    'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/25',
  engineering:   'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/25',
  procurement:   'bg-[#8b5cf6]/15 text-[#8b5cf6] border-[#8b5cf6]/25',
  construction:  'bg-[#f97316]/15 text-[#f97316] border-[#f97316]/25',
  commissioning: 'bg-[#14b8a6]/15 text-[#14b8a6] border-[#14b8a6]/25',
  om:            'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/25',
  finance:       'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25',
  admin:         'bg-[#06b6d4]/15 text-[#06b6d4] border-[#06b6d4]/25',
}

/* ─────────────────────────────────────────────────────
   TOPIC CARD
───────────────────────────────────────────────────── */
function TopicCard({ topic }: { topic: HelpTopic }) {
  const [open, setOpen] = React.useState(false)
  const Icon = topic.icon
  const bodyId = `help-body-${topic.id}`

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors duration-150',
        open
          ? 'border-border bg-card'
          : 'border-transparent bg-muted/40 hover:bg-muted/70 hover:border-border',
      )}
    >
      {/* Header row */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-lg"
      >
        {/* Icon */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-3.5" aria-hidden="true" />
        </span>

        {/* Title */}
        <span className="flex-1 text-sm font-medium text-foreground leading-snug">
          {topic.title}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        />
      </button>

      {/* Expandable body */}
      <div
        id={bodyId}
        role="region"
        aria-label={topic.title}
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="px-4 pb-4">
          {/* Divider */}
          <div className="mb-3 h-px bg-border" />

          {/* Body text */}
          <pre className="font-sans text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
            {topic.body}
          </pre>

          {/* Footer */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {/* Module badge */}
            <span
              className={cn(
                'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                MODULE_BADGE_CLASS[topic.module],
              )}
            >
              {MODULE_TABS.find(t => t.key === topic.module)?.label ?? topic.module}
            </span>

            {/* Role restriction badge */}
            {topic.roles && (
              <span className="inline-flex items-center rounded-md border border-[#ec4899]/25 bg-[#ec4899]/10 px-2 py-0.5 text-[10px] font-medium text-[#ec4899] uppercase tracking-wide">
                Restricted
              </span>
            )}

            {/* Tags */}
            {topic.tags?.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────── */
export function HelpHubPanel({
  context,
  userRole,
  defaultModule = 'all',
}: HelpHubPanelProps) {
  const [open, setOpen] = React.useState(false)
  const [activeModule, setActiveModule] = React.useState<HelpModule | 'all'>(defaultModule)
  const [query, setQuery] = React.useState('')
  const panelRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const fabRef = React.useRef<HTMLButtonElement>(null)
  const tabListRef = React.useRef<HTMLDivElement>(null)

  // Focus search when panel opens
  React.useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => searchRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [open])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        fabRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Arrow-key navigation in tab list
  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const tabs = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    if (!tabs) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      tabs[(idx + 1) % tabs.length]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      tabs[(idx - 1 + tabs.length) % tabs.length]?.focus()
    }
  }

  // Filtered topics
  const filtered = React.useMemo(() => {
    let items = TOPICS

    // Role filter
    if (userRole) {
      items = items.filter(t => !t.roles || t.roles.includes(userRole))
    }

    // Module filter
    if (activeModule !== 'all') {
      items = items.filter(t => t.module === activeModule)
    }

    // Search filter
    const q = query.trim().toLowerCase()
    if (q) {
      items = items.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.includes(q)),
      )
    }

    return items
  }, [activeModule, query, userRole])

  // Count per module for tab badges
  const countByModule = React.useMemo(() => {
    const base = userRole
      ? TOPICS.filter(t => !t.roles || t.roles.includes(userRole))
      : TOPICS
    const q = query.trim().toLowerCase()
    const searched = q
      ? base.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.includes(q)),
        )
      : base
    const map: Partial<Record<HelpModule | 'all', number>> = { all: searched.length }
    for (const t of searched) {
      map[t.module] = (map[t.module] ?? 0) + 1
    }
    return map
  }, [query, userRole])

  return (
    <>
      {/* ── FAB ── */}
      <button
        ref={fabRef}
        type="button"
        aria-label={open ? 'Close Help Center' : 'Open Help Center'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(v => !v)}
        className={cn(
          // sizing + shape
          'fixed bottom-6 right-6 z-50 flex size-12 items-center justify-center rounded-full',
          // colours — navy in light, accent in dark
          'bg-[#0a192f] text-[#64ffda] dark:bg-[#64ffda] dark:text-[#0a192f]',
          // shadow + ring
          'shadow-lg ring-2 ring-[#64ffda]/40 dark:ring-[#0a192f]/30',
          // transitions
          'transition-all duration-200 hover:scale-105 hover:shadow-[#64ffda]/25 hover:shadow-xl',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60',
          // mobile: push above bottom nav if needed
          'sm:bottom-6 sm:right-6',
        )}
      >
        {open
          ? <X className="size-5" aria-hidden="true" />
          : <HelpCircle className="size-5" aria-hidden="true" />
        }
      </button>

      {/* ── Backdrop (mobile only) ── */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-200 sm:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      />

      {/* ── Panel ── */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Help Center"
        className={cn(
          // positioning: bottom-sheet on mobile, floating card on desktop
          'fixed z-50 transition-all duration-300 ease-out',

          // mobile: full-width bottom sheet
          'inset-x-0 bottom-0 rounded-t-2xl',
          // desktop: floating card bottom-right
          'sm:inset-x-auto sm:bottom-24 sm:right-6 sm:rounded-2xl sm:w-full sm:max-w-[400px]',

          // panel surface
          'bg-background border border-border shadow-2xl',
          'flex flex-col',

          // height
          'max-h-[70vh]',

          // visibility + animation
          open
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-4 opacity-0 pointer-events-none sm:translate-y-2',
        )}
      >
        {/* ── Header ── */}
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
              <BookOpen className="size-3.5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="flex-1 text-sm font-semibold text-foreground">
              Help Center
            </h2>
            {context && (
              <Badge variant="gate" className="text-[10px] h-5">
                {context}
              </Badge>
            )}
            <button
              type="button"
              aria-label="Close Help Center"
              onClick={() => { setOpen(false); fabRef.current?.focus() }}
              className="ml-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Search */}
          <div className="relative mt-2.5">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search topics..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search help topics"
              className={cn(
                'w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-3',
                'text-sm text-foreground placeholder:text-muted-foreground',
                'transition-colors focus:outline-none focus:border-ring focus:ring-1 focus:ring-ring/40',
              )}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => { setQuery(''); searchRef.current?.focus() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* ── Module tabs ── */}
        <div
          ref={tabListRef}
          role="tablist"
          aria-label="Help module filter"
          className="shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border-border scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {MODULE_TABS.map((tab, idx) => {
            const count = countByModule[tab.key] ?? 0
            const isActive = activeModule === tab.key
            const TabIcon = tab.icon
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`help-tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`help-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveModule(tab.key)}
                onKeyDown={e => handleTabKeyDown(e, idx)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1',
                  'text-xs font-medium whitespace-nowrap',
                  'transition-colors duration-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  count === 0 && 'opacity-40 pointer-events-none',
                )}
              >
                <TabIcon className="size-3" aria-hidden="true" />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums',
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground',
                    )}
                    aria-label={`${count} topic${count !== 1 ? 's' : ''}`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Topic list ── */}
        <div
          id={`help-panel-${activeModule}`}
          role="tabpanel"
          aria-labelledby={`help-tab-${activeModule}`}
          className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
        >
          {filtered.length === 0 ? (
            /* No results */
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Search className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">No topics found</p>
                {query ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No results for &ldquo;{query}&rdquo;.{' '}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-foreground"
                      onClick={() => setQuery('')}
                    >
                      Clear search
                    </button>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    No topics are available for this module.
                  </p>
                )}
              </div>
            </div>
          ) : (
            filtered.map(topic => (
              <TopicCard key={topic.id} topic={topic} />
            ))
          )}
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-border px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {filtered.length} topic{filtered.length !== 1 ? 's' : ''}
            {query && ` matching "${query}"`}
          </span>
          <a
            href="#"
            className="text-[11px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded"
            onClick={e => e.preventDefault()}
          >
            Full documentation
          </a>
        </div>
      </div>
    </>
  )
}
