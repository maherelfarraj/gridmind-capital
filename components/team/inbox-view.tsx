'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Inbox, Clock, AlertTriangle, CheckSquare, FileSignature, Gavel } from 'lucide-react'
import type { VInbox } from '@/lib/db/types'

type SourceFilter = 'all' | string

function isOverdue(due: string | null): boolean {
  if (!due) return false
  return new Date(due).getTime() < Date.now()
}

const SOURCE_META: Record<
  string,
  { label: string; icon: typeof Inbox; href: string }
> = {
  signoff: { label: 'Gate sign-off', icon: FileSignature, href: '/team/signoffs' },
  gate_signoff: { label: 'Gate sign-off', icon: FileSignature, href: '/team/signoffs' },
  approval: { label: 'Approval', icon: Gavel, href: '/team/signoffs' },
  approval_item: { label: 'Approval', icon: Gavel, href: '/team/signoffs' },
  task: { label: 'Task', icon: CheckSquare, href: '/team/tasks' },
}

function metaFor(source: string) {
  return (
    SOURCE_META[source] ?? { label: source, icon: Inbox, href: '/team' }
  )
}

export function InboxView({ items }: { items: VInbox[] }) {
  const [filter, setFilter] = useState<SourceFilter>('all')

  const sources = useMemo(() => {
    const set = new Set(items.map((i) => i.source))
    return Array.from(set)
  }, [items])

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((i) => i.source === filter)),
    [items, filter],
  )

  const overdueCount = items.filter((i) => isOverdue(i.due_date)).length

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <p className="mt-3 text-sm font-medium text-foreground">Your inbox is clear</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No sign-offs, approvals, or tasks are awaiting action.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <Inbox className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm text-foreground">{items.length} awaiting action</span>
        </div>
        {overdueCount > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
            <span className="text-sm text-destructive">{overdueCount} overdue</span>
          </div>
        )}
      </div>

      {/* Source filter tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by source">
        <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} label={`All (${items.length})`} />
        {sources.map((s) => {
          const count = items.filter((i) => i.source === s).length
          return (
            <FilterTab
              key={s}
              active={filter === s}
              onClick={() => setFilter(s)}
              label={`${metaFor(s).label} (${count})`}
            />
          )
        })}
      </div>

      {/* Item list */}
      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {filtered.map((item) => {
          const meta = metaFor(item.source)
          const Icon = meta.icon
          const overdue = isOverdue(item.due_date)
          return (
            <li key={`${item.source}-${item.id}`}>
              <Link
                href={meta.href}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{meta.label}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{item.status.replace(/_/g, ' ')}</span>
                  </span>
                </span>
                {item.due_date && (
                  <span
                    className={`flex shrink-0 items-center gap-1 text-xs ${
                      overdue ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {new Date(item.due_date).toLocaleDateString()}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function FilterTab({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  )
}
