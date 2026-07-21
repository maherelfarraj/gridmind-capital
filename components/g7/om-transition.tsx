'use client'
import React from 'react'
import {
  Users, CalendarDays, ShieldCheck, Headphones, BookOpen,
  Mail, Phone, Clock, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OmPersonnel, MaintenanceEvent, WarrantyItem, SlaContact } from './types'

const TYPE_COLORS: Record<MaintenanceEvent['type'], string> = {
  preventive:  'bg-blue-100 text-blue-700 border-blue-200',
  inspection:  'bg-amber-100 text-amber-700 border-amber-200',
  calibration: 'bg-purple-100 text-purple-700 border-purple-200',
}

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function WarrantyCountdown({ item }: { item: WarrantyItem }) {
  const days = daysUntil(item.warranty_end)
  const pct  = Math.max(0, Math.min(100, (days / 1825) * 100)) // 5yr max
  const color = days > 730 ? '#10b981' : days > 365 ? '#f59e0b' : '#ef4444'
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-700 leading-tight">{item.asset_name}</p>
        <span className="text-[10px] font-bold" style={{ color }}>{days > 0 ? `${days}d` : 'Expired'}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span>{item.vendor}</span>
        <span>{item.warranty_end}</span>
      </div>
    </div>
  )
}

interface OmTransitionProps {
  personnel: OmPersonnel[]
  maintenance: MaintenanceEvent[]
  warranties: WarrantyItem[]
  sla: SlaContact[]
}

export function OmTransition({ personnel, maintenance, warranties, sla }: OmTransitionProps) {
  const [lessons, setLessons] = React.useState(
    'Solar tracker installation sequence should start from the substation outward to allow earlier energization testing.\n\nEnsure all PE stamps are obtained before pouring foundation concrete — late stamp requests caused 2-week delay on Block C.\n\nHuawei inverter pre-commissioning checklist should be run 72 hrs before scheduled energization to allow firmware updates to complete.'
  )

  const sections = [
    { id: 'team',      label: 'Operations Team',       icon: <Users      size={14} /> },
    { id: 'schedule',  label: 'Maintenance Schedule',  icon: <CalendarDays size={14} /> },
    { id: 'warranty',  label: 'Warranty Tracker',      icon: <ShieldCheck size={14} /> },
    { id: 'support',   label: 'Support Handover',      icon: <Headphones size={14} /> },
    { id: 'lessons',   label: 'Lessons Learned',       icon: <BookOpen   size={14} /> },
  ]
  const [active, setActive] = React.useState('team')

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col h-full">
      <h2 className="text-base font-bold text-slate-800 mb-4">O&amp;M Transition</h2>

      {/* Section tabs (vertical pill list) */}
      <div className="flex flex-col gap-1 mb-5">
        {sections.map((s) => (
          <button key={s.id} type="button" onClick={() => setActive(s.id)}
            className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left',
              active === s.id ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-50')}>
            {s.icon}{s.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0">

        {/* Operations Team */}
        {active === 'team' && (
          <div className="space-y-3">
            {personnel.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {p.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                  <p className="text-[11px] text-slate-500">{p.role} · {p.specialisation}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <a href={`mailto:${p.email}`} className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 transition-colors">
                    <Mail size={12} />
                  </a>
                  <a href={`tel:${p.phone}`} className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-emerald-600 transition-colors">
                    <Phone size={12} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Maintenance Schedule */}
        {active === 'schedule' && (
          <div className="space-y-2">
            {maintenance.sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date)).map((e) => (
              <div key={e.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex-shrink-0 mt-0.5">
                  <CalendarDays size={14} className="text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-700">{e.title}</p>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', TYPE_COLORS[e.type])}>{e.type}</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{e.asset_name} · {e.duration_hours}h · {e.assigned_to}</p>
                </div>
                <p className="text-[11px] font-semibold text-slate-600 flex-shrink-0">{e.scheduled_date}</p>
              </div>
            ))}
          </div>
        )}

        {/* Warranty Tracker */}
        {active === 'warranty' && (
          <div className="space-y-2">
            {warranties.map((w) => <WarrantyCountdown key={w.id} item={w} />)}
          </div>
        )}

        {/* Support Handover */}
        {active === 'support' && (
          <div className="space-y-3">
            {sla.map((s) => (
              <div key={s.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm font-bold text-slate-800">{s.vendor}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
                    <Clock size={10} /> {s.sla_response_hours}h SLA
                  </span>
                </div>
                <p className="text-xs text-slate-500">{s.service_type}</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-600 pt-1">
                  <span className="flex items-center gap-1"><Users size={11} />{s.contact_name}</span>
                  <a href={`tel:${s.contact_phone}`} className="flex items-center gap-1 hover:text-emerald-600"><Phone size={11} />{s.contact_phone}</a>
                  <a href={`mailto:${s.contact_email}`} className="flex items-center gap-1 hover:text-emerald-600"><Mail size={11} />{s.contact_email}</a>
                </div>
                <p className="text-[10px] text-slate-400">Contract ref: {s.contract_ref}</p>
              </div>
            ))}
          </div>
        )}

        {/* Lessons Learned */}
        {active === 'lessons' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Capture project insights to improve future delivery. These notes will be archived in the knowledge base.</p>
            <textarea
              value={lessons}
              onChange={(e) => setLessons(e.target.value)}
              rows={9}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              placeholder="Enter lessons learned from this project…"
            />
            <button type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
              <CheckCircle2 size={14} /> Save Lessons Learned
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
