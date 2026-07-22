// ─── Widget type system ────────────────────────────────────────────────────────

export type WidgetId =
  | 'health-score'
  | 'active-gates'
  | 'my-tasks'
  | 'budget-overview'
  | 'timeline'
  | 'team-activity'
  | 'risk-heatmap'
  | 'document-queue'
  | 'calendar'
  | 'quick-actions'
  | 'kpi-cards'
  | 'announcements'

export type ColSpan = 1 | 2 | 3 | 4
export type RowSpan = 1 | 2

export interface WidgetConfig {
  id: string               // unique instance id (uuid)
  widgetId: WidgetId       // which widget type
  colSpan: ColSpan         // 1-4 grid columns
  rowSpan: RowSpan         // 1-2 grid rows
  order: number
  // Per-widget settings
  projectFilter: 'all' | string
  timeRange: '7d' | '30d' | '90d' | 'ytd' | 'custom'
  refreshInterval: 'live' | '5min' | 'hourly' | 'manual'
  chartType?: 'bar' | 'line' | 'area' | 'pie'
  colorScheme?: 'default' | 'green' | 'amber' | 'red'
}

export interface WidgetDefinition {
  id: WidgetId
  label: string
  description: string
  icon: string
  defaultColSpan: ColSpan
  defaultRowSpan: RowSpan
  minColSpan: ColSpan
  category: 'project' | 'finance' | 'team' | 'operations' | 'custom'
}

export const WIDGET_CATALOG: WidgetDefinition[] = [
  {
    id: 'health-score',
    label: 'Project Health Score',
    description: 'At-a-glance overall health with trend arrow and 7-day sparkline.',
    icon: 'Activity',
    defaultColSpan: 1, defaultRowSpan: 1, minColSpan: 1,
    category: 'project',
  },
  {
    id: 'active-gates',
    label: 'Active Gates',
    description: 'Current stage-gate statuses and progress across all active projects.',
    icon: 'Shield',
    defaultColSpan: 2, defaultRowSpan: 1, minColSpan: 1,
    category: 'project',
  },
  {
    id: 'my-tasks',
    label: 'My Tasks',
    description: 'Personal task list filtered to your assignments, sorted by priority.',
    icon: 'CheckSquare',
    defaultColSpan: 2, defaultRowSpan: 1, minColSpan: 1,
    category: 'operations',
  },
  {
    id: 'budget-overview',
    label: 'Budget Overview',
    description: 'Stacked bar of budget vs. actual spend per project phase.',
    icon: 'BarChart2',
    defaultColSpan: 2, defaultRowSpan: 1, minColSpan: 2,
    category: 'finance',
  },
  {
    id: 'timeline',
    label: 'Timeline',
    description: 'Horizontal Gantt strip of upcoming project milestones.',
    icon: 'CalendarRange',
    defaultColSpan: 4, defaultRowSpan: 1, minColSpan: 2,
    category: 'project',
  },
  {
    id: 'team-activity',
    label: 'Team Activity',
    description: 'Real-time feed of recent actions taken by your team members.',
    icon: 'Users',
    defaultColSpan: 1, defaultRowSpan: 2, minColSpan: 1,
    category: 'team',
  },
  {
    id: 'risk-heatmap',
    label: 'Risk Heatmap',
    description: '3×3 probability vs. impact matrix for active project risks.',
    icon: 'AlertTriangle',
    defaultColSpan: 1, defaultRowSpan: 1, minColSpan: 1,
    category: 'operations',
  },
  {
    id: 'document-queue',
    label: 'Document Queue',
    description: 'Pending document approvals and uploads requiring your action.',
    icon: 'FileText',
    defaultColSpan: 2, defaultRowSpan: 1, minColSpan: 1,
    category: 'operations',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    description: 'Upcoming meetings, deadlines, and gate review sessions.',
    icon: 'Calendar',
    defaultColSpan: 2, defaultRowSpan: 2, minColSpan: 2,
    category: 'operations',
  },
  {
    id: 'quick-actions',
    label: 'Quick Actions',
    description: 'One-click shortcuts: Create Task, Upload Doc, Request Approval.',
    icon: 'Zap',
    defaultColSpan: 1, defaultRowSpan: 1, minColSpan: 1,
    category: 'custom',
  },
  {
    id: 'kpi-cards',
    label: 'KPI Cards',
    description: 'Configurable metric cards: spend %, progress, defects, SPI, CPI.',
    icon: 'TrendingUp',
    defaultColSpan: 2, defaultRowSpan: 1, minColSpan: 2,
    category: 'finance',
  },
  {
    id: 'announcements',
    label: 'News & Announcements',
    description: 'Admin-posted project updates and platform announcements.',
    icon: 'Megaphone',
    defaultColSpan: 1, defaultRowSpan: 1, minColSpan: 1,
    category: 'custom',
  },
]

export const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: 'w1',  widgetId: 'health-score',    colSpan: 1, rowSpan: 1, order: 0,  projectFilter: 'all', timeRange: '30d', refreshInterval: 'live'   },
  { id: 'w2',  widgetId: 'active-gates',    colSpan: 2, rowSpan: 1, order: 1,  projectFilter: 'all', timeRange: '30d', refreshInterval: '5min'  },
  { id: 'w3',  widgetId: 'quick-actions',   colSpan: 1, rowSpan: 1, order: 2,  projectFilter: 'all', timeRange: '7d',  refreshInterval: 'manual' },
  { id: 'w4',  widgetId: 'budget-overview', colSpan: 2, rowSpan: 1, order: 3,  projectFilter: 'all', timeRange: '90d', refreshInterval: 'hourly' },
  { id: 'w5',  widgetId: 'kpi-cards',       colSpan: 2, rowSpan: 1, order: 4,  projectFilter: 'all', timeRange: '30d', refreshInterval: '5min'  },
  { id: 'w6',  widgetId: 'my-tasks',        colSpan: 2, rowSpan: 1, order: 5,  projectFilter: 'all', timeRange: '7d',  refreshInterval: 'live'   },
  { id: 'w7',  widgetId: 'risk-heatmap',    colSpan: 1, rowSpan: 1, order: 6,  projectFilter: 'all', timeRange: '30d', refreshInterval: 'hourly' },
  { id: 'w8',  widgetId: 'document-queue',  colSpan: 2, rowSpan: 1, order: 7,  projectFilter: 'all', timeRange: '7d',  refreshInterval: 'live'   },
  { id: 'w9',  widgetId: 'team-activity',   colSpan: 1, rowSpan: 2, order: 8,  projectFilter: 'all', timeRange: '7d',  refreshInterval: 'live'   },
  { id: 'w10', widgetId: 'timeline',        colSpan: 3, rowSpan: 1, order: 9,  projectFilter: 'all', timeRange: '90d', refreshInterval: 'hourly' },
  { id: 'w11', widgetId: 'announcements',   colSpan: 1, rowSpan: 1, order: 10, projectFilter: 'all', timeRange: '30d', refreshInterval: 'hourly' },
  { id: 'w12', widgetId: 'calendar',        colSpan: 2, rowSpan: 2, order: 11, projectFilter: 'all', timeRange: '30d', refreshInterval: 'hourly' },
]
