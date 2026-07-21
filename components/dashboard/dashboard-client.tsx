'use client'

import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/session-context'
import { DashboardPage, type DashboardStats, type DashboardProject } from './dashboard-page'
import type { ApprovalItem } from './dashboard-data'

interface Props {
  stats:     DashboardStats
  projects:  DashboardProject[]
  approvals: ApprovalItem[]
}

export function DashboardClient({ stats, projects, approvals }: Props) {
  const router  = useRouter()
  const session = useSession()

  return (
    <DashboardPage
      userName={session.fullName}
      stats={stats}
      projects={projects}
      approvals={approvals}
      loading={false}
      onNewProject={() => router.push('/projects/new')}
      onApprovalClick={(id) => router.push(`/approvals/${id}`)}
      onProjectClick={(p) => router.push(`/projects/${p.id}`)}
    />
  )
}
