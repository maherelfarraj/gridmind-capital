'use client'

import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { useSession } from '@/lib/session-context'
import { getDashboardStats, getDashboardProjects, getDashboardApprovals } from '@/app/actions/dashboard'

export default function Page() {
  const router  = useRouter()
  const session = useSession()

  const { data: stats,     isLoading: sl } = useSWR('dashboard-stats',     getDashboardStats)
  const { data: projects,  isLoading: pl } = useSWR('dashboard-projects',  getDashboardProjects)
  const { data: approvals, isLoading: al } = useSWR('dashboard-approvals', getDashboardApprovals)

  return (
    <DashboardPage
      userName={session.fullName}
      stats={stats}
      projects={projects}
      approvals={approvals}
      loading={sl || pl || al}
      onNewProject={() => router.push('/projects/new')}
      onApprovalClick={(id) => router.push(`/approvals/${id}`)}
      onProjectClick={(p) => router.push(`/projects/${p.id}`)}
    />
  )
}
