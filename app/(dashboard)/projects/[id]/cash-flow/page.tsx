import { CashFlowTracker } from '@/components/projects/cash-flow-tracker'

export default async function CashFlowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CashFlowTracker projectId={id} />
}
