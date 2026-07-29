'use client'

// ─── Report & Block types ────────────────────────────────────────────────────

export type BlockType =
  | 'kpi'
  | 'bar-chart'
  | 'line-chart'
  | 'pie-chart'
  | 'area-chart'
  | 'table'
  | 'progress'
  | 'text'
  | 'image'

export type AggregationFn = 'sum' | 'avg' | 'count' | 'min' | 'max'
export type GroupBy = 'project' | 'phase' | 'department' | 'month' | 'quarter'
export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'pptx'
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export interface FilterRow {
  id: string
  field: string
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains'
  value: string
}

export interface BlockConfig {
  id: string
  type: BlockType
  title: string
  /** grid position (in 12-col units) */
  x: number
  y: number
  w: number
  h: number
  // data config
  metric?: string
  chartType?: BlockType
  colorIndex?: number
  aggregation?: AggregationFn
  groupBy?: GroupBy
  filters?: FilterRow[]
  // formatting
  format?: 'number' | 'currency' | 'percent'
  showLegend?: boolean
  showGrid?: boolean
  // content (text/image)
  content?: string
  imageUrl?: string
}

export interface ReportConfig {
  id: string
  name: string
  description?: string
  folder: 'mine' | 'shared' | 'template' | 'archived'
  createdBy: string
  updatedAt: string
  shared: boolean
  // canvas data
  blocks: BlockConfig[]
  // global filters
  projects: string[]
  dateRange: '7d' | '30d' | '90d' | '6m' | '1y' | 'custom'
  groupBy: GroupBy
  aggregation: AggregationFn
  colorPalette: string
}

// ─── Catalog of available templates ─────────────────────────────────────────

export interface ReportTemplate {
  id: string
  label: string
  description: string
  icon: string
  blocks: Omit<BlockConfig, 'id'>[]
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'project-status',
    label: 'Project Status Summary',
    description: 'Portfolio-wide status, gate progress, and RAG overview',
    icon: 'BarChart3',
    blocks: [
      { type: 'kpi', title: 'Active Projects',    x:0, y:0, w:3, h:2, metric:'active_projects',    format:'number' },
      { type: 'kpi', title: 'Gates This Month',   x:3, y:0, w:3, h:2, metric:'gates_this_month',   format:'number' },
      { type: 'kpi', title: 'Budget Utilisation', x:6, y:0, w:3, h:2, metric:'budget_utilisation', format:'percent' },
      { type: 'kpi', title: 'Open Issues',        x:9, y:0, w:3, h:2, metric:'open_issues',        format:'number' },
      { type: 'bar-chart',  title: 'Projects by Phase',       x:0, y:2, w:6, h:4, groupBy:'phase',   aggregation:'count', colorIndex:0 },
      { type: 'pie-chart',  title: 'RAG Status Distribution', x:6, y:2, w:6, h:4, metric:'rag',       colorIndex:1 },
      { type: 'table',      title: 'Project Register',        x:0, y:6, w:12, h:5 },
    ],
  },
  {
    id: 'budget-performance',
    label: 'Budget Performance',
    description: 'Cost variance, CPI/SPI, and spend trends',
    icon: 'TrendingUp',
    blocks: [
      { type: 'kpi', title: 'Total Budget',    x:0, y:0, w:3, h:2, metric:'total_budget',    format:'currency' },
      { type: 'kpi', title: 'Actual Spend',    x:3, y:0, w:3, h:2, metric:'actual_spend',    format:'currency' },
      { type: 'kpi', title: 'Forecast',        x:6, y:0, w:3, h:2, metric:'forecast',        format:'currency' },
      { type: 'kpi', title: 'CPI',             x:9, y:0, w:3, h:2, metric:'cpi',             format:'number' },
      { type: 'area-chart', title: 'Spend Curve (Actual vs Plan)', x:0, y:2, w:8, h:5, groupBy:'month', colorIndex:0 },
      { type: 'bar-chart',  title: 'Cost Variance by Project',     x:8, y:2, w:4, h:5, groupBy:'project', colorIndex:2 },
      { type: 'table',      title: 'WBS Cost Breakdown',           x:0, y:7, w:12, h:4 },
    ],
  },
  {
    id: 'gate-tracker',
    label: 'Gate Progress Tracker',
    description: 'Stage-gate status, sign-off rate, and upcoming gates',
    icon: 'GitBranch',
    blocks: [
      { type: 'kpi', title: 'Gates Passed',   x:0, y:0, w:3, h:2, metric:'gates_passed',   format:'number' },
      { type: 'kpi', title: 'Gates Pending',  x:3, y:0, w:3, h:2, metric:'gates_pending',  format:'number' },
      { type: 'kpi', title: 'Avg Days Open',  x:6, y:0, w:3, h:2, metric:'avg_days_open',  format:'number' },
      { type: 'kpi', title: 'Pass Rate',      x:9, y:0, w:3, h:2, metric:'pass_rate',      format:'percent' },
      { type: 'bar-chart', title: 'Gates by Status', x:0, y:2, w:6, h:4, groupBy:'phase',  colorIndex:0 },
      { type: 'line-chart',title: 'Monthly Gate Activity', x:6, y:2, w:6, h:4, groupBy:'month', colorIndex:3 },
      { type: 'table',     title: 'Upcoming Gates',        x:0, y:6, w:12, h:5 },
    ],
  },
  {
    id: 'risk-issues',
    label: 'Risk & Issues Log',
    description: 'Risk register heat map, issue trends, and open items',
    icon: 'AlertTriangle',
    blocks: [
      { type: 'kpi', title: 'Open Risks',     x:0, y:0, w:3, h:2, metric:'open_risks',     format:'number' },
      { type: 'kpi', title: 'Open Issues',    x:3, y:0, w:3, h:2, metric:'open_issues',    format:'number' },
      { type: 'kpi', title: 'Critical Items', x:6, y:0, w:3, h:2, metric:'critical_items', format:'number' },
      { type: 'kpi', title: 'Resolved This Month', x:9, y:0, w:3, h:2, metric:'resolved',  format:'number' },
      { type: 'pie-chart',  title: 'Risk by Category',     x:0, y:2, w:4, h:4, colorIndex:1 },
      { type: 'bar-chart',  title: 'Issues by Priority',   x:4, y:2, w:4, h:4, colorIndex:2 },
      { type: 'line-chart', title: 'Risk Trend (30d)',      x:8, y:2, w:4, h:4, groupBy:'month', colorIndex:0 },
      { type: 'table',      title: 'Risk Register',         x:0, y:6, w:12, h:5 },
    ],
  },
  {
    id: 'team-productivity',
    label: 'Team Productivity',
    description: 'Task completion, workload distribution, and velocity',
    icon: 'Users',
    blocks: [
      { type: 'kpi', title: 'Tasks Completed', x:0, y:0, w:3, h:2, metric:'tasks_completed', format:'number' },
      { type: 'kpi', title: 'Overdue Tasks',   x:3, y:0, w:3, h:2, metric:'overdue_tasks',   format:'number' },
      { type: 'kpi', title: 'Velocity',        x:6, y:0, w:3, h:2, metric:'velocity',        format:'number' },
      { type: 'kpi', title: 'Avg Cycle Time',  x:9, y:0, w:3, h:2, metric:'avg_cycle_time',  format:'number' },
      { type: 'bar-chart',  title: 'Workload by Team Member', x:0, y:2, w:8, h:5, groupBy:'department', colorIndex:0 },
      { type: 'pie-chart',  title: 'Task Status Split',       x:8, y:2, w:4, h:5, colorIndex:2 },
      { type: 'table',      title: 'Task List',               x:0, y:7, w:12, h:4 },
    ],
  },
  {
    id: 'custom',
    label: 'Custom (Blank)',
    description: 'Start from a blank canvas and add any blocks you need',
    icon: 'LayoutTemplate',
    blocks: [],
  },
]

export const COLOR_PALETTES: { id: string; label: string; colors: string[] }[] = [
  { id: 'default', label: 'Default',  colors: ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7'] },
  { id: 'ocean',   label: 'Ocean',    colors: ['#0ea5e9','#0284c7','#0369a1','#38bdf8','#7dd3fc','#bae6fd'] },
  { id: 'warm',    label: 'Warm',     colors: ['#f97316','#ef4444','#eab308','#84cc16','#f59e0b','#fbbf24'] },
  { id: 'forest',  label: 'Forest',   colors: ['#22c55e','#16a34a','#15803d','#4ade80','#86efac','#bbf7d0'] },
  { id: 'slate',   label: 'Slate',    colors: ['#64748b','#475569','#334155','#94a3b8','#cbd5e1','#e2e8f0'] },
]

export const FILTER_FIELDS = [
  'Project', 'Phase', 'Gate', 'Status', 'Budget', 'Spend', 'Risk Level',
  'Department', 'Assignee', 'Priority', 'Due Date', 'Created At',
]
export const FILTER_OPERATORS = ['=','!=','>','<','>=','<=','contains','not_contains']
