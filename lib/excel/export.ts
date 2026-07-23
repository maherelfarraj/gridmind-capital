'use client'

import XLSX from 'xlsx-js-style'

// ─────────────────────────────────────────────────────────────
// Column model
// ─────────────────────────────────────────────────────────────

export type ColType = 'text' | 'number' | 'currency' | 'date'

export interface ExcelColumn<T> {
  header: string
  /** Field key on the row, or a selector function. */
  key: keyof T | ((row: T) => unknown)
  type?: ColType
  /** Column width in characters. Defaults to header length + padding. */
  width?: number
}

export interface ExcelSheet<T> {
  name: string
  columns: ExcelColumn<T>[]
  rows: T[]
  /** Optional footer row (already-computed cells keyed by column index). */
  footer?: (string | number | null)[]
}

// Slate-900 header with white bold text — matches the app's dark chrome.
const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  fill: { patternType: 'solid', fgColor: { rgb: '0F172A' } },
  alignment: { horizontal: 'left' as const, vertical: 'center' as const },
  border: { bottom: { style: 'thin' as const, color: { rgb: 'CBD5E1' } } },
}

const FOOTER_STYLE = {
  font: { bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
  border: { top: { style: 'thin' as const, color: { rgb: '94A3B8' } } },
}

const CURRENCY_FMT = '$#,##0'
const DATE_FMT = 'yyyy-mm-dd'

// ─────────────────────────────────────────────────────────────
// Value coercion
// ─────────────────────────────────────────────────────────────

function selectValue<T>(col: ExcelColumn<T>, row: T): unknown {
  return typeof col.key === 'function' ? col.key(row) : (row as Record<string, unknown>)[col.key as string]
}

/** Convert a raw value to the primitive the worksheet cell should hold. */
function coerce(value: unknown, type: ColType | undefined): string | number | Date | null {
  if (value == null || value === '') return null
  switch (type) {
    case 'number':
    case 'currency': {
      const n = typeof value === 'number' ? value : Number(String(value).replace(/[^0-9.-]/g, ''))
      return Number.isFinite(n) ? n : null
    }
    case 'date': {
      const d = value instanceof Date ? value : new Date(String(value))
      return Number.isNaN(d.getTime()) ? String(value) : d
    }
    default:
      return String(value)
  }
}

// ─────────────────────────────────────────────────────────────
// Sheet builder
// ─────────────────────────────────────────────────────────────

function buildWorksheet<T>(sheet: ExcelSheet<T>): XLSX.WorkSheet {
  const { columns, rows, footer } = sheet
  const aoa: (string | number | Date | null)[][] = [
    columns.map((c) => c.header),
    ...rows.map((row) => columns.map((c) => coerce(selectValue(c, row), c.type))),
  ]
  if (footer) aoa.push(columns.map((_, i) => footer[i] ?? null))

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true })
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')

  // Column widths
  ws['!cols'] = columns.map((c) => ({
    wch: c.width ?? Math.max(12, c.header.length + 2),
  }))

  const lastRow = range.e.r
  const footerRowIdx = footer ? lastRow : -1

  for (let C = range.s.c; C <= range.e.c; C++) {
    const col = columns[C]
    for (let R = range.s.r; R <= lastRow; R++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C })
      const cell = ws[addr] as XLSX.CellObject | undefined
      if (!cell) continue

      if (R === 0) {
        // Header row
        ;(cell as { s?: unknown }).s = HEADER_STYLE
        continue
      }

      const isFooter = R === footerRowIdx
      if (isFooter) (cell as { s?: unknown }).s = FOOTER_STYLE

      // Apply number/date formats to data + footer cells
      if (cell.v != null && cell.v !== '') {
        if (col?.type === 'currency') cell.z = CURRENCY_FMT
        else if (col?.type === 'date') cell.z = DATE_FMT
      }
    }
  }

  return ws
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/** Build the standard file name: {CODE}_{register}_{YYYY-MM-DD}.xlsx */
export function excelFileName(code: string, register: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const safeCode = (code || 'EXPORT').replace(/[^a-zA-Z0-9-]/g, '-')
  const safeReg = register.replace(/[^a-zA-Z0-9-]/g, '-')
  return `${safeCode}_${safeReg}_${date}.xlsx`
}

/**
 * Build and trigger a client-side download of an .xlsx workbook.
 * One sheet per ExcelSheet. Header row is bold with a fill; currency/number
 * columns are real numbers; date columns are real dates.
 */
export function exportToExcel<T>(opts: {
  code: string
  register: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sheets: ExcelSheet<any>[]
}): void {
  const wb = XLSX.utils.book_new()
  for (const sheet of opts.sheets) {
    const ws = buildWorksheet(sheet)
    // Sheet names max 31 chars, no special chars
    const safeName = sheet.name.replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Sheet1'
    XLSX.utils.book_append_sheet(wb, ws, safeName)
  }
  XLSX.writeFile(wb, excelFileName(opts.code, opts.register))
}
