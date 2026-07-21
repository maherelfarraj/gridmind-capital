'use client'

import React from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { DisciplineProgress, S_CURVE_DATA, EV_DATA } from './data'

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n)

export function ProgressTab({ disciplines }: { disciplines: DisciplineProgress[] }) {
  const [logOpen, setLogOpen] = React.useState(false)

  const ev = { bcws: 10800000, bcwp: 9090000, acwp: 9500000, spi: 0.84, cpi: 0.96, eac: 90000000, vac: -5000000 }
  const spiColor = ev.spi >= 0.95 ? 'text-green-600' : ev.spi >= 0.85 ? 'text-amber-600' : 'text-red-600'
  const cpiColor = ev.cpi >= 0.95 ? 'text-green-600' : ev.cpi >= 0.85 ? 'text-amber-600' : 'text-red-600'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: '18%',              sub: 'Planned 22% | -4%',      color: 'text-orange-600' },
          { label: 'SPI',              value: ev.spi.toFixed(2),  sub: 'Schedule Perf. Index',   color: spiColor },
          { label: 'CPI',              value: ev.cpi.toFixed(2),  sub: 'Cost Perf. Index',        color: cpiColor },
          { label: 'EAC',              value: fmt(ev.eac),         sub: `VAC ${fmt(ev.vac)}`,     color: ev.vac < 0 ? 'text-red-600' : 'text-green-600' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</p>
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-slate-800 mb-4">S-Curve — Planned vs Actual Progress (%)</p>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={S_CURVE_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Legend />
            <Area type="monotone" dataKey="planned" name="Planned" stroke="#94a3b8" fill="#f1f5f9" strokeWidth={2} dot={false} />
            <Area type="monotone" dataKey="actual"  name="Actual"  stroke="#f97316" fill="#fed7aa" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <p className="text-sm font-semibold text-slate-800 mb-4">Earned Value — BCWS / BCWP / ACWP</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={EV_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tickFormatter={(v) => `$${(v / 1_000_000).toFixed(0)}M`} tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip formatter={(v) => typeof v === 'number' ? `$${(v / 1_000_000).toFixed(2)}M` : v} />
            <Legend />
            <Bar dataKey="bcws" name="BCWS (Planned)" fill="#94a3b8" radius={[3, 3, 0, 0]} />
            <Bar dataKey="bcwp" name="BCWP (Earned)"  fill="#f97316" radius={[3, 3, 0, 0]} />
            <Bar dataKey="acwp" name="ACWP (Actual)"  fill="#ef4444" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Progress by Discipline</p>
          <button type="button" onClick={() => setLogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors">
            <Plus className="size-3" /> Log Progress
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              {['Discipline','Weight','Planned %','Actual %','Variance','Status','Progress Bar'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {disciplines.map((d) => {
              const variance = d.actual - d.planned
              const status = variance >= 0 ? 'On Track' : variance >= -5 ? 'At Risk' : 'Behind'
              const statusColor = status === 'On Track' ? 'bg-green-100 text-green-700' : status === 'At Risk' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
              return (
                <tr key={d.discipline} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{d.discipline}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.weight}%</td>
                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">{d.planned}%</td>
                  <td className="px-4 py-3 text-xs font-semibold text-orange-600">{d.actual}%</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-semibold', variance >= 0 ? 'text-green-600' : 'text-red-600')}>
                      {variance >= 0 ? '+' : ''}{variance}%
                    </span>
                  </td>
                  <td className="px-4 py-3"><Badge className={statusColor}>{status}</Badge></td>
                  <td className="px-4 py-3 w-36">
                    <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="absolute h-full bg-slate-300 rounded-full" style={{ width: `${d.planned}%` }} />
                      <div className="absolute h-full bg-orange-500 rounded-full" style={{ width: `${d.actual}%` }} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {logOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[480px] mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">Log Daily Progress</p>
              <button type="button" onClick={() => setLogOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button>
            </div>
            <form className="px-6 py-5 grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); setLogOpen(false) }}>
              {[
                { label: 'Date',       type: 'date',     colSpan: 1, placeholder: '' },
                { label: 'Weather',    type: 'text',     colSpan: 1, placeholder: 'Clear, Dusty, Rain...' },
                { label: 'Work Areas', type: 'text',     colSpan: 2, placeholder: 'Zone A, Sector B...' },
                { label: 'Activities', type: 'textarea', colSpan: 2, placeholder: 'Key activities today...' },
                { label: 'Personnel',  type: 'number',   colSpan: 1, placeholder: '0' },
                { label: 'Equipment',  type: 'text',     colSpan: 1, placeholder: 'List equipment used' },
                { label: 'Issues',     type: 'textarea', colSpan: 2, placeholder: 'Any issues or observations...' },
              ].map(({ label, type, colSpan, placeholder }) => (
                <div key={label} className={cn('flex flex-col gap-1', colSpan === 2 ? 'col-span-2' : '')}>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</label>
                  {type === 'textarea'
                    ? <textarea placeholder={placeholder} rows={2} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 resize-none" />
                    : <input type={type} placeholder={placeholder} className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-400/30" />
                  }
                </div>
              ))}
              <div className="col-span-2 flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setLogOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
