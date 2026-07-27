/**
 * Single source of truth for deriving gate display state from `projects.current_phase`.
 *
 * DEPRECATED: Use lib/gates/phase-model.ts instead. This file is maintained for
 * backward compatibility only. New code should import from phase-model.ts.
 * 
 * Every surface that shows "which gate is this project at" MUST use the canonical model
 * from lib/gates/phase-model.ts to ensure consistent names across the UI.
 */

/** DEPRECATED: Use TOTAL_PHASES from lib/gates/phase-model.ts instead. */
export const MAX_GATE = 6

/** DEPRECATED: Use CANONICAL_PHASE_NAMES from lib/gates/phase-model.ts instead. */
export const GATE_NAMES: Record<number, string> = {
  0: 'Project Intake',
  1: 'Origination & Feasibility',
  2: 'Permitting & Grid Application',
  3: 'Commercial & Financial Close (RTB)',
  4: 'Detailed Design (IFC)',
  5: 'Procurement & Manufacturing',
  6: 'Construction & Installation',
  7: 'Commissioning & Grid Tests',
  8: 'Handover & O&M',
}

/** DEPRECATED: Use phaseLabel() from lib/gates/phase-model.ts instead. */
export const GATE_DESCRIPTIONS: Record<number, string> = {
  0: 'Project intake and registration',
  1: 'Develop project concept and establish feasibility',
  2: 'Secure environmental, grid and regulatory approvals',
  3: 'Finalize commercial terms and achieve financial close',
  4: 'Complete detailed design (IFC) for construction',
  5: 'Procure major equipment and manufacturing',
  6: 'Execute construction and site installation',
  7: 'Perform commissioning and grid compliance testing',
  8: 'Formal handover to operations and asset transfer',
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
 * DEPRECATED: Use lib/gates/phase-model.ts instead for new code.
 *
 * `current_phase` = count of approved gates (0–8). The ACTIVE gate = current_phase + 1.
 * This function computes that active gate, which can legitimately exceed MAX_GATE for
 * completed projects (phase 7/8 exist in the DB), so it is clamped rather than invalid.
 */
export function deriveGateStatus(currentPhase: number | null | undefined): GateStatus {
  const raw = Number(currentPhase)
  // currentPhase = count of approved gates. Active gate is the next one (approved + 1).
  const approvedCount = Number.isFinite(raw) ? Math.max(0, Math.trunc(raw)) : 0
  const gate = Math.min(MAX_GATE, approvedCount + 1)

  return {
    gate,
    code: `G${gate}`,
    name: GATE_NAMES[gate] ?? `Gate ${gate}`,
    description: GATE_DESCRIPTIONS[gate] ?? '',
    completedGates: Array.from({ length: approvedCount }, (_, i) => `G${i + 1}`),
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
