'use client'

import * as React from 'react'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Plus,
  Download,
  AlertTriangle,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */

export type ColumnAlign = 'left' | 'center' | 'right'

export interface ColumnDef<T = Record<string, unknown>> {
  /** Unique key, also used as default sort field */
  key: string
  /** Column header label */
  header: string
  /** Optional fixed width (e.g. '120px', '10%') */
  width?: string
  /** Whether this column is sortable */
  sortable?: boolean
  /** Tailwind text-align class override */
  align?: ColumnAlign
  /**
   * Custom cell renderer. Receives the row object.
   * Return a React node — use Badge, StatusBadge, etc. here.
   */
  render?: (row: T) => React.ReactNode
}

export interface ActionDef {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'gate'
  /** Shows only as icon on small screens */
  iconOnly?: boolean
}

export interface DataRegisterProps<T = Record<string, unknown>> {
  /** Table title shown in the header */
  title: string
  /** Row data */
  data: T[]
  /** Column definitions */
  columns: ColumnDef<T>[]
  /** Object keys to include in the global search filter */
  searchFields?: (keyof T)[]
  /** Search input placeholder */
  searchPlaceholder?: string
  /** Unique row identifier field */
  rowKey: keyof T
  /** Called when a data row is clicked */
  onRowClick?: (row: T) => void
  /** Action buttons rendered in the header */
  actions?: ActionDef[]
  /** Rows per page (default 10) */
  pageSize?: number
  /** Loading skeleton state */
  loading?: boolean
  /** Error message to display */
  error?: string | null
  /** Custom empty-state message */
  emptyMessage?: string
  /** Additional className for the outer wrapper */
  className?: string
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

type SortDir = 'asc' | 'desc' | null

function sortRows<T>(rows: T[], key: string, dir: SortDir): T[] {
  if (!dir) return rows
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[key]
    const bv = (b as Record<string, unknown>)[key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
    return dir === 'asc' ? cmp : -cmp
  })
}

function filterRows<T>(rows: T[], query: string, fields: (keyof T)[]): T[] {
  if (!query.trim() || fields.length === 0) return rows
  const q = query.toLowerCase()
  return rows.filter((row) =>
    fields.some((f) => String((row as Record<string, unknown>)[f as string] ?? '').toLowerCase().includes(q)),
  )
}

const alignClass: Record<ColumnAlign, string> = {
  left:   'text-left',
  center: 'text-center',
  right:  'text-right',
}

/* ─────────────────────────────────────────────────────────────
   SKELETON
───────────────────────────────────────────── */

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded bg-muted/60', className)}
      aria-hidden="true"
    />
  )
}

function TableSkeleton({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr
          key={ri}
          className={cn(
            'border-b border-border',
            ri % 2 === 1 && 'bg-muted/20 dark:bg-muted/10',
          )}
        >
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3">
              <Skeleton className={cn('h-4', ci === 0 ? 'w-32' : ci % 3 === 0 ? 'w-16' : 'w-24')} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
   SORT ICON
───────────────────────────────────────────── */

function SortIcon({ dir }: { dir: SortDir }) {
  if (dir === 'asc')
    return <ChevronUp className="size-3.5 text-primary shrink-0" aria-hidden="true" />
  if (dir === 'desc')
    return <ChevronDown className="size-3.5 text-primary shrink-0" aria-hidden="true" />
  return <ChevronsUpDown className="size-3.5 text-muted-foreground/50 shrink-0" aria-hidden="true" />
}

/* ─────────────────────────────────────────────────────────────
   PAGINATION
───────────────────────────────────────────── */

interface PaginationProps {
  page: number
  totalPages: number
  onPage: (p: number) => void
  totalRows: number
  filteredRows: number
  pageSize: number
}

function Pagination({ page, totalPages, onPage, totalRows, filteredRows, pageSize }: PaginationProps) {
  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, filteredRows)

  // Build page number window (max 7 buttons)
  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3)  pages.push('…')
    const lo = Math.max(2, page - 1)
    const hi = Math.min(totalPages - 1, page + 1)
    for (let i = lo; i <= hi; i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div
      role="navigation"
      aria-label="Pagination"
      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-border bg-card"
    >
      {/* Results count */}
      <p className="text-xs text-muted-foreground select-none">
        {filteredRows === 0 ? (
          'No results'
        ) : (
          <>
            Showing{' '}
            <span className="font-medium text-foreground">{start}–{end}</span>{' '}
            of{' '}
            <span className="font-medium text-foreground">{filteredRows}</span>
            {filteredRows !== totalRows && (
              <> (filtered from {totalRows} total)</>
            )}
          </>
        )}
      </p>

      {/* Page buttons */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            aria-label="Previous page"
            className={cn(
              'inline-flex items-center justify-center size-7 rounded-md text-sm',
              'border border-border bg-background hover:bg-muted transition-colors',
              'disabled:pointer-events-none disabled:opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
          >
            <ChevronLeft className="size-3.5" />
          </button>

          {pages.map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-xs select-none">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p as number)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center justify-center size-7 rounded-md text-xs font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  p === page
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border bg-background hover:bg-muted text-foreground',
                )}
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => onPage(page + 1)}
            disabled={page === totalPages}
            aria-label="Next page"
            className={cn(
              'inline-flex items-center justify-center size-7 rounded-md text-sm',
              'border border-border bg-background hover:bg-muted transition-colors',
              'disabled:pointer-events-none disabled:opacity-40',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */

export function DataRegister<T = Record<string, unknown>>({
  title,
  data,
  columns,
  searchFields = [],
  searchPlaceholder = 'Search…',
  rowKey,
  onRowClick,
  actions = [],
  pageSize = 10,
  loading = false,
  error = null,
  emptyMessage = 'No records found.',
  className,
}: DataRegisterProps<T>) {
  const [query,     setQuery]     = React.useState('')
  const [sortKey,   setSortKey]   = React.useState<string | null>(null)
  const [sortDir,   setSortDir]   = React.useState<SortDir>(null)
  const [page,      setPage]      = React.useState(1)

  // Reset page on search
  React.useEffect(() => { setPage(1) }, [query])

  /* ── Derived rows ── */
  const filtered = React.useMemo(
    () => filterRows(data, query, searchFields as (keyof T)[]),
    [data, query, searchFields],
  )
  const sorted = React.useMemo(
    () => (sortKey ? sortRows(filtered, sortKey, sortDir) : filtered),
    [filtered, sortKey, sortDir],
  )
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  /* ── Sort toggle ── */
  function handleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortKey(null)
      setSortDir(null)
    }
    setPage(1)
  }

  /* ── Keyboard row handler ── */
  function handleRowKeyDown(e: React.KeyboardEvent, row: T) {
    if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
      e.preventDefault()
      onRowClick(row)
    }
  }

  const isClickable = Boolean(onRowClick)

  return (
    <section
      aria-label={title}
      className={cn('rounded-xl border border-border bg-card overflow-hidden shadow-sm', className)}
    >
      {/* ── Header ─────────────────────────── */}
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-foreground font-sans">{title}</h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          {searchFields.length > 0 && (
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`Search ${title}`}
                className={cn(
                  'h-8 w-52 rounded-md border border-border bg-background pl-8 pr-3',
                  'text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring',
                  'transition-colors',
                )}
              />
            </div>
          )}

          {/* Action buttons */}
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant ?? 'outline'}
              size="sm"
              onClick={action.onClick}
              aria-label={action.label}
            >
              {action.icon}
              <span className={action.iconOnly ? 'sr-only sm:not-sr-only' : undefined}>
                {action.label}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* ── Error state ─────────────────────── */}
      {error && !loading && (
        <div
          role="alert"
          className="flex items-start gap-3 px-4 py-6 text-sm text-destructive bg-destructive/5"
        >
          <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Table ───────────────────────────── */}
      {!error && (
        <div className="overflow-x-auto">
          <table
            role="grid"
            aria-label={title}
            aria-rowcount={loading ? undefined : sorted.length}
            aria-busy={loading}
            className="w-full min-w-max border-collapse text-sm"
          >
            {/* Head */}
            <thead>
              <tr className="border-b border-border bg-muted/40 dark:bg-muted/20">
                {columns.map((col) => {
                  const isActive = sortKey === col.key
                  const dir: SortDir = isActive ? sortDir : null
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      style={col.width ? { width: col.width } : undefined}
                      className={cn(
                        'px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground select-none',
                        alignClass[col.align ?? 'left'],
                        col.sortable && 'cursor-pointer hover:text-foreground transition-colors',
                      )}
                      aria-sort={
                        col.sortable
                          ? dir === 'asc'
                            ? 'ascending'
                            : dir === 'desc'
                              ? 'descending'
                              : 'none'
                          : undefined
                      }
                      onClick={col.sortable ? () => handleSort(col.key) : undefined}
                      onKeyDown={
                        col.sortable
                          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col.key) } }
                          : undefined
                      }
                      tabIndex={col.sortable ? 0 : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {col.sortable && <SortIcon dir={dir} />}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              {loading ? (
                <TableSkeleton cols={columns.length} rows={pageSize} />
              ) : pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-14 text-center"
                  >
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Inbox className="size-8 opacity-40" aria-hidden="true" />
                      <p className="text-sm">{emptyMessage}</p>
                      {query && (
                        <button
                          className="text-xs text-primary underline-offset-2 hover:underline"
                          onClick={() => setQuery('')}
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((row, ri) => {
                  const key = String((row as Record<string, unknown>)[rowKey as string])
                  const isEven = ri % 2 === 1
                  return (
                    <tr
                      key={key}
                      role={isClickable ? 'button' : 'row'}
                      tabIndex={isClickable ? 0 : undefined}
                      aria-label={isClickable ? `Open row ${key}` : undefined}
                      onClick={isClickable ? () => onRowClick!(row) : undefined}
                      onKeyDown={isClickable ? (e) => handleRowKeyDown(e, row) : undefined}
                      className={cn(
                        'border-b border-border/60 transition-colors duration-100',
                        isEven && 'bg-muted/20 dark:bg-white/[0.02]',
                        isClickable && [
                          'cursor-pointer',
                          'hover:bg-accent dark:hover:bg-accent/60',
                          'focus-visible:outline-none focus-visible:bg-accent',
                        ],
                        // Subtle left accent line on hover for clickable rows
                        isClickable && 'group',
                      )}
                    >
                      {columns.map((col, ci) => {
                        const rawVal = (row as Record<string, unknown>)[col.key]
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              'px-4 py-3 text-sm text-foreground',
                              alignClass[col.align ?? 'left'],
                              // First column slightly bolder
                              ci === 0 && 'font-medium',
                            )}
                          >
                            {col.render ? col.render(row) : String(rawVal ?? '—')}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ──────────────────────── */}
      {!loading && !error && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPage={setPage}
          totalRows={data.length}
          filteredRows={sorted.length}
          pageSize={pageSize}
        />
      )}
    </section>
  )
}
