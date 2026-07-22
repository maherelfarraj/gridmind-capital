'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Users, Info } from 'lucide-react'
import type { Gate, Role, RaciDeliverable, RaciAssignment, RaciLetter } from '@/lib/db/types'
import { cn } from '@/lib/utils'

type RoleWithDept = Role & { department_name: string; department_code: string }

interface RaciMatrixProps {
  gates: Gate[]
  roles: RoleWithDept[]
  selectedGateId: string | null
  deliverables: RaciDeliverable[]
  assignments: RaciAssignment[]
}

// RACI letter → visual treatment. A/R is the strongest (owns + does the work).
const LETTER_STYLE: Record<RaciLetter, { cell: string; label: string }> = {
  'A/R': { cell: 'bg-primary text-primary-foreground font-bold', label: 'Accountable & Responsible' },
  A: { cell: 'bg-amber-500/90 text-black font-bold', label: 'Accountable' },
  R: { cell: 'bg-sky-500/80 text-black font-semibold', label: 'Responsible' },
  C: { cell: 'bg-muted-foreground/25 text-foreground font-medium', label: 'Consulted' },
  I: { cell: 'bg-muted-foreground/10 text-muted-foreground', label: 'Informed' },
}

const LETTER_ORDER: RaciLetter[] = ['A/R', 'A', 'R', 'C', 'I']

export function RaciMatrix({
  gates,
  roles,
  selectedGateId,
  deliverables,
  assignments,
}: RaciMatrixProps) {
  const router = useRouter()

  // Index assignments by "deliverableId:roleId" for O(1) cell lookup.
  const cellMap = React.useMemo(() => {
    const m = new Map<string, RaciLetter>()
    for (const a of assignments) m.set(`${a.deliverable_id}:${a.role_id}`, a.letter)
    return m
  }, [assignments])

  // Only show role columns that actually appear in this gate's assignments,
  // preserving the roles[] sort order (by department / sort_order).
  const activeRoleIds = React.useMemo(() => {
    const ids = new Set(assignments.map((a) => a.role_id))
    return roles.filter((r) => ids.has(r.id))
  }, [assignments, roles])

  const selectedGate = gates.find((g) => g.id === selectedGateId) ?? null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-foreground">RACI Matrix</h1>
        </div>
        <p className="text-sm text-muted-foreground text-pretty">
          Deliverable ownership per gate. Each cell shows a role&apos;s responsibility level for a
          deliverable.
        </p>
      </div>

      {/* Gate selector */}
      <div className="flex flex-wrap gap-2">
        {gates.map((g) => {
          const active = g.id === selectedGateId
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => router.push(`/team/raci?gate=${g.id}`)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
              aria-pressed={active}
            >
              <span className="font-mono">{g.code}</span>
              <span className="ms-2 hidden sm:inline">{g.name}</span>
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" aria-hidden="true" /> Legend:
        </span>
        {LETTER_ORDER.map((l) => (
          <span key={l} className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                'inline-flex h-6 w-8 items-center justify-center rounded text-[11px]',
                LETTER_STYLE[l].cell,
              )}
            >
              {l}
            </span>
            <span className="text-muted-foreground">{LETTER_STYLE[l].label}</span>
          </span>
        ))}
      </div>

      {/* Matrix */}
      {selectedGate && (
        <div className="rounded-md bg-primary/5 px-4 py-2 text-sm text-foreground">
          <span className="font-mono font-semibold text-primary">{selectedGate.code}</span>
          {' — '}
          {selectedGate.name}
          <span className="ms-2 text-muted-foreground">({selectedGate.milestone})</span>
        </div>
      )}

      {deliverables.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No deliverables defined for this gate.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="sticky left-0 z-10 min-w-[240px] bg-muted/30 px-4 py-3 text-left font-semibold text-foreground">
                  Deliverable
                </th>
                {activeRoleIds.map((r) => (
                  <th
                    key={r.id}
                    className="min-w-[52px] px-2 py-3 text-center align-bottom"
                    title={`${r.title} (${r.department_name})`}
                  >
                    <span className="font-mono text-xs font-semibold text-foreground">{r.code}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deliverables.map((d, idx) => (
                <tr
                  key={d.id}
                  className={cn('border-b border-border/60', idx % 2 === 1 && 'bg-muted/10')}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5 text-left text-foreground">
                    {d.name}
                  </td>
                  {activeRoleIds.map((r) => {
                    const letter = cellMap.get(`${d.id}:${r.id}`)
                    return (
                      <td key={r.id} className="px-1 py-1 text-center">
                        {letter ? (
                          <span
                            className={cn(
                              'inline-flex h-7 min-w-[34px] items-center justify-center rounded px-1 text-[11px]',
                              LETTER_STYLE[letter].cell,
                            )}
                            title={`${r.title}: ${LETTER_STYLE[letter].label}`}
                          >
                            {letter}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/20" aria-hidden="true">
                            ·
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {deliverables.length} deliverable{deliverables.length === 1 ? '' : 's'} ×{' '}
        {activeRoleIds.length} role{activeRoleIds.length === 1 ? '' : 's'} for this gate.
      </p>
    </div>
  )
}
