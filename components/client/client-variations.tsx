import type { ClientVariation } from '@/app/actions/client'
import { StatusPill, formatCurrency } from './client-utils'

export function ClientVariations({ variations }: { variations: ClientVariation[] }) {
  // Show the cost column only when at least one VO has cost disclosed to the client.
  const showCost = variations.some((v) => v.costImpact != null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Variations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Variation orders shared with you and their schedule impact.
        </p>
      </div>

      {variations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No variations have been shared yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">VO #</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Time Impact</th>
                {showCost && <th className="px-4 py-3 font-medium text-muted-foreground text-right">Cost Impact</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {variations.map((v) => (
                <tr key={v.id}>
                  <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{v.number}</td>
                  <td className="px-4 py-3 text-foreground text-pretty">{v.title}</td>
                  <td className="px-4 py-3"><StatusPill status={v.status} /></td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {v.timeImpactDays === 0 ? 'No impact' : `${v.timeImpactDays > 0 ? '+' : ''}${v.timeImpactDays} days`}
                  </td>
                  {showCost && (
                    <td className="px-4 py-3 text-right tabular-nums text-foreground whitespace-nowrap">
                      {v.costImpact != null ? formatCurrency(v.costImpact) : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
