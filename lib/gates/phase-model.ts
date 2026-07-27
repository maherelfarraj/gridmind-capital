/**
 * CANONICAL GATE MODEL — Single Source of Truth
 *
 * Every surface that displays gate/phase info MUST import from this file.
 * Before: 6+ divergent maps (GATE_DEFINITIONS, GATE_NAMES, LANE_META, PHASE_META,
 * nav-config PHASE_META_FALLBACK, command-center GATE_NAMES, etc.) caused:
 *   - Stepper showing G2 while detail panel showed G3 on the same project
 *   - 8-phase model in DB (phase_number 1–8) but UI hardcoded 7 gates (G0–G6)
 *   - New phase names in phase_gates table ignored; old GATE_DEFINITIONS used everywhere
 *   - Project creation using 7 rows (0–6) vs 8 rows (1–8) depending on code path
 *
 * After: One model file exported by all consumers ensures:
 *   - UI shows the same gate name whether rendering stepper, badge, or sidebar
 *   - current_phase logic works identically everywhere
 *   - phase_gates table names are the canonical display source
 *   - All creation paths seed 8 identical rows (phase_number 1–8, canonical names)
 */

/**
 * 8-phase project lifecycle (indices 0–7 ↔ phase_number 1–8 in DB).
 * Index matches (phase_number - 1) so phase_number 1 → CANONICAL_PHASE_NAMES[0].
 */
export const CANONICAL_PHASE_NAMES = [
  'Origination & Feasibility',
  'Permitting & Grid Application',
  'Commercial & Financial Close (RTB)',
  'Detailed Design (IFC)',
  'Procurement & Manufacturing',
  'Construction & Installation',
  'Commissioning & Grid Tests',
  'Handover & O&M',
] as const

export const TOTAL_PHASES = CANONICAL_PHASE_NAMES.length // 8

/**
 * Get the display name for a phase/gate.
 *
 * @param phaseNumber — 0-based (0=G0, 1=G1, ..., 8=G8) or 1-based phase_number from DB (1–8)
 * @param gatesMap — Optional live map from phase_gates table (phase_number → phase_name).
 *                   If provided, prioritizes DB names over canonical fallback.
 * @returns Human-readable phase name, e.g. "Origination & Feasibility"
 */
export function phaseLabel(
  phaseNumber: number | null | undefined,
  gatesMap?: Record<number, string> | null,
): string {
  if (phaseNumber == null) return 'Unknown'

  // Handle both 0-based and 1-based phase numbers
  // If calling with current_phase (0–8), use directly as index
  // If calling with DB phase_number (1–8), match against the map
  const num = Math.max(0, Math.min(phaseNumber, TOTAL_PHASES - 1))

  // If live DB map provided, use it first (real names from phase_gates)
  if (gatesMap && gatesMap[phaseNumber]) {
    return gatesMap[phaseNumber]
  }

  // Fallback to canonical names (0-based indexing)
  return CANONICAL_PHASE_NAMES[num] ?? `Phase ${phaseNumber}`
}

/**
 * Get the gate code (G0, G1, ..., G8) from a phase number.
 * @param phaseNumber — 0-based (0–8)
 * @returns "G0", "G1", etc.
 */
export function gateCode(phaseNumber: number | null | undefined): string {
  if (phaseNumber == null) return 'G0'
  const num = Math.max(0, Math.min(phaseNumber, TOTAL_PHASES - 1))
  return `G${num}`
}

/**
 * Parse a gate code ("G0", "g3", "2") into a 0-based phase number.
 * @param code — "G0", "g3", "2", or similar
 * @returns 0-based phase number (0–8), or null if invalid
 */
export function parseGateCode(code: string | null | undefined): number | null {
  if (!code) return null
  const match = /^g?(\d+)$/i.exec(code.trim())
  if (!match) return null
  const n = Number(match[1])
  return n >= 0 && n <= TOTAL_PHASES - 1 ? n : null
}

/**
 * Map of 0-based phase number → gate code (for UI rendering, lookups, etc.)
 * Useful for templates that need all gate codes: ['G0', 'G1', ..., 'G8']
 */
export const GATE_CODES = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'] as const

export type GateCode = typeof GATE_CODES[number]

/**
 * Resolve which phase_gates rows should exist for a NEW project.
 * Returns 8 rows with phase_number 1–8 and canonical names.
 * Used by createProject and createProjectFull to ensure every project
 * gets the same gate template.
 */
export function seedPhaseGatesRows(projectId: string, tenantId: string) {
  return Array.from({ length: TOTAL_PHASES }, (_, i) => ({
    tenant_id: tenantId,
    project_id: projectId,
    phase_number: i + 1, // 1–8
    phase_name: CANONICAL_PHASE_NAMES[i],
    status: 'pending' as const,
  }))
}

/**
 * Compute `projects.current_phase` from phase_gates rows.
 * Counts approved gates: phase_number of first non-approved gate - 1.
 * (phase_number 1–8, so approved gates 1+2 means current_phase = 2.)
 */
export function computeCurrentPhase(
  phaseGates: Array<{ phase_number: number; status: string }> | null | undefined,
): number {
  if (!phaseGates || phaseGates.length === 0) return 0

  // Sort by phase_number to ensure order
  const sorted = [...phaseGates].sort((a, b) => a.phase_number - b.phase_number)

  // Count approved gates to compute current_phase
  let approvedCount = 0
  for (const gate of sorted) {
    if (gate.status === 'approved') {
      approvedCount++
    } else {
      break // Stop at first non-approved
    }
  }

  return approvedCount
}

/**
 * UNIFIED GATE STATE DERIVATION — Single source of truth for all UI displays.
 * Derives all gate information from fetched phase_gates rows.
 * Returns consistent values for: completed phase label, active phase, and 1-based gate codes.
 *
 * @param phaseGates — Array of phase_gates rows from DB with phase_number (1–8), status, phase_name
 * @param currentPhase — projects.current_phase (0–8, counts approved gates)
 * @returns { completedCount, activePhase, completedLabel, activeLabel, completedGates }
 */
export interface PhaseState {
  completedCount: number // 0–8: count of approved gates
  activePhase: number // 1–8: DB phase_number of first non-approved gate (or 9 if all approved)
  completedLabel: string // e.g. "Origination & Feasibility" (name of last approved phase)
  activeLabel: string // e.g. "Permitting & Grid Application" (name of active gate)
  completedGates: string[] // 1-based gate codes: ["G1"] or ["G1", "G2"]
}

export function derivePhaseState(
  phaseGates: Array<{ phase_number: number; status: string; phase_name?: string }> | null | undefined,
  currentPhase: number | null | undefined,
): PhaseState {
  const cp = currentPhase ?? 0
  const gates = phaseGates ?? []

  // Build a map: phase_number → phase_name
  const phaseMap: Record<number, string> = {}
  for (const gate of gates) {
    if (gate.phase_number >= 1 && gate.phase_number <= TOTAL_PHASES) {
      phaseMap[gate.phase_number] = gate.phase_name || CANONICAL_PHASE_NAMES[gate.phase_number - 1]
    }
  }

  // completedCount = number of approved gates
  const completedCount = Math.min(cp, TOTAL_PHASES)

  // activePhase = first non-approved DB phase_number (1–8), or 9 if all approved
  let activePhase = 1
  for (const gate of gates) {
    if (gate.status !== 'approved') {
      activePhase = gate.phase_number
      break
    }
  }
  if (completedCount >= TOTAL_PHASES) {
    activePhase = TOTAL_PHASES + 1 // Past the last phase
  }

  // completedLabel = name of last approved phase (or "—" if none)
  const completedLabel = completedCount > 0
    ? phaseMap[completedCount] || CANONICAL_PHASE_NAMES[completedCount - 1] || '—'
    : '—'

  // activeLabel = name of active gate
  const activeLabel = activePhase <= TOTAL_PHASES
    ? phaseMap[activePhase] || CANONICAL_PHASE_NAMES[activePhase - 1] || '—'
    : '—'

  // completedGates = 1-based gate codes ["G1"], ["G1", "G2"], etc.
  const completedGates = Array.from(
    { length: completedCount },
    (_, i) => `G${i + 1}`,
  )

  return {
    completedCount,
    activePhase,
    completedLabel,
    activeLabel,
    completedGates,
  }
}
