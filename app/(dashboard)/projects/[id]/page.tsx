'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import useSWR from 'swr'
import { ProjectDetailPage } from '@/components/projects/project-detail-page'
import { CommentThread } from '@/components/comments/comment-thread'
import { getProject } from '@/app/actions/projects'
import { getProjectTimeline } from '@/app/actions/phase-gates'

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function ProjectDetailRoute() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const { data: project, isLoading } = useSWR(
    id ? `project-${id}` : null,
    () => getProject(id),
  )

  const { data: timelineLogs } = useSWR(
    id ? `project-timeline-${id}` : null,
    () => getProjectTimeline(id),
  )

  const [activePanel, setActivePanel] = React.useState<'comments' | 'documents' | 'edit' | null>(null)

  const openPanel = React.useCallback((panel: 'comments' | 'documents' | 'edit') => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }, [])

  const handleBack = React.useCallback(() => router.push('/projects'), [router])

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  // ── 404 state ──
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
        <p className="text-4xl font-bold text-foreground">404</p>
        <p className="text-muted-foreground text-sm">
          Project <span className="font-mono text-foreground">{id}</span> was not found.
        </p>
        <button
          type="button"
          onClick={handleBack}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/80 transition-colors"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  return (
    <>
      <ProjectDetailPage
        project={{
          id: project.id,
          code: project.code,
          name: project.name,
          client: project.client,
          status: project.status as 'active' | 'on-hold' | 'completed' | 'cancelled' | 'draft',
          phase: project.phase,
          gate: project.gate,
          gateName: project.gateName,
          budgetUsd: project.budgetUsd,
          currency: project.currency ?? 'USD',
          startDate: String(project.startDate ?? ''),
          targetCod: String(project.targetCod ?? ''),
          location: project.location ? String(project.location) : undefined,
          commentCount: project.commentCount,
          documentCount: project.documentCount,
        }}
        gateProgress={Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [`G${i}`, i < project.gate]),
        )}
        deliverables={[
          { name: 'Feasibility Study',        completed: project.gate >= 1 },
          { name: 'Development Approval',     completed: project.gate >= 1 },
          { name: 'Commercial IFC Package',   completed: project.gate >= 2 },
          { name: 'IFC Drawings',             completed: project.gate >= 3 },
          { name: 'Technical Specifications', completed: project.gate >= 2 },
          { name: 'Bill of Materials',        completed: project.gate >= 4 },
          { name: 'Procurement Ready',        completed: project.gate >= 4 },
          { name: 'Design Calculations',      completed: project.gate >= 3 },
        ].filter((_, i) => {
          // Show 4 most relevant deliverables for current gate
          const g = project.gate
          if (g <= 1) return i < 2
          if (g <= 3) return i >= 2 && i < 6
          return i >= 4
        })}
        risks={[
          { title: 'Permit delays',           probability: 'high',   impact: 'high',   status: 'open' },
          { title: 'Supply chain disruption', probability: 'medium', impact: 'medium', status: 'open' },
          { title: 'Weather delays',          probability: 'medium', impact: 'low',    status: 'open' },
        ]}
        timelineLogs={timelineLogs ?? []}
        approvals={[]}
        teamMembers={[]}
        documents={[]}
        comments={[]}
        onBack={handleBack}
        onEdit={() => openPanel('edit')}
        onComments={() => openPanel('comments')}
        onDocuments={() => openPanel('documents')}
        onTeam={() => {}}
        onSettings={() => {}}
        onSubmitApproval={() => {}}
        onRequestChanges={() => {}}
      />

      {/* ── Side panels ── */}
      {activePanel && (
        <aside
          aria-label={`${activePanel} panel`}
          className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground capitalize">{activePanel}</h2>
            <button
              type="button"
              aria-label={`Close ${activePanel} panel`}
              onClick={() => setActivePanel(null)}
              className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            >
              &times;
            </button>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            {activePanel === 'edit' && 'Edit panel — form fields coming soon.'}
            {activePanel === 'comments' && (
              <CommentThread
                entityType="project"
                entityId={project.id}
                title="Project Discussion"
                className="border-0 shadow-none"
              />
            )}
            {activePanel === 'documents' && 'Documents panel — coming soon.'}
          </div>
        </aside>
      )}
    </>
  )
}
