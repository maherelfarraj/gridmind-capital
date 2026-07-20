import { ToastProvider } from '@/components/ui/toast'
import { NewProjectWizardPage } from '@/components/projects/new-project-wizard'

export const metadata = { title: 'New Project — GridMind Capital' }

export default function Page() {
  return (
    <ToastProvider position="bottom-right">
      <NewProjectWizardPage />
    </ToastProvider>
  )
}
