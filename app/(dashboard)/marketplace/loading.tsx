export default function Loading() {
  return (
    <div className="space-y-6 p-6 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-7 w-36 rounded-lg bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-full bg-muted" />
          <div className="h-7 w-24 rounded-lg bg-muted" />
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[130px] h-20 rounded-xl bg-muted" />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-56 rounded-xl bg-muted" />
        <div className="h-56 rounded-xl bg-muted" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 w-36 rounded-t bg-muted" />
        ))}
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-44 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
