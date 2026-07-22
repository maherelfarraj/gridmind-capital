'use client'

import Link from 'next/link'
import { FileText, ChevronRight } from 'lucide-react'
import type { PortalPO } from '@/app/actions/portal'
import { fmtMoney, fmtDate, StatusPill, PO_STATUS_STYLES } from './portal-utils'

export function PortalPosList({ pos }: { pos: PortalPO[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Purchase Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchase orders issued to your organization. Acknowledge new orders and track delivery.
        </p>
      </div>

      {pos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <FileText className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm text-muted-foreground">No purchase orders have been issued to your organization yet.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">PO #</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Delivery</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po.id} className="border-b border-border last:border-0 transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/portal/pos/${po.id}`} className="font-semibold text-primary hover:underline">
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{po.project_code}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-foreground">{po.description ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">{fmtMoney(po.amount, po.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(po.delivery_date)}</td>
                    <td className="px-4 py-3"><StatusPill status={po.status} styles={PO_STATUS_STYLES} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/portal/pos/${po.id}`} className="inline-flex text-muted-foreground hover:text-foreground">
                        <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {pos.map((po) => (
              <Link
                key={po.id}
                href={`/portal/pos/${po.id}`}
                className="block rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">{po.po_number}</span>
                  <StatusPill status={po.status} styles={PO_STATUS_STYLES} />
                </div>
                <p className="mt-2 text-sm text-foreground">{po.description ?? '—'}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{po.project_code}</span>
                  <span className="font-medium text-foreground">{fmtMoney(po.amount, po.currency)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
