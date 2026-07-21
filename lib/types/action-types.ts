/**
 * Shared type definitions for server action return values.
 * Kept in lib/types (no 'use server') so they can be exported from
 * 'use server' action files without violating the "only async functions"
 * rule enforced by Turbopack.
 */

// ── Opportunities ────────────────────────────────────────────────────────────

export interface Opportunity {
  id: string
  code: string
  name: string
  technology: string
  capacity_mw: number
  country: string
  location: string
  status: string
  health: string
  budget_usd: number
  created_at: string
  approvalStatus: string | null
}

export interface OpportunitiesDashboard {
  total: number
  submitted: number
  underReview: number
  approved: number
  rejected: number
  byTechnology: { name: string; value: number }[]
  byStatus: { name: string; value: number; color: string }[]
  items: Opportunity[]
}

// ── Risks ────────────────────────────────────────────────────────────────────

export interface RiskRecord {
  id: string
  code: string
  title: string
  category: string
  probability: number
  impact: number
  score: number
  rag: 'green' | 'amber' | 'red'
  status: string
  owner: string
  mitigation: string
  project_id: string | null
  created_at: string
}

export interface RisksDashboard {
  total: number
  open: number
  highOrCritical: number
  byCategory: { name: string; value: number }[]
  byBand: { name: string; value: number; color: string }[]
  matrixData: { probability: number; impact: number; title: string; id: string; score: number }[]
  items: RiskRecord[]
}

// ── Engineering ──────────────────────────────────────────────────────────────

export interface IFCPackage {
  id: string
  package_number: string
  discipline: string
  title: string
  revision: string
  status: string
  completion_pct: number
  created_at: string
}

export interface DrawingRecord {
  id: string
  drawing_number: string
  title: string
  discipline: string
  revision: string
  status: string
  created_at: string
}

export interface RFIRecord {
  id: string
  ref: string
  title: string
  discipline: string
  status: string
  days_open: number
  is_overdue: boolean
  created_at: string
}

export interface EngineeringDashboard {
  totalPackages: number
  approvedPackages: number
  openRFIs: number
  overdueRFIs: number
  byDiscipline: { name: string; value: number; color: string }[]
  rfiStatus: { name: string; value: number; color: string }[]
  packages: IFCPackage[]
  drawings: DrawingRecord[]
  rfis: RFIRecord[]
}

// ── Procurement ───────────────────────────────────────────────────────────────

export interface RFQRecord {
  id: string
  rfq_number: string
  title: string
  vendor: string
  status: string
  issue_date: string
  close_date: string | null
  amount_usd: number
  score: number | null
}

export interface PORecord {
  id: string
  po_number: string
  vendor: string
  description: string
  amount_usd: number
  status: string
  issued_date: string | null
  expected_delivery: string | null
}

export interface ProcurementDashboard {
  totalRFQs: number
  openRFQs: number
  totalPOs: number
  poValue: number
  rfqStatus: { name: string; value: number; color: string }[]
  poByVendor: { name: string; value: number }[]
  rfqs: RFQRecord[]
  pos: PORecord[]
}

// ── Construction ──────────────────────────────────────────────────────────────

export interface WorkPackage {
  id: string
  wp_code: string
  title: string
  discipline: string
  contractor: string
  planned_pct: number
  actual_pct: number
  status: string
  health: string
}

export interface InspectionRecord {
  id: string
  ref: string
  title: string
  type: string
  result: string | null
  date: string
  inspector: string
  location: string
}

export interface PunchItem {
  id: string
  ref: string
  title: string
  category: 'A' | 'B'
  discipline: string
  status: string
  assigned_to: string
  raised_date: string
}

export interface ConstructionDashboard {
  totalWPs: number
  completedWPs: number
  openPunches: number
  catAPunches: number
  wpByDiscipline: { name: string; planned: number; actual: number }[]
  punchByCategory: { name: string; value: number; color: string }[]
  inspectionResult: { name: string; value: number; color: string }[]
  workPackages: WorkPackage[]
  inspections: InspectionRecord[]
  punchItems: PunchItem[]
}

// ── Commissioning ─────────────────────────────────────────────────────────────

export interface CommissioningTest {
  id: string
  project_id: string
  project_name: string
  system: string
  subsystem: string
  test_number: string
  description: string
  test_type: 'functional' | 'performance' | 'integrated' | 'pre_comm'
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'conditional'
  scheduled_date: string | null
  completed_date: string | null
  witness_required: boolean
  defects_raised: number
  created_at: string
}

export interface HandoverRecord {
  id: string
  project_id: string
  project_name: string
  document_type: 'as_built' | 'operation_manual' | 'warranty' | 'training_cert' | 'spare_parts'
  title: string
  revision: string
  status: 'pending' | 'submitted' | 'approved' | 'rejected'
  submitted_by: string | null
  approved_date: string | null
  created_at: string
}

export interface CommissioningDashboard {
  tests: CommissioningTest[]
  handover: HandoverRecord[]
  stats: {
    totalTests: number
    passedTests: number
    failedTests: number
    pendingTests: number
    handoverDocs: number
    approvedDocs: number
    passRate: number
  }
  bySystem: { system: string; total: number; passed: number; failed: number }[]
  testsByType: { type: string; count: number }[]
}

// ── O&M ───────────────────────────────────────────────────────────────────────

export interface Asset {
  id: string
  tenant_id: string
  project_id: string
  project_name: string
  asset_tag: string
  name: string
  category: 'panel' | 'inverter' | 'transformer' | 'cable' | 'structure' | 'other'
  manufacturer: string
  model: string
  serial_number: string
  installed_date: string | null
  warranty_expiry: string | null
  status: 'operational' | 'degraded' | 'faulty' | 'decommissioned'
  last_maintenance: string | null
  next_maintenance: string | null
  criticality: 'critical' | 'high' | 'medium' | 'low'
  created_at: string
}

export interface MaintenancePlan {
  id: string
  tenant_id: string
  asset_id: string
  asset_name: string
  title: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  last_completed: string | null
  next_due: string | null
  status: 'scheduled' | 'overdue' | 'completed' | 'skipped'
  assigned_to: string | null
  created_at: string
}

export interface OmDashboard {
  assets: Asset[]
  plans: MaintenancePlan[]
  stats: {
    totalAssets: number
    operational: number
    faulty: number
    overdueMaintenance: number
    upcomingMaintenance: number
    warrantyExpiringSoon: number
  }
  byCategory: { category: string; count: number }[]
  byStatus: { status: string; count: number }[]
}

// ── Finance / EVM ─────────────────────────────────────────────────────────────

export interface FinanceRecord {
  id: string
  project_id: string
  project_name: string
  period: string
  bac: number
  pv: number
  ev: number
  ac: number
  cpi: number
  spi: number
  eac: number
  etc: number
  cv: number
  sv: number
  created_at: string
}

export interface CashFlowRecord {
  id: string
  project_id: string
  project_name: string
  period: string
  planned_inflow: number
  actual_inflow: number
  planned_outflow: number
  actual_outflow: number
  cumulative_net: number
  created_at: string
}

export interface FinanceEvmDashboard {
  records: FinanceRecord[]
  cashflow: CashFlowRecord[]
  summary: {
    totalBAC: number
    totalEV: number
    totalAC: number
    avgCPI: number
    avgSPI: number
    totalEAC: number
    variance: number
  }
  evmTrend: { period: string; pv: number; ev: number; ac: number }[]
  cashTrend: { period: string; inflow: number; outflow: number; net: number }[]
}

// ── AI Insights ───────────────────────────────────────────────────────────────

export interface AiInsight {
  id: string
  tenant_id: string
  project_id: string
  project_name: string
  module: 'predictive_maintenance' | 'anomaly_detection' | 'schedule_risk' | 'cost_overrun' | 'safety'
  title: string
  description: string
  confidence: number
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  status: 'open' | 'acknowledged' | 'resolved' | 'dismissed'
  recommended_action: string
  created_at: string
}

export interface MarketplaceProvider {
  id: string
  tenant_id: string
  name: string
  category: 'data_feed' | 'analytics' | 'epc_tool' | 'compliance' | 'finance' | 'field_service'
  description: string
  logo_url: string | null
  integration_type: 'api' | 'webhook' | 'file_import' | 'oauth'
  status: 'available' | 'connected' | 'pending' | 'deprecated'
  rating: number
  review_count: number
  created_at: string
}

export interface AiMarketplaceDashboard {
  insights: AiInsight[]
  providers: MarketplaceProvider[]
  insightStats: { open: number; critical: number; acknowledged: number; resolved: number }
  byModule: { module: string; count: number }[]
  bySeverity: { severity: string; count: number }[]
}
