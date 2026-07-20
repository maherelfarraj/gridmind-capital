'use client'

import * as React from 'react'
import { WorkflowTimeline, MOCK_WORKFLOW_LOGS, type WorkflowLogEntry } from './workflow-timeline'

export function WorkflowTimelineDemoSection() {
  const [showActor, setShowActor] = React.useState(true)
  const [loading,   setLoading]   = React.useState(false)
  const [logs,      setLogs]      = React.useState<WorkflowLogEntry[]>(MOCK_WORKFLOW_LOGS)

  function simulateLoad() {
    setLoading(true)
    setLogs([])
    setTimeout(() => { setLogs(MOCK_WORKFLOW_LOGS); setLoading(false) }, 1400)
  }

  return (
    <section aria-labelledby="wt-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="wt-heading" className="text-base font-semibold text-foreground">
            Workflow Timeline
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            SOL-2026-001 · Solar Atacama Expansion — audit trail
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showActor}
              onChange={(e) => setShowActor(e.target.checked)}
              className="size-3.5 accent-primary rounded"
              aria-label="Show actor details"
            />
            Show actors
          </label>
          <button
            type="button"
            onClick={simulateLoad}
            className="text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <WorkflowTimeline
        logs={logs}
        showActor={showActor}
        loading={loading}
        maxItems={50}
      />
    </section>
  )
}
