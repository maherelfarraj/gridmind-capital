import type { Metadata } from 'next'
import { EnergyDashboardWrapper } from '@/components/energy/energy-dashboard-wrapper'

export const metadata: Metadata = { title: 'Energy Performance' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EnergyDashboardWrapper projectId={id} />
}
