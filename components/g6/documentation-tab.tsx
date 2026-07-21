'use client'
import React from 'react'
import { FileText, Download, Upload, Search } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { CommDoc, DocStatus } from './types'
import { DOC_STATUS_META } from './data'

export function DocumentationTab({ docs }: { docs: CommDoc[] }) {
  const [search, setSearch] = React.useState('')
  const [filter, setFilter] = React.useState<DocStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = React.useState<string>('all')

  const types = Array.from(new Set(docs.map((d) => d.type))).sort()
  const filtered = docs.filter((d) => {
    const q = search.toLowerCase()
    const mQ = !q || d.code.toLowerCase().includes(q) || d.title.toLowerCase().includes(q) || d.system.toLowerCase().includes(q)
    const mSt = filter === 'all' || d.status === filter
    const mT = typeFilter === 'all' || d.type === typeFilter
    return mQ && mSt && mT
  })

  const approved = docs.filter((d) => d.status === 'approved').length
  const pending = docs.filter((d) => d.status === 'pending' || d.status === 'draft').length

  // Charts
  const statusData = (Object.keys(DOC_STATUS_META) as DocStatus[])
    .map((s) => ({ name: DOC_STATUS_META[s].label, value: docs.filter((d) => d.status === s).length, fill: DOC_STATUS_META[s].color }))
    .filter((d) => d.value > 0)

  const typeData = types.map((t) => ({ name: t.replace('Commissioning ', '').replace(' Report', ''), count: docs.filter((d) => d.type === t).length }))

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: docs.length, color: '#0f766e', bg: '#ccfbf1' },
          { label: 'Approved', value: approved, color: '#16a34a', bg: '#dcfce7' },
          { label: 'Pending / Draft', value: pending, color: '#d97706', bg: '#fef3c7' },
          { label: 'Under Review', value: docs.filter((d) => d.status === 'under_review').length, color: '#7c3aed', bg: '#ede9fe' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
            <span className="p-2 rounded-lg" style={{ background: k.bg, color: k.color }}><FileText size={16} /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{k.label}</p>
              <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Documents by Type</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={typeData} layout="vertical" barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={110} />
              <Tooltip formatter={(v) => [v, 'Documents']} />
              <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Approval Status</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}
                label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                labelLine={false} fontSize={10}>
                {statusData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={(v) => [v, 'Docs']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..."
            className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-400 w-52" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as DocStatus | 'all')}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none">
          <option value="all">All Statuses</option>
          {(Object.keys(DOC_STATUS_META) as DocStatus[]).map((s) => <option key={s} value={s}>{DOC_STATUS_META[s].label}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm text-slate-700 focus:outline-none">
          <option value="all">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="button" className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold transition-colors">
          <Upload size={13} /> Upload Document
        </button>
      </div>

      {/* Document register */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400">
              {['Code', 'Title', 'Type', 'System', 'Status', 'Prepared By', 'Approved By', 'Date', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const m = DOC_STATUS_META[d.status]
              return (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-teal-600">{d.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[220px] truncate" title={d.title}>{d.title}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.type}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.system}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{d.prepared_by}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.approved_by ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{d.approved_date ?? d.submitted_date ?? '—'}</td>
                  <td className="px-4 py-3">
                    {d.file_url
                      ? <button type="button" className="text-xs text-teal-600 hover:underline flex items-center gap-1"><Download size={12} />Download</button>
                      : <button type="button" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><Upload size={12} />Upload</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm">No documents match the current filters.</div>
        )}
      </div>
    </div>
  )
}
