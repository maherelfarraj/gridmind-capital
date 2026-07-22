import { FinanceRegisters } from '@/components/projects/finance-registers'

export default async function ProjectFinancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <FinanceRegisters projectId={id} />
}
