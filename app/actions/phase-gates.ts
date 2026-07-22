'use server'

import { createAdminClient } from '@/lib/supabase/admin'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

const GATE_ORDER = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'] as const
type GateCode = typeof GATE_ORDER[number]

export interface ProjectGateState {
  currentGate: GateCode
  completedGates: GateCode[]
  approvedThrough: number   // gate index (0-6) — -1 = none approved
}

/**
 * Derive live gate state from the project's current_phase column.
 * current_phase is a 0-based integer (0=G0, 1=G1, … 6=G6).
 */
export async function getProjectGateState(projectId: string): Promise<ProjectGateState> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('projects')
    .select('current_phase, status')
    .eq('id', projectId)
    .eq('tenant_id', DEMO_TENANT)
    .single()

  const phase = typeof data?.current_phase === 'number' ? data.current_phase : 0
  const gateIdx = Math.min(Math.max(phase, 0), 6)

  const currentGate = GATE_ORDER[gateIdx]
  const completedGates = GATE_ORDER.slice(0, gateIdx) as GateCode[]

  return { currentGate, completedGates, approvedThrough: gateIdx - 1 }
}

/**
 * Advance a project to the next gate.
 * Increments current_phase by 1 (capped at 6).
 */
export async function advanceProjectGate(
  projectId: string,
): Promise<{ error?: string; newGate?: GateCode }> {
  const supabase = createAdminClient()

  const { data: proj } = await supabase
    .from('projects')
    .select('current_phase')
    .eq('id', projectId)
    .eq('tenant_id', DEMO_TENANT)
    .single()

  if (!proj) return { error: 'Project not found' }
  const current = typeof proj.current_phase === 'number' ? proj.current_phase : 0
  const next = Math.min(current + 1, 6)

  const { error } = await supabase
    .from('projects')
    .update({ current_phase: next })
    .eq('id', projectId)
    .eq('tenant_id', DEMO_TENANT)

  return error ? { error: error.message } : { newGate: GATE_ORDER[next] }
}
