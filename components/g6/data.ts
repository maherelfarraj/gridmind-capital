// ─── G6 Commissioning Completion — Mock Data & Meta Maps ────────────────────
import type {
  TestPackage, PerformanceTest, Energization, CommFailure, TrainingRecord, CommDoc,
  TestPackageStatus, TestPriority, TestSystem, PerfTestStatus,
  EnergizationStatus, FailureStatus, FailureSeverity, TrainingStatus, DocStatus,
} from './types'

// ─── Meta Maps ───────────────────────────────────────────────────────────────

export const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  not_started:     { label: 'Not Started',     color: '#475569', bg: '#f1f5f9' },
  in_progress:     { label: 'In Progress',     color: '#d97706', bg: '#fef3c7' },
  complete:        { label: 'Complete',        color: '#16a34a', bg: '#dcfce7' },
  failed:          { label: 'Failed',          color: '#dc2626', bg: '#fee2e2' },
  retest_required: { label: 'Retest Required', color: '#ea580c', bg: '#ffedd5' },
}

export const PRIORITY_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#991b1b', bg: '#fecaca' },
  high:     { label: 'High',     color: '#ea580c', bg: '#ffedd5' },
  medium:   { label: 'Medium',   color: '#d97706', bg: '#fef3c7' },
  low:      { label: 'Low',      color: '#16a34a', bg: '#dcfce7' },
}

export const SYSTEM_META: Record<string, { label: string; color: string; bg: string }> = {
  turbine_generator:       { label: 'Turbine Generator',       color: '#c2410c', bg: '#ffedd5' },
  cooling_water:           { label: 'Cooling Water',           color: '#1d4ed8', bg: '#dbeafe' },
  electrical_power:        { label: 'Electrical Power',        color: '#a16207', bg: '#fef9c3' },
  control_instrumentation: { label: 'Control & Instrumentation', color: '#7c3aed', bg: '#ede9fe' },
  fuel_supply:             { label: 'Fuel Supply',             color: '#dc2626', bg: '#fee2e2' },
  hvac:                    { label: 'HVAC',                    color: '#0369a1', bg: '#e0f2fe' },
  fire_protection:         { label: 'Fire Protection',         color: '#be123c', bg: '#ffe4e6' },
  water_treatment:         { label: 'Water Treatment',         color: '#0e7490', bg: '#cffafe' },
}

export const PERF_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  not_started:       { label: 'Not Started',       color: '#475569', bg: '#f1f5f9' },
  pending:           { label: 'Pending',           color: '#475569', bg: '#f1f5f9' },
  pass:              { label: 'Pass',              color: '#16a34a', bg: '#dcfce7' },
  failed:            { label: 'Failed',            color: '#dc2626', bg: '#fee2e2' },
  within_tolerance:  { label: 'Within Tolerance',  color: '#d97706', bg: '#fef3c7' },
  exceeds_guarantee: { label: 'Exceeds Guarantee', color: '#16a34a', bg: '#dcfce7' },
}

export const ENRG_STATUS_META: Record<EnergizationStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: '#475569', bg: '#f1f5f9' },
  scheduled:   { label: 'Scheduled',   color: '#7c3aed', bg: '#ede9fe' },
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#fef3c7' },
  complete:    { label: 'Complete',    color: '#16a34a', bg: '#dcfce7' },
  hold:        { label: 'Hold',        color: '#dc2626', bg: '#fee2e2' },
}

export const FAIL_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:                { label: 'Open',                color: '#dc2626', bg: '#fee2e2' },
  under_investigation: { label: 'Under Investigation', color: '#d97706', bg: '#fef3c7' },
  corrective_action:   { label: 'Corrective Action',   color: '#7c3aed', bg: '#ede9fe' },
  retest_pending:      { label: 'Retest Pending',      color: '#0369a1', bg: '#dbeafe' },
  closed:              { label: 'Closed',              color: '#16a34a', bg: '#dcfce7' },
}

export const FAIL_SEV_META: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: '#991b1b', bg: '#fecaca' },
  major:    { label: 'Major',    color: '#dc2626', bg: '#fee2e2' },
  minor:    { label: 'Minor',    color: '#d97706', bg: '#fef3c7' },
}

export const TRAIN_STATUS_META: Record<TrainingStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Not Started', color: '#475569', bg: '#f1f5f9' },
  in_progress: { label: 'In Progress', color: '#d97706', bg: '#fef3c7' },
  complete:    { label: 'Complete',    color: '#16a34a', bg: '#dcfce7' },
  expired:     { label: 'Expired',     color: '#dc2626', bg: '#fee2e2' },
}

export const DOC_STATUS_META: Record<DocStatus, { label: string; color: string; bg: string }> = {
  pending:      { label: 'Pending',      color: '#475569', bg: '#f1f5f9' },
  draft:        { label: 'Draft',        color: '#7c3aed', bg: '#ede9fe' },
  under_review: { label: 'Under Review', color: '#d97706', bg: '#fef3c7' },
  approved:     { label: 'Approved',     color: '#16a34a', bg: '#dcfce7' },
  superseded:   { label: 'Superseded',   color: '#9ca3af', bg: '#f3f4f6' },
}

/** Fallback for any map with `{ label, color, bg }` shape. */
export const META_FALLBACK = (raw: string): { label: string; color: string; bg: string } => ({
  label: raw ? raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown',
  color: '#64748b',
  bg: '#f1f5f9',
})

// ─── Mock Test Packages ──────────────────────────────────────────────────────

export const MOCK_TEST_PACKAGES: TestPackage[] = [
  {
    id: 'tp1', code: 'TP-001', title: 'Turbine Generator Commissioning',
    description: 'Full commissioning of the main turbine generator unit including mechanical run-up, load rejection tests, and protection relay coordination.',
    system: 'turbine_generator', priority: 'critical', status: 'in_progress',
    tests_total: 15, tests_complete: 12, pass: 10, fail: 2, retest: 0,
    next_test: 'T-012: Load Test at 50%', lead: 'Rachel Green', updated: '3 hours ago',
    planned_start: '2026-08-01', planned_end: '2026-09-15',
    actual_start: '2026-08-03', actual_end: null,
    ref_docs: ['PROC-TG-001', 'DRW-TG-SLD-001', 'SPEC-TG-PERF-001'],
    procedures: [
      { id: 'p1', description: 'Mechanical run-up to 3,000 rpm', method: 'Tachometer measurement', standard: 'IEC 60034', acceptance_criteria: 'No abnormal vibration >2.5mm/s', prerequisites: [], status: 'complete' },
      { id: 'p2', description: 'Load rejection test at 100%', method: 'Governor response analysis', standard: 'IEEE C37.106', acceptance_criteria: 'Speed rise <10% within 5s', prerequisites: ['p1'], status: 'in_progress' },
      { id: 'p3', description: 'Protection relay coordination', method: 'Secondary injection', standard: 'IEC 60255', acceptance_criteria: 'All relay settings per coordination study', prerequisites: ['p1'], status: 'pending' },
    ],
    records: [
      { id: 'r1', test_id: 'T-001', date: '2026-08-05', technician: 'James Park', result: 'pass', value: 1.8, unit: 'mm/s', acceptance_min: null, acceptance_max: 2.5, certificate: 'CERT-T001' },
      { id: 'r2', test_id: 'T-002', date: '2026-08-10', technician: 'James Park', result: 'fail', value: 12.3, unit: '%', acceptance_min: null, acceptance_max: 10, certificate: null },
    ],
    failures: [
      { id: 'f1', test_id: 'T-002', description: 'Speed rise exceeded 10% limit during load rejection — 12.3% measured', root_cause: 'Governor valve response delay due to hydraulic oil viscosity at ambient temperature', corrective_action: 'Governor valve actuator tuning and hydraulic oil grade change', retest_result: null, ncr_ref: 'NCR-G6-001' },
    ],
    sign_offs: [
      { role: 'Lead Engineer', name: 'Rachel Green', date: null, status: 'pending' },
      { role: 'QAQC', name: 'Khalid Al-Mansouri', date: null, status: 'pending' },
      { role: 'Client', name: 'Omar Al-Zaid', date: null, status: 'pending' },
      { role: 'Third Party', name: 'Bureau Veritas', date: null, status: 'pending' },
      { role: 'Commissioning Manager', name: 'James Morgan', date: null, status: 'pending' },
    ],
  },
  {
    id: 'tp2', code: 'TP-002', title: 'Cooling Water System Commissioning',
    description: 'Commissioning of the closed-cycle cooling water system including pump performance, heat exchanger efficiency, and flow balancing.',
    system: 'cooling_water', priority: 'high', status: 'complete',
    tests_total: 15, tests_complete: 15, pass: 15, fail: 0, retest: 0,
    next_test: null, lead: 'Tom Baker', updated: '2 days ago',
    planned_start: '2026-07-15', planned_end: '2026-08-15',
    actual_start: '2026-07-16', actual_end: '2026-08-14',
    ref_docs: ['PROC-CW-001', 'SPEC-CW-FLOW-001'],
    procedures: [],
    records: [],
    failures: [],
    sign_offs: [
      { role: 'Lead Engineer', name: 'Tom Baker', date: '2026-08-14', status: 'signed' },
      { role: 'QAQC', name: 'Khalid Al-Mansouri', date: '2026-08-14', status: 'signed' },
      { role: 'Client', name: 'Omar Al-Zaid', date: '2026-08-15', status: 'signed' },
      { role: 'Third Party', name: 'Bureau Veritas', date: '2026-08-15', status: 'signed' },
      { role: 'Commissioning Manager', name: 'James Morgan', date: '2026-08-15', status: 'signed' },
    ],
  },
  {
    id: 'tp3', code: 'TP-003', title: 'Electrical Power System Commissioning',
    description: 'Full HV/MV power system commissioning including switchgear testing, transformer oil tests, protection relay settings, and HV synchronization.',
    system: 'electrical_power', priority: 'critical', status: 'in_progress',
    tests_total: 18, tests_complete: 10, pass: 8, fail: 2, retest: 0,
    next_test: 'T-011: HV Synchronization', lead: 'Sarah Chen', updated: '1 hour ago',
    planned_start: '2026-08-01', planned_end: '2026-09-20',
    actual_start: '2026-08-04', actual_end: null,
    ref_docs: ['PROC-ELE-SLD-001', 'SPEC-PROT-001'],
    procedures: [],
    records: [],
    failures: [
      { id: 'f3', test_id: 'T-007', description: 'Protection relay trip time 95ms — spec ≤80ms', root_cause: 'Relay setting calculation error in coordination study rev A', corrective_action: 'Updated relay settings per revised coordination study rev B', retest_result: 'Pending', ncr_ref: null },
    ],
    sign_offs: [
      { role: 'Lead Engineer', name: 'Sarah Chen', date: null, status: 'pending' },
      { role: 'QAQC', name: 'Khalid Al-Mansouri', date: null, status: 'pending' },
      { role: 'Client', name: 'Omar Al-Zaid', date: null, status: 'pending' },
      { role: 'Third Party', name: 'Bureau Veritas', date: null, status: 'pending' },
      { role: 'Commissioning Manager', name: 'James Morgan', date: null, status: 'pending' },
    ],
  },
  {
    id: 'tp4', code: 'TP-004', title: 'Control & Instrumentation Commissioning',
    description: 'DCS loop checks, SCADA integration testing, instrument calibration verification, and control room acceptance testing.',
    system: 'control_instrumentation', priority: 'high', status: 'in_progress',
    tests_total: 12, tests_complete: 8, pass: 7, fail: 1, retest: 0,
    next_test: 'T-009: DCS Loop Check — Turbine Trip', lead: 'Rachel Green', updated: '5 hours ago',
    planned_start: '2026-08-10', planned_end: '2026-09-10',
    actual_start: '2026-08-12', actual_end: null,
    ref_docs: ['PROC-DCS-001', 'SPEC-SCADA-001'],
    procedures: [],
    records: [],
    failures: [],
    sign_offs: [
      { role: 'Lead Engineer', name: 'Rachel Green', date: null, status: 'pending' },
      { role: 'QAQC', name: 'Khalid Al-Mansouri', date: null, status: 'pending' },
      { role: 'Client', name: 'Omar Al-Zaid', date: null, status: 'pending' },
      { role: 'Third Party', name: 'Bureau Veritas', date: null, status: 'pending' },
      { role: 'Commissioning Manager', name: 'James Morgan', date: null, status: 'pending' },
    ],
  },
  {
    id: 'tp5', code: 'TP-005', title: 'Fuel Supply System Commissioning',
    description: 'Natural gas supply system pressure testing, emergency shutdown valve testing, and fuel flow metering calibration.',
    system: 'fuel_supply', priority: 'medium', status: 'not_started',
    tests_total: 10, tests_complete: 0, pass: 0, fail: 0, retest: 0,
    next_test: null, lead: 'David Lee', updated: '1 week ago',
    planned_start: '2026-09-01', planned_end: '2026-09-20',
    actual_start: null, actual_end: null,
    ref_docs: ['PROC-GAS-001'],
    procedures: [],
    records: [],
    failures: [],
    sign_offs: [
      { role: 'Lead Engineer', name: 'David Lee', date: null, status: 'pending' },
      { role: 'QAQC', name: 'Khalid Al-Mansouri', date: null, status: 'pending' },
      { role: 'Client', name: 'Omar Al-Zaid', date: null, status: 'pending' },
      { role: 'Third Party', name: 'Bureau Veritas', date: null, status: 'pending' },
      { role: 'Commissioning Manager', name: 'James Morgan', date: null, status: 'pending' },
    ],
  },
  {
    id: 'tp6', code: 'TP-006', title: 'HVAC System Commissioning',
    description: 'Air handling unit commissioning, duct leakage testing, balancing, and control integration.',
    system: 'hvac', priority: 'low', status: 'complete',
    tests_total: 8, tests_complete: 8, pass: 8, fail: 0, retest: 0,
    next_test: null, lead: 'Mike Ross', updated: '4 days ago',
    planned_start: '2026-07-20', planned_end: '2026-08-10',
    actual_start: '2026-07-21', actual_end: '2026-08-09',
    ref_docs: ['PROC-HVAC-001'],
    procedures: [],
    records: [],
    failures: [],
    sign_offs: [
      { role: 'Lead Engineer', name: 'Mike Ross', date: '2026-08-09', status: 'signed' },
      { role: 'QAQC', name: 'Khalid Al-Mansouri', date: '2026-08-10', status: 'signed' },
      { role: 'Client', name: 'Omar Al-Zaid', date: '2026-08-10', status: 'signed' },
      { role: 'Third Party', name: 'Bureau Veritas', date: '2026-08-10', status: 'signed' },
      { role: 'Commissioning Manager', name: 'James Morgan', date: '2026-08-10', status: 'signed' },
    ],
  },
  {
    id: 'tp7', code: 'TP-007', title: 'Fire Protection System Commissioning',
    description: 'Sprinkler system flow tests, fire alarm panel acceptance, suppression agent discharge tests, and emergency shutdown integration.',
    system: 'fire_protection', priority: 'high', status: 'retest_required',
    tests_total: 8, tests_complete: 6, pass: 5, fail: 1, retest: 1,
    next_test: 'T-007: Sprinkler Head Flow Retest — Zone 3', lead: 'Lisa Wang', updated: '6 hours ago',
    planned_start: '2026-07-25', planned_end: '2026-08-20',
    actual_start: '2026-07-26', actual_end: null,
    ref_docs: ['PROC-FPS-001', 'NFPA-750'],
    procedures: [],
    records: [],
    failures: [
      { id: 'f7', test_id: 'T-007', description: 'Zone 3 sprinkler flow rate 38 LPM — spec minimum 42 LPM', root_cause: 'Pressure reducing valve set 0.5 bar below design setpoint', corrective_action: 'PRV setpoint adjusted to 4.5 bar, re-flow test scheduled', retest_result: null, ncr_ref: null },
    ],
    sign_offs: [
      { role: 'Lead Engineer', name: 'Lisa Wang', date: null, status: 'pending' },
      { role: 'QAQC', name: 'Khalid Al-Mansouri', date: null, status: 'pending' },
      { role: 'Client', name: 'Omar Al-Zaid', date: null, status: 'pending' },
      { role: 'Third Party', name: 'Bureau Veritas', date: null, status: 'pending' },
      { role: 'Commissioning Manager', name: 'James Morgan', date: null, status: 'pending' },
    ],
  },
  {
    id: 'tp8', code: 'TP-008', title: 'Water Treatment System Commissioning',
    description: 'Demineralisation plant commissioning, make-up water quality verification, and chemical dosing system calibration.',
    system: 'water_treatment', priority: 'medium', status: 'complete',
    tests_total: 6, tests_complete: 6, pass: 6, fail: 0, retest: 0,
    next_test: null, lead: 'Tom Baker', updated: '3 days ago',
    planned_start: '2026-07-18', planned_end: '2026-08-05',
    actual_start: '2026-07-18', actual_end: '2026-08-04',
    ref_docs: ['PROC-WTP-001'],
    procedures: [],
    records: [],
    failures: [],
    sign_offs: [
      { role: 'Lead Engineer', name: 'Tom Baker', date: '2026-08-04', status: 'signed' },
      { role: 'QAQC', name: 'Khalid Al-Mansouri', date: '2026-08-04', status: 'signed' },
      { role: 'Client', name: 'Omar Al-Zaid', date: '2026-08-05', status: 'signed' },
      { role: 'Third Party', name: 'Bureau Veritas', date: '2026-08-05', status: 'signed' },
      { role: 'Commissioning Manager', name: 'James Morgan', date: '2026-08-05', status: 'signed' },
    ],
  },
]

// ─── Mock Performance Tests ──────────────────────────────────────────────────

export const MOCK_PERF_TESTS: PerformanceTest[] = [
  { id: 'pt1', name: 'Capacity Test', description: 'Measured net electrical output at rated operating conditions', guarantee: '2,000', guarantee_unit: 'MW', tested_value: '1,700', deviation_pct: -15, status: 'failed', test_date: '2026-09-15', retest_required: true, retest_note: '2nd retest scheduled 2026-10-01' },
  { id: 'pt2', name: 'Efficiency Test', description: 'Net cycle thermal efficiency at ISO conditions', guarantee: '43', guarantee_unit: '%', tested_value: '42.5', deviation_pct: -1.2, status: 'within_tolerance', test_date: '2026-09-18', retest_required: false, retest_note: null },
  { id: 'pt3', name: 'Availability Test', description: '72-hour availability run demonstrating sustained reliable output', guarantee: '97', guarantee_unit: '%', tested_value: '98.2', deviation_pct: 1.2, status: 'exceeds_guarantee', test_date: '2026-09-20', retest_required: false, retest_note: null },
  { id: 'pt4', name: 'Heat Rate Test', description: 'Gross heat rate at 100% MCR operating condition', guarantee: '9,500', guarantee_unit: 'kJ/kWh', tested_value: null, deviation_pct: null, status: 'pending', test_date: null, retest_required: false, retest_note: null },
  { id: 'pt5', name: 'Emissions Test', description: 'Stack NOx, CO, and particulate emissions at full load', guarantee: '50', guarantee_unit: 'mg/Nm³', tested_value: '45', deviation_pct: -10, status: 'pass', test_date: '2026-09-22', retest_required: false, retest_note: null },
  { id: 'pt6', name: 'Noise Test', description: 'Boundary fence noise level at rated load night-time operation', guarantee: '85', guarantee_unit: 'dB(A)', tested_value: '82', deviation_pct: -3.5, status: 'pass', test_date: '2026-09-25', retest_required: false, retest_note: null },
]

// ─── Mock Energization Records ───────────────────────────────────────────────

export const MOCK_ENERGIZATION: Energization[] = [
  {
    id: 'en1', code: 'EN-001', title: 'HV Grid Energization — 132kV Incoming',
    system: 'Electrical Power', voltage: '132 kV', status: 'complete',
    scheduled_date: '2026-09-01', completed_date: '2026-09-01',
    permit_ref: 'PTW-EN-001', lead: 'Sarah Chen',
    steps: [
      { id: 's1', order: 1, description: 'Confirm all isolation points locked out', status: 'complete', completed_by: 'Sarah Chen', completed_date: '2026-09-01' },
      { id: 's2', order: 2, description: 'Verify protection relay settings active', status: 'complete', completed_by: 'Sarah Chen', completed_date: '2026-09-01' },
      { id: 's3', order: 3, description: 'Grid authority authorisation received', status: 'complete', completed_by: 'James Morgan', completed_date: '2026-09-01' },
      { id: 's4', order: 4, description: 'Close 132kV incoming CB-001', status: 'complete', completed_by: 'Sarah Chen', completed_date: '2026-09-01' },
      { id: 's5', order: 5, description: 'Confirm voltage on all busbars', status: 'complete', completed_by: 'Sarah Chen', completed_date: '2026-09-01' },
    ],
  },
  {
    id: 'en2', code: 'EN-002', title: 'Unit Transformer Energization — TR-001',
    system: 'Electrical Power', voltage: '33 kV', status: 'in_progress',
    scheduled_date: '2026-09-10', completed_date: null,
    permit_ref: 'PTW-EN-002', lead: 'Sarah Chen',
    steps: [
      { id: 's6', order: 1, description: 'Transformer oil tests complete — all results within spec', status: 'complete', completed_by: 'Sarah Chen', completed_date: '2026-09-08' },
      { id: 's7', order: 2, description: 'Ratio test and vector group verified', status: 'complete', completed_by: 'Sarah Chen', completed_date: '2026-09-09' },
      { id: 's8', order: 3, description: 'Protection relay settings confirmed', status: 'complete', completed_by: 'James Park', completed_date: '2026-09-09' },
      { id: 's9', order: 4, description: 'Energize HV winding — 5-minute soak', status: 'pending', completed_by: null, completed_date: null },
      { id: 's10', order: 5, description: 'Confirm LV winding voltage and phasing', status: 'pending', completed_by: null, completed_date: null },
    ],
  },
]

// ─── Mock Commissioning Failures ─────────────────────────────────────────────

export const MOCK_FAILURES: CommFailure[] = [
  { id: 'cf1', code: 'CF-001', package_ref: 'TP-001', description: 'Governor valve speed rise exceeded 10% limit (12.3% measured) during 100% load rejection test', severity: 'critical', status: 'corrective_action', raised_by: 'Rachel Green', raised_date: '2026-08-10', due_date: '2026-08-25', closed_date: null, root_cause: 'Governor valve actuator response delay due to low hydraulic oil temperature at ambient conditions', corrective_action: 'Governor tuning re-performed with heated oil circuit; new actuator servo valve installed', ncr_ref: 'NCR-G6-001', retest_date: '2026-09-05' },
  { id: 'cf2', code: 'CF-002', package_ref: 'TP-003', description: 'Protection relay trip time 95ms — specification requires ≤80ms', severity: 'major', status: 'retest_pending', raised_by: 'Sarah Chen', raised_date: '2026-08-15', due_date: '2026-08-30', closed_date: null, root_cause: 'Relay setting calculation error in protection coordination study revision A', corrective_action: 'Revised relay settings per updated coordination study rev B; secondary injection testing completed', ncr_ref: null, retest_date: '2026-09-08' },
  { id: 'cf3', code: 'CF-003', package_ref: 'TP-004', description: 'DCS turbine trip loop check failed — incorrect tag mapping in DCS database', severity: 'major', status: 'closed', raised_by: 'Rachel Green', raised_date: '2026-08-12', due_date: '2026-08-20', closed_date: '2026-08-19', root_cause: 'Tag renaming during late engineering change not propagated to DCS I/O database', corrective_action: 'Full DCS I/O database audit completed; 3 additional tag errors corrected', ncr_ref: null, retest_date: null },
  { id: 'cf4', code: 'CF-004', package_ref: 'TP-007', description: 'Zone 3 sprinkler head flow rate 38 LPM — specification minimum 42 LPM', severity: 'minor', status: 'open', raised_by: 'Lisa Wang', raised_date: '2026-08-18', due_date: '2026-09-01', closed_date: null, root_cause: 'Pressure reducing valve setpoint 0.5 bar below design value', corrective_action: 'PRV setpoint adjusted to 4.5 bar; retest scheduled', ncr_ref: null, retest_date: '2026-09-02' },
  { id: 'cf5', code: 'CF-005', package_ref: 'TP-001', description: 'Vibration Level on bearing B-3 at 3,000 rpm: 3.1 mm/s — limit 2.5 mm/s', severity: 'major', status: 'under_investigation', raised_by: 'James Park', raised_date: '2026-08-22', due_date: '2026-09-05', closed_date: null, root_cause: 'Investigation in progress — suspected rotor imbalance or misalignment at coupling', corrective_action: 'OEM Siemens on-site for dynamic balancing assessment', ncr_ref: 'NCR-G6-002', retest_date: null },
]

// ─── Mock Training Records ────────────────────────────────────────────────────

export const MOCK_TRAINING: TrainingRecord[] = [
  { id: 'tr1', module: 'Turbine Generator Operations', category: 'Plant Operations', trainee: 'Ahmed Al-Rashidi', role: 'Senior Operator', trainer: 'Rachel Green', status: 'complete', planned_date: '2026-08-01', completed_date: '2026-08-05', score: 87, pass_mark: 75, certificate: 'CERT-TR-001', expiry_date: '2028-08-05' },
  { id: 'tr2', module: 'Turbine Generator Operations', category: 'Plant Operations', trainee: 'Fatima Al-Suwaidi', role: 'Operator', trainer: 'Rachel Green', status: 'complete', planned_date: '2026-08-01', completed_date: '2026-08-05', score: 92, pass_mark: 75, certificate: 'CERT-TR-002', expiry_date: '2028-08-05' },
  { id: 'tr3', module: 'HV Electrical Safety & Operations', category: 'Electrical Safety', trainee: 'Mohammed Hassan', role: 'Electrical Technician', trainer: 'Sarah Chen', status: 'complete', planned_date: '2026-08-05', completed_date: '2026-08-08', score: 81, pass_mark: 80, certificate: 'CERT-TR-003', expiry_date: '2027-08-08' },
  { id: 'tr4', module: 'DCS Control Room Operations', category: 'Control Systems', trainee: 'Ahmed Al-Rashidi', role: 'Senior Operator', trainer: 'Rachel Green', status: 'in_progress', planned_date: '2026-09-01', completed_date: null, score: null, pass_mark: 75, certificate: null, expiry_date: null },
  { id: 'tr5', module: 'Emergency Shutdown Procedures', category: 'HSE', trainee: 'Ahmed Al-Rashidi', role: 'Senior Operator', trainer: 'James Morgan', status: 'not_started', planned_date: '2026-09-10', completed_date: null, score: null, pass_mark: 80, certificate: null, expiry_date: null },
  { id: 'tr6', module: 'Emergency Shutdown Procedures', category: 'HSE', trainee: 'Fatima Al-Suwaidi', role: 'Operator', trainer: 'James Morgan', status: 'not_started', planned_date: '2026-09-10', completed_date: null, score: null, pass_mark: 80, certificate: null, expiry_date: null },
  { id: 'tr7', module: 'Fire Protection System Operations', category: 'HSE', trainee: 'Khalid Al-Mansouri', role: 'Safety Officer', trainer: 'Lisa Wang', status: 'complete', planned_date: '2026-08-15', completed_date: '2026-08-16', score: 95, pass_mark: 80, certificate: 'CERT-TR-007', expiry_date: '2027-08-16' },
  { id: 'tr8', module: 'Cooling Water System Operations', category: 'Plant Operations', trainee: 'Fatima Al-Suwaidi', role: 'Operator', trainer: 'Tom Baker', status: 'complete', planned_date: '2026-08-20', completed_date: '2026-08-22', score: 78, pass_mark: 75, certificate: 'CERT-TR-008', expiry_date: '2028-08-22' },
]

// ─── Mock Documentation ───────────────────────────────────────────────────────

export const MOCK_COMM_DOCS: CommDoc[] = [
  { id: 'cd1', code: 'PROC-TG-001', title: 'Turbine Generator Commissioning Procedure', type: 'Commissioning Procedure', system: 'Turbine Generator', status: 'approved', prepared_by: 'Rachel Green', reviewed_by: 'James Morgan', approved_by: 'Omar Al-Zaid', submitted_date: '2026-07-15', approved_date: '2026-07-20', file_url: null },
  { id: 'cd2', code: 'PROC-ELE-001', title: 'Electrical Power System Commissioning Procedure', type: 'Commissioning Procedure', system: 'Electrical Power', status: 'approved', prepared_by: 'Sarah Chen', reviewed_by: 'James Morgan', approved_by: 'Omar Al-Zaid', submitted_date: '2026-07-18', approved_date: '2026-07-25', file_url: null },
  { id: 'cd3', code: 'REP-CW-COMM', title: 'Cooling Water System Commissioning Completion Report', type: 'Commissioning Report', system: 'Cooling Water', status: 'approved', prepared_by: 'Tom Baker', reviewed_by: 'James Morgan', approved_by: 'Omar Al-Zaid', submitted_date: '2026-08-14', approved_date: '2026-08-16', file_url: null },
  { id: 'cd4', code: 'REP-HVAC-COMM', title: 'HVAC System Commissioning Completion Report', type: 'Commissioning Report', system: 'HVAC', status: 'approved', prepared_by: 'Mike Ross', reviewed_by: 'James Morgan', approved_by: 'Omar Al-Zaid', submitted_date: '2026-08-09', approved_date: '2026-08-11', file_url: null },
  { id: 'cd5', code: 'CERT-EN-001', title: 'HV Energization Certificate — 132kV Incoming', type: 'Energization Certificate', system: 'Electrical Power', status: 'approved', prepared_by: 'Sarah Chen', reviewed_by: 'James Morgan', approved_by: 'Omar Al-Zaid', submitted_date: '2026-09-01', approved_date: '2026-09-02', file_url: null },
  { id: 'cd6', code: 'PROC-DCS-001', title: 'DCS & Control System Commissioning Procedure', type: 'Commissioning Procedure', system: 'Control & Instrumentation', status: 'under_review', prepared_by: 'Rachel Green', reviewed_by: null, approved_by: null, submitted_date: '2026-08-20', approved_date: null, file_url: null },
  { id: 'cd7', code: 'REP-TG-COMM', title: 'Turbine Generator Commissioning Progress Report — Rev 1', type: 'Progress Report', system: 'Turbine Generator', status: 'draft', prepared_by: 'Rachel Green', reviewed_by: null, approved_by: null, submitted_date: null, approved_date: null, file_url: null },
  { id: 'cd8', code: 'PLAN-HANDOVER', title: 'System Handover Plan — Commissioning to Operations', type: 'Handover Plan', system: 'All Systems', status: 'draft', prepared_by: 'James Morgan', reviewed_by: null, approved_by: null, submitted_date: null, approved_date: null, file_url: null },
]
