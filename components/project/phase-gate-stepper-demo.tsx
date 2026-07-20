'use client'

import * as React from 'react'
import { PhaseGateStepper, PhaseGateStepperSkeleton, type GateDef, type GateState } from './phase-gate-stepper'
import { Button } from '@/components/ui/button'

const PRESETS = [
  { label: 'G0 — New Opportunity',  currentGate: 'G0', completedGates: [] as string[] },
  { label: 'G4 — In Construction',  currentGate: 'G4', completedGates: ['G0','G1','G2','G3'] },
  { label: 'G6 — Commissioning',    currentGate: 'G6', completedGates: ['G0','G1','G2','G3','G4','G5'] },
  { label: 'G9 — AI Optimisation',  currentGate: 'G9', completedGates: ['G0','G1','G2','G3','G4','G5','G6','G7','G8'] },
]

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
