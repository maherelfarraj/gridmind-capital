'use client'

import dynamic from 'next/dynamic'

const EnergyDashboard = dynamic(() => import('./energy-dashboard').then(m => ({ default: m.EnergyDashboard })), {
  ssr: false,
  loading: () => <div className="h-screen bg-muted animate-pulse" />,
})

interface EnergyDashboardWrapperProps {
  projectId: string
}

export function EnergyDashboardWrapper({ projectId }: EnergyDashboardWrapperProps) {
  return <EnergyDashboard projectId={projectId} />
}
