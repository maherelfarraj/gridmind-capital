'use client'

import * as React from 'react'
import { Check } from 'lucide-react'
import type { GateStep } from '@/app/actions/client'

export function formatDate(d: string | null): string {
  if (!d) return '—'
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatCurrency(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

/** Human-friendly status badge. Neutral palette — no internal semantics leaked. */
export function StatusPill({ status }: { status: string }) {
  const s = status.toLowerCase()
  const cls =
    ['approved', 'paid', 'complete', 'completed', 'closed', 'issued'].includes(s)
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : ['in_review', 'in_progress', 'invoiced', 'submitted', 'open'].includes(s)
        ? 'bg-sky-50 text-sky-700 border-sky-200'
        : ['overdue', 'rejected'].includes(s)
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-muted text-muted-foreground border-border'
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {label}
    </span>
  )
}

/** Visual-only 6-gate stepper. */
export function GateStepper({ gates }: { gates: GateStep[] }) {
  return (
    <ol className="flex items-center gap-0 overflow-x-auto py-2" aria-label="Project gate progress">
      {gates.map((g, i) => {
        const done = g.status === 'approved'
        const active = g.current || g.status === 'in_review'
        return (
          <li key={g.code} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5 px-1">
              <div
                className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                  done
                    ? 'border-[#0a2540] bg-[#0a2540] text-white'
                    : active
                      ? 'border-[#0a2540] bg-white text-[#0a2540]'
                      : 'border-border bg-muted text-muted-foreground'
                }`}
                aria-current={g.current ? 'step' : undefined}
              >
                {done ? <Check className="size-4" aria-hidden /> : g.number}
              </div>
              <span className={`whitespace-nowrap text-[11px] font-medium ${active || done ? 'text-foreground' : 'text-muted-foreground'}`}>
                {g.code}
              </span>
            </div>
            {i < gates.length - 1 && (
              <div className={`h-0.5 w-8 md:w-14 ${done ? 'bg-[#0a2540]' : 'bg-border'}`} aria-hidden />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** Small labelled stat card. */
export function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
