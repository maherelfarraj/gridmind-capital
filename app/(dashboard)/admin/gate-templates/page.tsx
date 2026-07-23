import { Metadata } from 'next'
import { GateTemplatesPage } from '@/components/admin/gate-templates-page'

export const metadata: Metadata = {
  title: 'Gate Templates — GridMind Capital',
  description: 'Reusable stage-gate deliverable checklists offered to the Project Creation Wizard.',
}

export default function AdminGateTemplatesPage() {
  return (
    <main className="flex flex-col h-full p-6">
      <GateTemplatesPage />
    </main>
  )
}
