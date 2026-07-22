import type { ClientMilestone } from '@/app/actions/client'
import { StatusPill, formatDate } from './client-utils'

export function ClientMilestones({ milestones }: { milestones: ClientMilestone[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Milestones</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contractual payment milestones for your project.
        </p>
      </div>

      {milestones.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No milestones have been shared yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Milestone</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Planned Date</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {milestones.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-foreground text-pretty">{m.title}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(m.plannedDate)}</td>
                  <td className="px-4 py-3"><StatusPill status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
