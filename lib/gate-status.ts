/**
 * Single source of truth for deriving gate display state from `projects.current_phase`.
 *
 * Every surface that shows "which gate is this project at" MUST use these helpers.
 * Previously the detail page's "Current Gate Status" panel hardcoded G2 while the
 * Stage Gate stepper derived its value from `project.gate`, so the two disagreed
 * for every project that wasn't actually at phase 2.
 */

/** Canonical governed gate model is G0–G6. */
export const MAX_GATE = 6

export const GATE_NAMES: Record<number, string> = {
  0: 'Opportunity Accepted',
  1: 'Project Baseline Approved',
  2: 'Engineering IFC Release',
  3: 'Procurement Award',
  4: 'Construction Mobilization',
  5: 'Mechanical Completion',
  6: 'Handover, Ops & Closeout',
}

export const GATE_DESCRIPTIONS: Record<number, string> = {
  0: 'Screen and accept the opportunity into the development pipeline',
  1: 'Approve the project baseline: scope, schedule, budget and financing plan',
  2: 'Release Issued For Construction engineering drawings and specifications',
  3: 'Award major equipment and EPC contracts',
  4: 'Mobilize site, permits and construction resources',
  5: 'Achieve mechanical completion and begin commissioning',
  6: 'Complete handover to operations and close out the project',
}

export interface GateStatus {
  /** Raw phase number from `projects.current_phase`, clamped to the governed range. */
  gate: number
  /** Gate code, e.g. "G1". */
  code: string
  /** Human-readable gate name. */
  name: string
  /** Short description of what the gate covers. */
  description: string
  /** Codes of all gates before the current one, e.g. ["G0"] when at G1. */
  completedGates: string[]
  /** Percent of the G0–G6 lifecycle completed. */
  progressPct: number
}

/**
 * Derive every gate display value from a single `current_phase` integer.
 *
 * `current_phase` can legitimately exceed MAX_GATE for completed projects
 * (phase 7/8 exist in the DB), so it is clamped rather than treated as invalid.
 */
export function deriveGateStatus(currentPhase: number | null | undefined): GateStatus {
  const raw = Number(currentPhase)
  const gate = Number.isFinite(raw) ? Math.min(MAX_GATE, Math.max(0, Math.trunc(raw))) : 0

  return {
    gate,
    code: `G${gate}`,
    name: GATE_NAMES[gate] ?? `Gate ${gate}`,
    description: GATE_DESCRIPTIONS[gate] ?? '',
    completedGates: Array.from({ length: gate }, (_, i) => `G${i}`),
    progressPct: Math.round((gate / MAX_GATE) * 100),
  }
}

/**
 * Parse a `?gate=` query value (e.g. "G0", "g3", "2") into a phase number.
 * Returns null when the value is absent or not a recognised gate.
 */
export function parseGateParam(value: string | null | undefined): number | null {
  if (!value) return null
  const match = /^g?(\d+)$/i.exec(value.trim())
  if (!match) return null
  const n = Number(match[1])
  return n >= 0 && n <= MAX_GATE ? n : null
}
