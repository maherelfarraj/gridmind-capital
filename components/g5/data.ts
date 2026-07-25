// G5 Mechanical Completion — mock data, chart data, and colour maps

import type {
  Inspection, PunchItem, NCR, MCCertificate, TestPlan, AsBuilt,
  InspectionStatus, PunchStatus, PunchCategory, NcrStatus, NcrSeverity,
  CertStatus, AsBuiltStatus,
} from './types'

// ─── Colour / Lookup Maps ────────────────────────────────────────────────────

export const INSP_STATUS: Record<InspectionStatus, { label: string; color: string; bg: string }> = {
  passed:      { label: 'Passed',      color: '#22c55e', bg: '#22c55e18' },
  failed:      { label: 'Failed',      color: '#ef4444', bg: '#ef444418' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#3b82f618' },
  scheduled:   { label: 'Scheduled',   color: '#a855f7', bg: '#a855f718' },
  hold:        { label: 'On Hold',     color: '#f59e0b', bg: '#f59e0b18' },
}

export const PUNCH_STATUS: Record<PunchStatus, { label: string; color: string; bg: string }> = {
  open:        { label: 'Open',        color: '#ef4444', bg: '#ef444418' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#3b82f618' },
  closed:      { label: 'Closed',      color: '#22c55e', bg: '#22c55e18' },
  disputed:    { label: 'Disputed',    color: '#f97316', bg: '#f9731618' },
}

export const PUNCH_CAT: Record<PunchCategory, { label: string; color: string }> = {
  A: { label: 'Cat A', color: '#ef4444' },
  B: { label: 'Cat B', color: '#f59e0b' },
  C: { label: 'Cat C', color: '#22c55e' },
}

export const NCR_STATUS: Record<NcrStatus, { label: string; color: string; bg: string }> = {
  open:         { label: 'Open',         color: '#ef4444', bg: '#ef444418' },
  under_review: { label: 'Under Review', color: '#f59e0b', bg: '#f59e0b18' },
  closed:       { label: 'Closed',       color: '#22c55e', bg: '#22c55e18' },
  rejected:     { label: 'Rejected',     color: '#6b7280', bg: '#6b728018' },
}

export const NCR_SEV: Record<NcrSeverity, { label: string; color: string }> = {
  critical: { label: 'Critical', color: '#ef4444' },
  major:    { label: 'Major',    color: '#f59e0b' },
  minor:    { label: 'Minor',    color: '#22c55e' },
}

export const CERT_STATUS: Record<CertStatus, { label: string; color: string; bg: string }> = {
  issued:   { label: 'Issued',   color: '#22c55e', bg: '#22c55e18' },
  pending:  { label: 'Pending',  color: '#f59e0b', bg: '#f59e0b18' },
  rejected: { label: 'Rejected', color: '#ef4444', bg: '#ef444418' },
  draft:    { label: 'Draft',    color: '#6b7280', bg: '#6b728018' },
}

export const TP_STATUS: Record<TestPlan['status'], { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: '#6b7280', bg: '#6b728018' },
  in_progress: { label: 'In Progress', color: '#3b82f6', bg: '#3b82f618' },
  passed:      { label: 'Passed',      color: '#22c55e', bg: '#22c55e18' },
  failed:      { label: 'Failed',      color: '#ef4444', bg: '#ef444418' },
}

export const DISC_COLORS: Record<string, string> = {
  Civil: '#f59e0b', Electrical: '#3b82f6', Mechanical: '#22c55e',
  SCADA: '#a855f7', 'Civil & Mechanical': '#f97316', 'Mechanical & Electrical': '#06b6d4',
}

export const AB_STATUS_META: Record<string, { label: string; color: string }> = {
  pending:            { label: 'Pending',            color: '#6b7280' },
  redlines_submitted: { label: 'Redlines Submitted', color: '#3b82f6' },
  under_review:       { label: 'Under Review',       color: '#f59e0b' },
  approved:           { label: 'Approved',           color: '#22c55e' },
  superseded:         { label: 'Superseded',         color: '#a855f7' },
}
export const AB_STATUS_FALLBACK = (raw: string): { label: string; color: string } => ({
  label: raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown',
  color: '#94a3b8',
})

// ─── Chart Data ──────────────────────────────────────────────────────────────

export const PUNCH_TREND = [
  { week: 'W30', opened: 4, closed: 1, outstanding: 4 },
  { week: 'W31', opened: 3, closed: 2, outstanding: 5 },
  { week: 'W32', opened: 2, closed: 3, outstanding: 4 },
  { week: 'W33', opened: 4, closed: 2, outstanding: 6 },
  { week: 'W34', opened: 1, closed: 4, outstanding: 3 },
  { week: 'W35', opened: 2, closed: 2, outstanding: 3 },
]

export const MC_PROGRESS = [
  { system: 'Site Infra',    pct: 100 },
  { system: 'Tracker Sys',  pct: 72  },
  { system: 'DC Coll.',     pct: 58  },
  { system: 'Inverter',     pct: 44  },
  { system: 'HV Substation', pct: 30 },
  { system: 'SCADA',        pct: 52  },
]

// ─── Mock Data ───────────────────────────────────────────────────────────────

export const MOCK_INSPECTIONS: Inspection[] = [
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

export const MOCK_PUNCH_ITEMS: PunchItem[] = [
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

export const MOCK_NCRS: NCR[] = [
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
    root_cause: 'Drawing revision 0 used by installer; revision B (which corrected spacing) was issued after fabrication commenced.',
    corrective_action: 'Added 2 intermediate nozzles and modified pipework. Civil Defense re-inspection passed on 13 Aug.',
    verification_required: false, cost_impact: 9_500,
  },
]

export const MOCK_MC_CERTS: MCCertificate[] = [
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

export const MOCK_TEST_PLANS: TestPlan[] = [
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

export const MOCK_AS_BUILTS: AsBuilt[] = [
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
