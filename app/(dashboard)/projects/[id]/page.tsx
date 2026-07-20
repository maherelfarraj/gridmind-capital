'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ProjectCommandCenter } from '@/components/layout/ProjectCommandCenter'
import { ProjectDetailPage } from '@/components/projects/project-detail-page'
import { MOCK_PROJECTS } from '@/components/dashboard/dashboard-data'
import type { ProjectData } from '@/components/project/project-command-center'
import type { PhaseKey } from '@/components/app-shell/nav-config'

// ─────────────────────────────────────────────────────────────
// Project lookup — converts PipelineProject → ProjectData
// Replace with a real API/DB fetch when the backend is wired up.
// ─────────────────────────────────────────────────────────────

function findProject(id: string): ProjectData | null {
  const raw = MOCK_PROJECTS.find((p) => p.id === id)
  if (!raw) return null
  return {
    id: raw.id,
    name: raw.name,
    code: raw.code,
    client: raw.client,
    status: raw.status as ProjectData['status'],
    phase: raw.phase as PhaseKey,
    gate: raw.gate,
    gateName: `Gate ${raw.gate}`,
    budgetUsd: raw.budgetM * 1_000_000,
    currency: 'USD',
    startDate: '2023-03-15',          // replace with raw.start_date when available
    targetCod: raw.targetCod,
    location: raw.location,
    commentCount: raw.gate >= 3 ? 12 : 0,
  }
}

// ─────────────────────────────────────────────────────────────
// Panel state (Comments / Documents / Edit)
// ─────────────────────────────────────────────────────────────

type ActivePanel = 'comments' | 'documents' | 'edit' | null

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function ProjectDetailRoute() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params?.id ?? ''

  const [activePanel, setActivePanel] = React.useState<ActivePanel>(null)
  const project = React.useMemo(() => findProject(id), [id])

  // Toggle panel — clicking the same action twice closes it
  const openPanel = React.useCallback((panel: ActivePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel))
  }, [])

  const handleBack = React.useCallback(() => {
    router.push('/projects')
  }, [router])

  const handleEdit = React.useCallback(() => {
    openPanel('edit')
  }, [openPanel])

  const handleComments = React.useCallback(() => {
    openPanel('comments')
  }, [openPanel])

  const handleDocuments = React.useCallback(() => {
    openPanel('documents')
  }, [openPanel])

  // ── 404 state ──────────────────────────────────────────────
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
          className="rounded-md bg-[#64ffda] px-4 py-2 text-sm font-semibold text-[#0a192f] hover:bg-[#64ffda]/80 transition-colors"
        >
          Back to Projects
        </button>
      </div>
    )
  }

  return (
    <>
      {/*
        ProjectCommandCenter is also rendered inside ProjectDetailPage.
        Here we keep a standalone usage per the spec snippet — the
        detail page re-uses the same project prop so both stay in sync.
      */}
      <ProjectDetailPage
        project={project}
        onBack={handleBack}
      />

      {/* ── Side panels (wired, ready for real drawer components) ── */}
      {activePanel === 'comments' && (
        <aside
          aria-label="Comments panel"
          className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-card shadow-xl
                     translate-x-0 transition-transform duration-300"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Comments</h2>
            <button
              type="button"
              aria-label="Close comments panel"
              onClick={() => setActivePanel(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="p-5 text-sm text-muted-foreground">
            Comments panel — wire up real data here.
          </div>
        </aside>
      )}

      {activePanel === 'documents' && (
        <aside
          aria-label="Documents panel"
          className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-card shadow-xl
                     translate-x-0 transition-transform duration-300"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Documents</h2>
            <button
              type="button"
              aria-label="Close documents panel"
              onClick={() => setActivePanel(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="p-5 text-sm text-muted-foreground">
            Documents panel — wire up real data here.
          </div>
        </aside>
      )}

      {activePanel === 'edit' && (
        <aside
          aria-label="Edit project panel"
          className="fixed inset-y-0 right-0 z-40 w-[480px] border-l border-border bg-card shadow-xl
                     translate-x-0 transition-transform duration-300"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Edit Project</h2>
            <button
              type="button"
              aria-label="Close edit panel"
              onClick={() => setActivePanel(null)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="p-5 text-sm text-muted-foreground">
            Edit panel — wire up form fields here.
          </div>
        </aside>
      )}
    </>
  )
}
