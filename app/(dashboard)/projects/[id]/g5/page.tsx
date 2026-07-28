import { redirect } from 'next/navigation'

/**
 * Old /g5 route → G5 (Procurement) maps to workspace /gate/3 (Procurement)
 * Redirect to single source of truth.
 */
export default async function G5RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/stage-gates/${id}/gate/3`)
}
