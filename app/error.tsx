'use client'

import * as React from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'


export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error('[GridMind] Route error:', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md w-full">
        {/* Icon */}
        <div className="mx-auto mb-6 size-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertTriangle className="size-8 text-red-400" aria-hidden />
        </div>

        <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
        <p className="text-sm text-muted-foreground mb-1">
          An error occurred while loading this page.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono mb-6">
            ID: {error.digest}
          </p>
        )}
        {!error.digest && <div className="mb-6" />}

        <div className="flex gap-3 justify-center">
          <Button variant="default" size="sm" onClick={reset}>
            <RefreshCw className="size-3.5" aria-hidden />
            Try again
          </Button>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            <Home className="size-3.5" aria-hidden />
            Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
