import Link from 'next/link'
import { Zap } from 'lucide-react'

interface OrgNode {
  id: string
  code: string
  title: string
  department_code: string
  department_name: string
  is_bess_critical: boolean
  counts_toward_staffing: boolean
  person: string | null
}

const SUPPORT_CODES = ['FIN', 'LEG', 'DCL']

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join('')
}

function RoleCard({ node, dashed }: { node: OrgNode; dashed?: boolean }) {
  return (
    <Link
      href={`/team/roles/${node.code}`}
      className={[
        'group flex w-44 flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary/60',
        dashed ? 'border-dashed' : '',
        node.is_bess_critical ? 'border-amber-500/60' : 'border-border',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-foreground">
          {node.code}
        </span>
        {node.is_bess_critical && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500"
            title="BESS-critical role"
          >
            <Zap size={10} aria-hidden="true" />
          </span>
        )}
      </div>
      <span className="text-xs font-medium leading-tight text-foreground">{node.title}</span>
      <div className="mt-1 flex items-center gap-2">
        {node.person ? (
          <>
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
              aria-hidden="true"
            >
              {initials(node.person)}
            </span>
            <span className="truncate text-xs text-muted-foreground">{node.person}</span>
          </>
        ) : (
          <span className="text-[11px] italic text-muted-foreground/60">Unassigned</span>
        )}
      </div>
    </Link>
  )
}

/** A vertical connector line between tree levels. */
function Connector() {
  return <div className="h-6 w-px bg-border" aria-hidden="true" />
}

export function OrgChart({
  nodes,
  projectSelected,
}: {
  nodes: OrgNode[]
  projectSelected: boolean
}) {
  const pd = nodes.find((n) => n.code === 'PD')
  const pm = nodes.find((n) => n.code === 'PM')

  const support = nodes.filter((n) => SUPPORT_CODES.includes(n.code))
  const deliveryNodes = nodes.filter(
    (n) => !['PD', 'PM'].includes(n.code) && !SUPPORT_CODES.includes(n.code),
  )

  // Group delivery roles by department, preserving encounter order.
  const deptOrder: string[] = []
  const byDept = new Map<string, { name: string; roles: OrgNode[] }>()
  for (const n of deliveryNodes) {
    if (!byDept.has(n.department_code)) {
      byDept.set(n.department_code, { name: n.department_name, roles: [] })
      deptOrder.push(n.department_code)
    }
    byDept.get(n.department_code)!.roles.push(n)
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-muted/20 p-6">
      <div className="flex min-w-[760px] flex-col items-center gap-0">
        {/* Leadership spine */}
        {pd && <RoleCard node={pd} />}
        {pd && pm && <Connector />}
        {pm && <RoleCard node={pm} />}

        {deptOrder.length > 0 && <Connector />}

        {/* Department clusters */}
        <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-8">
          {deptOrder.map((code) => {
            const dept = byDept.get(code)!
            return (
              <div key={code} className="flex flex-col items-center gap-3">
                <span className="rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {dept.name}
                </span>
                <div className="h-px w-full bg-border" aria-hidden="true" />
                <div className="flex flex-col gap-2">
                  {dept.roles.map((r) => (
                    <RoleCard key={r.id} node={r} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Support band */}
        {support.length > 0 && (
          <>
            <Connector />
            <div className="flex w-full flex-col items-center gap-3 rounded-lg border border-dashed border-border/70 bg-card/40 p-4">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Support Functions
              </span>
              <div className="flex flex-wrap items-start justify-center gap-3">
                {support.map((s) => (
                  <RoleCard key={s.id} node={s} dashed />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {!projectSelected && (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Showing the full role skeleton. Select a project above to populate assignees.
        </p>
      )}
    </div>
  )
}
