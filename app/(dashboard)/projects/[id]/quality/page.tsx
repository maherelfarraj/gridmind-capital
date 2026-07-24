import { ItpDashboard } from '@/components/quality/itp-dashboard'

export default async function QualityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // canManage is passed as true for now; in production derive from session.roles
  return <ItpDashboard projectId={id} canManage />
}
