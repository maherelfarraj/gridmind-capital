'use client'

import useSWR from 'swr'
import Link from 'next/link'
import { ShieldCheck, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import { canDischargeGuarantees, type GuaranteeType } from '@/app/actions/guarantees'

const TYPE_LABEL: Record<GuaranteeType, string> = {
  bid_bond: 'Bid Bond',
  performance_bond: 'Performance Bond',
  advance_payment_guarantee: 'Advance Payment Guarantee',
  retention_bond: 'Retention Bond',
}

/**
 * G6 closeout gate: the "Bank guarantees discharged" deliverable can only be
 * marked complete once every guarantee is released or expired.
 */
export function GuaranteesCloseoutCard({ projectId }: { projectId: string }) {
  const { data, isLoading } = useSWR(
    ['g6-guarantees-discharge', projectId],
    () => canDischargeGuarantees(projectId),
  )

  const ok = data?.ok ?? false
  const outstanding = data?.outstanding ?? []

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`p-2 rounded-lg ${ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : ok ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Bank guarantees discharged</p>
            <p className="text-xs text-slate-500">Closeout deliverable — all guarantees must be released or expired.</p>
          </div>
        </div>
        <Link
          href={`/projects/${projectId}/finance`}
          className="flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 whitespace-nowrap"
        >
          Finance registers <ExternalLink size={12} />
        </Link>
      </div>

      <div className="mt-3">
        {isLoading ? (
          <p className="text-xs text-slate-400">Checking guarantees…</p>
        ) : ok ? (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span className="text-xs font-medium text-emerald-700">
              Requirement satisfied — deliverable can be marked complete.
            </span>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle size={14} />
              <span className="text-xs font-semibold">
                Blocked — {outstanding.length} guarantee(s) still outstanding.
              </span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {outstanding.map((g) => (
                <li key={g.id} className="flex items-center justify-between text-xs text-amber-700/90">
                  <span>{TYPE_LABEL[g.type]}</span>
                  <span className="capitalize rounded-full bg-amber-100 px-2 py-0.5">{g.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!ok}
        className={`mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
          ok
            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
        }`}
      >
        {ok ? 'Mark “Bank guarantees discharged” complete' : 'Discharge guarantees to enable'}
      </button>
    </div>
  )
}
