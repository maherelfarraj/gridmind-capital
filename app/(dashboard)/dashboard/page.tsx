'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ToastProvider } from '@/components/ui/toast'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { HelpHubPanel } from '@/components/help/help-hub-panel'

export default function Page() {
  const router = useRouter()
  return (
    <ToastProvider position="bottom-right">
      <DashboardPage
        onApprovalClick={(id) => router.push(`/approvals/${id}`)}
        onProjectClick={(p) => router.push(`/projects/${p.id}`)}
      />
      <HelpHubPanel context="Dashboard" userRole="ADMIN" />
    </ToastProvider>
  )
}
