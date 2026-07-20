'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ToastProvider } from '@/components/ui/toast'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { HelpHubPanel } from '@/components/layout/HelpHubPanel'
import { useSession } from '@/lib/session-context'

/**
 * Route: / (root of the (dashboard) layout group)
 * Renders the main dashboard — stat cards, recent projects table,
 * pending approvals widget, and Quick Actions bar.
 * Uses the same DashboardPage component as /dashboard for DRY parity.
 */
export default function Page() {
  const router  = useRouter()
  const session = useSession()

  return (
    <ToastProvider position="bottom-right">
      <DashboardPage
        userName={session.fullName}
        onNewProject={() => router.push('/projects/new')}
        onApprovalClick={(id) => router.push(`/approvals/${id}`)}
        onProjectClick={(p) => router.push(`/projects/${p.id}`)}
      />
      <HelpHubPanel contextModule="general" userRole={session.roles[0]} />
    </ToastProvider>
  )
}
