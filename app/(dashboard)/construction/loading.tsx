export default function ConstructionLoading() {
  return (
    <div className="flex flex-col gap-6 p-6 animate-pulse">
      <div className="h-8 w-56 rounded-lg bg-muted/60" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted/60" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 rounded-xl bg-muted/60" />
        <div className="h-64 rounded-xl bg-muted/60" />
      </div>
      <div className="h-72 rounded-xl bg-muted/60" />
    </div>
  )
}
