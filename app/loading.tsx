export default function Loading() {
  return (
    <div className="min-h-dvh bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        {/* Animated logomark */}
        <div className="relative size-12">
          <svg width="48" height="48" viewBox="0 0 28 28" fill="none" aria-label="Loading" role="img">
            <rect x="3"  y="3"  width="10" height="10" rx="2" fill="#64ffda" className="animate-pulse" style={{ animationDelay: '0ms'   }} />
            <rect x="15" y="3"  width="10" height="10" rx="2" fill="#64ffda" className="animate-pulse" style={{ animationDelay: '150ms' }} opacity="0.7" />
            <rect x="3"  y="15" width="10" height="10" rx="2" fill="#64ffda" className="animate-pulse" style={{ animationDelay: '300ms' }} opacity="0.7" />
            <rect x="15" y="15" width="10" height="10" rx="2" fill="#64ffda" className="animate-pulse" style={{ animationDelay: '450ms' }} opacity="0.4" />
          </svg>
        </div>
        <p className="text-xs text-muted-foreground tracking-widest uppercase animate-pulse">
          GridMind Capital
        </p>
      </div>
    </div>
  )
}
