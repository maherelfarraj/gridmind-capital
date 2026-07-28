'use client'

import * as React from 'react'
import { ChevronDown, Download, ExternalLink } from 'lucide-react'
import type { CatalogColumn, CatalogRow } from '@/lib/copilot/query-catalog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface TableCardProps {
  title: string
  summary: string
  columns: CatalogColumn[]
  rows: CatalogRow[]
  rowLink?: (row: CatalogRow) => string | null
  onExportCSV?: () => void
}

export function TableCard({ title, summary, columns, rows, rowLink, onExportCSV }: TableCardProps) {
  const [sortBy, setSortBy] = React.useState<string | null>(null)
  const [sortDesc, setSortDesc] = React.useState(false)

  const sortedRows = React.useMemo(() => {
    if (!sortBy) return rows
    
    const col = columns.find((c) => c.key === sortBy || (typeof c.key === 'string' && c.key === sortBy))
    if (!col) return rows

    return [...rows].sort((a, b) => {
      const aVal = typeof col.key === 'function' ? col.key(a) : a[col.key as string]
      const bVal = typeof col.key === 'function' ? col.key(b) : b[col.key as string]

      let cmp = 0
      if (aVal == null && bVal == null) cmp = 0
      else if (aVal == null) cmp = 1
      else if (bVal == null) cmp = -1
      else if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal
      else cmp = String(aVal).localeCompare(String(bVal))

      return sortDesc ? -cmp : cmp
    })
  }, [rows, sortBy, sortDesc, columns])

  const handleColumnClick = (key: string | ((row: CatalogRow) => unknown)) => {
    const keyStr = typeof key === 'function' ? JSON.stringify(key) : String(key)
    if (sortBy === keyStr) {
      setSortDesc(!sortDesc)
    } else {
      setSortBy(keyStr)
      setSortDesc(false)
    }
  }

  const getCellValue = (row: CatalogRow, col: CatalogColumn): string => {
    const val = typeof col.key === 'function' ? col.key(row) : row[col.key as string]
    if (val == null) return '—'
    
    if (col.type === 'currency') {
      const num = typeof val === 'number' ? val : Number(String(val).replace(/[^0-9.-]/g, ''))
      return Number.isFinite(num) ? `$${num.toLocaleString()}` : String(val)
    }
    if (col.type === 'date') {
      return new Date(String(val)).toLocaleDateString()
    }
    return String(val)
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>
        {onExportCSV && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onExportCSV}
            className="h-8 w-8 p-0"
            title="Export as CSV"
          >
            <Download size={16} />
          </Button>
        )}
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          No results found.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className={cn(
                      'py-2 px-2 text-left font-semibold text-muted-foreground',
                      col.align === 'center' && 'text-center',
                      col.align === 'right' && 'text-right',
                      col.sortable && 'cursor-pointer hover:text-foreground',
                    )}
                    onClick={() => col.sortable && handleColumnClick(String(col.key))}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && sortBy === String(col.key) && (
                        <ChevronDown
                          size={12}
                          className={cn('transition-transform', sortDesc && 'rotate-180')}
                        />
                      )}
                    </div>
                  </th>
                ))}
                {rowLink && <th className="w-6" />}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={cn(
                        'py-2 px-2 text-foreground',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right',
                      )}
                    >
                      {getCellValue(row, col)}
                    </td>
                  ))}
                  {rowLink && (
                    <td className="py-2 px-2 text-center">
                      <a
                        href={rowLink(row) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                        title="Open details"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer - Row count */}
      <div className="text-xs text-muted-foreground text-right">
        {rows.length} row{rows.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
