'use client'

import type { PhaseKey } from '@/components/app-shell/nav-config'
import type { ProjectStatus } from '@/components/project/project-command-center'

// ─────────────────────────────────────────────────────────────
// KPI Strip
// ─────────────────────────────────────────────────────────────

export interface KpiData {
  id: string
  label: string
  value: string
  subValue?: string
  /** positive = good, negative = bad, neutral */
  trend: 'up' | 'down' | 'neutral'
  trendLabel: string
  /** hex colour for the accent left-border */
  accentColor: string
}

export const MOCK_KPIS: KpiData[] = [
  {
    id: 'portfolio-value',
    label: 'Portfolio Value',
    value: '$4.82B',
    subValue: '18 active projects',
    trend: 'up',
    trendLabel: '+$340M QoQ',
    accentColor: '#64ffda',
  },
  {
    id: 'mw-pipeline',
    label: 'MW in Pipeline',
    value: '6,240 MW',
    subValue: 'Solar · Wind · BESS',
    trend: 'up',
    trendLabel: '+480 MW YTD',
    accentColor: '#3b82f6',
  },
  {
    id: 'active-projects',
    label: 'Active Projects',
    value: '18',
    subValue: '3 at risk',
    trend: 'neutral',
    trendLabel: '2 added this month',
    accentColor: '#8b5cf6',
  },
  {
    id: 'pending-approvals',
    label: 'Pending Approvals',
    value: '7',
    subValue: '2 overdue',
    trend: 'down',
    trendLabel: 'Avg 4.2d turnaround',
    accentColor: '#f59e0b',
  },
  {
    id: 'on-schedule',
    label: 'On-Schedule Rate',
    value: '72%',
    subValue: '13 / 18 projects',
    trend: 'down',
    trendLabel: '-6% vs last quarter',
    accentColor: '#f97316',
  },
  {
    id: 'cod-this-year',
    label: 'COD This Year',
    value: '3',
    subValue: 'Target: 5',
    trend: 'neutral',
    trendLabel: 'Next: Sirius · Dec 2025',
    accentColor: '#22c55e',
  },
]

// ─────────────────────────────────────────────────────────────
// Pipeline projects
// ─────────────────────────────────────────────────────────────

export interface PipelineProject {
  id: string
  name: string
  code: string
  client: string
  gate: number
  phase: PhaseKey
  status: ProjectStatus
  mw: number
  budgetM: number     // millions USD
  progress: number    // 0–100
  healthRag: 'green' | 'amber' | 'red'
  location: string
  targetCod: string
}

export const MOCK_PROJECTS: PipelineProject[] = [
  // ── Spec demo project ──────────────────────────────────────
  // Accessible at /projects/SOL-2026-001 (matched by code)
  {
    id:         'SOL-2026-001',
    name:       'Solar Atacama Expansion — Phase II',
    code:       'SOL-2026-001',
    client:     'Enel Green Power Chile',
    gate:       3,
    phase:      'g3',
    status:     'active',
    mw:         500,
    budgetM:    1200,           // $1,200,000,000
    progress:   47,
    healthRag:  'amber',
    location:   'Atacama Desert, Chile',
    targetCod:  '2027-06-30',
    // Extra fields used by the detail route
    // startDate, commentCount, documentCount resolved in findProject
  } as PipelineProject,
  // G0
  { id: 'p-lyra',    name: 'Lyra Grid Upgrade',       code: 'LYR-220', client: 'TransGrid AU',       gate: 0, phase: 'g0', status: 'planning',   mw: 220,  budgetM: 310,  progress: 8,   healthRag: 'green', location: 'New South Wales, AU', targetCod: 'Q3 2028' },
  // G1
  { id: 'p-orion',   name: 'Orion Wind Farm',          code: 'ORN-180', client: 'Clean Energy Corp',  gate: 1, phase: 'g1', status: 'active',     mw: 180,  budgetM: 290,  progress: 22,  healthRag: 'green', location: 'Patagonia, Argentina', targetCod: 'Q1 2027' },
  { id: 'p-vega',    name: 'Vega BESS Storage',        code: 'VEG-400', client: 'National Grid UK',   gate: 1, phase: 'g1', status: 'active',     mw: 400,  budgetM: 520,  progress: 18,  healthRag: 'amber', location: 'Yorkshire, UK', targetCod: 'Q4 2027' },
  // G2
  { id: 'p-helios',  name: 'Helios Substation 132kV',  code: 'HEL-132', client: 'ACWA Power',         gate: 2, phase: 'g2', status: 'active',     mw: 0,    budgetM: 85,   progress: 41,  healthRag: 'green', location: 'Riyadh, Saudi Arabia', targetCod: 'Q2 2026' },
  // G3
  { id: 'p-sol',     name: 'Sol Atacama 500MW',        code: 'SOL-500', client: 'Enel Chile',         gate: 3, phase: 'g3', status: 'active',     mw: 500,  budgetM: 680,  progress: 53,  healthRag: 'green', location: 'Atacama Desert, Chile', targetCod: 'Q2 2026' },
  // G4 (current for Sirius)
  { id: 'p-sirius',  name: 'Sirius 400MW Solar Farm',  code: 'SRS-400', client: 'TotalEnergies',      gate: 4, phase: 'g4', status: 'active',     mw: 400,  budgetM: 480,  progress: 61,  healthRag: 'amber', location: 'Atacama Desert, Chile', targetCod: 'Q4 2025' },
  { id: 'p-nova',    name: 'Nova Offshore Wind 600MW', code: 'NOV-600', client: 'Vattenfall',         gate: 4, phase: 'g4', status: 'at-risk',    mw: 600,  budgetM: 1200, progress: 58,  healthRag: 'red',   location: 'Baltic Sea, Denmark', targetCod: 'Q1 2026' },
  // G5
  { id: 'p-atlas',   name: 'Atlas Solar PV 300MW',     code: 'ATL-300', client: 'Masdar',             gate: 5, phase: 'g5', status: 'active',     mw: 300,  budgetM: 360,  progress: 74,  healthRag: 'green', location: 'Abu Dhabi, UAE', targetCod: 'Q3 2025' },
  // G6
  { id: 'p-ceres',   name: 'Ceres Wind Repowering',    code: 'CRS-150', client: 'RWE Renewables',     gate: 6, phase: 'g6', status: 'active',     mw: 150,  budgetM: 195,  progress: 88,  healthRag: 'green', location: 'Rhineland, Germany', targetCod: 'Q2 2025' },
  // G7
  { id: 'p-ares',    name: 'Ares Solar + Storage',     code: 'ARS-250', client: 'AGL Energy',         gate: 7, phase: 'g7', status: 'active',     mw: 250,  budgetM: 415,  progress: 94,  healthRag: 'green', location: 'Victoria, Australia', targetCod: 'Dec 2024' },
  // G8
  { id: 'p-titan',   name: 'Titan Hydro Upgrade',      code: 'TTN-800', client: 'Hydro Quebec',       gate: 8, phase: 'g8', status: 'completed',  mw: 800,  budgetM: 940,  progress: 100, healthRag: 'green', location: 'Quebec, Canada', targetCod: 'Jun 2024' },
]

// ─────────────────────────────────────────────────────────────
// Gate pipeline lanes (G0–G9 definitions with project buckets)
// ─────────────────────────────────────────────────────────────

export interface GateLane {
  gate: number
  phase: PhaseKey
  shortName: string
  color: string
  projects: PipelineProject[]
}

export function buildGateLanes(projects: PipelineProject[]): GateLane[] {
  const LANE_META: Omit<GateLane, 'projects'>[] = [
    { gate: 0, phase: 'g0', shortName: 'Intake',        color: '#64748b' },
    { gate: 1, phase: 'g1', shortName: 'Development',   color: '#3b82f6' },
    { gate: 2, phase: 'g2', shortName: 'Commercial',    color: '#6366f1' },
    { gate: 3, phase: 'g3', shortName: 'Engineering',   color: '#8b5cf6' },
    { gate: 4, phase: 'g4', shortName: 'Procurement',   color: '#a855f7' },
    { gate: 5, phase: 'g5', shortName: 'Construction',  color: '#f97316' },
    { gate: 6, phase: 'g6', shortName: 'Commissioning', color: '#14b8a6' },
    { gate: 7, phase: 'g7', shortName: 'O&M',           color: '#22c55e' },
    { gate: 8, phase: 'g8', shortName: 'Finance',       color: '#10b981' },
    { gate: 9, phase: 'g9', shortName: 'AI Optimise',   color: '#06b6d4' },
  ]
  return LANE_META.map((meta) => ({
    ...meta,
    projects: projects.filter((p) => p.gate === meta.gate),
  }))
}

// ─────────────────────────────────────────────────────────────
// Approval queue
// ─────────────────────────────────────────────────────────────

export type ApprovalType =
  | 'gate-review'
  | 'budget-variance'
  | 'change-order'
  | 'contract'
  | 'hse-incident'

export interface ApprovalItem {
  id: string
  type: ApprovalType
  title: string
  projectCode: string
  projectName: string
  requestedBy: string
  daysOpen: number
  isOverdue: boolean
  priority: 'critical' | 'high' | 'medium' | 'low'
}

export const MOCK_APPROVALS: ApprovalItem[] = [
  { id: 'a1', type: 'gate-review',      title: 'G5 Gate Review Convene',         projectCode: 'SRS-400', projectName: 'Sirius 400MW', requestedBy: 'J. Rivera',  daysOpen: 8,  isOverdue: true,  priority: 'critical' },
  { id: 'a2', type: 'budget-variance',  title: '+$12.4M Cost Variance Request',  projectCode: 'NOV-600', projectName: 'Nova Offshore', requestedBy: 'T. Müller',  daysOpen: 5,  isOverdue: true,  priority: 'high'     },
  { id: 'a3', type: 'change-order',     title: 'CO-041 Inverter Substitution',   projectCode: 'ATL-300', projectName: 'Atlas Solar',   requestedBy: 'M. Al-Farsi',daysOpen: 3,  isOverdue: false, priority: 'high'     },
  { id: 'a4', type: 'contract',         title: 'EPC Sub-contract Award',         projectCode: 'SOL-500', projectName: 'Sol Atacama',   requestedBy: 'R. Chen',    daysOpen: 2,  isOverdue: false, priority: 'medium'   },
  { id: 'a5', type: 'hse-incident',     title: 'Near-Miss Report #NM-22',        projectCode: 'CRS-150', projectName: 'Ceres Wind',    requestedBy: 'L. Schmidt', daysOpen: 1,  isOverdue: false, priority: 'medium'   },
  { id: 'a6', type: 'budget-variance',  title: 'Contingency Draw-Down Auth',     projectCode: 'ORN-180', projectName: 'Orion Wind',    requestedBy: 'A. Patel',   daysOpen: 1,  isOverdue: false, priority: 'low'      },
  { id: 'a7', type: 'change-order',     title: 'CO-019 Cable Route Deviation',   projectCode: 'VEG-400', projectName: 'Vega BESS',     requestedBy: 'S. Park',    daysOpen: 0,  isOverdue: false, priority: 'low'      },
]

// ─────────────────────────────────────────────────────────────
// Activity feed
// ─────────────────────────────────────────────────────────────

export type ActivityVerb =
  | 'gate-advanced'
  | 'approved'
  | 'comment'
  | 'document-upload'
  | 'risk-raised'
  | 'hse-incident'
  | 'milestone'
  | 'user-joined'

export interface ActivityItem {
  id: string
  verb: ActivityVerb
  actor: string
  actorInitials: string
  actorColor: string
  subject: string
  projectCode: string
  projectName: string
  timestamp: string   // relative, e.g. "2h ago"
  detail?: string
}

export const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'ev1',  verb: 'gate-advanced',   actor: 'J. Rivera',    actorInitials: 'JR', actorColor: '#64ffda', subject: 'advanced to G5 Construction',     projectCode: 'SRS-400', projectName: 'Sirius 400MW',   timestamp: '14m ago' },
  { id: 'ev2',  verb: 'approved',        actor: 'A. Carter',    actorInitials: 'AC', actorColor: '#3b82f6', subject: 'approved CO-039',                 projectCode: 'ATL-300', projectName: 'Atlas Solar',    timestamp: '41m ago' },
  { id: 'ev3',  verb: 'document-upload', actor: 'M. Al-Farsi',  actorInitials: 'MA', actorColor: '#8b5cf6', subject: 'uploaded IFC Drawing Rev C',       projectCode: 'ATL-300', projectName: 'Atlas Solar',    timestamp: '1h ago', detail: 'AT-CIVIL-IFC-003-C.pdf' },
  { id: 'ev4',  verb: 'risk-raised',     actor: 'T. Müller',    actorInitials: 'TM', actorColor: '#f97316', subject: 'raised HIGH risk: Supply Delay',   projectCode: 'NOV-600', projectName: 'Nova Offshore',  timestamp: '2h ago' },
  { id: 'ev5',  verb: 'comment',         actor: 'R. Chen',      actorInitials: 'RC', actorColor: '#6366f1', subject: 'commented on G3 Gate Report',     projectCode: 'SOL-500', projectName: 'Sol Atacama',    timestamp: '3h ago', detail: '"Transformer specs need QA sign-off before IFC"' },
  { id: 'ev6',  verb: 'milestone',       actor: 'System',       actorInitials: 'SY', actorColor: '#22c55e', subject: 'Mechanical Completion achieved',   projectCode: 'CRS-150', projectName: 'Ceres Wind',     timestamp: '5h ago' },
  { id: 'ev7',  verb: 'hse-incident',    actor: 'L. Schmidt',   actorInitials: 'LS', actorColor: '#ef4444', subject: 'filed Near-Miss NM-22',            projectCode: 'CRS-150', projectName: 'Ceres Wind',     timestamp: '6h ago', detail: 'Scaffolding near Grid Connection Point' },
  { id: 'ev8',  verb: 'approved',        actor: 'A. Carter',    actorInitials: 'AC', actorColor: '#3b82f6', subject: 'approved Contract Sub-Award',     projectCode: 'ORN-180', projectName: 'Orion Wind',     timestamp: '8h ago' },
  { id: 'ev9',  verb: 'user-joined',     actor: 'S. Park',      actorInitials: 'SP', actorColor: '#a855f7', subject: 'joined as Grid Engineer',         projectCode: 'VEG-400', projectName: 'Vega BESS',      timestamp: '1d ago' },
  { id: 'ev10', verb: 'document-upload', actor: 'A. Patel',     actorInitials: 'AP', actorColor: '#14b8a6', subject: 'uploaded Geotechnical Report v2',  projectCode: 'ORN-180', projectName: 'Orion Wind',     timestamp: '1d ago', detail: 'ORN-GEO-001-v2.pdf' },
]
