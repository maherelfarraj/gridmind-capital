import React from 'react'
import {
  AlertOctagon, Flame, ArrowUp, ArrowDown, CheckCircle, PauseCircle,
  XOctagon, Clock, Loader2, Eye, XCircle, AlertTriangle, RefreshCw,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Milestone  { id: string; name: string; date: string; status: string }
export interface IssueItem  { id: string; title: string; priority: string; status: string; owner: string }
export interface DocItem    { id: string; name: string; type: string; status: string; date: string }

export interface WorkPackage {
  id: string; code: string; wbs_code: string; title: string; description: string
  discipline: string; status: string; priority: string; progress_percent: number
  planned_hours: number; actual_hours: number; budget_amount: number; actual_cost: number
  start_date: string; end_date: string; team_size: number
  milestones: Milestone[]; issues: IssueItem[]; documents: DocItem[]
}

export interface HSEPlanItem   { id: string; name: string; status: string; date: string; detail?: string }
export interface Incident      { id: string; date: string; type: string; severity: string; description: string; person: string; status: string }

export interface Permit {
  id: string; code: string; type: string; authority: string; status: string
  application_date: string; issue_date: string | null; expiry_date: string | null
  renewal_required: boolean; documents: string
}

export interface SiteReadinessItem {
  id: string; category: string; description: string
  responsible: string; due_date: string; status: string
}

export interface Personnel     { id: string; name: string; role: string; company: string; start_date: string; induction_date: string; status: string }
export interface Equipment     { id: string; equipment_id: string; type: string; model: string; qty: number; location: string; status: string; utilization: number }
export interface Material      { id: string; item: string; description: string; ordered: number; received: number; installed: number; unit: string; delivery_date: string; status: string }
export interface Subcontractor { id: string; company: string; scope: string; value: number; start_date: string; personnel: number; status: string; performance: number }
export interface DisciplineProgress { discipline: string; weight: number; planned: number; actual: number }

// ─── Meta / lookup constants ─────────────────────────────────────────────────

export const PRIORITY_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Critical: { label: 'Critical', color: 'bg-red-100 text-red-700',        icon: <AlertOctagon className="size-3" /> },
  High:     { label: 'High',     color: 'bg-orange-100 text-orange-700',  icon: <Flame       className="size-3" /> },
  Medium:   { label: 'Medium',   color: 'bg-amber-100 text-amber-700',    icon: <ArrowUp     className="size-3" /> },
  Low:      { label: 'Low',      color: 'bg-green-100 text-green-700',    icon: <ArrowDown   className="size-3" /> },
}

export const STATUS_META: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  'Not Started': { label: 'Not Started', color: 'bg-slate-100 text-slate-700' },
  'In Progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-700',   icon: <Loader2     className="size-3 animate-spin" /> },
  'Complete':    { label: 'Complete',    color: 'bg-green-100 text-green-700', icon: <CheckCircle className="size-3" /> },
  'On Hold':     { label: 'On Hold',     color: 'bg-amber-100 text-amber-700', icon: <PauseCircle className="size-3" /> },
  'Blocked':     { label: 'Blocked',     color: 'bg-red-100 text-red-700',     icon: <XOctagon    className="size-3" /> },
}

export const PERMIT_STATUS_META: Record<string, { color: string; icon: React.ReactNode }> = {
  'Approved':          { color: 'bg-green-100 text-green-700',   icon: <CheckCircle   className="size-3" /> },
  'Pending':           { color: 'bg-amber-100 text-amber-700',   icon: <Clock         className="size-3" /> },
  'Under Review':      { color: 'bg-blue-100 text-blue-700',     icon: <Eye           className="size-3" /> },
  'Rejected':          { color: 'bg-red-100 text-red-700',       icon: <XCircle       className="size-3" /> },
  'Expired':           { color: 'bg-red-200 text-red-800',       icon: <AlertTriangle className="size-3" /> },
  'Renewal Required':  { color: 'bg-orange-100 text-orange-700', icon: <RefreshCw     className="size-3" /> },
  'Not Started':       { color: 'bg-slate-100 text-slate-700',   icon: <Clock         className="size-3" /> },
}

export const INCIDENT_SEVERITY: Record<string, string> = {
  Fatal:      'bg-black text-white',
  Major:      'bg-red-100 text-red-800',
  Serious:    'bg-orange-100 text-orange-700',
  Minor:      'bg-amber-100 text-amber-700',
  'Near Miss':'bg-sky-100 text-sky-700',
}

export const INCIDENT_STATUS: Record<string, string> = {
  Open:                  'bg-red-100 text-red-700',
  'Under Investigation': 'bg-amber-100 text-amber-700',
  Closed:                'bg-green-100 text-green-700',
  Referred:              'bg-blue-100 text-blue-700',
}

// ─── Mock data ───────────────────────────────────────────────────────────────

export const MOCK_WORK_PACKAGES: WorkPackage[] = [
  {
    id: 'wp1', code: 'WP-001', wbs_code: '1.3.1', title: 'Site Preparation & Earthworks',
    description: 'Full site clearing, grading, cut-and-fill to design levels, erosion control.',
    discipline: 'Civil', status: 'In Progress', priority: 'Critical',
    progress_percent: 65, planned_hours: 2800, actual_hours: 1240,
    budget_amount: 1200000, actual_cost: 450000,
    start_date: 'Jan 15, 2026', end_date: 'Jun 30, 2026', team_size: 8,
    milestones: [
      { id: 'm1', name: 'Site clearing complete', date: 'Feb 28', status: 'Complete' },
      { id: 'm2', name: 'Grading Phase 1',        date: 'Mar 31', status: 'In Progress' },
      { id: 'm3', name: 'Final earthworks',       date: 'Jun 30', status: 'Not Started' },
    ],
    issues: [
      { id: 'i1', title: 'Unexpected rock layer at -2.5m depth', priority: 'High', status: 'Open', owner: 'Ahmed Al-Rashid' },
    ],
    documents: [
      { id: 'd1', name: 'Earthworks Method Statement', type: 'Method Statement', status: 'Approved', date: 'Jan 12' },
      { id: 'd2', name: 'Site Grading Plan Rev B',     type: 'Drawing',          status: 'IFC',      date: 'Jan 20' },
    ],
  },
  {
    id: 'wp2', code: 'WP-002', wbs_code: '1.3.2', title: 'Foundation Works',
    description: 'Pile foundation installation and pile cap construction for tracker structures.',
    discipline: 'Structural', status: 'In Progress', priority: 'High',
    progress_percent: 40, planned_hours: 2200, actual_hours: 890,
    budget_amount: 800000, actual_cost: 320000,
    start_date: 'Feb 1, 2026', end_date: 'Jul 15, 2026', team_size: 6,
    milestones: [
      { id: 'm4', name: 'Piling complete Sector A', date: 'Apr 15', status: 'In Progress' },
      { id: 'm5', name: 'Piling complete Sector B', date: 'Jun 1',  status: 'Not Started' },
    ],
    issues: [],
    documents: [
      { id: 'd3', name: 'Foundation Design Calcs', type: 'Calculation', status: 'Approved', date: 'Jan 28' },
    ],
  },
  {
    id: 'wp3', code: 'WP-003', wbs_code: '1.4.1', title: 'Turbine Installation',
    description: 'Delivery, assembly and erection of all turbine/inverter packages on foundations.',
    discipline: 'Mechanical', status: 'Not Started', priority: 'Critical',
    progress_percent: 0, planned_hours: 3500, actual_hours: 0,
    budget_amount: 2100000, actual_cost: 0,
    start_date: 'Mar 15, 2026', end_date: 'Sep 30, 2026', team_size: 0,
    milestones: [
      { id: 'm6', name: 'Equipment delivery',    date: 'Mar 15', status: 'Not Started' },
      { id: 'm7', name: 'Installation complete', date: 'Sep 30', status: 'Not Started' },
    ],
    issues: [], documents: [],
  },
  {
    id: 'wp4', code: 'WP-004', wbs_code: '1.4.2', title: 'Electrical Infrastructure',
    description: 'MV/LV cabling, transformer installations, HV switchgear, earthing & bonding.',
    discipline: 'Electrical', status: 'Not Started', priority: 'High',
    progress_percent: 0, planned_hours: 2800, actual_hours: 0,
    budget_amount: 1500000, actual_cost: 0,
    start_date: 'Apr 1, 2026', end_date: 'Aug 31, 2026', team_size: 0,
    milestones: [{ id: 'm8', name: 'Cable pulling Phase 1', date: 'May 31', status: 'Not Started' }],
    issues: [], documents: [],
  },
  {
    id: 'wp5', code: 'WP-005', wbs_code: '1.4.3', title: 'Control System Installation',
    description: 'SCADA, RTU installation, communications network, HMI configuration.',
    discipline: 'Instrumentation', status: 'On Hold', priority: 'Medium',
    progress_percent: 15, planned_hours: 1800, actual_hours: 340,
    budget_amount: 650000, actual_cost: 120000,
    start_date: 'Feb 15, 2026', end_date: 'Jun 15, 2026', team_size: 4,
    milestones: [],
    issues: [{ id: 'i2', title: 'SCADA vendor drawing approval delayed 3 weeks', priority: 'Medium', status: 'Open', owner: 'Sara Khalid' }],
    documents: [{ id: 'd4', name: 'SCADA Architecture Rev A', type: 'Drawing', status: 'Under Review', date: 'Feb 10' }],
  },
  {
    id: 'wp6', code: 'WP-006', wbs_code: '1.3.3', title: 'Piping & Utilities',
    description: 'Cooling water, compressed air, firefighting, and drainage piping systems.',
    discipline: 'Piping', status: 'In Progress', priority: 'Medium',
    progress_percent: 25, planned_hours: 2000, actual_hours: 560,
    budget_amount: 720000, actual_cost: 180000,
    start_date: 'Mar 1, 2026', end_date: 'Jul 31, 2026', team_size: 5,
    milestones: [{ id: 'm9', name: 'Main header installation', date: 'May 15', status: 'In Progress' }],
    issues: [], documents: [],
  },
  {
    id: 'wp7', code: 'WP-007', wbs_code: '1.4.4', title: 'HVAC Systems',
    description: 'Ventilation, cooling and air conditioning for all electrical rooms and offices.',
    discipline: 'Mechanical', status: 'Not Started', priority: 'Low',
    progress_percent: 0, planned_hours: 800, actual_hours: 0,
    budget_amount: 280000, actual_cost: 0,
    start_date: 'May 1, 2026', end_date: 'Aug 15, 2026', team_size: 0,
    milestones: [], issues: [], documents: [],
  },
  {
    id: 'wp8', code: 'WP-008', wbs_code: '1.5.1', title: 'Commissioning Prep',
    description: 'Pre-commissioning checks, system flushing, instrument loop tests.',
    discipline: 'Commissioning', status: 'Not Started', priority: 'Medium',
    progress_percent: 0, planned_hours: 1200, actual_hours: 0,
    budget_amount: 480000, actual_cost: 0,
    start_date: 'Aug 1, 2026', end_date: 'Nov 30, 2026', team_size: 0,
    milestones: [], issues: [], documents: [],
  },
]

export const MOCK_HSE_PLAN: HSEPlanItem[] = [
  { id: 'h1',  name: 'HSE Management Plan',      status: 'Complete',    date: 'Jan 15' },
  { id: 'h2',  name: 'Risk Assessment Register', status: 'Complete',    date: 'Jan 20' },
  { id: 'h3',  name: 'Method Statements',        status: 'In Progress', date: 'Feb 28', detail: '15 of 24 complete' },
  { id: 'h4',  name: 'COSHH Assessments',        status: 'Complete',    date: 'Feb 1'  },
  { id: 'h5',  name: 'Emergency Response Plan',  status: 'Complete',    date: 'Jan 25' },
  { id: 'h6',  name: 'Fire Safety Plan',         status: 'In Progress', date: 'Feb 15' },
  { id: 'h7',  name: 'Environmental Mgmt Plan',  status: 'Complete',    date: 'Feb 10' },
  { id: 'h8',  name: 'Waste Management Plan',    status: 'Not Started', date: 'Mar 1'  },
  { id: 'h9',  name: 'Traffic Management Plan',  status: 'Complete',    date: 'Feb 5'  },
  { id: 'h10', name: 'First Aid Arrangements',   status: 'Complete',    date: 'Jan 18' },
]

export const MOCK_INCIDENTS: Incident[] = [
  { id: 'inc1', date: 'Jan 20', type: 'Near Miss',       severity: 'Minor',   description: 'Worker slipped on wet surface, no injury', person: 'John Smith',  status: 'Closed' },
  { id: 'inc2', date: 'Feb 5',  type: 'Property Damage', severity: 'Minor',   description: 'Scaffolding board damaged during lift',    person: 'Equipment',   status: 'Closed' },
  { id: 'inc3', date: 'Feb 12', type: 'Near Miss',       severity: 'Serious', description: 'Crane load swing near personnel',          person: 'Mike Jones',  status: 'Under Investigation' },
  { id: 'inc4', date: 'Feb 18', type: 'Environmental',   severity: 'Minor',   description: 'Oil spill from equipment, contained',      person: 'Environment', status: 'Closed' },
  { id: 'inc5', date: 'Mar 1',  type: 'Injury',          severity: 'Minor',   description: 'Cut hand during material handling',        person: 'Tom Wilson',  status: 'Open' },
]

export const MOCK_PERMITS: Permit[] = [
  { id: 'p1',  code: 'PER-001', type: 'Building Permit',         authority: 'Abu Dhabi DoM', status: 'Approved',     application_date: 'Dec 1, 2025',  issue_date: 'Jan 10, 2026',  expiry_date: 'Jan 10, 2028',  renewal_required: false, documents: 'Building plans, structural calcs' },
  { id: 'p2',  code: 'PER-002', type: 'Environmental Permit',    authority: 'EAD',           status: 'Approved',     application_date: 'Nov 15, 2025', issue_date: 'Dec 20, 2025',  expiry_date: 'Dec 20, 2027',  renewal_required: false, documents: 'EIA, EMP' },
  { id: 'p3',  code: 'PER-003', type: 'Work Permit',             authority: 'ADNOC',         status: 'Approved',     application_date: 'Jan 5, 2026',  issue_date: 'Jan 12, 2026',  expiry_date: 'Jan 12, 2027',  renewal_required: true,  documents: 'Safety plan, insurance' },
  { id: 'p4',  code: 'PER-004', type: 'Road Closure',            authority: 'DOT',           status: 'Pending',      application_date: 'Feb 1, 2026',  issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Traffic plan, diversion' },
  { id: 'p5',  code: 'PER-005', type: 'Crane License',           authority: 'DoM',           status: 'Approved',     application_date: 'Jan 15, 2026', issue_date: 'Jan 25, 2026',  expiry_date: 'Jan 25, 2027',  renewal_required: true,  documents: 'Crane specs, operator certs' },
  { id: 'p6',  code: 'PER-006', type: 'Excavation Permit',       authority: 'DoM',           status: 'Under Review', application_date: 'Feb 10, 2026', issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Utility plans, method statement' },
  { id: 'p7',  code: 'PER-007', type: 'Hot Work Permit',         authority: 'Fire Dept',     status: 'Approved',     application_date: 'Feb 15, 2026', issue_date: 'Feb 16, 2026',  expiry_date: 'Feb 23, 2026',  renewal_required: true,  documents: 'Fire watch plan, extinguishers' },
  { id: 'p8',  code: 'PER-008', type: 'Electrical Permit',       authority: 'AADC',          status: 'Pending',      application_date: 'Feb 20, 2026', issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Electrical plans, load calc' },
  { id: 'p9',  code: 'PER-009', type: 'Fire Safety Certificate', authority: 'Civil Defense', status: 'Not Started',  application_date: '—',           issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Fire detection, suppression' },
  { id: 'p10', code: 'PER-010', type: 'Water Discharge',         authority: 'EAD',           status: 'Approved',     application_date: 'Jan 20, 2026', issue_date: 'Feb 1, 2026',   expiry_date: 'Feb 1, 2027',   renewal_required: true,  documents: 'Water quality, treatment' },
  { id: 'p11', code: 'PER-011', type: 'Air Emissions',           authority: 'EAD',           status: 'Under Review', application_date: 'Feb 5, 2026',  issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Emission modeling, monitoring' },
  { id: 'p12', code: 'PER-012', type: 'Waste Handling',          authority: 'Tadweer',       status: 'Approved',     application_date: 'Jan 25, 2026', issue_date: 'Feb 5, 2026',   expiry_date: 'Feb 5, 2027',   renewal_required: true,  documents: 'Waste plan, contractor' },
]

export const SITE_READINESS_ITEMS: SiteReadinessItem[] = [
  { id: 'sr1',  category: 'Site Access',          description: 'Site fencing installed',            responsible: 'Civil',       due_date: 'Jan 10', status: 'Complete'    },
  { id: 'sr2',  category: 'Site Access',          description: 'Access road constructed',           responsible: 'Civil',       due_date: 'Jan 15', status: 'Complete'    },
  { id: 'sr3',  category: 'Site Access',          description: 'Security gatehouse erected',        responsible: 'Facilities',  due_date: 'Jan 18', status: 'Complete'    },
  { id: 'sr4',  category: 'Site Access',          description: 'Signage & lighting installed',      responsible: 'Electrical',  due_date: 'Jan 22', status: 'Complete'    },
  { id: 'sr5',  category: 'Site Access',          description: 'Vehicle inspection bay',            responsible: 'Civil',       due_date: 'Jan 25', status: 'Complete'    },
  { id: 'sr6',  category: 'Utilities',            description: 'Temporary power supply',            responsible: 'Electrical',  due_date: 'Jan 25', status: 'Complete'    },
  { id: 'sr7',  category: 'Utilities',            description: 'Water supply connected',            responsible: 'Mechanical',  due_date: 'Feb 15', status: 'In Progress' },
  { id: 'sr8',  category: 'Utilities',            description: 'Drainage & sewage',                 responsible: 'Civil',       due_date: 'Feb 20', status: 'In Progress' },
  { id: 'sr9',  category: 'Utilities',            description: 'Fuel storage installed',            responsible: 'Mechanical',  due_date: 'Feb 5',  status: 'Complete'    },
  { id: 'sr10', category: 'Temporary Facilities', description: 'Site offices erected',              responsible: 'Facilities',  due_date: 'Jan 20', status: 'Complete'    },
  { id: 'sr11', category: 'Temporary Facilities', description: 'Welfare facilities ready',          responsible: 'HSE',         due_date: 'Jan 25', status: 'Complete'    },
  { id: 'sr12', category: 'Temporary Facilities', description: 'Material laydown area',             responsible: 'Logistics',   due_date: 'Mar 1',  status: 'Not Started' },
  { id: 'sr13', category: 'Temporary Facilities', description: 'Crane pad constructed',             responsible: 'Civil',       due_date: 'Feb 10', status: 'Complete'    },
  { id: 'sr14', category: 'Temporary Facilities', description: 'Waste segregation area',            responsible: 'HSE',         due_date: 'Feb 20', status: 'In Progress' },
  { id: 'sr15', category: 'Temporary Facilities', description: 'Covered storage shed',              responsible: 'Facilities',  due_date: 'Feb 25', status: 'In Progress' },
  { id: 'sr16', category: 'Temporary Facilities', description: 'Hazmat storage compound',           responsible: 'HSE',         due_date: 'Mar 5',  status: 'Not Started' },
  { id: 'sr17', category: 'Security',             description: 'CCTV cameras active',               responsible: 'Security',    due_date: 'Feb 1',  status: 'Complete'    },
  { id: 'sr18', category: 'Security',             description: 'Access control system',             responsible: 'IT',          due_date: 'Feb 1',  status: 'Complete'    },
  { id: 'sr19', category: 'Security',             description: 'Security patrol schedule',          responsible: 'Security',    due_date: 'Jan 28', status: 'Complete'    },
  { id: 'sr20', category: 'Security',             description: 'Visitor management system',         responsible: 'Admin',       due_date: 'Feb 5',  status: 'Complete'    },
  { id: 'sr21', category: 'Environmental',        description: 'Environmental monitoring stations', responsible: 'HSE',         due_date: 'Feb 10', status: 'Complete'    },
  { id: 'sr22', category: 'Environmental',        description: 'Dust suppression system',           responsible: 'HSE',         due_date: 'Feb 15', status: 'Complete'    },
  { id: 'sr23', category: 'Environmental',        description: 'Noise barrier installation',        responsible: 'Civil',       due_date: 'Feb 28', status: 'In Progress' },
  { id: 'sr24', category: 'Environmental',        description: 'Oil interceptors installed',        responsible: 'Mechanical',  due_date: 'Feb 20', status: 'Complete'    },
  { id: 'sr25', category: 'Environmental',        description: 'Bund walls for fuel storage',       responsible: 'Civil',       due_date: 'Feb 5',  status: 'Complete'    },
  { id: 'sr26', category: 'Communications',       description: 'Telecom / LAN installed',           responsible: 'IT',          due_date: 'Jan 30', status: 'Complete'    },
  { id: 'sr27', category: 'Communications',       description: 'Site radio network',                responsible: 'IT',          due_date: 'Feb 1',  status: 'Complete'    },
  { id: 'sr28', category: 'Communications',       description: 'Emergency PA system',               responsible: 'IT',          due_date: 'Feb 5',  status: 'Complete'    },
  { id: 'sr29', category: 'Logistics',            description: 'Delivery scheduling system',        responsible: 'Logistics',   due_date: 'Feb 15', status: 'Complete'    },
  { id: 'sr30', category: 'Logistics',            description: 'Heavy lift plan approved',          responsible: 'Engineering', due_date: 'Mar 1',  status: 'Not Started' },
  { id: 'sr31', category: 'Logistics',            description: 'Abnormal load route survey',        responsible: 'Logistics',   due_date: 'Mar 10', status: 'Not Started' },
  { id: 'sr32', category: 'Logistics',            description: 'Customs clearance agent engaged',   responsible: 'Procurement', due_date: 'Feb 1',  status: 'Complete'    },
  { id: 'sr33', category: 'Medical',              description: 'First aid station ready',           responsible: 'HSE',         due_date: 'Jan 28', status: 'Complete'    },
  { id: 'sr34', category: 'Medical',              description: 'Ambulance standby arrangement',     responsible: 'HSE',         due_date: 'Jan 30', status: 'Complete'    },
  { id: 'sr35', category: 'Medical',              description: 'Hospital MOU in place',             responsible: 'HSE',         due_date: 'Jan 20', status: 'Complete'    },
]

export const MOCK_PERSONNEL: Personnel[] = [
  { id: 'per1', name: 'Ahmed Al-Rashid',  role: 'Construction Manager',  company: 'GridMind EPC', start_date: 'Jan 5',  induction_date: 'Jan 5',  status: 'Active' },
  { id: 'per2', name: 'Sarah Johnson',    role: 'HSE Manager',            company: 'GridMind EPC', start_date: 'Jan 10', induction_date: 'Jan 10', status: 'Active' },
  { id: 'per3', name: 'Carlos Rivera',    role: 'Site Engineer — Civil',  company: 'GridMind EPC', start_date: 'Jan 15', induction_date: 'Jan 15', status: 'Active' },
  { id: 'per4', name: 'Li Wei',           role: 'Structural Lead',        company: 'Jinko Const.', start_date: 'Feb 1',  induction_date: 'Feb 1',  status: 'Active' },
  { id: 'per5', name: 'Mohammed Hassan',  role: 'Electrical Supervisor',  company: 'ABB On-Site',  start_date: 'Feb 10', induction_date: 'Feb 12', status: 'Induction Pending' },
  { id: 'per6', name: 'Priya Nair',       role: 'Instrumentation Eng.',   company: 'GridMind EPC', start_date: 'Feb 15', induction_date: 'Feb 15', status: 'Active' },
  { id: 'per7', name: 'Tom Wilson',       role: 'Piping Supervisor',      company: 'Al Futtaim',   start_date: 'Mar 1',  induction_date: '—',      status: 'Induction Pending' },
  { id: 'per8', name: 'Yuki Tanaka',      role: 'QC Inspector',           company: 'GridMind EPC', start_date: 'Jan 20', induction_date: 'Jan 20', status: 'Active' },
]

export const MOCK_EQUIPMENT: Equipment[] = [
  { id: 'eq1', equipment_id: 'EQ-001', type: 'Excavator',          model: 'CAT 390F',          qty: 3, location: 'Zone A',  status: 'In Use',      utilization: 85 },
  { id: 'eq2', equipment_id: 'EQ-002', type: 'Tower Crane',        model: 'Liebherr 280',      qty: 1, location: 'Central', status: 'In Use',      utilization: 70 },
  { id: 'eq3', equipment_id: 'EQ-003', type: 'Piling Rig',         model: 'BAUER BG 28',       qty: 2, location: 'Zone B',  status: 'In Use',      utilization: 90 },
  { id: 'eq4', equipment_id: 'EQ-004', type: 'Concrete Pump',      model: 'Putzmeister M52',   qty: 1, location: 'Zone A',  status: 'Available',   utilization: 0  },
  { id: 'eq5', equipment_id: 'EQ-005', type: 'Compactor',          model: 'BOMAG BW 213',      qty: 4, location: 'Zone C',  status: 'In Use',      utilization: 60 },
  { id: 'eq6', equipment_id: 'EQ-006', type: 'Articulated Truck',  model: 'Volvo A40G',        qty: 6, location: 'Zone A',  status: 'In Use',      utilization: 75 },
  { id: 'eq7', equipment_id: 'EQ-007', type: 'Telescopic Handler', model: 'JLG 1255',          qty: 2, location: 'Yard',    status: 'Maintenance', utilization: 0  },
]

export const MOCK_MATERIALS: Material[] = [
  { id: 'mat1', item: 'Structural Steel',    description: 'S355 sections — tracker structure', ordered: 850,   received: 320,   installed: 180,  unit: 'tonnes', delivery_date: 'Apr 15',   status: 'On Order' },
  { id: 'mat2', item: 'Concrete (RMC)',      description: '35 MPa pile caps & foundations',    ordered: 4200,  received: 1800,  installed: 1600, unit: 'm³',     delivery_date: 'Ongoing',  status: 'In Stock' },
  { id: 'mat3', item: 'Piling Casing',       description: '600mm driven steel piles',          ordered: 2400,  received: 2400,  installed: 960,  unit: 'lm',     delivery_date: 'Received', status: 'In Stock' },
  { id: 'mat4', item: 'MV Cable 33kV',       description: 'XLPE armoured 3-core 300mm²',      ordered: 42,    received: 0,     installed: 0,    unit: 'km',     delivery_date: 'May 30',   status: 'On Order' },
  { id: 'mat5', item: 'Piping Carbon Steel', description: 'A106 Gr.B, 2" – 12"',              ordered: 6500,  received: 1200,  installed: 400,  unit: 'm',      delivery_date: 'Ongoing',  status: 'In Stock' },
  { id: 'mat6', item: 'Gravel Backfill',     description: 'Compacted granular sub-base',       ordered: 18000, received: 12000, installed: 9000, unit: 'tonnes', delivery_date: 'Ongoing',  status: 'In Stock' },
]

export const MOCK_SUBCONTRACTORS: Subcontractor[] = [
  { id: 'sub1', company: 'Al Futtaim Carillion', scope: 'Civil & Earthworks',      value: 38000000, start_date: 'Jan 15', personnel: 45, status: 'Active',     performance: 4 },
  { id: 'sub2', company: 'Jinko Construction',   scope: 'Structural Steel',        value: 12500000, start_date: 'Feb 1',  personnel: 22, status: 'Active',     performance: 5 },
  { id: 'sub3', company: 'ABB On-Site Services', scope: 'Electrical Installation', value: 8750000,  start_date: 'Apr 1',  personnel: 0,  status: 'Mobilising', performance: 0 },
  { id: 'sub4', company: 'Prysmian Install Co.', scope: 'Cabling & Terminations',  value: 4200000,  start_date: 'Apr 15', personnel: 0,  status: 'Mobilising', performance: 0 },
]

export const S_CURVE_DATA = [
  { month: 'Jan', planned: 2,   actual: 1.5  },
  { month: 'Feb', planned: 6,   actual: 5.2  },
  { month: 'Mar', planned: 12,  actual: 10.1 },
  { month: 'Apr', planned: 20,  actual: 18.0 },
  { month: 'May', planned: 30,  actual: null },
  { month: 'Jun', planned: 42,  actual: null },
  { month: 'Jul', planned: 55,  actual: null },
  { month: 'Aug', planned: 68,  actual: null },
  { month: 'Sep', planned: 80,  actual: null },
  { month: 'Oct', planned: 90,  actual: null },
  { month: 'Nov', planned: 96,  actual: null },
  { month: 'Dec', planned: 100, actual: null },
]

export const EV_DATA = [
  { month: 'Jan', bcws: 1800000,  bcwp: 1350000, acwp: 1420000 },
  { month: 'Feb', bcws: 5400000,  bcwp: 4680000, acwp: 4850000 },
  { month: 'Mar', bcws: 10800000, bcwp: 9090000,  acwp: 9500000 },
  { month: 'Apr', bcws: 18000000, bcwp: null,      acwp: null    },
]

export const DISCIPLINE_PROGRESS: DisciplineProgress[] = [
  { discipline: 'Civil',           weight: 30, planned: 40, actual: 35 },
  { discipline: 'Structural',      weight: 20, planned: 18, actual: 15 },
  { discipline: 'Mechanical',      weight: 20, planned: 8,  actual: 5  },
  { discipline: 'Electrical',      weight: 15, planned: 5,  actual: 2  },
  { discipline: 'Instrumentation', weight: 10, planned: 2,  actual: 0  },
  { discipline: 'Commissioning',   weight: 5,  planned: 0,  actual: 0  },
]
