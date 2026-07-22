import type {
  Milestone, Asset, OmPersonnel, MaintenanceEvent, WarrantyItem, SlaContact,
} from './types'

// ─── Handover Milestones ──────────────────────────────────────────────────────

export const MOCK_MILESTONES: Milestone[] = [
  {
    id: 'm1', order: 1,
    title: 'Final Documentation Complete',
    description: 'As-built drawings, operation manuals, maintenance manuals, and warranty certificates all submitted and accepted.',
    status: 'complete',
    responsible_party: 'Khalid Al-Mansouri', responsible_role: 'Document Controller', responsible_initials: 'KM',
    completion_date: '2026-09-12', target_date: '2026-09-10',
    docs: [
      { id: 'd1', name: 'As-Built Drawing Register', url: '#' },
      { id: 'd2', name: 'O&M Manual Vol. 1', url: '#' },
      { id: 'd3', name: 'Warranty Certificates Package', url: '#' },
    ],
    blocker: null,
  },
  {
    id: 'm2', order: 2,
    title: 'Asset Tagging & Registration',
    description: 'All 247 physical assets tagged with QR codes and registered in the CMMS with location, specs, and maintenance schedules.',
    status: 'complete',
    responsible_party: 'Sarah Chen', responsible_role: 'Asset Manager', responsible_initials: 'SC',
    completion_date: '2026-09-18', target_date: '2026-09-15',
    docs: [
      { id: 'd4', name: 'Asset Register v2.1', url: '#' },
      { id: 'd5', name: 'CMMS Import Confirmation', url: '#' },
    ],
    blocker: null,
  },
  {
    id: 'm3', order: 3,
    title: 'Training Completed',
    description: 'Operator training (40 hrs), maintenance technician training (24 hrs), and safety induction (8 hrs) completed for all O&M staff.',
    status: 'complete',
    responsible_party: 'Omar Al-Zaid', responsible_role: 'Training Coordinator', responsible_initials: 'OZ',
    completion_date: '2026-09-20', target_date: '2026-09-20',
    docs: [
      { id: 'd6', name: 'Training Completion Certificates', url: '#' },
      { id: 'd7', name: 'Training Attendance Registers', url: '#' },
    ],
    blocker: null,
  },
  {
    id: 'm4', order: 4,
    title: 'Spare Parts & Tools Handed Over',
    description: 'All contractually required spare parts, special tools, and consumables delivered to site stores and verified against the spares schedule.',
    status: 'in-progress',
    responsible_party: 'Mohammed Hassan', responsible_role: 'Procurement Lead', responsible_initials: 'MH',
    completion_date: null, target_date: '2026-09-28',
    docs: [
      { id: 'd8', name: 'Spares Delivery Notes', url: '#' },
    ],
    blocker: 'Awaiting delivery of 2 x 33kV circuit breaker spare trip coils from ABB — ETA 25 Sep.',
  },
  {
    id: 'm5', order: 5,
    title: 'Software & Licenses Transferred',
    description: 'SCADA licences, inverter firmware, tracker control software, and all vendor portals transferred to client IT team.',
    status: 'in-progress',
    responsible_party: 'Yuki Tanaka', responsible_role: 'SCADA Engineer', responsible_initials: 'YT',
    completion_date: null, target_date: '2026-09-30',
    docs: [
      { id: 'd9', name: 'Software Licence Transfer Register', url: '#' },
    ],
    blocker: null,
  },
  {
    id: 'm6', order: 6,
    title: 'Final Inspection & Acceptance',
    description: 'Owner, Independent Engineer, and Civil Defense sign-off on the completed facility. Performance Acceptance Certificate issued.',
    status: 'not-started',
    responsible_party: 'James Morgan', responsible_role: 'Project Director', responsible_initials: 'JM',
    completion_date: null, target_date: '2026-10-05',
    docs: [],
    blocker: 'Pending completion of milestones 4 & 5.',
  },
]

// ─── Asset Registry ───────────────────────────────────────────────────────────

export const MOCK_ASSETS: Asset[] = [
  {
    id: 'a1', asset_id: 'ELE-INV-001', name: 'String Inverter Station 1', category: 'Electrical',
    location: 'Inverter Room A', condition: 'New', manufacturer: 'Huawei Digital Power', model: 'SUN2000-185KTL-H1',
    serial_number: 'HW2026-INV-001', installation_date: '2026-07-15', warranty_expiry: '2031-07-15',
    om_manual_url: '#', is_operational: true,
    specs: { 'Rated Power': '185 kW', 'Max DC Input': '370 kW', 'Max Efficiency': '99.0%', 'IP Rating': 'IP66' },
    maintenance_tasks: [
      { id: 'mt1', description: 'Filter cleaning & inspection', frequency: 'Monthly', last_done: null, next_due: '2026-10-15' },
      { id: 'mt2', description: 'Thermal imaging scan', frequency: 'Quarterly', last_done: null, next_due: '2027-01-15' },
    ],
  },
  {
    id: 'a2', asset_id: 'ELE-TRX-001', name: '33kV Main Power Transformer', category: 'Electrical',
    location: 'HV Substation', condition: 'New', manufacturer: 'ABB Power Grids', model: 'ONAN 50MVA 33/0.69kV',
    serial_number: 'ABB2026-TRX-001', installation_date: '2026-06-20', warranty_expiry: '2028-06-20',
    om_manual_url: '#', is_operational: true,
    specs: { 'Rating': '50 MVA', 'HV Voltage': '33 kV', 'LV Voltage': '690 V', 'Cooling': 'ONAN', 'Vector Group': 'Dyn11' },
    maintenance_tasks: [
      { id: 'mt3', description: 'Oil sampling & DGA test', frequency: 'Bi-Annual', last_done: null, next_due: '2027-03-20' },
    ],
  },
  {
    id: 'a3', asset_id: 'MEC-TRK-001', name: 'Single-Axis Tracker Control Unit', category: 'Mechanical',
    location: 'Block A — Control Cabinet', condition: 'New', manufacturer: 'Nextracker', model: 'NX Horizon',
    serial_number: 'NXT2026-CU-001', installation_date: '2026-07-01', warranty_expiry: '2031-07-01',
    om_manual_url: '#', is_operational: true,
    specs: { 'Rows Controlled': '48', 'Communication': 'Modbus TCP/RS-485', 'IP Rating': 'IP65' },
    maintenance_tasks: [
      { id: 'mt4', description: 'Actuator lubrication', frequency: 'Annual', last_done: null, next_due: '2027-07-01' },
    ],
  },
  {
    id: 'a4', asset_id: 'IT-SCADA-001', name: 'SCADA Master Station', category: 'IT',
    location: 'Control Room', condition: 'New', manufacturer: 'ABB Power Grids', model: 'System 800xA',
    serial_number: 'ABB2026-SCADA-001', installation_date: '2026-08-10', warranty_expiry: '2029-08-10',
    om_manual_url: '#', is_operational: false,
    specs: { 'Servers': '2 (redundant)', 'OS': 'Windows Server 2022', 'Protocols': 'IEC 61850 / DNP3 / Modbus' },
    maintenance_tasks: [
      { id: 'mt5', description: 'OS patch & backup verification', frequency: 'Monthly', last_done: null, next_due: '2026-10-10' },
    ],
  },
  {
    id: 'a5', asset_id: 'SAF-FFS-001', name: 'Fixed Fire Suppression System', category: 'Safety',
    location: 'Battery Room & Inverter Room', condition: 'New', manufacturer: 'Marioff', model: 'HI-FOG Compact',
    serial_number: 'MRF2026-FFS-001', installation_date: '2026-08-01', warranty_expiry: '2028-08-01',
    om_manual_url: '#', is_operational: true,
    specs: { 'Type': 'Water Mist', 'Coverage': '240 m²', 'Pressure': '100 bar', 'Detectors': 'Smoke + Heat combo' },
    maintenance_tasks: [
      { id: 'mt6', description: 'Pressure vessel inspection', frequency: 'Annual', last_done: null, next_due: '2027-08-01' },
      { id: 'mt7', description: 'Nozzle flow test', frequency: '6-Monthly', last_done: null, next_due: '2027-02-01' },
    ],
  },
  {
    id: 'a6', asset_id: 'CIV-MET-001', name: 'Perimeter Security Fence & Gates', category: 'Civil',
    location: 'Site Perimeter', condition: 'New', manufacturer: 'Al Futtaim Carillion', model: 'Custom 3m Chain-Link',
    serial_number: 'AFC2026-FNC-001', installation_date: '2026-05-15', warranty_expiry: '2028-05-15',
    om_manual_url: null, is_operational: true,
    specs: { 'Perimeter': '4.2 km', 'Height': '3.0 m', 'Gates': '4 vehicular + 2 pedestrian', 'CCTV Integration': 'Yes' },
    maintenance_tasks: [
      { id: 'mt8', description: 'Gate mechanism lubrication & inspection', frequency: 'Bi-Annual', last_done: null, next_due: '2027-05-15' },
    ],
  },
]

// ─── O&M Personnel ────────────────────────────────────────────────────────────

export const MOCK_OM_PERSONNEL: OmPersonnel[] = [
  { id: 'p1', name: 'Ahmed Al-Rashid',  role: 'O&M Manager',            initials: 'AR', email: 'a.rashid@gridmind.ae',   phone: '+971 50 111 2222', specialisation: 'HV Electrical' },
  { id: 'p2', name: 'Fatima Nasser',    role: 'Senior Operator',         initials: 'FN', email: 'f.nasser@gridmind.ae',   phone: '+971 50 333 4444', specialisation: 'SCADA / Control' },
  { id: 'p3', name: 'Ravi Kumar',       role: 'Maintenance Technician',  initials: 'RK', email: 'r.kumar@gridmind.ae',    phone: '+971 55 555 6666', specialisation: 'PV & Tracker Systems' },
  { id: 'p4', name: 'Lindiwe Dube',     role: 'HSE Officer',             initials: 'LD', email: 'l.dube@gridmind.ae',     phone: '+971 55 777 8888', specialisation: 'Safety & Compliance' },
  { id: 'p5', name: 'Carlos Mendoza',   role: 'Electrical Technician',   initials: 'CM', email: 'c.mendoza@gridmind.ae',  phone: '+971 50 999 0000', specialisation: 'HV / MV Switchgear' },
]

// ─── Maintenance Schedule ─────────────────────────────────────────────────────

export const MOCK_MAINTENANCE: MaintenanceEvent[] = [
  { id: 'me1', title: 'Inverter filter clean', asset_id: 'a1', asset_name: 'Inverter Station 1', type: 'preventive', scheduled_date: '2026-10-15', duration_hours: 4, assigned_to: 'Ravi Kumar' },
  { id: 'me2', title: 'SCADA OS patch', asset_id: 'a4', asset_name: 'SCADA Master Station', type: 'preventive', scheduled_date: '2026-10-10', duration_hours: 2, assigned_to: 'Fatima Nasser' },
  { id: 'me3', title: 'Tracker actuation test', asset_id: 'a3', asset_name: 'Tracker Control Unit', type: 'inspection', scheduled_date: '2026-11-01', duration_hours: 6, assigned_to: 'Ravi Kumar' },
  { id: 'me4', title: 'HV transformer oil sample', asset_id: 'a2', asset_name: '33kV Transformer', type: 'inspection', scheduled_date: '2027-03-20', duration_hours: 3, assigned_to: 'Carlos Mendoza' },
  { id: 'me5', title: 'Fire suppression nozzle flow test', asset_id: 'a5', asset_name: 'Fire Suppression System', type: 'inspection', scheduled_date: '2027-02-01', duration_hours: 4, assigned_to: 'Lindiwe Dube' },
  { id: 'me6', title: 'Perimeter gate lubrication', asset_id: 'a6', asset_name: 'Security Fence & Gates', type: 'preventive', scheduled_date: '2027-05-15', duration_hours: 2, assigned_to: 'Ahmed Al-Rashid' },
]

// ─── Warranty Tracker ─────────────────────────────────────────────────────────

export const MOCK_WARRANTIES: WarrantyItem[] = [
  { id: 'w1', asset_name: 'String Inverter Station 1', vendor: 'Huawei Digital Power', warranty_start: '2026-07-15', warranty_end: '2031-07-15', coverage: 'Parts & Labour', contact_name: 'Huawei UAE Support', contact_email: 'support.uae@huawei.com' },
  { id: 'w2', asset_name: '33kV Main Power Transformer', vendor: 'ABB Power Grids', warranty_start: '2026-06-20', warranty_end: '2028-06-20', coverage: 'Parts only', contact_name: 'ABB UAE Service', contact_email: 'uae.service@abb.com' },
  { id: 'w3', asset_name: 'Single-Axis Tracker Control Unit', vendor: 'Nextracker', warranty_start: '2026-07-01', warranty_end: '2031-07-01', coverage: 'Parts & Labour', contact_name: 'Nextracker EMEA', contact_email: 'service.emea@nextracker.com' },
  { id: 'w4', asset_name: 'SCADA Master Station', vendor: 'ABB Power Grids', warranty_start: '2026-08-10', warranty_end: '2029-08-10', coverage: 'Software support + Parts', contact_name: 'ABB UAE Service', contact_email: 'uae.service@abb.com' },
  { id: 'w5', asset_name: 'Fixed Fire Suppression System', vendor: 'Marioff', warranty_start: '2026-08-01', warranty_end: '2028-08-01', coverage: 'Parts & Annual Service', contact_name: 'Marioff Gulf', contact_email: 'service.gulf@marioff.com' },
]

// ─── SLA Contacts ─────────────────────────────────────────────────────────────

export const MOCK_SLA: SlaContact[] = [
  { id: 's1', vendor: 'Huawei Digital Power', service_type: 'Inverter Remote Monitoring & On-Site', sla_response_hours: 4,  contact_name: 'Ali Hassan',    contact_phone: '+971 4 555 0101', contact_email: 'ali.hassan@huawei.com',     contract_ref: 'HW-SLA-2026-001' },
  { id: 's2', vendor: 'ABB Power Grids',       service_type: 'HV Transformer Emergency Response',   sla_response_hours: 8,  contact_name: 'Sara Ahmed',    contact_phone: '+971 2 666 0202', contact_email: 'sara.ahmed@abb.com',        contract_ref: 'ABB-SLA-2026-001' },
  { id: 's3', vendor: 'Nextracker',            service_type: 'Tracker System Technical Support',    sla_response_hours: 24, contact_name: 'Mark Williams', contact_phone: '+1 408 555 0303', contact_email: 'm.williams@nextracker.com', contract_ref: 'NXT-SLA-2026-001' },
]
