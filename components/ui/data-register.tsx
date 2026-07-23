'use client'

import * as React from 'react'
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  Plus,
  Download,
  SlidersHorizontal,
  AlertTriangle,
  Inbox,
  X,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, PhaseBadge } from '@/components/ui/badge'

/* ─────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────── */

export type ColumnAlign = 'left' | 'center' | 'right'

export type ColumnType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'badge'
  | 'avatar'
  | 'link'
  | 'action'
  | 'boolean'
  | 'progress'

export interface FilterOption {
  label: string
  value: string
}

export interface ColumnDef<T = Record<string, unknown>> {
  /** Unique key, also used as default sort field */
  key: string
  /** Column header label */
  header: string
  /** Optional fixed width (e.g. '120px', '10%') */
  width?: string
  /** Whether this column is sortable */
  sortable?: boolean
  /** Text alignment */
  align?: ColumnAlign
  /** Built-in cell type — used when no render() is provided */
  type?: ColumnType
  /** Badge variant key for type='badge' */
  badgeVariant?: string
  /** Format string hint for dates / numbers */
  format?: string
  /** Currency code for type='currency' (default 'USD') */
  currency?: string
  /** Whether this column is filterable */
  filterable?: boolean
  /** Filter input type */
  filterType?: 'text' | 'select' | 'date' | 'number'
  /** Options for select filter */
  filterOptions?: FilterOption[]
  /**
   * Custom cell renderer. Receives the row object.
   * Overrides the built-in type renderer.
   */
  render?: (row: T) => React.ReactNode
}

export interface ActionDef {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'gate'
  /** Shows label only on ≥sm screens */
  iconOnly?: boolean
}

export interface DataRegisterProps<T = Record<string, unknown>> {
  /** Row data */
  data: T[]
  /** Column definitions */
  columns: ColumnDef<T>[]
  /** Table title shown in the header */
  title?: string
  /** Optional icon rendered next to the title */
  icon?: React.ReactNode
  /** Fields to search (string keys) */
  searchFields?: string[]
  /** Called when a data row is clicked */
  onRowClick?: (row: T) => void
  /** Unique row identifier field */
  rowKey: keyof T
  /** Action buttons rendered in the header (ReactNode) */
  actions?: React.ReactNode
  /** Rows per page (default 10) */
  pageSize?: number
  /** Page size options (default [10, 25, 50, 100]) */
  pageSizeOptions?: number[]
  /** Enable sorting globally */
  sortable?: boolean
  /** Enable column-level filtering globally */
  filterable?: boolean
  /** Enable search globally */
  searchable?: boolean
  /** Enable row selection checkboxes */
  selectable?: boolean
  /** Called with selected rows when selection changes */
  onSelectionChange?: (selected: T[]) => void
  /** Bulk "Export selected" handler — button is hidden when omitted */
  onExportSelected?: (selected: T[]) => void
  /** Bulk "Delete selected" handler — button is hidden when omitted */
  onDeleteSelected?: (selected: T[]) => void
  /** Loading skeleton state */
  loading?: boolean
  /** Custom empty-state icon */
  emptyIcon?: React.ReactNode
  /** Custom empty-state title */
  emptyTitle?: string
  /** Custom empty-state subtitle */
  emptySubtitle?: string
  // ── Legacy / convenience props (kept for backward compat) ──
  /** @deprecated Use icon instead */
  titleIcon?: React.ReactNode
  /** Search placeholder text */
  searchPlaceholder?: string
  /** Currently selected row key (controlled single-select) */
  selectedKey?: string
  /** Error message to display */
  error?: string | null
  /** Custom empty-state message (falls back to emptySubtitle) */
  emptyMessage?: string
  /** Additional className for the outer wrapper */
  className?: string
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────── */

type SortDir = 'asc' | 'desc' | null

/** Single sort spec — used for multi-sort (Shift+click) */
interface SortSpec {
  key: string
  dir: 'asc' | 'desc'
}

/** Debounce hook for search input */
function useDebounce<T>(value: T, delay = 200): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value)
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

function sortRows<T>(rows: T[], specs: SortSpec[]): T[] {
  if (!specs.length) return rows
  return [...rows].sort((a, b) => {
    for (const { key, dir } of specs) {
      const av = (a as Record<string, unknown>)[key]
      const bv = (b as Record<string, unknown>)[key]
      if (av == null && bv == null) continue
      if (av == null) return 1
      if (bv == null) return -1
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
      if (cmp !== 0) return dir === 'asc' ? cmp : -cmp
    }
    return 0
  })
}

function filterRows<T>(
  rows: T[],
  query: string,
  fields: (keyof T)[],
  colFilters: Record<string, string>,
  columns: ColumnDef<T>[],
): T[] {
  let result = rows

  // Global search
  if (query.trim() && fields.length > 0) {
    const q = query.toLowerCase()
    result = result.filter((row) =>
      fields.some((f) => String((row as Record<string, unknown>)[f as string] ?? '').toLowerCase().includes(q)),
    )
  }

  // Column-level filters
  for (const [key, val] of Object.entries(colFilters)) {
    if (!val) continue
    const col = columns.find((c) => c.key === key)
    if (!col) continue
    result = result.filter((row) => {
      const cell = String((row as Record<string, unknown>)[key] ?? '')
      if (col.filterType === 'select') return cell === val
      return cell.toLowerCase().includes(val.toLowerCase())
    })
  }

  return result
}

const alignClass: Record<ColumnAlign, string> = {
  left:   'text-left',
  center: 'text-center',
  right:  'text-right',
}

/* ─────────────────────────────────────────────────────────────
   COLUMN RESIZE HOOK
───────────────────────────────────────────── */

function useColumnResize(initialWidths: Record<string, number>) {
  const [widths, setWidths] = React.useState<Record<string, number>>(initialWidths)
  const dragging = React.useRef<{ key: string; startX: number; startW: number } | null>(null)

  const onMouseDown = React.useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault()
    const startW = widths[key] ?? 100
    dragging.current = { key, startX: e.clientX, startW }

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return
      const delta = ev.clientX - dragging.current.startX
      const newW = Math.max(60, dragging.current.startW + delta)
      setWidths((prev) => ({ ...prev, [dragging.current!.key]: newW }))
    }
    function onUp() {
      dragging.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [widths])

  return { widths, onMouseDown }
}

/* ─────────────────────────────────────────────────────────────
   ROW ACTION MENU (3-dot dropdown)
───────────────────────────────────────────── */

function RowActionMenu() {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Row actions"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center justify-center size-7 rounded-md',
          'text-muted-foreground hover:text-foreground hover:bg-accent/60',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
          'transition-colors duration-100',
          open && 'bg-accent/60 text-foreground',
        )}
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Row action menu"
          className={cn(
            'absolute right-0 z-50 mt-1 w-36 origin-top-right rounded-lg border border-border',
            'bg-card shadow-lg shadow-black/20 py-1',
            'animate-in fade-in-0 zoom-in-95 duration-100',
          )}
        >
          {(['View', 'Edit', 'Delete'] as const).map((label) => (
            <button
              key={label}
              role="menuitem"
              type="button"
              onClick={() => setOpen(false)}
              className={cn(
                'flex w-full items-center px-3 py-1.5 text-sm text-foreground',
                'hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent/60',
                label === 'Delete' && 'text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/10',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   BUILT-IN CELL RENDERERS
───────────────────────────────────────────── */

function renderCell<T>(col: ColumnDef<T>, row: T): React.ReactNode {
  const raw = (row as Record<string, unknown>)[col.key]

  switch (col.type) {
    case 'number': {
      if (raw == null) return <span className="text-muted-foreground">—</span>
      const n = Number(raw)
      return (
        <span className="tabular-nums font-mono text-xs">
          {isNaN(n) ? '—' : n.toLocaleString()}
        </span>
      )
    }

    case 'currency': {
      if (raw == null) return <span className="text-muted-foreground">—</span>
      const n = Number(raw)
      const fmt = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: col.currency ?? 'USD',
        notation: 'compact',
        maximumFractionDigits: 1,
      })
      return (
        <span className="tabular-nums font-mono text-xs">
          {isNaN(n) ? '—' : fmt.format(n)}
        </span>
      )
    }

    case 'date': {
      if (!raw) return <span className="text-muted-foreground">—</span>
      try {
        const d = new Date(raw as string)
        return (
          <span className="text-xs text-muted-foreground">
            {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )
      } catch {
        return <span className="text-muted-foreground">—</span>
      }
    }

    case 'boolean': {
      const truthy = raw === true || raw === 1 || raw === 'true' || raw === 'yes'
      return truthy
        ? <CheckCircle2 className="size-4 text-[#22c55e]" aria-label="Yes" />
        : <XCircle     className="size-4 text-[#ef4444]"  aria-label="No" />
    }

    case 'progress': {
      const pct = Math.min(100, Math.max(0, Number(raw) || 0))
      return (
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <span className="text-[11px] tabular-nums text-muted-foreground w-8 text-right shrink-0">
            {pct}%
          </span>
        </div>
      )
    }

    case 'avatar': {
      // Expects a string value "Name · Role" or just "Name"
      const text   = String(raw ?? '')
      const [name] = text.split('·').map((s) => s.trim())
      const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('')
      return (
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[#64ffda]/20 text-[#64ffda] text-[10px] font-bold"
          >
            {initials}
          </span>
          <span className="text-xs text-foreground truncate max-w-[120px]">{text}</span>
        </div>
      )
    }

    case 'link': {
      const href = String(raw ?? '#')
      return (
        <a
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="text-primary text-xs underline-offset-2 hover:underline focus:outline-none focus:underline truncate block max-w-[160px]"
        >
          {href}
        </a>
      )
    }

    case 'badge': {
      if (raw == null || raw === '') return <span className="text-muted-foreground">—</span>
      const label = String(raw)
      // badgeVariant: 'phase' → PhaseBadge; anything else → Badge with that variant
      if (col.badgeVariant === 'phase') {
        return <PhaseBadge phase={label as any} aria-label={`Phase: ${label}`} />
      }
      return (
        <Badge variant={(col.badgeVariant ?? 'secondary') as any} dot={col.badgeVariant === 'status'}>
          {label}
        </Badge>
      )
    }

    case 'action': {
      return <RowActionMenu />
    }

    // 'text' and default
    default:
      return (
        <span className="truncate block max-w-[220px]">
          {raw == null || raw === '' ? <span className="text-muted-foreground">—</span> : String(raw)}
        </span>
      )
  }
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

function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr
          key={ri}
          className={cn('border-b border-border', ri % 2 === 1 && 'bg-muted/20')}
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
    return <ChevronUp   className="size-3.5 text-primary shrink-0" aria-hidden="true" />
  if (dir === 'desc')
    return <ChevronDown className="size-3.5 text-primary shrink-0" aria-hidden="true" />
  return <ChevronsUpDown className="size-3.5 text-muted-foreground/50 shrink-0" aria-hidden="true" />
}

/* ─────────────────────────────────────────────────────────────
   PAGE SIZE SELECTOR
───────────────────────────────────────────── */

const PAGE_SIZES = [10, 25, 50, 100] as const

interface PageSizeSelectorProps {
  value: number
  onChange: (n: number) => void
  sizes?: number[]
}

function PageSizeSelector({ value, onChange, sizes = PAGE_SIZES as unknown as number[] }: PageSizeSelectorProps) {
  return (
    <div className="flex items-center gap-1.5">
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Rows per page"
        className={cn(
          'h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground',
          'focus:outline-none focus:ring-2 focus:ring-ring/50',
        )}
      >
        {sizes.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground select-none">per page</span>
    </div>
  )
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
  onPageSizeChange: (n: number) => void
  pageSizeOptions?: number[]
}

function Pagination({
  page,
  totalPages,
  onPage,
  totalRows,
  filteredRows,
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
}: PaginationProps) {
  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, filteredRows)

  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    const lo = Math.max(2, page - 1)
    const hi = Math.min(totalPages - 1, page + 1)
    for (let i = lo; i <= hi; i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }

  return (
    <div
      role="navigation"
      aria-label="Table pagination"
      className="flex flex-col gap-3 px-4 py-3 border-t border-border bg-card sm:flex-row sm:items-center sm:justify-between"
    >
      {/* Results count + page size */}
      <div className="flex items-center gap-4 flex-wrap">
        <p className="text-xs text-muted-foreground select-none">
          {filteredRows === 0 ? (
            'No results'
          ) : (
            <>
              Showing{' '}
              <span className="font-medium text-foreground">{start}–{end}</span>
              {' '}of{' '}
              <span className="font-medium text-foreground">{filteredRows}</span>
              {filteredRows !== totalRows && (
                <span className="text-muted-foreground/70"> (filtered from {totalRows})</span>
              )}
            </>
          )}
        </p>
        <PageSizeSelector value={pageSize} onChange={onPageSizeChange} sizes={pageSizeOptions} />
      </div>

      {/* Page buttons + prev/next */}
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
              <span key={`ell-${i}`} className="px-1 text-muted-foreground text-xs select-none">…</span>
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
                    ? 'bg-foreground text-background shadow-sm'
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
  data,
  columns,
  title,
  icon,
  searchFields = [],
  rowKey,
  onRowClick,
  actions,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  sortable: globalSortable,
  filterable: globalFilterable,
  searchable = true,
  selectable = false,
  onSelectionChange,
  onExportSelected,
  onDeleteSelected,
  loading = false,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  // legacy compat
  titleIcon,
  searchPlaceholder = 'Search…',
  selectedKey,
  error = null,
  emptyMessage,
  className,
}: DataRegisterProps<T>) {
  const [query,       setQuery]       = React.useState('')
  const debouncedQuery                = useDebounce(query, 220)
  const [sortSpecs,   setSortSpecs]   = React.useState<SortSpec[]>([])
  const [page,        setPage]        = React.useState(1)
  const [pageSize,    setPageSize]    = React.useState(initialPageSize)
  const [colFilters,  setColFilters]  = React.useState<Record<string, string>>({})
  const [selected,    setSelected]    = React.useState<Set<string>>(new Set())
  const searchRef = React.useRef<HTMLInputElement>(null)

  // Column resize — seed initial widths from column.width strings
  const initialColWidths = React.useMemo(() => {
    const map: Record<string, number> = {}
    columns.forEach((c) => {
      if (c.width) {
        const parsed = parseInt(c.width, 10)
        if (!isNaN(parsed)) map[c.key] = parsed
      }
    })
    return map
  }, [columns])
  const { widths: colWidths, onMouseDown: onResizeMouseDown } = useColumnResize(initialColWidths)

  // Resolve icon (new prop takes precedence over legacy titleIcon)
  const resolvedIcon = icon ?? titleIcon

  // Resolve empty state props
  const resolvedEmptySubtitle = emptySubtitle ?? emptyMessage ?? 'No records found.'
  const resolvedEmptyTitle    = emptyTitle ?? 'No results'

  // Apply global sortable/filterable to columns if not set per-column
  const resolvedColumns = React.useMemo(() => columns.map((col) => ({
    ...col,
    sortable:   col.sortable   ?? (globalSortable   === true),
    filterable: col.filterable ?? (globalFilterable === true),
  })), [columns, globalSortable, globalFilterable])

  // Read the row-key value in a type-safe way (rowKey is `keyof T`)
  const keyOf = React.useCallback((row: T) => String(row[rowKey]), [rowKey])

  // Selection helpers
  const handleSelectAll = React.useCallback((checked: boolean) => {
    const next = checked ? new Set(data.map(keyOf)) : new Set<string>()
    setSelected(next)
    onSelectionChange?.(checked ? [...data] : [])
  }, [data, keyOf, onSelectionChange])

  const handleSelectRow = React.useCallback((row: T, checked: boolean) => {
    const key = keyOf(row)
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      // Derive the callback payload from the freshly-computed set,
      // never the stale `selected` snapshot.
      onSelectionChange?.(data.filter((r) => next.has(keyOf(r))))
      return next
    })
  }, [data, keyOf, onSelectionChange])

  // Reset page on filter change
  React.useEffect(() => { setPage(1) }, [debouncedQuery, colFilters])

  /* ── Derived rows ── */
  const filtered = React.useMemo(
    () => filterRows(data, debouncedQuery, searchFields as (keyof T)[], colFilters, resolvedColumns),
    [data, debouncedQuery, searchFields, colFilters, resolvedColumns],
  )
  const sorted = React.useMemo(
    () => sortRows(filtered, sortSpecs),
    [filtered, sortSpecs],
  )
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

  const hasColFilters = resolvedColumns.some((c) => c.filterable)
  const activeColFilters = Object.values(colFilters).filter(Boolean).length

  const allSelected = data.length > 0 && data.every((r) => selected.has(keyOf(r)))
  const someSelected = !allSelected && data.some((r) => selected.has(keyOf(r)))

  /* ── Multi-sort toggle (Shift+click adds secondary sorts) ── */
  const handleSort = React.useCallback((key: string, shiftKey = false) => {
    setSortSpecs((prev) => {
      const existing = prev.find((s) => s.key === key)
      if (shiftKey) {
        // Shift+click: add/cycle/remove as secondary sort
        if (!existing) return [...prev, { key, dir: 'asc' }]
        if (existing.dir === 'asc') return prev.map((s) => s.key === key ? { ...s, dir: 'desc' } : s)
        return prev.filter((s) => s.key !== key)
      }
      // Normal click: single sort cycle
      if (!existing) return [{ key, dir: 'asc' }]
      if (existing.dir === 'asc') return [{ key, dir: 'desc' }]
      return []
    })
    setPage(1)
  }, [])

  // Compat helpers for legacy sortKey/sortDir references in the render
  const sortKey = sortSpecs[0]?.key ?? null
  const sortDir: SortDir = sortSpecs[0]?.dir ?? null

  /* ── Column filter ── */
  const setColFilter = React.useCallback((key: string, val: string) => {
    setColFilters((prev) => ({ ...prev, [key]: val }))
  }, [])

  const clearAllFilters = React.useCallback(() => {
    setQuery('')
    setColFilters({})
    searchRef.current?.focus()
  }, [])

  /* ── Keyboard row handler ── */
  const handleRowKeyDown = React.useCallback((e: React.KeyboardEvent, row: T) => {
    if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
      e.preventDefault()
      onRowClick(row)
    }
  }, [onRowClick])

  const isClickable = Boolean(onRowClick)

  return (
    <section
      aria-label={title}
      className={cn('rounded-xl border border-border bg-card overflow-hidden shadow-sm', className)}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      {(title || resolvedIcon || searchable || actions) && (
      <div className="flex flex-col gap-3 px-4 pt-4 pb-3 border-b border-border sm:flex-row sm:items-center sm:justify-between">
        {/* Title */}
        {(title || resolvedIcon) && (
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground font-sans shrink-0">
            {resolvedIcon && (
              <span className="text-muted-foreground" aria-hidden="true">{resolvedIcon}</span>
            )}
            {title}
          </h2>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {/* Global search */}
          {searchable && searchFields.length > 0 && (
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`Search ${title}`}
                className={cn(
                  'h-8 w-52 rounded-md border border-border bg-background pl-8 pr-7',
                  'text-sm text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring',
                  'transition-colors',
                )}
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => { setQuery(''); searchRef.current?.focus() }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          )}

          {/* Actions — ReactNode (caller owns all buttons) */}
          {actions}
        </div>
      </div>
      )}

      {/* ── Bulk action bar ─────────────────────────────────── */}
      {selectable && selected.size > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/8 border-b border-primary/20"
        >
          <span className="text-xs font-medium text-primary">
            {selected.size} row{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => { setSelected(new Set()); onSelectionChange?.([]) }}
            >
              Clear selection
            </Button>
            {onExportSelected && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onExportSelected(data.filter((r) => selected.has(keyOf(r))))}
              >
                <Download className="size-3 mr-1" aria-hidden="true" />
                Export selected
              </Button>
            )}
            {onDeleteSelected && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() => onDeleteSelected(data.filter((r) => selected.has(keyOf(r))))}
              >
                Delete selected
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Error state ─────────────────────────────────────── */}
      {error && !loading && (
        <div
          role="alert"
          className="flex items-start gap-3 px-4 py-6 text-sm text-destructive bg-destructive/5"
        >
          <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Mobile card view (< sm) ─────────────────────────── */}
      {!error && !loading && pageRows.length > 0 && (
        <ul className="sm:hidden divide-y divide-border" aria-label={`${title} cards`}>
          {pageRows.map((row) => {
            const key = keyOf(row)
            return (
              <li
                key={key}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={isClickable ? () => onRowClick!(row) : undefined}
                onKeyDown={isClickable ? (e) => handleRowKeyDown(e, row) : undefined}
                className={cn(
                  'px-4 py-3 flex flex-col gap-1.5',
                  isClickable && 'cursor-pointer hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent/60',
                )}
              >
                {resolvedColumns
                  .filter((c) => c.type !== 'action' && c.header)
                  .map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-2 text-sm">
                      <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0 w-28">{col.header}</span>
                      <span className={cn('flex-1 text-right', col.align === 'right' && 'tabular-nums')}>
                        {col.render ? col.render(row) : renderCell(col, row)}
                      </span>
                    </div>
                  ))}
              </li>
            )
          })}
        </ul>
      )}

      {/* ── Table (sm+) ─────────────────────────────────────── */}
      {!error && (
        <div className="hidden sm:block overflow-x-auto">
          <table
            role="grid"
            aria-label={title}
            aria-rowcount={loading ? undefined : sorted.length}
            aria-busy={loading}
            className="w-full min-w-max border-collapse text-sm"
          >
            {/* ── Head ── */}
            <thead>
              {/* Column headers */}
              <tr className="border-b border-border bg-muted/40 dark:bg-muted/20">
                {/* Select-all checkbox */}
                {selectable && (
                  <th scope="col" className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      aria-label="Select all rows"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected }}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="size-3.5 accent-primary cursor-pointer"
                    />
                  </th>
                )}
                {resolvedColumns.map((col) => {
                  const spec    = sortSpecs.find((s) => s.key === col.key)
                  const dir: SortDir = spec?.dir ?? null
                  const sortIdx = sortSpecs.findIndex((s) => s.key === col.key)
                  const colW    = colWidths[col.key]
                  return (
                    <th
                      key={col.key}
                      scope="col"
                      style={colW ? { width: colW } : col.width ? { width: col.width } : undefined}
                      className={cn(
                        'relative px-4 py-2.5 font-medium text-xs uppercase tracking-wider text-muted-foreground select-none',
                        alignClass[col.align ?? 'left'],
                        col.sortable && 'cursor-pointer hover:text-foreground transition-colors hover:bg-muted/60',
                      )}
                      aria-sort={
                        col.sortable
                          ? dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'
                          : undefined
                      }
                      onClick={col.sortable ? (e) => handleSort(col.key, e.shiftKey) : undefined}
                      onKeyDown={
                        col.sortable
                          ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col.key, e.shiftKey) } }
                          : undefined
                      }
                      tabIndex={col.sortable ? 0 : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {col.sortable && <SortIcon dir={dir} />}
                        {/* Multi-sort index badge */}
                        {col.sortable && sortIdx >= 0 && sortSpecs.length > 1 && (
                          <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-primary/20 text-primary text-[9px] font-bold leading-none">
                            {sortIdx + 1}
                          </span>
                        )}
                      </span>
                      {/* Column resize handle */}
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${col.header} column`}
                        onMouseDown={(e) => onResizeMouseDown(col.key, e)}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize opacity-0 hover:opacity-100 hover:bg-primary/40 transition-opacity"
                      />
                    </th>
                  )
                })}
              </tr>

              {/* Column filter row */}
              {hasColFilters && (
                <tr className="border-b border-border bg-muted/20">
                  {selectable && <td className="w-10 px-3 py-1.5" />}
                  {resolvedColumns.map((col) => (
                    <td key={col.key} className="px-2 py-1.5">
                      {col.filterable ? (
                        col.filterType === 'select' && col.filterOptions ? (
                          <select
                            value={colFilters[col.key] ?? ''}
                            onChange={(e) => setColFilter(col.key, e.target.value)}
                            aria-label={`Filter ${col.header}`}
                            className={cn(
                              'h-6 w-full rounded border border-border bg-background px-1.5',
                              'text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50',
                            )}
                          >
                            <option value="">All</option>
                            {col.filterOptions.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={col.filterType === 'number' ? 'number' : col.filterType === 'date' ? 'date' : 'text'}
                            value={colFilters[col.key] ?? ''}
                            onChange={(e) => setColFilter(col.key, e.target.value)}
                            placeholder={`Filter…`}
                            aria-label={`Filter ${col.header}`}
                            className={cn(
                              'h-6 w-full rounded border border-border bg-background px-1.5',
                              'text-[11px] text-foreground placeholder:text-muted-foreground/60',
                              'focus:outline-none focus:ring-1 focus:ring-ring/50',
                            )}
                          />
                        )
                      ) : null}
                    </td>
                  ))}
                </tr>
              )}

              {/* Active filters indicator row */}
              {(query || activeColFilters > 0) && (
                <tr>
                  <td colSpan={resolvedColumns.length + (selectable ? 1 : 0)} className="px-4 py-1.5 bg-primary/5 border-b border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-primary font-medium">
                        {sorted.length} result{sorted.length !== 1 ? 's' : ''} — filters active
                      </span>
                      <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-[11px] text-primary underline-offset-2 hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </thead>

            {/* ── Body ── */}
            <tbody>
              {loading ? (
                <TableSkeleton cols={resolvedColumns.length + (selectable ? 1 : 0)} rows={5} />
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={resolvedColumns.length + (selectable ? 1 : 0)} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      {emptyIcon ?? <Inbox className="size-10 opacity-30" aria-hidden="true" />}
                      <p className="text-sm font-medium text-foreground/70">{resolvedEmptyTitle}</p>
                      <p className="text-xs">{resolvedEmptySubtitle}</p>
                      {(query || activeColFilters > 0) && (
                        <button
                          type="button"
                          className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
                          onClick={clearAllFilters}
                        >
                          Clear filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((row, ri) => {
                  const key = keyOf(row)
                  const isEven     = ri % 2 === 1
                  const isChecked  = selected.has(key)
                  // Honour both legacy selectedKey (single-select) and new multi-select
                  const isSelected = isChecked || (selectedKey !== undefined && selectedKey === key)
                  return (
                    <tr
                      key={key}
                      role={isClickable ? 'button' : 'row'}
                      tabIndex={isClickable ? 0 : undefined}
                      aria-label={isClickable ? `Open ${key}` : undefined}
                      aria-selected={isSelected || undefined}
                      onClick={isClickable ? () => onRowClick!(row) : undefined}
                      onKeyDown={isClickable ? (e) => handleRowKeyDown(e, row) : undefined}
                      className={cn(
                        'border-b border-border/60 transition-colors duration-100',
                        isEven && !isSelected && 'bg-muted/20 dark:bg-white/[0.02]',
                        isSelected && 'bg-primary/8 ring-1 ring-inset ring-primary/30',
                        isClickable && [
                          'cursor-pointer',
                          !isSelected && 'hover:bg-accent/60 dark:hover:bg-accent/40',
                          'focus-visible:outline-none focus-visible:bg-accent/60',
                        ],
                      )}
                    >
                      {/* Per-row selection checkbox */}
                      {selectable && (
                        <td className="w-10 px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select row ${key}`}
                            checked={isChecked}
                            onChange={(e) => handleSelectRow(row, e.target.checked)}
                            className="size-3.5 accent-primary cursor-pointer"
                          />
                        </td>
                      )}
                      {resolvedColumns.map((col, ci) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-4 py-3 text-sm text-foreground',
                            alignClass[col.align ?? 'left'],
                            ci === 0 && 'font-medium',
                          )}
                        >
                          {col.render ? col.render(row) : renderCell(col, row)}
                        </td>
                      ))}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────── */}
      {!loading && !error && (
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPage={setPage}
          totalRows={data.length}
          filteredRows={sorted.length}
          pageSize={pageSize}
          onPageSizeChange={(n) => { setPageSize(n); setPage(1) }}
          pageSizeOptions={pageSizeOptions}
        />
      )}
    </section>
  )
}
