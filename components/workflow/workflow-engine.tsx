'use client'

import * as React from 'react'
import {
  GitBranch,
} from 'lucide-react'

export function WorkflowEngine() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Workflow Engine</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Workflow automation is configured per project</p>
      </div>

      {/* Honest empty state */}
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <GitBranch className="size-16 text-muted-foreground/30" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-foreground">No active workflows</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md">Workflow automation is configured per project. Create a project and define workflows for specific gates, approvals, or procurement steps.</p>
        </div>
      </div>
    </div>
  )
}
