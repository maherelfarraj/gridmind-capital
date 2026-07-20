'use client'

import { useRouter } from 'next/navigation'
import { ProjectsListPage, type Project } from '@/components/projects/projects-list-page'

export default function Page() {
  const router = useRouter()

  return (
    <ProjectsListPage
      onNewProject={() => router.push('/projects/new')}
      onRowClick={(project: Project) => router.push(`/projects/${project.id}`)}
      onExport={() => {/* export handler */}}
    />
  )
}
