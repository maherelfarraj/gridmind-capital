'use client'
import * as React from 'react'
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { cn } from '@/lib/utils'
import { MOCK_SCREENING } from './data'

const RESULT_META = {
  pass:        { label: 'Pass',        color: '#22c55e', icon: CheckCircle2 },
  conditional: { label: 'Conditional', color: '#f59e0b', icon: AlertCircle  },
  fail:        { label: 'Fail',        color: '#ef4444', icon: XCircle      },
}

export function ScreeningTab() {
  const totalScore = MOCK_SCREENING.reduce((a, s) => a + s.score, 0)
  const maxScore   = MOCK_SCREENING.reduce((a, s) => a + s.max_score, 0)
  const pct        = Math.round((totalScore / maxScore) * 100)
  const passes     = MOCK_SCREENING.filter((s) => s.result === 'pass').length
  const conds      = MOCK_SCREENING.filter((s) => s.result === 'conditional').length
  const fails      = MOCK_SCREENING.filter((s) => s.result === 'fail').length

  const chartData = MOCK_SCREENING.map((s) => ({
    name: s.id,
    score: s.score,
    max: s.max_score,
    color: RESULT_META[s.result].color,
  }))

  return (
    <div className="space-y-6">
      {/* Score summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Score', value: `${totalScore}/${maxScore}`, sub: `${pct}%`, color: pct >= 80 ? '#22c55e' : '#f59e0b' },
          { label: 'Passed',      value: passes,  sub: `${passes} criteria`,  color: '#22c55e' },
          { label: 'Conditional', value: conds,   sub: `${conds} criteria`,   color: '#f59e0b' },
          { label: 'Failed',      value: fails,   sub: `${fails} criteria`,   color: '#ef4444' },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{k.label}</p>
            <p className="text-2xl font-black" style={{ color: k.color }}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Score bar chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Score per Criterion</p>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 10]} hide />
            <ReferenceLine y={10} stroke="#1e293b" strokeDasharray="2 2" />
            <Tooltip formatter={(v) => [v, '']}
              contentStyle={{ fontSize: 11, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
            <Bar dataKey="score" radius={[4, 4, 0, 0]}>
              {chartData.map((d) => <Cell key={d.name} fill={d.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Criteria table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-semibold">Criterion</th>
              <th className="px-4 py-2.5 text-left font-semibold">Category</th>
              <th className="px-4 py-2.5 text-center font-semibold">Score</th>
              <th className="px-4 py-2.5 text-left font-semibold">Result</th>
              <th className="px-4 py-2.5 text-left font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_SCREENING.map((s) => {
              const meta = RESULT_META[s.result]
              const Icon = meta.icon
              return (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 text-foreground font-medium max-w-[200px]">{s.criterion}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">{s.category}</span></td>
                  <td className="px-4 py-3 text-center font-bold" style={{ color: meta.color }}>{s.score}/{s.max_score}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap" style={{ color: meta.color }}>
                      <Icon className="size-3.5" />{meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px]">{s.notes}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
