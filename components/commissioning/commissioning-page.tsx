'use client'

import { useState } from 'react'
import useSWR from 'swr'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, FileText, Plus,
  RefreshCw, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  loadCommissioningDashboard,
  updateTestStatusAction,
  approveHandoverDocAction,
} from '@/app/actions/commissioning'
import type { CommissioningTest, HandoverRecord } from '@/lib/types/action-types'

// ── Helpers ───────────────────────────────────────────────────
const TEST_STATUS_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:     { label: 'Pending',     color: '#94a3b8', icon: Clock },
  in_progress: { label: 'In Progress', color: '#f59e0b', icon: Clock },
  passed:      { label: 'Passed',      color: '#22c55e', icon: CheckCircle2 },
  failed:      { label: 'Failed',      color: '#ef4444', icon: XCircle },
  conditional: { label: 'Conditional', color: '#f97316', icon: AlertTriangle },
}
const TEST_STATUS_FALLBACK = (raw: string) => ({ label: raw || 'Unknown', color: '#94a3b8', icon: Clock })

const DOC_STATUS_META: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: '#94a3b8' },
  submitted: { label: 'Submitted', color: '#3b82f6' },
  approved:  { label: 'Approved',  color: '#22c55e' },
  rejected:  { label: 'Rejected',  color: '#ef4444' },
}
const DOC_STATUS_FALLBACK = (raw: string) => ({ label: raw || 'Unknown', color: '#94a3b8' })

const DOC_TYPE_LABELS: Record<HandoverRecord['document_type'], string> = {
  as_built: 'As-Built', operation_manual: 'O&M Manual',
  warranty: 'Warranty', training_cert: 'Training', spare_parts: 'Spare Parts',
}

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#94a3b8', '#3b82f6']

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold" style={color ? { color } : {}}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Live badge ────────────────────────────────────────────────
function LiveBadge({ live }: { live: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
      live ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground')}>
      <span className={cn('size-1.5 rounded-full', live ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground')} />
      {live ? 'Live' : 'Illustrative'}
    </span>
  )
}

// ── Status selector ───────────────────────────────────────────
const NEXT_STATUS: Partial<Record<CommissioningTest['status'], CommissioningTest['status'][]>> = {
  pending:     ['in_progress'],
  in_progress: ['passed', 'failed', 'conditional'],
  failed:      ['in_progress'],
  conditional: ['passed'],
}

function TestRow({ test, onUpdate }: { test: CommissioningTest; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false)
  const { icon: Icon, color, label } = TEST_STATUS_META[test.status] ?? TEST_STATUS_FALLBACK(test.status)
  const nexts = NEXT_STATUS[test.status] ?? []

  async function advance(status: CommissioningTest['status']) {
    setBusy(true)
    await updateTestStatusAction(test.id, status)
    onUpdate()
    setBusy(false)
  }

  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{test.test_number}</td>
      <td className="px-3 py-2.5 text-sm font-medium">{test.system}</td>
      <td className="px-3 py-2.5 text-sm text-muted-foreground">{test.subsystem}</td>
      <td className="px-3 py-2.5 text-sm max-w-xs truncate">{test.description}</td>
      <td className="px-3 py-2.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
          <Icon className="size-3" />
          {label}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {test.scheduled_date ? new Date(test.scheduled_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
      </td>
      <td className="px-3 py-2.5">
        {test.witness_required && <Badge variant="outline" className="text-[10px]">Witness</Badge>}
      </td>
      <td className="px-3 py-2.5">
        {nexts.length > 0 && (
          <div className="flex gap-1">
            {nexts.map(s => (
              <button
                key={s}
                disabled={busy}
                onClick={() => advance(s)}
                className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-muted disabled:opacity-40 transition-colors"
              >
                → {(TEST_STATUS_META[s] ?? TEST_STATUS_FALLBACK(s)).label}
              </button>
            ))}
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Doc Row ───────────────────────────────────────────────────
function DocRow({ doc, onUpdate }: { doc: HandoverRecord; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false)
  const { label, color } = DOC_STATUS_META[doc.status] ?? DOC_STATUS_FALLBACK(doc.status)

  async function approve() {
    setBusy(true)
    await approveHandoverDocAction(doc.id)
    onUpdate()
    setBusy(false)
  }

  return (
    <tr className="border-t border-border hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{DOC_TYPE_LABELS[doc.document_type]}</td>
      <td className="px-3 py-2.5 text-sm font-medium">{doc.title}</td>
      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">Rev {doc.revision}</td>
      <td className="px-3 py-2.5">
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">{doc.submitted_by ?? '—'}</td>
      <td className="px-3 py-2.5">
        {doc.status === 'submitted' && (
          <button
            disabled={busy}
            onClick={approve}
            className="text-[10px] px-2 py-0.5 rounded border border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
          >
            Approve
          </button>
        )}
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────
export function CommissioningPage() {
  const [tab, setTab] = useState<'tests' | 'handover'>('tests')
  const { data, mutate, isLoading } = useSWR('commissioning-dashboard', loadCommissioningDashboard)

  const isLive = (data?.stats.totalTests ?? 0) > 0
  const s = data?.stats

  // Chart data
  const systemData = data?.bySystem ?? []
  const typeData = (data?.testsByType ?? []).map(r => ({
    ...r,
    name: r.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  }))
  const statusData = [
    { name: 'Passed',   value: s?.passedTests  ?? 12, fill: '#22c55e' },
    { name: 'Failed',   value: s?.failedTests  ?? 2,  fill: '#ef4444' },
    { name: 'Pending',  value: s?.pendingTests ?? 8,  fill: '#94a3b8' },
    { name: 'Running',  value: (s?.totalTests ?? 0) - (s?.passedTests ?? 0) - (s?.failedTests ?? 0) - (s?.pendingTests ?? 0), fill: '#f59e0b' },
  ].filter(d => d.value > 0)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Commissioning & Handover</h1>
          <p className="text-sm text-muted-foreground mt-0.5">G5–G6 test management, performance verification, and handover documentation</p>
        </div>
        <div className="flex items-center gap-2">
          <LiveBadge live={isLive} />
          <Button size="sm" variant="ghost" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw className={cn('size-3.5', isLoading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <KpiCard label="Total Tests" value={s?.totalTests ?? 22} />
        <KpiCard label="Passed" value={s?.passedTests ?? 12} color="#22c55e" />
        <KpiCard label="Failed" value={s?.failedTests ?? 2} color="#ef4444" />
        <KpiCard label="Pending" value={s?.pendingTests ?? 8} color="#94a3b8" />
        <KpiCard label="Pass Rate" value={`${s?.passRate ?? 55}%`} color="#3b82f6" />
        <KpiCard label="Handover Docs" value={s?.handoverDocs ?? 12} />
        <KpiCard label="Approved" value={s?.approvedDocs ?? 7} color="#22c55e" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By system */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-3">Test Results by System</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={systemData.length ? systemData : [
              { system: 'DC Collection', total: 8, passed: 6, failed: 1 },
              { system: 'Inverter Station', total: 6, passed: 3, failed: 2 },
              { system: 'SCADA', total: 4, passed: 2, failed: 0 },
              { system: 'Grid Connection', total: 4, passed: 1, failed: 1 },
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="system" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="passed" name="Passed" fill="#22c55e" stackId="a" />
              <Bar dataKey="failed" name="Failed" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status donut */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-3">Test Status Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex border-b border-border">
          {(['tests', 'handover'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors',
                tab === t ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'tests' ? `Test Pack (${data?.tests.length ?? 0})` : `Handover Docs (${data?.handover.length ?? 0})`}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          {tab === 'tests' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  {['#', 'System', 'Subsystem', 'Description', 'Status', 'Date', 'Witness', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.tests ?? []).map(t => (
                  <TestRow key={t.id} test={t} onUpdate={() => mutate()} />
                ))}
                {!data?.tests.length && (
                  <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-sm">No tests yet — seed demo data to get started</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40">
                  {['Type', 'Title', 'Rev', 'Status', 'Submitted By', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.handover ?? []).map(d => (
                  <DocRow key={d.id} doc={d} onUpdate={() => mutate()} />
                ))}
                {!data?.handover.length && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground text-sm">No handover documents yet</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
