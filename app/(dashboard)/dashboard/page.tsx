'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { CustomizableDashboard } from '@/components/dashboard/customizable-dashboard'
import { useSession } from '@/lib/session-context'
import { getDashboardStats, getDashboardProjects, getDashboardApprovals } from '@/app/actions/dashboard'
import { useRealtime } from '@/lib/realtime/use-realtime'
import { LiveIndicator } from '@/components/realtime/live-indicator'

export default function Page() {
  const router  = useRouter()
  const session = useSession()
  const [flash, setFlash] = React.useState(false)

  const { data: stats,     isLoading: sl, mutate: ms } = useSWR('dashboard-stats',     getDashboardStats)
  const { data: projects,  isLoading: pl, mutate: mp } = useSWR('dashboard-projects',  getDashboardProjects)
  const { data: approvals, isLoading: al, mutate: ma } = useSWR('dashboard-approvals', getDashboardApprovals)

  const handleChange = React.useCallback(() => {
    ms(); mp(); ma()
    setFlash(true)
    setTimeout(() => setFlash(false), 800)
  }, [ms, mp, ma])

  // Subscribe to live changes on projects + approvals tables
  useRealtime({ table: 'projects',  onchange: handleChange })
  useRealtime({ table: 'approvals', onchange: handleChange })

  return (
    <div className="relative space-y-8">
      {/* Live indicator top-right */}
      <div className="absolute -top-8 right-0 hidden md:block">
        <LiveIndicator flash={flash} />
      </div>

      {/* ── Customizable widget dashboard ── */}
      <CustomizableDashboard />

      {/* ── Legacy stats + project list ── */}
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
    </div>
  )
}
