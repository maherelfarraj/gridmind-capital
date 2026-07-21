'use client'

import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronRight, Plus, AlertTriangle, FileText, Camera, HardHat, TrendingUp,
  FileCheck, ShieldCheck, AlertOctagon, Flame, ArrowUp, ArrowDown,
  CheckCircle, PauseCircle, XOctagon, Clock, DollarSign, Users, X,
  Truck, Package, Building, ClipboardList, ClipboardCheck, GraduationCap,
  RefreshCw, Eye, XCircle, Loader2, ChevronDown, ChevronUp, Search,
  MapPin, Wrench, UserCheck, BarChart3,
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'
import { cn } from '@/lib/utils'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Milestone { id: string; name: string; date: string; status: string }
interface IssueItem  { id: string; title: string; priority: string; status: string; owner: string }
interface DocItem    { id: string; name: string; type: string; status: string; date: string }

interface WorkPackage {
  id: string; code: string; wbs_code: string; title: string; description: string
  discipline: string; status: string; priority: string; progress_percent: number
  planned_hours: number; actual_hours: number; budget_amount: number; actual_cost: number
  start_date: string; end_date: string; team_size: number
  milestones: Milestone[]; issues: IssueItem[]; documents: DocItem[]
}

interface HSEPlanItem  { id: string; name: string; status: string; date: string; detail?: string }
interface Incident     { id: string; date: string; type: string; severity: string; description: string; person: string; status: string }

interface Permit {
  id: string; code: string; type: string; authority: string; status: string
  application_date: string; issue_date: string | null; expiry_date: string | null
  renewal_required: boolean; documents: string
}

interface SiteReadinessItem {
  id: string; category: string; description: string
  responsible: string; due_date: string; status: string
}

interface Personnel    { id: string; name: string; role: string; company: string; start_date: string; induction_date: string; status: string }
interface Equipment    { id: string; equipment_id: string; type: string; model: string; qty: number; location: string; status: string; utilization: number }
interface Material     { id: string; item: string; description: string; ordered: number; received: number; installed: number; unit: string; delivery_date: string; status: string }
interface Subcontractor{ id: string; company: string; scope: string; value: number; start_date: string; personnel: number; status: string; performance: number }

interface DisciplineProgress { discipline: string; weight: number; planned: number; actual: number }
interface ProgressEntry       { date: string; weather: string; activities: string; personnel: number; issues: string }

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_WORK_PACKAGES: WorkPackage[] = [
  {
    id: 'wp1', code: 'WP-001', wbs_code: '1.3.1', title: 'Site Preparation & Earthworks',
    description: 'Full site clearing, grading, cut-and-fill to design levels, erosion control.',
    discipline: 'Civil', status: 'In Progress', priority: 'Critical',
    progress_percent: 65, planned_hours: 2800, actual_hours: 1240,
    budget_amount: 1200000, actual_cost: 450000,
    start_date: 'Jan 15, 2026', end_date: 'Jun 30, 2026', team_size: 8,
    milestones: [
      { id: 'm1', name: 'Site clearing complete', date: 'Feb 28', status: 'Complete' },
      { id: 'm2', name: 'Grading Phase 1', date: 'Mar 31', status: 'In Progress' },
      { id: 'm3', name: 'Final earthworks', date: 'Jun 30', status: 'Not Started' },
    ],
    issues: [
      { id: 'i1', title: 'Unexpected rock layer at -2.5m depth', priority: 'High', status: 'Open', owner: 'Ahmed Al-Rashid' },
    ],
    documents: [
      { id: 'd1', name: 'Earthworks Method Statement', type: 'Method Statement', status: 'Approved', date: 'Jan 12' },
      { id: 'd2', name: 'Site Grading Plan Rev B', type: 'Drawing', status: 'IFC', date: 'Jan 20' },
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
      { id: 'm5', name: 'Piling complete Sector B', date: 'Jun 1', status: 'Not Started' },
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
      { id: 'm6', name: 'Equipment delivery', date: 'Mar 15', status: 'Not Started' },
      { id: 'm7', name: 'Installation complete', date: 'Sep 30', status: 'Not Started' },
    ],
    issues: [],
    documents: [],
  },
  {
    id: 'wp4', code: 'WP-004', wbs_code: '1.4.2', title: 'Electrical Infrastructure',
    description: 'MV/LV cabling, transformer installations, HV switchgear, earthing & bonding.',
    discipline: 'Electrical', status: 'Not Started', priority: 'High',
    progress_percent: 0, planned_hours: 2800, actual_hours: 0,
    budget_amount: 1500000, actual_cost: 0,
    start_date: 'Apr 1, 2026', end_date: 'Aug 31, 2026', team_size: 0,
    milestones: [
      { id: 'm8', name: 'Cable pulling Phase 1', date: 'May 31', status: 'Not Started' },
    ],
    issues: [],
    documents: [],
  },
  {
    id: 'wp5', code: 'WP-005', wbs_code: '1.4.3', title: 'Control System Installation',
    description: 'SCADA, RTU installation, communications network, HMI configuration.',
    discipline: 'Instrumentation', status: 'On Hold', priority: 'Medium',
    progress_percent: 15, planned_hours: 1800, actual_hours: 340,
    budget_amount: 650000, actual_cost: 120000,
    start_date: 'Feb 15, 2026', end_date: 'Jun 15, 2026', team_size: 4,
    milestones: [],
    issues: [
      { id: 'i2', title: 'SCADA vendor drawing approval delayed 3 weeks', priority: 'Medium', status: 'Open', owner: 'Sara Khalid' },
    ],
    documents: [
      { id: 'd4', name: 'SCADA Architecture Rev A', type: 'Drawing', status: 'Under Review', date: 'Feb 10' },
    ],
  },
  {
    id: 'wp6', code: 'WP-006', wbs_code: '1.3.3', title: 'Piping & Utilities',
    description: 'Cooling water, compressed air, firefighting, and drainage piping systems.',
    discipline: 'Piping', status: 'In Progress', priority: 'Medium',
    progress_percent: 25, planned_hours: 2000, actual_hours: 560,
    budget_amount: 720000, actual_cost: 180000,
    start_date: 'Mar 1, 2026', end_date: 'Jul 31, 2026', team_size: 5,
    milestones: [
      { id: 'm9', name: 'Main header installation', date: 'May 15', status: 'In Progress' },
    ],
    issues: [],
    documents: [],
  },
  {
    id: 'wp7', code: 'WP-007', wbs_code: '1.4.4', title: 'HVAC Systems',
    description: 'Ventilation, cooling and air conditioning for all electrical rooms and offices.',
    discipline: 'Mechanical', status: 'Not Started', priority: 'Low',
    progress_percent: 0, planned_hours: 800, actual_hours: 0,
    budget_amount: 280000, actual_cost: 0,
    start_date: 'May 1, 2026', end_date: 'Aug 15, 2026', team_size: 0,
    milestones: [],
    issues: [],
    documents: [],
  },
  {
    id: 'wp8', code: 'WP-008', wbs_code: '1.5.1', title: 'Commissioning Prep',
    description: 'Pre-commissioning checks, system flushing, instrument loop tests.',
    discipline: 'Commissioning', status: 'Not Started', priority: 'Medium',
    progress_percent: 0, planned_hours: 1200, actual_hours: 0,
    budget_amount: 480000, actual_cost: 0,
    start_date: 'Aug 1, 2026', end_date: 'Nov 30, 2026', team_size: 0,
    milestones: [],
    issues: [],
    documents: [],
  },
]

const MOCK_HSE_PLAN: HSEPlanItem[] = [
  { id: 'h1',  name: 'HSE Management Plan',      status: 'Complete',     date: 'Jan 15' },
  { id: 'h2',  name: 'Risk Assessment Register', status: 'Complete',     date: 'Jan 20' },
  { id: 'h3',  name: 'Method Statements',        status: 'In Progress',  date: 'Feb 28', detail: '15 of 24 complete' },
  { id: 'h4',  name: 'COSHH Assessments',        status: 'Complete',     date: 'Feb 1' },
  { id: 'h5',  name: 'Emergency Response Plan',  status: 'Complete',     date: 'Jan 25' },
  { id: 'h6',  name: 'Fire Safety Plan',         status: 'In Progress',  date: 'Feb 15' },
  { id: 'h7',  name: 'Environmental Mgmt Plan',  status: 'Complete',     date: 'Feb 10' },
  { id: 'h8',  name: 'Waste Management Plan',    status: 'Not Started',  date: 'Mar 1' },
  { id: 'h9',  name: 'Traffic Management Plan',  status: 'Complete',     date: 'Feb 5' },
  { id: 'h10', name: 'First Aid Arrangements',   status: 'Complete',     date: 'Jan 18' },
]

const MOCK_INCIDENTS: Incident[] = [
  { id: 'inc1', date: 'Jan 20', type: 'Near Miss',        severity: 'Minor',   description: 'Worker slipped on wet surface, no injury', person: 'John Smith',   status: 'Closed' },
  { id: 'inc2', date: 'Feb 5',  type: 'Property Damage',  severity: 'Minor',   description: 'Scaffolding board damaged during lift',    person: 'Equipment',    status: 'Closed' },
  { id: 'inc3', date: 'Feb 12', type: 'Near Miss',        severity: 'Serious', description: 'Crane load swing near personnel',          person: 'Mike Jones',   status: 'Under Investigation' },
  { id: 'inc4', date: 'Feb 18', type: 'Environmental',    severity: 'Minor',   description: 'Oil spill from equipment, contained',      person: 'Environment',  status: 'Closed' },
  { id: 'inc5', date: 'Mar 1',  type: 'Injury',           severity: 'Minor',   description: 'Cut hand during material handling',        person: 'Tom Wilson',   status: 'Open' },
]

const MOCK_PERMITS: Permit[] = [
  { id: 'p1',  code: 'PER-001', type: 'Building Permit',         authority: 'Abu Dhabi DoM',   status: 'Approved',         application_date: 'Dec 1, 2025',  issue_date: 'Jan 10, 2026',  expiry_date: 'Jan 10, 2028',  renewal_required: false, documents: 'Building plans, structural calcs' },
  { id: 'p2',  code: 'PER-002', type: 'Environmental Permit',    authority: 'EAD',             status: 'Approved',         application_date: 'Nov 15, 2025', issue_date: 'Dec 20, 2025',  expiry_date: 'Dec 20, 2027',  renewal_required: false, documents: 'EIA, EMP' },
  { id: 'p3',  code: 'PER-003', type: 'Work Permit',             authority: 'ADNOC',           status: 'Approved',         application_date: 'Jan 5, 2026',  issue_date: 'Jan 12, 2026',  expiry_date: 'Jan 12, 2027',  renewal_required: true,  documents: 'Safety plan, insurance' },
  { id: 'p4',  code: 'PER-004', type: 'Road Closure',            authority: 'DOT',             status: 'Pending',          application_date: 'Feb 1, 2026',  issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Traffic plan, diversion' },
  { id: 'p5',  code: 'PER-005', type: 'Crane License',           authority: 'DoM',             status: 'Approved',         application_date: 'Jan 15, 2026', issue_date: 'Jan 25, 2026',  expiry_date: 'Jan 25, 2027',  renewal_required: true,  documents: 'Crane specs, operator certs' },
  { id: 'p6',  code: 'PER-006', type: 'Excavation Permit',       authority: 'DoM',             status: 'Under Review',     application_date: 'Feb 10, 2026', issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Utility plans, method statement' },
  { id: 'p7',  code: 'PER-007', type: 'Hot Work Permit',         authority: 'Fire Dept',       status: 'Approved',         application_date: 'Feb 15, 2026', issue_date: 'Feb 16, 2026',  expiry_date: 'Feb 23, 2026',  renewal_required: true,  documents: 'Fire watch plan, extinguishers' },
  { id: 'p8',  code: 'PER-008', type: 'Electrical Permit',       authority: 'AADC',            status: 'Pending',          application_date: 'Feb 20, 2026', issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Electrical plans, load calc' },
  { id: 'p9',  code: 'PER-009', type: 'Fire Safety Certificate', authority: 'Civil Defense',   status: 'Not Started',      application_date: '—',           issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Fire detection, suppression' },
  { id: 'p10', code: 'PER-010', type: 'Water Discharge',         authority: 'EAD',             status: 'Approved',         application_date: 'Jan 20, 2026', issue_date: 'Feb 1, 2026',   expiry_date: 'Feb 1, 2027',   renewal_required: true,  documents: 'Water quality, treatment' },
  { id: 'p11', code: 'PER-011', type: 'Air Emissions',           authority: 'EAD',             status: 'Under Review',     application_date: 'Feb 5, 2026',  issue_date: null,            expiry_date: null,            renewal_required: false, documents: 'Emission modeling, monitoring' },
  { id: 'p12', code: 'PER-012', type: 'Waste Handling',          authority: 'Tadweer',         status: 'Approved',         application_date: 'Jan 25, 2026', issue_date: 'Feb 5, 2026',   expiry_date: 'Feb 5, 2027',   renewal_required: true,  documents: 'Waste plan, contractor' },
]

const SITE_READINESS_ITEMS: SiteReadinessItem[] = [
  { id: 'sr1',  category: 'Site Access',         description: 'Site fencing installed',          responsible: 'Civil',       due_date: 'Jan 10', status: 'Complete'    },
  { id: 'sr2',  category: 'Site Access',         description: 'Access road constructed',         responsible: 'Civil',       due_date: 'Jan 15', status: 'Complete'    },
  { id: 'sr3',  category: 'Site Access',         description: 'Security gatehouse erected',      responsible: 'Facilities',  due_date: 'Jan 18', status: 'Complete'    },
  { id: 'sr4',  category: 'Site Access',         description: 'Signage & lighting installed',    responsible: 'Electrical',  due_date: 'Jan 22', status: 'Complete'    },
  { id: 'sr5',  category: 'Site Access',         description: 'Vehicle inspection bay',          responsible: 'Civil',       due_date: 'Jan 25', status: 'Complete'    },
  { id: 'sr6',  category: 'Utilities',           description: 'Temporary power supply',          responsible: 'Electrical',  due_date: 'Jan 25', status: 'Complete'    },
  { id: 'sr7',  category: 'Utilities',           description: 'Water supply connected',          responsible: 'Mechanical',  due_date: 'Feb 15', status: 'In Progress' },
  { id: 'sr8',  category: 'Utilities',           description: 'Drainage & sewage',               responsible: 'Civil',       due_date: 'Feb 20', status: 'In Progress' },
  { id: 'sr9',  category: 'Utilities',           description: 'Fuel storage installed',          responsible: 'Mechanical',  due_date: 'Feb 5',  status: 'Complete'    },
  { id: 'sr10', category: 'Temporary Facilities',description: 'Site offices erected',            responsible: 'Facilities',  due_date: 'Jan 20', status: 'Complete'    },
  { id: 'sr11', category: 'Temporary Facilities',description: 'Welfare facilities ready',        responsible: 'HSE',         due_date: 'Jan 25', status: 'Complete'    },
  { id: 'sr12', category: 'Temporary Facilities',description: 'Material laydown area',           responsible: 'Logistics',   due_date: 'Mar 1',  status: 'Not Started' },
  { id: 'sr13', category: 'Temporary Facilities',description: 'Crane pad constructed',           responsible: 'Civil',       due_date: 'Feb 10', status: 'Complete'    },
  { id: 'sr14', category: 'Temporary Facilities',description: 'Waste segregation area',          responsible: 'HSE',         due_date: 'Feb 20', status: 'In Progress' },
  { id: 'sr15', category: 'Temporary Facilities',description: 'Covered storage shed',            responsible: 'Facilities',  due_date: 'Feb 25', status: 'In Progress' },
  { id: 'sr16', category: 'Temporary Facilities',description: 'Hazmat storage compound',         responsible: 'HSE',         due_date: 'Mar 5',  status: 'Not Started' },
  { id: 'sr17', category: 'Security',            description: 'CCTV cameras active',             responsible: 'Security',    due_date: 'Feb 1',  status: 'Complete'    },
  { id: 'sr18', category: 'Security',            description: 'Access control system',           responsible: 'IT',          due_date: 'Feb 1',  status: 'Complete'    },
  { id: 'sr19', category: 'Security',            description: 'Security patrol schedule',        responsible: 'Security',    due_date: 'Jan 28', status: 'Complete'    },
  { id: 'sr20', category: 'Security',            description: 'Visitor management system',       responsible: 'Admin',       due_date: 'Feb 5',  status: 'Complete'    },
  { id: 'sr21', category: 'Environmental',       description: 'Environmental monitoring stations',responsible: 'HSE',        due_date: 'Feb 10', status: 'Complete'    },
  { id: 'sr22', category: 'Environmental',       description: 'Dust suppression system',         responsible: 'HSE',         due_date: 'Feb 15', status: 'Complete'    },
  { id: 'sr23', category: 'Environmental',       description: 'Noise barrier installation',      responsible: 'Civil',       due_date: 'Feb 28', status: 'In Progress' },
  { id: 'sr24', category: 'Environmental',       description: 'Oil interceptors installed',      responsible: 'Mechanical',  due_date: 'Feb 20', status: 'Complete'    },
  { id: 'sr25', category: 'Environmental',       description: 'Bund walls for fuel storage',     responsible: 'Civil',       due_date: 'Feb 5',  status: 'Complete'    },
  { id: 'sr26', category: 'Communications',      description: 'Telecom / LAN installed',         responsible: 'IT',          due_date: 'Jan 30', status: 'Complete'    },
  { id: 'sr27', category: 'Communications',      description: 'Site radio network',              responsible: 'IT',          due_date: 'Feb 1',  status: 'Complete'    },
  { id: 'sr28', category: 'Communications',      description: 'Emergency PA system',             responsible: 'IT',          due_date: 'Feb 5',  status: 'Complete'    },
  { id: 'sr29', category: 'Logistics',           description: 'Delivery scheduling system',      responsible: 'Logistics',   due_date: 'Feb 15', status: 'Complete'    },
  { id: 'sr30', category: 'Logistics',           description: 'Heavy lift plan approved',        responsible: 'Engineering', due_date: 'Mar 1',  status: 'Not Started' },
  { id: 'sr31', category: 'Logistics',           description: 'Abnormal load route survey',      responsible: 'Logistics',   due_date: 'Mar 10', status: 'Not Started' },
  { id: 'sr32', category: 'Logistics',           description: 'Customs clearance agent engaged', responsible: 'Procurement', due_date: 'Feb 1',  status: 'Complete'    },
  { id: 'sr33', category: 'Medical',             description: 'First aid station ready',         responsible: 'HSE',         due_date: 'Jan 28', status: 'Complete'    },
  { id: 'sr34', category: 'Medical',             description: 'Ambulance standby arrangement',   responsible: 'HSE',         due_date: 'Jan 30', status: 'Complete'    },
  { id: 'sr35', category: 'Medical',             description: 'Hospital MOU in place',           responsible: 'HSE',         due_date: 'Jan 20', status: 'Complete'    },
]

const MOCK_PERSONNEL: Personnel[] = [
  { id: 'per1', name: 'Ahmed Al-Rashid',  role: 'Construction Manager',  company: 'GridMind EPC',     start_date: 'Jan 5',  induction_date: 'Jan 5',  status: 'Active' },
  { id: 'per2', name: 'Sarah Johnson',   role: 'HSE Manager',            company: 'GridMind EPC',     start_date: 'Jan 10', induction_date: 'Jan 10', status: 'Active' },
  { id: 'per3', name: 'Carlos Rivera',   role: 'Site Engineer — Civil',  company: 'GridMind EPC',     start_date: 'Jan 15', induction_date: 'Jan 15', status: 'Active' },
  { id: 'per4', name: 'Li Wei',          role: 'Structural Lead',        company: 'Jinko Const.',     start_date: 'Feb 1',  induction_date: 'Feb 1',  status: 'Active' },
  { id: 'per5', name: 'Mohammed Hassan', role: 'Electrical Supervisor',  company: 'ABB On-Site',      start_date: 'Feb 10', induction_date: 'Feb 12', status: 'Induction Pending' },
  { id: 'per6', name: 'Priya Nair',      role: 'Instrumentation Eng.',   company: 'GridMind EPC',     start_date: 'Feb 15', induction_date: 'Feb 15', status: 'Active' },
  { id: 'per7', name: 'Tom Wilson',      role: 'Piping Supervisor',      company: 'Al Futtaim',       start_date: 'Mar 1',  induction_date: '—',      status: 'Induction Pending' },
  { id: 'per8', name: 'Yuki Tanaka',     role: 'QC Inspector',           company: 'GridMind EPC',     start_date: 'Jan 20', induction_date: 'Jan 20', status: 'Active' },
]

const MOCK_EQUIPMENT: Equipment[] = [
  { id: 'eq1', equipment_id: 'EQ-001', type: 'Excavator',         model: 'CAT 390F',      qty: 3, location: 'Zone A', status: 'In Use',    utilization: 85 },
  { id: 'eq2', equipment_id: 'EQ-002', type: 'Tower Crane',       model: 'Liebherr 280',  qty: 1, location: 'Central', status: 'In Use',   utilization: 70 },
  { id: 'eq3', equipment_id: 'EQ-003', type: 'Piling Rig',        model: 'BAUER BG 28',   qty: 2, location: 'Zone B', status: 'In Use',    utilization: 90 },
  { id: 'eq4', equipment_id: 'EQ-004', type: 'Concrete Pump',     model: 'Putzmeister M52', qty: 1, location: 'Zone A', status: 'Available', utilization: 0  },
  { id: 'eq5', equipment_id: 'EQ-005', type: 'Compactor',         model: 'BOMAG BW 213',  qty: 4, location: 'Zone C', status: 'In Use',    utilization: 60 },
  { id: 'eq6', equipment_id: 'EQ-006', type: 'Articulated Truck', model: 'Volvo A40G',    qty: 6, location: 'Zone A', status: 'In Use',    utilization: 75 },
  { id: 'eq7', equipment_id: 'EQ-007', type: 'Telescopic Handler',model: 'JLG 1255',      qty: 2, location: 'Yard',   status: 'Maintenance', utilization: 0 },
]

const MOCK_MATERIALS: Material[] = [
  { id: 'mat1', item: 'Structural Steel',  description: 'S355 sections — tracker structure', ordered: 850,  received: 320,  installed: 180, unit: 'tonnes', delivery_date: 'Apr 15', status: 'On Order' },
  { id: 'mat2', item: 'Concrete (RMC)',    description: '35 MPa pile caps & foundations',    ordered: 4200, received: 1800, installed: 1600, unit: 'm³',    delivery_date: 'Ongoing', status: 'In Stock' },
  { id: 'mat3', item: 'Piling Casing',     description: '600mm driven steel piles',          ordered: 2400, received: 2400, installed: 960, unit: 'lm',    delivery_date: 'Received', status: 'In Stock' },
  { id: 'mat4', item: 'MV Cable 33kV',     description: 'XLPE armoured 3-core 300mm²',      ordered: 42,   received: 0,    installed: 0,  unit: 'km',     delivery_date: 'May 30', status: 'On Order' },
  { id: 'mat5', item: 'Piping Carbon Steel', description: 'A106 Gr.B, 2" – 12"',            ordered: 6500, received: 1200, installed: 400, unit: 'm',     delivery_date: 'Ongoing', status: 'In Stock' },
  { id: 'mat6', item: 'Gravel Backfill',   description: 'Compacted granular sub-base',       ordered: 18000,received: 12000,installed: 9000,unit: 'tonnes',delivery_date: 'Ongoing', status: 'In Stock' },
]

const MOCK_SUBCONTRACTORS: Subcontractor[] = [
  { id: 'sub1', company: 'Al Futtaim Carillion', scope: 'Civil & Earthworks',       value: 38000000, start_date: 'Jan 15', personnel: 45, status: 'Active', performance: 4 },
  { id: 'sub2', company: 'Jinko Construction',   scope: 'Structural Steel',         value: 12500000, start_date: 'Feb 1',  personnel: 22, status: 'Active', performance: 5 },
  { id: 'sub3', company: 'ABB On-Site Services', scope: 'Electrical Installation',  value: 8750000,  start_date: 'Apr 1',  personnel: 0,  status: 'Mobilising', performance: 0 },
  { id: 'sub4', company: 'Prysmian Install Co.',  scope: 'Cabling & Terminations',  value: 4200000,  start_date: 'Apr 15', personnel: 0,  status: 'Mobilising', performance: 0 },
]

// ─── S-Curve & EV mock data ──────────────────────────────────────────────────

const S_CURVE_DATA = [
  { month: 'Jan', planned: 2,  actual: 1.5  },
  { month: 'Feb', planned: 6,  actual: 5.2  },
  { month: 'Mar', planned: 12, actual: 10.1 },
  { month: 'Apr', planned: 20, actual: 18.0 },
  { month: 'May', planned: 30, actual: null },
  { month: 'Jun', planned: 42, actual: null },
  { month: 'Jul', planned: 55, actual: null },
  { month: 'Aug', planned: 68, actual: null },
  { month: 'Sep', planned: 80, actual: null },
  { month: 'Oct', planned: 90, actual: null },
  { month: 'Nov', planned: 96, actual: null },
  { month: 'Dec', planned: 100, actual: null },
]

const EV_DATA = [
  { month: 'Jan', bcws: 1800000,  bcwp: 1350000,  acwp: 1420000  },
  { month: 'Feb', bcws: 5400000,  bcwp: 4680000,  acwp: 4850000  },
  { month: 'Mar', bcws: 10800000, bcwp: 9090000,   acwp: 9500000  },
  { month: 'Apr', bcws: 18000000, bcwp: null,       acwp: null     },
]

const DISCIPLINE_PROGRESS: DisciplineProgress[] = [
  { discipline: 'Civil',            weight: 30, planned: 40, actual: 35 },
  { discipline: 'Structural',       weight: 20, planned: 18, actual: 15 },
  { discipline: 'Mechanical',       weight: 20, planned: 8,  actual: 5  },
  { discipline: 'Electrical',       weight: 15, planned: 5,  actual: 2  },
  { discipline: 'Instrumentation',  weight: 10, planned: 2,  actual: 0  },
  { discipline: 'Commissioning',    weight: 5,  planned: 0,  actual: 0  },
]

// ─── Utility helpers ─────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`

// ─── Sub-components ──────────────────────────────────────────────────────────

const PRIORITY_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Critical: { label: 'Critical', color: 'bg-red-100 text-red-700',    icon: <AlertOctagon className="size-3" /> },
  High:     { label: 'High',     color: 'bg-orange-100 text-orange-700', icon: <Flame className="size-3" /> },
  Medium:   { label: 'Medium',   color: 'bg-amber-100 text-amber-700',  icon: <ArrowUp className="size-3" /> },
  Low:      { label: 'Low',      color: 'bg-green-100 text-green-700',  icon: <ArrowDown className="size-3" /> },
}

const STATUS_META: Record<string, { label: string; color: string; icon?: React.ReactNode }> = {
  'Not Started': { label: 'Not Started', color: 'bg-slate-100 text-slate-700' },
  'In Progress': { label: 'In Progress', color: 'bg-blue-100 text-blue-700',   icon: <Loader2 className="size-3 animate-spin" /> },
  'Complete':    { label: 'Complete',    color: 'bg-green-100 text-green-700', icon: <CheckCircle className="size-3" /> },
  'On Hold':     { label: 'On Hold',     color: 'bg-amber-100 text-amber-700', icon: <PauseCircle className="size-3" /> },
  'Blocked':     { label: 'Blocked',     color: 'bg-red-100 text-red-700',     icon: <XOctagon className="size-3" /> },
}

const PERMIT_STATUS_META: Record<string, { color: string; icon: React.ReactNode }> = {
  'Approved':          { color: 'bg-green-100 text-green-700',   icon: <CheckCircle className="size-3" /> },
  'Pending':           { color: 'bg-amber-100 text-amber-700',   icon: <Clock className="size-3" /> },
  'Under Review':      { color: 'bg-blue-100 text-blue-700',     icon: <Eye className="size-3" /> },
  'Rejected':          { color: 'bg-red-100 text-red-700',       icon: <XCircle className="size-3" /> },
  'Expired':           { color: 'bg-red-200 text-red-800',       icon: <AlertTriangle className="size-3" /> },
  'Renewal Required':  { color: 'bg-orange-100 text-orange-700', icon: <RefreshCw className="size-3" /> },
  'Not Started':       { color: 'bg-slate-100 text-slate-700',   icon: <Clock className="size-3" /> },
}

const INCIDENT_SEVERITY: Record<string, string> = {
  Fatal:     'bg-black text-white',
  Major:     'bg-red-100 text-red-800',
  Serious:   'bg-orange-100 text-orange-700',
  Minor:     'bg-amber-100 text-amber-700',
  'Near Miss': 'bg-sky-100 text-sky-700',
}

const INCIDENT_STATUS: Record<string, string> = {
  Open:                   'bg-red-100 text-red-700',
  'Under Investigation':  'bg-amber-100 text-amber-700',
  Closed:                 'bg-green-100 text-green-700',
  Referred:               'bg-blue-100 text-blue-700',
}

function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full', className)}>
      {children}
    </span>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 px-4 py-4 flex items-center gap-3 bg-white shadow-sm')}>
      <div className={cn('rounded-lg p-2.5', color)}>{icon}</div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 leading-none mb-0.5">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
      </div>
    </div>
  )
}

// ─── Tab 1: Work Packages ────────────────────────────────────────────────────

function WorkPackagesTab({ packages }: { packages: WorkPackage[] }) {
  const [search, setSearch]   = React.useState('')
  const [disc, setDisc]       = React.useState('All')
  const [status, setStatus]   = React.useState('All')
  const [priority, setPriority] = React.useState('All')
  const [selected, setSelected] = React.useState<WorkPackage | null>(null)
  const [wpTab, setWpTab]     = React.useState('Overview')

  const DISCIPLINES = ['All', 'Civil', 'Mechanical', 'Electrical', 'Instrumentation', 'Piping', 'Structural', 'Architectural', 'Commissioning']
  const STATUSES    = ['All', 'Not Started', 'In Progress', 'Complete', 'On Hold', 'Blocked']
  const PRIORITIES  = ['All', 'Critical', 'High', 'Medium', 'Low']

  const filtered = packages.filter((p) => {
    const matchSearch   = search === '' || p.title.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
    const matchDisc     = disc === 'All' || p.discipline === disc
    const matchStatus   = status === 'All' || p.status === status
    const matchPriority = priority === 'All' || p.priority === priority
    return matchSearch && matchDisc && matchStatus && matchPriority
  })

  const progressColor = (pct: number, st: string) => {
    if (st === 'Complete') return 'bg-green-500'
    if (st === 'Blocked')  return 'bg-red-500'
    if (st === 'On Hold')  return 'bg-amber-400'
    if (pct > 50)          return 'bg-blue-500'
    return 'bg-orange-500'
  }

  const WP_DETAIL_TABS = ['Overview', 'Schedule', 'Resources', 'Costs', 'Progress', 'Issues', 'Documents']

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-3 px-5 py-4 border-b border-slate-100">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search work packages..."
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400" />
          </div>
          {([['Discipline', DISCIPLINES, disc, setDisc], ['Status', STATUSES, status, setStatus], ['Priority', PRIORITIES, priority, setPriority]] as const).map(([label, opts, val, fn]) => (
            <select key={label as string} value={val as string} onChange={(e) => (fn as (v: string) => void)(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400">
              {(opts as string[]).map((o) => <option key={o}>{o}</option>)}
            </select>
          ))}
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {filtered.map((wp) => {
            const pm = PRIORITY_META[wp.priority] ?? PRIORITY_META.Medium
            const sm = STATUS_META[wp.status] ?? STATUS_META['Not Started']
            return (
              <div key={wp.id} onClick={() => setSelected(wp)}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer">
                {/* Card header */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">{wp.wbs_code}</span>
                    <Badge className={pm.color}>{pm.icon}{pm.label}</Badge>
                  </div>
                  <Badge className={sm.color}>{sm.icon}{sm.label}</Badge>
                </div>

                {/* Title + description */}
                <p className="text-sm font-semibold text-slate-900 mt-2 leading-snug">{wp.title}</p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{wp.description}</p>

                {/* Progress */}
                <div className="mt-3">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', progressColor(wp.progress_percent, wp.status))}
                      style={{ width: `${wp.progress_percent}%` }} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{wp.progress_percent}% complete</p>
                </div>

                {/* Stats */}
                <div className="flex gap-4 mt-3">
                  <span className="flex items-center gap-1 text-xs text-slate-600">
                    <Clock className="size-3 text-slate-400" />
                    {wp.actual_hours.toLocaleString()} / {wp.planned_hours.toLocaleString()}h
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-600">
                    <DollarSign className="size-3 text-slate-400" />
                    {fmt(wp.actual_cost)} / {fmt(wp.budget_amount)}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-600">
                    <Users className="size-3 text-slate-400" />
                    {wp.team_size}
                  </span>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-400">{wp.start_date}</span>
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{wp.discipline}</span>
                  <span className="text-[11px] text-slate-400">{wp.end_date}</span>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-slate-400 text-sm">No work packages match your filters.</div>
          )}
        </div>
      </div>

      {/* Detail slide-in */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setSelected(null)} />
          <div className="w-full max-w-[600px] bg-white border-l border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{selected.wbs_code} · {selected.discipline}</p>
                <p className="text-base font-bold text-slate-900 leading-snug">{selected.title}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
            </div>
            {/* Badges */}
            <div className="flex gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50">
              <Badge className={PRIORITY_META[selected.priority]?.color ?? 'bg-slate-100 text-slate-700'}>{PRIORITY_META[selected.priority]?.icon}{selected.priority}</Badge>
              <Badge className={STATUS_META[selected.status]?.color ?? 'bg-slate-100 text-slate-700'}>{STATUS_META[selected.status]?.icon}{selected.status}</Badge>
              <Badge className="bg-orange-100 text-orange-700">{selected.progress_percent}% complete</Badge>
            </div>
            {/* Inner tab bar */}
            <div className="flex overflow-x-auto border-b border-slate-100 bg-white px-4">
              {WP_DETAIL_TABS.map((t) => (
                <button key={t} type="button" onClick={() => setWpTab(t)}
                  className={cn('px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2',
                    wpTab === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
                  {t}
                </button>
              ))}
            </div>
            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-sm">
              {wpTab === 'Overview' && (
                <>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Description</p>
                    <p className="text-slate-700 leading-relaxed">{selected.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Start Date',  value: selected.start_date },
                      { label: 'End Date',    value: selected.end_date },
                      { label: 'Budget',      value: fmt(selected.budget_amount) },
                      { label: 'Actual Cost', value: fmt(selected.actual_cost) },
                      { label: 'Planned Hrs', value: selected.planned_hours.toLocaleString() },
                      { label: 'Actual Hrs',  value: selected.actual_hours.toLocaleString() },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
                        <p className="font-semibold text-slate-800">{value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {wpTab === 'Schedule' && (
                <div className="space-y-4">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Milestones</p>
                  {selected.milestones.length === 0 && <p className="text-slate-400 text-xs">No milestones defined.</p>}
                  {selected.milestones.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <div className={cn('size-6 rounded-full flex items-center justify-center flex-shrink-0',
                        m.status === 'Complete' ? 'bg-green-100' : m.status === 'In Progress' ? 'bg-blue-100' : 'bg-slate-100')}>
                        {m.status === 'Complete'
                          ? <CheckCircle className="size-3.5 text-green-600" />
                          : m.status === 'In Progress'
                          ? <Loader2 className="size-3.5 text-blue-600 animate-spin" />
                          : <Clock className="size-3.5 text-slate-400" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{m.name}</p>
                        <p className="text-xs text-slate-400">{m.date}</p>
                      </div>
                      <Badge className={STATUS_META[m.status]?.color ?? 'bg-slate-100 text-slate-600'}>{m.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {wpTab === 'Resources' && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Team</p>
                  <p className="text-slate-700"><span className="font-bold text-orange-600">{selected.team_size}</span> personnel assigned</p>
                  <p className="text-xs text-slate-400 mt-1">Full resource loading available in the Resources tab.</p>
                </div>
              )}
              {wpTab === 'Costs' && (
                <div className="space-y-3">
                  {[
                    { label: 'Budget (BAC)',   value: fmt(selected.budget_amount),   color: 'text-slate-700' },
                    { label: 'Actual Cost',    value: fmt(selected.actual_cost),     color: 'text-orange-600' },
                    { label: 'Remaining',      value: fmt(selected.budget_amount - selected.actual_cost), color: selected.actual_cost > selected.budget_amount ? 'text-red-600' : 'text-green-600' },
                    { label: 'Burn Rate',      value: `${((selected.actual_cost / selected.budget_amount) * 100).toFixed(0)}%`, color: 'text-slate-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-slate-100">
                      <p className="text-slate-500 text-xs">{label}</p>
                      <p className={cn('font-bold text-sm', color)}>{value}</p>
                    </div>
                  ))}
                </div>
              )}
              {wpTab === 'Progress' && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${selected.progress_percent}%` }} />
                    </div>
                    <span className="font-bold text-orange-600 text-sm">{selected.progress_percent}%</span>
                  </div>
                  <p className="text-xs text-slate-400">Actual hours: {selected.actual_hours.toLocaleString()} / {selected.planned_hours.toLocaleString()} planned</p>
                </div>
              )}
              {wpTab === 'Issues' && (
                <div className="space-y-3">
                  {selected.issues.length === 0 && <p className="text-slate-400 text-xs">No open issues.</p>}
                  {selected.issues.map((iss) => (
                    <div key={iss.id} className="flex items-start gap-3 border border-slate-100 rounded-xl p-3">
                      <Badge className={PRIORITY_META[iss.priority]?.color ?? 'bg-slate-100 text-slate-700'}>{iss.priority}</Badge>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-800">{iss.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Owner: {iss.owner}</p>
                      </div>
                      <Badge className={STATUS_META[iss.status]?.color ?? 'bg-slate-100 text-slate-700'}>{iss.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
              {wpTab === 'Documents' && (
                <div className="space-y-2">
                  {selected.documents.length === 0 && <p className="text-slate-400 text-xs">No documents attached.</p>}
                  {selected.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                      <div>
                        <p className="text-sm text-slate-800 font-medium">{doc.name}</p>
                        <p className="text-xs text-slate-400">{doc.type} · {doc.date}</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700">{doc.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 2: HSE Management ───────────────────────────────────────────────────

function HSETab({ planItems, incidents }: { planItems: HSEPlanItem[]; incidents: Incident[] }) {
  const [addIncident, setAddIncident] = React.useState(false)

  const HSE_STATUS_COLOR: Record<string, string> = {
    'Complete':    'text-green-600',
    'In Progress': 'text-amber-600',
    'Not Started': 'text-slate-400',
    'Overdue':     'text-red-600',
  }

  const hseStats = [
    { icon: <ShieldCheck className="size-5 text-green-600" />, label: 'Days Without Incident', value: '45', color: 'bg-green-100' },
    { icon: <ShieldCheck className="size-5 text-green-600" />, label: 'TRIR',                  value: '0.00', color: 'bg-green-100' },
    { icon: <ShieldCheck className="size-5 text-green-600" />, label: 'LTIFR',                 value: '0.00', color: 'bg-green-100' },
    { icon: <AlertTriangle className="size-5 text-amber-600" />, label: 'Near Misses',         value: '3', color: 'bg-amber-100' },
    { icon: <ClipboardList className="size-5 text-blue-600" />,  label: 'Open Actions',        value: '12', color: 'bg-blue-100' },
    { icon: <GraduationCap className="size-5 text-green-600" />, label: 'Training Complete',   value: '92%', color: 'bg-green-100' },
    { icon: <HardHat className="size-5 text-green-600" />,       label: 'PPE Compliance',      value: '98%', color: 'bg-green-100' },
    { icon: <ClipboardCheck className="size-5 text-amber-600" />,label: 'Inspection Score',   value: '87%', color: 'bg-amber-100' },
  ]

  return (
    <div className="space-y-4">
      {/* HSE KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {hseStats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} />
        ))}
      </div>

      {/* HSE Plan */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">HSE Plan Status</p>
        </div>
        <div className="divide-y divide-slate-100">
          {planItems.map((item) => (
            <div key={item.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors">
              <div className={cn('size-5 rounded-full flex items-center justify-center flex-shrink-0',
                item.status === 'Complete' ? 'bg-green-100' : item.status === 'In Progress' ? 'bg-amber-100' : 'bg-slate-100')}>
                {item.status === 'Complete'
                  ? <CheckCircle className="size-3 text-green-600" />
                  : item.status === 'In Progress'
                  ? <Clock className="size-3 text-amber-600" />
                  : <Clock className="size-3 text-slate-400" />}
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-800 font-medium">{item.name}</p>
                {item.detail && <p className="text-xs text-slate-400">{item.detail}</p>}
              </div>
              <span className={cn('text-xs font-semibold', HSE_STATUS_COLOR[item.status] ?? 'text-slate-500')}>{item.status}</span>
              <span className="text-xs text-slate-400 font-mono w-14 text-right">{item.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Incident log */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Incident Log</p>
          <button type="button" onClick={() => setAddIncident(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors">
            <Plus className="size-3" /> Report Incident
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                {['ID','Date','Type','Severity','Description','Person','Status'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-orange-500">{inc.id.toUpperCase()}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{inc.date}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{inc.type}</td>
                  <td className="px-4 py-3"><Badge className={INCIDENT_SEVERITY[inc.severity] ?? 'bg-slate-100 text-slate-700'}>{inc.severity}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px] truncate">{inc.description}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{inc.person}</td>
                  <td className="px-4 py-3"><Badge className={INCIDENT_STATUS[inc.status] ?? 'bg-slate-100 text-slate-700'}>{inc.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Incident Modal */}
      {addIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[540px] mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">Report Incident</p>
              <button type="button" onClick={() => setAddIncident(false)} className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button>
            </div>
            <form className="px-6 py-5 grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); setAddIncident(false) }}>
              {[
                { label: 'Date', type: 'date', colSpan: 1 },
                { label: 'Time', type: 'time', colSpan: 1 },
                { label: 'Type', type: 'text', colSpan: 1, placeholder: 'Injury, Near Miss, etc.' },
                { label: 'Severity', type: 'text', colSpan: 1, placeholder: 'Minor, Serious, Major...' },
                { label: 'Location', type: 'text', colSpan: 2, placeholder: 'Site location / zone' },
                { label: 'Description', type: 'textarea', colSpan: 2, placeholder: 'What happened?' },
                { label: 'Immediate Action', type: 'textarea', colSpan: 2, placeholder: 'Action taken immediately...' },
                { label: 'Person(s) Involved', type: 'text', colSpan: 1, placeholder: 'Name(s)' },
                { label: 'Witnesses', type: 'text', colSpan: 1, placeholder: 'Witness names' },
              ].map(({ label, type, colSpan, placeholder }) => (
                <div key={label} className={cn('flex flex-col gap-1', colSpan === 2 ? 'col-span-2' : '')}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
                  {type === 'textarea'
                    ? <textarea placeholder={placeholder} rows={2} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none" />
                    : <input type={type} placeholder={placeholder} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400" />
                  }
                </div>
              ))}
              <div className="col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setAddIncident(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">Submit Report</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: Permits ──────────────────────────────────────────────────────────

function PermitsTab({ permits }: { permits: Permit[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-800">Permit Tracker ({permits.length})</p>
        <button type="button" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors">
          <Plus className="size-3" /> New Permit
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              {['Permit ID','Type','Authority','Status','Application Date','Issue Date','Expiry','Renewal','Documents'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permits.map((p) => {
              const sm = PERMIT_STATUS_META[p.status] ?? PERMIT_STATUS_META['Pending']
              return (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-orange-500">{p.code}</td>
                  <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap">{p.type}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{p.authority}</td>
                  <td className="px-4 py-3"><Badge className={sm.color}>{sm.icon}{p.status}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{p.application_date}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{p.issue_date ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{p.expiry_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    {p.renewal_required
                      ? <Badge className="bg-orange-100 text-orange-700"><RefreshCw className="size-3" /> Yes</Badge>
                      : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{p.documents}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 border-t border-slate-100">
        {[
          { label: 'Approved',     count: permits.filter((p) => p.status === 'Approved').length,      color: 'bg-green-100 text-green-700' },
          { label: 'Pending',      count: permits.filter((p) => p.status === 'Pending').length,       color: 'bg-amber-100 text-amber-700' },
          { label: 'Under Review', count: permits.filter((p) => p.status === 'Under Review').length,  color: 'bg-blue-100 text-blue-700' },
          { label: 'Not Started',  count: permits.filter((p) => p.status === 'Not Started').length,   color: 'bg-slate-100 text-slate-700' },
        ].map(({ label, count, color }) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-slate-900">{count}</span>
            <Badge className={color}>{label}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab 4: Site Readiness ───────────────────────────────────────────────────

function SiteReadinessTab({ items }: { items: SiteReadinessItem[] }) {
  const [expanded, setExpanded] = React.useState<string | null>('Site Access')

  const categories = Array.from(new Set(items.map((i) => i.category)))

  const categoryData = categories.map((cat) => {
    const catItems = items.filter((i) => i.category === cat)
    const done = catItems.filter((i) => i.status === 'Complete').length
    return { cat, items: catItems, done, total: catItems.length, pct: Math.round((done / catItems.length) * 100) }
  })

  const overallPct = Math.round(
    items.filter((i) => i.status === 'Complete').length / items.length * 100
  )

  const ITEM_STATUS: Record<string, { color: string; icon: React.ReactNode }> = {
    'Complete':    { color: 'text-green-600', icon: <CheckCircle className="size-4 text-green-500" /> },
    'In Progress': { color: 'text-amber-600', icon: <Clock className="size-4 text-amber-500" /> },
    'Not Started': { color: 'text-slate-400', icon: <Clock className="size-4 text-slate-300" /> },
  }

  return (
    <div className="space-y-4">
      {/* Score card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-8 gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Readiness Score</p>
          <div className="relative size-28">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#f97316" strokeWidth="3.5"
                strokeDasharray={`${(overallPct / 100) * 87.96} 87.96`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-orange-600">{overallPct}%</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">{items.filter((i) => i.status === 'Complete').length} / {items.length} complete</p>
        </div>

        <div className="md:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Category Progress</p>
          <div className="grid grid-cols-2 gap-3">
            {categoryData.map(({ cat, pct, done, total }) => (
              <div key={cat}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-700 font-medium">{cat}</span>
                  <span className="text-xs text-slate-500">{done}/{total}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-orange-500')}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed checklist */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {categoryData.map(({ cat, items: catItems, done, total, pct }) => (
          <div key={cat} className="border-b border-slate-100 last:border-0">
            <button type="button" onClick={() => setExpanded(expanded === cat ? null : cat)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                {expanded === cat ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
                <span className="text-sm font-semibold text-slate-800">{cat}</span>
                <span className="text-xs text-slate-500">{done}/{total}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                  <div className={cn('h-full rounded-full', pct === 100 ? 'bg-green-500' : 'bg-amber-500')} style={{ width: `${pct}%` }} />
                </div>
                <span className={cn('text-xs font-bold', pct === 100 ? 'text-green-600' : 'text-amber-600')}>{pct}%</span>
              </div>
            </button>
            {expanded === cat && (
              <div className="px-6 pb-4 space-y-2">
                {catItems.map((item) => {
                  const sm = ITEM_STATUS[item.status] ?? ITEM_STATUS['Not Started']
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                      {sm.icon}
                      <p className="flex-1 text-sm text-slate-700">{item.description}</p>
                      <span className="text-[11px] text-slate-500 hidden sm:block">{item.responsible}</span>
                      <span className="text-[11px] font-mono text-slate-400 w-12 text-right">{item.due_date}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Tab 5: Resources ────────────────────────────────────────────────────────

function ResourcesTab({
  personnel, equipment, materials, subcontractors,
}: { personnel: Personnel[]; equipment: Equipment[]; materials: Material[]; subcontractors: Subcontractor[] }) {
  const [activeRes, setActiveRes] = React.useState<'Personnel' | 'Equipment' | 'Materials' | 'Subcontractors'>('Personnel')

  const RES_STATUS: Record<string, string> = {
    'Active':            'bg-green-100 text-green-700',
    'Induction Pending': 'bg-amber-100 text-amber-700',
    'Off-Site':          'bg-slate-100 text-slate-700',
    'Stand-Down':        'bg-red-100 text-red-700',
    'In Use':            'bg-blue-100 text-blue-700',
    'Available':         'bg-green-100 text-green-700',
    'Maintenance':       'bg-amber-100 text-amber-700',
    'Broken':            'bg-red-100 text-red-700',
    'In Stock':          'bg-green-100 text-green-700',
    'On Order':          'bg-amber-100 text-amber-700',
    'Shortage':          'bg-red-100 text-red-700',
    'Excess':            'bg-blue-100 text-blue-700',
    'Mobilising':        'bg-purple-100 text-purple-700',
  }

  const Stars = ({ n }: { n: number }) => (
    <span className="text-amber-400 text-sm">{Array.from({ length: 5 }, (_, i) => (i < n ? '★' : '☆')).join('')}</span>
  )

  return (
    <div className="space-y-4">
      {/* Resource KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users className="size-5 text-blue-600" />}   label="Personnel On-Site"  value="45"  color="bg-blue-100" />
        <StatCard icon={<Truck className="size-5 text-orange-600" />}  label="Equipment Deployed" value="18"  color="bg-orange-100" />
        <StatCard icon={<Package className="size-5 text-green-600" />} label="Materials Received" value="65%" color="bg-green-100" />
        <StatCard icon={<Building className="size-5 text-purple-600" />} label="Subcontractors"   value="4"   color="bg-purple-100" />
      </div>

      {/* Sub-tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {(['Personnel', 'Equipment', 'Materials', 'Subcontractors'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setActiveRes(t)}
              className={cn('px-5 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
                activeRes === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {t}
            </button>
          ))}
        </div>

        {activeRes === 'Personnel' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  {['Name','Role','Company','Start','Induction','Status'].map((h) => <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {personnel.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.role}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.company}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.start_date}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.induction_date}</td>
                    <td className="px-4 py-3"><Badge className={RES_STATUS[p.status] ?? 'bg-slate-100 text-slate-700'}>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeRes === 'Equipment' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  {['ID','Type','Model','Qty','Location','Status','Utilization'].map((h) => <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq) => (
                  <tr key={eq.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-orange-500">{eq.equipment_id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{eq.type}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{eq.model}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{eq.qty}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{eq.location}</td>
                    <td className="px-4 py-3"><Badge className={RES_STATUS[eq.status] ?? 'bg-slate-100 text-slate-700'}>{eq.status}</Badge></td>
                    <td className="px-4 py-3">
                      {eq.utilization > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', eq.utilization > 80 ? 'bg-green-500' : 'bg-amber-500')} style={{ width: `${eq.utilization}%` }} />
                          </div>
                          <span className="text-xs text-slate-600">{eq.utilization}%</span>
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeRes === 'Materials' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  {['Item','Description','Ordered','Received','Installed','Unit','Delivery','Status'].map((h) => <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{m.item}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{m.description}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{m.ordered.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{m.received.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{m.installed.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{m.unit}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{m.delivery_date}</td>
                    <td className="px-4 py-3"><Badge className={RES_STATUS[m.status] ?? 'bg-slate-100 text-slate-700'}>{m.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeRes === 'Subcontractors' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  {['Company','Scope','Value','Start','Personnel','Status','Performance'].map((h) => <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {subcontractors.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{s.company}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{s.scope}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{fmt(s.value)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{s.start_date}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{s.personnel}</td>
                    <td className="px-4 py-3"><Badge className={RES_STATUS[s.status] ?? 'bg-slate-100 text-slate-700'}>{s.status}</Badge></td>
                    <td className="px-4 py-3">{s.performance > 0 ? <Stars n={s.performance} /> : <span className="text-xs text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab 6: Progress ─────────────────────────────────────────────────────────

function ProgressTab({ disciplines }: { disciplines: DisciplineProgress[] }) {
  const [logOpen, setLogOpen] = React.useState(false)

  const ev = { bcws: 10800000, bcwp: 9090000, acwp: 9500000, spi: 0.84, cpi: 0.96, eac: 90000000, etc: 80500000, vac: -5000000 }

  const spiColor  = ev.spi  >= 0.95 ? 'text-green-600' : ev.spi  >= 0.85 ? 'text-amber-600' : 'text-red-600'
  const cpiColor  = ev.cpi  >= 0.95 ? 'text-green-600' : ev.cpi  >= 0.85 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="space-y-4">
      {/* EV indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: '18%',   sub: 'Planned 22% | -4%',     color: 'text-orange-600' },
          { label: 'SPI',              value: ev.spi.toFixed(2), sub: 'Schedule Perf. Index', color: spiColor },
          { label: 'CPI',              value: ev.cpi.toFixed(2), sub: 'Cost Perf. Index',     color: cpiColor },
          { label: 'EAC',              value: fmt(ev.eac),        sub: `VAC ${fmt(ev.vac)}`,  color: ev.vac < 0 ? 'text-red-600' : 'text-green-600' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* S-Curve */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-slate-800 mb-4">S-Curve — Planned vs Actual Progress (%)</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={S_CURVE_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Legend />
            <Area type="monotone" dataKey="planned" name="Planned" stroke="#94a3b8" fill="#f1f5f9" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="actual"  name="Actual"  stroke="#f97316" fill="#fed7aa" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Earned Value chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-slate-800 mb-4">Earned Value — BCWS / BCWP / ACWP</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={EV_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip formatter={(v) => typeof v === 'number' ? `$${(v / 1_000_000).toFixed(2)}M` : v} />
            <Legend />
            <Bar dataKey="bcws" name="BCWS (Planned)"  fill="#94a3b8" radius={[3, 3, 0, 0]} />
            <Bar dataKey="bcwp" name="BCWP (Earned)"   fill="#f97316" radius={[3, 3, 0, 0]} />
            <Bar dataKey="acwp" name="ACWP (Actual)"   fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Discipline progress table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Progress by Discipline</p>
          <button type="button" onClick={() => setLogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors">
            <Plus className="size-3" /> Log Progress
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              {['Discipline','Weight','Planned %','Actual %','Variance','Status','Progress Bar'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {disciplines.map((d) => {
              const variance = d.actual - d.planned
              const status = variance >= 0 ? 'On Track' : variance >= -5 ? 'At Risk' : 'Behind'
              const statusColor = status === 'On Track' ? 'bg-green-100 text-green-700' : status === 'At Risk' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              return (
                <tr key={d.discipline} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{d.discipline}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.weight}%</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{d.planned}%</td>
                  <td className="px-4 py-3 text-xs font-semibold text-orange-600">{d.actual}%</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-semibold', variance >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {variance >= 0 ? '+' : ''}{variance}%
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge className={statusColor}>{status}</Badge></td>
                  <td className="px-4 py-3 w-36">
                    <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="absolute h-full bg-slate-300 rounded-full" style={{ width: `${d.planned}%` }} />
                      <div className="absolute h-full bg-orange-500 rounded-full" style={{ width: `${d.actual}%` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Log Progress Modal */}
      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[480px] mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">Log Daily Progress</p>
              <button type="button" onClick={() => setLogOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button>
            </div>
            <form className="px-6 py-5 grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); setLogOpen(false) }}>
              {[
                { label: 'Date',       type: 'date',     colSpan: 1 },
                { label: 'Weather',    type: 'text',     colSpan: 1, placeholder: 'Clear, Dusty, Rain...' },
                { label: 'Work Areas', type: 'text',     colSpan: 2, placeholder: 'Zone A, Sector B...' },
                { label: 'Activities', type: 'textarea', colSpan: 2, placeholder: 'Key activities today...' },
                { label: 'Personnel',  type: 'number',   colSpan: 1, placeholder: '0' },
                { label: 'Equipment',  type: 'text',     colSpan: 1, placeholder: 'List equipment used' },
                { label: 'Issues',     type: 'textarea', colSpan: 2, placeholder: 'Any issues or observations...' },
              ].map(({ label, type, colSpan, placeholder }) => (
                <div key={label} className={cn('flex flex-col gap-1', colSpan === 2 ? 'col-span-2' : '')}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
                  {type === 'textarea'
                    ? <textarea placeholder={placeholder} rows={2} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none" />
                    : <input type={type} placeholder={placeholder} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400" />
                  }
                </div>
              ))}
              <div className="col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setLogOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'work-packages', label: 'Work Packages',    count: MOCK_WORK_PACKAGES.length,                                   icon: <HardHat className="size-3.5" /> },
  { id: 'hse',           label: 'HSE Management',   count: MOCK_INCIDENTS.filter((i) => i.status === 'Open').length,    icon: <ShieldCheck className="size-3.5" /> },
  { id: 'permits',       label: 'Permits & Licenses', count: MOCK_PERMITS.filter((p) => p.status !== 'Approved').length, icon: <FileCheck className="size-3.5" /> },
  { id: 'site',          label: 'Site Readiness',   count: null,                                                         icon: <MapPin className="size-3.5" /> },
  { id: 'resources',     label: 'Resources',        count: null,                                                         icon: <Users className="size-3.5" /> },
  { id: 'progress',      label: 'Progress',         count: null,                                                         icon: <BarChart3 className="size-3.5" /> },
]

export default function G4ConstructionPage() {
  const params = useParams()
  const projectId = (params?.id as string) ?? 'SOL-2026-001'
  const [activeTab, setActiveTab] = React.useState('work-packages')
  const [newWPOpen, setNewWPOpen] = React.useState(false)

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div>
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-slate-500 mb-3">
            <Link href="/projects" className="hover:text-slate-800 transition-colors">Projects</Link>
            <ChevronRight className="size-3.5" />
            <Link href={`/projects/${projectId}`} className="hover:text-slate-800 transition-colors">{projectId}</Link>
            <ChevronRight className="size-3.5" />
            <span className="text-slate-700 font-medium">G4 Construction</span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-900">G4: Construction Mobilization</h1>
                <Badge className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1">G4</Badge>
                <Badge className="bg-amber-100 text-amber-700">In Progress</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">Site mobilization, work packages, HSE readiness, and permit compliance</p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setNewWPOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition-colors shadow-sm">
                <Plus className="size-4" /> New Work Package
              </button>
              {[
                { label: 'HSE Report',      icon: <AlertTriangle className="size-4" /> },
                { label: 'Permit Tracker',  icon: <FileText className="size-4" /> },
                { label: 'Site Inspection', icon: <Camera className="size-4" /> },
              ].map(({ label, icon }) => (
                <button key={label} type="button"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm">
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Phase Gate Stepper */}
        <PhaseGateStepper currentGate="G4" completedGates={['G0', 'G1', 'G2', 'G3']} />

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<HardHat className="size-5 text-orange-600" />}   label="Work Packages"    value="24"     color="bg-orange-100" />
          <StatCard icon={<TrendingUp className="size-5 text-amber-600" />}  label="Mobilization %"  value="65%"    color="bg-amber-100" />
          <StatCard icon={<FileCheck className="size-5 text-green-600" />}   label="Permits Approved" value="8 of 12" color="bg-green-100" />
          <StatCard icon={<ShieldCheck className="size-5 text-green-600" />} label="HSE Incidents"   value="0"      color="bg-green-100" />
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 overflow-x-auto">
          <nav className="flex min-w-max">
            {TABS.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}>
                {tab.icon}
                {tab.label}
                {tab.count != null && (
                  <span className={cn('text-[10px] rounded-full px-1.5 py-0.5 font-bold',
                    activeTab === tab.id ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600')}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab content */}
        {activeTab === 'work-packages' && <WorkPackagesTab packages={MOCK_WORK_PACKAGES} />}
        {activeTab === 'hse'           && <HSETab planItems={MOCK_HSE_PLAN} incidents={MOCK_INCIDENTS} />}
        {activeTab === 'permits'       && <PermitsTab permits={MOCK_PERMITS} />}
        {activeTab === 'site'          && <SiteReadinessTab items={SITE_READINESS_ITEMS} />}
        {activeTab === 'resources'     && (
          <ResourcesTab
            personnel={MOCK_PERSONNEL}
            equipment={MOCK_EQUIPMENT}
            materials={MOCK_MATERIALS}
            subcontractors={MOCK_SUBCONTRACTORS}
          />
        )}
        {activeTab === 'progress'      && <ProgressTab disciplines={DISCIPLINE_PROGRESS} />}

      </div>

      {/* New Work Package Modal */}
      {newWPOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[540px] mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">New Work Package</p>
              <button type="button" onClick={() => setNewWPOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button>
            </div>
            <form className="px-6 py-5 grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); setNewWPOpen(false) }}>
              {[
                { label: 'WBS Code',    placeholder: 'e.g. 1.3.4',        colSpan: 1, type: 'text' },
                { label: 'WP Code',     placeholder: 'e.g. WP-009',        colSpan: 1, type: 'text' },
                { label: 'Title',       placeholder: 'Work package title',  colSpan: 2, type: 'text' },
                { label: 'Description', placeholder: 'Scope description…',  colSpan: 2, type: 'textarea' },
                { label: 'Start Date',  placeholder: '',                   colSpan: 1, type: 'date' },
                { label: 'End Date',    placeholder: '',                   colSpan: 1, type: 'date' },
                { label: 'Budget ($)',  placeholder: '0',                  colSpan: 1, type: 'number' },
                { label: 'Team Size',   placeholder: '0',                  colSpan: 1, type: 'number' },
              ].map(({ label, placeholder, colSpan, type }) => (
                <div key={label} className={cn('flex flex-col gap-1', colSpan === 2 ? 'col-span-2' : '')}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
                  {type === 'textarea'
                    ? <textarea placeholder={placeholder} rows={2} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none" />
                    : <input type={type} placeholder={placeholder} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400" />
                  }
                </div>
              ))}
              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Discipline</label>
                  <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400">
                    {['Civil','Mechanical','Electrical','Instrumentation','Piping','Structural','Commissioning'].map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Priority</label>
                  <select className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400">
                    {['Critical','High','Medium','Low'].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setNewWPOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">Create Work Package</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
