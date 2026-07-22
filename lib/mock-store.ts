/**
 * lib/mock-store.ts
 * Shared in-memory mock store for GridMind Capital.
 * All modules read/write to this store so audit entries, notifications,
 * and project data are consistent across the entire app.
 */

export type AuditAction =
  | 'PROJECT_CREATED' | 'PROJECT_ARCHIVED' | 'PROJECT_CLONED'
  | 'RISK_CREATED' | 'RISK_UPDATED' | 'RISK_CLOSED'
  | 'ISSUE_CREATED' | 'ISSUE_UPDATED' | 'ISSUE_ESCALATED'
  | 'ACTION_CREATED' | 'ACTION_UPDATED'
  | 'DECISION_CREATED' | 'DECISION_APPROVED' | 'DECISION_REJECTED'
  | 'LESSON_CREATED' | 'LESSON_PROMOTED'
  | 'WORKFLOW_CREATED' | 'WORKFLOW_ACTIVATED' | 'WORKFLOW_ADVANCED' | 'WORKFLOW_EDITED'
  | 'APPROVAL_APPROVED' | 'APPROVAL_REJECTED' | 'APPROVAL_SUBMITTED'
  | 'NOTIFICATION_CREATED' | 'NOTIFICATION_RULE_CREATED' | 'NOTIFICATION_RULE_UPDATED'
  | 'REGISTER_UPDATED'
  | 'ENGINEERING_PACKAGE_CREATED' | 'ENGINEERING_PACKAGE_UPDATED' | 'IFC_RELEASED'
  | 'RFI_CREATED' | 'RFI_CLOSED' | 'DESIGN_CHANGE_CREATED' | 'DESIGN_CHANGE_APPROVED'
  | 'VENDOR_CREATED' | 'VENDOR_SUSPENDED' | 'VENDOR_REINSTATED'
  | 'RFQ_CREATED' | 'BID_SHORTLISTED' | 'AWARD_SUBMITTED' | 'AWARD_APPROVED'
  | 'PO_CREATED' | 'PO_UPDATED'
  | 'EXPORT' | 'LOGIN'

export interface AuditEntry {
  id: string
  timestamp: string  // ISO
  actor: string      // role label
  action: AuditAction
  entityType: string
  entityId: string
  projectId?: string
  companyId: string
  result: 'success' | 'failure'
  details: Record<string, unknown>
}

export interface NotificationItem {
  id: string
  type: 'approval_requested' | 'sla_breach' | 'gate_ready' | 'issue_escalated' | 'workflow_advanced' | 'ai_review_ready'
  title: string
  body: string
  module: string
  projectId?: string
  projectName?: string
  severity: 'info' | 'warning' | 'critical'
  recipientRole: string
  status: 'unread' | 'read' | 'actioned'
  timestamp: string
  sourceEntityId?: string
  sourceEntityType?: string
}

export interface GmcProject {
  id: string
  code: string
  name: string
  type: 'PV' | 'PV+BESS' | 'Wind' | 'Wind+BESS' | 'BESS'
  country: string
  region: string
  siteCoordinates: string
  developerSpv: string
  mwac: number
  mwp: number
  mwh?: number
  gridVoltage: string
  codTarget: string
  ppaType: 'PPA' | 'Merchant' | 'Hybrid'
  capex: number
  currency: string
  equityPct: number
  debtPct: number
  targetIrr: number
  tariffAssumption: string
  team: {
    projectDirector: string
    pmoLead: string
    engineeringLead: string
    procurementLead: string
    constructionManager: string
    financeLead: string
  }
  currentGate: string
  health: 'green' | 'amber' | 'red'
  status: 'draft' | 'pending_activation' | 'active' | 'on-hold' | 'completed' | 'archived'
  createdAt: string
}

/* ─── Singleton store ──────────────────────────────────────── */

let _auditLog: AuditEntry[] = []
let _notifications: NotificationItem[] = []
let _projects: GmcProject[] = []

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/* ─── Seed default data ────────────────────────────────────── */

const SEED_PROJECTS: GmcProject[] = [
  {
    id: 'GMC-2026-001', code: 'GMC-2026-001', name: 'Al Dhafra Solar PV – Phase 2',
    type: 'PV', country: 'UAE', region: 'Abu Dhabi', siteCoordinates: '23.4241,53.8478',
    developerSpv: 'ADNOC Renewable Energy SPV',
    mwac: 1500, mwp: 1800, gridVoltage: '400kV', codTarget: '2028-06-30', ppaType: 'PPA',
    capex: 1_200_000_000, currency: 'USD', equityPct: 30, debtPct: 70, targetIrr: 8.5,
    tariffAssumption: '$22.35/MWh',
    team: { projectDirector: 'Sarah Al-Mansouri', pmoLead: 'James Okafor', engineeringLead: 'Dr. Yuki Tanaka', procurementLead: 'Carlos Reyes', constructionManager: 'Ahmed Hassan', financeLead: 'Priya Sharma' },
    currentGate: 'G2', health: 'green', status: 'active', createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'GMC-2026-002', code: 'GMC-2026-002', name: 'Neom Green Hydrogen Wind',
    type: 'Wind', country: 'Saudi Arabia', region: 'Tabuk', siteCoordinates: '28.3835,36.5662',
    developerSpv: 'NEOM Clean Energy Co.',
    mwac: 400, mwp: 450, gridVoltage: '132kV', codTarget: '2029-03-31', ppaType: 'Merchant',
    capex: 620_000_000, currency: 'USD', equityPct: 40, debtPct: 60, targetIrr: 9.2,
    tariffAssumption: 'Merchant — P50 $38/MWh',
    team: { projectDirector: 'James Okafor', pmoLead: 'Sarah Al-Mansouri', engineeringLead: 'Erik Svensson', procurementLead: 'Li Wei', constructionManager: 'Omar Al-Rashid', financeLead: 'Fatima Zahra' },
    currentGate: 'G3', health: 'amber', status: 'active', createdAt: '2026-02-20T09:30:00Z',
  },
  {
    id: 'GMC-2026-003', code: 'GMC-2026-003', name: 'Hornsea V Offshore Wind',
    type: 'Wind', country: 'UK', region: 'Yorkshire', siteCoordinates: '53.8668,0.6330',
    developerSpv: 'Orsted Hornsea V Ltd',
    mwac: 1200, mwp: 1350, gridVoltage: '275kV', codTarget: '2030-12-31', ppaType: 'Hybrid',
    capex: 2_100_000_000, currency: 'GBP', equityPct: 35, debtPct: 65, targetIrr: 7.8,
    tariffAssumption: 'CfD + merchant tail',
    team: { projectDirector: 'Ingrid Larsen', pmoLead: 'Michael Chen', engineeringLead: 'Dr. Aisha Malik', procurementLead: 'Pierre Dubois', constructionManager: 'Seun Adeyemi', financeLead: 'Hannah Kowalski' },
    currentGate: 'G1', health: 'amber', status: 'active', createdAt: '2026-03-10T11:00:00Z',
  },
]

const SEED_AUDIT: AuditEntry[] = [
  { id: 'a1', timestamp: '2026-01-15T08:05:00Z', actor: 'PMO Director', action: 'PROJECT_CREATED', entityType: 'project', entityId: 'GMC-2026-001', projectId: 'GMC-2026-001', companyId: 'gmc', result: 'success', details: { name: 'Al Dhafra Solar PV – Phase 2' } },
  { id: 'a2', timestamp: '2026-02-20T09:35:00Z', actor: 'PMO Director', action: 'PROJECT_CREATED', entityType: 'project', entityId: 'GMC-2026-002', projectId: 'GMC-2026-002', companyId: 'gmc', result: 'success', details: { name: 'Neom Green Hydrogen Wind' } },
  { id: 'a3', timestamp: '2026-03-10T11:05:00Z', actor: 'PMO Director', action: 'PROJECT_CREATED', entityType: 'project', entityId: 'GMC-2026-003', projectId: 'GMC-2026-003', companyId: 'gmc', result: 'success', details: { name: 'Hornsea V Offshore Wind' } },
  { id: 'a4', timestamp: '2026-04-01T10:00:00Z', actor: 'Engineering Manager', action: 'WORKFLOW_ACTIVATED', entityType: 'workflow', entityId: 'WF-STAGE-GATE', companyId: 'gmc', result: 'success', details: { workflow: 'G0–G6 Stage Gate' } },
  { id: 'a5', timestamp: '2026-04-15T14:20:00Z', actor: 'Project Manager', action: 'RISK_CREATED', entityType: 'risk', entityId: 'RISK-001', projectId: 'GMC-2026-001', companyId: 'gmc', result: 'success', details: { title: 'Grid connection delay' } },
  { id: 'a6', timestamp: '2026-05-01T09:00:00Z', actor: 'PMO Director', action: 'APPROVAL_APPROVED', entityType: 'approval', entityId: 'APR-001', projectId: 'GMC-2026-001', companyId: 'gmc', result: 'success', details: { subject: 'G2 Gate Review' } },
]

const SEED_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', type: 'approval_requested', title: 'Gate G3 Review Ready', body: 'GMC-2026-002 is ready for G3 gate approval.', module: 'Stage Gates', projectId: 'GMC-2026-002', projectName: 'Neom Green Hydrogen Wind', severity: 'warning', recipientRole: 'PMO Director', status: 'unread', timestamp: '2026-07-21T10:00:00Z', sourceEntityId: 'GMC-2026-002', sourceEntityType: 'project' },
  { id: 'n2', type: 'sla_breach', title: 'SLA Breach: Engineering Review', body: 'Package ENG-PV-003 review is 5 days overdue.', module: 'Engineering', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', severity: 'critical', recipientRole: 'Engineering Manager', status: 'unread', timestamp: '2026-07-20T14:30:00Z' },
  { id: 'n3', type: 'issue_escalated', title: 'Critical Issue Escalated', body: 'Grid interconnection permit blocked — escalated to PMO Director.', module: 'PMO', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', severity: 'critical', recipientRole: 'PMO Director', status: 'unread', timestamp: '2026-07-19T08:15:00Z' },
  { id: 'n4', type: 'workflow_advanced', title: 'Workflow Advanced', body: 'RFQ-001 moved to Evaluation stage.', module: 'Procurement', projectId: 'GMC-2026-001', projectName: 'Al Dhafra Solar PV – Phase 2', severity: 'info', recipientRole: 'Procurement Manager', status: 'read', timestamp: '2026-07-18T11:00:00Z' },
  { id: 'n5', type: 'ai_review_ready', title: 'AI Analysis Ready', body: 'Delivery Intelligence has analyzed GMC-2026-003 project health.', module: 'AI Insights', projectId: 'GMC-2026-003', projectName: 'Hornsea V Offshore Wind', severity: 'info', recipientRole: 'Project Manager', status: 'read', timestamp: '2026-07-17T16:45:00Z' },
]

/* Initialise once */
if (_projects.length === 0) _projects = [...SEED_PROJECTS]
if (_auditLog.length === 0) _auditLog = [...SEED_AUDIT]
if (_notifications.length === 0) _notifications = [...SEED_NOTIFICATIONS]

/* ─── Store API ────────────────────────────────────────────── */

export const mockStore = {
  /* Projects */
  getProjects(): GmcProject[] { return [..._projects] },
  getProject(id: string): GmcProject | undefined { return _projects.find(p => p.id === id) },
  addProject(p: GmcProject): void { _projects = [p, ..._projects] },
  updateProject(id: string, patch: Partial<GmcProject>): void {
    _projects = _projects.map(p => p.id === id ? { ...p, ...patch } : p)
  },
  archiveProject(id: string): void {
    _projects = _projects.map(p => p.id === id ? { ...p, status: 'archived' as const } : p)
  },

  /* Audit */
  getAuditLog(): AuditEntry[] { return [..._auditLog].reverse() },
  addAuditEntry(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'companyId'>): AuditEntry {
    const e: AuditEntry = { ...entry, id: `a-${uid()}`, timestamp: new Date().toISOString(), companyId: 'gmc' }
    _auditLog = [..._auditLog, e]
    return e
  },

  /* Notifications */
  getNotifications(): NotificationItem[] { return [..._notifications].reverse() },
  addNotification(n: Omit<NotificationItem, 'id' | 'timestamp'>): NotificationItem {
    const item: NotificationItem = { ...n, id: `n-${uid()}`, timestamp: new Date().toISOString() }
    _notifications = [..._notifications, item]
    return item
  },
  markNotificationRead(id: string): void {
    _notifications = _notifications.map(n => n.id === id ? { ...n, status: 'read' as const } : n)
  },
  markNotificationActioned(id: string): void {
    _notifications = _notifications.map(n => n.id === id ? { ...n, status: 'actioned' as const } : n)
  },

  /* Helpers */
  uid,
  auditAndNotify(
    auditEntry: Omit<AuditEntry, 'id' | 'timestamp' | 'companyId'>,
    notification?: Omit<NotificationItem, 'id' | 'timestamp'>,
  ) {
    const a = this.addAuditEntry(auditEntry)
    let n: NotificationItem | undefined
    if (notification) n = this.addNotification(notification)
    return { audit: a, notification: n }
  },
}

export const MOCK_USERS = [
  { id: 'u1', name: 'Sarah Al-Mansouri',  role: 'PMO Director',        email: 'sarah@gridmind.com' },
  { id: 'u2', name: 'James Okafor',       role: 'Project Manager',     email: 'james@gridmind.com' },
  { id: 'u3', name: 'Dr. Yuki Tanaka',    role: 'Engineering Lead',    email: 'yuki@gridmind.com' },
  { id: 'u4', name: 'Carlos Reyes',       role: 'Procurement Lead',    email: 'carlos@gridmind.com' },
  { id: 'u5', name: 'Ahmed Hassan',       role: 'Construction Manager',email: 'ahmed@gridmind.com' },
  { id: 'u6', name: 'Priya Sharma',       role: 'Finance Lead',        email: 'priya@gridmind.com' },
  { id: 'u7', name: 'Ingrid Larsen',      role: 'Project Director',    email: 'ingrid@gridmind.com' },
  { id: 'u8', name: 'Michael Chen',       role: 'PMO Lead',            email: 'michael@gridmind.com' },
  { id: 'u9', name: 'Dr. Aisha Malik',    role: 'Engineering Manager', email: 'aisha@gridmind.com' },
  { id: 'u10',name: 'Pierre Dubois',      role: 'Procurement Manager', email: 'pierre@gridmind.com' },
]
