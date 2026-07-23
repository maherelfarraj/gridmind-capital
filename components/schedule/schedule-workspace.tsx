'use client'

import * as React from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, Plus, RefreshCw, Loader2, LayoutTemplate, Flag, Pencil, FileUp, Network } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { GanttChart } from '@/components/schedule/gantt-chart'
import { ActivityDialog } from '@/components/schedule/activity-dialog'
import { ImportScheduleDialog } from '@/components/schedule/import-schedule-dialog'
import {
  getSchedule,
  getProjectProgress,
  seedScheduleTemplate,
  createBaseline,
  recalcCriticalPath,
  type ScheduleActivity,
} from '@/app/actions/schedule'
import { getProject } from '@/app/actions/projects'

export function ScheduleWorkspace({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ScheduleActivity | null>(null)
  const [seeding, setSeeding] = React.useState(false)
  const [baselining, setBaselining] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [recalcing, setRecalcing] = React.useState(false)

  const { data: project } = useSWR(`project-${projectId}`, () => getProject(projectId))
  const { data: schedule, isLoading, mutate } = useSWR(
    `schedule-gantt-${projectId}`,
    () => getSchedule(projectId),
    { revalidateOnFocus: true },
  )
  const { data: progress, mutate: mutateProgress } = useSWR(
    `schedule-progress-${projectId}`,
    () => getProjectProgress(projectId),
  )

  const activities = schedule?.activities ?? []
  const dependencies = schedule?.dependencies ?? []

  function refresh() {
    mutate()
    mutateProgress()
  }

  function openAdd() {
    setEditing(null)
    setDialogOpen(true)
  }

  function openEdit(id: string) {
    setSelectedId(id)
    const found = activities.find((a) => a.id === id) ?? null
    setEditing(found)
    setDialogOpen(true)
  }

  async function handleSeed() {
    setSeeding(true)
    const res = await seedScheduleTemplate(projectId)
    setSeeding(false)
    if (res.error) { toast({ title: 'Template failed', description: res.error, variant: 'danger' }); return }
    if (!res.seeded) { toast({ title: 'Schedule already has activities', variant: 'warning' }); return }
    toast({ title: `Template generated — ${res.count} activities`, variant: 'success' })
    refresh()
  }

  async function handleBaseline() {
    const name = window.prompt('Baseline name', `Baseline ${new Date().toLocaleDateString('en-US')}`)
    if (!name) return
    setBaselining(true)
    const res = await createBaseline(projectId, name)
    setBaselining(false)
    if (res.error) { toast({ title: 'Baseline failed', description: res.error, variant: 'danger' }); return }
    toast({ title: 'Baseline created', variant: 'success' })
  }

  async function handleRecalc() {
    setRecalcing(true)
    const res = await recalcCriticalPath(projectId)
    setRecalcing(false)
    if (res.error) { toast({ title: 'Critical path failed', description: res.error, variant: 'danger' }); return }
    toast({ title: `Critical path updated — ${res.criticalCount} activities on the path`, variant: 'success' })
    refresh()
  }

  const overall = progress?.percentComplete ?? 0

  return (
    <>
      <ActivityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        activity={editing}
        onSaved={refresh}
      />

      <ImportScheduleDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        onImported={refresh}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="mb-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Back to project
            </Link>
            <h1 className="text-2xl font-bold text-foreground">
              {project?.name ?? 'Project Schedule'}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {project?.code ? `${project.code} · ` : ''}Gantt schedule, dependencies &amp; critical path
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={refresh} aria-label="Refresh">
              <RefreshCw className="size-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
              {seeding ? <Loader2 className="size-3.5 animate-spin" /> : <LayoutTemplate className="size-3.5" />}
              Generate template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <FileUp className="size-3.5" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleRecalc} disabled={recalcing || !activities.length}>
              {recalcing ? <Loader2 className="size-3.5 animate-spin" /> : <Network className="size-3.5" />}
              Recalculate critical path
            </Button>
            <Button variant="outline" size="sm" onClick={handleBaseline} disabled={baselining || !activities.length}>
              {baselining ? <Loader2 className="size-3.5 animate-spin" /> : <Flag className="size-3.5" />}
              Create baseline
            </Button>
            <Button size="sm" onClick={openAdd}>
              <Plus className="size-4" /> Add activity
            </Button>
          </div>
        </div>

        {/* Overall progress */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Weighted overall progress
            </span>
            <span className="text-lg font-bold tabular-nums text-foreground">{overall}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[#64ffda] transition-all"
              style={{ width: `${overall}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>{progress?.totalActivities ?? 0} activities</span>
            <span className="text-[#16a34a]">{progress?.byStatus.completed ?? 0} complete</span>
            <span className="text-[#0d9488]">{progress?.byStatus.in_progress ?? 0} in progress</span>
            <span>{progress?.byStatus.not_started ?? 0} not started</span>
          </div>
        </div>

        {/* Gantt */}
        {isLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-border bg-card py-20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> Loading schedule…
          </div>
        ) : (
          <>
            <GanttChart
              activities={activities}
              dependencies={dependencies}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onSeed={handleSeed}
              seeding={seeding}
            />
            {selectedId && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
                <span className="truncate text-sm text-foreground">
                  Selected: {activities.find((a) => a.id === selectedId)?.name}
                </span>
                <Button variant="outline" size="sm" onClick={() => openEdit(selectedId)}>
                  <Pencil className="size-3.5" /> Edit activity
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
