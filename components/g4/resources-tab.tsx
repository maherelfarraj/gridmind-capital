'use client'

import React from 'react'
import { Users, Truck, Package, Building } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Personnel, Equipment, Material, Subcontractor } from './data'

const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n)

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

const RES_STATUS: Record<string, string> = {
  'Active':            'bg-green-100 text-green-700',
  'Induction Pending': 'bg-amber-100 text-amber-700',
  'Off-Site':          'bg-slate-100 text-slate-700',
  'Stand-Down':        'bg-red-100 text-red-700',
  'In Use':            'bg-blue-100 text-blue-700',
  'Available':         'bg-green-100 text-green-700',
  'Maintenance':       'bg-amber-100 text-amber-700',
  'Broken':            'bg-red-100 text-red-700',
  'In Stock':          'bg-green-100 text-green-700',
  'On Order':          'bg-amber-100 text-amber-700',
  'Shortage':          'bg-red-100 text-red-700',
  'Excess':            'bg-blue-100 text-blue-700',
  'Mobilising':        'bg-purple-100 text-purple-700',
}

const Stars = ({ n }: { n: number }) => (
  <span className="text-amber-400 text-sm">{Array.from({ length: 5 }, (_, i) => (i < n ? '★' : '☆')).join('')}</span>
)

export function ResourcesTab({ personnel, equipment, materials, subcontractors }: {
  personnel: Personnel[]; equipment: Equipment[]; materials: Material[]; subcontractors: Subcontractor[]
}) {
  const [activeRes, setActiveRes] = React.useState<'Personnel' | 'Equipment' | 'Materials' | 'Subcontractors'>('Personnel')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<Users    className="size-5 text-blue-600" />}    label="Personnel On-Site"  value="45"  color="bg-blue-100"   />
        <StatCard icon={<Truck    className="size-5 text-orange-600" />}  label="Equipment Deployed" value="18"  color="bg-orange-100" />
        <StatCard icon={<Package  className="size-5 text-green-600" />}   label="Materials Received" value="65%" color="bg-green-100"  />
        <StatCard icon={<Building className="size-5 text-purple-600" />}  label="Subcontractors"     value="4"   color="bg-purple-100" />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {(['Personnel', 'Equipment', 'Materials', 'Subcontractors'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setActiveRes(t)}
              className={cn('px-5 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors',
                activeRes === t ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {t}
            </button>
          ))}
        </div>

        {activeRes === 'Personnel' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  {['Name','Role','Company','Start','Induction','Status'].map((h) => <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {personnel.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.role}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.company}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.start_date}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{p.induction_date}</td>
                    <td className="px-4 py-3"><Badge className={RES_STATUS[p.status] ?? 'bg-slate-100 text-slate-700'}>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeRes === 'Equipment' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  {['ID','Type','Model','Qty','Location','Status','Utilization'].map((h) => <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {equipment.map((eq) => (
                  <tr key={eq.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-orange-500">{eq.equipment_id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{eq.type}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{eq.model}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{eq.qty}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{eq.location}</td>
                    <td className="px-4 py-3"><Badge className={RES_STATUS[eq.status] ?? 'bg-slate-100 text-slate-700'}>{eq.status}</Badge></td>
                    <td className="px-4 py-3">
                      {eq.utilization > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', eq.utilization > 80 ? 'bg-green-500' : 'bg-amber-500')}
                              style={{ width: `${eq.utilization}%` }} />
                          </div>
                          <span className="text-xs text-slate-600">{eq.utilization}%</span>
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeRes === 'Materials' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  {['Item','Description','Ordered','Received','Installed','Unit','Delivery','Status'].map((h) => <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{m.item}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{m.description}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{m.ordered.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{m.received.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{m.installed.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">{m.unit}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{m.delivery_date}</td>
                    <td className="px-4 py-3"><Badge className={RES_STATUS[m.status] ?? 'bg-slate-100 text-slate-700'}>{m.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeRes === 'Subcontractors' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  {['Company','Scope','Value','Start','Personnel','Status','Performance'].map((h) => <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {subcontractors.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">{s.company}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">{s.scope}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{fmt(s.value)}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-400">{s.start_date}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{s.personnel}</td>
                    <td className="px-4 py-3"><Badge className={RES_STATUS[s.status] ?? 'bg-slate-100 text-slate-700'}>{s.status}</Badge></td>
                    <td className="px-4 py-3">{s.performance > 0 ? <Stars n={s.performance} /> : <span className="text-xs text-slate-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
