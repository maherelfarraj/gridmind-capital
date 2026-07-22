'use client'

/**
 * LivePhaseGateStepper
 * ─────────────────────
 * Client wrapper that fetches the live gate state for a project from the DB
 * (via getProjectGateState server action + SWR) and passes it to the
 * presentational PhaseGateStepper component.
 *
 * Falls back to the hardcoded props when projectId is not provided or
 * while data is loading, so all existing gate pages keep working unchanged.
 */

import useSWR from 'swr'
import {
  PhaseGateStepper,
  PhaseGateStepperSkeleton,
  type PhaseGateStepperProps,
} from '@/components/project/phase-gate-stepper'
import { getProjectGateState } from '@/app/actions/phase-gates'

interface LivePhaseGateStepperProps extends PhaseGateStepperProps {
  /** If provided, the stepper reads live gate state from the DB. */
  projectId?: string
}

export function LivePhaseGateStepper({
  projectId,
  currentGate: fallbackCurrent,
  completedGates: fallbackCompleted,
  ...rest
}: LivePhaseGateStepperProps) {
  const { data, isLoading } = useSWR(
    projectId ? `gate-state-${projectId}` : null,
    () => getProjectGateState(projectId!),
    { revalidateOnFocus: true },
  )

  if (projectId && isLoading) return <PhaseGateStepperSkeleton />

  const currentGate   = data?.currentGate   ?? fallbackCurrent
  const completedGates = data?.completedGates ?? fallbackCompleted

  return (
    <PhaseGateStepper
      currentGate={currentGate}
      completedGates={completedGates}
      {...rest}
    />
  )
}
