import type { Metadata } from 'next'
import { CostControlDashboard } from '@/components/projects/cost-control-dashboard'

export const metadata: Metadata = { title: 'Cost Control' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CostControlDashboard projectId={id} />
}
