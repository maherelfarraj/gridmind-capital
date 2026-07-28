'use client'

import * as React from 'react'
import useSWR from 'swr'
import { loadApprovalsDashboard } from '@/app/actions/approvals'
import type { ApprovalsDashboard } from '@/app/actions/approvals'
import { ApprovalInboxWrapper } from './approval-inbox-wrapper'
import { ApprovalCharts } from './approval-charts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ApprovalsPageClientProps {
  initialDashboard: ApprovalsDashboard
}

export function ApprovalsPageClient({ initialDashboard }: ApprovalsPageClientProps) {
  // SWR with server-fetched data as fallback (avoids refetch on mount)
  const { data } = useSWR('approvals-dashboard', loadApprovalsDashboard, {
    fallbackData: initialDashboard,
    revalidateOnFocus: false,
  })

  const dashboard = data ?? initialDashboard

  // Determine KPI label based on scope
  const kpiLabel = dashboard?.scope === 'mine' 
    ? 'routed to your role' 
    : 'across all projects'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {dashboard?.scope === 'tenant'
            ? 'Review and action pending approvals across all projects'
            : 'Review and action approvals routed to your role'}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending {kpiLabel === 'routed to your role' ? '(routed to your role)' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard?.pending ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">{dashboard?.overdue ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{dashboard?.approved ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rejected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{dashboard?.rejected ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {dashboard?.byObjectType && dashboard?.byStatus && (
        <ApprovalCharts
          byTypeData={dashboard.byObjectType}
          statusData={dashboard.byStatus}
        />
      )}

      {/* Approval Inbox */}
      <ApprovalInboxWrapper showFilters={true} />
    </div>
  )
}
