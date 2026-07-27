'use client'

import * as React from 'react'
import useSWR from 'swr'
import { getProjects } from '@/app/actions/projects'
import { useSession } from '@/lib/session-context'

export interface FieldProject {
  id: string
  code: string
  name: string
  status: string
}

interface FieldContextValue {
  projects: FieldProject[]
  loadingProjects: boolean
  projectId: string | null
  setProjectId: (id: string) => void
  project: FieldProject | null
  online: boolean
  canWrite: boolean
  userId: string
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

const STORAGE_KEY = 'field-selected-project'

export function FieldProvider({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const canWrite = session.isSuperAdmin || !session.roles.includes('viewer')

  const { data, isLoading } = useSWR('field-projects', () => getProjects())
  const projects: FieldProject[] = React.useMemo(
    () =>
      (data ?? []).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        status: String(p.status ?? ''),
      })),
    [data],
  )

  // Read localStorage synchronously so the initial render already has the saved value.
  // A useEffect-based restore races with the "default to first project" effect because
  // React batches the setState from the restore effect, leaving projectId=null until the
  // next paint — by which time the default effect fires and overwrites the saved choice.
  const [projectId, setProjectIdState] = React.useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem(STORAGE_KEY)
  })

  // Default to the first project once loaded (only if the user has never chosen one).
  React.useEffect(() => {
    if (!projectId && projects.length > 0) setProjectIdState(projects[0].id)
  }, [projects, projectId])

  const setProjectId = React.useCallback((id: string) => {
    setProjectIdState(id)
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, id)
  }, [])

  // Online / offline tracking.
  const [online, setOnline] = React.useState(true)
  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  const project = React.useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  )

  const value: FieldContextValue = React.useMemo(() => ({
    projects,
    loadingProjects: isLoading,
    projectId,
    setProjectId,
    project,
    online,
    canWrite,
    userId: session.userId,
  }), [projects, isLoading, projectId, project, online, canWrite, session.userId])

  return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
}

export function useField(): FieldContextValue {
  const ctx = React.useContext(FieldContext)
  if (!ctx) throw new Error('useField must be used within a FieldProvider')
  return ctx
}

/** Convenience accessor for the currently-selected project id. */
export function useFieldProject(): { activeProjectId: string | null; setActiveProjectId: (id: string) => void } {
  const { projectId, setProjectId } = useField()
  return { activeProjectId: projectId, setActiveProjectId: setProjectId }
}
