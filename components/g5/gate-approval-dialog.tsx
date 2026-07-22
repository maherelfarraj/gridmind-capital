'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { getOpenNcrsForProject } from '@/app/actions/ncrs'
import { advanceProjectGate } from '@/app/actions/phase-gates'

/**
 * "Submit for Gate Approval" button + dialog for G5 (PAC).
 * Enforces the rule that G5 cannot be submitted while any NCR is not Closed:
 * lists the blocking NCR numbers and disables the confirm button.
 * Server-side enforcement also lives in advanceProjectGate as a hard guard.
 */
export function G5GateApprovalButton({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const { data, isLoading, mutate } = useSWR(
    open ? `g5-open-ncrs-${projectId}` : null,
    () => getOpenNcrsForProject(projectId),
  )

  const blocking = data?.blocking ?? false
  const openNcrs = data?.open ?? []

  async function handleSubmit() {
    setBusy(true)
    const res = await advanceProjectGate(projectId)
    setBusy(false)
    if (res.error) {
      toast({ title: 'Gate approval blocked', description: res.error, variant: 'danger' })
      mutate()
      return
    }
    toast({ title: 'G5 approved', description: `Project advanced to ${res.newGate}.`, variant: 'success' })
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#64ffda]/10 border border-[#64ffda]/30 text-sm font-medium text-[#64ffda] hover:bg-[#64ffda]/20 transition-colors"
      >
        <CheckCircle2 className="size-4" /> Submit for Gate Approval
      </button>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit G5 (PAC) for gate approval</DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Checking non-conformance reports…
              </div>
            )}

            {!isLoading && blocking && (
              <div className="rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium text-sm">
                  <ShieldAlert className="size-4" />
                  Gate approval blocked — {openNcrs.length} NCR(s) not closed
                </div>
                <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1">
                  All non-conformance reports must be Closed before G5 can be submitted for approval.
                </p>
                <ul className="mt-3 space-y-1.5">
                  {openNcrs.map((n) => (
                    <li key={n.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link
                        href={`/projects/${projectId}/ncrs/${n.id}`}
                        className="font-medium text-red-700 dark:text-red-300 hover:underline"
                      >
                        {n.ncr_number}
                      </Link>
                      <span className="text-xs text-muted-foreground line-clamp-1 flex-1">{n.title}</span>
                      <span className="text-xs rounded-full bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 px-2 py-0.5 capitalize">
                        {n.status.replace('_', ' ')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isLoading && !blocking && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-medium text-sm">
                  <CheckCircle2 className="size-4" /> All NCRs closed
                </div>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                  No open non-conformance reports. G5 can be submitted for gate approval.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={busy || isLoading || blocking}>
              {busy ? 'Submitting…' : 'Approve G5'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
