'use client'

import * as React from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { formatDistanceToNow } from 'date-fns'
import {
  UserPlus, Link2, RefreshCw, ShieldOff, ShieldCheck,
  ChevronDown, ChevronRight, Copy, Check, Clock, Building2,
  FolderOpen, XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import {
  getExternalUsers, inviteExternalUser, revokeProjectAccess, revokeAllAccess,
  assignProjectAccess, type ExternalUser, type ExternalRole,
} from '@/app/actions/external-access'
import { getProjects } from '@/app/actions/projects'
import { seedPortalDemo } from '@/app/actions/portal'
import { Database } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }) } catch { return '—' }
}

const ROLE_LABELS: Record<ExternalRole, string> = {
  subcontractor: 'Subcontractor',
  client_viewer: 'Client Viewer',
}

const ROLE_COLORS: Record<ExternalRole, string> = {
  subcontractor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  client_viewer: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
}

// ─────────────────────────────────────────────────────────────
// Invite dialog
// ─────────────────────────────────────────────────────────────

function InviteDialog({
  open,
  onClose,
  projects,
}: {
  open: boolean
  onClose: () => void
  projects: { id: string; code: string; name: string }[]
}) {
  const { toast } = useToast()
  const [email, setEmail] = React.useState('')
  const [role, setRole] = React.useState<ExternalRole>('subcontractor')
  const [org, setOrg] = React.useState('')
  const [selectedProjects, setSelectedProjects] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(false)
  const [inviteLink, setInviteLink] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)

  const reset = () => {
    setEmail(''); setRole('subcontractor'); setOrg('')
    setSelectedProjects([]); setInviteLink(null); setCopied(false)
  }

  const handleClose = () => { reset(); onClose() }

  const toggleProject = (id: string) =>
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    )

  const handleInvite = async () => {
    if (!email || !org) {
      toast({ title: 'Email and organisation are required', variant: 'warning' }); return
    }
    setLoading(true)
    const result = await inviteExternalUser({
      email,
      role,
      organizationName: org,
      projectIds: selectedProjects,
      siteUrl: window.location.origin,
    })
    setLoading(false)
    if (result.error) {
      toast({ title: 'Invite failed', description: result.error, variant: 'danger' }); return
    }
    if (result.inviteLink) setInviteLink(result.inviteLink)
    globalMutate('external-users')
    toast({
      title: result.isExisting ? 'Access updated' : 'Invite sent',
      description: result.isExisting
        ? `${email} already exists — role and access updated.`
        : `Invite email sent to ${email}.`,
      variant: 'success',
    })
  }

  const copyLink = async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <UserPlus className="size-4 text-muted-foreground" />
              Invite external user
            </span>
          </DialogTitle>
        </DialogHeader>

        {!inviteLink ? (
          <div className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ext-email">Email address</Label>
              <Input id="ext-email" type="email" placeholder="name@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole((v ?? 'subcontractor') as ExternalRole)}
                  options={[
                    { value: 'subcontractor', label: 'Subcontractor' },
                    { value: 'client_viewer',  label: 'Client Viewer' },
                  ]}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ext-org">Organisation</Label>
                <Input id="ext-org" placeholder="ACME Ltd." value={org} onChange={(e) => setOrg(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Grant project access</Label>
              <div className="rounded-md border border-border max-h-44 overflow-y-auto divide-y divide-border">
                {projects.length === 0 && (
                  <p className="text-xs text-muted-foreground px-3 py-2">No active projects.</p>
                )}
                {projects.map((p) => {
                  const selected = selectedProjects.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProject(p.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                        selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted/40 text-muted-foreground'
                      }`}
                    >
                      <span className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                        selected ? 'bg-primary border-primary' : 'border-border'
                      }`}>
                        {selected && <Check className="size-2.5 text-primary-foreground" />}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">{p.code}</span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedProjects.length} project{selectedProjects.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-400">
              Invite email sent. Copy the link below to share manually if the email was not received.
            </div>
            <div className="grid gap-1.5">
              <Label>Invite link (fallback)</Label>
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {!inviteLink ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleInvite} disabled={loading}>
                {loading ? <RefreshCw className="size-4 animate-spin mr-2" /> : <UserPlus className="size-4 mr-2" />}
                Send invite
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────
// User row (expandable)
// ─────────────────────────────────────────────────────────────

function UserRow({
  user,
  allProjects,
  onRevoke,
  onRevokeAll,
}: {
  user: ExternalUser
  allProjects: { id: string; code: string; name: string }[]
  onRevoke: (userId: string, projectId: string) => void
  onRevokeAll: (userId: string) => void
}) {
  const [expanded, setExpanded] = React.useState(false)
  const activeProjects = user.projects.filter((p) => !p.revoked)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        {expanded
          ? <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate">
              {user.full_name || user.email}
            </span>
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0.5 font-medium ${ROLE_COLORS[user.role]}`}
            >
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span>{user.email}</span>
            {user.organization_name && (
              <>
                <span aria-hidden>·</span>
                <span className="flex items-center gap-1">
                  <Building2 className="size-3" />
                  {user.organization_name}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FolderOpen className="size-3" />
            {activeProjects.length} project{activeProjects.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {relativeTime(user.last_active)}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-muted/10 px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Project access
            </p>
            {user.projects.length === 0 && (
              <p className="text-xs text-muted-foreground">No projects assigned.</p>
            )}
            {user.projects.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-muted-foreground w-14 shrink-0">{p.code}</span>
                <span className="flex-1 text-foreground">{p.name}</span>
                {p.revoked ? (
                  <Badge variant="outline" className="text-[10px] text-slate-500">Revoked</Badge>
                ) : (
                  <Button size="sm" variant="ghost"
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => onRevoke(user.id, p.id)}
                  >
                    <XCircle className="size-3 mr-1" /> Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-1 border-t border-border">
            <Button size="sm" variant="outline"
              className="text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => onRevokeAll(user.id)}
            >
              <ShieldOff className="size-3 mr-1.5" /> Revoke all access
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────

export function ExternalAccessTab() {
  const { toast } = useToast()
  const { data: users, isLoading } = useSWR('external-users', getExternalUsers)
  const { data: allProjects } = useSWR('all-projects-list', () => getProjects())

  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [seedOpen, setSeedOpen] = React.useState(false)
  const [seedProject, setSeedProject] = React.useState('')
  const [seedOrg, setSeedOrg] = React.useState('')
  const [seeding, setSeeding] = React.useState(false)

  const projects = (allProjects ?? []).map((p) => ({
    id: p.id, code: p.code, name: p.name,
  }))

  const handleSeed = async () => {
    if (!seedProject || !seedOrg.trim()) {
      toast({ title: 'Project and organization are required', variant: 'warning' })
      return
    }
    setSeeding(true)
    const res = await seedPortalDemo({ projectId: seedProject, organizationName: seedOrg.trim() })
    setSeeding(false)
    if (res.error) {
      toast({ title: 'Seed failed', description: res.error, variant: 'danger' })
    } else {
      toast({
        title: 'Portal demo data created',
        description: `${res.pos} purchase orders and ${res.rfqs} RFQs for ${seedOrg.trim()}.`,
        variant: 'success',
      })
      setSeedOpen(false); setSeedProject(''); setSeedOrg('')
    }
  }

  const handleRevoke = async (userId: string, projectId: string) => {
    const res = await revokeProjectAccess({ userId, projectId })
    if (res.error) {
      toast({ title: 'Revoke failed', description: res.error, variant: 'danger' })
    } else {
      toast({ title: 'Project access revoked', variant: 'success' })
      globalMutate('external-users')
    }
  }

  const handleRevokeAll = async (userId: string) => {
    const res = await revokeAllAccess(userId)
    if (res.error) {
      toast({ title: 'Revoke failed', description: res.error, variant: 'danger' })
    } else {
      toast({ title: 'All access revoked', variant: 'success' })
      globalMutate('external-users')
    }
  }

  const activeCount = (users ?? []).filter(
    (u) => u.projects.some((p) => !p.revoked),
  ).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">External Access</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Invite subcontractors and client viewers. They see only what you explicitly share.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSeedOpen(true)}>
            <Database className="size-4 mr-2" /> Seed portal demo
          </Button>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4 mr-2" /> Invite user
          </Button>
        </div>
      </div>

      {/* Seed portal demo dialog */}
      <Dialog open={seedOpen} onOpenChange={(o) => !o && setSeedOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <Database className="size-4 text-muted-foreground" />
                Seed partner portal demo data
              </span>
            </DialogTitle>
            <DialogDescription>
              Creates sample purchase orders and RFQs for an organization on a project.
              Invite a subcontractor with the same organization name and grant them this
              project so they see the data in their portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select
                value={seedProject}
                onValueChange={(v) => setSeedProject(v ?? '')}
                options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
                placeholder="Select a project…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Organization name</Label>
              <Input
                value={seedOrg}
                onChange={(e) => setSeedOrg(e.target.value)}
                placeholder="e.g. Meridian Civils Ltd"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedOpen(false)}>Cancel</Button>
            <Button onClick={handleSeed} disabled={seeding}>
              {seeding ? <RefreshCw className="size-4 animate-spin mr-2" /> : <Database className="size-4 mr-2" />}
              Create demo data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active external users', value: activeCount, icon: ShieldCheck },
          { label: 'Subcontractors', value: (users ?? []).filter((u) => u.role === 'subcontractor').length, icon: Building2 },
          { label: 'Client viewers', value: (users ?? []).filter((u) => u.role === 'client_viewer').length, icon: Link2 },
          { label: 'Projects with access', value: new Set((users ?? []).flatMap((u) => u.projects.filter((p) => !p.revoked).map((p) => p.id))).size, icon: FolderOpen },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="bg-muted/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className="size-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xl font-bold text-foreground leading-none">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">External users</CardTitle>
          <CardDescription>Click a row to see project access and revoke controls.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
              Loading...
            </div>
          )}
          {!isLoading && (users ?? []).length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <ShieldCheck className="size-8 opacity-30" />
              No external users yet. Invite a subcontractor or client viewer to get started.
            </div>
          )}
          {(users ?? []).map((user) => (
            <UserRow
              key={user.id}
              user={user}
              allProjects={projects}
              onRevoke={handleRevoke}
              onRevokeAll={handleRevokeAll}
            />
          ))}
        </CardContent>
      </Card>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        projects={projects}
      />
    </div>
  )
}
