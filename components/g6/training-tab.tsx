'use client'
import React from 'react'
import { GraduationCap, CheckCircle, Award } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { TrainingRecord, TrainingStatus } from './types'
import { TRAIN_STATUS_META } from './data'

export function TrainingTab({ records }: { records: TrainingRecord[] }) {
  const [filter, setFilter] = React.useState<TrainingStatus | 'all'>('all')

  const filtered = filter === 'all' ? records : records.filter((r) => r.status === filter)

  const complete = records.filter((r) => r.status === 'complete').length
  const inProgress = records.filter((r) => r.status === 'in_progress').length
  const notStarted = records.filter((r) => r.status === 'not_started').length

  // Charts
  const categoryData = (() => {
    const map: Record<string, number> = {}
    records.forEach((r) => { map[r.category] = (map[r.category] ?? 0) + 1 })
    return Object.entries(map).map(([name, count]) => ({ name, count }))
  })()

  const statusPieData = (Object.keys(TRAIN_STATUS_META) as TrainingStatus[])
    .map((s) => ({ name: TRAIN_STATUS_META[s].label, value: records.filter((r) => r.status === s).length, fill: TRAIN_STATUS_META[s].color }))
    .filter((d) => d.value > 0)

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Records', value: records.length, color: '#0f766e', bg: '#ccfbf1' },
          { label: 'Complete', value: complete, color: '#16a34a', bg: '#dcfce7' },
          { label: 'In Progress', value: inProgress, color: '#d97706', bg: '#fef3c7' },
          { label: 'Not Started', value: notStarted, color: '#475569', bg: '#f1f5f9' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
            <span className="p-2 rounded-lg" style={{ background: k.bg, color: k.color }}><GraduationCap size={16} /></span>
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
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Modules by Category</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={categoryData} layout="vertical" barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#94a3b8' }} width={130} />
              <Tooltip formatter={(v) => [v, 'Modules']} />
              <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Completion Status</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={statusPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60}
                label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                labelLine={false} fontSize={10}>
                {statusPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={(v) => [v, 'Records']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(['all', ...Object.keys(TRAIN_STATUS_META)] as (TrainingStatus | 'all')[]).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${filter === s ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>
            {s === 'all' ? 'All' : TRAIN_STATUS_META[s].label}
          </button>
        ))}
      </div>

      {/* Training table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[750px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wider text-slate-400">
              {['Module', 'Category', 'Trainee', 'Role', 'Trainer', 'Status', 'Planned', 'Score', 'Certificate'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const m = TRAIN_STATUS_META[r.status]
              const passed = r.score !== null && r.score >= r.pass_mark
              return (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate" title={r.module}>{r.module}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.category}</td>
                  <td className="px-4 py-3 text-slate-700">{r.trainee}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.role}</td>
                  <td className="px-4 py-3 text-slate-700">{r.trainer}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{r.planned_date}</td>
                  <td className="px-4 py-3">
                    {r.score !== null ? (
                      <span className={`text-xs font-bold ${passed ? 'text-green-600' : 'text-red-600'}`}>
                        {r.score}% {passed ? <CheckCircle className="inline size-3" /> : '✗'}
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.certificate
                      ? <span className="text-xs text-teal-600 flex items-center gap-1 cursor-pointer hover:underline"><Award size={12} />{r.certificate}</span>
                      : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm">No training records match the current filter.</div>
        )}
      </div>
    </div>
  )
}
