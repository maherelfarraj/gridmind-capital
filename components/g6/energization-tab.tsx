'use client'
import React from 'react'
import { Zap, CheckCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Energization, EnergizationStatus } from './types'
import { ENRG_STATUS_META } from './data'

function StepRow({ step, index }: { step: Energization['steps'][0]; index: number }) {
  const done = step.status === 'complete'
  const hold = step.status === 'hold'
  return (
    <div className="flex gap-3 items-start">
      <div className={cn(
        'size-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5',
        done ? 'bg-green-100 text-green-700' : hold ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500',
      )}>
        {done ? <CheckCircle size={12} /> : hold ? <AlertTriangle size={12} /> : index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm', done ? 'text-slate-600 line-through' : hold ? 'text-red-700 font-medium' : 'text-slate-800')}>{step.description}</p>
        {done && step.completed_by && (
          <p className="text-xs text-slate-400 mt-0.5">{step.completed_by} &nbsp;·&nbsp; {step.completed_date}</p>
        )}
      </div>
    </div>
  )
}

export function EnergizationTab({ records }: { records: Energization[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(records[1]?.id ?? null)

  const complete = records.filter((r) => r.status === 'complete').length
  const inProgress = records.filter((r) => r.status === 'in_progress').length
  const scheduled = records.filter((r) => r.status === 'scheduled').length

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Energizations', value: records.length, color: '#0f766e', bg: '#ccfbf1' },
          { label: 'Complete', value: complete, color: '#16a34a', bg: '#dcfce7' },
          { label: 'In Progress', value: inProgress, color: '#d97706', bg: '#fef3c7' },
          { label: 'Scheduled', value: scheduled, color: '#7c3aed', bg: '#ede9fe' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
            <span className="p-2 rounded-lg" style={{ background: k.bg, color: k.color }}><Zap size={16} /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{k.label}</p>
              <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Energization cards */}
      {records.map((rec) => {
        const m = ENRG_STATUS_META[rec.status]
        const isOpen = expanded === rec.id
        const stepsComplete = rec.steps.filter((s) => s.status === 'complete').length
        const pct = rec.steps.length > 0 ? Math.round((stepsComplete / rec.steps.length) * 100) : 0

        return (
          <div key={rec.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl" style={{ background: m.bg, color: m.color }}>
                  <Zap size={18} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">{rec.code}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{rec.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{rec.system} &nbsp;·&nbsp; {rec.voltage} &nbsp;·&nbsp; Lead: {rec.lead}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                {rec.scheduled_date && <p className="text-xs text-slate-400">Scheduled: {rec.scheduled_date}</p>}
                {rec.completed_date && <p className="text-xs text-green-600 font-medium">Completed: {rec.completed_date}</p>}
                {rec.permit_ref && (
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 justify-end">
                    <FileText size={11} />{rec.permit_ref}
                  </p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-5 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">{stepsComplete} / {rec.steps.length} steps complete</span>
                <span className="text-xs font-bold" style={{ color: m.color }}>{pct}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: m.color }} />
              </div>
            </div>

            {/* Expand steps */}
            <button type="button" onClick={() => setExpanded(isOpen ? null : rec.id)}
              className="w-full flex items-center justify-center gap-1 py-2 border-t border-slate-100 text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
              {isOpen ? <><ChevronUp size={12} /> Hide steps</> : <><ChevronDown size={12} /> View checklist ({rec.steps.length} steps)</>}
            </button>

            {isOpen && (
              <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/40 space-y-3">
                {rec.steps.map((step, i) => <StepRow key={step.id} step={step} index={i} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
