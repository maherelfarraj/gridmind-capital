'use client'

import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { ProjectsListPage, type Project } from '@/components/projects/projects-list-page'
import { getProjects } from '@/app/actions/projects'
import { useSession } from '@/lib/session-context'

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

export default function Page() {
  const router   = useRouter()
  const session  = useSession()
  const tenantId = session.tenantId ?? TENANT_ID

  const { data: projects, isLoading } = useSWR('projects', getProjects)

  return (
    <ProjectsListPage
      projects={projects}
      isLoading={isLoading}
      onNewProject={() => router.push('/projects/new')}
      onRowClick={(project: Project) => router.push(`/projects/${project.id}`)}
      onExport={() => {/* export handler */}}
    />
  )
}
