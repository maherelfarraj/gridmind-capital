import { redirect } from 'next/navigation'

/**
 * Old /g6 route → G6 (Construction) maps to workspace /gate/4 (Construction)
 * Redirect to single source of truth.
 */
export default async function G6RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/4`)
}
