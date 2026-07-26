'use client'

import useSWR from 'swr'
import { getProject } from '@/app/actions/projects'

/**
 * Live "current gate" status badge.
 *
 * Gate sub-pages are server components, so their gate badge was rendered once
 * on the server. After a gate approval advanced projects.current_phase, the
 * badge could keep showing the previous gate until a hard reload — the classic
 * "stepper and status panel disagree" symptom. Reading the project through SWR
 * (same key the stepper uses, so both revalidate together) keeps them in sync.
 */
export function LiveGateBadge({
  projectId,
  fallbackGate,
  fallbackGateName,
}: {
  projectId: string
  fallbackGate: number
  fallbackGateName: string
}) {
  const { data: project } = useSWR(
    projectId ? `project-${projectId}` : null,
    () => getProject(projectId),
    { revalidateOnMount: true, revalidateOnFocus: true },
  )

  console.log('[v0] LiveGateBadge swr gate:', project?.gate, '| fallback:', fallbackGate, '| code:', project?.code)
  const gate = typeof project?.gate === 'number' ? project.gate : fallbackGate
  const gateName = project?.gateName ?? fallbackGateName

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground shrink-0">
      <span className="size-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} aria-hidden />
      G{gate} · {gateName}
    </span>
  )
}
