'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Building2, ShieldCheck, ExternalLink, ChevronRight, Search,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, ArrowUpRight,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/toast'
import { ExcelExportButton } from '@/components/shared/excel-export-button'
import {
  changeUserHomeRole,
  saveGateApproverDefault,
  runRulesHealthCheck,
  type RuleResult,
} from '@/app/actions/team'
import type {
  OrgDirectory,
  DirectoryUser,
  GateApproverConfigRow,
  ApprovalMatrixRow,
} from '@/lib/db/queries'

type RoleLite = { id: string; code: string; title: string }
type Lite = { code: string; name: string }

export function RolesFlowWorkspace(props: {
  directory: OrgDirectory
  approverDefaults: GateApproverConfigRow[]
  matrix: ApprovalMatrixRow[]
  roles: RoleLite[]
  departments: Lite[]
  projects: { id: string; code: string; name: string }[]
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-balance text-2xl font-semibold text-foreground">Roles &amp; Approval Flow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Organization directory, gate approval configuration, the authority matrix, and governance health checks.
        </p>
      </header>

      <Tabs defaultValue="directory">
        <TabsList className="mb-5 flex-wrap">
          <TabsTrigger value="directory">Organization</TabsTrigger>
          <TabsTrigger value="flow">Approval Flow</TabsTrigger>
          <TabsTrigger value="matrix">Approval Matrix</TabsTrigger>
          <TabsTrigger value="health">Rules Health</TabsTrigger>
        </TabsList>

        <TabsContent value="directory">
          <DirectoryTab directory={props.directory} roles={props.roles} />
        </TabsContent>
        <TabsContent value="flow">
          <FlowTab defaults={props.approverDefaults} roles={props.roles} projects={props.projects} />
        </TabsContent>
        <TabsContent value="matrix">
          <MatrixTab matrix={props.matrix} departments={props.departments} />
        </TabsContent>
        <TabsContent value="health">
          <HealthTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ── Tab 1: Organization Directory ─────────────────────────── */

function DirectoryTab({ directory, roles }: { directory: OrgDirectory; roles: RoleLite[] }) {
  const [openDept, setOpenDept] = useState<string | null>(directory.departments[0]?.code ?? null)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section aria-label="Staff departments" className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Staff departments ({directory.departments.length})
        </h2>
        {directory.departments.map((d) => {
          const open = openDept === d.code
          return (
            <Card key={d.code} className="overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenDept(open ? null : d.code)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
                aria-expanded={open}
              >
                <span className="flex items-center gap-3">
                  <Building2 className="size-5 text-muted-foreground" aria-hidden />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{d.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {d.code} · {d.roles.length} role{d.roles.length === 1 ? '' : 's'} · {d.headcount} staff
                    </span>
                  </span>
                </span>
                <ChevronRight
                  className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
                  aria-hidden
                />
              </button>
              {open && (
                <div className="border-t border-border px-4 py-3">
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {d.roles.map((r) => (
                      <Badge key={r.id} variant="secondary" className="font-mono text-[11px]">
                        {r.code}
                      </Badge>
                    ))}
                  </div>
                  {d.users.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No staff assigned a home role here yet.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {d.users.map((u) => (
                        <UserRow key={u.id} user={u} roles={roles} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </section>

      <aside className="space-y-6">
        <Card className="p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden /> Governance
          </h3>
          <p className="mb-3 text-xs text-muted-foreground">
            Gate Approver is a per-gate capacity, not a department.
          </p>
          {directory.governance.length === 0 ? (
            <p className="text-xs text-muted-foreground">No governance users.</p>
          ) : (
            <ul className="space-y-2">
              {directory.governance.map((u) => (
                <li key={u.id} className="text-sm text-foreground">
                  {u.full_name}
                  {u.email && <span className="block text-xs text-muted-foreground">{u.email}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <h3 className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
            <ExternalLink className="size-4 text-amber-500" aria-hidden /> External — restricted access
          </h3>
          {directory.external.length === 0 ? (
            <p className="text-xs text-muted-foreground">No external users.</p>
          ) : (
            <ul className="space-y-2">
              {directory.external.map((u) => (
                <li key={u.id} className="text-sm text-foreground">
                  <span className="flex items-center gap-2">
                    {u.full_name}
                    {u.role === 'client_viewer' && (
                      <Badge variant="outline" className="text-[10px]">Issued reports only</Badge>
                    )}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {u.external_org ?? 'Unknown org'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </aside>
    </div>
  )
}

function UserRow({ user, roles }: { user: DirectoryUser; roles: RoleLite[] }) {
  const { toast } = useToast()
  const [pending, start] = useTransition()
  const [roleId, setRoleId] = useState(user.home_role_id ?? '')

  const options = useMemo(
    () => [
      { value: '', label: '— No home role —' },
      ...roles.map((r) => ({ value: r.id, label: `${r.code} · ${r.title}` })),
    ],
    [roles],
  )

  function onChange(next: string | null) {
    const nextId = next ?? ''
    setRoleId(nextId)
    start(async () => {
      const res = await changeUserHomeRole({ userId: user.id, roleId: nextId || null })
      if (res.error) {
        toast({ title: res.error, variant: 'danger' })
        setRoleId(user.home_role_id ?? '')
      } else {
        toast({ title: `Home role updated for ${user.full_name}`, variant: 'success' })
      }
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <div className="min-w-0">
        <span className="block truncate text-sm text-foreground">{user.full_name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {user.email ?? 'no email'}
          {user.last_active && ` · active ${new Date(user.last_active).toLocaleDateString()}`}
        </span>
      </div>
      <div className="w-52">
        <Select options={options} value={roleId} onValueChange={onChange} disabled={pending} />
      </div>
    </li>
  )
}

/* ── Tab 2: Approval Flow Visualizer ───────────────────────── */

function FlowTab({
  defaults,
  roles,
  projects,
}: {
  defaults: GateApproverConfigRow[]
  roles: RoleLite[]
  projects: { id: string; code: string; name: string }[]
}) {
  const [projectId, setProjectId] = useState('')
  const [perProject, setPerProject] = useState<GateApproverConfigRow[] | null>(null)
  const [loadingProject, startLoad] = useTransition()

  const roleOptions = useMemo(
    () => roles.map((r) => ({ value: r.code, label: `${r.code} · ${r.title}` })),
    [roles],
  )

  function loadProject(next: string | null) {
    const id = next ?? ''
    setProjectId(id)
    if (!id) {
      setPerProject(null)
      return
    }
    startLoad(async () => {
      // getGateApproverConfig is a server query; fetch via a lightweight route.
      const res = await fetch(`/api/team/gate-approvers?project=${id}`)
      if (res.ok) setPerProject((await res.json()) as GateApproverConfigRow[])
    })
  }

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <h2 className="mb-1 text-sm font-medium text-foreground">Canonical gate flow (G1–G8)</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          Deliverables flow into each gate; the gate approver signs off before the next phase opens.
        </p>
        <ol className="flex flex-wrap items-center gap-2">
          {defaults.map((g, i) => (
            <li key={g.gate_number} className="flex items-center gap-2">
              <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs">
                <span className="font-mono font-semibold text-foreground">{g.gate_code}</span>
                <span className="ms-1.5 text-muted-foreground">{g.gate_name}</span>
              </span>
              {i < defaults.length - 1 && <ChevronRight className="size-4 text-muted-foreground" aria-hidden />}
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-medium text-foreground">Tenant default approvers</h2>
        <div className="space-y-2">
          {defaults.map((g) => (
            <DefaultApproverRow key={g.gate_number} gate={g} roleOptions={roleOptions} />
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-foreground">View per project</h2>
          <div className="w-64">
            <Select
              options={[{ value: '', label: 'Select a project…' }, ...projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))]}
              value={projectId}
              onValueChange={loadProject}
            />
          </div>
        </div>
        {!projectId ? (
          <p className="text-xs text-muted-foreground">Pick a project to compare its overrides against the defaults.</p>
        ) : loadingProject ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pe-3">Gate</th>
                  <th className="py-2 pe-3">Default</th>
                  <th className="py-2 pe-3">Project override</th>
                  <th className="py-2">Required roles</th>
                </tr>
              </thead>
              <tbody>
                {(perProject ?? []).map((g) => {
                  const hasOverride = !!g.override_primary
                  const effective = g.override_primary ?? g.default_primary
                  const missing = g.required_roles.length > 0 && !effective
                  return (
                    <tr key={g.gate_number} className="border-b border-border/60">
                      <td className="py-2 pe-3 font-mono text-xs">{g.gate_code}</td>
                      <td className="py-2 pe-3 text-muted-foreground">
                        {g.default_primary ?? '—'}
                        {g.default_secondary && ` + ${g.default_secondary}`}
                      </td>
                      <td className={`py-2 pe-3 ${missing ? 'text-red-500' : hasOverride ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {hasOverride
                          ? `${g.override_primary}${g.override_secondary ? ` + ${g.override_secondary}` : ''}`
                          : missing
                            ? 'Missing — no approver resolved'
                            : 'Uses default'}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {g.required_roles.join(', ') || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function DefaultApproverRow({
  gate,
  roleOptions,
}: {
  gate: GateApproverConfigRow
  roleOptions: { value: string; label: string }[]
}) {
  const { toast } = useToast()
  const [pending, start] = useTransition()
  const [primary, setPrimary] = useState(gate.default_primary ?? '')
  const [secondary, setSecondary] = useState(gate.default_secondary ?? '')

  function save() {
    start(async () => {
      const res = await saveGateApproverDefault({
        gateNumber: gate.gate_number,
        primaryRole: primary,
        secondaryRole: secondary || null,
      })
      if (res.error) toast({ title: res.error, variant: 'danger' })
      else toast({ title: `${gate.gate_code} approvers saved`, variant: 'success' })
    })
  }

  const dirty = primary !== (gate.default_primary ?? '') || secondary !== (gate.default_secondary ?? '')

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2">
      <span className="w-28 shrink-0">
        <span className="font-mono text-xs font-semibold text-foreground">{gate.gate_code}</span>
        <span className="ms-1 block truncate text-[11px] text-muted-foreground">{gate.gate_name}</span>
      </span>
      <div className="w-44">
        <Select
          options={[{ value: '', label: 'Primary…' }, ...roleOptions]}
          value={primary}
          onValueChange={(v) => setPrimary(v ?? '')}
        />
      </div>
      <div className="w-44">
        <Select
          options={[{ value: '', label: 'Secondary (optional)' }, ...roleOptions.filter((o) => o.value !== primary)]}
          value={secondary}
          onValueChange={(v) => setSecondary(v ?? '')}
        />
      </div>
      <Button size="sm" variant={dirty ? 'default' : 'outline'} onClick={save} disabled={pending || !dirty || !primary}>
        Save
      </Button>
    </div>
  )
}

/* ── Tab 3: Approval Matrix ────────────────────────────────── */

function MatrixTab({ matrix, departments }: { matrix: ApprovalMatrixRow[]; departments: Lite[] }) {
  const [dept, setDept] = useState('')
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const deptName = useMemo(() => new Map(departments.map((d) => [d.code, d.name])), [departments])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return matrix.filter((m) => {
      if (dept && m.department_code !== dept) return false
      if (!needle) return true
      return (
        m.action_code.toLowerCase().includes(needle) ||
        m.action_name.toLowerCase().includes(needle) ||
        m.category.toLowerCase().includes(needle) ||
        m.initiator_role.toLowerCase().includes(needle) ||
        m.approver_role.toLowerCase().includes(needle)
      )
    })
  }, [matrix, dept, q])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-56">
            <Select
              options={[{ value: '', label: 'All departments' }, ...departments.map((d) => ({ value: d.code, label: `${d.code} · ${d.name}` }))]}
              value={dept}
              onValueChange={(v) => setDept(v ?? '')}
            />
          </div>
          <div className="relative w-64">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              className="ps-8"
              placeholder="Search actions…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <ExcelExportButton
          register="approval-matrix"
          rowCount={filtered.length}
          filters={{ department: dept || 'all', search: q || null }}
          buildSheets={() => [
            {
              name: 'Approval Matrix',
              columns: [
                { header: 'Code', key: 'action_code' as const },
                { header: 'Action', key: 'action_name' as const },
                { header: 'Category', key: 'category' as const },
                { header: 'Department', key: (r: ApprovalMatrixRow) => deptName.get(r.department_code) ?? r.department_code },
                { header: 'Initiator', key: 'initiator_role' as const },
                { header: 'Approver', key: 'approver_role' as const },
                { header: '2nd approver', key: (r: ApprovalMatrixRow) => r.secondary_approver_role ?? '' },
                { header: 'DOA limit', key: (r: ApprovalMatrixRow) => r.threshold_usd ?? '', type: 'currency' as const },
                { header: 'Segregation', key: (r: ApprovalMatrixRow) => (r.requires_segregation ? 'Yes' : 'No') },
              ],
              rows: filtered,
            },
          ]}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Action</th>
                <th className="px-4 py-2.5">Dept</th>
                <th className="px-4 py-2.5">Initiator</th>
                <th className="px-4 py-2.5">Approver</th>
                <th className="px-4 py-2.5">DOA limit</th>
                <th className="px-4 py-2.5" aria-label="Expand" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No actions match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const open = expanded === m.id
                  return (
                    <>
                      <tr
                        key={m.id}
                        className="cursor-pointer border-b border-border/60 hover:bg-muted/30"
                        onClick={() => setExpanded(open ? null : m.id)}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-foreground">{m.action_code}</td>
                        <td className="px-4 py-2.5 text-foreground">{m.action_name}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.department_code}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary" className="font-mono text-[11px]">{m.initiator_role}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="flex flex-wrap items-center gap-1">
                            <Badge className="font-mono text-[11px]">{m.approver_role}</Badge>
                            {m.secondary_approver_role && (
                              <Badge variant="outline" className="font-mono text-[11px]">+{m.secondary_approver_role}</Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {m.threshold_usd != null ? `$${m.threshold_usd.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <ChevronRight className={`inline size-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
                        </td>
                      </tr>
                      {open && (
                        <tr key={`${m.id}-detail`} className="border-b border-border/60 bg-muted/20">
                          <td colSpan={7} className="px-4 py-3">
                            <dl className="grid gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                              <div>
                                <dt className="text-muted-foreground">Category</dt>
                                <dd className="text-foreground">{m.category}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Department</dt>
                                <dd className="text-foreground">{deptName.get(m.department_code) ?? m.department_code}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Segregation of duties</dt>
                                <dd className="text-foreground">{m.requires_segregation ? 'Required (initiator ≠ approver)' : 'Not required'}</dd>
                              </div>
                              <div>
                                <dt className="text-muted-foreground">Delegated authority</dt>
                                <dd className="text-foreground">{m.threshold_usd != null ? `Up to $${m.threshold_usd.toLocaleString()}` : 'No monetary limit'}</dd>
                              </div>
                              {m.notes && (
                                <div className="sm:col-span-2">
                                  <dt className="text-muted-foreground">Rule</dt>
                                  <dd className="text-foreground">{m.notes}</dd>
                                </div>
                              )}
                            </dl>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">
        {filtered.length} of {matrix.length} actions · sourced live from the approval_matrix seed.
      </p>
    </div>
  )
}

/* ── Tab 4: Rules Health Check ─────────────────────────────── */

function HealthTab() {
  const { toast } = useToast()
  const [results, setResults] = useState<RuleResult[] | null>(null)
  const [ranAt, setRanAt] = useState<string | null>(null)
  const [running, start] = useTransition()
  const [openRule, setOpenRule] = useState<string | null>(null)

  function run() {
    start(async () => {
      try {
        const { results: r, ranAt: t } = await runRulesHealthCheck()
        setResults(r)
        setRanAt(t)
      } catch {
        toast({ title: 'Failed to run health checks', variant: 'danger' })
      }
    })
  }

  const passing = results?.filter((r) => r.status === 'pass').length ?? 0
  const total = results?.length ?? 10

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Governance rules health</h2>
          <p className="text-xs text-muted-foreground">
            {results
              ? `${passing}/${total} passing${ranAt ? ` · last run ${new Date(ranAt).toLocaleString()}` : ''}`
              : 'Run the B1–B10 integrity checks against live data.'}
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={running}>
          <RefreshCw className={`me-1.5 size-4 ${running ? 'animate-spin' : ''}`} aria-hidden />
          {results ? 'Re-run' : 'Run checks'}
        </Button>
      </Card>

      {results && (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((r) => {
            const open = openRule === r.code
            const tone =
              r.status === 'pass'
                ? 'border-emerald-500/40 bg-emerald-500/5'
                : r.status === 'fail'
                  ? 'border-red-500/40 bg-red-500/5'
                  : 'border-amber-500/40 bg-amber-500/5'
            return (
              <Card key={r.code} className={`p-4 ${tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="flex items-center gap-2">
                      {r.status === 'pass' ? (
                        <CheckCircle2 className="size-4 text-emerald-500" aria-hidden />
                      ) : r.status === 'fail' ? (
                        <XCircle className="size-4 text-red-500" aria-hidden />
                      ) : (
                        <AlertTriangle className="size-4 text-amber-500" aria-hidden />
                      )}
                      <span className="font-mono text-xs font-semibold text-foreground">{r.code}</span>
                      <span className="text-sm text-foreground">{r.label}</span>
                    </span>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.status === 'error' ? 'CHECK ERROR — ' : ''}
                      {r.note}
                    </p>
                  </div>
                  <Badge
                    variant={r.status === 'pass' ? 'secondary' : 'outline'}
                    className="shrink-0 text-[11px]"
                  >
                    {r.status === 'error' ? 'ERROR' : r.count != null ? `${r.count}` : '—'}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-3">
                  {r.details.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setOpenRule(open ? null : r.code)}
                    >
                      {open ? 'Hide details' : `Details (${r.details.length})`}
                    </button>
                  )}
                  {r.deepLink && (
                    <a
                      href={r.deepLink}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Investigate <ArrowUpRight className="size-3" aria-hidden />
                    </a>
                  )}
                </div>
                {open && r.details.length > 0 && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-border bg-background/60 p-2 text-[11px] text-muted-foreground">
                    {JSON.stringify(r.details, null, 2)}
                  </pre>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
