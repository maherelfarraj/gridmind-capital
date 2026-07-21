'use client'
import * as React from 'react'
import type { WidgetConfig } from './types'
import { HealthScoreWidget }    from './health-score'
import { ActiveGatesWidget }    from './active-gates'
import { MyTasksWidget }        from './my-tasks'
import { BudgetOverviewWidget } from './budget-overview'
import { TimelineWidget }       from './timeline'
import { TeamActivityWidget }   from './team-activity'
import { RiskHeatmapWidget }    from './risk-heatmap'
import { DocumentQueueWidget }  from './document-queue'
import { CalendarWidget }       from './calendar'
import { QuickActionsWidget }   from './quick-actions'
import { KpiCardsWidget }       from './kpi-cards'
import { AnnouncementsWidget }  from './announcements'

export function WidgetRenderer({ config }: { config: WidgetConfig }) {
  switch (config.widgetId) {
    case 'health-score':    return <HealthScoreWidget    config={config} />
    case 'active-gates':    return <ActiveGatesWidget    config={config} />
    case 'my-tasks':        return <MyTasksWidget        config={config} />
    case 'budget-overview': return <BudgetOverviewWidget config={config} />
    case 'timeline':        return <TimelineWidget       config={config} />
    case 'team-activity':   return <TeamActivityWidget   config={config} />
    case 'risk-heatmap':    return <RiskHeatmapWidget    config={config} />
    case 'document-queue':  return <DocumentQueueWidget  config={config} />
    case 'calendar':        return <CalendarWidget       config={config} />
    case 'quick-actions':   return <QuickActionsWidget   config={config} />
    case 'kpi-cards':       return <KpiCardsWidget       config={config} />
    case 'announcements':   return <AnnouncementsWidget  config={config} />
    default:                return <div className="p-4 text-sm text-muted-foreground">Unknown widget</div>
  }
}

export * from './types'
