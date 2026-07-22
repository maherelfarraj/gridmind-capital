import { Building2, Users, GitBranch, Zap } from 'lucide-react'
import type { VProjectStaffing } from '@/lib/db/types'

interface TeamOverviewProps {
  departmentCount: number
  roleCount: number
  gateCount: number
  bessCriticalCount: number
  staffing: VProjectStaffing[]
}

const STATS = [
  { key: 'departments', label: 'Departments', icon: Building2 },
  { key: 'roles', label: 'Roles', icon: Users },
  { key: 'gates', label: 'Gates', icon: GitBranch },
  { key: 'bess', label: 'BESS-critical roles', icon: Zap },
] as const

export function TeamOverview({
  departmentCount,
  roleCount,
  gateCount,
  bessCriticalCount,
  staffing,
}: TeamOverviewProps) {
  const values: Record<string, number> = {
    departments: departmentCount,
    roles: roleCount,
    gates: gateCount,
    bess: bessCriticalCount,
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI cards */}
      <section aria-label="Organisation summary" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon size={16} aria-hidden="true" />
              <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
            </div>
            <span className="text-2xl font-semibold text-foreground">{values[key]}</span>
          </div>
        ))}
      </section>

      {/* Staffing table */}
      <section aria-label="Project staffing" className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Project staffing</h2>
          <p className="text-xs text-muted-foreground">
            Percentage of required roles assigned per project.
          </p>
        </div>
        {staffing.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No projects have staffing requirements yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-2 font-medium">Project</th>
                <th scope="col" className="px-4 py-2 font-medium" data-numeric>Assigned</th>
                <th scope="col" className="px-4 py-2 font-medium" data-numeric>Required</th>
                <th scope="col" className="px-4 py-2 font-medium">Staffing</th>
              </tr>
            </thead>
            <tbody>
              {staffing.map((s) => {
                const pct = Number(s.staffing_pct ?? 0)
                return (
                  <tr key={s.project_id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-foreground" data-numeric>{s.assigned_roles}</td>
                    <td className="px-4 py-3 text-foreground" data-numeric>{s.total_roles}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
