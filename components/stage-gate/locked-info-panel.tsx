'use client'

import { Lock, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface LockedInfoPanelProps {
  phase: number
  title: string
  description: string
}

export function LockedInfoPanel({ phase, title, description }: LockedInfoPanelProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950 p-8">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <Lock className="size-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100">{title}</h2>
            <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
              Phase {phase}
            </Badge>
          </div>
          <p className="text-amber-800 dark:text-amber-200 mb-4">{description}</p>
          <div className="flex items-start gap-2 rounded bg-amber-100 dark:bg-amber-900 p-3">
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This phase workspace will be available in the next release. Current submissions are accepted via the parallel review system.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
