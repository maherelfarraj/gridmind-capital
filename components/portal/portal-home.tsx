'use client'

import Link from 'next/link'
import { FileText, Receipt, CheckCircle2, ClipboardList, MapPin, ArrowRight, Zap } from 'lucide-react'
import type { PortalHome as PortalHomeData } from '@/app/actions/portal'

const KPIS = [
  { key: 'openPos', label: 'Open POs', icon: FileText, href: '/portal/pos' },
  { key: 'invoicesSubmitted', label: 'Invoices Submitted', icon: Receipt, href: '/portal/invoices' },
  { key: 'invoicesPaid', label: 'Invoices Paid', icon: CheckCircle2, href: '/portal/invoices' },
  { key: 'pendingRfqs', label: 'Pending RFQs', icon: ClipboardList, href: '/portal/rfqs' },
] as const

export function PortalHome({ home }: { home: PortalHomeData | null }) {
  if (!home) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">Unable to load your portal. Please contact your GridMind Capital representative.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <p className="text-sm text-muted-foreground">Welcome back{home.fullName ? `, ${home.fullName.split(' ')[0]}` : ''}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground text-balance">
          {home.organizationName || 'Partner'} — Project Dashboard
        </h1>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon
          const value = home.kpis[kpi.key]
          return (
            <Link
              key={kpi.key}
              href={kpi.href}
              className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <Icon className="size-5 text-muted-foreground" aria-hidden />
                <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums text-foreground">{value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{kpi.label}</p>
            </Link>
          )
        })}
      </div>

      {/* Granted projects */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Your Projects</h2>
        {home.projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              You have not been granted access to any projects yet. Your GridMind Capital
              contact will notify you once access is assigned.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {home.projects.map((p) => (
              <div key={p.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">{p.code}</p>
                    <h3 className="mt-1 font-semibold text-foreground text-pretty">{p.name}</h3>
                  </div>
                  <span className="rounded-md bg-muted p-2">
                    <Zap className="size-4 text-muted-foreground" aria-hidden />
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {p.technology && <span>{p.technology}</span>}
                  {p.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      {p.location}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
