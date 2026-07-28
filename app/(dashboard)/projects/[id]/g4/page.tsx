import { redirect } from 'next/navigation'

/**
 * Old /g4 route → G4 (Detailed Design) maps to workspace /gate/2 (Engineering)
 * Redirect to single source of truth.
 */
export default async function G4RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/2`)
}
