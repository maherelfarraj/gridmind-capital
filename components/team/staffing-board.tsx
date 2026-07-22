'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { assignRole, unassignRole } from '@/app/actions/team'
import type { Role, VProjectStaffing } from '@/lib/db/types'

type RoleRow = Role & { department_name: string; department_code: string }
interface Person { id: string; full_name: string; role: string | null }
interface ProjectLite { id: string; code: string; name: string }
interface TeamRow { role_id: string; person_id: string; full_name: string }

interface StaffingBoardProps {
  projects: ProjectLite[]
  roles: RoleRow[]
  people: Person[]
  selectedProjectId: string | null
  team: TeamRow[]
  staffing: VProjectStaffing | null
}

export function StaffingBoard({
  projects,
  roles,
  people,
  selectedProjectId,
  team,
  staffing,
}: StaffingBoardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pendingRole, setPendingRole] = React.useState<string | null>(null)

  // role_id → person_id currently assigned
  const assignedByRole = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const t of team) m.set(t.role_id, t.person_id)
    return m
  }, [team])

  function onProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    router.push(`/team/staffing?project=${e.target.value}`)
  }

  async function onAssigneeChange(roleId: string, personId: string) {
    if (!selectedProjectId) return
    setPendingRole(roleId)
    const res = personId
      ? await assignRole({ projectId: selectedProjectId, roleId, personId })
      : await unassignRole({ projectId: selectedProjectId, roleId })
    setPendingRole(null)
    if (res.error) {
      toast({ title: 'Could not update assignment', description: res.error, variant: 'danger' })
    } else {
      toast({ title: personId ? 'Role assigned' : 'Role cleared', variant: 'success' })
      router.refresh()
    }
  }

  const grouped = React.useMemo(() => {
    const byDept = new Map<string, RoleRow[]>()
    for (const r of roles) {
      const arr = byDept.get(r.department_name) ?? []
      arr.push(r)
      byDept.set(r.department_name, arr)
    }
    return Array.from(byDept.entries()).map(([dept, rs]) => ({ dept, roles: rs }))
  }, [roles])

  const pct = Number(staffing?.staffing_pct ?? 0)

  if (projects.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No projects available.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header: picker + staffing meter */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <label htmlFor="project-picker" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Project
          </label>
          <select
            id="project-picker"
            value={selectedProjectId ?? ''}
            onChange={onProjectChange}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Staffing</span>
          <div className="flex items-center gap-3">
            <div className="h-2 w-40 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
              />
            </div>
            <span className="tabular-nums text-sm font-semibold text-foreground">
              {staffing?.assigned_roles ?? 0}/{staffing?.total_roles ?? 0} · {pct.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Roles grouped by department */}
      <div className="flex flex-col gap-6">
        {grouped.map(({ dept, roles: deptRoles }) => (
          <section key={dept} aria-label={dept} className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">{dept}</h2>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {deptRoles.map((role) => {
                    const assigned = assignedByRole.get(role.id) ?? ''
                    const isPending = pendingRole === role.id
                    return (
                      <tr key={role.id} className="border-b border-border bg-card last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{role.title}</span>
                            <span className="font-mono text-[10px] uppercase text-muted-foreground">{role.code}</span>
                            {role.is_bess_critical && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-accent px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                <Zap size={10} aria-hidden="true" />
                                BESS
                              </span>
                            )}
                            {!role.counts_toward_staffing && (
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                support
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isPending && <Loader2 size={14} className="animate-spin text-muted-foreground" aria-hidden="true" />}
                            <select
                              value={assigned}
                              disabled={isPending}
                              onChange={(e) => onAssigneeChange(role.id, e.target.value)}
                              aria-label={`Assignee for ${role.title}`}
                              className="min-w-[160px] rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                            >
                              <option value="">Unassigned</option>
                              {people.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.full_name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
