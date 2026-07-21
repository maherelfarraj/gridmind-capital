'use client'

import React from 'react'
import { Plus, X, CheckCircle, Clock, AlertTriangle, ClipboardList, GraduationCap, HardHat, ClipboardCheck, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { HSEPlanItem, Incident, INCIDENT_SEVERITY, INCIDENT_STATUS } from './data'

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className={cn('rounded-xl p-4 flex items-center gap-3', color)}>
      <div>{icon}</div>
      <div>
        <p className="text-xs text-slate-600 font-medium leading-tight">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export function HSETab({ planItems, incidents }: { planItems: HSEPlanItem[]; incidents: Incident[] }) {
  const [addIncident, setAddIncident] = React.useState(false)

  const HSE_STATUS_COLOR: Record<string, string> = {
    'Complete':    'text-green-600',
    'In Progress': 'text-amber-600',
    'Not Started': 'text-slate-400',
    'Overdue':     'text-red-600',
  }

  const hseStats = [
    { icon: <ShieldCheck   className="size-5 text-green-600" />,  label: 'Days Without Incident', value: '45',   color: 'bg-green-100' },
    { icon: <ShieldCheck   className="size-5 text-green-600" />,  label: 'TRIR',                  value: '0.00', color: 'bg-green-100' },
    { icon: <ShieldCheck   className="size-5 text-green-600" />,  label: 'LTIFR',                 value: '0.00', color: 'bg-green-100' },
    { icon: <AlertTriangle className="size-5 text-amber-600" />,  label: 'Near Misses',           value: '3',    color: 'bg-amber-100' },
    { icon: <ClipboardList className="size-5 text-blue-600" />,   label: 'Open Actions',          value: '12',   color: 'bg-blue-100'  },
    { icon: <GraduationCap className="size-5 text-green-600" />,  label: 'Training Complete',     value: '92%',  color: 'bg-green-100' },
    { icon: <HardHat       className="size-5 text-green-600" />,  label: 'PPE Compliance',        value: '98%',  color: 'bg-green-100' },
    { icon: <ClipboardCheck className="size-5 text-amber-600" />, label: 'Inspection Score',      value: '87%',  color: 'bg-amber-100' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {hseStats.map((s) => <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} />)}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">HSE Plan Status</p>
        </div>
        <div className="divide-y divide-slate-100">
          {planItems.map((item) => (
            <div key={item.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors">
              <div className={cn('size-5 rounded-full flex items-center justify-center flex-shrink-0',
                item.status === 'Complete' ? 'bg-green-100' : item.status === 'In Progress' ? 'bg-amber-100' : 'bg-slate-100')}>
                {item.status === 'Complete'
                  ? <CheckCircle className="size-3 text-green-600" />
                  : <Clock className={cn('size-3', item.status === 'In Progress' ? 'text-amber-600' : 'text-slate-400')} />}
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-800 font-medium">{item.name}</p>
                {item.detail && <p className="text-xs text-slate-400">{item.detail}</p>}
              </div>
              <span className={cn('text-xs font-semibold', HSE_STATUS_COLOR[item.status] ?? 'text-slate-500')}>{item.status}</span>
              <span className="text-xs text-slate-400 font-mono w-14 text-right">{item.date}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Incident Log</p>
          <button type="button" onClick={() => setAddIncident(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold transition-colors">
            <Plus className="size-3" /> Report Incident
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                {['ID','Date','Type','Severity','Description','Person','Status'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr key={inc.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-orange-500">{inc.id.toUpperCase()}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{inc.date}</td>
                  <td className="px-4 py-3 text-xs text-slate-700">{inc.type}</td>
                  <td className="px-4 py-3"><Badge className={INCIDENT_SEVERITY[inc.severity] ?? 'bg-slate-100 text-slate-700'}>{inc.severity}</Badge></td>
                  <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px] truncate">{inc.description}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{inc.person}</td>
                  <td className="px-4 py-3"><Badge className={INCIDENT_STATUS[inc.status] ?? 'bg-slate-100 text-slate-700'}>{inc.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[540px] mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">Report Incident</p>
              <button type="button" onClick={() => setAddIncident(false)} className="text-slate-400 hover:text-slate-600"><X className="size-4" /></button>
            </div>
            <form className="px-6 py-5 grid grid-cols-2 gap-4" onSubmit={(e) => { e.preventDefault(); setAddIncident(false) }}>
              {[
                { label: 'Date',              type: 'date',     colSpan: 1, placeholder: '' },
                { label: 'Time',              type: 'time',     colSpan: 1, placeholder: '' },
                { label: 'Type',              type: 'text',     colSpan: 1, placeholder: 'Injury, Near Miss, etc.' },
                { label: 'Severity',          type: 'text',     colSpan: 1, placeholder: 'Minor, Serious, Major...' },
                { label: 'Location',          type: 'text',     colSpan: 2, placeholder: 'Site location / zone' },
                { label: 'Description',       type: 'textarea', colSpan: 2, placeholder: 'What happened?' },
                { label: 'Immediate Action',  type: 'textarea', colSpan: 2, placeholder: 'Action taken immediately...' },
                { label: 'Person(s) Involved',type: 'text',     colSpan: 1, placeholder: 'Name(s)' },
                { label: 'Witnesses',         type: 'text',     colSpan: 1, placeholder: 'Witness names' },
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
                <button type="button" onClick={() => setAddIncident(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">Submit Report</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
