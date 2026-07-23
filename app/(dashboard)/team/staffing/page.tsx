import { redirect } from 'next/navigation'

// Staffing is now owned by the Team Assignment board at /team (Phase 5).
export default async function StaffingRedirect({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  redirect(project ? `/team?project=${project}` : '/team')
}
