'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/ui/toast'
import type { VGateProgress } from '@/lib/db/types'
import type { SignoffRow } from '@/lib/db/queries'
import { openGateReview, signGate, unsignGate, approveGate } from '@/app/actions/team'

interface Props {
  projects: { id: string; code: string; name: string }[]
  selectedId: string | null
  gates: VGateProgress[]
  signoffsByGate: Record<string, SignoffRow[]>
}

const LETTER_STYLES: Record<string, string> = {
  'A/R': 'bg-[#64ffda]/20 text-[#64ffda] border-[#64ffda]/40',
  A: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  R: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
  C: 'bg-slate-400/10 text-slate-300 border-slate-400/25',
  I: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
}

export function SignoffsBoard({ projects, selectedId, gates, signoffsByGate }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [pending, startTransition] = React.useTransition()
  const [expanded, setExpanded] = React.useState<string | null>(
    gates.find((g) => g.status === 'in_review')?.phase_gate_id ?? null,
  )

  function selectProject(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('project', id)
    router.push(`/team/signoffs?${params.toString()}`)
  }

  function run(fn: () => Promise<{ error?: string }>, okMsg: string) {
    startTransition(async () => {
      const res = await fn()
      if (res?.error) {
        toast({ title: 'Action blocked', description: res.error, variant: 'danger' })
      } else {
        toast({ title: okMsg, variant: 'success' })
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-[#e6f1ff]">Gate Sign-offs</h1>
        <p className="text-sm text-[#8892b0]">
          Governance-enforced approvals. A gate cannot be approved until every required sign-off is
          complete.
        </p>
      </header>

      {/* Project picker */}
      <div className="flex flex-wrap gap-2">
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => selectProject(p.id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              p.id === selectedId
                ? 'border-[#64ffda]/40 bg-[#64ffda]/10 text-[#64ffda]'
                : 'border-[#1e3a5f] bg-[#112240] text-[#8892b0] hover:text-[#e6f1ff]'
            }`}
          >
            {p.code}
          </button>
        ))}
      </div>

      {/* Gate list */}
      <div className="space-y-3">
        {gates.map((g) => {
          const rows = signoffsByGate[g.phase_gate_id] ?? []
          const isOpen = expanded === g.phase_gate_id
          const pct = g.total_signoffs > 0 ? Math.round((g.signed_count / g.total_signoffs) * 100) : 0
          return (
            <div
              key={g.phase_gate_id}
              className="rounded-lg border border-[#1e3a5f] bg-[#112240] overflow-hidden"
            >
              <div className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#64ffda]">G{g.phase_number}</span>
                    <span className="truncate text-sm font-medium text-[#e6f1ff]">
                      {g.phase_name}
                    </span>
                    <StatusPill status={g.status} />
                  </div>
                  {g.total_signoffs > 0 && (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[#0a192f]">
                        <div
                          className="h-full rounded-full bg-[#64ffda] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-[#8892b0]">
                        {g.signed_count}/{g.total_signoffs} signed
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {g.status === 'pending' && (
                    <button
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            openGateReview({
                              phaseGateId: g.phase_gate_id,
                              projectId: g.project_id,
                            }),
                          'Gate opened for review',
                        )
                      }
                      className="rounded-md border border-[#1e3a5f] bg-[#0a192f] px-3 py-1.5 text-xs font-medium text-[#e6f1ff] hover:border-[#64ffda]/40 disabled:opacity-50"
                    >
                      Open review
                    </button>
                  )}
                  {g.status === 'in_review' && (
                    <button
                      disabled={pending || !g.ready_to_approve}
                      onClick={() =>
                        run(
                          () =>
                            approveGate({
                              phaseGateId: g.phase_gate_id,
                              projectId: g.project_id,
                            }),
                          'Gate approved',
                        )
                      }
                      title={g.ready_to_approve ? '' : 'All sign-offs must be complete first'}
                      className="rounded-md border border-[#64ffda]/40 bg-[#64ffda]/10 px-3 py-1.5 text-xs font-medium text-[#64ffda] hover:bg-[#64ffda]/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Approve gate
                    </button>
                  )}
                  {rows.length > 0 && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : g.phase_gate_id)}
                      className="rounded-md px-2 py-1.5 text-xs text-[#8892b0] hover:text-[#e6f1ff]"
                    >
                      {isOpen ? 'Hide' : 'Details'}
                    </button>
                  )}
                </div>
              </div>

              {/* Sign-off rows */}
              {isOpen && rows.length > 0 && (
                <div className="border-t border-[#1e3a5f] divide-y divide-[#1e3a5f]/60">
                  {rows.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span
                        className={`inline-flex h-6 min-w-[2rem] items-center justify-center rounded border px-1.5 text-[11px] font-semibold ${
                          LETTER_STYLES[r.letter] ?? LETTER_STYLES.C
                        }`}
                      >
                        {r.letter}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm text-[#e6f1ff]">{r.role_title}</div>
                        <div className="truncate text-xs text-[#8892b0]">
                          {r.person_name ?? 'Unassigned'}
                          {r.is_approver && (
                            <span className="ml-2 text-[#64ffda]">· approver</span>
                          )}
                        </div>
                      </div>
                      {r.status === 'signed' ? (
                        <button
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => unsignGate({ signoffId: r.id, projectId: g.project_id }),
                              'Signature removed',
                            )
                          }
                          className="rounded-md border border-[#64ffda]/40 bg-[#64ffda]/10 px-2.5 py-1 text-xs font-medium text-[#64ffda] disabled:opacity-50"
                        >
                          Signed
                        </button>
                      ) : (
                        <button
                          disabled={pending || g.status !== 'in_review'}
                          onClick={() =>
                            run(
                              () => signGate({ signoffId: r.id, projectId: g.project_id }),
                              'Signed',
                            )
                          }
                          className="rounded-md border border-[#1e3a5f] bg-[#0a192f] px-2.5 py-1 text-xs font-medium text-[#8892b0] hover:text-[#e6f1ff] disabled:opacity-40"
                        >
                          Sign
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        {gates.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#1e3a5f] p-8 text-center text-sm text-[#8892b0]">
            No gates found for this project.
          </p>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-slate-400/10 text-slate-400 border-slate-400/20',
    in_review: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    approved: 'bg-[#64ffda]/15 text-[#64ffda] border-[#64ffda]/30',
    rejected: 'bg-rose-400/15 text-rose-300 border-rose-400/30',
    conditional: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
  }
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        map[status] ?? map.pending
      }`}
    >
      {status.replace('_', ' ')}
    </span>
  )
}
