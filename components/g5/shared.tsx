'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export function StatusBadge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ color, background: bg }}
    >
      {label}
    </span>
  )
}

export function Tab({
  label, icon: Icon, active, onClick,
}: { label: string; icon: React.ElementType; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all whitespace-nowrap',
        active
          ? 'bg-[#64ffda]/10 text-[#64ffda] border border-[#64ffda]/30'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
      )}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </button>
  )
}

export function KpiCard({
  label, value, sub, color = '#64ffda',
}: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}
