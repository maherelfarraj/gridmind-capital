'use client'

import React from 'react'
import { CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SiteReadinessItem } from './data'

export function SiteReadinessTab({ items }: { items: SiteReadinessItem[] }) {
  const [expanded, setExpanded] = React.useState<string | null>('Site Access')

  const categories = Array.from(new Set(items.map((i) => i.category)))
  const categoryData = categories.map((cat) => {
    const catItems = items.filter((i) => i.category === cat)
    const done = catItems.filter((i) => i.status === 'Complete').length
    return { cat, items: catItems, done, total: catItems.length, pct: Math.round((done / catItems.length) * 100) }
  })
  const overallPct = Math.round(items.filter((i) => i.status === 'Complete').length / items.length * 100)

  const ITEM_STATUS: Record<string, { color: string; icon: React.ReactNode }> = {
    'Complete':    { color: 'text-green-600', icon: <CheckCircle className="size-4 text-green-500" /> },
    'In Progress': { color: 'text-amber-600', icon: <Clock className="size-4 text-amber-500" /> },
    'Not Started': { color: 'text-slate-400', icon: <Clock className="size-4 text-slate-300" /> },
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center py-8 gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Readiness Score</p>
          <div className="relative size-28">
            <svg className="size-full -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="14" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="14" fill="none" stroke="#f97316" strokeWidth="3.5"
                strokeDasharray={`${(overallPct / 100) * 87.96} 87.96`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-orange-600">{overallPct}%</span>
            </div>
          </div>
          <p className="text-xs text-slate-500">{items.filter((i) => i.status === 'Complete').length} / {items.length} complete</p>
        </div>

        <div className="md:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-4">Category Progress</p>
          <div className="grid grid-cols-2 gap-3">
            {categoryData.map(({ cat, pct, done, total }) => (
              <div key={cat}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-slate-700 font-medium">{cat}</span>
                  <span className="text-xs text-slate-500">{done}/{total}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-orange-500')}
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {categoryData.map(({ cat, items: catItems, done, total, pct }) => (
          <div key={cat} className="border-b border-slate-100 last:border-0">
            <button type="button" onClick={() => setExpanded(expanded === cat ? null : cat)}
              className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3">
                {expanded === cat ? <ChevronUp className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
                <span className="text-sm font-semibold text-slate-800">{cat}</span>
                <span className="text-xs text-slate-500">{done}/{total}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                  <div className={cn('h-full rounded-full', pct === 100 ? 'bg-green-500' : 'bg-amber-500')} style={{ width: `${pct}%` }} />
                </div>
                <span className={cn('text-xs font-bold', pct === 100 ? 'text-green-600' : 'text-amber-600')}>{pct}%</span>
              </div>
            </button>
            {expanded === cat && (
              <div className="px-6 pb-4 space-y-2">
                {catItems.map((item) => {
                  const sm = ITEM_STATUS[item.status] ?? ITEM_STATUS['Not Started']
                  return (
                    <div key={item.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                      {sm.icon}
                      <p className="flex-1 text-sm text-slate-700">{item.description}</p>
                      <span className="text-[11px] text-slate-500 hidden sm:block">{item.responsible}</span>
                      <span className="text-[11px] font-mono text-slate-400 w-12 text-right">{item.due_date}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
