import { ToastProvider } from '@/components/ui/toast'
import { StageGateReviewPage } from '@/components/stage-gate/stage-gate-review-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'
import { PhaseGateStepper } from '@/components/project/phase-gate-stepper'

export const metadata = { title: 'Stage Gates — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      {/* PhaseGateStepper — spec preview: currentGate="G2", completedGates=["G0","G1"] */}
      <div className="mb-6">
        <PhaseGateStepper
          currentGate="G2"
          completedGates={['G0', 'G1']}
        />
      </div>
      <StageGateReviewPage />
      <HelpHubPanel context="Stage Gates" userRole="ADMIN" />
    </ToastProvider>
  )
}
