import { redirect } from 'next/navigation'

/**
 * G0 (Opportunity Intake) has no phase_gates row — it lives in the project detail page.
 * Redirect to project detail to avoid 404 from old bookmarks.
 */
export default async function G0RedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/projects/${id}`)
}
