import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Shield,
  Settings,
  HelpCircle,
  Layers,
  Building2,
  Activity,
  GitBranch,
  Sparkles,
  Users,
  FileText,
  AlertCircle,
  type LucideIcon,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'pm' | 'engineer' | 'viewer'

export interface NavChild {
  id: string
  label: string
  href: string
  /** Short phase tag shown as a coloured dot */
  phase?: PhaseKey
  /** Roles that can see this item. Empty = everyone. */
  roles?: UserRole[]
}

export interface NavItem {
  id: string
  label: string
  href?: string
  icon: LucideIcon
  /** Expandable group — no href on the parent */
  children?: NavChild[]
  /** Numeric badge (e.g. pending approvals) */
  badge?: number
  /** Bottom-anchored items (Settings, Help) */
  bottom?: boolean
  roles?: UserRole[]
}

export type PhaseKey =
  | 'g0' | 'g1' | 'g2' | 'g3' | 'g4'
  | 'g5' | 'g6' | 'g7' | 'g8' | 'g9'

// ─────────────────────────────────────────────────────────────
// Phase metadata
// ─────────────────────────────────────────────────────────────

export const PHASE_META: Record<PhaseKey, { label: string; color: string }> = {
  g0: { label: 'G0', color: '#64748b' },
  g1: { label: 'G1', color: '#3b82f6' },
  g2: { label: 'G2', color: '#6366f1' },
  g3: { label: 'G3', color: '#8b5cf6' },
  g4: { label: 'G4', color: '#a855f7' },
  g5: { label: 'G5', color: '#f97316' },
  g6: { label: 'G6', color: '#14b8a6' },
  g7: { label: 'G7', color: '#22c55e' },
  g8: { label: 'G8', color: '#10b981' },
  g9: { label: 'G9', color: '#06b6d4' },
}

// ─────────────────────────────────────────────────────────────
// Navigation tree
// ─────────────────────────────────────────────────────────────

export const NAV_ITEMS: NavItem[] = [
  // ── Dashboard ──
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },

  // ── Projects (expandable, G0–G9) ──
  {
    id: 'projects',
    label: 'Projects',
    icon: FolderKanban,
    children: [
      { id: 'g0', label: 'G0 · Intake',         href: '/projects/g0', phase: 'g0' },
      { id: 'g1', label: 'G1 · Development',     href: '/projects/g1', phase: 'g1' },
      { id: 'g2', label: 'G2 · Commercial',      href: '/projects/g2', phase: 'g2' },
      { id: 'g3', label: 'G3 · Engineering',     href: '/projects/g3', phase: 'g3' },
      { id: 'g4', label: 'G4 · Procurement',     href: '/projects/g4', phase: 'g4' },
      { id: 'g5', label: 'G5 · Construction',    href: '/projects/g5', phase: 'g5' },
      { id: 'g6', label: 'G6 · Commissioning',   href: '/projects/g6', phase: 'g6' },
      { id: 'g7', label: 'G7 · O&M',             href: '/projects/g7', phase: 'g7' },
      { id: 'g8', label: 'G8 · Finance',         href: '/projects/g8', phase: 'g8' },
      { id: 'g9', label: 'G9 · AI Analytics',    href: '/projects/g9', phase: 'g9' },
    ],
  },

  // ── Approvals ──
  {
    id: 'approvals',
    label: 'Approvals',
    href: '/approvals',
    icon: CheckSquare,
    badge: 4,
  },

  // ── Stage Gates ──
  {
    id: 'stage-gates',
    label: 'Stage Gates',
    href: '/stage-gates',
    icon: GitBranch,
  },

  // ── Portfolio ──
  {
    id: 'portfolio',
    label: 'Portfolio',
    href: '/portfolio',
    icon: Layers,
  },

  // ── ESG ──
  {
    id: 'esg',
    label: 'ESG & Reporting',
    href: '/esg',
    icon: Activity,
  },

  // ── AI Insights ──
  {
    id: 'ai',
    label: 'AI Insights',
    href: '/ai',
    icon: Sparkles,
  },

  // ── Admin (role-gated, expandable) ──
  {
    id: 'admin',
    label: 'Admin',
    icon: Shield,
    roles: ['admin'],
    children: [
      { id: 'admin-users',   label: 'User Management',    href: '/admin/users',   roles: ['admin'] },
      { id: 'admin-roles',   label: 'Roles & Permissions', href: '/admin/roles',  roles: ['admin'] },
      { id: 'admin-audit',   label: 'Audit Log',           href: '/admin/audit',  roles: ['admin'] },
      { id: 'admin-org',     label: 'Organisation',        href: '/admin/org',    roles: ['admin'] },
      { id: 'admin-tenants', label: 'Tenants',             href: '/admin/tenants',roles: ['admin'] },
    ],
  },
]

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

// ─────────────────────────────────────────────────────────────
// Mock current user (replace with real auth session)
// ─────────────────────────────────────────────────────────────

export const MOCK_USER = {
  name: 'Alex Carter',
  role: 'admin' as UserRole,
  roleLabel: 'Platform Admin',
  initials: 'AC',
}
