'use client'

import * as React from 'react'
import { FileUp, Loader2, FileText, FileCode2, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { importActivities, type ImportRow } from '@/app/actions/schedule'

type Format = 'csv' | 'xml'
type Mode = 'append' | 'replace'

interface ImportScheduleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onImported?: () => void
}

const CSV_TEMPLATE =
  'code,name,phase,gate,start,finish,duration,percent,weight,milestone,predecessor\n' +
  'A100,Site survey,Development,1,2026-01-05,2026-01-19,14,100,2,,\n' +
  'A110,Geotechnical study,Development,1,2026-01-20,2026-02-10,21,60,3,,A100\n' +
  'A200,IFC drawings,Engineering,2,2026-02-11,2026-03-24,42,0,5,,A110\n' +
  'M300,Financial close,Development,1,2026-03-25,2026-03-25,0,0,1,yes,A200'

// ─── Date helpers ───────────────────────────────────────────────────────────

/** Normalize any recognizable date string to YYYY-MM-DD, else null. */
function normDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  // Already ISO-ish (2026-01-05 or 2026-01-05T08:00:00)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  // US style M/D/YYYY
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (us) {
    const mm = us[1].padStart(2, '0')
    const dd = us[2].padStart(2, '0')
    return `${us[3]}-${mm}-${dd}`
  }
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

function truthy(v: string | null | undefined): boolean {
  if (!v) return false
  const s = v.trim().toLowerCase()
  return s === '1' || s === 'yes' || s === 'true' || s === 'y'
}

function dayDiff(a: string | null, b: string | null): number | null {
  if (!a || !b) return null
  const from = new Date(a + 'T00:00:00Z').getTime()
  const to = new Date(b + 'T00:00:00Z').getTime()
  return Math.max(0, Math.round((to - from) / 86_400_000))
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

/** Minimal CSV line splitter that honours double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      out.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

const HEADER_ALIASES: Record<string, string[]> = {
  activity_code: ['code', 'id', 'activity', 'activity_code', 'wbs'],
  name:          ['name', 'task', 'title', 'activity name', 'description'],
  phase:         ['phase', 'stage'],
  discipline:    ['discipline', 'trade'],
  gate_number:   ['gate', 'gate_number', 'gate no'],
  duration_days: ['duration', 'days', 'duration_days'],
  planned_start: ['start', 'planned_start', 'start date', 'begin'],
  planned_finish:['finish', 'end', 'planned_finish', 'finish date', 'end date'],
  percent_complete: ['percent', 'progress', 'complete', '% complete', 'pct'],
  weight:        ['weight', 'wt'],
  is_milestone:  ['milestone', 'is_milestone'],
  predecessor_code: ['predecessor', 'pred', 'depends on', 'predecessor_code'],
}

function resolveHeaderMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  headers.forEach((h, idx) => {
    const key = h.trim().toLowerCase()
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(key) && !(field in map)) map[field] = idx
    }
  })
  return map
}

function parseCsv(text: string): { rows: ImportRow[]; error?: string } {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return { rows: [], error: 'CSV needs a header row and at least one data row.' }

  const headers = splitCsvLine(lines[0])
  const hm = resolveHeaderMap(headers)
  if (hm.name === undefined) return { rows: [], error: 'CSV must include a "name" column.' }

  const rows: ImportRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i])
    const get = (field: string): string | null =>
      hm[field] !== undefined ? (cols[hm[field]] ?? null) : null

    const name = get('name')
    if (!name) continue

    const start  = normDate(get('planned_start'))
    const finish = normDate(get('planned_finish'))
    const durRaw = get('duration_days')
    const gateRaw = get('gate_number')
    const pctRaw = get('percent_complete')
    const wtRaw  = get('weight')

    rows.push({
      activity_code:    get('activity_code'),
      name,
      phase:            get('phase'),
      discipline:       get('discipline'),
      gate_number:      gateRaw != null && gateRaw !== '' ? Number(String(gateRaw).replace(/\D/g, '')) || null : null,
      duration_days:    durRaw ? Number(durRaw) || null : dayDiff(start, finish),
      planned_start:    start,
      planned_finish:   finish,
      percent_complete: pctRaw ? Number(pctRaw) || 0 : 0,
      weight:           wtRaw ? Number(wtRaw) || 1 : 1,
      is_milestone:     truthy(get('is_milestone')) || durRaw === '0',
      predecessor_code: get('predecessor_code'),
    })
  }

  if (!rows.length) return { rows: [], error: 'No data rows found.' }
  return { rows }
}

// ─── XML parsing (MS Project + Primavera P6) ────────────────────────────────────

function text(el: Element | null, tag: string): string | null {
  if (!el) return null
  const node = el.getElementsByTagName(tag)[0]
  return node?.textContent?.trim() || null
}

function parseXml(raw: string): { rows: ImportRow[]; error?: string } {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(raw, 'application/xml')
  } catch {
    return { rows: [], error: 'Could not parse XML.' }
  }
  if (doc.getElementsByTagName('parsererror').length) {
    return { rows: [], error: 'Invalid XML document.' }
  }

  // MS Project: <Task>; Primavera P6: <Activity>
  const taskNodes = Array.from(doc.getElementsByTagName('Task'))
  const activityNodes = Array.from(doc.getElementsByTagName('Activity'))
  const nodes = taskNodes.length ? taskNodes : activityNodes
  if (!nodes.length) return { rows: [], error: 'No <Task> (MS Project) or <Activity> (P6) elements found.' }

  const isMsp = taskNodes.length > 0
  const rows: ImportRow[] = []

  for (const el of nodes) {
    const name = text(el, 'Name')
    if (!name) continue
    // MS Project summary rows (Summary=1) are containers — skip so we import leaves only.
    if (isMsp && text(el, 'Summary') === '1') continue

    const start = normDate(
      isMsp ? text(el, 'Start')
            : text(el, 'PlannedStartDate') ?? text(el, 'StartDate') ?? text(el, 'ActualStartDate'),
    )
    const finish = normDate(
      isMsp ? text(el, 'Finish')
            : text(el, 'PlannedFinishDate') ?? text(el, 'FinishDate') ?? text(el, 'ActualFinishDate'),
    )
    const pctRaw = text(el, 'PercentComplete') ?? text(el, 'PhysPercentComplete')
    const milestone = isMsp
      ? text(el, 'Milestone') === '1'
      : (text(el, 'Milestone') === 'true' || dayDiff(start, finish) === 0)
    const code = isMsp
      ? (text(el, 'WBS') ?? text(el, 'OutlineNumber') ?? text(el, 'UID'))
      : (text(el, 'Id') ?? text(el, 'ActivityId'))

    rows.push({
      activity_code:    code,
      name,
      phase:            null,
      discipline:       null,
      gate_number:      null,
      duration_days:    dayDiff(start, finish),
      planned_start:    start,
      planned_finish:   finish,
      percent_complete: pctRaw ? Number(pctRaw) || 0 : 0,
      weight:           1,
      is_milestone:     milestone,
      predecessor_code: null,
    })
  }

  if (!rows.length) return { rows: [], error: 'No importable activities found in the XML.' }
  return { rows }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportScheduleDialog({ open, onOpenChange, projectId, onImported }: ImportScheduleDialogProps) {
  const { toast } = useToast()
  const [format, setFormat] = React.useState<Format>('csv')
  const [mode, setMode] = React.useState<Mode>('append')
  const [content, setContent] = React.useState('')
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)

  // Live parse preview
  const parsed = React.useMemo(() => {
    if (!content.trim()) return { rows: [] as ImportRow[] }
    return format === 'csv' ? parseCsv(content) : parseXml(content)
  }, [content, format])

  function reset() {
    setContent('')
    setFileName(null)
    setMode('append')
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    if (/\.xml$/i.test(file.name)) setFormat('xml')
    else if (/\.csv$/i.test(file.name)) setFormat('csv')
    const reader = new FileReader()
    reader.onload = () => setContent(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  async function handleImport() {
    if (parsed.error) { toast({ title: 'Cannot import', description: parsed.error, variant: 'danger' }); return }
    if (!parsed.rows.length) { toast({ title: 'Nothing to import', description: 'Paste or upload data first.', variant: 'warning' }); return }

    setBusy(true)
    const res = await importActivities(projectId, parsed.rows, mode)
    setBusy(false)
    if (res.error) { toast({ title: 'Import failed', description: res.error, variant: 'danger' }); return }
    toast({ title: `Imported ${res.imported} activities`, variant: 'success' })
    reset()
    onOpenChange(false)
    onImported?.()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import schedule</DialogTitle>
          <DialogDescription>
            Import activities from a CSV file or an MS Project / Primavera P6 XML export.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format toggle */}
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(['csv', 'xml'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  format === f ? 'bg-[#0a192f] text-white dark:bg-slate-700' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f === 'csv' ? <FileText className="size-3.5" /> : <FileCode2 className="size-3.5" />}
                {f === 'csv' ? 'CSV' : 'MS Project / P6 XML'}
              </button>
            ))}
          </div>

          {/* File input + template */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted">
              <FileUp className="size-3.5" />
              {fileName ?? `Choose ${format === 'csv' ? '.csv' : '.xml'} file`}
              <input
                type="file"
                accept={format === 'csv' ? '.csv,text/csv' : '.xml,application/xml,text/xml'}
                className="hidden"
                onChange={handleFile}
              />
            </label>
            {format === 'csv' && (
              <Button type="button" variant="ghost" size="sm" onClick={() => { setContent(CSV_TEMPLATE); setFileName(null) }}>
                Load sample CSV
              </Button>
            )}
          </div>

          {/* Paste area */}
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            placeholder={format === 'csv'
              ? 'Paste CSV here (first row = headers: code,name,phase,gate,start,finish,duration,percent,weight,milestone,predecessor)'
              : 'Paste MS Project or Primavera P6 XML here…'}
            className="font-mono text-xs"
          />

          {/* Parse status */}
          {content.trim() && (
            parsed.error ? (
              <div className="flex items-center gap-2 rounded-lg border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2 text-xs text-[#b45309] dark:text-[#f59e0b]">
                <AlertTriangle className="size-3.5 shrink-0" />
                {parsed.error}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2 text-xs text-[#15803d] dark:text-[#22c55e]">
                <CheckCircle2 className="size-3.5 shrink-0" />
                {parsed.rows.length} activities ready to import
                {parsed.rows.filter(r => r.predecessor_code).length > 0 &&
                  ` · ${parsed.rows.filter(r => r.predecessor_code).length} dependencies`}
              </div>
            )
          )}

          {/* Mode */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">When importing</span>
            <div className="flex gap-4">
              {(['append', 'replace'] as const).map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="accent-[#0a192f] dark:accent-[#64ffda]"
                  />
                  {m === 'append' ? 'Add to existing activities' : 'Replace all existing activities'}
                </label>
              ))}
            </div>
            {mode === 'replace' && (
              <p className="text-[11px] text-[#b45309] dark:text-[#f59e0b]">
                Replace deletes all current activities, dependencies, and progress for this project first.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={busy || !parsed.rows.length || !!parsed.error}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            Import{parsed.rows.length ? ` ${parsed.rows.length}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
