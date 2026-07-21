'use client'

import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { useSession } from '@/lib/session-context'
import { getDashboardStats, getDashboardProjects, getDashboardApprovals } from '@/app/actions/dashboard'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

export default function Page() {
  const router  = useRouter()
  const session = useSession()

  const tenantId = session.tenantId ?? TENANT_ID

  const { data: stats, isLoading: statsLoading } = useSWR(
    ['dashboard-stats', tenantId],
    () => getDashboardStats(tenantId),
  )

  const { data: projects, isLoading: projectsLoading } = useSWR(
    ['dashboard-projects', tenantId],
    () => getDashboardProjects(tenantId),
  )

  const { data: approvals, isLoading: approvalsLoading } = useSWR(
    ['dashboard-approvals', tenantId],
    () => getDashboardApprovals(tenantId),
  )

  const loading = statsLoading || projectsLoading || approvalsLoading

  return (
    <DashboardPage
      userName={session.fullName}
      stats={stats}
      projects={projects}
      approvals={approvals}
      loading={loading}
      onNewProject={() => router.push('/projects/new')}
      onApprovalClick={(id) => router.push(`/approvals/${id}`)}
      onProjectClick={(p) => router.push(`/projects/${p.id}`)}
    />
  )
}
