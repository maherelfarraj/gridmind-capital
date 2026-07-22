import type { VRoleWorkload, VPersonTaskLoad, VPersonWorkload } from '@/lib/db/types'

export function WorkloadDashboard({
  roleWorkload,
  taskLoad,
  personWorkload,
}: {
  roleWorkload: VRoleWorkload[]
  taskLoad: VPersonTaskLoad[]
  personWorkload: VPersonWorkload[]
}) {
  const maxA = Math.max(1, ...roleWorkload.map((r) => r.a_count))

  return (
    <div className="flex flex-col gap-8">
      {/* Role accountability load */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Accountability load by role</h2>
          <p className="text-xs text-muted-foreground">
            Number of deliverables each role is Accountable (A / A/R) for across all gates. High
            bars are governance bottlenecks.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card">
          {roleWorkload.length === 0 && (
            <p className="p-6 text-center text-sm text-muted-foreground">No RACI assignments.</p>
          )}
          {roleWorkload.map((r) => (
            <div
              key={r.role_id}
              className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
            >
              <div className="w-40 shrink-0">
                <p className="truncate text-sm font-medium text-foreground">{r.code}</p>
                <p className="truncate text-xs text-muted-foreground">{r.title}</p>
              </div>
              <div className="flex flex-1 items-center gap-2">
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div
                    className="h-full rounded bg-primary"
                    style={{ width: `${(r.a_count / maxA) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums text-foreground">
                  {r.a_count}
                </span>
              </div>
              <div className="hidden shrink-0 gap-3 text-xs text-muted-foreground sm:flex">
                <span title="Responsible">R {r.r_count}</span>
                <span title="Consulted">C {r.c_count}</span>
                <span title="Informed">I {r.i_count}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Person task load */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">Task load by person</h2>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 text-center font-medium">To Do</th>
                <th className="px-4 py-2.5 text-center font-medium">In Progress</th>
                <th className="px-4 py-2.5 text-center font-medium">Blocked</th>
                <th className="px-4 py-2.5 text-center font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {taskLoad.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No open tasks for this project.
                  </td>
                </tr>
              )}
              {taskLoad.map((p) => (
                <tr key={p.person_id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{p.full_name}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">{p.todo}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">{p.in_progress}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">{p.blocked}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums">
                    {p.overdue > 0 ? (
                      <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-medium text-destructive">
                        {p.overdue}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Person RACI load (project) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">RACI load by person</h2>
        <p className="text-xs text-muted-foreground">
          Deliverables each staffed person carries on this project, by RACI letter.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Person</th>
                <th className="px-4 py-2.5 text-center font-medium">Accountable</th>
                <th className="px-4 py-2.5 text-center font-medium">Responsible</th>
                <th className="px-4 py-2.5 text-center font-medium">Consulted</th>
                <th className="px-4 py-2.5 text-center font-medium">Informed</th>
              </tr>
            </thead>
            <tbody>
              {personWorkload.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No staffed roles with RACI assignments on this project yet.
                  </td>
                </tr>
              )}
              {personWorkload.map((p) => (
                <tr key={p.person_id} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2.5 font-medium text-foreground">{p.full_name}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-foreground">{p.a_count}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">{p.r_count}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">{p.c_count}</td>
                  <td className="px-4 py-2.5 text-center tabular-nums text-muted-foreground">{p.i_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
