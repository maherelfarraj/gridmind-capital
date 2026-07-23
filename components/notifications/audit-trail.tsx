'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Shield, Search, Download, User, Clock, ArrowRight, RefreshCw } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getAuditEventsAction, exportAuditCsvAction, type AuditRow } from '@/app/actions/audit'

// ─── Category helpers ─────────────────────────────────────────────────────────

function transitionCategory(code: string | null): string {
  if (!code) return 'other'
  const c = code.toUpperCase()
  if (c.includes('APPROVE') || c.includes('SUBMIT') || c.includes('REVIEW')) return 'approval'
  if (c.includes('CREATE') || c.includes('INITIATE') || c.includes('START'))  return 'create'
  if (c.includes('REJECT') || c.includes('CANCEL') || c.includes('DECLINE'))  return 'reject'
  if (c.includes('GATE') || c.includes('SG'))                                  return 'gate'
  if (c.includes('DOC') || c.includes('UPLOAD') || c.includes('SUBMIT'))      return 'document'
  return 'workflow'
}

const CATEGORY_BADGE: Record<string, string> = {
  approval:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  create:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  reject:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  gate:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  document:  'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  workflow:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  other:     'bg-muted text-muted-foreground',
}

// ─── Row component ─────────────────────────────────────────────────────────────

function LiveAuditRow({ row }: { row: AuditRow }) {
  const category = transitionCategory(row.transition_code)

  return (
    <div className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3 p-3">
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 uppercase tracking-wide mt-0.5', CATEGORY_BADGE[category])}>
          {category}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground font-mono">
              {row.transition_code ?? 'UNKNOWN'}
            </span>
            {row.from_state && row.to_state && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">{row.from_state}</Badge>
                <ArrowRight size={10} />
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-mono">{row.to_state}</Badge>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {(row.actor_name || row.actor_id) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <User size={10} />
                {row.actor_name ?? row.actor_id?.slice(0, 8)}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={10} />
              {format(new Date(row.created_at), 'dd MMM yyyy HH:mm')}
            </span>
            {row.instance_id && (
              <span className="text-[10px] font-mono text-muted-foreground/60">
                inst: {row.instance_id.slice(0, 8)}
              </span>
            )}
          </div>
          {row.comment && (
            <p className="mt-1 text-xs text-muted-foreground italic truncate">{row.comment}</p>
          )}
          {row.metadata && Object.keys(row.metadata).length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {Object.entries(row.metadata).slice(0, 4).map(([k, v]) => (
                <span key={k} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                  {k}: {String(v).slice(0, 20)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AuditSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="border-b border-border/40 p-3 flex items-start gap-3 animate-pulse">
          <div className="h-4 w-16 bg-muted rounded" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 bg-muted rounded" />
            <div className="h-2.5 w-1/2 bg-muted/60 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function AuditTrail() {
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(0)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  function handleSearch(v: string) {
    setSearch(v)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setDebouncedSearch(v); setPage(0) }, 300)
  }

  const swrKey = `audit-${page}-${debouncedSearch}`
  const { data, isLoading, mutate } = useSWR(
    swrKey,
    () => getAuditEventsAction({ page, search: debouncedSearch || undefined }),
    { revalidateOnFocus: false, keepPreviousData: true },
  )

  const rows  = data?.rows ?? []
  const total = data?.total ?? 0
  const pages = Math.ceil(total / 50)

  async function handleExport() {
    const csv = await exportAuditCsvAction()
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `audit-log-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Audit Trail</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? 'Loading…' : `${total.toLocaleString()} workflow events`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => mutate()} disabled={isLoading}>
            <RefreshCw size={14} className={cn('mr-1.5', isLoading && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download size={14} className="mr-1.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by transition code…"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-border/60 bg-background">
        {isLoading ? (
          <AuditSkeleton />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Shield size={32} className="opacity-20" />
            <p className="text-sm">No audit events found</p>
            <p className="text-xs opacity-60">Events are recorded as workflow transitions occur.</p>
          </div>
        ) : (
          rows.map(r => <LiveAuditRow key={r.id} row={r} />)
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-3 text-sm">
          <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>Prev</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Need React for the useRef hook
import * as React from 'react'
