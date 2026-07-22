'use client'

import Link from 'next/link'
import { AlertTriangle, CheckCircle2, Zap, ArrowRight } from 'lucide-react'
import type { StaffingRadar as StaffingRadarData } from '@/lib/db/queries'

/**
 * Additive Command Center panel: staffing readiness for the next gate.
 * Amber when required roles are unstaffed; green when ready. Deep-links to /team.
 */
export function StaffingRadar({
  projectId,
  data,
}: {
  projectId: string
  data: StaffingRadarData
}) {
  const { targetGateCode, missingRoles, staffingPct } = data
  const ready = missingRoles.length === 0

  // Ring geometry.
  const size = 72
  const stroke = 7
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, staffingPct))
  const dash = (pct / 100) * circ

  return (
    <section
      aria-label="Staffing radar"
      className={`rounded-lg border p-4 ${
        ready ? 'border-border bg-card' : 'border-amber-500/40 bg-amber-500/5'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {ready ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-500" />
          ) : (
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-500" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {ready ? `Staffing ready for ${targetGateCode}` : `Staff before ${targetGateCode}`}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
              {ready
                ? 'All required roles for the next gate are assigned.'
                : 'These required roles have no assignee on this project yet.'}
            </p>

            {!ready && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missingRoles.map((role) => (
                  <span
                    key={role.code}
                    title={role.title}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                      role.is_bess_critical
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : 'border-border bg-muted text-foreground'
                    }`}
                  >
                    {role.is_bess_critical && <Zap className="size-3" />}
                    {role.code}
                  </span>
                ))}
              </div>
            )}

            <Link
              href={`/team?project=${projectId}`}
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Open staffing board
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Staffing % ring */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              className={ready ? 'text-emerald-500' : 'text-amber-500'}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-semibold text-foreground">{Math.round(pct)}%</span>
            <span className="text-[10px] text-muted-foreground">staffed</span>
          </div>
        </div>
      </div>
    </section>
  )
}
