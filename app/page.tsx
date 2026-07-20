import { AppShell } from '@/components/app-shell'
import { ToastProvider } from '@/components/ui/toast'
import { ProjectCommandCenterDemo } from '@/components/project/project-command-center-demo'
import { PhaseGateStepperDemo } from '@/components/project/phase-gate-stepper-demo'

export default function Home() {
  return (
    <AppShell
      title="Sirius 400MW Solar Farm"
      breadcrumbs={[
        { label: 'Projects', href: '/projects' },
        { label: 'Sirius 400MW Solar Farm' },
      ]}
      notificationCount={3}
      approvalCount={4}
    >
      <ToastProvider position="bottom-right">
        <div className="space-y-6">
          <ProjectCommandCenterDemo />
          <PhaseGateStepperDemo />
        </div>
      </ToastProvider>
    </AppShell>
  )
}
