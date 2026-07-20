'use client'

import * as React from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { KpiStrip } from './kpi-strip'
import { PipelineBoard } from './pipeline-board'
import { ApprovalQueue } from './approval-queue'
import { ActivityFeed } from './activity-feed'
import {
  MOCK_KPIS,
  MOCK_PROJECTS,
  MOCK_APPROVALS,
  MOCK_ACTIVITY,
  buildGateLanes,
} from './dashboard-data'

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

export function Dashboard() {
  const [loading, setLoading] = React.useState(false)
  const [lastRefreshed, setLastRefreshed] = React.useState(() => {
    const now = new Date()
    return `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`
  })

  const lanes = React.useMemo(() => buildGateLanes(MOCK_PROJECTS), [])

  function handleRefresh() {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      const now = new Date()
      setLastRefreshed(`${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`)
    }, 1200)
  }

  return (
    <div className="space-y-6 animate-[fade-in_0.2s_ease-out]">

      {/* ── Page title row ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground leading-tight">
            Executive Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Portfolio overview · Updated at {lastRefreshed}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          loading={loading}
          aria-label="Refresh dashboard data"
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* ── KPI Strip ── */}
      <KpiStrip kpis={MOCK_KPIS} loading={loading} />

      {/* ── Pipeline Board (full width) ── */}
      <div className="rounded-xl border border-border bg-card px-4 pt-4 pb-2">
        <PipelineBoard lanes={lanes} loading={loading} />
      </div>

      {/* ── Bottom two-column: Approvals + Activity ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ApprovalQueue
          items={MOCK_APPROVALS}
          loading={loading}
          maxVisible={5}
        />
        <ActivityFeed
          items={MOCK_ACTIVITY}
          loading={loading}
          maxVisible={7}
        />
      </div>

    </div>
  )
}
