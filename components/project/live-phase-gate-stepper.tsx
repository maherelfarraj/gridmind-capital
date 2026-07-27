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
  type GateScheduleDates,
} from '@/components/project/phase-gate-stepper'
import { getProjectGateState } from '@/app/actions/phase-gates'
import { getGateSchedule } from '@/app/actions/schedule'

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

  // Schedule-derived gate dates (best-effort; never blocks the stepper).
  const { data: gateSchedule } = useSWR(
    projectId ? `gate-schedule-${projectId}` : null,
    () => getGateSchedule(projectId!),
  )

  if (projectId && isLoading) return <PhaseGateStepperSkeleton />

  const currentGate   = data?.currentGate   ?? fallbackCurrent
  const completedGates = data?.completedGates ?? fallbackCompleted

  const gateDates: Record<number, GateScheduleDates> | undefined = gateSchedule?.length
    ? Object.fromEntries(
        gateSchedule.map((g) => [
          g.gateNumber,
          {
            plannedStart:  g.plannedStart,
            plannedFinish: g.plannedFinish,
            actualStart:   g.actualStart,
            actualFinish:  g.actualFinish,
          },
        ]),
      )
    : undefined

  return (
    <PhaseGateStepper
      currentGate={currentGate}
      completedGates={completedGates}
      gateDates={gateDates}
      gateNames={data?.gateNames}
      {...rest}
    />
  )
}
