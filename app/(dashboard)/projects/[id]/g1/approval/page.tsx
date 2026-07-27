import { redirect } from 'next/navigation'

/**
 * Retired route — kept only so existing bookmarks and emailed links resolve.
 *
 * This page used to render a fully mocked G1 approval workflow (DEMO_PROJECT,
 * DEMO_APPROVERS, a hardcoded CURRENT_USER) whose "Submit decision" handler
 * passed the PROJECT id to `decideApproval`, which expects an APPROVAL id, and
 * never revalidated. It could not approve anything, but it looked like it could.
 *
 * The real, governed approval flow is `/team/gates` (per-user authz, sign-off
 * guard, audit trail). Rebuilding this page would create a second competing
 * approval flow, so it redirects instead.
 */
export default async function G1ApprovalRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // `/team/gates` reads `?project=` and falls back to the first project when
  // the id is absent, so forwarding the id keeps the user on their project.
  redirect(`/team/gates?project=${encodeURIComponent(id)}`)
}
