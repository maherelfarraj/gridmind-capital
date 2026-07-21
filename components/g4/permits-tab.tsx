'use client'

import React from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Permit, PERMIT_STATUS_META } from './data'

export function PermitsTab({ permits }: { permits: Permit[] }) {
  const [view, setView] = React.useState<'list' | 'calendar'>('list')

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  type CalEntry = { code: string; label: string; color: string }
  const calendarData: Record<string, CalEntry[]> = {}
  const PERMIT_CAL_COLORS: Record<string, string> = {
    'Approved':     'bg-green-100 text-green-700 border-green-200',
    'Pending':      'bg-amber-100 text-amber-700 border-amber-200',
    'Under Review': 'bg-blue-100  text-blue-700  border-blue-200',
    'Not Started':  'bg-slate-100 text-slate-600  border-slate-200',
  }
  permits.forEach((p) => {
    const parseMonth = (d: string | null) => {
      if (!d || d === '—') return null
      const parts = d.split(' ')
      return parts.length >= 2 ? `${parts[0].slice(0, 3)} ${parts[1]}` : null
    }
    const issueKey  = parseMonth(p.issue_date)
    const expiryKey = parseMonth(p.expiry_date)
    if (issueKey) {
      if (!calendarData[issueKey]) calendarData[issueKey] = []
      calendarData[issueKey].push({ code: p.code, label: 'Issued', color: PERMIT_CAL_COLORS[p.status] ?? PERMIT_CAL_COLORS['Pending'] })
    }
    if (expiryKey && expiryKey !== issueKey) {
      if (!calendarData[expiryKey]) calendarData[expiryKey] = []
      calendarData[expiryKey].push({ code: p.code, label: 'Expires', color: 'bg-red-100 text-red-700 border-red-200' })
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['list', 'calendar'] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)}
              className={cn('px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors',
                view === v ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
              {v === 'list' ? 'List View' : 'Calendar View'}
            </button>
          ))}
        </div>
        <button type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors">
          <Plus className="size-3" /> New Permit
        </button>
      </div>

      {view === 'calendar' ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Permit Calendar — 2026</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {MONTHS.map((mon) => {
              const entries = [...(calendarData[`${mon} 2026`] ?? []), ...(calendarData[`${mon} 2027`] ?? [])]
              return (
                <div key={mon} className={cn('rounded-xl border p-3 min-h-[90px]',
                  entries.length > 0 ? 'border-orange-200 bg-orange-50/40' : 'border-slate-100 bg-slate-50/40')}>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">{mon}</p>
                  {entries.length === 0
                    ? <p className="text-[10px] text-slate-300 italic">No activity</p>
                    : entries.map((e, i) => (
                      <div key={i} className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border mb-1 truncate', e.color)}>
                        {e.code} — {e.label}
                      </div>
                    ))}
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-slate-400">Green = issued, Red = expires. Toggle to List View for full details.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Permit Tracker ({permits.length})</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  {['Permit ID','Type','Authority','Status','Application Date','Issue Date','Expiry','Renewal','Documents'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permits.map((p) => {
                  const sm = PERMIT_STATUS_META[p.status] ?? PERMIT_STATUS_META['Pending']
                  return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-orange-500">{p.code}</td>
                      <td className="px-4 py-3 text-sm text-slate-800 whitespace-nowrap">{p.type}</td>
                      <td className="px-4 py-3 text-xs text-slate-600">{p.authority}</td>
                      <td className="px-4 py-3"><Badge className={sm.color}>{sm.icon}{p.status}</Badge></td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{p.application_date}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{p.issue_date ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{p.expiry_date ?? '—'}</td>
                      <td className="px-4 py-3">
                        {p.renewal_required
                          ? <Badge className="bg-orange-100 text-orange-700"><RefreshCw className="size-3" /> Yes</Badge>
                          : <span className="text-xs text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{p.documents}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 border-t border-slate-100">
            {[
              { label: 'Approved',     count: permits.filter((p) => p.status === 'Approved').length,     color: 'bg-green-100 text-green-700' },
              { label: 'Pending',      count: permits.filter((p) => p.status === 'Pending').length,      color: 'bg-amber-100 text-amber-700' },
              { label: 'Under Review', count: permits.filter((p) => p.status === 'Under Review').length, color: 'bg-blue-100  text-blue-700'  },
              { label: 'Not Started',  count: permits.filter((p) => p.status === 'Not Started').length,  color: 'bg-slate-100 text-slate-700' },
            ].map(({ label, count, color }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <span className="text-2xl font-bold text-slate-900">{count}</span>
                <Badge className={color}>{label}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
