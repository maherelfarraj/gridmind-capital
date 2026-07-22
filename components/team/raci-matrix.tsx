'use client'

import * as React from 'react'
import { Users, Info, Pencil, ChevronDown, ChevronRight, Search } from 'lucide-react'
import type { Gate, Role, RaciDeliverable, RaciAssignment, RaciLetter } from '@/lib/db/types'
import { updateRaciCell } from '@/app/actions/team'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

type RoleWithDept = Role & { department_name: string; department_code: string }

interface RaciMatrixProps {
  gates: Gate[]
  roles: RoleWithDept[]
  deliverables: RaciDeliverable[]
  assignments: RaciAssignment[]
  canEdit: boolean
}

// Chip treatment: A / A-R = dark slate, R = blue, C = gray, I = light blue.
const LETTER_STYLE: Record<RaciLetter, { cell: string; label: string }> = {
  'A/R': { cell: 'bg-slate-800 text-white font-bold dark:bg-slate-200 dark:text-slate-900', label: 'Accountable & Responsible' },
  A: { cell: 'bg-slate-700 text-white font-bold dark:bg-slate-300 dark:text-slate-900', label: 'Accountable' },
  R: { cell: 'bg-blue-600 text-white font-semibold', label: 'Responsible' },
  C: { cell: 'bg-muted-foreground/30 text-foreground font-medium', label: 'Consulted' },
  I: { cell: 'bg-sky-200 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100', label: 'Informed' },
}

const LETTER_ORDER: RaciLetter[] = ['A', 'A/R', 'R', 'C', 'I']
// Editable letters exclude standalone 'A' (a lone Accountable is set via A/R or
// cleared, never cycled to directly). Matches updateRaciCell's parameter type.
type RaciLetterValue = 'R' | 'A/R' | 'C' | 'I'
// Edit cycle per spec: empty → R → A/R → C → I → empty
const CYCLE: (RaciLetterValue | null)[] = [null, 'R', 'A/R', 'C', 'I']

function cellKey(deliverableId: string, roleId: string) {
  return `${deliverableId}:${roleId}`
}

export function RaciMatrix({ gates, roles, deliverables, assignments, canEdit }: RaciMatrixProps) {
  const { toast } = useToast()

  const [cells, setCells] = React.useState<Record<string, RaciLetter>>(() => {
    const init: Record<string, RaciLetter> = {}
    for (const a of assignments) init[cellKey(a.deliverable_id, a.role_id)] = a.letter
    return init
  })
  const [editMode, setEditMode] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set())
  const [gateFilter, setGateFilter] = React.useState('all')
  const [roleFilter, setRoleFilter] = React.useState('all')
  const [letterFilter, setLetterFilter] = React.useState('all')
  const [query, setQuery] = React.useState('')
  const [pending, setPending] = React.useState<Set<string>>(new Set())

  const roleById = React.useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles])

  // Live stat strip.
  const stats = React.useMemo(() => {
    const values = Object.values(cells)
    const accountables = values.filter((l) => l === 'A' || l === 'A/R').length
    return { deliverables: deliverables.length, accountables, assignments: values.length }
  }, [cells, deliverables.length])

  // Does a deliverable row pass the role/letter/search filters?
  const rowMatches = React.useCallback(
    (d: RaciDeliverable): boolean => {
      if (query.trim() && !d.name.toLowerCase().includes(query.trim().toLowerCase())) return false
      if (roleFilter !== 'all') {
        if (!cells[cellKey(d.id, roleFilter)]) return false
      }
      if (letterFilter !== 'all') {
        const has = roles.some((r) => cells[cellKey(d.id, r.id)] === letterFilter)
        if (!has) return false
      }
      return true
    },
    [cells, query, roleFilter, letterFilter, roles],
  )

  const rowTooltip = React.useCallback(
    (d: RaciDeliverable): string => {
      let accountable = ''
      const responsible: string[] = []
      for (const r of roles) {
        const l = cells[cellKey(d.id, r.id)]
        if (l === 'A' || l === 'A/R') accountable = r.code
        if (l === 'R' || l === 'A/R') responsible.push(r.code)
      }
      const parts: string[] = []
      if (accountable) parts.push(`Accountable: ${accountable}`)
      if (responsible.length) parts.push(`Responsible: ${responsible.join(', ')}`)
      return parts.join(' · ') || 'No assignments'
    },
    [cells, roles],
  )

  function toggleGate(gateId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(gateId)) next.delete(gateId)
      else next.add(gateId)
      return next
    })
  }

  async function cycleCell(d: RaciDeliverable, r: RoleWithDept) {
    if (!editMode || !canEdit) return
    const key = cellKey(d.id, r.id)
    if (pending.has(key)) return

    const current = cells[key] ?? null
    // A lone 'A' isn't in the cycle → indexOf returns -1 → starts at null.
    const idx = CYCLE.indexOf(current as RaciLetterValue | null)
    const next = CYCLE[(idx + 1) % CYCLE.length]
    const prevCells = cells

    // Optimistic update.
    setCells((prev) => {
      const copy = { ...prev }
      if (next === null) delete copy[key]
      else copy[key] = next
      return copy
    })
    setPending((prev) => new Set(prev).add(key))

    const res = await updateRaciCell({ deliverableId: d.id, roleId: r.id, letter: next })

    setPending((prev) => {
      const n = new Set(prev)
      n.delete(key)
      return n
    })

    if (res.error) {
      setCells(prevCells) // rollback
      toast({ title: res.error, variant: 'danger' })
    }
  }

  const visibleGates = gateFilter === 'all' ? gates : gates.filter((g) => g.id === gateFilter)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-foreground">RACI Matrix</h1>
          </div>
          <p className="text-sm text-muted-foreground text-pretty">
            Deliverable ownership across all 8 gates. Columns are the 18 delivery roles.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              editMode
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-foreground hover:border-primary/50',
            )}
            aria-pressed={editMode}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {editMode ? 'Editing — click a cell to cycle' : 'Edit matrix'}
          </button>
        )}
      </div>

      {/* Stat strip */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-primary/5 px-4 py-3 text-sm">
        <span className="font-semibold text-foreground">{stats.deliverables} deliverables</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-semibold text-foreground">{stats.accountables} Accountables</span>
        <span className="text-muted-foreground">·</span>
        <span className="font-semibold text-foreground">{stats.assignments} assignments</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-[220px]">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deliverables…"
            aria-label="Search deliverables"
            className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={gateFilter}
          onChange={(e) => setGateFilter(e.target.value)}
          aria-label="Filter by gate"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All gates</option>
          {gates.map((g) => (
            <option key={g.id} value={g.id}>
              {g.code} — {g.name}
            </option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filter by role"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.code} — {r.title}
            </option>
          ))}
        </select>
        <select
          value={letterFilter}
          onChange={(e) => setLetterFilter(e.target.value)}
          aria-label="Filter by letter"
          className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">All letters</option>
          {LETTER_ORDER.map((l) => (
            <option key={l} value={l}>
              {l} — {LETTER_STYLE[l].label}
            </option>
          ))}
        </select>
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
                'inline-flex h-6 w-9 items-center justify-center rounded text-[11px]',
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
      <div className="max-h-[70vh] overflow-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="sticky left-0 top-0 z-30 min-w-[260px] border-b border-border bg-muted px-4 py-3 text-left font-semibold text-foreground">
                Deliverable
              </th>
              {roles.map((r) => (
                <th
                  key={r.id}
                  className="sticky top-0 z-20 min-w-[48px] border-b border-border bg-muted px-2 py-3 text-center"
                  title={`${r.title} (${r.department_name})`}
                >
                  <span className="font-mono text-xs font-semibold text-foreground">{r.code}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleGates.map((g) => {
              const gateDeliverables = deliverables
                .filter((d) => d.gate_id === g.id)
                .filter(rowMatches)
              const isCollapsed = collapsed.has(g.id)
              return (
                <React.Fragment key={g.id}>
                  <tr>
                    <td
                      colSpan={roles.length + 1}
                      className="sticky left-0 z-10 border-b border-border bg-primary/10 px-4 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => toggleGate(g.id)}
                        className="flex items-center gap-2 text-left text-sm font-semibold text-foreground"
                        aria-expanded={!isCollapsed}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-primary" aria-hidden="true" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-primary" aria-hidden="true" />
                        )}
                        <span className="font-mono text-primary">{g.code}</span>
                        <span>{g.name}</span>
                        <span className="text-xs font-normal text-muted-foreground">
                          ({gateDeliverables.length})
                        </span>
                      </button>
                    </td>
                  </tr>
                  {!isCollapsed &&
                    gateDeliverables.map((d, idx) => (
                      <tr
                        key={d.id}
                        className={cn('border-b border-border/60', idx % 2 === 1 && 'bg-muted/10')}
                      >
                        <td
                          className="sticky left-0 z-10 bg-inherit px-4 py-2.5 text-left text-foreground"
                          title={rowTooltip(d)}
                        >
                          {d.name}
                        </td>
                        {roles.map((r) => {
                          const key = cellKey(d.id, r.id)
                          const letter = cells[key]
                          const isPending = pending.has(key)
                          const clickable = editMode && canEdit
                          return (
                            <td key={r.id} className="px-1 py-1 text-center">
                              <button
                                type="button"
                                disabled={!clickable}
                                onClick={() => cycleCell(d, r)}
                                aria-label={
                                  letter
                                    ? `${r.code}: ${LETTER_STYLE[letter].label}`
                                    : `${r.code}: unassigned`
                                }
                                className={cn(
                                  'inline-flex h-7 min-w-[34px] items-center justify-center rounded px-1 text-[11px] transition-opacity',
                                  letter ? LETTER_STYLE[letter].cell : 'text-muted-foreground/20',
                                  clickable && 'cursor-pointer ring-offset-1 hover:ring-2 hover:ring-primary/50',
                                  !clickable && 'cursor-default',
                                  isPending && 'opacity-50',
                                )}
                              >
                                {letter ?? (clickable ? '+' : '·')}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {editMode && (
        <p className="text-xs text-muted-foreground">
          Click a cell to cycle: empty → R → A/R → C → I → empty. Setting a second Accountable on a
          deliverable is rejected by the database and rolled back.
        </p>
      )}
    </div>
  )
}
