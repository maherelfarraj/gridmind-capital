'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ProjectDetailPage } from '@/components/projects/project-detail-page'
import { PhaseGateStepper } from '@/components/layout/PhaseGateStepper'
import { MOCK_PROJECTS } from '@/components/dashboard/dashboard-data'
import type { ProjectData } from '@/components/project/project-command-center'
import type { GateDef, GateState } from '@/components/project/phase-gate-stepper'
import type { PhaseKey } from '@/components/app-shell/nav-config'

// ─────────────────────────────────────────────────────────────
// Project lookup — converts PipelineProject → ProjectData
// Replace with a real API/DB fetch when the backend is wired up.
// ─────────────────────────────────────────────────────────────

// Gate names aligned with the GREOS stage-gate model
const GATE_NAMES: Record<number, string> = {
  0: 'Investment Intake',
  1: 'Development Approval',
  2: 'Commercial IFC',
  3: 'Engineering IFC',
  4: 'Procurement Ready',
  5: 'Construction Mobilization',
  6: 'Systems Commissioning',
  7: 'COD Declaration',
  8: 'O&M Handover',
  9: 'AI Analytics',
}

// Approximate start dates by gate — replace with real DB field when available
const GATE_START_DATES: Record<number, string> = {
  0: '2025-01-15', 1: '2024-06-01', 2: '2024-03-20',
  3: '2026-01-15', 4: '2023-11-01', 5: '2023-07-10',
  6: '2023-04-05', 7: '2023-01-20', 8: '2022-10-01', 9: '2022-06-01',
}

function findProject(id: string): ProjectData | null {
  // Match by id OR code (case-insensitive) so /projects/SOL-2026-001 works
  const normalised = id.toUpperCase()
  const raw = MOCK_PROJECTS.find(
    (p) => p.id === id || p.code.toUpperCase() === normalised,
  )
  if (!raw) return null

  return {
    id: raw.id,
    name: raw.name,
    code: raw.code,
    client: raw.client,
    status: raw.status as ProjectData['status'],
    phase: raw.phase as PhaseKey,
    gate: raw.gate,
    gateName: GATE_NAMES[raw.gate] ?? `Gate ${raw.gate}`,
    budgetUsd: raw.budgetM * 1_000_000,
    currency: 'USD',
    startDate: GATE_START_DATES[raw.gate] ?? '2024-01-01',
    targetCod: raw.targetCod,
    location: raw.location,
    commentCount: raw.gate >= 3 ? 12 : 0,
    documentCount: raw.gate >= 2 ? 8 : 0,
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

  const handleGateClick = React.useCallback((gate: GateDef, _state: GateState) => {
    // Gate detail panel is handled internally by PhaseGateStepper's own drawer.
    // Hook here for analytics, deep-linking, or external navigation if needed.
    console.log('[v0] Clicked gate:', gate.code, gate.shortName)
  }, [])

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

  // Convert numeric gate → string code for the stepper
  const currentGateCode = `G${project.gate}`
  const completedGateCodes = Array.from({ length: project.gate }, (_, i) => `G${i}`)

  return (
    <>
      {/* ProjectCommandCenter header is rendered inside ProjectDetailPage */}
      <ProjectDetailPage
        project={project}
        onBack={handleBack}
        hideStepper
      />

      {/* ── PhaseGateStepper — owned by this route per spec ── */}
      <section className="mt-6" aria-label="Stage gate progress">
        <PhaseGateStepper
          currentGate={currentGateCode}
          completedGates={completedGateCodes}
          onGateClick={handleGateClick}
        />
      </section>

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
