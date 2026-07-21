'use client'

import React from 'react'
import { X, Award, CheckCircle } from 'lucide-react'
import {
  BarChart, Bar, PieChart, Pie, Cell, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { type MCCertificate, type CertStatus } from './types'
import { CERT_STATUS } from './data'
import { StatusBadge, KpiCard } from './shared'

export function MCCertificatesTab({ certs }: { certs: MCCertificate[] }) {
  const [issueOpen, setIssueOpen] = React.useState(false)

  const issued  = certs.filter((c) => c.status === 'issued').length
  const pending = certs.filter((c) => c.status === 'pending').length
  const certData = (Object.keys(CERT_STATUS) as CertStatus[]).map((s) => ({
    name: CERT_STATUS[s].label, value: certs.filter((c) => c.status === s).length, color: CERT_STATUS[s].color,
  }))

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total Certs"  value={certs.length} />
        <KpiCard label="Issued"       value={issued}   color="#22c55e" />
        <KpiCard label="Pending"      value={pending}  color="#f59e0b" />
        <KpiCard label="MC Complete"  value={`${Math.round(issued / certs.length * 100)}%`} color="#64ffda" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Certificate Status</p>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={certData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60}
                label={({ name, percent }) => `${(name ?? '').slice(0, 4)} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false} fontSize={9}>
                {certData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Outstanding Items by System</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart
              data={certs.map((c) => ({ system: c.system.split(' ')[0], punch: c.punch_outstanding, ncr: c.ncr_outstanding }))}
              margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="system" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="punch" name="Punch Items" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ncr"   name="NCRs"        fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex justify-end">
        <button type="button" onClick={() => setIssueOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-medium text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors">
          <Award className="size-4" /> Issue MC Certificate
        </button>
      </div>

      {/* Register table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Cert No.', 'System', 'Discipline', 'Status', 'Issued Date', 'Issued By', 'MC Coordinator', 'Open Punch', 'Open NCRs', 'Comments'].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {certs.map((cert) => {
              const cs = CERT_STATUS[cert.status]
              return (
                <tr key={cert.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-[#64ffda]">{cert.cert_number}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{cert.system}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{cert.discipline}</td>
                  <td className="px-4 py-3"><StatusBadge {...cs} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{cert.issued_date ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{cert.issued_by}</td>
                  <td className="px-4 py-3 text-xs text-foreground">{cert.mc_coordinator}</td>
                  <td className="px-4 py-3 text-center">
                    {cert.punch_outstanding > 0
                      ? <span className="text-[11px] font-bold text-amber-400">{cert.punch_outstanding}</span>
                      : <CheckCircle className="size-4 text-[#22c55e] mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {cert.ncr_outstanding > 0
                      ? <span className="text-[11px] font-bold text-red-400">{cert.ncr_outstanding}</span>
                      : <CheckCircle className="size-4 text-[#22c55e] mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate" title={cert.comments}>{cert.comments}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Issue cert modal */}
      {issueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setIssueOpen(false)} />
          <div className="relative bg-background border border-border rounded-2xl w-full max-w-[480px] shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Issue MC Certificate</h3>
              <button type="button" onClick={() => setIssueOpen(false)}><X className="size-4 text-muted-foreground" /></button>
            </div>
            {[
              { label: 'Certificate Number', placeholder: 'e.g. MCC-2026-006' },
              { label: 'System / Scope',     placeholder: 'e.g. PV Array — Blocks A-D' },
              { label: 'MC Coordinator',     placeholder: 'Name' },
              { label: 'Issued By',          placeholder: 'Name / Organisation' },
              { label: 'Issue Date',         placeholder: 'YYYY-MM-DD', type: 'date' },
            ].map(({ label, placeholder, type }) => (
              <div key={label}>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{label}</label>
                <input type={type ?? 'text'} placeholder={placeholder}
                  className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#64ffda]/30" />
              </div>
            ))}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Remarks</label>
              <textarea rows={3} placeholder="Any outstanding observations or conditions..."
                className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none resize-none focus:ring-2 focus:ring-[#64ffda]/30" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setIssueOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={() => setIssueOpen(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-semibold text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors">
                Issue Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
