'use client'

import { Loader2 } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type ConstructionData = {
  totalWPs?: number
  wpByDiscipline?: Array<{ name: string; planned: number; actual: number }>
  punchByCategory?: Array<{ name: string; value: number; color: string }>
  workPackages?: Array<any>
  inspections?: Array<any>
  openPunches?: number
}

interface ConstructionChartsWrapperProps {
  data: ConstructionData | undefined
  isLoading: boolean
}

export default function ConstructionChartsWrapper({ data, isLoading }: ConstructionChartsWrapperProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Planned vs Actual by Discipline</CardTitle></CardHeader>
        <CardContent className="h-52">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" />Loading…</div>
          ) : (data?.wpByDiscipline?.length ?? 0) === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No data — seed demo first</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data!.wpByDiscipline} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v}%`, '']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="planned" name="Planned %" fill="#64748b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actual"  name="Actual %"  fill="#64ffda" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Punch List by Category</CardTitle></CardHeader>
        <CardContent className="h-52">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm gap-2"><Loader2 className="size-4 animate-spin" />Loading…</div>
          ) : (data?.punchByCategory?.every((p) => p.value === 0) ?? true) ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No punch items</div>
          ) : (data?.punchByCategory && data.punchByCategory.length > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.punchByCategory.filter((p) => p.value > 0)} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={72}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${(name ?? '').split('(')[0]} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {data.punchByCategory.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
