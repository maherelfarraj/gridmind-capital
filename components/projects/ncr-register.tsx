'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { getNcrs, createNcr, seedNcrDemo, type NcrSource } from '@/app/actions/ncrs'
import {
  NCR_STATUS_LABEL, NCR_STATUS_BADGE, NCR_SOURCE_LABEL, formatDate,
} from '@/lib/ncrs/ui'
import { AlertTriangle, Plus, ClipboardList, CheckCircle2, Clock } from 'lucide-react'

const SOURCES: NcrSource[] = ['failed_inspection', 'audit', 'site_observation']

export function NcrRegister({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR(`ncrs-${projectId}`, () => getNcrs(projectId))
  const [createOpen, setCreateOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState<NcrSource>('failed_inspection')

  const rows = data?.rows ?? []
  const kpis = data?.kpis

  async function handleCreate() {
    if (!title.trim()) {
      toast({ title: 'Title required', description: 'Enter a short NCR title.', variant: 'danger' })
      return
    }
    setBusy(true)
    const res = await createNcr({ project_id: projectId, title, description, source })
    setBusy(false)
    if (res.error) {
      toast({ title: 'Could not raise NCR', description: res.error, variant: 'danger' })
      return
    }
    toast({ title: 'NCR raised', description: `${res.data?.ncr_number} created.`, variant: 'success' })
    setCreateOpen(false)
    setTitle(''); setDescription(''); setSource('failed_inspection')
    mutate()
  }

  async function handleSeed() {
    setBusy(true)
    const res = await seedNcrDemo(projectId)
    setBusy(false)
    if (res.error) { toast({ title: 'Seed skipped', description: res.error, variant: 'warning' }); return }
    toast({ title: 'Demo NCRs added', variant: 'success' })
    mutate()
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-balance">Non-Conformance Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track NCRs through rectification, re-inspection, and closure. Open NCRs block Gate G5 (PAC) approval.
          </p>
        </div>
        <div className="flex gap-2">
          {rows.length === 0 && (
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={busy}>Seed demo</Button>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5 mr-1.5" /> Raise NCR
          </Button>
        </div>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={<AlertTriangle className="size-4 text-red-500" />} label="Open NCRs" value={kpis ? String(kpis.open) : '—'} />
        <KpiCard icon={<Clock className="size-4 text-blue-500" />} label="Avg days to close" value={kpis?.avgDaysToClose != null ? `${kpis.avgDaysToClose}d` : '—'} />
        <KpiCard icon={<CheckCircle2 className="size-4 text-emerald-500" />} label="Closed" value={kpis ? String(kpis.byStatus.find(s => s.name === 'closed')?.value ?? 0) : '—'} />
        <KpiCard icon={<ClipboardList className="size-4 text-muted-foreground" />} label="Total this project" value={kpis ? String(kpis.total) : '—'} />
      </div>

      {/* Register table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Raised</th>
                <th className="px-4 py-3 font-medium text-right">Days open</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No NCRs raised yet.</td></tr>
              )}
              {rows.map((n) => (
                <tr key={n.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${projectId}/ncrs/${n.id}`} className="font-medium text-primary hover:underline">
                      {n.ncr_number}
                    </Link>
                    {n.cycle > 1 && <span className="ml-2 text-xs text-muted-foreground">cycle {n.cycle}</span>}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <Link href={`/projects/${projectId}/ncrs/${n.id}`} className="hover:underline">
                      <span className="line-clamp-1">{n.title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{NCR_SOURCE_LABEL[n.source]}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${NCR_STATUS_BADGE[n.status]}`}>
                      {NCR_STATUS_LABEL[n.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(n.raised_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {n.status === 'closed'
                      ? <span className="text-muted-foreground">{n.days_open}d</span>
                      : <span className={n.days_open > 30 ? 'text-red-600 dark:text-red-400 font-medium' : n.days_open > 14 ? 'text-amber-600 dark:text-amber-400' : ''}>{n.days_open}d</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Raise a non-conformance report</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="ncr-title">Title</Label>
              <Input id="ncr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Torque values not recorded on module clamps" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ncr-source">Source</Label>
              <select
                id="ncr-source"
                value={source}
                onChange={(e) => setSource(e.target.value as NcrSource)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {SOURCES.map((s) => <option key={s} value={s}>{NCR_SOURCE_LABEL[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ncr-desc">Description</Label>
              <Textarea id="ncr-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe the non-conformance…" />
            </div>
            <p className="text-xs text-muted-foreground">
              The NCR is raised in <strong>Open</strong> status. Root cause and corrective action are captured on the detail page before rectification can begin.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={busy}>{busy ? 'Raising…' : 'Raise NCR'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  )
}
