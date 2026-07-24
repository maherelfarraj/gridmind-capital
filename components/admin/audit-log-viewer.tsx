'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Search, ChevronDown, ChevronRight, X, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getAuditLog, getRecordHistory, type AuditEntry } from '@/app/actions/audit'

// ─── Constants ────────────────────────────────────────────────

const AUDITED_TABLES = [
  { value: 'all',               label: 'All tables' },
  { value: 'projects',          label: 'projects' },
  { value: 'variation_orders',  label: 'variation_orders' },
  { value: 'approvals',         label: 'approvals' },
  { value: 'phase_gates',       label: 'phase_gates' },
  { value: 'profiles',          label: 'profiles' },
  { value: 'ncrs',              label: 'ncrs' },
  { value: 'payment_milestones',label: 'payment_milestones' },
  { value: 'risks',             label: 'risks' },
  { value: 'documents',         label: 'documents' },
  { value: 'cost_entries',      label: 'cost_entries' },
  { value: 'guarantees',        label: 'guarantees' },
  { value: 'retention_entries', label: 'retention_entries' },
  { value: 'contracts',         label: 'contracts' },
  { value: 'gate_signoffs',     label: 'gate_signoffs' },
  { value: 'signatures',        label: 'signatures' },
]

const ACTION_FILTERS = [
  { value: 'all',    label: 'All actions' },
  { value: 'INSERT', label: 'Insert' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
]

// ─── Action badge ─────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const upper = action.toUpperCase()
  const styles =
    upper === 'INSERT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
    upper === 'UPDATE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
    upper === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                         'bg-slate-100 text-slate-600 dark:bg-muted dark:text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', styles)}>
      {upper}
    </span>
  )
}

// ─── Diff panel ───────────────────────────────────────────────

function DiffPanel({ entry }: { entry: AuditEntry }) {
  const action = entry.action.toUpperCase()
  const oldData = entry.old_data ?? {}
  const newData = entry.new_data ?? {}

  // Collect all field keys
  const allKeys = [...new Set([...Object.keys(oldData), ...Object.keys(newData)])].sort()

  // For INSERT: show only new_data. For DELETE: only old_data. For UPDATE: compare.
  const showInsert = action === 'INSERT'
  const showDelete = action === 'DELETE'

  const rows = allKeys.map((key) => {
    const oldVal = oldData[key]
    const newVal = newData[key]
    const changed = !showInsert && !showDelete && JSON.stringify(oldVal) !== JSON.stringify(newVal)
    return { key, oldVal, newVal, changed }
  })

  const formatVal = (v: unknown): string => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'object') return JSON.stringify(v, null, 0)
    return String(v)
  }

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <ActionBadge action={entry.action} />
        <span className="font-mono text-xs text-muted-foreground">{entry.entity_type}</span>
        <ChevronRight className="size-3 text-muted-foreground/50" aria-hidden />
        <span className="font-mono text-xs text-foreground truncate max-w-[200px]" title={entry.entity_id ?? ''}>
          {entry.entity_id ? entry.entity_id.slice(0, 8) + '…' : '—'}
        </span>
        <span className="ms-auto text-xs text-muted-foreground">
          {entry.changed_by ?? 'System'} · {new Date(entry.changed_at).toLocaleString()}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center">No field data recorded.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground w-1/4">Field</th>
                {!showInsert && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground w-[37.5%]">Before</th>
                )}
                {!showDelete && (
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground w-[37.5%]">After</th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, oldVal, newVal, changed }) => (
                <tr
                  key={key}
                  className={cn(
                    'border-b border-border/50 last:border-0',
                    changed && 'bg-amber-50 dark:bg-amber-950/20',
                  )}
                >
                  <td className="px-4 py-2 font-mono text-xs text-foreground/80 align-top">{key}</td>
                  {!showInsert && (
                    <td className={cn(
                      'px-4 py-2 font-mono text-xs align-top break-all',
                      changed ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                    )}>
                      {formatVal(oldVal)}
                    </td>
                  )}
                  {!showDelete && (
                    <td className={cn(
                      'px-4 py-2 font-mono text-xs align-top break-all',
                      changed ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground',
                    )}>
                      {formatVal(newVal)}
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

// ─── Record history panel ─────────────────────────────────────

export function RecordHistoryPanel({
  tableName,
  recordId,
  label,
  onClose,
}: {
  tableName: string
  recordId: string
  label?: string
  onClose: () => void
}) {
  const { data, isLoading } = useSWR(
    `record-history-${tableName}-${recordId}`,
    () => getRecordHistory(tableName, recordId),
  )

  const entries = data && 'entries' in data ? data.entries : []
  const error   = data && 'error' in data   ? data.error   : null

  return (
    <div
      className="fixed inset-y-0 end-0 z-50 flex w-full max-w-2xl flex-col bg-background shadow-2xl border-s border-border"
      role="dialog"
      aria-modal="true"
      aria-label={`Change history for ${label ?? recordId}`}
    >
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <History className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Change History</h2>
            <p className="text-xs text-muted-foreground">
              {label ? `${label} · ` : ''}<span className="font-mono">{tableName}</span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="Close history panel"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {isLoading && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            Loading history…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
        {!isLoading && !error && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <History className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No change history found for this record.</p>
            <p className="text-xs text-muted-foreground/70">The audit trigger may not be enabled on this table.</p>
          </div>
        )}
        {entries.map((entry, i) => (
          <div key={entry.id} className="relative">
            {/* Timeline connector */}
            {i < entries.length - 1 && (
              <div className="absolute start-[19px] top-[38px] bottom-[-16px] w-0.5 bg-border" aria-hidden />
            )}
            <div className="flex gap-3">
              {/* Timeline dot */}
              <div className="relative z-10 mt-[9px] flex size-[10px] shrink-0 items-center justify-center rounded-full bg-border ring-2 ring-background" aria-hidden />
              <div className="flex-1 min-w-0">
                <DiffPanel entry={entry} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main AuditLogViewer ──────────────────────────────────────

export function AuditLogViewer() {
  // Filters
  const [tableName, setTableName] = React.useState('all')
  const [action,    setAction]    = React.useState('all')
  const [dateFrom,  setDateFrom]  = React.useState('')
  const [dateTo,    setDateTo]    = React.useState('')
  const [limit,     setLimit]     = React.useState(50)

  // Selected row for diff panel
  const [selected, setSelected] = React.useState<AuditEntry | null>(null)

  const swrKey = `audit-log-${tableName}-${action}-${dateFrom}-${dateTo}-${limit}`

  const { data, isLoading, mutate } = useSWR(
    swrKey,
    () => getAuditLog({
      tableName: tableName !== 'all' ? tableName : undefined,
      limit,
    }),
    { revalidateOnFocus: false },
  )

  const allEntries: AuditEntry[] = data && 'entries' in data ? data.entries : []
  const fetchError = data && 'error' in data ? data.error : null

  // Client-side filter: action + date range (since getAuditLog only filters by table/recordId)
  const entries = allEntries.filter((e) => {
    if (action !== 'all' && e.action.toUpperCase() !== action) return false
    if (dateFrom && e.changed_at < dateFrom) return false
    if (dateTo) {
      const toEnd = dateTo + 'T23:59:59'
      if (e.changed_at > toEnd) return false
    }
    return true
  })

  return (
    <>
      {/* Dim overlay when diff panel is open */}
      {selected && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={() => setSelected(null)}
          aria-hidden
        />
      )}

      {/* Diff slide panel */}
      {selected && (
        <DiffPanel
          entry={selected}
          // Rendered inside a positioned container:
          // wrap in a fixed slide-over
        />
      )}

      <div className="space-y-5 relative">
        {/* Page header */}
        <header className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <History className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Immutable row-level change history written by database triggers — insert, update, and delete events across audited tables.
            </p>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Table filter */}
          <div className="relative">
            <select
              value={tableName}
              onChange={(e) => { setTableName(e.target.value); setSelected(null) }}
              className="h-9 rounded-lg border border-border bg-background ps-3 pe-8 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40"
              aria-label="Filter by table"
            >
              {AUDITED_TABLES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" aria-hidden />
          </div>

          {/* Action filter */}
          <div className="relative">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background ps-3 pe-8 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40"
              aria-label="Filter by action"
            >
              {ACTION_FILTERS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" aria-hidden />
          </div>

          {/* Date range */}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            aria-label="To date"
          />

          {/* Limit selector */}
          <div className="relative ms-auto">
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-9 rounded-lg border border-border bg-background ps-3 pe-8 text-sm text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring/40"
              aria-label="Result limit"
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>{n} rows</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" aria-hidden />
          </div>

          <button
            type="button"
            onClick={() => mutate()}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground hover:bg-muted transition-colors"
            aria-label="Refresh audit log"
          >
            Refresh
          </button>
        </div>

        {/* Error */}
        {fetchError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {fetchError}
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Count bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">
              {isLoading ? 'Loading…' : `${entries.length} event${entries.length !== 1 ? 's' : ''}`}
            </span>
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="size-3" /> Close diff
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Table</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Action</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Record ID</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">Changed by</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap sr-only">Diff</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Loading audit entries…
                    </td>
                  </tr>
                )}
                {!isLoading && entries.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Search className="size-8 text-muted-foreground/30" aria-hidden />
                        <p className="text-sm text-muted-foreground">No audit entries found.</p>
                        <p className="text-xs text-muted-foreground/70">
                          Audit triggers must be enabled on the table for changes to appear here.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {entries.map((entry) => {
                  const isActive = selected?.id === entry.id
                  return (
                    <tr
                      key={entry.id}
                      className={cn(
                        'border-b border-border/50 last:border-0 cursor-pointer transition-colors',
                        isActive
                          ? 'bg-primary/8 dark:bg-primary/10'
                          : 'hover:bg-muted/40',
                      )}
                      onClick={() => setSelected(isActive ? null : entry)}
                      role="button"
                      tabIndex={0}
                      aria-label={`View diff for ${entry.action} on ${entry.entity_type}`}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(isActive ? null : entry) } }}
                    >
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(entry.changed_at).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground">{entry.entity_type}</td>
                      <td className="px-4 py-2.5">
                        <ActionBadge action={entry.action} />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                        {entry.entity_id ? entry.entity_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-foreground">
                        {entry.changed_by ?? <span className="text-muted-foreground/60 italic">System</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <ChevronRight
                          className={cn('size-3.5 text-muted-foreground transition-transform', isActive && 'rotate-90')}
                          aria-hidden
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inline diff panel (below table, full-width) */}
        {selected && (
          <div className="rounded-xl border border-border overflow-hidden">
            <DiffPanel entry={selected} />
          </div>
        )}
      </div>
    </>
  )
}
