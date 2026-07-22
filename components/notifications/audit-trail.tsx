'use client'

import { useState, useMemo } from 'react'
import { Shield, Search, Download, User, Clock, Tag } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { mockStore, type AuditEntry } from '@/lib/mock-store'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const RESULT_STYLE: Record<string, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  failure: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

// Group action strings into readable categories for display
function actionCategory(action: string): string {
  if (action.startsWith('PROJECT')) return 'project'
  if (action.startsWith('RISK')) return 'risk'
  if (action.startsWith('WORKFLOW') || action.startsWith('APPROVAL')) return 'workflow'
  if (action.startsWith('ENGINEERING') || action.startsWith('RFI') || action.startsWith('IFC')) return 'engineering'
  if (action.startsWith('VENDOR') || action.startsWith('PO') || action.startsWith('RFQ')) return 'procurement'
  if (action === 'EXPORT') return 'export'
  if (action === 'LOGIN') return 'auth'
  return 'other'
}

const CATEGORY_BADGE: Record<string, string> = {
  project:     'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  risk:        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  workflow:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  engineering: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  procurement: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  export:      'bg-muted text-muted-foreground',
  auth:        'bg-slate-100 text-slate-600',
  other:       'bg-muted text-muted-foreground',
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const category = actionCategory(entry.action)
  const detailKeys = Object.keys(entry.details ?? {})

  return (
    <div className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3 p-3">
        {/* Category badge */}
        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 uppercase tracking-wide mt-0.5', CATEGORY_BADGE[category])}>
          {category}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground">{entry.action.replace(/_/g, ' ')}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5">{entry.entityType}</Badge>
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto', RESULT_STYLE[entry.result])}>
              {entry.result}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <User size={10} /> {entry.actor}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={10} /> {format(new Date(entry.timestamp), 'dd MMM yyyy HH:mm')}
            </span>
            {entry.entityId && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Tag size={10} /> {entry.entityId.slice(0, 8)}
              </span>
            )}
          </div>
          {detailKeys.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {detailKeys.slice(0, 4).map(k => (
                <span key={k} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                  {k}: {String(entry.details[k]).slice(0, 20)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AuditTrail() {
  const [entries] = useState<AuditEntry[]>(() => mockStore.getAuditLog())
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('all')
  const [resultFilter, setResultFilter] = useState('all')

  const entityTypes = useMemo(() => [...new Set(entries.map(e => e.entityType))].sort(), [entries])

  const filtered = useMemo(() => {
    let list = entries
    if (entityFilter !== 'all') list = list.filter(e => e.entityType === entityFilter)
    if (resultFilter !== 'all') list = list.filter(e => e.result === resultFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(e =>
        e.action.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q)
      )
    }
    return list
  }, [entries, search, entityFilter, resultFilter])

  function exportCsv() {
    const header = 'Timestamp,Actor,Action,Entity Type,Entity ID,Result'
    const rows = filtered.map(e =>
      `"${e.timestamp}","${e.actor}","${e.action}","${e.entityType}","${e.entityId}","${e.result}"`
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click()
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
            <p className="text-sm text-muted-foreground">{filtered.length} of {entries.length} entries</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download size={14} className="mr-1.5" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search audit log..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
        </div>
        <Select value={entityFilter} onValueChange={(v: string) => setEntityFilter(v)}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Entity type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {entityTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={resultFilter} onValueChange={(v: string) => setResultFilter(v)}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Result" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All results</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto min-h-0 rounded-lg border border-border/60 bg-background">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Shield size={32} className="opacity-20" />
            <p className="text-sm">No audit entries found</p>
          </div>
        ) : (
          filtered.map(e => <AuditRow key={e.id} entry={e} />)
        )}
      </div>
    </div>
  )
}
