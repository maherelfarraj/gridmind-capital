import { redirect } from 'next/navigation'

/**
 * Old /g2 route → G2 (Permitting & Grid Application) has no workspace form yet.
 * Redirect to projects list as this gate isn't actionable yet.
 */
export default async function G2RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/projects/${id}`)
}
