export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-44 rounded-lg bg-muted/60" />
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/50" />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 rounded-xl bg-muted/40" />
        <div className="h-48 rounded-xl bg-muted/40" />
      </div>
      <div className="h-56 rounded-xl bg-muted/40" />
    </div>
  )
}
