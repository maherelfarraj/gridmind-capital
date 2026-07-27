'use client'

import * as React from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { exportToExcel, type ExcelSheet } from '@/lib/excel/export'
import { logExport } from '@/app/actions/exports'

type ButtonSize = React.ComponentProps<typeof Button>['size']
type ButtonVariant = React.ComponentProps<typeof Button>['variant']

export function ExcelExportButton(props: {
  /** Null/undefined for portfolio-wide exports. */
  projectId?: string | null
  /** Machine key + file-name segment, e.g. "variation-orders". */
  register: string
  /** Active filter snapshot logged to workflow_events. */
  filters?: Record<string, unknown>
  /** Row count used for logging + empty-state guard. */
  rowCount: number
  /** Builds the sheet(s) at click time so the latest filtered data is used. */
  buildSheets: () => ExcelSheet<any>[]
  disabled?: boolean
  size?: ButtonSize
  variant?: ButtonVariant
  label?: string
}) {
  const {
    projectId, register, filters, rowCount, buildSheets,
    disabled, size = 'sm', variant = 'outline', label = 'Export Excel',
  } = props
  const { toast } = useToast()
  const [busy, setBusy] = React.useState(false)

  async function handleExport() {
    if (rowCount === 0) {
      toast({ title: 'Nothing to export', description: 'No rows match the current filters.', variant: 'warning' })
      return
    }
    setBusy(true)
    try {
      const sheets = buildSheets()
      const { code } = await logExport({ projectId, register, filters, rowCount })
      await exportToExcel({ code, register, sheets })
      toast({ title: 'Exported to Excel', description: `${rowCount} row${rowCount === 1 ? '' : 's'} downloaded.`, variant: 'success' })
    } catch (e) {
      toast({ title: 'Export failed', description: e instanceof Error ? e.message : 'Unexpected error.', variant: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size={size} variant={variant} onClick={handleExport} disabled={disabled || busy}>
      {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <FileSpreadsheet className="size-3.5 mr-1.5" />}
      {busy ? 'Exporting…' : label}
    </Button>
  )
}
