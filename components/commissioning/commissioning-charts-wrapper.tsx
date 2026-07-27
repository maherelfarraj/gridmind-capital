'use client'

import {
  BarChart, Bar, PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

interface CommissioningChartsWrapperProps {
  systemData: Array<{ system: string; total: number; passed: number; failed: number }>
  statusData: Array<{ name: string; value: number; fill: string }>
}

export default function CommissioningChartsWrapper({ systemData, statusData }: CommissioningChartsWrapperProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* By system */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold mb-3">Test Results by System</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={systemData.length ? systemData : [
            { system: 'DC Collection', total: 8, passed: 6, failed: 1 },
            { system: 'Inverter Station', total: 6, passed: 3, failed: 2 },
            { system: 'SCADA', total: 4, passed: 2, failed: 0 },
            { system: 'Grid Connection', total: 4, passed: 1, failed: 1 },
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="system" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="passed" name="Passed" fill="#22c55e" stackId="a" />
            <Bar dataKey="failed" name="Failed" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Status donut */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold mb-3">Test Status Distribution</p>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
              {statusData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
