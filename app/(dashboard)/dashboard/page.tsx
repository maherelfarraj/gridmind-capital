import { DashboardPageClientWrapper } from '@/components/dashboard/dashboard-page-client-wrapper'
import { getDashboardStats, getDashboardProjects, getDashboardApprovals } from '@/app/actions/dashboard'

// Server component: fetch all data in parallel
export default async function Page() {
  // Fetch all dashboard data server-side in parallel
  const [stats, projects, approvals] = await Promise.all([
    getDashboardStats(),
    getDashboardProjects(),
    getDashboardApprovals(),
  ])

  // Pass server-fetched data to client component
  return (
    <DashboardPageClientWrapper
      initialStats={stats}
      initialProjects={projects}
      initialApprovals={approvals}
    />
  )
}
