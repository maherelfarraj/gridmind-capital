import { ApprovalsPageClient } from '@/components/approvals/approvals-page-client'
import { loadApprovalsDashboard } from '@/app/actions/approvals'

// Server component: fetch approvals data
export default async function ApprovalsPage() {
  const dashboard = await loadApprovalsDashboard()

  // Pass server-fetched data to client component
  return <ApprovalsPageClient initialDashboard={dashboard} />
}
