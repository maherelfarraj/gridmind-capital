'use client'

import React from 'react'
import { Search, Upload, Download, ChevronDown, ChevronUp, Pencil, Link2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type AsBuilt, type AsBuiltStatus } from './types'
import { AB_STATUS_META, AB_STATUS_FALLBACK } from './data'

export function AsBuiltsTab({ drawings }: { drawings: AsBuilt[] }) {
  const [search,     setSearch]     = React.useState('')
  const [filter,     setFilter]     = React.useState<AsBuiltStatus | 'all'>('all')
  const [discDisc,   setDiscDisc]   = React.useState<string>('all')
  const [expanded,   setExpanded]   = React.useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = React.useState(false)

  const disciplines = Array.from(new Set(drawings.map((d) => d.discipline))).sort()
  const filtered = drawings.filter((d) => {
    const q = search.toLowerCase()
    const matchQ = !q || d.drawing_number.toLowerCase().includes(q) || d.title.toLowerCase().includes(q) || d.system.toLowerCase().includes(q)
    const matchS = filter === 'all' || d.status === filter
    const matchD = discDisc === 'all' || d.discipline === discDisc
    return matchQ && matchS && matchD
  })

  const stats = {
    total:    drawings.length,
    approved: drawings.filter((d) => d.status === 'approved').length,
    pending:  drawings.filter((d) => d.status === 'pending').length,
    review:   drawings.filter((d) => d.status === 'under_review' || d.status === 'redlines_submitted').length,
  }

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Drawings', value: stats.total,    color: '#64ffda' },
          { label: 'Approved',       value: stats.approved, color: '#22c55e' },
          { label: 'Under Review',   value: stats.review,   color: '#f59e0b' },
          { label: 'Pending Upload', value: stats.pending,  color: '#6b7280' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Status distribution bar */}
      {(() => {
        const statusOrder: AsBuiltStatus[] = ['approved', 'under_review', 'redlines_submitted', 'pending', 'superseded']
        const counts = statusOrder.map((s) => ({ status: s, count: drawings.filter((d) => d.status === s).length, ...AB_STATUS_META[s] }))
        return (
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">As-Built Status Distribution</p>
            <div className="flex h-4 rounded-full overflow-hidden gap-px">
              {counts.filter((c) => c.count > 0).map((c) => (
                <div key={c.status} title={`${c.label}: ${c.count}`}
                  style={{ width: `${(c.count / drawings.length) * 100}%`, background: c.color }} />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-3">
              {counts.filter((c) => c.count > 0).map((c) => (
                <div key={c.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-full inline-block" style={{ background: c.color }} />
                  {c.label} ({c.count})
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Filters + upload button */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search drawings…"
              className="pl-8 pr-3 py-1.5 rounded-lg border border-border bg-muted/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#64ffda]/40 w-52" />
          </div>
          <select value={filter} onChange={(e) => setFilter(e.target.value as AsBuiltStatus | 'all')}
            className="px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-sm text-foreground focus:outline-none">
            <option value="all">All Statuses</option>
            {(Object.keys(AB_STATUS_META) as AsBuiltStatus[]).map((s) => (
              <option key={s} value={s}>{AB_STATUS_META[s].label}</option>
            ))}
          </select>
          <select value={discDisc} onChange={(e) => setDiscDisc(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-muted/20 text-sm text-foreground focus:outline-none">
            <option value="all">All Disciplines</option>
            {disciplines.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => setUploadOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-medium text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors whitespace-nowrap">
          <Upload className="size-3.5" /> Upload As-Built
        </button>
      </div>

      {/* Drawing register */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['', 'Drawing No.', 'Title', 'Discipline', 'System', 'IFC Rev', 'AB Rev', 'Status', 'Redlines', 'Approved By', ''].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const meta   = AB_STATUS_META[d.status] ?? AB_STATUS_FALLBACK(d.status)
              const isOpen = expanded === d.id
              const openRL = d.redlines.filter((r) => r.status === 'open').length
              return (
                <React.Fragment key={d.id}>
                  <tr className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="px-2 py-3">
                      {d.redlines.length > 0 && (
                        <button type="button" onClick={() => setExpanded(isOpen ? null : d.id)}
                          className="text-muted-foreground hover:text-foreground">
                          {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{d.drawing_number}</td>
                    <td className="px-4 py-3 text-sm text-foreground max-w-[220px] truncate" title={d.title}>{d.title}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">{d.discipline}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{d.system}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-foreground text-center">{d.original_ifc_rev}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-[#64ffda] text-center">{d.as_built_rev ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: meta.color, background: `${meta.color}18` }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {d.redlines.length > 0 ? (
                        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                          openRL > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400')}>
                          {d.redlines.length} ({openRL} open)
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{d.approved_by ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {d.file_url
                          ? <button type="button" className="text-xs text-[#64ffda] hover:underline flex items-center gap-1"><Download className="size-3" /> Download</button>
                          : <button type="button" onClick={() => setUploadOpen(true)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"><Upload className="size-3" /> Upload</button>
                        }
                        {d.linked_punch_items.length > 0 && (
                          <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Link2 className="size-2.5" />{d.linked_punch_items.length} PL
                          </span>
                        )}
                        {d.linked_ncrs.length > 0 && (
                          <span className="text-[10px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Link2 className="size-2.5" />{d.linked_ncrs.length} NCR
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Redlines sub-table */}
                  {isOpen && d.redlines.length > 0 && (
                    <tr className="border-b border-border bg-amber-500/5">
                      <td colSpan={11} className="px-6 py-4">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5">
                          <Pencil className="size-3" /> Redlines / Markups
                        </p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                              {['Description', 'Area', 'Marked Up By', 'Date', 'Status'].map((h) => (
                                <th key={h} className="py-1.5 pr-4 text-left font-semibold">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {d.redlines.map((rl) => {
                              const rlColors = { open: '#f59e0b', incorporated: '#22c55e', rejected: '#ef4444' }
                              return (
                                <tr key={rl.id} className="border-b border-border/50 last:border-0">
                                  <td className="py-2 pr-4 text-foreground max-w-[280px]">{rl.description}</td>
                                  <td className="py-2 pr-4 text-muted-foreground font-mono text-[11px]">{rl.area}</td>
                                  <td className="py-2 pr-4 text-muted-foreground">{rl.markup_by}</td>
                                  <td className="py-2 pr-4 font-mono text-muted-foreground">{rl.markup_date}</td>
                                  <td className="py-2">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold capitalize"
                                      style={{ color: rlColors[rl.status], background: `${rlColors[rl.status]}18` }}>
                                      {rl.status}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">No drawings match the current filters.</div>
        )}
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setUploadOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-foreground">Upload As-Built Drawing</h3>
              <button type="button" onClick={() => setUploadOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </div>
            {[
              { label: 'Drawing Number', type: 'text', placeholder: 'e.g. CIV-001-001' },
              { label: 'Title',          type: 'text', placeholder: 'Drawing title' },
              { label: 'Discipline',     type: 'text', placeholder: 'e.g. Civil, Electrical' },
              { label: 'As-Built Rev',   type: 'text', placeholder: 'e.g. AB1' },
            ].map((f) => (
              <div key={f.label}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">{f.label}</label>
                <input type={f.type} placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-muted/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#64ffda]/40" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1 block">File (PDF / DWG)</label>
              <div className="flex items-center justify-center h-20 rounded-lg border-2 border-dashed border-border bg-muted/10 text-muted-foreground text-sm hover:border-[#64ffda]/40 transition-colors cursor-pointer">
                <div className="flex flex-col items-center gap-1 pointer-events-none">
                  <Upload className="size-5" />
                  <span>Click or drag to upload</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setUploadOpen(false)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => setUploadOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-medium text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors">
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
