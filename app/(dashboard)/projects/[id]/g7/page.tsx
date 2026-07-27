import { redirect } from 'next/navigation'

/**
 * Old /g7 route → new /gate/8 (Handover & O&M)
 * Redirect to single source of truth.
 */
export default async function G7RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/8`)
}
