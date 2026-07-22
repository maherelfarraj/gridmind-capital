'use client'

import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { AlertTriangle, Zap, Info } from 'lucide-react'
import type { RoleWorkloadRow } from '@/lib/db/queries'
import type { VPersonTaskLoad, VPersonWorkload } from '@/lib/db/types'

type View = 'role' | 'task' | 'person'

const TABS: { id: View; label: string }[] = [
  { id: 'role', label: 'Role accountability' },
  { id: 'task', label: 'Task load' },
  { id: 'person', label: 'Person RACI load' },
]

export function WorkloadDashboard({
  roleWorkload,
  taskLoad,
  personWorkload,
  staffedCount,
  unstaffedCount,
}: {
  roleWorkload: RoleWorkloadRow[]
  taskLoad: VPersonTaskLoad[]
  personWorkload: VPersonWorkload[]
  staffedCount: number
  unstaffedCount: number
}) {
  const [view, setView] = useState<View>('role')

  const totals = useMemo(() => {
    const a = roleWorkload.reduce((s, r) => s + r.a_count, 0)
    const r = roleWorkload.reduce((s, x) => s + x.r_count, 0)
    return { a, r }
  }, [roleWorkload])

  // Risk detection per spec.
  const risks = useMemo(() => {
    const overloaded = roleWorkload.filter((r) => r.a_count + r.r_count > 15)
    const bessHeavy = roleWorkload.filter(
      (r) => r.is_bess_critical && r.a_count + r.r_count > 10 && r.a_count + r.r_count <= 15,
    )
    const noConsult = roleWorkload.filter(
      (r) => r.c_count === 0 && r.i_count === 0 && (r.a_count > 0 || r.r_count > 0),
    )
    return { overloaded, bessHeavy, noConsult }
  }, [roleWorkload])

  const chartData = useMemo(
    () =>
      [...roleWorkload]
        .sort((a, b) => b.a_count + b.r_count - (a.a_count + a.r_count))
        .map((r) => ({ code: r.code, Accountable: r.a_count, Responsible: r.r_count })),
    [roleWorkload],
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Header stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Accountable" value={totals.a} accent="text-foreground" />
        <StatCard label="Total Responsible" value={totals.r} accent="text-primary" />
        <StatCard label="Staffed roles" value={staffedCount} accent="text-emerald-500" />
        <StatCard
          label="Unstaffed roles"
          value={unstaffedCount}
          accent={unstaffedCount > 0 ? 'text-destructive' : 'text-foreground'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              view === t.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'role' && (
        <div className="flex flex-col gap-6">
          {(risks.overloaded.length > 0 || risks.bessHeavy.length > 0 || risks.noConsult.length > 0) && (
            <div className="grid gap-3 md:grid-cols-3">
              {risks.overloaded.length > 0 && (
                <RiskCard
                  tone="danger"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title="Overloaded roles"
                  detail={`${risks.overloaded.map((r) => r.code).join(', ')} carry >15 combined A+R deliverables.`}
                />
              )}
              {risks.bessHeavy.length > 0 && (
                <RiskCard
                  tone="warning"
                  icon={<Zap className="h-4 w-4" />}
                  title="BESS-critical load"
                  detail={`${risks.bessHeavy.map((r) => r.code).join(', ')} are BESS-critical with >10 A+R deliverables.`}
                />
              )}
              {risks.noConsult.length > 0 && (
                <RiskCard
                  tone="info"
                  icon={<Info className="h-4 w-4" />}
                  title="No consult loop"
                  detail={`${risks.noConsult.map((r) => r.code).join(', ')} are never Consulted or Informed on any deliverable.`}
                />
              )}
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="mb-4 text-sm font-medium text-foreground">
              Accountable + Responsible deliverables by role
            </h3>
            <div className="h-[420px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="code"
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    interval={0}
                    angle={-40}
                    textAnchor="end"
                    height={56}
                  />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      color: 'var(--popover-foreground)',
                      fontSize: 12,
                    }}
                    cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Accountable" stackId="ar" fill="var(--foreground)" />
                  <Bar dataKey="Responsible" stackId="ar" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <RoleTable rows={roleWorkload} />
        </div>
      )}

      {view === 'task' && <TaskLoadTable rows={taskLoad} />}
      {view === 'person' && <PersonRaciTable rows={personWorkload} />}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${accent}`}>{value}</p>
    </div>
  )
}

function RiskCard({
  tone,
  icon,
  title,
  detail,
}: {
  tone: 'danger' | 'warning' | 'info'
  icon: React.ReactNode
  title: string
  detail: string
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-destructive/40 bg-destructive/10 text-destructive'
      : tone === 'warning'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
        : 'border-primary/40 bg-primary/10 text-primary'
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <p className="text-xs leading-relaxed text-foreground/80">{detail}</p>
    </div>
  )
}

function RoleTable({ rows }: { rows: RoleWorkloadRow[] }) {
  const sorted = [...rows].sort((a, b) => b.a_count + b.r_count - (a.a_count + a.r_count))
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Role</th>
            <th className="px-4 py-2 text-right font-medium">A</th>
            <th className="px-4 py-2 text-right font-medium">R</th>
            <th className="px-4 py-2 text-right font-medium">C</th>
            <th className="px-4 py-2 text-right font-medium">I</th>
            <th className="px-4 py-2 text-right font-medium">A+R</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => {
            const load = r.a_count + r.r_count
            return (
              <tr key={r.role_id} className="bg-card">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.code}</span>
                    {r.is_bess_critical && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        <Zap className="h-3 w-3" /> BESS
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{r.title}</span>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">{r.a_count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-primary">{r.r_count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.c_count}</td>
                <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.i_count}</td>
                <td
                  className={`px-4 py-2 text-right font-semibold tabular-nums ${load > 15 ? 'text-destructive' : 'text-foreground'}`}
                >
                  {load}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TaskLoadTable({ rows }: { rows: VPersonTaskLoad[] }) {
  if (rows.length === 0) {
    return <EmptyState message="No task load recorded for this project yet." />
  }
  const sorted = [...rows].sort(
    (a, b) => b.todo + b.in_progress + b.blocked - (a.todo + a.in_progress + a.blocked),
  )
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Person</th>
            <th className="px-4 py-2 text-right font-medium">To do</th>
            <th className="px-4 py-2 text-right font-medium">In progress</th>
            <th className="px-4 py-2 text-right font-medium">Blocked</th>
            <th className="px-4 py-2 text-right font-medium">Overdue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => (
            <tr key={r.person_id} className="bg-card">
              <td className="px-4 py-2 font-medium text-foreground">{r.full_name}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{r.todo}</td>
              <td className="px-4 py-2 text-right tabular-nums text-primary">{r.in_progress}</td>
              <td
                className={`px-4 py-2 text-right tabular-nums ${r.blocked > 0 ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {r.blocked}
              </td>
              <td
                className={`px-4 py-2 text-right tabular-nums ${r.overdue > 0 ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}
              >
                {r.overdue}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PersonRaciTable({ rows }: { rows: VPersonWorkload[] }) {
  if (rows.length === 0) {
    return <EmptyState message="No staffed people with RACI load on this project yet." />
  }
  const sorted = [...rows].sort((a, b) => b.a_count + b.r_count - (a.a_count + a.r_count))
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Person</th>
            <th className="px-4 py-2 text-right font-medium">A</th>
            <th className="px-4 py-2 text-right font-medium">R</th>
            <th className="px-4 py-2 text-right font-medium">C</th>
            <th className="px-4 py-2 text-right font-medium">I</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((r) => (
            <tr key={r.person_id} className="bg-card">
              <td className="px-4 py-2 font-medium text-foreground">{r.full_name}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{r.a_count}</td>
              <td className="px-4 py-2 text-right tabular-nums text-primary">{r.r_count}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.c_count}</td>
              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{r.i_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
