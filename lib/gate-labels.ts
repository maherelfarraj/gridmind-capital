/**
 * Gate label resolution utility.
 * Maps gate codes (G0–G6) to real phase_names from phase_gates table.
 * Falls back to hardcoded labels if phase_names not available.
 */

const GATE_CODE_TO_PHASE_NUMBER: Record<string, number> = {
  'G0': 0, 'G1': 1, 'G2': 2, 'G3': 3, 'G4': 4, 'G5': 5, 'G6': 6, 'G7': 7, 'G8': 8,
}

const FALLBACK_LABELS: Record<number, string> = {
  0: 'Opportunity Accepted',
  1: 'Baseline Approved',
  2: 'Engineering IFC',
  3: 'Procurement Award',
  4: 'Construction Mobilization',
  5: 'Mechanical Completion',
  6: 'Handover & O&M',
  7: 'Handover & O&M',
  8: 'Closed Out',
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
