'use client'

import { useMemo, useState, useTransition } from 'react'
import { ShieldAlert, Zap } from 'lucide-react'
import { assignRole, unassignRole } from '@/app/actions/team'
import { useToast } from '@/components/ui/toast'
import type { PersonLite } from '@/lib/db/queries'

type Role = {
  id: string
  code: string
  title: string
  is_bess_critical: boolean
  sort_order: number
  department_name: string
  department_code: string
  counts_toward_staffing?: boolean
}

type TeamRow = { role_id: string; person_id: string; full_name: string }
type Staffing = { assigned_roles: number; total_roles: number; staffing_pct: number } | null

export function TeamAssignmentBoard({
  projectId,
  roles,
  people,
  team,
  staffing,
}: {
  projectId: string
  roles: Role[]
  people: PersonLite[]
  team: TeamRow[]
  staffing: Staffing
}) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()

  // Local assignment map: role_id -> person_id (optimistic).
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    Object.fromEntries(team.map((t) => [t.role_id, t.person_id])),
  )

  const personName = useMemo(
    () => Object.fromEntries(people.map((p) => [p.id, p.full_name])),
    [people],
  )
  const roleByCode = useMemo(() => Object.fromEntries(roles.map((r) => [r.code, r])), [roles])

  // How many roles each person currently holds on this project.
  const holdCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const pid of Object.values(assignments)) if (pid) m[pid] = (m[pid] ?? 0) + 1
    return m
  }, [assignments])

  function handleChange(role: Role, personId: string) {
    const prev = assignments[role.id]
    // Optimistic update.
    setAssignments((a) => {
      const next = { ...a }
      if (personId) next[role.id] = personId
      else delete next[role.id]
      return next
    })

    startTransition(async () => {
      const res = personId
        ? await assignRole({ projectId, roleId: role.id, personId })
        : await unassignRole({ projectId, roleId: role.id })
      if (res.error) {
        // Roll back.
        setAssignments((a) => {
          const next = { ...a }
          if (prev) next[role.id] = prev
          else delete next[role.id]
          return next
        })
        toast({ title: res.error, variant: 'danger' })
      } else {
        toast({
          title: personId
            ? `${personName[personId]} assigned as ${role.code}`
            : `${role.code} unassigned`,
          variant: 'success',
        })
      }
    })
  }

  // ── Live banners ───────────────────────────────────────────
  const unassignedBess = roles.filter((r) => r.is_bess_critical && !assignments[r.id])
  const pdRole = roleByCode['PD']
  const pmRole = roleByCode['PM']
  const cmRole = roleByCode['CM']
  const leadershipGaps = [pdRole, pmRole].filter((r) => r && !assignments[r.id]) as Role[]
  const pdCmConflict =
    pdRole &&
    cmRole &&
    assignments[pdRole.id] &&
    assignments[pdRole.id] === assignments[cmRole.id]

  // Group roles by department, preserving sort order.
  const byDept = useMemo(() => {
    const groups = new Map<string, Role[]>()
    for (const r of [...roles].sort((a, b) => a.sort_order - b.sort_order)) {
      const list = groups.get(r.department_name) ?? []
      list.push(r)
      groups.set(r.department_name, list)
    }
    return Array.from(groups.entries())
  }, [roles])

  const assignedCount = roles.filter((r) => assignments[r.id]).length
  const pct = staffing?.staffing_pct ?? Math.round((assignedCount / roles.length) * 100)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Banners */}
        <div className="space-y-2" aria-live="polite">
          {leadershipGaps.length > 0 && (
            <Banner tone="red" icon={<ShieldAlert className="size-4" />}>
              Leadership unstaffed: {leadershipGaps.map((r) => r.code).join(', ')}. PD and PM are
              required before opening any gate.
            </Banner>
          )}
          {pdCmConflict && (
            <Banner tone="red" icon={<ShieldAlert className="size-4" />}>
              Segregation-of-duties conflict: the same person holds PD and CM. Reassign one.
            </Banner>
          )}
          {unassignedBess.length > 0 && (
            <Banner tone="amber" icon={<Zap className="size-4" />}>
              BESS-critical roles unstaffed: {unassignedBess.map((r) => r.code).join(', ')}.
            </Banner>
          )}
        </div>

        {/* Role cards by department */}
        {byDept.map(([dept, deptRoles]) => (
          <section key={dept}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {dept}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {deptRoles.map((role) => {
                const personId = assignments[role.id] ?? ''
                const holds = personId ? holdCounts[personId] ?? 0 : 0
                return (
                  <div
                    key={role.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {role.code}
                          </span>
                          {role.is_bess_critical && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                              <Zap className="size-2.5" />
                              BESS
                            </span>
                          )}
                        </div>
                        <p className="truncate text-sm text-foreground">{role.title}</p>
                      </div>
                    </div>
                    <select
                      value={personId}
                      disabled={pending}
                      onChange={(e) => handleChange(role, e.target.value)}
                      className="mt-2 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                    >
                      <option value="">— Unassigned —</option>
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                    {personId && holds > 1 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Holds {holds} roles on this project
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Side panel */}
      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground">Staffing</h2>
          <div className="mt-3 flex items-center gap-4">
            <Ring pct={pct} />
            <div className="text-sm text-muted-foreground">
              <p className="text-2xl font-semibold text-foreground">{assignedCount}</p>
              <p>of {roles.length} roles assigned</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">By department</h2>
          <div className="space-y-2">
            {byDept.map(([dept, deptRoles]) => {
              const filled = deptRoles.filter((r) => assignments[r.id]).length
              const deptPct = Math.round((filled / deptRoles.length) * 100)
              return (
                <div key={dept}>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className="truncate">{dept}</span>
                    <span>
                      {filled}/{deptRoles.length}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${deptPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold text-foreground">
            Unassigned ({roles.length - assignedCount})
          </h2>
          {roles.length - assignedCount === 0 ? (
            <p className="text-xs text-muted-foreground">All roles staffed.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {roles
                .filter((r) => !assignments[r.id])
                .map((r) => (
                  <span
                    key={r.id}
                    className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                      r.is_bess_critical
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.code}
                  </span>
                ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'red' | 'amber'
  icon: React.ReactNode
  children: React.ReactNode
}) {
  const toneCls =
    tone === 'red'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400'
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${toneCls}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="text-pretty">{children}</p>
    </div>
  )
}

function Ring({ pct }: { pct: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="text-primary transition-all"
        transform="rotate(-90 36 36)"
      />
      <text
        x="36"
        y="40"
        textAnchor="middle"
        className="fill-foreground text-[15px] font-semibold"
      >
        {pct}%
      </text>
    </svg>
  )
}
