'use client'
import React from 'react'
import { Gauge, Percent, Clock, Flame, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { PerformanceTest, PerfTestStatus } from './types'
import { PERF_STATUS_META, META_FALLBACK } from './data'

const KPI_ICONS: Record<string, React.ReactNode> = {
  'Capacity Test':     <Gauge size={18} />,
  'Efficiency Test':   <Percent size={18} />,
  'Availability Test': <Clock size={18} />,
  'Heat Rate Test':    <Flame size={18} />,
}

function DeviationBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-slate-400">—</span>
  const color = pct > 0 ? '#16a34a' : pct < -5 ? '#dc2626' : '#d97706'
  const icon = pct > 0 ? <TrendingUp size={12} /> : pct < 0 ? <TrendingDown size={12} /> : <Minus size={12} />
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color }}>
      {icon}{pct > 0 ? '+' : ''}{pct}%
    </span>
  )
}

export function PerformanceTab({ tests }: { tests: PerformanceTest[] }) {
  const [expanded, setExpanded] = React.useState<string | null>(null)

  // Chart data — guarantee vs tested
  const chartData = tests
    .filter((t) => t.tested_value !== null)
    .map((t) => ({
      name: t.name.replace(' Test', ''),
      guarantee: parseFloat(t.guarantee.replace(/,/g, '')),
      tested: parseFloat((t.tested_value ?? '0').replace(/,/g, '')),
      unit: t.guarantee_unit,
    }))

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tests.slice(0, 4).map((t) => {
          const m = PERF_STATUS_META[t.status] ?? META_FALLBACK(t.status)
          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex gap-3 items-start shadow-sm">
              <span className="p-2 rounded-lg mt-0.5" style={{ background: m.bg, color: m.color }}>
                {KPI_ICONS[t.name] ?? <Gauge size={18} />}
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 truncate">{t.name}</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: m.color }}>
                  {t.tested_value ? `${t.tested_value} ${t.guarantee_unit}` : 'Pending'}
                </p>
                {t.deviation_pct !== null && <DeviationBadge pct={t.deviation_pct} />}
              </div>
            </div>
          )
        })}
      </div>

      {/* Guarantee vs Tested chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-4">Guarantee vs Tested (normalised %)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={(() => {
              return tests.filter((t) => t.tested_value !== null).map((t) => {
                const g = parseFloat(t.guarantee.replace(/,/g, ''))
                const v = parseFloat((t.tested_value ?? '0').replace(/,/g, ''))
                return {
                  name: t.name.replace(' Test', ''),
                  'Tested %': Math.round((v / g) * 100),
                  'Guarantee': 100,
                }
              })
            })()} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis domain={[80, 115]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
              <Tooltip formatter={(v) => [`${v}%`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={100} stroke="#14b8a6" strokeDasharray="4 4" label={{ value: 'Guarantee', fontSize: 10, fill: '#14b8a6' }} />
              <Bar dataKey="Tested %" fill="#14b8a6" radius={[4, 4, 0, 0]}
                label={{ position: 'top', fontSize: 10, fill: '#475569', formatter: (v: unknown) => `${v}%` }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Test cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tests.map((t) => {
          const m = PERF_STATUS_META[t.status] ?? META_FALLBACK(t.status)
          const isOpen = expanded === t.id
          return (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">{t.name}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0"
                    style={{ color: m.color, background: m.bg }}>{m.label}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t.description}</p>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Guarantee</p>
                    <p className="text-sm font-bold text-slate-700 mt-0.5">{t.guarantee} <span className="text-xs font-normal text-slate-400">{t.guarantee_unit}</span></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Tested</p>
                    <p className="text-sm font-bold mt-0.5" style={{ color: t.tested_value ? m.color : '#94a3b8' }}>
                      {t.tested_value ?? 'Pending'} {t.tested_value && <span className="text-xs font-normal" style={{ color: '#94a3b8' }}>{t.guarantee_unit}</span>}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Deviation</p>
                    <div className="mt-0.5"><DeviationBadge pct={t.deviation_pct} /></div>
                  </div>
                </div>

                {t.test_date && (
                  <p className="text-xs text-slate-400 mt-3">Test date: {t.test_date}</p>
                )}
                {t.retest_required && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">{t.retest_note ?? 'Retest required'}</p>
                )}
              </div>
              <button type="button" onClick={() => setExpanded(isOpen ? null : t.id)}
                className="w-full flex items-center justify-center gap-1 py-2 border-t border-slate-100 text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                {isOpen ? <><ChevronUp size={12} /> Hide details</> : <><ChevronDown size={12} /> Show details</>}
              </button>
              {isOpen && (
                <div className="px-5 pb-4 space-y-2 text-xs text-slate-600 bg-slate-50/50">
                  <p><span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Test Method: </span>Performance test per contract schedule of guarantees; continuous 4-hour measurement period</p>
                  <p><span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Conditions: </span>ISO ambient: 15°C, 1.013 bar, 60% RH; measured and corrected per ASME PTC 46</p>
                  <p><span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Instrumentation: </span>Calibrated instruments with traceable certificates within 12-month validity</p>
                  {t.retest_required && <p><span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Retest Protocol: </span>{t.retest_note}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
