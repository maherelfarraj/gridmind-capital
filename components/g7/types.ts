// ─── G7 Handover & O&M Transition — Type Definitions ─────────────────────────

export type MilestoneStatus = 'not-started' | 'in-progress' | 'complete' | 'blocked'

export interface MilestoneDoc {
  id: string
  name: string
  url: string
}

export interface Milestone {
  id: string
  order: number
  title: string
  description: string
  status: MilestoneStatus
  responsible_party: string
  responsible_role: string
  responsible_initials: string
  completion_date: string | null
  target_date: string
  docs: MilestoneDoc[]
  blocker: string | null
}

// ─── Asset Registry ──────────────────────────────────────────────────────────

export type AssetCategory = 'Electrical' | 'Mechanical' | 'Civil' | 'IT' | 'Safety'
export type AssetCondition = 'New' | 'Good' | 'Fair' | 'Poor'

export interface MaintenanceTask {
  id: string
  description: string
  frequency: string
  last_done: string | null
  next_due: string
}

export interface Asset {
  id: string
  asset_id: string
  name: string
  category: AssetCategory
  location: string
  condition: AssetCondition
  manufacturer: string
  model: string
  serial_number: string
  installation_date: string
  warranty_expiry: string
  om_manual_url: string | null
  is_operational: boolean
  maintenance_tasks: MaintenanceTask[]
  specs: Record<string, string>
}

// ─── O&M Transition ───────────────────────────────────────────────────────────

export interface OmPersonnel {
  id: string
  name: string
  role: string
  initials: string
  email: string
  phone: string
  specialisation: string
}

export interface MaintenanceEvent {
  id: string
  title: string
  asset_id: string
  asset_name: string
  type: 'preventive' | 'inspection' | 'calibration'
  scheduled_date: string
  duration_hours: number
  assigned_to: string
}

export interface WarrantyItem {
  id: string
  asset_name: string
  vendor: string
  warranty_start: string
  warranty_end: string
  coverage: string
  contact_name: string
  contact_email: string
}

export interface SlaContact {
  id: string
  vendor: string
  service_type: string
  sla_response_hours: number
  contact_name: string
  contact_phone: string
  contact_email: string
  contract_ref: string
}
