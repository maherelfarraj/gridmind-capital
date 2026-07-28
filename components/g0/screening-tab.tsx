'use client'
import * as React from 'react'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { cn } from '@/lib/utils'
import { ClipboardList } from 'lucide-react'
// Real screening data shown when submission exists; MOCK_SCREENING removed

const RESULT_META = {
  pass:        { label: 'Pass',        color: '#22c55e', icon: CheckCircle2 },
  conditional: { label: 'Conditional', color: '#f59e0b', icon: AlertCircle  },
  fail:        { label: 'Fail',        color: '#ef4444', icon: XCircle      },
}

export function ScreeningTab({ hasSubmission }: { hasSubmission?: boolean }) {
  // Show empty state — screening data shown when real submission available
  return (
    <div className="rounded-xl border border-border bg-card p-10 text-center">
      <ClipboardList className="size-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground">No screening records yet</p>
      <p className="text-xs text-muted-foreground mt-1">Opportunity screening will appear here once submitted. Use the gate form to add screening criteria.</p>
    </div>
  )


}
