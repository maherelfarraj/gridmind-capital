import { ProjectCommandCenter } from '@/components/layout/ProjectCommandCenter'

/**
 * Next.js Suspense boundary loading state for /projects/[id].
 * Renders the ProjectCommandCenter skeleton so the full shimmer
 * effect is shown while the page data resolves.
 */
export default function ProjectDetailLoading() {
  return <ProjectCommandCenter loading={true} />
}
