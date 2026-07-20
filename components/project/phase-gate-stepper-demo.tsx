'use client'

import * as React from 'react'
import { PhaseGateStepper, PhaseGateStepperSkeleton, type GateDef, type GateState } from './phase-gate-stepper'
import { Button } from '@/components/ui/button'

const PRESETS = [
  { label: 'G0 — New Opportunity',     currentGate: 0, completedGates: [] },
  { label: 'G4 — In Construction',      currentGate: 4, completedGates: [0, 1, 2, 3] },
  { label: 'G6 — Commissioning',        currentGate: 6, completedGates: [0, 1, 2, 3, 4, 5] },
  { label: 'G9 — AI Optimisation',      currentGate: 9, completedGates: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
] as const

export function PhaseGateStepperDemo() {
  const [preset, setPreset] = React.useState(1) // default: G4 In Construction
  const [loading, setLoading] = React.useState(false)

  const current = PRESETS[preset]

  function handleSkeleton() {
    setLoading(true)
    setTimeout(() => setLoading(false), 1800)
  }

  function handleGateClick(gate: GateDef, state: GateState) {
    // Panel opens automatically inside PhaseGateStepper
    void gate; void state
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Preset:</span>
        {PRESETS.map((p, i) => (
          <Button
            key={i}
            variant={preset === i ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPreset(i)}
          >
            {p.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkeleton}
          className="ml-auto"
        >
          Toggle Skeleton
        </Button>
      </div>

      {/* Component */}
      {loading ? (
        <PhaseGateStepperSkeleton />
      ) : (
        <PhaseGateStepper
          currentGate={current.currentGate}
          completedGates={[...current.completedGates]}
          onGateClick={handleGateClick}
        />
      )}
    </div>
  )
}
