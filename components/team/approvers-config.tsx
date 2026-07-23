'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Shield, RotateCcw, Check } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { setProjectGateApprover, clearProjectGateApprover } from '@/app/actions/team'
import type { GateApproverConfigRow } from '@/lib/db/queries'

export function ApproversConfig({
  projectId,
  config,
  roles,
}: {
  projectId: string | null
  config: GateApproverConfigRow[]
  roles: { code: string; title: string }[]
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium">Gate</th>
            <th className="px-4 py-3 font-medium">Effective primary approver</th>
            <th className="px-4 py-3 font-medium">Secondary</th>
            <th className="px-4 py-3 font-medium">Required roles</th>
            {projectId && <th className="px-4 py-3 font-medium">Override</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {config.map((row) => (
            <GateRow key={row.gate_number} row={row} projectId={projectId} roles={roles} />
          ))}
        </tbody>
      </table>
      {!projectId && (
        <p className="border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          Showing tenant-wide defaults. Select a project above to set per-project overrides.
        </p>
      )}
    </div>
  )
}

function GateRow({
  row,
  projectId,
  roles,
}: {
  row: GateApproverConfigRow
  projectId: string | null
  roles: { code: string; title: string }[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [primary, setPrimary] = useState(row.override_primary ?? row.default_primary ?? '')
  const [secondary, setSecondary] = useState(row.override_secondary ?? row.default_secondary ?? '')

  const hasOverride = row.override_primary !== null
  const effectivePrimary = row.override_primary ?? row.default_primary
  const effectiveSecondary = row.override_secondary ?? row.default_secondary

  function save() {
    if (!projectId) return
    if (!primary) {
      toast({ title: 'Primary approver required', variant: 'danger' })
      return
    }
    startTransition(async () => {
      const res = await setProjectGateApprover({
        projectId,
        gateNumber: row.gate_number,
        primaryRole: primary,
        secondaryRole: secondary || null,
      })
      if (res.error) toast({ title: 'Could not save override', description: res.error, variant: 'danger' })
      else {
        toast({ title: `${row.gate_code} approver updated`, variant: 'success' })
        setEditing(false)
        router.refresh()
      }
    })
  }

  function reset() {
    if (!projectId) return
    startTransition(async () => {
      const res = await clearProjectGateApprover({ projectId, gateNumber: row.gate_number })
      if (res.error) toast({ title: 'Could not reset', description: res.error, variant: 'danger' })
      else {
        toast({ title: `${row.gate_code} reverted to default`, variant: 'success' })
        setEditing(false)
        router.refresh()
      }
    })
  }

  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-foreground">{row.gate_code}</div>
        <div className="text-xs text-muted-foreground">{row.gate_name}</div>
      </td>

      <td className="px-4 py-3">
        {editing && projectId ? (
          <select
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="">— select —</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} — {r.title}
              </option>
            ))}
          </select>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {effectivePrimary ?? '—'}
            {hasOverride && (
              <span className="ms-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                override
              </span>
            )}
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        {editing && projectId ? (
          <select
            value={secondary}
            onChange={(e) => setSecondary(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="">— none —</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.code} — {r.title}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-muted-foreground">{effectiveSecondary ?? '—'}</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {row.required_roles.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            row.required_roles.map((rc) => (
              <span
                key={rc}
                className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {rc}
              </span>
            ))
          )}
        </div>
      </td>

      {projectId && (
        <td className="px-4 py-3">
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={pending}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <Check className="h-3 w-3" aria-hidden="true" /> Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={pending}
                className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-muted"
              >
                Edit
              </button>
              {hasOverride && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                  title="Revert to tenant default"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" /> Reset
                </button>
              )}
            </div>
          )}
        </td>
      )}
    </tr>
  )
}
