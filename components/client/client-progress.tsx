import type { ClientGateGroup } from '@/app/actions/client'
import { StatusPill } from './client-utils'

export function ClientProgress({ groups }: { groups: ClientGateGroup[] }) {
  const total = groups.reduce((n, g) => n + g.deliverables.length, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deliverables shared with you, grouped by project gate.
        </p>
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No deliverables have been shared yet. Your project team will publish progress items here.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.gateNumber} className="rounded-lg border border-border bg-card">
              <header className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
                <span className="text-xs text-muted-foreground">
                  {group.deliverables.length} {group.deliverables.length === 1 ? 'item' : 'items'}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {group.deliverables.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                      <p className="text-xs text-muted-foreground">{d.department}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="hidden w-28 items-center gap-2 sm:flex" aria-label={`${d.progressPct}% complete`}>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-[#0a2540]" style={{ width: `${d.progressPct}%` }} />
                        </div>
                        <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{d.progressPct}%</span>
                      </div>
                      <StatusPill status={d.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
