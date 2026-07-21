'use client'

import React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ChevronRight, Plus, X, Search, CheckCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Filter, Download, FileText, Wrench, ClipboardList,
  Award, BarChart2, AlertCircle, CheckSquare, XCircle, Send, Eye, FolderOpen,
  Upload, Pencil, Link2,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

type InspectionStatus = 'passed' | 'failed' | 'in_progress' | 'scheduled' | 'hold'
type PunchCategory    = 'A' | 'B' | 'C'
type PunchStatus      = 'open' | 'closed' | 'in_progress' | 'disputed'
type NcrStatus        = 'open' | 'under_review' | 'closed' | 'rejected'
type NcrSeverity      = 'critical' | 'major' | 'minor'
type CertStatus       = 'issued' | 'pending' | 'rejected' | 'draft'

interface Inspection {
  id: string; code: string; title: string; discipline: string
  type: string; system: string; planned_date: string; actual_date: string | null
  status: InspectionStatus; inspector: string; contractor: string
  hold_points: string[]; witness_points: string[]
  result_notes: string; deficiencies: number
}

interface PunchItem {
  id: string; code: string; description: string; category: PunchCategory
  status: PunchStatus; discipline: string; system: string; location: string
  raised_by: string; assigned_to: string; raised_date: string
  due_date: string; closed_date: string | null; priority: 'high' | 'medium' | 'low'
  drawing_ref: string
}

interface NCR {
  id: string; code: string; title: string; discipline: string; system: string
  severity: NcrSeverity; status: NcrStatus; raised_by: string; assigned_to: string
  raised_date: string; due_date: string; closed_date: string | null
  description: string; root_cause: string; corrective_action: string
  verification_required: boolean; cost_impact: number
}

interface MCCertificate {
  id: string; cert_number: string; system: string; discipline: string
  status: CertStatus; issued_date: string | null; issued_by: string
  mc_coordinator: string; punch_outstanding: number
  ncr_outstanding: number; comments: string
}

interface TestPlan {
  id: string; code: string; title: string; system: string; discipline: string
  test_type: string; status: 'not_started' | 'in_progress' | 'passed' | 'failed'
  planned_date: string; actual_date: string | null; responsible: string
  steps_total: number; steps_completed: number; result: string
}

type AsBuiltStatus = 'pending' | 'redlines_submitted' | 'under_review' | 'approved' | 'superseded'

interface Redline {
  id: string; description: string; markup_by: string; markup_date: string
  area: string; status: 'open' | 'incorporated' | 'rejected'
}

interface AsBuilt {
  id: string; drawing_number: string; title: string; discipline: string
  revision: string; system: string; status: AsBuiltStatus
  original_ifc_rev: string; as_built_rev: string | null
  prepared_by: string; reviewed_by: string | null; approved_by: string | null
  submitted_date: string | null; approved_date: string | null
  redlines: Redline[]; linked_punch_items: string[]; linked_ncrs: string[]
  file_url: string | null
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_INSPECTIONS: Inspection[] = [
  {
    id: 'ins1', code: 'INS-MC-001', title: 'Tracker Foundation Torque Inspection',
    discipline: 'Civil', type: 'Hold Point', system: 'Tracker System',
    planned_date: '2026-08-10', actual_date: '2026-08-10', status: 'passed',
    inspector: 'Khalid Al-Mansouri', contractor: 'Al Futtaim Carillion',
    hold_points: ['Pre-pour rebar check', 'Post-pour alignment'], witness_points: ['Client witness'],
    result_notes: 'All anchor bolts within tolerance. Approved.', deficiencies: 0,
  },
  {
    id: 'ins2', code: 'INS-MC-002', title: 'DC Cable Tray Installation Check',
    discipline: 'Electrical', type: 'Witness Point', system: 'DC Collection',
    planned_date: '2026-08-18', actual_date: '2026-08-20', status: 'failed',
    inspector: 'Sarah Chen', contractor: 'Prysmian Group',
    hold_points: [], witness_points: ['IE witness', 'Client spot check'],
    result_notes: 'Incorrect cable tray spacing at Row J sections 12-18. Punch raised.', deficiencies: 3,
  },
  {
    id: 'ins3', code: 'INS-MC-003', title: 'PV Module Flash Test Batch 3',
    discipline: 'Electrical', type: 'Performance', system: 'PV Array',
    planned_date: '2026-08-25', actual_date: null, status: 'scheduled',
    inspector: 'Aisha Al-Rashidi', contractor: 'Jinko Solar',
    hold_points: ['Flash test sign-off'], witness_points: [],
    result_notes: '', deficiencies: 0,
  },
  {
    id: 'ins4', code: 'INS-MC-004', title: 'Inverter String Connection Megger Test',
    discipline: 'Electrical', type: 'Hold Point', system: 'Inverter Station',
    planned_date: '2026-09-01', actual_date: null, status: 'hold',
    inspector: 'Omar Al-Zaid', contractor: 'Huawei Digital Power',
    hold_points: ['Megger results review', 'IE sign-off'], witness_points: ['IE witness'],
    result_notes: 'On HOLD pending resolution of INS-MC-002 punch items.', deficiencies: 0,
  },
  {
    id: 'ins5', code: 'INS-MC-005', title: 'Tracker Motor & Control Panel FAT',
    discipline: 'Mechanical', type: 'Factory Acceptance', system: 'Tracker System',
    planned_date: '2026-08-05', actual_date: '2026-08-05', status: 'passed',
    inspector: 'James Morgan', contractor: 'Nextracker',
    hold_points: ['FAT sign-off'], witness_points: ['Client witness', 'IE witness'],
    result_notes: 'All 120 motor drives tested. Pass. Minor firmware update applied.', deficiencies: 1,
  },
  {
    id: 'ins6', code: 'INS-MC-006', title: 'HV Substation Civil Works Inspection',
    discipline: 'Civil', type: 'Witness Point', system: 'HV Substation',
    planned_date: '2026-09-10', actual_date: null, status: 'scheduled',
    inspector: 'Khalid Al-Mansouri', contractor: 'Al Futtaim Carillion',
    hold_points: [], witness_points: ['Client witness'],
    result_notes: '', deficiencies: 0,
  },
  {
    id: 'ins7', code: 'INS-MC-007', title: 'SCADA Cabinet Installation Check',
    discipline: 'SCADA', type: 'Witness Point', system: 'SCADA / Control',
    planned_date: '2026-09-15', actual_date: null, status: 'in_progress',
    inspector: 'Sarah Chen', contractor: 'ABB Power Grids',
    hold_points: ['Cabinet earthing check'], witness_points: [],
    result_notes: 'In progress — 3 of 8 cabinets inspected.', deficiencies: 0,
  },
  {
    id: 'ins8', code: 'INS-MC-008', title: 'Fencing & Security Perimeter Check',
    discipline: 'Civil', type: 'Completion', system: 'Site Infrastructure',
    planned_date: '2026-08-28', actual_date: '2026-08-28', status: 'passed',
    inspector: 'James Morgan', contractor: 'Al Futtaim Carillion',
    hold_points: [], witness_points: [],
    result_notes: 'Perimeter complete. Gate systems operational.', deficiencies: 0,
  },
]

const MOCK_PUNCH_ITEMS: PunchItem[] = [
  {
    id: 'p1', code: 'PL-001', description: 'Cable tray spacing non-compliant at Row J sections 12-18 — 150mm spacing required, 90mm installed',
    category: 'A', status: 'open', discipline: 'Electrical', system: 'DC Collection',
    location: 'Row J, Sections 12-18', raised_by: 'Sarah Chen', assigned_to: 'Prysmian Group',
    raised_date: '2026-08-20', due_date: '2026-09-05', closed_date: null,
    priority: 'high', drawing_ref: 'ELE-DC-101-B',
  },
  {
    id: 'p2', code: 'PL-002', description: 'Missing expansion joints on cable tray runs exceeding 30m in Sectors D & E',
    category: 'A', status: 'in_progress', discipline: 'Electrical', system: 'DC Collection',
    location: 'Sectors D & E', raised_by: 'Aisha Al-Rashidi', assigned_to: 'Prysmian Group',
    raised_date: '2026-08-22', due_date: '2026-09-10', closed_date: null,
    priority: 'high', drawing_ref: 'ELE-DC-102-A',
  },
  {
    id: 'p3', code: 'PL-003', description: 'Inverter station door seals not fully gasket-fitted on 4 units (INV-07 to INV-10)',
    category: 'B', status: 'open', discipline: 'Mechanical', system: 'Inverter Station',
    location: 'Inverter Building Block C', raised_by: 'Omar Al-Zaid', assigned_to: 'Huawei Digital Power',
    raised_date: '2026-08-25', due_date: '2026-09-15', closed_date: null,
    priority: 'medium', drawing_ref: 'MEC-INV-045-B',
  },
  {
    id: 'p4', code: 'PL-004', description: 'Tracker row numbering signs missing on 14 rows in Block B, North Field',
    category: 'C', status: 'closed', discipline: 'Civil', system: 'Tracker System',
    location: 'Block B, North Field', raised_by: 'Khalid Al-Mansouri', assigned_to: 'Al Futtaim Carillion',
    raised_date: '2026-08-15', due_date: '2026-08-28', closed_date: '2026-08-27',
    priority: 'low', drawing_ref: 'CIV-TRK-020-A',
  },
  {
    id: 'p5', code: 'PL-005', description: 'Ground-mount anchor torque values not recorded for 12 tracker piers in Row K',
    category: 'A', status: 'open', discipline: 'Civil', system: 'Tracker System',
    location: 'Row K, Block A', raised_by: 'James Morgan', assigned_to: 'Al Futtaim Carillion',
    raised_date: '2026-08-26', due_date: '2026-09-08', closed_date: null,
    priority: 'high', drawing_ref: 'CIV-FND-033-C',
  },
  {
    id: 'p6', code: 'PL-006', description: 'DC string fuse ratings mismatch — 20A fuses installed vs 25A specified on strings 44-60',
    category: 'A', status: 'disputed', discipline: 'Electrical', system: 'DC Collection',
    location: 'Combiner Box CB-12 to CB-16', raised_by: 'Sarah Chen', assigned_to: 'Jinko Solar',
    raised_date: '2026-08-18', due_date: '2026-09-01', closed_date: null,
    priority: 'high', drawing_ref: 'ELE-STR-088-A',
  },
  {
    id: 'p7', code: 'PL-007', description: 'SCADA cabinet cable labels not matching latest ITP revision 3 colour coding',
    category: 'B', status: 'in_progress', discipline: 'SCADA', system: 'SCADA / Control',
    location: 'Control Room, Cabinets C1-C4', raised_by: 'Aisha Al-Rashidi', assigned_to: 'ABB Power Grids',
    raised_date: '2026-09-01', due_date: '2026-09-20', closed_date: null,
    priority: 'medium', drawing_ref: 'SCA-CAB-011-B',
  },
  {
    id: 'p8', code: 'PL-008', description: 'Safety signage on transformer LV side not bilingual (Arabic/English)',
    category: 'C', status: 'closed', discipline: 'Civil', system: 'HV Substation',
    location: 'HV Substation, Bay 1-3', raised_by: 'Khalid Al-Mansouri', assigned_to: 'ABB Power Grids',
    raised_date: '2026-08-12', due_date: '2026-08-25', closed_date: '2026-08-24',
    priority: 'low', drawing_ref: 'CIV-SUB-004-A',
  },
  {
    id: 'p9', code: 'PL-009', description: 'Grounding bus bar connections not torqued to specification on 6 panel boards',
    category: 'A', status: 'open', discipline: 'Electrical', system: 'Inverter Station',
    location: 'Inverter Building Block A', raised_by: 'Omar Al-Zaid', assigned_to: 'Huawei Digital Power',
    raised_date: '2026-09-02', due_date: '2026-09-18', closed_date: null,
    priority: 'high', drawing_ref: 'ELE-ERD-055-B',
  },
  {
    id: 'p10', code: 'PL-010', description: 'Access road surface gravel depth substandard in Section 4 (200mm installed vs 350mm specified)',
    category: 'B', status: 'open', discipline: 'Civil', system: 'Site Infrastructure',
    location: 'Access Road, Section 4', raised_by: 'James Morgan', assigned_to: 'Al Futtaim Carillion',
    raised_date: '2026-09-04', due_date: '2026-09-22', closed_date: null,
    priority: 'medium', drawing_ref: 'CIV-RDS-007-A',
  },
]

const MOCK_NCRS: NCR[] = [
  {
    id: 'n1', code: 'NCR-2026-001', title: 'PV Module Power Output Below IEC Tolerance', discipline: 'Electrical', system: 'PV Array',
    severity: 'major', status: 'open', raised_by: 'Aisha Al-Rashidi', assigned_to: 'Jinko Solar',
    raised_date: '2026-08-14', due_date: '2026-09-14', closed_date: null,
    description: 'Flash test results on Batch 2 (Modules M-1200 to M-1800) show average Pmax 1.8% below IEC flash tolerance.',
    root_cause: 'Under investigation — potential cell degradation during shipping.',
    corrective_action: 'Jinko to provide replacement batch within 45 days and conduct root-cause analysis report.',
    verification_required: true, cost_impact: 320_000,
  },
  {
    id: 'n2', code: 'NCR-2026-002', title: 'Concrete Compressive Strength Non-Conformance', discipline: 'Civil', system: 'Tracker System',
    severity: 'critical', status: 'under_review', raised_by: 'Khalid Al-Mansouri', assigned_to: 'Al Futtaim Carillion',
    raised_date: '2026-08-20', due_date: '2026-09-05', closed_date: null,
    description: '28-day cube test results for Pour Zone 3 foundations returned 28.4 MPa vs 35 MPa specified (C35/45).',
    root_cause: 'W/C ratio exceeded specification during hot-weather concreting. No retempering permitted.',
    corrective_action: 'Structural Engineer to assess acceptability. If rejected, cored samples and load testing required.',
    verification_required: true, cost_impact: 980_000,
  },
  {
    id: 'n3', code: 'NCR-2026-003', title: 'DC Fuse Rating Mismatch — Strings 44-60', discipline: 'Electrical', system: 'DC Collection',
    severity: 'major', status: 'open', raised_by: 'Sarah Chen', assigned_to: 'Jinko Solar',
    raised_date: '2026-08-18', due_date: '2026-09-01', closed_date: null,
    description: '20A string fuses installed vs 25A specified in Electrical Design ITP Rev 3. Covered under punch item PL-006.',
    root_cause: 'Subcontractor procurement error — incorrect fuse stock delivered to site.',
    corrective_action: 'Replace all 20A fuses with 25A rated fuses in affected combiner boxes CB-12 to CB-16.',
    verification_required: false, cost_impact: 14_500,
  },
  {
    id: 'n4', code: 'NCR-2026-004', title: 'SCADA Firmware Version Non-Compliant with IEC 62443', discipline: 'SCADA', system: 'SCADA / Control',
    severity: 'minor', status: 'closed', raised_by: 'Omar Al-Zaid', assigned_to: 'ABB Power Grids',
    raised_date: '2026-08-05', due_date: '2026-08-30', closed_date: '2026-08-28',
    description: 'Installed SCADA firmware v4.1.2 does not meet IEC 62443-3-3 SL1 requirement. Specification requires v4.2.x+.',
    root_cause: 'Factory configuration error — wrong firmware image loaded during pre-configuration.',
    corrective_action: 'Firmware upgraded to v4.2.1 on all SCADA nodes. Cybersecurity re-test completed.',
    verification_required: true, cost_impact: 0,
  },
  {
    id: 'n5', code: 'NCR-2026-005', title: 'Tracker Foundation Misalignment — Row G-H Interface', discipline: 'Civil', system: 'Tracker System',
    severity: 'minor', status: 'closed', raised_by: 'Khalid Al-Mansouri', assigned_to: 'Al Futtaim Carillion',
    raised_date: '2026-07-30', due_date: '2026-08-20', closed_date: '2026-08-18',
    description: 'Survey reveals 3 foundation piers at Row G-H interface are 25mm out of tolerance on north-south axis.',
    root_cause: 'Survey control point shift after heavy rainfall event. Re-levelling required.',
    corrective_action: 'Piers re-grouted and re-aligned. Follow-up survey confirmed within ±10mm tolerance.',
    verification_required: false, cost_impact: 8_200,
  },
  {
    id: 'n6', code: 'NCR-2026-006', title: 'Inverter Cooling Fan Incorrect Rotation Direction', discipline: 'Mechanical', system: 'Inverter Station',
    severity: 'major', status: 'open', raised_by: 'Omar Al-Zaid', assigned_to: 'Huawei Digital Power',
    raised_date: '2026-08-12', due_date: '2026-08-22', closed_date: null,
    description: 'Post-energisation check found 6 of 24 inverter cooling fans rotating in reverse, causing overtemperature warning after 15 min run.',
    root_cause: 'Phase wiring transposition at terminal block during site installation. QC hold point missed.',
    corrective_action: 'Re-wire L1/L2 at all 24 units, re-run thermal performance test. Updated site wiring checklist issued.',
    verification_required: true, cost_impact: 14_500,
  },
  {
    id: 'n7', code: 'NCR-2026-007', title: 'Weld Inspection Failure — Substation Steel Frame', discipline: 'Civil', system: 'HV Substation',
    severity: 'major', status: 'open', raised_by: 'Yuki Tanaka', assigned_to: 'Al Futtaim Carillion',
    raised_date: '2026-08-18', due_date: '2026-09-01', closed_date: null,
    description: 'UT inspection of 4 butt welds on secondary steel frame reveals porosity exceeding AWS D1.1 acceptable limits.',
    root_cause: 'Welder qualification lapse — WPS-003 recertification was due in July but missed in scheduler.',
    corrective_action: 'Cut out and re-weld affected joints. Welder re-qualification in progress. All welds to be re-UT tested.',
    verification_required: true, cost_impact: 22_000,
  },
  {
    id: 'n8', code: 'NCR-2026-008', title: 'Cable Pulling Force Exceeded Spec on DC Run 7', discipline: 'Electrical', system: 'DC Collection',
    severity: 'minor', status: 'under_review', raised_by: 'Sarah Chen', assigned_to: 'Prysmian Group',
    raised_date: '2026-08-20', due_date: '2026-09-05', closed_date: null,
    description: 'Pulling tension log shows 8.2kN on 240mm² DC cable run 7 — spec limit is 7.5kN. Cable insulation integrity unknown.',
    root_cause: 'Conduit bend radius reduced during reroute. Crew exceeded pulling force limit without notifying QC.',
    corrective_action: 'Megger test all cables in run 7. Replace if insulation resistance < 100MΩ. Submit revised pull tension record.',
    verification_required: true, cost_impact: 5_800,
  },
  {
    id: 'n9', code: 'NCR-2026-009', title: 'Earthing Electrode Resistance Above Spec', discipline: 'Electrical', system: 'HV Substation',
    severity: 'major', status: 'closed', raised_by: 'Mohammed Hassan', assigned_to: 'ABB Power Grids',
    raised_date: '2026-07-10', due_date: '2026-07-25', closed_date: '2026-07-24',
    description: 'Earth electrode resistance measured at 12.4Ω — project spec requires ≤5Ω for primary substation earth.',
    root_cause: 'High resistivity soil in northeast substation footprint. Initial design did not account for local geology report.',
    corrective_action: 'Additional 6 x 3m earth rods installed in chemical-enhanced backfill. Re-test confirmed 3.2Ω.',
    verification_required: false, cost_impact: 18_000,
  },
  {
    id: 'n10', code: 'NCR-2026-010', title: 'Torque Verification Not Witnessed on Tracker Bolts — Block C', discipline: 'Mechanical', system: 'Tracker System',
    severity: 'minor', status: 'closed', raised_by: 'Khalid Al-Mansouri', assigned_to: 'Nextracker',
    raised_date: '2026-07-22', due_date: '2026-08-05', closed_date: '2026-08-04',
    description: 'ITP hold point for torque verification on 144 tracker torque tube bolts in Block C was progressed without QC witness.',
    root_cause: 'Miscommunication between site foreman and QC team on hold point notification procedure.',
    corrective_action: '100% re-torque with QC witness completed. Procedure re-briefed to all site foremen.',
    verification_required: false, cost_impact: 3_200,
  },
  {
    id: 'n11', code: 'NCR-2026-011', title: 'PV Module Nameplate Discrepancy — Batch 5', discipline: 'Electrical', system: 'PV Array',
    severity: 'critical', status: 'open', raised_by: 'Yuki Tanaka', assigned_to: 'Jinko Solar',
    raised_date: '2026-08-25', due_date: '2026-09-10', closed_date: null,
    description: '240 modules in Batch 5 show serialised nameplate Pmax of 575W instead of specified 580W. Potential revenue impact if installed.',
    root_cause: 'Factory batch labelling error — investigation underway by Jinko QA. Power flash test results pending.',
    corrective_action: 'Quarantine Batch 5. Await flash test data from factory. Replace if confirmed below spec; accept with deduction if within tolerance.',
    verification_required: true, cost_impact: 0,
  },
  {
    id: 'n12', code: 'NCR-2026-012', title: 'Fire Suppression Nozzle Spacing Non-Compliant in Battery Room', discipline: 'Mechanical', system: 'SCADA / Control',
    severity: 'major', status: 'closed', raised_by: 'Sarah Johnson', assigned_to: 'GridMind Engineering',
    raised_date: '2026-08-01', due_date: '2026-08-15', closed_date: '2026-08-14',
    description: 'Civil Defense inspection found 2 nozzles in the battery room at 4.8m spacing — NFPA 750 requires max 3.7m for watermist systems.',
    root_cause: 'Drawing revision 0 used by installer; revision B (which corrected spacing) was issued after fabrication.',
    corrective_action: 'Added 2 intermediate nozzles and modified pipework. Civil Defense re-inspection passed on 13 Aug.',
    verification_required: false, cost_impact: 9_500,
  },
]

const MOCK_MC_CERTS: MCCertificate[] = [
  {
    id: 'cert1', cert_number: 'MCC-2026-001', system: 'Site Infrastructure', discipline: 'Civil',
    status: 'issued', issued_date: '2026-08-30', issued_by: 'James Morgan', mc_coordinator: 'Khalid Al-Mansouri',
    punch_outstanding: 0, ncr_outstanding: 0, comments: 'All Cat-A punches closed. MC certified.',
  },
  {
    id: 'cert2', cert_number: 'MCC-2026-002', system: 'Tracker System', discipline: 'Civil & Mechanical',
    status: 'pending', issued_date: null, issued_by: '—', mc_coordinator: 'Khalid Al-Mansouri',
    punch_outstanding: 2, ncr_outstanding: 1, comments: 'Awaiting closure of NCR-2026-002 and PL-005.',
  },
  {
    id: 'cert3', cert_number: 'MCC-2026-003', system: 'DC Collection', discipline: 'Electrical',
    status: 'pending', issued_date: null, issued_by: '—', mc_coordinator: 'Sarah Chen',
    punch_outstanding: 3, ncr_outstanding: 2, comments: 'Cat-A punch items PL-001, PL-006 and NCR-001, NCR-003 outstanding.',
  },
  {
    id: 'cert4', cert_number: 'MCC-2026-004', system: 'Inverter Station', discipline: 'Mechanical & Electrical',
    status: 'draft', issued_date: null, issued_by: '—', mc_coordinator: 'Omar Al-Zaid',
    punch_outstanding: 2, ncr_outstanding: 0, comments: 'Cat-A PL-003 and PL-009 remain open.',
  },
  {
    id: 'cert5', cert_number: 'MCC-2026-005', system: 'HV Substation', discipline: 'Electrical',
    status: 'pending', issued_date: null, issued_by: '—', mc_coordinator: 'Sarah Chen',
    punch_outstanding: 0, ncr_outstanding: 0, comments: 'Awaiting structural IE sign-off.',
  },
  {
    id: 'cert6', cert_number: 'MCC-2026-006', system: 'SCADA / Control', discipline: 'SCADA',
    status: 'issued', issued_date: '2026-09-05', issued_by: 'James Morgan', mc_coordinator: 'Omar Al-Zaid',
    punch_outstanding: 0, ncr_outstanding: 0, comments: 'All NCRs closed. SCADA FAT (site) passed. MC certificate issued.',
  },
  {
    id: 'cert7', cert_number: 'MCC-2026-007', system: 'Fencing & Security', discipline: 'Civil',
    status: 'draft', issued_date: null, issued_by: '—', mc_coordinator: 'Khalid Al-Mansouri',
    punch_outstanding: 1, ncr_outstanding: 0, comments: 'Cat-B punch PL-010 (gate latch misalignment) outstanding — non-blocking.',
  },
  {
    id: 'cert8', cert_number: 'MCC-2026-008', system: 'PV Array — Blocks A-D', discipline: 'Electrical',
    status: 'pending', issued_date: null, issued_by: '—', mc_coordinator: 'Sarah Chen',
    punch_outstanding: 0, ncr_outstanding: 1, comments: 'Awaiting closure of NCR-2026-011 (Batch 5 module nameplate discrepancy).',
  },
]

const MOCK_TEST_PLANS: TestPlan[] = [
  {
    id: 'tp1', code: 'ITP-MC-001', title: 'Tracker System Mechanical Completion ITP',
    system: 'Tracker System', discipline: 'Mechanical', test_type: 'ITP',
    status: 'in_progress', planned_date: '2026-09-15', actual_date: null,
    responsible: 'Nextracker / Al Futtaim',
    steps_total: 24, steps_completed: 14, result: '14 / 24 steps signed-off',
  },
  {
    id: 'tp2', code: 'ITP-MC-002', title: 'DC Collection System ITP',
    system: 'DC Collection', discipline: 'Electrical', test_type: 'ITP',
    status: 'in_progress', planned_date: '2026-09-20', actual_date: null,
    responsible: 'Prysmian Group',
    steps_total: 18, steps_completed: 6, result: '6 / 18 steps signed-off',
  },
  {
    id: 'tp3', code: 'ITP-MC-003', title: 'PV Module Flash Test — Batch 1 ITP',
    system: 'PV Array', discipline: 'Electrical', test_type: 'Flash Test',
    status: 'passed', planned_date: '2026-08-01', actual_date: '2026-08-03',
    responsible: 'Jinko Solar',
    steps_total: 8, steps_completed: 8, result: 'All modules within ±1.5% Pmax tolerance',
  },
  {
    id: 'tp4', code: 'ITP-MC-004', title: 'Inverter Station Pre-Energisation ITP',
    system: 'Inverter Station', discipline: 'Electrical', test_type: 'ITP',
    status: 'not_started', planned_date: '2026-10-01', actual_date: null,
    responsible: 'Huawei Digital Power',
    steps_total: 32, steps_completed: 0, result: 'Awaiting Cat-A punch closure',
  },
  {
    id: 'tp5', code: 'ITP-MC-005', title: 'HV Substation Pre-Commissioning ITP',
    system: 'HV Substation', discipline: 'Electrical', test_type: 'ITP',
    status: 'not_started', planned_date: '2026-10-15', actual_date: null,
    responsible: 'ABB Power Grids / Siemens Energy',
    steps_total: 40, steps_completed: 0, result: 'Awaiting HV civil MC cert',
  },
  {
    id: 'tp6', code: 'ITP-MC-006', title: 'SCADA Factory Acceptance Test (Site)',
    system: 'SCADA / Control', discipline: 'SCADA', test_type: 'FAT (Site)',
    status: 'in_progress', planned_date: '2026-09-18', actual_date: null,
    responsible: 'ABB Power Grids',
    steps_total: 16, steps_completed: 8, result: '8 / 16 checks complete',
  },
]

// ─── Chart Data ──────────────────────────────────────────────────────────────

const PUNCH_TREND = [
  { week: 'W30', opened: 4, closed: 1, outstanding: 4 },
  { week: 'W31', opened: 3, closed: 2, outstanding: 5 },
  { week: 'W32', opened: 2, closed: 3, outstanding: 4 },
  { week: 'W33', opened: 4, closed: 2, outstanding: 6 },
  { week: 'W34', opened: 1, closed: 4, outstanding: 3 },
  { week: 'W35', opened: 2, closed: 2, outstanding: 3 },
]

const MC_PROGRESS = [
  { system: 'Site Infra',    pct: 100 },
  { system: 'Tracker Sys',  pct: 72  },
  { system: 'DC Coll.',     pct: 58  },
  { system: 'Inverter',     pct: 44  },
  { system: 'HV Substation', pct: 30  },
  { system: 'SCADA',        pct: 52  },
]

// ─── Colours / Lookup Maps ───────────────────────────────────────────────────

const INSP_STATUS: Record<InspectionStatus, { label: string; color: string; bg: string }> = {
  passed:      { label: 'Passed',      color: '#22c55e', bg: '#22c55e18' },
  failed:      { label: 'Failed',      color: '#ef4444', bg: '#ef444418' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#3b82f618' },
  scheduled:   { label: 'Scheduled',   color: '#a855f7', bg: '#a855f718' },
  hold:        { label: 'On Hold',     color: '#f59e0b', bg: '#f59e0b18' },
}

const PUNCH_STATUS: Record<PunchStatus, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: '#ef4444', bg: '#ef444418' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#3b82f618' },
  closed:      { label: 'Closed',      color: '#22c55e', bg: '#22c55e18' },
  disputed:    { label: 'Disputed',    color: '#f97316', bg: '#f9731618' },
}

const PUNCH_CAT: Record<PunchCategory, { label: string; color: string }> = {
  A: { label: 'Cat A', color: '#ef4444' },
  B: { label: 'Cat B', color: '#f59e0b' },
  C: { label: 'Cat C', color: '#22c55e' },
}

const NCR_STATUS: Record<NcrStatus, { label: string; color: string; bg: string }> = {
  open:         { label: 'Open',         color: '#ef4444', bg: '#ef444418' },
  under_review: { label: 'Under Review', color: '#f59e0b', bg: '#f59e0b18' },
  closed:       { label: 'Closed',       color: '#22c55e', bg: '#22c55e18' },
  rejected:     { label: 'Rejected',     color: '#6b7280', bg: '#6b728018' },
}

const NCR_SEV: Record<NcrSeverity, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ef4444' },
  major:    { label: 'Major',    color: '#f59e0b' },
  minor:    { label: 'Minor',    color: '#22c55e' },
}

const CERT_STATUS: Record<CertStatus, { label: string; color: string; bg: string }> = {
  issued:  { label: 'Issued',  color: '#22c55e', bg: '#22c55e18' },
  pending: { label: 'Pending', color: '#f59e0b', bg: '#f59e0b18' },
  rejected:{ label: 'Rejected',color: '#ef4444', bg: '#ef444418' },
  draft:   { label: 'Draft',   color: '#6b7280', bg: '#6b728018' },
}

const TP_STATUS: Record<TestPlan['status'], { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: '#6b7280', bg: '#6b728018' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#3b82f618' },
  passed:      { label: 'Passed',      color: '#22c55e', bg: '#22c55e18' },
  failed:      { label: 'Failed',      color: '#ef4444', bg: '#ef444418' },
}

const DISC_COLORS: Record<string, string> = {
  Civil: '#f59e0b', Electrical: '#3b82f6', Mechanical: '#22c55e',
  SCADA: '#a855f7', 'Civil & Mechanical': '#f97316', 'Mechanical & Electrical': '#06b6d4',
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, background: bg }}>
      {label}
    </span>
  )
}

function Tab({
  label, icon: Icon, active, onClick,
}: { label: string; icon: React.ElementType; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap',
        active
          ? 'bg-[#64ffda]/10 text-[#64ffda] border border-[#64ffda]/30'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
      )}>
      <Icon className="size-4 shrink-0" />
      {label}
    </button>
  )
}

function KpiCard({ label, value, sub, color = '#64ffda' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Inspections Tab ─────────────────────────────────────────────────────────

function InspectionsTab({ inspections }: { inspections: Inspection[] }) {
  const [search, setSearch]     = React.useState('')
  const [discF,  setDiscF]      = React.useState('All')
  const [statF,  setStatF]      = React.useState<InspectionStatus | 'All'>('All')
  const [detail, setDetail]     = React.useState<Inspection | null>(null)

  const disciplines = ['All', ...Array.from(new Set(inspections.map((i) => i.discipline)))]
  const filtered = inspections.filter((i) => {
    const q = search.toLowerCase()
    const matchQ = i.title.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    const matchD = discF === 'All' || i.discipline === discF
    const matchS = statF === 'All' || i.status === statF
    return matchQ && matchD && matchS
  })

  // Chart data
  const statCounts = (() => {
    const m: Record<string, number> = {}
    inspections.forEach((i) => { m[i.status] = (m[i.status] ?? 0) + 1 })
    return Object.entries(m).map(([k, v]) => ({ name: INSP_STATUS[k as InspectionStatus].label, value: v, color: INSP_STATUS[k as InspectionStatus].color }))
  })()

  const discCounts = (() => {
    const m: Record<string, number> = {}
    inspections.forEach((i) => { m[i.discipline] = (m[i.discipline] ?? 0) + 1 })
    return Object.entries(m).map(([k, v]) => ({ discipline: k, count: v }))
  })()

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Inspection Status Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statCounts} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65}
                label={({ name, percent }) => `${(name ?? '').slice(0,5)} ${((percent ?? 0)*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                {statCounts.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}`, 'Count']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Inspections by Discipline</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={discCounts} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="discipline" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v}`, 'Count']} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {discCounts.map((e) => <Cell key={e.discipline} fill={DISC_COLORS[e.discipline] ?? '#64ffda'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inspections..."
            className="w-full bg-muted/30 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
        </div>
        <select value={discF} onChange={(e) => setDiscF(e.target.value)}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={statF} onChange={(e) => setStatF(e.target.value as InspectionStatus | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Statuses</option>
          {(Object.keys(INSP_STATUS) as InspectionStatus[]).map((s) => (
            <option key={s} value={s}>{INSP_STATUS[s].label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Code','Title','System','Discipline','Type','Planned','Inspector','Status','Deficiencies',''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ins) => {
              const s = INSP_STATUS[ins.status]
              return (
                <tr key={ins.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{ins.code}</td>
                  <td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate">{ins.title}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{ins.system}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ color: DISC_COLORS[ins.discipline] ?? '#64ffda', background: `${DISC_COLORS[ins.discipline] ?? '#64ffda'}18` }}>
                      {ins.discipline}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{ins.type}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{ins.planned_date}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{ins.inspector}</td>
                  <td className="px-4 py-3"><StatusBadge {...s} /></td>
                  <td className="px-4 py-3 text-center">
                    {ins.deficiencies > 0
                      ? <span className="text-[11px] font-bold text-red-400">{ins.deficiencies}</span>
                      : <span className="text-[11px] text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setDetail(ins)}
                      className="text-xs text-[#64ffda] hover:underline">View</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detail slide-in */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setDetail(null)} />
          <div className="w-full max-w-[520px] bg-background border-l border-border shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Inspection Detail</p>
                <p className="text-base font-bold text-foreground">{detail.code}</p>
              </div>
              <button type="button" onClick={() => setDetail(null)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 px-6 py-5 space-y-5">
              <p className="text-sm font-semibold text-foreground">{detail.title}</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'System',     value: detail.system },
                  { label: 'Discipline', value: detail.discipline },
                  { label: 'Type',       value: detail.type },
                  { label: 'Inspector',  value: detail.inspector },
                  { label: 'Contractor', value: detail.contractor },
                  { label: 'Planned',    value: detail.planned_date },
                  { label: 'Actual',     value: detail.actual_date ?? '—' },
                  { label: 'Status',     value: <StatusBadge {...INSP_STATUS[detail.status]} /> },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                    <div className="text-sm text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              {detail.hold_points.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Hold Points</p>
                  <ul className="space-y-1">
                    {detail.hold_points.map((h) => (
                      <li key={h} className="flex items-center gap-2 text-xs text-foreground">
                        <span className="size-1.5 rounded-full bg-red-400 shrink-0" />{h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.witness_points.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Witness Points</p>
                  <ul className="space-y-1">
                    {detail.witness_points.map((w) => (
                      <li key={w} className="flex items-center gap-2 text-xs text-foreground">
                        <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />{w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.result_notes && (
                <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Result Notes</p>
                  <p className="text-sm text-foreground leading-relaxed">{detail.result_notes}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <Download className="size-3.5" /> Download ITP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Punch List Tab ──────────────────────────────────────────────────────────

function PunchListTab({ items }: { items: PunchItem[] }) {
  const [search,  setSearch]  = React.useState('')
  const [catF,    setCatF]    = React.useState<PunchCategory | 'All'>('All')
  const [statF,   setStatF]   = React.useState<PunchStatus | 'All'>('All')
  const [discF,   setDiscF]   = React.useState('All')
  const [detail,  setDetail]  = React.useState<PunchItem | null>(null)

  const disciplines = ['All', ...Array.from(new Set(items.map((i) => i.discipline)))]
  const filtered = items.filter((i) => {
    const q = search.toLowerCase()
    const matchQ = i.description.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    const matchC = catF === 'All' || i.category === catF
    const matchS = statF === 'All' || i.status === statF
    const matchD = discF === 'All' || i.discipline === discF
    return matchQ && matchC && matchS && matchD
  })

  // Project-level totals (full dataset — register below shows representative sample)
  const PROJECT_PUNCH_TOTAL   = 320
  const PROJECT_PUNCH_OPEN    = 45
  const PROJECT_PUNCH_CLOSED  = PROJECT_PUNCH_TOTAL - PROJECT_PUNCH_OPEN
  const PROJECT_PUNCH_CAT_A   = 12
  const PROJECT_PUNCH_CAT_B   = 28
  const PROJECT_PUNCH_CAT_C   = PROJECT_PUNCH_OPEN - PROJECT_PUNCH_CAT_A - PROJECT_PUNCH_CAT_B

  const openA  = PROJECT_PUNCH_CAT_A
  const openB  = PROJECT_PUNCH_CAT_B
  const total  = PROJECT_PUNCH_TOTAL
  const closed = PROJECT_PUNCH_CLOSED

  const catData = [
    { category: 'Cat A', open: PROJECT_PUNCH_CAT_A, closed: 88  },
    { category: 'Cat B', open: PROJECT_PUNCH_CAT_B, closed: 156 },
    { category: 'Cat C', open: PROJECT_PUNCH_CAT_C, closed: 31  },
  ]

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Items"       value={total}  sub="all categories"   />
        <KpiCard label="Open Cat A"        value={openA}  color="#ef4444"        sub="must close before MC" />
        <KpiCard label="Open Cat B"        value={openB}  color="#f59e0b"        sub="before commissioning" />
        <KpiCard label="Closed"            value={closed} color="#22c55e"        sub={`${Math.round(closed/total*100)}% closure rate`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Punch Items by Category</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={catData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="category" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="open"   name="Open"   fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="closed" name="Closed" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Weekly Punch Trend</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={PUNCH_TREND} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="opened"      name="Opened"      stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="closed"      name="Closed"      stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="outstanding" name="Outstanding" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search punch items..."
            className="w-full bg-muted/30 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
        </div>
        {(['All','A','B','C'] as (PunchCategory|'All')[]).map((c) => (
          <button key={c} type="button" onClick={() => setCatF(c)}
            className={cn('px-3 py-2 rounded-lg text-xs font-semibold border transition-colors',
              catF === c ? 'border-[#64ffda]/50 bg-[#64ffda]/10 text-[#64ffda]' : 'border-border text-muted-foreground hover:text-foreground')}>
            {c === 'All' ? 'All Cats' : `Cat ${c}`}
          </button>
        ))}
        <select value={statF} onChange={(e) => setStatF(e.target.value as PunchStatus | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Statuses</option>
          {(Object.keys(PUNCH_STATUS) as PunchStatus[]).map((s) => (
            <option key={s} value={s}>{PUNCH_STATUS[s].label}</option>
          ))}
        </select>
        <select value={discF} onChange={(e) => setDiscF(e.target.value)}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      {/* Register */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Code','Cat','Description','Discipline','System','Location','Raised','Due','Assigned To','Priority','Status',''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const ps = PUNCH_STATUS[p.status]
              const pc = PUNCH_CAT[p.category]
              const pri = p.priority === 'high' ? '#ef4444' : p.priority === 'medium' ? '#f59e0b' : '#22c55e'
              return (
                <tr key={p.id} className={cn('border-b border-border hover:bg-muted/20 transition-colors',
                  p.category === 'A' && p.status === 'open' && 'bg-red-500/3')}>
                  <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{p.code}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ color: pc.color, background: `${pc.color}20` }}>{pc.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground max-w-[240px]">
                    <p className="truncate" title={p.description}>{p.description}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ color: DISC_COLORS[p.discipline] ?? '#64ffda', background: `${DISC_COLORS[p.discipline] ?? '#64ffda'}18` }}>
                      {p.discipline}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{p.system}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px] truncate">{p.location}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.raised_date}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.due_date}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{p.assigned_to}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold capitalize px-2 py-0.5 rounded-full"
                      style={{ color: pri, background: `${pri}18` }}>{p.priority}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge {...ps} /></td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setDetail(p)}
                      className="text-xs text-[#64ffda] hover:underline">View</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Punch detail panel */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setDetail(null)} />
          <div className="w-full max-w-[540px] bg-background border-l border-border shadow-2xl flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Punch List Item</p>
                <p className="text-base font-bold text-foreground">{detail.code}
                  <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: PUNCH_CAT[detail.category].color, background: `${PUNCH_CAT[detail.category].color}20` }}>
                    {PUNCH_CAT[detail.category].label}
                  </span>
                </p>
              </div>
              <button type="button" onClick={() => setDetail(null)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            <div className="flex-1 px-6 py-5 space-y-5">
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                <p className="text-sm text-foreground leading-relaxed">{detail.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Discipline',   value: detail.discipline },
                  { label: 'System',       value: detail.system },
                  { label: 'Location',     value: detail.location },
                  { label: 'Drawing Ref',  value: detail.drawing_ref },
                  { label: 'Raised By',    value: detail.raised_by },
                  { label: 'Assigned To',  value: detail.assigned_to },
                  { label: 'Raised Date',  value: detail.raised_date },
                  { label: 'Due Date',     value: detail.due_date },
                  { label: 'Closed Date',  value: detail.closed_date ?? '—' },
                  { label: 'Status',       value: <StatusBadge {...PUNCH_STATUS[detail.status]} /> },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                    <div className="text-sm text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                {detail.status !== 'closed' && (
                  <button type="button"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 text-sm text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors">
                    <CheckCircle className="size-3.5" /> Close Item
                  </button>
                )}
                <button type="button"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <Send className="size-3.5" /> Send Notification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NCR Tab ─────────────────────────────────────────────────────────────────

function NcrTab({ ncrs }: { ncrs: NCR[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [search,   setSearch]   = React.useState('')
  const [sevF,     setSevF]     = React.useState<NcrSeverity | 'All'>('All')
  const [statF,    setStatF]    = React.useState<NcrStatus | 'All'>('All')

  const filtered = ncrs.filter((n) => {
    const q = search.toLowerCase()
    const matchQ = n.title.toLowerCase().includes(q) || n.code.toLowerCase().includes(q)
    const matchS = sevF === 'All' || n.severity === sevF
    const matchSt = statF === 'All' || n.status === statF
    return matchQ && matchS && matchSt
  })

  const totalCost = ncrs.reduce((s, n) => s + n.cost_impact, 0)
  const open      = ncrs.filter((n) => n.status === 'open').length
  const critical  = ncrs.filter((n) => n.severity === 'critical').length

  const sevData = (['critical','major','minor'] as NcrSeverity[]).map((s) => ({
    name: NCR_SEV[s].label, value: ncrs.filter((n) => n.severity === s).length, color: NCR_SEV[s].color,
  }))
  const statData = (Object.keys(NCR_STATUS) as NcrStatus[]).map((s) => ({
    name: NCR_STATUS[s].label, value: ncrs.filter((n) => n.status === s).length, color: NCR_STATUS[s].color,
  }))

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total NCRs"     value={ncrs.length}                                   />
        <KpiCard label="Open NCRs"      value={open}        color="#ef4444"                   />
        <KpiCard label="Critical"       value={critical}    color="#dc2626"                   />
        <KpiCard label="Cost Impact"    value={`$${(totalCost/1000).toFixed(0)}k`} color="#f59e0b" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">NCR by Severity</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={sevData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                label={({ name, percent }) => `${(name ?? '').slice(0,3)} ${((percent ?? 0)*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                {sevData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}`, 'Count']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">NCR by Status</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={statData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v}`, 'NCRs']} />
              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]}>
                {statData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search NCRs..."
            className="w-full bg-muted/30 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
        </div>
        <select value={sevF} onChange={(e) => setSevF(e.target.value as NcrSeverity | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Severities</option>
          {(Object.keys(NCR_SEV) as NcrSeverity[]).map((s) => (
            <option key={s} value={s}>{NCR_SEV[s].label}</option>
          ))}
        </select>
        <select value={statF} onChange={(e) => setStatF(e.target.value as NcrStatus | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Statuses</option>
          {(Object.keys(NCR_STATUS) as NcrStatus[]).map((s) => (
            <option key={s} value={s}>{NCR_STATUS[s].label}</option>
          ))}
        </select>
        <button type="button"
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
          <Plus className="size-3.5" /> Raise NCR
        </button>
      </div>

      {/* Expandable register */}
      <div className="space-y-2">
        {filtered.map((ncr) => {
          const sev  = NCR_SEV[ncr.severity]
          const stat = NCR_STATUS[ncr.status]
          const open = expanded === ncr.id
          return (
            <div key={ncr.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button type="button" onClick={() => setExpanded(open ? null : ncr.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors text-left">
                <span className="font-mono text-xs text-[#64ffda] shrink-0">{ncr.code}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{ncr.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{ncr.discipline} · {ncr.system}</p>
                </div>
                <StatusBadge {...sev} bg={`${sev.color}18`} />
                <StatusBadge {...stat} />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Due {ncr.due_date}</span>
                {open ? <ChevronUp className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
              </button>
              {open && (
                <div className="px-5 pb-5 border-t border-border space-y-4 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Description</p>
                        <p className="text-sm text-foreground leading-relaxed">{ncr.description}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Root Cause</p>
                        <p className="text-sm text-foreground leading-relaxed">{ncr.root_cause}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Corrective Action</p>
                        <p className="text-sm text-foreground leading-relaxed">{ncr.corrective_action}</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: 'Raised By',    value: ncr.raised_by },
                        { label: 'Assigned To',  value: ncr.assigned_to },
                        { label: 'Raised Date',  value: ncr.raised_date },
                        { label: 'Due Date',     value: ncr.due_date },
                        { label: 'Cost Impact',  value: ncr.cost_impact > 0 ? `$${ncr.cost_impact.toLocaleString()}` : '—' },
                        { label: 'Verification', value: ncr.verification_required ? 'Required' : 'Not required' },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">{label}</p>
                          <p className="text-sm text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {ncr.status === 'open' && (
                      <button type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400 hover:bg-amber-500/20 transition-colors">
                        <Eye className="size-3.5" /> Start Review
                      </button>
                    )}
                    {ncr.status === 'under_review' && (
                      <button type="button"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/30 text-xs text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors">
                        <CheckCircle className="size-3.5" /> Close NCR
                      </button>
                    )}
                    <button type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                      <Download className="size-3.5" /> Export PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Test Plans Tab ──────────────────────────────────────────────────────────

function TestPlansTab({ plans }: { plans: TestPlan[] }) {
  const [search, setSearch] = React.useState('')
  const [statF,  setStatF]  = React.useState<TestPlan['status'] | 'All'>('All')

  const filtered = plans.filter((p) => {
    const q = search.toLowerCase()
    const matchQ = p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
    const matchS = statF === 'All' || p.status === statF
    return matchQ && matchS
  })

  const statusData = (Object.keys(TP_STATUS) as TestPlan['status'][]).map((s) => ({
    name: TP_STATUS[s].label, value: plans.filter((p) => p.status === s).length, color: TP_STATUS[s].color,
  }))

  return (
    <div className="space-y-6">
      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">ITP Status Overview</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={statusData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="name" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value" name="Plans" radius={[4, 4, 0, 0]}>
                {statusData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">MC Readiness by System</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={MC_PROGRESS} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="system" tick={{ fontSize: 9 }} width={70} />
              <Tooltip formatter={(v) => [`${v}%`, 'MC Complete']} />
              <Bar dataKey="pct" name="MC %" radius={[0, 4, 4, 0]}>
                {MC_PROGRESS.map((e) => (
                  <Cell key={e.system} fill={e.pct >= 90 ? '#22c55e' : e.pct >= 60 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ITPs..."
            className="w-full bg-muted/30 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
        </div>
        <select value={statF} onChange={(e) => setStatF(e.target.value as TestPlan['status'] | 'All')}
          className="bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none">
          <option value="All">All Statuses</option>
          {(Object.keys(TP_STATUS) as TestPlan['status'][]).map((s) => (
            <option key={s} value={s}>{TP_STATUS[s].label}</option>
          ))}
        </select>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((tp) => {
          const ts = TP_STATUS[tp.status]
          const pct = tp.steps_total > 0 ? Math.round(tp.steps_completed / tp.steps_total * 100) : 0
          return (
            <div key={tp.id} className="rounded-xl border border-border bg-card p-5 hover:border-[#64ffda]/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="font-mono text-xs text-[#64ffda] block mb-0.5">{tp.code}</span>
                  <p className="text-sm font-semibold text-foreground leading-snug">{tp.title}</p>
                </div>
                <StatusBadge {...ts} />
              </div>
              <div className="space-y-1.5 mb-3">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Steps completed</span>
                  <span className="font-mono font-bold text-foreground">{tp.steps_completed} / {tp.steps_total}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: ts.color }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <span>System: <span className="text-foreground">{tp.system}</span></span>
                <span>Type: <span className="text-foreground">{tp.test_type}</span></span>
                <span>Planned: <span className="font-mono text-foreground">{tp.planned_date}</span></span>
                <span>By: <span className="text-foreground truncate">{tp.responsible.split('/')[0].trim()}</span></span>
              </div>
              {tp.result && (
                <p className="text-[10px] text-muted-foreground mt-2 italic">{tp.result}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MC Certificates Tab ─────────────────────────────────────────────────────

function MCCertificatesTab({ certs }: { certs: MCCertificate[] }) {
  const [issueOpen, setIssueOpen] = React.useState(false)

  const issued  = certs.filter((c) => c.status === 'issued').length
  const pending = certs.filter((c) => c.status === 'pending').length
  const certData = (Object.keys(CERT_STATUS) as CertStatus[]).map((s) => ({
    name: CERT_STATUS[s].label, value: certs.filter((c) => c.status === s).length, color: CERT_STATUS[s].color,
  }))

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Certs"  value={certs.length}                    />
        <KpiCard label="Issued"       value={issued}   color="#22c55e"        />
        <KpiCard label="Pending"      value={pending}  color="#f59e0b"        />
        <KpiCard label="MC Complete"  value={`${Math.round(issued/certs.length*100)}%`} color="#64ffda" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Certificate Status</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={certData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                label={({ name, percent }) => `${(name ?? '').slice(0,4)} ${((percent ?? 0)*100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                {certData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Outstanding Items by System</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={certs.map((c) => ({ system: c.system.split(' ')[0], punch: c.punch_outstanding, ncr: c.ncr_outstanding }))} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="system" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="punch" name="Punch Items" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ncr"   name="NCRs"        fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex justify-end">
        <button type="button" onClick={() => setIssueOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-medium text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors">
          <Award className="size-4" /> Issue MC Certificate
        </button>
      </div>

      {/* Register table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Cert No.','System','Discipline','Status','Issued Date','Issued By','MC Coordinator','Open Punch','Open NCRs','Comments'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {certs.map((cert) => {
              const cs = CERT_STATUS[cert.status]
              return (
                <tr key={cert.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{cert.cert_number}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{cert.system}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{cert.discipline}</td>
                  <td className="px-4 py-3"><StatusBadge {...cs} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{cert.issued_date ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{cert.issued_by}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{cert.mc_coordinator}</td>
                  <td className="px-4 py-3 text-center">
                    {cert.punch_outstanding > 0
                      ? <span className="text-[11px] font-bold text-amber-400">{cert.punch_outstanding}</span>
                      : <CheckCircle className="size-4 text-[#22c55e] mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cert.ncr_outstanding > 0
                      ? <span className="text-[11px] font-bold text-red-400">{cert.ncr_outstanding}</span>
                      : <CheckCircle className="size-4 text-[#22c55e] mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate" title={cert.comments}>{cert.comments}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Issue cert modal */}
      {issueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIssueOpen(false)} />
          <div className="relative bg-background border border-border rounded-2xl w-full max-w-[480px] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Issue MC Certificate</h3>
              <button type="button" onClick={() => setIssueOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            {[
              { label: 'Certificate Number', placeholder: 'e.g. MCC-2026-006' },
              { label: 'System / Scope',     placeholder: 'e.g. PV Array — Blocks A-D' },
              { label: 'MC Coordinator',     placeholder: 'Name' },
              { label: 'Issued By',          placeholder: 'Name / Organisation' },
              { label: 'Issue Date',         placeholder: 'YYYY-MM-DD', type: 'date' },
            ].map(({ label, placeholder, type }) => (
              <div key={label}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{label}</label>
                <input type={type ?? 'text'} placeholder={placeholder}
                  className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Remarks</label>
              <textarea rows={3} placeholder="Any outstanding observations or conditions..."
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none focus:ring-2 focus:ring-[#64ffda]/30" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIssueOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => setIssueOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-semibold text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors">
                Issue Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const overallMC = Math.round(MC_PROGRESS.reduce((s, r) => s + r.pct, 0) / MC_PROGRESS.length)

  return (
    <div className="space-y-6">
      {/* KPI overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Overall MC %"      value={`${overallMC}%`}  color="#64ffda"  />
        <KpiCard label="Total Inspections" value={MOCK_INSPECTIONS.length}           />
        <KpiCard label="Open Punch (A)"    value={MOCK_PUNCH_ITEMS.filter((p) => p.category === 'A' && p.status !== 'closed').length} color="#ef4444" />
        <KpiCard label="Open NCRs"         value={MOCK_NCRS.filter((n) => n.status !== 'closed').length} color="#f59e0b" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">MC Progress by System</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MC_PROGRESS} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="system" tick={{ fontSize: 9 }} width={80} />
              <Tooltip formatter={(v) => [`${v}%`, 'Complete']} />
              <Bar dataKey="pct" name="MC %" radius={[0, 4, 4, 0]}>
                {MC_PROGRESS.map((e) => (
                  <Cell key={e.system} fill={e.pct >= 90 ? '#22c55e' : e.pct >= 60 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Punch Item Closure Trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={PUNCH_TREND} margin={{ left: -20 }}>
              <defs>
                <linearGradient id="openGrad"  x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="closeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="week" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="opened"      name="Opened"      stroke="#ef4444" fill="url(#openGrad)"  strokeWidth={2} />
              <Area type="monotone" dataKey="closed"      name="Closed"      stroke="#22c55e" fill="url(#closeGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* NCR cost impact */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">NCR Cost Impact by Item (USD)</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={MOCK_NCRS.filter((n) => n.cost_impact > 0).map((n) => ({ code: n.code, cost: n.cost_impact / 1000 }))} margin={{ left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
            <XAxis dataKey="code" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `$${v}k`} />
            <Tooltip formatter={(v) => [`$${v}k`, 'Cost']} />
            <Bar dataKey="cost" name="Cost (USD k)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ─── As-Builts Tab ────────────────────────────────────────────────────────────

const AB_STATUS_META: Record<AsBuiltStatus, { label: string; color: string }> = {
  pending:            { label: 'Pending',           color: '#6b7280' },
  redlines_submitted: { label: 'Redlines Submitted', color: '#3b82f6' },
  under_review:       { label: 'Under Review',      color: '#f59e0b' },
  approved:           { label: 'Approved',          color: '#22c55e' },
  superseded:         { label: 'Superseded',        color: '#a855f7' },
}

function AsBuiltsTab({ drawings }: { drawings: AsBuilt[] }) {
  const [search,   setSearch]   = React.useState('')
  const [filter,   setFilter]   = React.useState<AsBuiltStatus | 'all'>('all')
  const [discDisc, setDiscDisc] = React.useState<string>('all')
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = React.useState(false)

  const disciplines = Array.from(new Set(drawings.map((d) => d.discipline))).sort()
  const filtered = drawings.filter((d) => {
    const q = search.toLowerCase()
    const matchQ = !q || d.drawing_number.toLowerCase().includes(q) || d.title.toLowerCase().includes(q) || d.system.toLowerCase().includes(q)
    const matchS = filter === 'all' || d.status === filter
    const matchD = discDisc === 'all' || d.discipline === discDisc
    return matchQ && matchS && matchD
  })

  const stats = {
    total:    drawings.length,
    approved: drawings.filter((d) => d.status === 'approved').length,
    pending:  drawings.filter((d) => d.status === 'pending').length,
    review:   drawings.filter((d) => d.status === 'under_review' || d.status === 'redlines_submitted').length,
  }

  return (
    <div className="space-y-6">

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Drawings', value: stats.total,    color: '#64ffda' },
          { label: 'Approved',       value: stats.approved, color: '#22c55e' },
          { label: 'Under Review',   value: stats.review,   color: '#f59e0b' },
          { label: 'Pending Upload', value: stats.pending,  color: '#6b7280' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Status distribution bar */}
      {(() => {
        const statusOrder: AsBuiltStatus[] = ['approved', 'under_review', 'redlines_submitted', 'pending', 'superseded']
        const counts = statusOrder.map((s) => ({ status: s, count: drawings.filter((d) => d.status === s).length, ...AB_STATUS_META[s] }))
        return (
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">As-Built Status Distribution</p>
            <div className="flex h-4 rounded-full overflow-hidden gap-px">
              {counts.filter((c) => c.count > 0).map((c) => (
                <div key={c.status} title={`${c.label}: ${c.count}`}
                  style={{ width: `${(c.count / drawings.length) * 100}%`, background: c.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {counts.filter((c) => c.count > 0).map((c) => (
                <div key={c.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-full inline-block" style={{ background: c.color }} />
                  {c.label} ({c.count})
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Filters + upload button */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drawings…"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-muted/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#64ffda]/40 w-52" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as AsBuiltStatus | 'all')}
            className="px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-sm text-foreground focus:outline-none">
            <option value="all">All Statuses</option>
            {(Object.keys(AB_STATUS_META) as AsBuiltStatus[]).map((s) => (
              <option key={s} value={s}>{AB_STATUS_META[s].label}</option>
            ))}
          </select>
          <select value={discDisc} onChange={(e) => setDiscDisc(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-sm text-foreground focus:outline-none">
            <option value="all">All Disciplines</option>
            {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-medium text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors whitespace-nowrap">
          <Upload className="size-3.5" /> Upload As-Built
        </button>
      </div>

      {/* Drawing register */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['', 'Drawing No.', 'Title', 'Discipline', 'System', 'IFC Rev', 'AB Rev', 'Status', 'Redlines', 'Approved By', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const meta   = AB_STATUS_META[d.status]
              const isOpen = expanded === d.id
              const openRL = d.redlines.filter((r) => r.status === 'open').length
              return (
                <React.Fragment key={d.id}>
                  <tr className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-2 py-3">
                      {d.redlines.length > 0 && (
                        <button type="button" onClick={() => setExpanded(isOpen ? null : d.id)}
                          className="text-muted-foreground hover:text-foreground">
                          {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{d.drawing_number}</td>
                    <td className="px-4 py-3 text-sm text-foreground max-w-[220px] truncate" title={d.title}>{d.title}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">{d.discipline}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{d.system}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-foreground text-center">{d.original_ifc_rev}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#64ffda] text-center">{d.as_built_rev ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: meta.color, background: `${meta.color}18` }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {d.redlines.length > 0 ? (
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                          openRL > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400')}>
                          {d.redlines.length} ({openRL} open)
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{d.approved_by ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {d.file_url
                          ? <button type="button" className="text-xs text-[#64ffda] hover:underline flex items-center gap-1"><Download className="size-3" /> Download</button>
                          : <button type="button" onClick={() => setUploadOpen(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Upload className="size-3" /> Upload</button>
                        }
                        {d.linked_punch_items.length > 0 && (
                          <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Link2 className="size-2.5" />{d.linked_punch_items.length} PL
                          </span>
                        )}
                        {d.linked_ncrs.length > 0 && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Link2 className="size-2.5" />{d.linked_ncrs.length} NCR
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Redlines sub-table */}
                  {isOpen && d.redlines.length > 0 && (
                    <tr className="border-b border-border bg-amber-500/5">
                      <td colSpan={11} className="px-6 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5">
                          <Pencil className="size-3" /> Redlines / Markups
                        </p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                              {['Description', 'Area', 'Marked Up By', 'Date', 'Status'].map((h) => (
                                <th key={h} className="py-1.5 pr-4 text-left font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {d.redlines.map((rl) => {
                              const rlColors = { open: '#f59e0b', incorporated: '#22c55e', rejected: '#ef4444' }
                              return (
                                <tr key={rl.id} className="border-b border-border/50 last:border-0">
                                  <td className="py-2 pr-4 text-foreground max-w-[280px]">{rl.description}</td>
                                  <td className="py-2 pr-4 text-muted-foreground font-mono text-[11px]">{rl.area}</td>
                                  <td className="py-2 pr-4 text-muted-foreground">{rl.markup_by}</td>
                                  <td className="py-2 pr-4 font-mono text-muted-foreground">{rl.markup_date}</td>
                                  <td className="py-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold capitalize"
                                      style={{ color: rlColors[rl.status], background: `${rlColors[rl.status]}18` }}>
                                      {rl.status}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">No drawings match the current filters.</div>
        )}
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setUploadOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Upload As-Built Drawing</h3>
              <button type="button" onClick={() => setUploadOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            {[
              { label: 'Drawing Number', type: 'text',   placeholder: 'e.g. CIV-001-001' },
              { label: 'Title',          type: 'text',   placeholder: 'Drawing title' },
              { label: 'Discipline',     type: 'text',   placeholder: 'e.g. Civil, Electrical' },
              { label: 'As-Built Rev',   type: 'text',   placeholder: 'e.g. AB1' },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">{f.label}</label>
                <input type={f.type} placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#64ffda]/40" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">File (PDF / DWG)</label>
              <div className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-border bg-muted/10 text-muted-foreground text-sm hover:border-[#64ffda]/40 transition-colors cursor-pointer">
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  <Upload className="size-5" />
                  <span>Click or drag to upload</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setUploadOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => setUploadOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-medium text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const MOCK_AS_BUILTS: AsBuilt[] = [
  {
    id: 'ab1', drawing_number: 'CIV-001-001', title: 'Site General Arrangement — As-Built',
    discipline: 'Civil', revision: 'AB1', system: 'Site Infrastructure',
    status: 'approved', original_ifc_rev: 'C', as_built_rev: 'AB1',
    prepared_by: 'Al Futtaim Carillion', reviewed_by: 'Khalid Al-Mansouri', approved_by: 'James Morgan',
    submitted_date: '2026-09-01', approved_date: '2026-09-10', file_url: null,
    linked_punch_items: [], linked_ncrs: [],
    redlines: [
      { id: 'rl1', description: 'North access road shifted 2m east from IFC due to existing utility conflict', markup_by: 'Al Futtaim', markup_date: '2026-08-28', area: 'North Perimeter', status: 'incorporated' },
      { id: 'rl2', description: 'Additional drainage channel added at N-12 grid intersection', markup_by: 'Site Surveyor', markup_date: '2026-08-30', area: 'Grid N-12', status: 'incorporated' },
    ],
  },
  {
    id: 'ab2', drawing_number: 'ELE-DC-101', title: 'DC Collection Cable Tray Layout — As-Built',
    discipline: 'Electrical', revision: 'AB1', system: 'DC Collection',
    status: 'under_review', original_ifc_rev: 'B', as_built_rev: 'AB1',
    prepared_by: 'Prysmian Group', reviewed_by: null, approved_by: null,
    submitted_date: '2026-09-05', approved_date: null, file_url: null,
    linked_punch_items: ['p1', 'p2'], linked_ncrs: ['n2'],
    redlines: [
      { id: 'rl3', description: 'Corrected cable tray spacing at Row J sections 12-18 per NCR-MC-002 corrective action', markup_by: 'Prysmian', markup_date: '2026-09-03', area: 'Row J S12-18', status: 'incorporated' },
    ],
  },
  {
    id: 'ab3', drawing_number: 'MEC-TRK-201', title: 'Tracker Pile Layout — As-Built',
    discipline: 'Mechanical', revision: 'AB1', system: 'Tracker System',
    status: 'redlines_submitted', original_ifc_rev: 'A', as_built_rev: null,
    prepared_by: 'Nextracker', reviewed_by: null, approved_by: null,
    submitted_date: '2026-09-08', approved_date: null, file_url: null,
    linked_punch_items: [], linked_ncrs: [],
    redlines: [
      { id: 'rl4', description: '14 piles repositioned up to 300mm for dune terrain — within tolerance per spec', markup_by: 'Nextracker Field', markup_date: '2026-09-07', area: 'Blocks A, C, F', status: 'open' },
      { id: 'rl5', description: 'Torque arm angle adjusted 2° on 8 units in dune transition zone', markup_by: 'Nextracker Field', markup_date: '2026-09-07', area: 'Block F North', status: 'open' },
    ],
  },
  {
    id: 'ab4', drawing_number: 'ELE-SLD-001', title: '33kV Single Line Diagram — As-Built',
    discipline: 'Electrical', revision: 'AB1', system: 'HV Substation',
    status: 'pending', original_ifc_rev: 'A', as_built_rev: null,
    prepared_by: 'ABB Power Grids', reviewed_by: null, approved_by: null,
    submitted_date: null, approved_date: null, file_url: null,
    linked_punch_items: [], linked_ncrs: ['n4'],
    redlines: [],
  },
  {
    id: 'ab5', drawing_number: 'INS-001-001', title: 'Instrument Index — As-Built',
    discipline: 'Instrumentation', revision: 'AB1', system: 'SCADA / Control',
    status: 'pending', original_ifc_rev: 'A', as_built_rev: null,
    prepared_by: 'ABB Power Grids', reviewed_by: null, approved_by: null,
    submitted_date: null, approved_date: null, file_url: null,
    linked_punch_items: [], linked_ncrs: [],
    redlines: [],
  },
  {
    id: 'ab6', drawing_number: 'PRO-PID-001', title: 'P&ID Cooling Water System — As-Built',
    discipline: 'Process', revision: 'AB2', system: 'Cooling Water',
    status: 'approved', original_ifc_rev: 'B', as_built_rev: 'AB2',
    prepared_by: 'GridMind Engineering', reviewed_by: 'Omar Al-Zaid', approved_by: 'Aisha Al-Rashidi',
    submitted_date: '2026-08-20', approved_date: '2026-08-29', file_url: null,
    linked_punch_items: [], linked_ncrs: [],
    redlines: [
      { id: 'rl6', description: 'Pipe routing of CW-RET-002 modified to avoid structural clash at column C-14', markup_by: 'GridMind Eng', markup_date: '2026-08-18', area: 'Column C-14', status: 'incorporated' },
    ],
  },
  {
    id: 'ab7', drawing_number: 'CIV-FDN-301', title: 'Substation Foundation As-Built',
    discipline: 'Civil', revision: 'AB1', system: 'HV Substation',
    status: 'superseded', original_ifc_rev: 'B', as_built_rev: 'AB1',
    prepared_by: 'Al Futtaim Carillion', reviewed_by: 'Khalid Al-Mansouri', approved_by: null,
    submitted_date: '2026-07-30', approved_date: null, file_url: null,
    linked_punch_items: [], linked_ncrs: [],
    redlines: [],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'inspections', label: 'Inspections',    icon: Eye           },
  { id: 'punch',       label: 'Punch List',     icon: ClipboardList },
  { id: 'ncr',         label: 'NCRs',           icon: AlertCircle   },
  { id: 'testplans',   label: 'Test Plans',     icon: CheckSquare   },
  { id: 'certs',       label: 'MC Certificates', icon: Award        },
  { id: 'asbuilts',    label: 'As-Builts',      icon: FolderOpen    },
  { id: 'analytics',   label: 'Analytics',      icon: BarChart2     },
] as const

type TabId = typeof TABS[number]['id']

export default function G5MechanicalCompletionPage() {
  const params    = useParams()
  const projectId = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? 'demo')
  const [activeTab, setActiveTab] = React.useState<TabId>('inspections')

  const totalMC     = Math.round(MC_PROGRESS.reduce((s, r) => s + r.pct, 0) / MC_PROGRESS.length)
  const openPunchA  = MOCK_PUNCH_ITEMS.filter((p) => p.category === 'A' && p.status !== 'closed').length
  const openNcrs    = MOCK_NCRS.filter((n) => n.status !== 'closed').length
  const issuedCerts = MOCK_MC_CERTS.filter((c) => c.status === 'issued').length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/projects" className="hover:text-foreground transition-colors">Projects</Link>
          <ChevronRight className="size-4" />
          <Link href={`/projects/${projectId}`} className="hover:text-foreground transition-colors font-mono text-xs">{projectId}</Link>
          <ChevronRight className="size-4" />
          <span className="text-foreground font-medium">G5 Mechanical Completion</span>
        </nav>

        {/* Phase gate stepper */}
        <PhaseGateStepper currentGate="G5" completedGates={['G0','G1','G2','G3','G4']} />

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">G5 Mechanical Completion</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Inspections · Punch Lists · NCRs · Test Plans · MC Certificates
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <FileText className="size-4" /> ITP Register
            </button>
            <button type="button"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
              <Download className="size-4" /> Export Report
            </button>
            <button type="button"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-medium text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors">
              <Plus className="size-4" /> New Inspection
            </button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Overall MC %"     value={`${totalMC}%`}   color="#64ffda"  sub="across all systems"   />
          <KpiCard label="Open Cat-A Punch" value={openPunchA}       color="#ef4444"  sub="blocks MC certificate" />
          <KpiCard label="Open NCRs"        value={openNcrs}         color="#f59e0b"  sub={`${MOCK_NCRS.filter((n) => n.severity === 'critical').length} critical`} />
          <KpiCard label="MC Certs Issued"  value={`${issuedCerts}/${MOCK_MC_CERTS.length}`} color="#22c55e" sub="systems certified" />
        </div>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          {TABS.map((t) => (
            <Tab key={t.id} label={t.label} icon={t.icon} active={activeTab === t.id}
              onClick={() => setActiveTab(t.id)} />
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'inspections' && <InspectionsTab    inspections={MOCK_INSPECTIONS} />}
          {activeTab === 'punch'       && <PunchListTab      items={MOCK_PUNCH_ITEMS}        />}
          {activeTab === 'ncr'         && <NcrTab            ncrs={MOCK_NCRS}                />}
          {activeTab === 'testplans'   && <TestPlansTab      plans={MOCK_TEST_PLANS}         />}
          {activeTab === 'certs'       && <MCCertificatesTab certs={MOCK_MC_CERTS}           />}
          {activeTab === 'asbuilts'    && <AsBuiltsTab       drawings={MOCK_AS_BUILTS}       />}
          {activeTab === 'analytics'   && <AnalyticsTab                                      />}
        </div>

      </div>
    </div>
  )
}
