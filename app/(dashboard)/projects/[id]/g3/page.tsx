import { redirect } from 'next/navigation'

/**
 * Old /g3 route → G3 (Commercial Close) has no workspace form yet.
 * Redirect to projects list as this gate isn't actionable yet.
 */
export default async function G3RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/projects/${id}`)
}
