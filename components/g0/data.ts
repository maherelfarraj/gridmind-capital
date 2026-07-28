import type {
  ProjectCharter, Stakeholder, InitiationRisk,
  CharterDeliverable, InitiationMilestone, OpportunityScreen,
} from './types'

/**
 * @deprecated — No longer used in CharterTab (now renders empty state for real charters).
 * Mock constants below are kept as reference only for development/testing.
 */

// Old mock fixture — do not export or use in render paths
const MOCK_CHARTER: ProjectCharter = {
  id: 'chr-001',
  project_code: 'SOL-2026-001',
  project_name: 'Sirius 400MW Solar PV — NEOM Region',
  technology: 'Solar PV',
  capacity_mw: 400,
  location: 'NEOM Region, Tabuk Province',
  country: 'Saudi Arabia',
  client: 'NEOM Company',
  sponsor: 'H.E. Abdullah Al-Rashidi',
  pmo_lead: 'James Morgan',
  status: 'under_review',
  version: 'v0.4',
  created_date: '2026-01-15',
  approved_date: null,
  capex_estimate_usd: 380_000_000,
  target_irr_pct: 12.4,
  target_dscr: 1.35,
  project_duration_months: 36,
  fid_target: 'Q3 2027',
  cod_target: 'Q1 2030',
  description: 'Development and construction of a 400MWp utility-scale Solar PV facility in the NEOM region of Tabuk Province, KSA, with grid connection at the NEOM 380kV substation and a 25-year PPA with NEOM Company.',
  strategic_rationale: 'Supports Saudi Arabia Vision 2030 renewable energy targets (50% by 2030). Anchors GridMind\'s KSA platform. Creates a replicable template for further NEOM renewable capacity.',
  scope_included: [
    '400MWp DC / ~320MWac photovoltaic array (bifacial monocrystalline)',
    'Single-axis horizontal trackers across 1,050 hectares',
    'DC collection and 33kV AC collection network',
    '2 x 160MVA main power transformers',
    '380kV substation and grid connection works',
    'SCADA, DCS, and communications infrastructure',
    'Site access roads, security fencing, and civil works',
    'O&M facility and control room',
  ],
  scope_excluded: [
    'Transmission line beyond NEOM 380kV substation boundary',
    'Battery Energy Storage System (to be scoped in Phase 2)',
    'Desalination or water treatment for O&M facility',
    'Permanent accommodation for operations staff',
  ],
  assumptions: [
    'PPA tariff of USD 0.0175/kWh confirmed under REDF framework',
    'Grid connection capacity reserved at NEOM 380kV substation',
    'Land lease agreement signed with NEOM Company for 35 years',
    'GHI resource confirmed via 12-month on-site measurement campaign',
    'Financing on project-finance basis with 70:30 D/E ratio',
  ],
  constraints: [
    'COD must be achieved by 31 January 2030 per PPA long-stop date',
    'All equipment must meet Saudi Aramco Engineering Standard SE-001',
    'Minimum 30% local content per IKTVA programme requirement',
    'Environmental & Social Impact Assessment approved before FID',
  ],
}

// Old mock fixtures — reference only
const MOCK_STAKEHOLDERS: Stakeholder[] = [
  { id: 'sh1', name: 'H.E. Abdullah Al-Rashidi', role: 'sponsor',   title: 'VP — Renewable Energy',   organisation: 'NEOM Company',          email: 'a.alrashidi@neom.com',       phone: '+966 50 111 0001', influence: 'high', interest: 'high', charter_signatory: true,  signed: true,  signed_date: '2026-02-10' },
  { id: 'sh2', name: 'James Morgan',             role: 'pmo',       title: 'PMO Director',             organisation: 'GridMind Capital',      email: 'j.morgan@gridmind.com',      phone: '+971 50 222 0002', influence: 'high', interest: 'high', charter_signatory: true,  signed: false, signed_date: null         },
  { id: 'sh3', name: 'Aisha Al-Rashidi',         role: 'finance',   title: 'Head of Project Finance',  organisation: 'GridMind Capital',      email: 'a.alrashidi@gridmind.com',   phone: '+971 50 333 0003', influence: 'high', interest: 'high', charter_signatory: true,  signed: false, signed_date: null         },
  { id: 'sh4', name: 'Omar Al-Zaid',             role: 'technical', title: 'VP — Engineering',         organisation: 'GridMind Capital',      email: 'o.alzaid@gridmind.com',      phone: '+971 50 444 0004', influence: 'high', interest: 'high', charter_signatory: false, signed: false, signed_date: null         },
  { id: 'sh5', name: 'Khalid Al-Mansouri',       role: 'owner',     title: 'Director — Grid Assets',   organisation: 'NEOM Company',          email: 'k.almansouri@neom.com',      phone: '+966 50 555 0005', influence: 'high', interest: 'medium', charter_signatory: true, signed: true, signed_date: '2026-02-08' },
  { id: 'sh6', name: 'Sarah Chen',               role: 'legal',     title: 'Senior Legal Counsel',     organisation: 'GridMind Capital',      email: 's.chen@gridmind.com',        phone: '+971 50 666 0006', influence: 'medium', interest: 'high', charter_signatory: false, signed: false, signed_date: null },
  { id: 'sh7', name: 'Mohammed Hassan',          role: 'external',  title: 'Senior Grid Advisor',      organisation: 'Saudi Electricity Co.', email: 'm.hassan@sec.com.sa',        phone: '+966 50 777 0007', influence: 'medium', interest: 'medium', charter_signatory: false, signed: false, signed_date: null },
  { id: 'sh8', name: 'Yuki Tanaka',              role: 'technical', title: 'Lead Transmission Engineer','organisation': 'ENGIE Engineering',  email: 'y.tanaka@engie.com',         phone: '+33 6 888 0008',   influence: 'low',  interest: 'high', charter_signatory: false, signed: false, signed_date: null },
]

const MOCK_RISKS: InitiationRisk[] = [
  { id: 'r1', category: 'Regulatory',  description: 'Delay in obtaining MOMRA environmental clearance extending beyond Q2 2027', level: 'high',     probability: 35, impact: 85, mitigation: 'Pre-engage MOMRA EIA team Q1 2026; appoint local environmental consultant',            owner: 'Omar Al-Zaid' },
  { id: 'r2', category: 'Financial',   description: 'USD/SAR exchange rate movement eroding equity IRR by >1%',                   level: 'medium',   probability: 40, impact: 60, mitigation: 'FX hedging strategy to be agreed at financial close; SAR-denominated PPA',          owner: 'Aisha Al-Rashidi' },
  { id: 'r3', category: 'Technical',   description: 'GHI resource lower than P50 estimate resulting in energy yield shortfall',   level: 'medium',   probability: 25, impact: 65, mitigation: 'Additional 6-month met-mast campaign; bankable energy report from independent engineer', owner: 'Yuki Tanaka' },
  { id: 'r4', category: 'Commercial',  description: 'PPA long-stop date breach (31 Jan 2030) triggering liquidated damages',      level: 'critical', probability: 20, impact: 95, mitigation: 'Build 90-day schedule contingency; fast-track procurement strategy',                  owner: 'James Morgan' },
  { id: 'r5', category: 'Geopolitical','description': 'Regional instability affecting international contractor mobilisation',      level: 'low',      probability: 10, impact: 70, mitigation: 'Preferred contractor framework agreements pre-executed; local subcontractor bench',  owner: 'Khalid Al-Mansouri' },
  { id: 'r6', category: 'Technical',   description: 'Tracker pile foundation challenges from NEOM dune terrain geotechnical surprises', level: 'medium', probability: 45, impact: 50, mitigation: 'Early geotechnical investigation programme (300+ boreholes) before EPC award', owner: 'Omar Al-Zaid' },
]

const MOCK_DELIVERABLES: CharterDeliverable[] = [
  { id: 'd1', name: 'Project Charter Document v1.0',       category: 'Charter',         status: 'in_progress', owner: 'James Morgan',     due_date: '2026-03-01', completed_date: null,         notes: 'Version 0.4 in stakeholder review',     mandatory: true  },
  { id: 'd2', name: 'Opportunity Screening Report',         category: 'Development',     status: 'approved',    owner: 'Omar Al-Zaid',     due_date: '2026-01-31', completed_date: '2026-01-28', notes: 'Passed 9/10 criteria — PPA risk noted',  mandatory: true  },
  { id: 'd3', name: 'Preliminary Financial Model (v0.1)',   category: 'Finance',         status: 'complete',    owner: 'Aisha Al-Rashidi', due_date: '2026-02-15', completed_date: '2026-02-12', notes: 'Base case IRR 12.4%. Sensitivity done',  mandatory: true  },
  { id: 'd4', name: 'Stakeholder Register & RACI Matrix',  category: 'Governance',      status: 'complete',    owner: 'James Morgan',     due_date: '2026-02-10', completed_date: '2026-02-09', notes: 'All 8 stakeholders mapped',              mandatory: true  },
  { id: 'd5', name: 'Initiation Risk Register',             category: 'Risk',            status: 'complete',    owner: 'Omar Al-Zaid',     due_date: '2026-02-20', completed_date: '2026-02-18', notes: '6 risks identified; 1 critical',         mandatory: true  },
  { id: 'd6', name: 'Land Tenure Confirmation Letter',      category: 'Legal',           status: 'approved',    owner: 'Sarah Chen',       due_date: '2026-02-28', completed_date: '2026-02-25', notes: 'Executed lease letter from NEOM Co.',    mandatory: true  },
  { id: 'd7', name: 'Grid Connection Pre-Feasibility',      category: 'Technical',       status: 'in_progress', owner: 'Yuki Tanaka',       due_date: '2026-03-10', completed_date: null,         notes: 'SEC confirmation of 380kV capacity pending', mandatory: true  },
  { id: 'd8', name: 'Board Approval to Proceed to G1',      category: 'Governance',      status: 'not_started', owner: 'H.E. Al-Rashidi',  due_date: '2026-03-31', completed_date: null,         notes: 'Pending charter sign-off',               mandatory: true  },
  { id: 'd9', name: 'ESG & Social Screening Note',          category: 'ESG',             status: 'complete',    owner: 'Sarah Chen',       due_date: '2026-02-22', completed_date: '2026-02-21', notes: 'No Category A flags identified',         mandatory: false },
]

const MOCK_MILESTONES: InitiationMilestone[] = [
  { id: 'm1', name: 'Opportunity Identified',      target_date: '2026-01-10', actual_date: '2026-01-08', status: 'complete',     gate: 'Pre-G0', owner: 'James Morgan' },
  { id: 'm2', name: 'Screening Criteria Passed',   target_date: '2026-01-31', actual_date: '2026-01-28', status: 'complete',     gate: 'G0',     owner: 'Omar Al-Zaid' },
  { id: 'm3', name: 'Charter Draft Circulated',    target_date: '2026-02-15', actual_date: '2026-02-16', status: 'complete',     gate: 'G0',     owner: 'James Morgan' },
  { id: 'm4', name: 'Stakeholder Sign-offs',        target_date: '2026-03-01', actual_date: null,         status: 'in_progress',  gate: 'G0',     owner: 'James Morgan' },
  { id: 'm5', name: 'Board Approval to Proceed',   target_date: '2026-03-31', actual_date: null,         status: 'pending',      gate: 'G0',     owner: 'H.E. Al-Rashidi' },
  { id: 'm6', name: 'G0 Gate Closed — Enter G1',   target_date: '2026-04-01', actual_date: null,         status: 'pending',      gate: 'G0→G1',  owner: 'James Morgan' },
]

const MOCK_SCREENING: OpportunityScreen[] = [
  { id: 's1', criterion: 'Minimum project size ≥ 100MW',           category: 'Strategic',   result: 'pass',        score: 10, max_score: 10, notes: '400MWp — well above threshold' },
  { id: 's2', criterion: 'GridMind target market (MENA, SE Asia)',  category: 'Strategic',   result: 'pass',        score: 10, max_score: 10, notes: 'KSA core market — NEOM anchor client' },
  { id: 's3', criterion: 'Minimum equity IRR target ≥ 10%',        category: 'Financial',   result: 'pass',        score: 10, max_score: 10, notes: 'Base case 12.4% — above 10% hurdle' },
  { id: 's4', criterion: 'Bankable PPA / revenue certainty',        category: 'Financial',   result: 'conditional', score: 7,  max_score: 10, notes: 'MOU signed; full PPA execution pending' },
  { id: 's5', criterion: 'No fatal ESG / environmental flags',      category: 'ESG',         result: 'pass',        score: 10, max_score: 10, notes: 'Category B per IFC PS — no Category A' },
  { id: 's6', criterion: 'Land availability confirmed',             category: 'Technical',   result: 'pass',        score: 10, max_score: 10, notes: 'NEOM land lease letter executed' },
  { id: 's7', criterion: 'Grid connection technically feasible',    category: 'Technical',   result: 'pass',        score: 8,  max_score: 10, notes: 'Capacity confirmed; distance within tolerance' },
  { id: 's8', criterion: 'Offtake creditworthiness (≥ BB)',        category: 'Financial',   result: 'pass',        score: 10, max_score: 10, notes: 'NEOM Company — sovereign-backed entity' },
  { id: 's9', criterion: 'Regulatory / permitting pathway clear',   category: 'Regulatory',  result: 'conditional', score: 6,  max_score: 10, notes: 'MOMRA EIA timeline uncertain — risk flagged' },
  { id: 's10', criterion: 'GridMind strategic fit & capability',    category: 'Strategic',   result: 'pass',        score: 10, max_score: 10, notes: 'Fits 5-year growth plan; team capacity available' },
]

export const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:        { label: 'Draft',        color: '#6b7280' },
  under_review: { label: 'Under Review', color: '#f59e0b' },
  approved:     { label: 'Approved',     color: '#22c55e' },
  rejected:     { label: 'Rejected',     color: '#ef4444' },
}

/** Safe accessor — returns a neutral fallback for unknown keys. */
export function getStatusMeta(status: string) {
  return STATUS_META[status] ?? {
    label: status ? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown',
    color: '#94a3b8',
  }
}

export const DELIVERABLE_STATUS_META = {
  not_started: { label: 'Not Started', color: '#6b7280' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  complete:    { label: 'Complete',    color: '#f59e0b' },
  approved:    { label: 'Approved',    color: '#22c55e' },
} as const

export const RISK_META = {
  low:      { label: 'Low',      color: '#22c55e' },
  medium:   { label: 'Medium',   color: '#f59e0b' },
  high:     { label: 'High',     color: '#f97316' },
  critical: { label: 'Critical', color: '#ef4444' },
} as const

export const MILESTONE_META = {
  pending:     { label: 'Pending',     color: '#6b7280' },
  in_progress: { label: 'In Progress', color: '#3b82f6' },
  complete:    { label: 'Complete',    color: '#22c55e' },
  at_risk:     { label: 'At Risk',     color: '#ef4444' },
} as const
