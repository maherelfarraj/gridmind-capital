/**
 * Gate label resolution utility.
 * Maps gate codes (G0–G6) to real phase_names from phase_gates table.
 * Falls back to hardcoded labels if phase_names not available.
 */

const GATE_CODE_TO_PHASE_NUMBER: Record<string, number> = {
  'G0': 0, 'G1': 1, 'G2': 2, 'G3': 3, 'G4': 4, 'G5': 5, 'G6': 6, 'G7': 7, 'G8': 8,
}

const FALLBACK_LABELS: Record<number, string> = {
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

/**
 * Resolve the display label for a gate code, using real phase_name if available.
 * @param gateCode e.g. 'G2'
 * @param gateNames map of phase_number → phase_name (from phase_gates)
 * @returns e.g. 'G2 · Permitting & Grid Application' or 'G2 · Engineering IFC' (fallback)
 */
export function resolveGateLabel(
  gateCode: string,
  gateNames?: Record<number, string>
): string {
  const phaseNum = GATE_CODE_TO_PHASE_NUMBER[gateCode]
  if (typeof phaseNum !== 'number') return gateCode

  // Use real phase_name if available, else fallback
  const phaseName = gateNames?.[phaseNum] ?? FALLBACK_LABELS[phaseNum]
  return `${gateCode} · ${phaseName}`
}

/**
 * Get just the phase_name part (without gate code).
 */
export function resolveGateName(
  gateCode: string,
  gateNames?: Record<number, string>
): string {
  const phaseNum = GATE_CODE_TO_PHASE_NUMBER[gateCode]
  if (typeof phaseNum !== 'number') return gateCode
  return gateNames?.[phaseNum] ?? FALLBACK_LABELS[phaseNum] ?? gateCode
}
