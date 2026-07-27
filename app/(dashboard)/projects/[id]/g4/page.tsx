import { redirect } from 'next/navigation'

/**
 * Old /g4 route → new /gate/6 (Construction & Installation)
 * Redirect to single source of truth.
 */
export default async function G4RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/6`)
}
