'use client'

import * as React from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  Tooltip, ResponsiveContainer, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  CheckCircle2, Clock, AlertTriangle, GitMerge, Database, RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApprovalInboxWrapper } from '@/components/approvals/approval-inbox-wrapper'
import { loadApprovalsDashboard, seedApprovalsDemoData } from '@/app/actions/approvals'
import type { ApprovalsDashboard } from '@/app/actions/approvals'
import { cn } from '@/lib/utils'

const ILLUSTRATIVE: ApprovalsDashboard = {
  total: 18, pending: 9, approved: 7, rejected: 2, overdue: 3,
  byObjectType: [
    { name: 'opportunity', value: 5 },
    { name: 'project_charter', value: 4 },
    { name: 'purchase_order', value: 4 },
    { name: 'change_order', value: 3 },
    { name: 'variation', value: 2 },
  ],
  byStatus: [
    { name: 'pending',  value: 9, color: '#f59e0b' },
    { name: 'approved', value: 7, color: '#22c55e' },
    { name: 'rejected', value: 2, color: '#ef4444' },
  ],
  approvalRules: [
    { object_type: 'opportunity',     levels: 2, roles: ['Project Manager', 'Executive Sponsor'] },
    { object_type: 'project_charter', levels: 3, roles: ['Project Manager', 'CFO', 'Board'] },
    { object_type: 'purchase_order',  levels: 1, roles: ['Project Manager'] },
    { object_type: 'change_order',    levels: 2, roles: ['Project Manager', 'Commercial Director'] },
  ],
}

function KpiCard({ label, value, sub, accent, icon: Icon }: {
  label: string; value: number | string; sub?: string; accent: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex-1 min-w-[130px] rounded-xl bg-card border border-border p-4"
      style={{ borderLeftColor: accent, borderLeftWidth: 3 }}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <span className="opacity-40" style={{ color: accent }}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export default function ApprovalsPage() {
  const { data, mutate, isLoading } = useSWR('approvals-dashboard', loadApprovalsDashboard)
  const [seeding, setSeeding] = React.useState(false)

  const d = data ?? (isLoading ? null : ILLUSTRATIVE)
  const isLive = !!data

  async function handleSeed() {
    setSeeding(true)
    await seedApprovalsDemoData()
    await mutate()
    setSeeding(false)
  }

  const byTypeData = (() => {
    if (!d) return []
    return d.byObjectType.map((r) => ({
      name: r.name.replace('_', ' '),
      value: r.value,
    }))
  })()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approvals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and action pending approvals across all projects
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full',
            isLive
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-amber-500/15 text-amber-400',
          )}>
            {isLive ? 'Live' : 'Illustrative'}
          </span>
          {!isLive && (
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <Database className="size-3.5" aria-hidden />
              {seeding ? 'Seeding...' : 'Seed Demo'}
            </button>
          )}
          <button
            type="button"
            onClick={() => mutate()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      {d && (
        <div className="flex flex-wrap gap-3" role="region" aria-label="Approval statistics">
          <KpiCard label="Total"    value={d.total}    accent="#64ffda" icon={GitMerge}     />
          <KpiCard label="Pending"  value={d.pending}  accent="#f59e0b" icon={Clock}         />
          <KpiCard label="Approved" value={d.approved} accent="#22c55e" icon={CheckCircle2}  />
          <KpiCard label="Rejected" value={d.rejected} accent="#ef4444" icon={CheckCircle2}  />
          <KpiCard label="Overdue"  value={d.overdue}  accent="#ef4444" icon={AlertTriangle}
            sub={d.overdue > 0 ? 'Action required' : 'All on time'} />
        </div>
      )}

      {/* Charts row */}
      {d && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* By object type */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Approvals by Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={byTypeData} margin={{ top: 4, right: 8, bottom: 24, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} angle={-20} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, 'Count']}
                  />
                  <Bar dataKey="value" fill="#64ffda" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status distribution */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={d.byStatus}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    outerRadius={72}
                    label={({ name, percent }) => `${(percent ?? 0 * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {d.byStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [v, 'Count']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 shrink-0">
                {d.byStatus.map((s) => (
                  <li key={s.name} className="flex items-center gap-2 text-xs text-foreground capitalize">
                    <span className="size-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                    {s.name} <span className="ml-1 text-muted-foreground">({s.value})</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Approval Rules chain */}
      {d && d.approvalRules.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Approval Authority Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground uppercase tracking-wide text-[10px]">
                    <th className="text-left py-2 pr-4">Object Type</th>
                    <th className="text-left py-2 pr-4">Levels</th>
                    <th className="text-left py-2">Approval Chain</th>
                  </tr>
                </thead>
                <tbody>
                  {d.approvalRules.map((rule, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-4 font-mono text-[#64ffda] capitalize">
                        {rule.object_type.replace('_', ' ')}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">{rule.levels}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          {rule.roles.map((role, j) => (
                            <React.Fragment key={role}>
                              <span className="px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-200 text-[10px]">
                                {role}
                              </span>
                              {j < rule.roles.length - 1 && (
                                <span className="text-muted-foreground">→</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live inbox */}
      <ApprovalInboxWrapper showFilters />
    </div>
  )
}
