/**
 * Re-export shim for PhaseGateStepper.
 *
 * The canonical implementation lives at:
 *   @/components/project/phase-gate-stepper
 *
 * This file satisfies the deployment convention of placing layout
 * components under /components/layout/ without duplicating any code.
 *
 * Usage (matches spec exactly):
 *   import { PhaseGateStepper } from '@/components/layout/PhaseGateStepper'
 *   <PhaseGateStepper currentGate="G2" completedGates={["G0", "G1"]} />
 */

export {
  PhaseGateStepper,
  GATE_DEFINITIONS,
} from '@/components/project/phase-gate-stepper'

export type {
  PhaseGateStepperProps,
  GateDef,
  GateState,
} from '@/components/project/phase-gate-stepper'
