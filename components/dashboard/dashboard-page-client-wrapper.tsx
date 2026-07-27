'use client'

import dynamic from 'next/dynamic'
import { getDashboardStats, getDashboardProjects, getDashboardApprovals } from '@/app/actions/dashboard'

const DashboardPageClient = dynamic(() => import('./dashboard-page-client').then(m => ({ default: m.DashboardPageClient })), {
  ssr: false,
  loading: () => <div className="h-screen bg-muted animate-pulse" />,
})

interface DashboardPageClientWrapperProps {
  initialStats: Awaited<ReturnType<typeof getDashboardStats>>
  initialProjects: Awaited<ReturnType<typeof getDashboardProjects>>
  initialApprovals: Awaited<ReturnType<typeof getDashboardApprovals>>
}

export function DashboardPageClientWrapper({
  initialStats,
  initialProjects,
  initialApprovals,
}: DashboardPageClientWrapperProps) {
  return (
    <DashboardPageClient
      initialStats={initialStats}
      initialProjects={initialProjects}
      initialApprovals={initialApprovals}
    />
  )
}
