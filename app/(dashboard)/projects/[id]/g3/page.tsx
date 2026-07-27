import { redirect } from 'next/navigation'

/**
 * Old /g3 route → new /gate/5 (Procurement & Manufacturing)
 * Redirect to single source of truth.
 */
export default async function G3RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/5`)
}
