'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ChevronDown, ChevronRight, Lock, ShieldCheck, ArrowRight } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import type { VGateProgress } from '@/lib/db/types'
import type { SignoffRow } from '@/lib/db/queries'
import { openGateReview, signGate, unsignGate, approveGate } from '@/app/actions/team'
import { cn } from '@/lib/utils'

interface Props {
  gates: VGateProgress[]
  signoffsByGate: Record<string, SignoffRow[]>
  myRoleIds: string[]
  isPrivileged: boolean
}

const STATUS_PILL: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground border-border',
  in_review: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-300',
  approved: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-300',
  rejected: 'bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-300',
  conditional: 'bg-sky-500/15 text-sky-600 border-sky-500/30 dark:text-sky-300',
}

const LETTER_STYLE: Record<string, string> = {
  'A/R': 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900',
  A: 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900',
  R: 'bg-blue-600 text-white',
  C: 'bg-muted-foreground/30 text-foreground',
  I: 'bg-sky-200 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100',
}

export function GatesBoard({ gates, signoffsByGate, myRoleIds, isPrivileged }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = React.useTransition()
  const [expanded, setExpanded] = React.useState<string | null>(
    gates.find((g) => g.status === 'in_review')?.phase_gate_id ?? null,
  )

  const myRoles = React.useMemo(() => new Set(myRoleIds), [myRoleIds])

  function run(fn: () => Promise<{ error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn()
      if (res?.error) toast({ title: 'Action blocked', description: res.error, variant: 'danger' })
      else {
        toast({ title: okMsg, variant: 'success' })
        router.refresh()
      }
    })
  }

  // Legacy detection: canonical projects have 8 phase_gates rows.
  if (gates.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Legacy gate set</p>
        <p className="mt-1">
          This project predates the canonical 8-gate model and is managed by the classic phase
          stepper on the project page.
        </p>
      </div>
    )
  }

  const nextByNumber = new Map(gates.map((g) => [g.phase_number, g]))

  return (
    <div className="space-y-3">
      {gates.map((g) => {
        const rows = signoffsByGate[g.phase_gate_id] ?? []
        const isOpen = expanded === g.phase_gate_id
        const pct = g.total_signoffs > 0 ? Math.round((g.signed_count / g.total_signoffs) * 100) : 0
        const nextGate = nextByNumber.get(g.phase_number + 1)

        return (
          <div key={g.phase_gate_id} className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted font-mono text-sm font-semibold text-foreground">
                G{g.phase_number}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{g.phase_name}</span>
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                      STATUS_PILL[g.status] ?? STATUS_PILL.pending,
                    )}
                  >
                    {g.status.replace('_', ' ')}
                  </span>
                  {g.ready_to_approve && g.status === 'in_review' && (
                    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" /> Ready
                    </span>
                  )}
                </div>
                {g.total_signoffs > 0 && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 w-40 max-w-[45vw] overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {g.signed_count}/{g.total_signoffs} signed
                    </span>
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {g.status === 'pending' && (
                  <button
                    disabled={pending}
                    onClick={() => run(() => openGateReview({ phaseGateId: g.phase_gate_id, projectId: g.project_id }), 'Gate opened for review')}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
                  >
                    Open review
                  </button>
                )}
                {g.status === 'in_review' && (
                  <button
                    disabled={pending || !g.ready_to_approve}
                    onClick={() => run(() => approveGate({ phaseGateId: g.phase_gate_id, projectId: g.project_id }), 'Gate approved')}
                    title={g.ready_to_approve ? 'Approve this gate' : 'All sign-offs must be complete first'}
                    className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {!g.ready_to_approve && <Lock className="h-3 w-3" aria-hidden="true" />}
                    Approve gate
                  </button>
                )}
                {g.status === 'approved' && nextGate && nextGate.status === 'pending' && (
                  <button
                    disabled={pending}
                    onClick={() => run(() => openGateReview({ phaseGateId: nextGate.phase_gate_id, projectId: g.project_id }), `G${nextGate.phase_number} activated`)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
                  >
                    Activate G{nextGate.phase_number}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
                {rows.length > 0 && (
                  <button
                    onClick={() => setExpanded(isOpen ? null : g.phase_gate_id)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={isOpen ? 'Hide roster' : 'Show roster'}
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>

            {isOpen && rows.length > 0 && (
              <div className="divide-y divide-border/60 border-t border-border">
                {rows.map((r) => {
                  const canSign = (myRoles.has(r.role_id) || isPrivileged) && g.status === 'in_review'
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded px-1.5 text-[11px] font-semibold',
                          LETTER_STYLE[r.letter] ?? LETTER_STYLE.C,
                        )}
                      >
                        {r.letter}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-foreground">
                          {r.role_code} · {r.role_title}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.person_name ?? 'Unassigned'}
                          {r.is_approver && <span className="ml-2 text-primary">· approver</span>}
                        </div>
                      </div>
                      {r.status === 'signed' ? (
                        <button
                          disabled={pending}
                          onClick={() => run(() => unsignGate({ signoffId: r.id, projectId: g.project_id }), 'Signature removed')}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-300"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Signed
                        </button>
                      ) : (
                        <button
                          disabled={pending || !canSign}
                          onClick={() => run(() => signGate({ signoffId: r.id, projectId: g.project_id }), 'Signed')}
                          title={canSign ? 'Sign for this role' : 'Only the assigned role holder can sign'}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Circle className="h-3.5 w-3.5" aria-hidden="true" /> Sign
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
