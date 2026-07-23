'use client'

import * as React from 'react'
import {
  HelpCircle, BookOpen, Search, X, ChevronDown,
  Zap, LayoutDashboard, Briefcase, Wrench, ShoppingCart,
  HardHat, Activity, DollarSign, Settings, FileText,
  CheckCircle2, AlertTriangle, Users, GitBranch, Shield,
  Lock, ThumbsUp, ThumbsDown, SearchX, TrendingUp, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

/* ─────────────────────────────────────────────────────
   TYPES — spec shape (external) + internal shape
───────────────────────────────────────────────────── */

/** Spec-compatible external shape — matches the DB/API row */
export interface HelpTopic {
  id: string
  module_key: string
  title: string
  body: string
  role_visibility: string[] | null  // null = all roles
  sort_order: number
  is_active: boolean
}

/** Internal shape used for the built-in TOPICS const */
interface InternalTopic {
  id: string
  title: string
  body: string
  module: HelpModuleKey
  icon: React.ElementType
  roles?: string[]   // undefined = visible to all
  tags?: string[]
}

export type HelpModuleKey =
  | 'general'
  | 'intake'
  | 'commercial'
  | 'engineering'
  | 'procurement'
  | 'construction'
  | 'commissioning'
  | 'om'
  | 'finance'
  | 'ai-analytics'
  | 'admin'
  | 'settings'

/** Legacy alias kept for backward compat */
export type HelpModule = HelpModuleKey

export type UserRole =
  | 'PROJECT_DIRECTOR'
  | 'PROJECT_MANAGER'
  | 'ENGINEER'
  | 'PROCUREMENT_OFFICER'
  | 'SITE_MANAGER'
  | 'FINANCE_ANALYST'
  | 'ADMIN'
  | 'VIEWER'
  // spec roles
  | 'tenant_admin'
  | 'super_admin'
  | 'pmo_director'

export interface HelpHubPanelProps {
  /** External topics from DB/API — merged with built-in TOPICS when provided */
  topics?: HelpTopic[]
  /** Currently active module context — shown as context badge and auto-filters */
  contextModule?: string
  /** Legacy alias for contextModule */
  context?: string
  /** Restrict topic visibility by role */
  userRole?: string
  /** Controlled open state */
  isOpen?: boolean
  /** Called when panel open state changes */
  onOpenChange?: (open: boolean) => void
  /** Which tab is pre-selected on open */
  defaultModule?: HelpModuleKey | 'all'
  className?: string
}

/* ─────────────────────────────────────────────────────
   BUILT-IN TOPIC DATA
───────────────────────────────────────────────────── */
const TOPICS: InternalTopic[] = [
  // GENERAL
  {
    id: 'gen-1',
    title: 'Getting started with GridMind Capital',
    module: 'general',
    icon: Zap,
    body: `GridMind Capital is a Renewable EPC Operating System built to manage the full project lifecycle from initial intake through to operations & maintenance.

Key features:
• 10-phase gate system (G0–G9)
• Multi-tenant architecture with row-level isolation
• 15 user roles with DOA-governed permissions
• Immutable audit trails on every write
• Real-time notifications and escalation engine
• AI-powered analytics and predictive insights

Navigate using the sidebar. Use **⌘K** (or Ctrl+K) to open global search. The Stage-Gate stepper on each project page shows your current gate and required deliverables.`,
    tags: ['navigation', 'overview', 'quick start'],
  },
  {
    id: 'gen-2',
    title: 'Understanding stage-gate approvals',
    module: 'general',
    icon: GitBranch,
    body: `GridMind uses a **G0–G9** stage-gate framework to govern project progression.

Each gate requires specific deliverables and approvals before a project can advance:
• G0 – Opportunity Accepted
• G1 – Project Baseline Approved
• G2 – Engineering IFC Release
• G3 – Procurement Award
• G4 – Construction Mobilization
• G5 – Mechanical Completion
• G6 – Handover, Operations & Closeout

> Segregation of duty rules apply — the creator of a workflow cannot be the sole approver.`,
    tags: ['gates', 'approvals', 'workflow'],
  },
  {
    id: 'gen-3',
    title: 'Role-based access control',
    module: 'general',
    icon: Shield,
    roles: ['PROJECT_DIRECTOR', 'ADMIN', 'tenant_admin', 'super_admin'],
    body: `Access to modules and actions is governed by your assigned role.

Available roles:
• **Super Admin** — Full access, all tenants
• **Tenant Admin** — Tenant-scoped full access
• **Executive Sponsor** — Strategic decisions and gate approvals
• **PMO Director** — Portfolio oversight and governance
• **Project Manager** — Execution management
• **Engineering Manager** — Technical approvals
• **Procurement Manager** — Supply chain
• **Construction Manager** — Site management
• **HSE Manager** — Safety compliance
• **QAQC Manager** — Quality assurance
• **Finance Controller** — Financial oversight
• **Client PMC** — Client-facing read/comment
• **Viewer** — Read-only access

Contact your Admin to update your role assignment.`,
    tags: ['roles', 'permissions', 'access'],
  },
  {
    id: 'gen-4',
    title: 'Audit logs and governance trail',
    module: 'general',
    icon: FileText,
    roles: ['PROJECT_DIRECTOR', 'ADMIN', 'FINANCE_ANALYST', 'tenant_admin'],
    body: `Every write operation in GridMind is recorded in the immutable audit log.

Each entry captures:
• Actor (who performed the action)
• Action type (create, approve, reject, escalate)
• Entity (what was changed)
• State before and after
• Timestamp and IP address

> Audit records cannot be deleted or modified — they form the permanent governance trail required for DOA and regulatory reporting.

Access audit logs via **Admin → Audit Trail**. Logs can be exported as CSV or PDF.`,
    tags: ['audit', 'compliance', 'governance'],
  },

  // INTAKE
  {
    id: 'int-1',
    title: 'G0: Opportunity Accepted',
    module: 'intake',
    icon: Briefcase,
    body: `Gate **G0** validates the project opportunity before committing resources.

Required deliverables:
1. Opportunity Assessment
2. Preliminary Risk Screening
3. Stakeholder Register

**Approval required from:** Executive Sponsor

The project enters G0 status upon creation. A workflow instance is automatically started and the assigned sponsor must approve within 5 business days.

> Missing documents will cause the gate review to be held pending.`,
    tags: ['G0', 'intake', 'opportunity'],
  },
  {
    id: 'int-2',
    title: 'Opportunity assessment checklist',
    module: 'intake',
    icon: CheckCircle2,
    body: `Before advancing from G0 to G1, complete the opportunity assessment:

1. **Land / site** — Confirm land tenure or lease option agreement is in place.
2. **Grid** — Obtain preliminary grid connection study or reservation letter.
3. **Permits** — Identify all required permits and indicative timelines.
4. **EPC feasibility** — High-level budget and schedule from EPC contractor.
5. **Financial model** — Preliminary IRR/NPV at agreed tariff/PPA assumptions.
6. **Risk register** — Initial risk identification and top-3 mitigations.

Upload all supporting documents against the project record before submitting for G0 approval.`,
    tags: ['checklist', 'G0', 'assessment'],
  },

  // COMMERCIAL
  {
    id: 'com-1',
    title: 'G1: Project Baseline Approved',
    module: 'commercial',
    icon: FileText,
    body: `Gate **G1** establishes the project baseline before engineering commences.

Required deliverables:
1. Project Charter
2. Detailed Schedule (Level 3)
3. Cost Baseline
4. Risk Register

**Approval required from:** PMO Director + Executive Sponsor

> Both approvers must sign off — dual-approval is enforced by the workflow engine.`,
    tags: ['G1', 'baseline', 'commercial'],
  },
  {
    id: 'com-2',
    title: 'Delegation of Authority (DOA) thresholds',
    module: 'commercial',
    icon: Shield,
    roles: ['PROJECT_DIRECTOR', 'PROJECT_MANAGER', 'ADMIN', 'pmo_director'],
    body: `All financial approvals are governed by the DOA matrix.

Approval thresholds:
• **Low** < $50K — Project Manager can approve independently
• **Medium** $50K–$250K — PMO Director required
• **High** $250K–$1M — Executive Sponsor required
• **Very High** > $1M — Board approval required (escalated automatically)

Configure thresholds in **Tenant Settings → Approval Rules**.

> DOA rules are enforced at the workflow engine level — the system will block out-of-DOA approvals automatically.`,
    tags: ['DOA', 'approval', 'thresholds', 'finance'],
  },

  // ENGINEERING
  {
    id: 'eng-1',
    title: 'G2: Engineering IFC Release',
    module: 'engineering',
    icon: Zap,
    body: `Gate **G2** releases Issued For Construction (IFC) drawings.

Required deliverables:
1. IFC Drawings
2. Technical Specifications
3. Bill of Materials (BOM)
4. Design Calculations

**Approval required from:** Engineering Manager + Project Manager

Revision status codes:
\`A\` For Information · \`B\` For Review · \`C\` For Approval · \`D\` IFC · \`E\` As-Built

> Only D-status drawings are permitted for construction use.`,
    tags: ['G2', 'IFC', 'engineering', 'drawings'],
  },
  {
    id: 'eng-2',
    title: 'RFI and submittal process',
    module: 'engineering',
    icon: AlertTriangle,
    body: `RFIs and Submittals are tracked under Engineering.

**RFI process:**
1. Contractor raises RFI with description and reference drawings.
2. Engineer reviews and responds within agreed SLA (typically 5 days).
3. If answer changes design, a drawing revision is triggered.
4. Overdue RFIs are flagged in red on the dashboard.

**Submittal review codes:**
\`A\` Approved · \`B\` Approved with comments · \`C\` Revise & resubmit · \`D\` Rejected

> Only A and B codes permit installation to proceed.`,
    tags: ['RFI', 'submittals', 'review', 'engineering'],
  },

  // PROCUREMENT
  {
    id: 'pro-1',
    title: 'Tender and purchase order workflow',
    module: 'procurement',
    icon: ShoppingCart,
    body: `Procurement is managed under the Procurement module.

**Tender process:**
1. Create a tender package with scope, BOQ, and evaluation criteria.
2. Tender approved by Project Manager (DOA applies).
3. Invited bidders receive documents via the Vendor Portal.
4. Bids evaluated using the weighted scoring matrix.
5. Award recommendation submitted for approval.
6. Purchase Order (PO) raised and sent to successful vendor.

> All vendor communications must be conducted through the system to maintain the audit trail.`,
    tags: ['tender', 'PO', 'procurement', 'vendor'],
  },
  {
    id: 'pro-2',
    title: 'Receiving and goods inspection',
    module: 'procurement',
    icon: CheckCircle2,
    body: `All deliveries must be recorded in **Procurement → Receiving Register**.

**Receiving process:**
1. Record delivery against the relevant PO line.
2. Record condition: Good / Damaged / Partial / Rejected.
3. Upload delivery note and inspection photos.
4. Trigger an inspection workflow if goods are damaged.
5. Approve receipt to update stock levels.

> Damaged goods trigger an automatic NCR in the HSE module and notify the Project Manager.`,
    tags: ['receiving', 'inspection', 'delivery', 'procurement'],
  },

  // CONSTRUCTION
  {
    id: 'con-1',
    title: 'Daily progress reporting',
    module: 'construction',
    icon: HardHat,
    body: `Construction progress is tracked daily under **Construction → Progress Reports**.

Each daily report captures:
• Workforce on site (headcount by trade)
• Equipment deployed
• Areas of work completed (% progress per activity)
• Material consumed vs planned
• Issues, delays, and weather conditions

Reports must be submitted by the Site Manager before **18:00** each working day. Missed reports trigger an automated notification to the Project Manager.`,
    tags: ['progress', 'daily report', 'construction', 'site'],
  },
  {
    id: 'con-2',
    title: 'HSE incident reporting',
    module: 'construction',
    icon: AlertTriangle,
    roles: ['PROJECT_DIRECTOR', 'SITE_MANAGER', 'PROJECT_MANAGER'],
    body: `All HSE incidents must be reported immediately in **Construction → HSE**.

Incident severity classification:
• **Near Miss** — No injury, potential risk identified
• **First Aid** — Minor injury treated on site
• **Medical Treatment** — Requires off-site treatment
• **Lost Time Injury (LTI)** — Results in lost working time
• **Fatality** — Immediate project suspension required

For LTI and Fatality events, the system automatically notifies the Project Director, suspends the relevant work area, and opens a mandatory investigation workflow.`,
    tags: ['HSE', 'incident', 'safety', 'LTI'],
  },

  // COMMISSIONING
  {
    id: 'coms-1',
    title: 'Test pack and punch list process',
    module: 'commissioning',
    icon: Activity,
    body: `Commissioning activities are managed under the Commissioning module.

**Test pack workflow:**
1. Create a test pack for each system or subsystem.
2. Assign a commissioning engineer and inspector.
3. Complete all pre-commissioning checks and record results.
4. Sign off — requires both commissioning engineer and independent inspector.

**Punch list categories:**
• **Category A** — Must be completed before energisation (hard stop)
• **Category B** — Must be completed before handover (soft stop)
• **Category C** — Must be completed within warranty period

> Category A items block gate advancement at G5 and G6 and cannot be waived.`,
    tags: ['test pack', 'punch list', 'commissioning', 'handover'],
  },

  // O&M
  {
    id: 'om-1',
    title: 'Preventive maintenance scheduling',
    module: 'om',
    icon: Wrench,
    body: `Maintenance is managed under **O&M → Maintenance Schedules**.

Maintenance types:
• **Preventive (PM)** — Scheduled based on time or meter reading
• **Corrective (CM)** — Raised from a defect or alarm
• **Predictive (PdM)** — AI-triggered based on performance anomaly

Creating a PM schedule:
1. Select the asset from the Asset Register.
2. Define the task list and required materials.
3. Set recurrence (daily / weekly / monthly / annual).
4. Assign responsible technician.
5. System auto-generates work orders at the defined interval.

> Overdue PM work orders are escalated to the O&M Manager after 24 hours.`,
    tags: ['maintenance', 'PM', 'work order', 'O&M'],
  },

  // FINANCE
  {
    id: 'fin-1',
    title: 'Budget and cost control',
    module: 'finance',
    icon: BarChart3,
    body: `Project finances are managed under the Finance module.

**Budget structure:**
• Approved Budget (Control Budget) — Baseline approved at G1
• Commitments — Awarded contracts and POs
• Actuals — Certified invoices and payments
• Forecast to Complete (FTC) — PM estimate to finish
• Variance — Control Budget minus (Actuals + FTC)

**Earned Value Management (EVM):**
\`CPI\` = EV / AC · \`SPI\` = EV / PV

> A CPI < 0.9 or SPI < 0.85 triggers an automatic cost review workflow.`,
    tags: ['budget', 'EVM', 'cost control', 'finance'],
  },
  {
    id: 'fin-2',
    title: 'Invoice approval and payment certification',
    module: 'finance',
    icon: CheckCircle2,
    roles: ['FINANCE_ANALYST', 'PROJECT_DIRECTOR', 'PROJECT_MANAGER'],
    body: `Invoice processing is managed under **Finance → Actuals**.

**Invoice workflow:**
1. Contractor submits invoice via the Vendor Portal.
2. Quantity Surveyor certifies claimed quantities and amounts.
3. Finance Analyst checks against PO and contract rates.
4. Project Manager approves for payment (DOA applies).
5. Finance processes payment and records the actual.

> Late payment triggers an automated notification at the 14-day mark. Disputed invoices must have a formal written reason.`,
    tags: ['invoice', 'payment', 'certification', 'finance'],
  },

  // AI ANALYTICS
  {
    id: 'ai-1',
    title: 'AI-powered project insights',
    module: 'ai-analytics',
    icon: TrendingUp,
    body: `GridMind's AI engine continuously analyses project data to surface risks and opportunities.

**Available AI modules:**
• **Risk Radar** — Predictive risk scoring based on schedule, cost, and quality signals
• **Cost Forecast** — ML-based EAC prediction with confidence intervals
• **Schedule Optimizer** — Critical path analysis with resource levelling
• **Defect Classifier** — Image-based defect detection from site photos
• **Document Analyst** — Contract risk extraction from uploaded PDFs

> AI recommendations are advisory only. All approvals and decisions remain with qualified human approvers.`,
    tags: ['AI', 'analytics', 'predictions', 'insights'],
  },

  // ADMIN
  {
    id: 'adm-1',
    title: 'Managing Users & Roles',
    module: 'admin',
    icon: Users,
    roles: ['tenant_admin', 'super_admin'],
    body: `User management is available under **Admin → Users**.

GridMind Capital supports **15 user roles**:
Super Admin, Tenant Admin, Executive Sponsor, PMO Director, Project Manager, Engineering Manager, Procurement Manager, Construction Manager, HSE Manager, QAQC Manager, Commissioning Manager, O&M Manager, Finance Controller, Client PMC, Viewer.

**To add a new user:**
1. Click Invite User and enter their email address.
2. Select their role from the role dropdown.
3. Assign them to one or more projects.
4. Click Send Invitation.

> Deactivated users cannot log in but their historical actions and audit trail are preserved.`,
    tags: ['users', 'invite', 'onboarding', 'admin'],
  },
  {
    id: 'adm-2',
    title: 'System configuration and defaults',
    module: 'admin',
    icon: LayoutDashboard,
    roles: ['tenant_admin', 'super_admin'],
    body: `Platform-wide settings are managed under **Admin → Settings**.

Configurable options:
• Tenant name, logo, and brand colour
• Default currency and number format
• DOA matrix thresholds (requires Board approval to change)
• Gate review SLA durations
• Notification preferences and escalation rules
• API gateway connection credentials
• AI model selection and inference settings

> Changes to the DOA matrix are audit-logged and require two-person authorisation (Admin + Executive Sponsor).`,
    tags: ['settings', 'configuration', 'admin', 'SSO'],
  },

  // SETTINGS
  {
    id: 'set-1',
    title: 'Configuring Approval Thresholds',
    module: 'settings',
    icon: Settings,
    roles: ['tenant_admin', 'super_admin', 'pmo_director'],
    body: `Approval thresholds determine who must approve based on monetary value.

**Threshold bands:**
• **Low** < $50K — Project Manager
• **Medium** $50K–$250K — PMO Director
• **High** $250K–$1M — Executive Sponsor
• **Very High** > $1M — Board

Configure in **Tenant Settings → Approval Rules**.

> Threshold changes are audit-logged. Both a Tenant Admin and PMO Director must confirm the change.`,
    tags: ['thresholds', 'approval', 'settings', 'DOA'],
  },
]

/* ─────────────────────────────────────────────────────
   MODULE TABS CONFIG
───────────────────────────────────────────────────── */
interface ModuleTab {
  key: HelpModuleKey | 'all'
  label: string
  icon: React.ElementType
}

const MODULE_TABS: ModuleTab[] = [
  { key: 'all',           label: 'All Topics',   icon: BookOpen },
  { key: 'general',       label: 'General',      icon: Zap },
  { key: 'intake',        label: 'Intake',       icon: Briefcase },
  { key: 'commercial',    label: 'Commercial',   icon: FileText },
  { key: 'engineering',   label: 'Engineering',  icon: Zap },
  { key: 'procurement',   label: 'Procurement',  icon: ShoppingCart },
  { key: 'construction',  label: 'Construction', icon: HardHat },
  { key: 'commissioning', label: 'Commissioning',icon: Activity },
  { key: 'om',            label: 'O&M',          icon: Wrench },
  { key: 'finance',       label: 'Finance',      icon: BarChart3 },
  { key: 'ai-analytics',  label: 'AI Analytics', icon: TrendingUp },
  { key: 'admin',         label: 'Admin',        icon: Shield },
  { key: 'settings',      label: 'Settings',     icon: Settings },
]

const MODULE_BADGE_CLASS: Record<HelpModuleKey, string> = {
  general:       'bg-[#64748b]/15 text-[#64748b] border-[#64748b]/25',
  intake:        'bg-[#64748b]/15 text-[#64748b] border-[#64748b]/25',
  commercial:    'bg-[#3b82f6]/15 text-[#3b82f6] border-[#3b82f6]/25',
  engineering:   'bg-[#6366f1]/15 text-[#6366f1] border-[#6366f1]/25',
  procurement:   'bg-[#8b5cf6]/15 text-[#8b5cf6] border-[#8b5cf6]/25',
  construction:  'bg-[#f97316]/15 text-[#f97316] border-[#f97316]/25',
  commissioning: 'bg-[#14b8a6]/15 text-[#14b8a6] border-[#14b8a6]/25',
  om:            'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/25',
  finance:       'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/25',
  'ai-analytics':'bg-[#06b6d4]/15 text-[#06b6d4] border-[#06b6d4]/25',
  admin:         'bg-[#ec4899]/15 text-[#ec4899] border-[#ec4899]/25',
  settings:      'bg-[#64748b]/15 text-[#64748b] border-[#64748b]/25',
}

/* ─────────────────────────────────────────────────────
   RICH BODY RENDERER
   Parses markdown-lite syntax from body strings:
   - **bold** → <strong>
   - `code` → <code>
   - > blockquote → callout box (amber)
   - Lines starting with "!" → info box (blue)
   - • / numbered → list items
───────────────────────────────────────────────────── */
function RichBody({ text, highlight }: { text: string; highlight?: string }) {
  const lines = text.split('\n')

  function highlightText(str: string) {
    if (!highlight) return str
    const parts = str.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === highlight.toLowerCase()
        ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-foreground rounded-[2px] px-0.5">{part}</mark>
        : part,
    )
  }

  function renderInline(str: string): React.ReactNode {
    // Parse **bold** and `code` inline
    const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-foreground">{highlightText(part.slice(2, -2))}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">{part.slice(1, -1)}</code>
      }
      return <React.Fragment key={i}>{highlightText(part)}</React.Fragment>
    })
  }

  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Callout / blockquote: > text
    if (line.startsWith('> ')) {
      elements.push(
        <div key={i} className="my-2 rounded-md border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          {renderInline(line.slice(2))}
        </div>,
      )
      i++
      continue
    }

    // Info box: lines prefixed with "!"
    if (line.startsWith('! ')) {
      elements.push(
        <div key={i} className="my-2 rounded-md border-l-4 border-sky-400 bg-sky-50 dark:bg-sky-900/20 dark:border-sky-500 px-3 py-2 text-xs text-sky-800 dark:text-sky-200">
          {renderInline(line.slice(2))}
        </div>,
      )
      i++
      continue
    }

    // Multi-line code block: ``` ... ```
    if (line.startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={i} className="my-2 rounded-md bg-muted px-3 py-2 font-mono text-[11px] text-foreground overflow-x-auto">
          {codeLines.join('\n')}
        </pre>,
      )
      i++
      continue
    }

    // Bullet list item: • or - or *
    if (/^[•\-\*] /.test(line)) {
      const listItems: string[] = []
      while (i < lines.length && /^[•\-\*] /.test(lines[i])) {
        listItems.push(lines[i].replace(/^[•\-\*] /, ''))
        i++
      }
      elements.push(
        <ul key={i} className="my-1 space-y-0.5 pl-3">
          {listItems.map((item, j) => (
            <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/60" aria-hidden="true" />
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>,
      )
      continue
    }

    // Numbered list: 1. 2. etc.
    if (/^\d+\. /.test(line)) {
      const listItems: string[] = []
      let num = 1
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\. /, ''))
        i++
        num++
      }
      elements.push(
        <ol key={i} className="my-1 space-y-0.5 pl-3">
          {listItems.map((item, j) => (
            <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground leading-relaxed">
              <span className="mt-0.5 shrink-0 tabular-nums text-[10px] font-semibold text-muted-foreground/70 w-4">{j + 1}.</span>
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ol>,
      )
      continue
    }

    // Regular paragraph line
    elements.push(
      <p key={i} className="text-xs text-muted-foreground leading-relaxed">
        {renderInline(line)}
      </p>,
    )
    i++
  }

  return <div className="space-y-1">{elements}</div>
}

/* ─────────────────────────────────────────────────────
   TOPIC CARD
───────────────────────────────────────────────────── */
function highlightTitle(title: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return title
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = title.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/60 text-foreground rounded-[2px] px-0.5">{part}</mark>
      : part,
  )
}

function TopicCard({
  topic,
  searchQuery,
}: {
  topic: InternalTopic
  searchQuery: string
}) {
  const [open, setOpen] = React.useState(false)
  const [helpful, setHelpful] = React.useState<boolean | null>(null)
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
        {/* Module-coloured icon */}
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md',
            MODULE_BADGE_CLASS[topic.module].replace(/border-[^\s]+/g, ''),
          )}
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </span>

        {/* Title + module tag */}
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium text-foreground truncate leading-snug">
            {highlightTitle(topic.title, searchQuery)}
          </span>
          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {MODULE_TABS.find(t => t.key === topic.module)?.label ?? topic.module}
          </span>
        </span>

        {/* Role lock indicator */}
        {topic.roles && (
          <Lock
            className="size-3 shrink-0 text-muted-foreground/50"
            aria-label="Restricted topic"
          />
        )}

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
          <div className="mb-3 h-px bg-border" />

          {/* Rich body */}
          <RichBody text={topic.body} highlight={searchQuery.length > 1 ? searchQuery : undefined} />

          {/* Tags */}
          {topic.tags && topic.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {topic.tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Was this helpful? */}
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
            <span className="text-[11px] text-muted-foreground">Was this helpful?</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Yes, helpful"
                aria-pressed={helpful === true}
                onClick={() => setHelpful(helpful === true ? null : true)}
                className={cn(
                  'flex size-6 items-center justify-center rounded-md transition-colors',
                  helpful === true
                    ? 'bg-[#22c55e]/15 text-[#22c55e]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <ThumbsUp className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="No, not helpful"
                aria-pressed={helpful === false}
                onClick={() => setHelpful(helpful === false ? null : false)}
                className={cn(
                  'flex size-6 items-center justify-center rounded-md transition-colors',
                  helpful === false
                    ? 'bg-destructive/10 text-destructive'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <ThumbsDown className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────────────────────���─────────────
   CONVERT EXTERNAL HelpTopic → InternalTopic
───────────────────────────────────────────────────── */
function externalToInternal(t: HelpTopic): InternalTopic {
  const moduleKey = (t.module_key as HelpModuleKey) ?? 'general'
  const tabEntry = MODULE_TABS.find(m => m.key === moduleKey)
  return {
    id: t.id,
    title: t.title,
    body: t.body,
    module: moduleKey,
    icon: tabEntry?.icon ?? HelpCircle,
    roles: t.role_visibility ?? undefined,
  }
}

/* ─────────────────────────────────────────────────────
   VIRTUAL TOPIC LIST
   Progressive rendering: shows PAGE_SIZE items initially,
   loads more via IntersectionObserver sentinel — avoids
   rendering 100+ collapsed TopicCards at once.
───────────────────────────────────────────────────── */
const VIRTUAL_PAGE = 10

function VirtualTopicList({
  topics,
  searchQuery,
  onClearSearch,
  activeModule,
}: {
  topics: InternalTopic[]
  searchQuery: string
  onClearSearch: () => void
  activeModule: string
}) {
  const [visibleCount, setVisibleCount] = React.useState(VIRTUAL_PAGE)
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  // Reset when topics list changes (filter/search/tab)
  React.useEffect(() => { setVisibleCount(VIRTUAL_PAGE) }, [topics])

  // Load more when sentinel scrolls into view
  React.useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(c => Math.min(c + VIRTUAL_PAGE, topics.length))
        }
      },
      { threshold: 0.1 },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [topics.length])

  const visible = topics.slice(0, visibleCount)

  return (
    <div
      id={`help-panel-${activeModule}`}
      role="tabpanel"
      aria-labelledby={`help-tab-${activeModule}`}
      className="flex-1 overflow-y-auto px-3 py-3 space-y-2"
    >
      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <SearchX className="size-12 text-muted-foreground/30" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">No topics found</p>
            {searchQuery ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Try different keywords or{' '}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-foreground"
                  onClick={onClearSearch}
                >
                  browse all topics
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
        <>
          {visible.map(topic => (
            <TopicCard key={topic.id} topic={topic} searchQuery={searchQuery} />
          ))}
          {/* Sentinel — triggers loading next page when scrolled into view */}
          {visibleCount < topics.length && (
            <div ref={sentinelRef} className="h-4" aria-hidden="true" />
          )}
        </>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────── */
export function HelpHubPanel({
  topics: externalTopics,
  contextModule,
  context,
  userRole,
  isOpen: controlledOpen,
  onOpenChange,
  defaultModule = 'all',
  className,
}: HelpHubPanelProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen

  const setOpen = React.useCallback((val: boolean) => {
    if (!isControlled) setInternalOpen(val)
    onOpenChange?.(val)
  }, [isControlled, onOpenChange])

  // Resolve context (new prop takes precedence over legacy)
  const resolvedContext = contextModule ?? context

  // Derive initial active module from context
  const contextAsModule = resolvedContext?.toLowerCase().replace(/\s+/g, '-') as HelpModuleKey | undefined
  const validContextModule = contextAsModule && MODULE_TABS.some(t => t.key === contextAsModule)
    ? contextAsModule
    : undefined

  const [activeModule, setActiveModule] = React.useState<HelpModuleKey | 'all'>(
    validContextModule ?? defaultModule,
  )

  // Re-sync active module when contextModule changes (e.g. route navigation)
  React.useEffect(() => {
    if (validContextModule) setActiveModule(validContextModule)
  }, [validContextModule])
  const [query, setQuery] = React.useState('')
  const [showTooltip, setShowTooltip] = React.useState(false)
  const panelRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const fabRef = React.useRef<HTMLButtonElement>(null)
  const tabListRef = React.useRef<HTMLDivElement>(null)

  // Merge external topics (converted) with built-in TOPICS
  const allTopics = React.useMemo<InternalTopic[]>(() => {
    if (!externalTopics?.length) return TOPICS
    const converted = externalTopics
      .filter(t => t.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(externalToInternal)
    return [...converted, ...TOPICS]
  }, [externalTopics])

  // Unread badge: show dot if any topics have been added recently (external topics)
  const hasUnread = (externalTopics?.length ?? 0) > 0 && !open

  // Focus search when panel opens
  React.useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => searchRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
  }, [open])

  // Focus trap — keep Tab/Shift+Tab inside dialog when open,
  // and restore focus to the trigger when it closes (any close path).
  React.useEffect(() => {
    if (!open || !panelRef.current) return
    const FOCUSABLE = [
      'a[href]', 'button:not([disabled])', 'input:not([disabled])',
      'select:not([disabled])', 'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')
    // Remember what had focus before opening so we can restore it on close.
    const previouslyFocused = document.activeElement as HTMLElement | null
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (!nodes.length) return
      const first = nodes[0]
      const last  = nodes[nodes.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', handler)
    // Move initial focus into panel
    const first = panelRef.current.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    return () => {
      document.removeEventListener('keydown', handler)
      // Restore focus to the trigger (FAB) or whatever was focused before.
      const restoreTarget = fabRef.current ?? previouslyFocused
      restoreTarget?.focus()
    }
  }, [open])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); fabRef.current?.focus() }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, setOpen])

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, setOpen])

  // Arrow-key navigation in tab list
  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    const tabs = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
    if (!tabs) return
    if (e.key === 'ArrowRight') {
      e.preventDefault(); tabs[(idx + 1) % tabs.length]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); tabs[(idx - 1 + tabs.length) % tabs.length]?.focus()
    }
  }

  // Filtered topics
  const filtered = React.useMemo(() => {
    let items = allTopics

    // Role filter — hide topics whose role_visibility doesn't include the user's role
    if (userRole) {
      items = items.filter(t => !t.roles || t.roles.includes(userRole))
    }

    // Module filter
    if (activeModule !== 'all') {
      items = items.filter(t => t.module === activeModule)
    }

    // Search
    const q = query.trim().toLowerCase()
    if (q) {
      items = items.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.tags?.some(tag => tag.includes(q)),
      )
    }

    return items
  }, [allTopics, activeModule, query, userRole])

  // Count per module for tab badges
  const countByModule = React.useMemo(() => {
    const base = userRole
      ? allTopics.filter(t => !t.roles || t.roles.includes(userRole))
      : allTopics
    const q = query.trim().toLowerCase()
    const searched = q
      ? base.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.includes(q)),
        )
      : base
    const map: Partial<Record<HelpModuleKey | 'all', number>> = { all: searched.length }
    for (const t of searched) map[t.module] = (map[t.module] ?? 0) + 1
    return map
  }, [allTopics, query, userRole])

  return (
    <div className={cn('contents', className)}>
      {/* ── FAB ─────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Tooltip */}
        {showTooltip && !open && (
          <div
            role="tooltip"
            className="absolute bottom-14 right-0 whitespace-nowrap rounded-md bg-[#1e293b] px-2 py-1 text-xs text-white shadow-lg pointer-events-none"
          >
            Help Center
            <span className="absolute -bottom-1 right-4 size-2 rotate-45 bg-[#1e293b]" aria-hidden="true" />
          </div>
        )}

        <button
          ref={fabRef}
          type="button"
          aria-label={open ? 'Close Help Center' : 'Open Help Center'}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen(!open)}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          className={cn(
            'relative flex size-12 items-center justify-center rounded-full',
            'bg-[#0a192f] text-[#64ffda] dark:bg-[#64ffda] dark:text-[#0a192f]',
            'shadow-lg ring-2 ring-[#64ffda]/40 dark:ring-[#0a192f]/30',
            'transition-all duration-200 hover:scale-105 hover:shadow-xl',
            'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/60',
          )}
        >
          {open
            ? <X className="size-5" aria-hidden="true" />
            : <HelpCircle className="size-6" aria-hidden="true" />
          }
          {/* Unread dot */}
          {hasUnread && (
            <span
              className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-red-500 ring-2 ring-[#0a192f] dark:ring-[#64ffda] animate-pulse"
              aria-label="New help topics available"
            />
          )}
        </button>
      </div>

      {/* ── Backdrop (mobile) ── */}
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
          'fixed z-50 transition-all duration-200 ease-out',
          // mobile: full-width bottom sheet, 80vh
          'inset-x-0 bottom-0 rounded-t-2xl max-h-[80vh]',
          // desktop: floating card above FAB
          'sm:inset-x-auto sm:bottom-24 sm:right-6 sm:rounded-2xl sm:w-full sm:max-w-[400px] sm:max-h-[70vh]',
          // surface
          'bg-background border border-border shadow-2xl',
          'flex flex-col',
          // animation
          open
            ? 'translate-y-0 opacity-100 pointer-events-auto'
            : 'translate-y-4 opacity-0 pointer-events-none sm:translate-y-2',
        )}
      >
        {/* ── Mobile drag handle ── */}
        <div
          aria-hidden="true"
          className="flex justify-center pt-3 pb-1 sm:hidden"
        >
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        {/* ── Header ── */}
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
              <BookOpen className="size-3.5 text-primary" aria-hidden="true" />
            </div>
            <h2 className="flex-1 text-sm font-semibold text-foreground">Help Center</h2>
            {resolvedContext && (
              <span className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/30 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
                {resolvedContext}
              </span>
            )}
            <button
              type="button"
              aria-label="Close Help Center"
              onClick={() => { setOpen(false); fabRef.current?.focus() }}
              className="ml-1 flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              placeholder="Search help topics..."
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
          className="shrink-0 flex gap-1 overflow-x-auto px-3 py-2 border-b border-border"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {MODULE_TABS.map((tab, idx) => {
            const count = countByModule[tab.key] ?? 0
            // Hide tabs with no visible topics (e.g. admin tab for non-admin users)
            if (count === 0 && tab.key !== 'all') return null
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
                onClick={() => setActiveModule(tab.key as HelpModuleKey | 'all')}
                onKeyDown={e => handleTabKeyDown(e, idx)}
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-3 py-1',
                  'text-xs font-medium whitespace-nowrap transition-colors duration-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  isActive
                    ? 'bg-[#0a192f] text-[#64ffda] dark:bg-[#64ffda] dark:text-[#0a192f]'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                )}
              >
                <TabIcon className="size-3" aria-hidden="true" />
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-full text-[9px] font-bold tabular-nums',
                      isActive ? 'bg-white/20 text-inherit' : 'bg-border text-muted-foreground',
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

        {/* ── Search result count banner ── */}
        {query.trim() && (
          <div className="shrink-0 px-4 py-2 border-b border-border/60 bg-muted/30">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{filtered.length}</span>
              {' '}result{filtered.length !== 1 ? 's' : ''} for{' '}
              <span className="font-medium text-foreground">&ldquo;{query.trim()}&rdquo;</span>
            </p>
          </div>
        )}

        {/* ── Topic list (progressive virtual rendering) ── */}
        <VirtualTopicList
          topics={filtered}
          searchQuery={query.trim()}
          onClearSearch={() => setQuery('')}
          activeModule={activeModule}
        />

        {/* ─�� Footer ── */}
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
    </div>
  )
}
