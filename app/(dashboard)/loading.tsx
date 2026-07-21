function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/60 ${className ?? ''}`} />
}

export default function DashboardLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-background" aria-busy="true" aria-label="Loading dashboard">

      {/* Sidebar shimmer */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border/50 p-3 gap-2">
        <Skeleton className="h-8 w-32 mb-4" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-lg bg-muted/60 h-8 w-full" style={{ opacity: 1 - i * 0.07 }} />
        ))}
        <div className="mt-auto">
          <Skeleton className="h-10 w-full" />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar shimmer */}
        <div className="h-14 border-b border-border/50 flex items-center px-4 gap-3 shrink-0">
          <Skeleton className="h-8 w-48" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>

        {/* Page content shimmer */}
        <div className="flex-1 overflow-auto p-6 space-y-6">

          {/* Page heading */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-72" />
            </div>
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="size-8 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>

          {/* Two-col content */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Wide card */}
            <div className="lg:col-span-2 rounded-xl border border-border/50 bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-36 mb-4" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                  <Skeleton className="size-9 rounded-lg shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>

            {/* Narrow card */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-32 mb-4" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                  <Skeleton className="size-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
