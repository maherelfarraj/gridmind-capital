import { StageGateReviewPage } from '@/components/stage-gate/stage-gate-review-page'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'

export const metadata = { title: 'Stage Gates — GridMind Capital' }

export default function Page() {
  return (
    <>
      <div className="mb-6">
        <PhaseGateStepper
          currentGate="G2"
          completedGates={['G0', 'G1']}
        />
      </div>
      <StageGateReviewPage />
    </>
  )
}
