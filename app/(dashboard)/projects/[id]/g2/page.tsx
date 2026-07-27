import { redirect } from 'next/navigation'

/**
 * Old /g2 route → new /gate/4 (Detailed Design IFC)
 * Redirect to single source of truth.
 */
export default async function G2RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/4`)
}
