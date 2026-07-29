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



// ─────────────────────────────────────────────────────────────
// Gate pipeline lanes (G1–G8 canonical 8-phase model with project buckets)
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
    { gate: 1, phase: 'g1', shortName: 'Origination & Feasibility',          color: '#64748b' },
    { gate: 2, phase: 'g2', shortName: 'Permitting & Grid Application',     color: '#3b82f6' },
    { gate: 3, phase: 'g3', shortName: 'Commercial & Financial Close',      color: '#6366f1' },
    { gate: 4, phase: 'g4', shortName: 'Detailed Design (IFC)',             color: '#8b5cf6' },
    { gate: 5, phase: 'g5', shortName: 'Procurement & Manufacturing',       color: '#a855f7' },
    { gate: 6, phase: 'g6', shortName: 'Construction & Installation',       color: '#f97316' },
    { gate: 7, phase: 'g7', shortName: 'Commissioning & Grid Tests',        color: '#f59e0b' },
    { gate: 8, phase: 'g8', shortName: 'Handover & O&M',                    color: '#22c55e' },
  ]
  return LANE_META.map((meta) => ({
    ...meta,
    projects: projects.filter((p) => {
      // Map project.gate to current_phase + 1 for bucketing
      // Projects with current_phase=8 are completed, go to G8 lane
      return p.gate === meta.gate
    }),
  }))
}

// ───────��─────────────────────────────────────────────────────
// Approval queue
// ─────���───────────────────────────────────────────────────────

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
  { id: 'ev6',  verb: 'milestone',       actor: 'System',       actorInitials: 'SY', actorColor: '#22c55e', subject: 'G6 Construction & Installation milestone reached',   projectCode: 'CRS-150', projectName: 'Ceres Wind',     timestamp: '5h ago' },
  { id: 'ev7',  verb: 'hse-incident',    actor: 'L. Schmidt',   actorInitials: 'LS', actorColor: '#ef4444', subject: 'filed Near-Miss NM-22',            projectCode: 'CRS-150', projectName: 'Ceres Wind',     timestamp: '6h ago', detail: 'Scaffolding near Grid Connection Point' },
  { id: 'ev8',  verb: 'approved',        actor: 'A. Carter',    actorInitials: 'AC', actorColor: '#3b82f6', subject: 'approved Contract Sub-Award',     projectCode: 'ORN-180', projectName: 'Orion Wind',     timestamp: '8h ago' },
  { id: 'ev9',  verb: 'user-joined',     actor: 'S. Park',      actorInitials: 'SP', actorColor: '#a855f7', subject: 'joined as Grid Engineer',         projectCode: 'VEG-400', projectName: 'Vega BESS',      timestamp: '1d ago' },
  { id: 'ev10', verb: 'document-upload', actor: 'A. Patel',     actorInitials: 'AP', actorColor: '#14b8a6', subject: 'uploaded Geotechnical Report v2',  projectCode: 'ORN-180', projectName: 'Orion Wind',     timestamp: '1d ago', detail: 'ORN-GEO-001-v2.pdf' },
]
