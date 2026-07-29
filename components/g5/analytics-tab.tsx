'use client'

import React from 'react'
import { KpiCard } from './shared'

export function AnalyticsTab() {
  // Real inspection, punch item, and NCR data would be fetched from database here
  // For now, show honest empty states
  const hasData = false  // Replace with: !!inspections?.length || !!punchItems?.length || !!ncrs?.length

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="size-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
          <span className="text-2xl">📋</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">No inspection data yet</h2>
        <p className="text-sm text-muted-foreground max-w-md">Mechanical completion analytics will appear here once inspections, punch items, and NCRs are recorded.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Overall MC %"      value="—"  color="#64ffda" />
        <KpiCard label="Total Inspections" value="0" />
        <KpiCard label="Open Punch (A)"    value="0" color="#ef4444" />
        <KpiCard label="Open NCRs"         value="0" color="#f59e0b" />
      </div>

      {/* Chart sections would render here when real data available */}
    </div>
  )
}
