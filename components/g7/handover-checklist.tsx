'use client'
import React from 'react'
import {
  CheckCircle2, Clock, XCircle, AlertTriangle, ChevronDown, ChevronUp,
  FileText, User, CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Milestone, MilestoneStatus } from './types'

const STATUS_META: Record<MilestoneStatus, { label: string; icon: React.ReactNode; ring: string; bg: string; text: string }> = {
  'complete':    { label: 'Complete',    icon: <CheckCircle2 size={16} />, ring: 'ring-emerald-400', bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  'in-progress': { label: 'In Progress', icon: <Clock        size={16} />, ring: 'ring-amber-400',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  'not-started': { label: 'Not Started', icon: <XCircle      size={16} />, ring: 'ring-slate-300',   bg: 'bg-slate-50',    text: 'text-slate-500'   },
  'blocked':     { label: 'Blocked',     icon: <AlertTriangle size={16}/>, ring: 'ring-red-400',     bg: 'bg-red-50',      text: 'text-red-700'     },
}

export function HandoverChecklist({ milestones }: { milestones: Milestone[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const complete = milestones.filter((m) => m.status === 'complete').length
  const pct = Math.round((complete / milestones.length) * 100)

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      {/* Progress header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-slate-800">Handover Checklist</h2>
          <p className="text-sm text-slate-500 mt-0.5">{complete} of {milestones.length} milestones complete</p>
        </div>
        <div className="text-3xl font-black" style={{ color: '#10b981' }}>{pct}%</div>
      </div>

      {/* Progress bar */}
      <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }}
        />
      </div>

      {/* Timeline milestones */}
      <div className="relative">
        {/* Vertical connector */}
        <div className="absolute left-5 top-6 bottom-6 w-px bg-slate-200" />

        <div className="space-y-3">
          {milestones.map((m) => {
            const meta = STATUS_META[m.status]
            const isOpen = expanded === m.id
            return (
              <div key={m.id} className={cn('relative rounded-xl border transition-shadow', meta.ring, 'ring-1', meta.bg)}>
                {/* Step indicator */}
                <div className={cn(
                  'absolute -left-px top-4 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ring-2 ring-white',
                  meta.bg, meta.text,
                )}>
                  <span className={meta.text}>{m.order}</span>
                </div>

                <div className="pl-14 pr-4 py-4">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : m.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{m.title}</span>
                          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full', meta.bg, meta.text)}>
                            {meta.icon}{meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{m.description}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
                        <span className="flex items-center gap-1">
                          <CalendarDays size={12} />
                          {m.completion_date ?? `Due ${m.target_date}`}
                        </span>
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                      <p className="text-xs text-slate-600">{m.description}</p>

                      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                            {m.responsible_initials}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-700">{m.responsible_party}</p>
                            <p className="text-slate-400">{m.responsible_role}</p>
                          </div>
                        </div>
                      </div>

                      {m.blocker && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
                          <span><strong>Blocker:</strong> {m.blocker}</span>
                        </div>
                      )}

                      {m.docs.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {m.docs.map((d) => (
                            <a key={d.id} href={d.url}
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700 transition-colors">
                              <FileText size={11} />{d.name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
