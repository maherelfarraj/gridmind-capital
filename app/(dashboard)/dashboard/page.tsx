'use client'

import { useRouter } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { useSession } from '@/lib/session-context'

export default function Page() {
  const router  = useRouter()
  const session = useSession()

  return (
    <DashboardPage
      userName={session.fullName}
      onNewProject={() => router.push('/projects/new')}
      onApprovalClick={(id) => router.push(`/approvals/${id}`)}
      onProjectClick={(p) => router.push(`/projects/${p.id}`)}
    />
  )
}
