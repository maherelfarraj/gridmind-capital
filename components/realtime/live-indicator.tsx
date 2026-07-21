'use client'

/**
 * LiveIndicator — shows a pulsing green dot + "Live" label when connected.
 * Flashes briefly on each realtime update received.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'

interface Props {
  flash?: boolean   // momentarily highlight on update
  className?: string
}

export function LiveIndicator({ flash = false, className }: Props) {
  const [highlight, setHighlight] = React.useState(false)

  React.useEffect(() => {
    if (!flash) return
    setHighlight(true)
    const t = setTimeout(() => setHighlight(false), 800)
    return () => clearTimeout(t)
  }, [flash])

  return (
    <span
      aria-label="Live data"
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] font-semibold select-none transition-colors duration-300',
        highlight ? 'text-[#64ffda]' : 'text-green-400',
        className,
      )}
    >
      <span className="relative flex size-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full size-2 bg-green-500" />
      </span>
      Live
    </span>
  )
}
