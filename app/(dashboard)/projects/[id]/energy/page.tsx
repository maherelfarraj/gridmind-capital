import type { Metadata } from 'next'
import { EnergyDashboard } from '@/components/energy/energy-dashboard'

export const metadata: Metadata = { title: 'Energy Performance' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EnergyDashboard projectId={id} />
}
