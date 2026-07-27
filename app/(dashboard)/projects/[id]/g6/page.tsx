import { redirect } from 'next/navigation'

/**
 * Old /g6 route → new /gate/7 (Commissioning & Grid Tests)
 * Redirect to single source of truth.
 */
export default async function G6RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/7`)
}
