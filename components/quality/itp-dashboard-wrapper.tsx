'use client'

import dynamic from 'next/dynamic'

const ItpDashboard = dynamic(() => import('./itp-dashboard').then(m => ({ default: m.ItpDashboard })), {
  ssr: false,
  loading: () => <div className="h-screen bg-muted animate-pulse" />,
})

interface ItpDashboardWrapperProps {
  projectId: string
  canManage: boolean
}

export function ItpDashboardWrapper({ projectId, canManage }: ItpDashboardWrapperProps) {
  return <ItpDashboard projectId={projectId} canManage={canManage} />
}
