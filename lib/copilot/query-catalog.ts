import type { ExcelColumn } from '@/lib/excel/export'
import { getDashboardApprovals } from '@/app/actions/dashboard'
import { loadRisksDashboard } from '@/app/actions/risks'

// ─────────────────────────────────────────────────────────────
// Query Catalog Type Definitions
// ─────────────────────────────────────────────────────────────

export interface CatalogRow {
  id: string
  [key: string]: unknown
}

export interface CatalogColumn extends ExcelColumn<any> {
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface CatalogQuery {
  id: string
  label: string
  description: string
  intents: string[] // Keywords/phrases that trigger this query
  run: () => Promise<CatalogRow[]>
  columns: CatalogColumn[]
  rowLink?: (row: CatalogRow) => string | null
}

// ─────────────────────────────────────────────────────────────
// Query Implementations
// ─────────────────────────────────────────────────────────────

// 1. Approvals awaiting me
export const approvalsAwaitingMe: CatalogQuery = {
  id: 'approvals-awaiting',
  label: 'Approvals Awaiting Me',
  description: 'Pending approvals assigned to you',
  intents: [
    'approvals awaiting me',
    'what approvals are waiting',
    'pending approvals',
    'approvals to review',
    'my approvals',
  ],
  run: async () => {
    const approvals = await getDashboardApprovals()
    return approvals
      .filter((a) => a.status === 'pending' || a.status === 'delegated')
      .map((a) => ({
        id: a.id,
        project: a.projectName || '—',
        type: a.type || '—',
        submittedBy: a.submittedBy || '—',
        submittedAt: a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—',
        daysWaiting: a.submittedAt ? Math.floor((Date.now() - new Date(a.submittedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      }))
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Type', key: 'type', type: 'text', sortable: true },
    { header: 'Submitted By', key: 'submittedBy', type: 'text' },
    { header: 'Submitted At', key: 'submittedAt', type: 'date', sortable: true },
    { header: 'Days Waiting', key: 'daysWaiting', type: 'number', sortable: true },
  ],
  rowLink: (row) => `/approvals/${row.id}`,
}

// 2. Overdue VOs (Variation Orders)
export const overdueVOs: CatalogQuery = {
  id: 'overdue-vos',
  label: 'Overdue Variation Orders',
  description: 'Variation orders past their target date',
  intents: [
    'overdue VOs',
    'overdue variation orders',
    'show overdue VOs',
    'overdue VOs',
    'outstanding VOs',
  ],
  run: async () => {
    // For now, return empty array (would require a getVariationOrders action)
    return []
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'VO Number', key: 'voNumber', type: 'text', sortable: true },
    { header: 'Amount', key: 'amount', type: 'currency', sortable: true },
    { header: 'Target Date', key: 'targetDate', type: 'date', sortable: true },
    { header: 'Days Overdue', key: 'daysOverdue', type: 'number', sortable: true },
  ],
  rowLink: (row) => `/vos/${row.id}`,
}

// 3. Expiring permits (30 days)
export const expiringPermits: CatalogQuery = {
  id: 'expiring-permits',
  label: 'Expiring Permits (30d)',
  description: 'Permits expiring in the next 30 days',
  intents: [
    'permits expire',
    'expiring permits',
    'which permits expire this month',
    'permits expiring',
    'permit expiry',
  ],
  run: async () => {
    const risks = await loadRisksDashboard()
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    // Filter for permit risks with expiry dates
    const permits = (risks.risks || [])
      .filter((r) => r.category === 'permit' || r.title?.toLowerCase().includes('permit'))
      .filter((r) => r.dueDate && new Date(r.dueDate) <= thirtyDaysFromNow)
      .map((r) => ({
        id: r.id || '',
        project: r.projectName || '—',
        permit: r.title || '—',
        issueDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
        expiryDate: r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—',
        daysUntilExpiry: r.dueDate ? Math.ceil((new Date(r.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      }))

    return permits.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Permit', key: 'permit', type: 'text', sortable: true },
    { header: 'Issue Date', key: 'issueDate', type: 'date' },
    { header: 'Expiry Date', key: 'expiryDate', type: 'date', sortable: true },
    { header: 'Days Until Expiry', key: 'daysUntilExpiry', type: 'number', sortable: true },
  ],
  rowLink: (row) => `/risks/${row.id}`,
}

// 4. Open NCRs (Non-Conformance Reports)
export const openNCRs: CatalogQuery = {
  id: 'open-ncrs',
  label: 'Open NCRs',
  description: 'Open non-conformance reports',
  intents: ['open NCRs', 'NCRs', 'non-conformance reports', 'show NCRs', 'outstanding NCRs'],
  run: async () => {
    const risks = await loadRisksDashboard()
    return (risks.risks || [])
      .filter((r) => r.category === 'ncr' || r.title?.toLowerCase().includes('ncr'))
      .filter((r) => r.status !== 'closed')
      .map((r) => ({
        id: r.id || '',
        project: r.projectName || '—',
        ncr: r.title || '—',
        owner: r.owner || '—',
        reportedAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
        daysOpen: r.createdAt ? Math.floor((Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      }))
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'NCR', key: 'ncr', type: 'text', sortable: true },
    { header: 'Owner', key: 'owner', type: 'text' },
    { header: 'Reported At', key: 'reportedAt', type: 'date' },
    { header: 'Days Open', key: 'daysOpen', type: 'number', sortable: true },
  ],
  rowLink: (row) => `/risks/${row.id}`,
}

// 5. Pending payment certificates
export const pendingPaymentCerts: CatalogQuery = {
  id: 'pending-payment-certs',
  label: 'Pending Payment Certificates',
  description: 'Payment certificates awaiting approval',
  intents: [
    'pending payment',
    'payment certificates',
    'payment certs',
    'pending PC',
    'awaiting payment approval',
  ],
  run: async () => {
    const approvals = await getDashboardApprovals()
    return approvals
      .filter((a) => a.type?.toLowerCase().includes('payment'))
      .filter((a) => a.status === 'pending' || a.status === 'delegated')
      .map((a) => ({
        id: a.id,
        project: a.projectName || '—',
        certNumber: a.documentId || '—',
        amount: a.amount || 0,
        contractorName: a.submittedBy || '—',
        submittedAt: a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—',
      }))
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Certificate #', key: 'certNumber', type: 'text', sortable: true },
    { header: 'Amount', key: 'amount', type: 'currency', sortable: true },
    { header: 'Contractor', key: 'contractorName', type: 'text' },
    { header: 'Submitted', key: 'submittedAt', type: 'date', sortable: true },
  ],
  rowLink: (row) => `/approvals/${row.id}`,
}

// 6. LD exposure (Liquidated Damages)
export const ldExposure: CatalogQuery = {
  id: 'ld-exposure',
  label: 'LD Exposure',
  description: 'Liquidated damages exposure by project',
  intents: ['LD exposure', 'liquidated damages', 'LD risk', 'penalty exposure'],
  run: async () => {
    const risks = await loadRisksDashboard()
    return (risks.risks || [])
      .filter((r) => r.category === 'ld' || r.title?.toLowerCase().includes('liquidated'))
      .map((r) => ({
        id: r.id || '',
        project: r.projectName || '—',
        description: r.title || '—',
        exposure: r.impact || 0,
        mitigations: r.mitigation || '—',
      }))
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Description', key: 'description', type: 'text' },
    { header: 'Exposure', key: 'exposure', type: 'currency', sortable: true },
    { header: 'Mitigations', key: 'mitigations', type: 'text' },
  ],
  rowLink: (row) => `/risks/${row.id}`,
}

// 7. Slipping schedule activities
export const slippingSchedule: CatalogQuery = {
  id: 'slipping-schedule',
  label: 'Slipping Schedule Activities',
  description: 'Activities behind baseline schedule',
  intents: ['slipping schedule', 'behind schedule', 'schedule delays', 'schedule slip', 'delayed activities'],
  run: async () => {
    // Would require getScheduleActivities action
    return []
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Activity', key: 'activity', type: 'text', sortable: true },
    { header: 'Original Finish', key: 'originalFinish', type: 'date' },
    { header: 'Revised Finish', key: 'revisedFinish', type: 'date', sortable: true },
    { header: 'Days Slippage', key: 'daysSlippage', type: 'number', sortable: true },
  ],
  rowLink: (row) => `/schedule/${row.id}`,
}

// 8. Overdue transmittals
export const overdueTransmittals: CatalogQuery = {
  id: 'overdue-transmittals',
  label: 'Overdue Transmittals',
  description: 'Transmittals past due date',
  intents: ['overdue transmittals', 'transmittals overdue', 'outstanding transmittals', 'past due transmittals'],
  run: async () => {
    // Would require getTransmittals action
    return []
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Transmittal #', key: 'transmittalNumber', type: 'text', sortable: true },
    { header: 'Description', key: 'description', type: 'text' },
    { header: 'Due Date', key: 'dueDate', type: 'date', sortable: true },
    { header: 'Days Overdue', key: 'daysOverdue', type: 'number', sortable: true },
  ],
  rowLink: (row) => `/transmittals/${row.id}`,
}

// 9. Expiring bonds/insurance (90 days)
export const expiringBondsInsurance: CatalogQuery = {
  id: 'expiring-bonds-insurance',
  label: 'Expiring Bonds/Insurance (90d)',
  description: 'Bonds and insurance expiring in 90 days',
  intents: ['expiring bonds', 'expiring insurance', 'bonds expire', 'insurance expiring', 'insurance coverage'],
  run: async () => {
    const risks = await loadRisksDashboard()
    const now = new Date()
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

    return (risks.risks || [])
      .filter((r) => r.category === 'insurance' || r.title?.toLowerCase().includes('bond'))
      .filter((r) => r.dueDate && new Date(r.dueDate) <= ninetyDaysFromNow)
      .map((r) => ({
        id: r.id || '',
        project: r.projectName || '—',
        coverage: r.title || '—',
        type: r.category === 'insurance' ? 'Insurance' : 'Bond',
        expiryDate: r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '—',
        daysUntilExpiry: r.dueDate ? Math.ceil((new Date(r.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0,
      }))
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Coverage', key: 'coverage', type: 'text', sortable: true },
    { header: 'Type', key: 'type', type: 'text' },
    { header: 'Expiry Date', key: 'expiryDate', type: 'date', sortable: true },
    { header: 'Days Until Expiry', key: 'daysUntilExpiry', type: 'number', sortable: true },
  ],
  rowLink: (row) => `/risks/${row.id}`,
}

// 10. Open punch items
export const openPunchItems: CatalogQuery = {
  id: 'open-punch-items',
  label: 'Open Punch Items',
  description: 'Unresolved punch list items',
  intents: ['punch items', 'open punch', 'punch list', 'outstanding punch', 'defects list'],
  run: async () => {
    // Would require getPunchItems action
    return []
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Item #', key: 'itemNumber', type: 'text', sortable: true },
    { header: 'Description', key: 'description', type: 'text' },
    { header: 'Assigned To', key: 'assignedTo', type: 'text' },
    { header: 'Target Date', key: 'targetDate', type: 'date', sortable: true },
  ],
  rowLink: (row) => `/punch/${row.id}`,
}

// 11. Crew on site today
export const crewOnSiteToday: CatalogQuery = {
  id: 'crew-on-site',
  label: 'Crew on Site Today',
  description: 'Field personnel scheduled for today',
  intents: ['crew on site', 'who is on site', 'site attendance', 'crew today', 'field team today'],
  run: async () => {
    // Would require getCrewSchedule action
    return []
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Person', key: 'personName', type: 'text', sortable: true },
    { header: 'Role', key: 'role', type: 'text' },
    { header: 'Check-in Time', key: 'checkInTime', type: 'text' },
    { header: 'Expected Departure', key: 'expectedDeparture', type: 'text' },
  ],
  rowLink: (row) => `/crew/${row.id}`,
}

// 12. Incidents this month
export const incidentsThisMonth: CatalogQuery = {
  id: 'incidents-this-month',
  label: 'Incidents This Month',
  description: 'Safety/quality incidents reported this month',
  intents: ['incidents this month', 'incidents', 'incidents reported', 'safety incidents', 'quality issues'],
  run: async () => {
    const risks = await loadRisksDashboard()
    const monthStart = new Date(new Date().setDate(1))

    return (risks.risks || [])
      .filter((r) => r.category === 'incident' || r.title?.toLowerCase().includes('incident'))
      .filter((r) => r.createdAt && new Date(r.createdAt) >= monthStart)
      .map((r) => ({
        id: r.id || '',
        project: r.projectName || '—',
        description: r.title || '—',
        severity: r.priority || 'medium',
        reportedAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
        status: r.status || 'open',
      }))
  },
  columns: [
    { header: 'Project', key: 'project', type: 'text', sortable: true },
    { header: 'Description', key: 'description', type: 'text', sortable: true },
    { header: 'Severity', key: 'severity', type: 'text', sortable: true },
    { header: 'Reported At', key: 'reportedAt', type: 'date', sortable: true },
    { header: 'Status', key: 'status', type: 'text', sortable: true },
  ],
  rowLink: (row) => `/risks/${row.id}`,
}

// ─────────────────────────────────────────────────────────────
// Catalog Registry
// ─────────────────────────────────────────────────────────────

export const COPILOT_CATALOG: CatalogQuery[] = [
  approvalsAwaitingMe,
  overdueVOs,
  expiringPermits,
  openNCRs,
  pendingPaymentCerts,
  ldExposure,
  slippingSchedule,
  overdueTransmittals,
  expiringBondsInsurance,
  openPunchItems,
  crewOnSiteToday,
  incidentsThisMonth,
]


