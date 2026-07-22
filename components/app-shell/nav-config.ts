import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Shield,
  Settings,
  HelpCircle,
  GitBranch,
  Activity,
  Sparkles,
  FileText,
  Building2,
  Wrench,
  Hammer,
  Zap,
  PackageCheck,
  DollarSign,
  BarChart3,
  ClipboardList,
  Users,
  Globe,
  AlertTriangle,
  Store,
  Bell,
  GitMerge,
  type LucideIcon,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'pm' | 'engineer' | 'viewer' | 'subcontractor' | 'client_viewer'

/** External roles that receive a stripped-down navigation. */
export const EXTERNAL_ROLES: UserRole[] = ['subcontractor', 'client_viewer']

/**
 * Minimal navigation for external users (subcontractor / client_viewer).
 * They see only the projects list and their own portal page.
 * No portfolio, finance, admin, cost-control, or audit.
 */
export const EXTERNAL_NAV_SECTIONS: NavSection[] = [
  {
    id: 'portal',
    label: 'PORTAL',
    items: [
      {
        id: 'projects',
        label: 'My Projects',
        href: '/projects',
        icon: FolderKanban,
      },
      {
        id: 'documents',
        label: 'Documents',
        href: '/documents',
        icon: FileText,
      },
    ],
  },
]

export interface NavChild {
  id: string
  label: string
  href: string
  phase?: PhaseKey
  roles?: UserRole[]
}

export interface NavSection {
  id: string
  label: string
  items: NavItem[]
}

export interface NavItem {
  id: string
  label: string
  href?: string
  icon: LucideIcon
  children?: NavChild[]
  badge?: number
  bottom?: boolean
  roles?: UserRole[]
  /** Section group this item belongs to */
  section?: string
}

export type PhaseKey =
  | 'g0' | 'g1' | 'g2' | 'g3' | 'g4'
  | 'g5' | 'g6'

// ─────────────────────────────────────────────────────────────
// Phase metadata
// ─────────────────────────────────────────────────────────────

export const PHASE_META: Record<PhaseKey, { label: string; color: string }> = {
  g0: { label: 'G0 · Intake',             color: '#64748b' },
  g1: { label: 'G1 · Development',        color: '#3b82f6' },
  g2: { label: 'G2 · Commercial',         color: '#6366f1' },
  g3: { label: 'G3 · Engineering',        color: '#8b5cf6' },
  g4: { label: 'G4 · Procurement',        color: '#a855f7' },
  g5: { label: 'G5 · Construction',       color: '#f97316' },
  g6: { label: 'G6 · Handover & O&M',     color: '#22c55e' },
}

// ─────────────────────────────────────────────────────────────
// Navigation sections
// ─────────────────────────────────────────────────────────────

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'core',
    label: 'OVERVIEW',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
      },
      {
        id: 'portfolio',
        label: 'Portfolio',
        href: '/portfolio',
        icon: BarChart3,
        children: [
          { id: 'portfolio-overview',  label: 'Overview',   href: '/portfolio' },
          { id: 'portfolio-cash-flow', label: 'Cash Flow',  href: '/portfolio/cash-flow' },
        ],
      },
      {
        id: 'stage-gates',
        label: 'Stage Gates',
        href: '/stage-gates',
        icon: GitBranch,
      },
      {
        id: 'approvals',
        label: 'Approvals',
        href: '/approvals',
        icon: CheckSquare,
        badge: 0,
      },
    ],
  },
  {
    id: 'projects',
    label: 'PROJECTS',
    items: [
      {
        id: 'opportunities',
        label: 'Opportunities',
        href: '/opportunities',
        icon: Sparkles,
      },
      {
        id: 'projects',
        label: 'All Projects',
        href: '/projects',
        icon: FolderKanban,
        children: [
          { id: 'g0', label: 'G0 · Intake',            href: '/projects?gate=G0', phase: 'g0' },
          { id: 'g1', label: 'G1 · Development',     href: '/projects?gate=G1', phase: 'g1' },
          { id: 'g2', label: 'G2 · Commercial',      href: '/projects?gate=G2', phase: 'g2' },
          { id: 'g3', label: 'G3 · Engineering',     href: '/projects?gate=G3', phase: 'g3' },
          { id: 'g4', label: 'G4 · Procurement',     href: '/projects?gate=G4', phase: 'g4' },
          { id: 'g5', label: 'G5 · Construction',    href: '/projects?gate=G5', phase: 'g5' },
          { id: 'g6', label: 'G6 · Handover & O&M',  href: '/projects?gate=G6', phase: 'g6' },
          { id: 'g6-closeout',    label: 'Closeout Checklist', href: '/projects?gate=G6&tab=closeout', phase: 'g6' },
          { id: 'g6-om-transition', label: 'O&M Transition',  href: '/projects?gate=G6&tab=om-transition', phase: 'g6' },
        ],
      },
      {
        id: 'project-sub',
        label: 'Project Sub-pages',
        icon: FolderKanban,
        children: [
          { id: 'proj-commercial',  label: 'Commercial Charter', href: '/projects', phase: 'g1' },
          { id: 'proj-schedule',    label: 'Schedule / Gantt',   href: '/projects', phase: 'g1' },
          { id: 'proj-stakeholders',label: 'Stakeholders',       href: '/projects', phase: 'g1' },
          { id: 'proj-risks',       label: 'Project Risks',      href: '/risks',    phase: 'g1' },
        ],
      },
      {
        id: 'pmo',
        label: 'PMO Cockpit',
        href: '/pmo',
        icon: ClipboardList,
      },
      {
        id: 'workflows',
        label: 'Workflows',
        href: '/workflows',
        icon: GitMerge,
      },
      {
        id: 'notifications',
        label: 'Notifications & Audit',
        href: '/notifications',
        icon: Bell,
      },
    ],
  },
  {
    id: 'delivery',
    label: 'DELIVERY',
    items: [
      {
        id: 'engineering',
        label: 'Engineering',
        href: '/engineering',
        icon: Wrench,
        children: [
          { id: 'eng-drawings',    label: 'Drawing Register',  href: '/engineering/drawings' },
          { id: 'eng-rfis',        label: 'RFIs',              href: '/engineering/rfis' },
          { id: 'eng-submittals',  label: 'Submittals',        href: '/engineering/submittals' },
          { id: 'eng-transmittals',label: 'Transmittals',      href: '/engineering/transmittals' },
        ],
      },
      {
        id: 'procurement',
        label: 'Procurement',
        href: '/procurement',
        icon: ClipboardList,
        children: [
          { id: 'proc-rfqs',      label: 'RFQ Register',      href: '/procurement' },
          { id: 'proc-contracts', label: 'Contracts',         href: '/procurement/contracts' },
          { id: 'proc-po',        label: 'Purchase Orders',   href: '/procurement/purchase-orders' },
          { id: 'proc-receiving', label: 'Receiving',         href: '/procurement/receiving' },
        ],
      },
      {
        id: 'construction',
        label: 'Construction',
        href: '/construction',
        icon: Hammer,
        children: [
          { id: 'con-hse',        label: 'HSE',               href: '/hse' },
          { id: 'con-testing',    label: 'Testing & QA',      href: '/testing' },
          { id: 'con-punch',      label: 'Punch Lists',       href: '/construction/punch-lists' },
        ],
      },
      {
        id: 'commissioning',
        label: 'Commissioning',
        href: '/commissioning',
        icon: Zap,
      },
      {
        id: 'handover',
        label: 'Handover',
        href: '/handover',
        icon: PackageCheck,
      },
      {
        id: 'om',
        label: 'O&M',
        href: '/om',
        icon: Wrench,
        children: [
          { id: 'om-assets',      label: 'Asset Registry',    href: '/om' },
          { id: 'om-maintenance', label: 'Maintenance Plans', href: '/om#maintenance' },
        ],
      },
    ],
  },
  {
    id: 'commercial',
    label: 'COMMERCIAL',
    items: [
      {
        id: 'documents',
        label: 'Documents',
        href: '/documents',
        icon: FileText,
      },
      {
        id: 'commercial',
        label: 'Commercial',
        href: '/commercial',
        icon: Building2,
        children: [
          { id: 'com-contracts',  label: 'Contracts',         href: '/commercial/contracts' },
          { id: 'com-variations', label: 'Variations',        href: '/commercial/variations' },
          { id: 'com-claims',     label: 'Claims',            href: '/commercial/claims' },
        ],
      },
      {
        id: 'finance',
        label: 'Finance',
        href: '/finance',
        icon: DollarSign,
        children: [
          { id: 'fin-budget',     label: 'Budget',            href: '/finance/budget' },
          { id: 'fin-evm',        label: 'EVM & Cash Flow',   href: '/finance/evm' },
          { id: 'fin-actuals',    label: 'Actuals',           href: '/finance/actuals' },
          { id: 'fin-forecast',   label: 'Forecast',          href: '/finance/forecast' },
        ],
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'INTELLIGENCE',
    items: [
      {
        id: 'risks',
        label: 'Risk Register',
        href: '/risks',
        icon: AlertTriangle,
      },
      {
        id: 'esg',
        label: 'ESG & Reporting',
        href: '/esg',
        icon: Globe,
      },
      {
        id: 'ai-insights',
        label: 'AI Insights',
        href: '/ai-insights',
        icon: Sparkles,
      },
      {
        id: 'marketplace',
        label: 'Marketplace',
        href: '/marketplace',
        icon: Store,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        href: '/analytics',
        icon: Activity,
      },
    ],
  },
  {
    id: 'admin-section',
    label: 'ADMINISTRATION',
    items: [
      {
        id: 'admin',
        label: 'Admin',
        icon: Shield,
        roles: ['admin'],
        children: [
          { id: 'admin-console', label: 'Admin Console',     href: '/admin',         roles: ['admin'] },
          { id: 'admin-users',   label: 'Users & Roles',     href: '/admin/users',   roles: ['admin'] },
          { id: 'admin-tenant',  label: 'Tenant Settings',   href: '/admin/tenant',  roles: ['admin'] },
          { id: 'admin-gates',   label: 'Gate Templates',    href: '/admin/gate-templates', roles: ['admin'] },
          { id: 'admin-audit',   label: 'Audit Log',         href: '/admin/audit',   roles: ['admin'] },
          { id: 'api-docs',      label: 'API Reference',     href: '/api-docs',      roles: ['admin'] },
        ],
      },
      {
        id: 'team',
        label: 'Team',
        href: '/team',
        icon: Users,
      },
    ],
  },
]

// Flat list for sidebar rendering (legacy compat — main items only)
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items)

// Bottom-anchored items
export const NAV_BOTTOM: NavItem[] = [
  {
    id: 'settings',
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    bottom: true,
  },
  {
    id: 'help',
    label: 'Help & Docs',
    href: '/help',
    icon: HelpCircle,
    bottom: true,
  },
]

// ─────────────────────────────────────────────────────────────
// Role filter utility
// ─────────────────────────────────────────────────────────────

export function filterNavByRole(items: NavItem[], role: UserRole): NavItem[] {
  return items
    .filter((item) => !item.roles || item.roles.includes(role))
    .map((item) => ({
      ...item,
      children: item.children?.filter(
        (child) => !child.roles || child.roles.includes(role),
      ),
    }))
}

export function filterSectionsByRole(sections: NavSection[], role: UserRole): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: filterNavByRole(section.items, role),
    }))
    .filter((section) => section.items.length > 0)
}

// ─────────────────────────────────────────────────────────────
// Mock current user (replace with real auth session)
// ─────────────────────────────────────────────────────────────

export const MOCK_USER = {
  name: 'Alex Carter',
  role: 'admin' as UserRole,
  roleLabel: 'Platform Admin',
  initials: 'AC',
}
