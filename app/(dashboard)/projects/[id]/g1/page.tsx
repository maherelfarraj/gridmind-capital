import { redirect } from 'next/navigation'

/**
 * Old /g1 route → new /gate/1 (Origination & Feasibility)
 * Redirect to single source of truth.
 */
export default async function G1RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/1`)
}
