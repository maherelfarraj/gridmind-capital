import { redirect } from 'next/navigation'
import { resolveActorState } from '@/lib/auth/actor'
import { adminDecision } from '@/lib/auth/routing'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Previously this layout ran its own identity lookup that (a) filtered the
  // profile by a hardcoded demo tenant UUID, so admins in any real tenant were
  // bounced out, and (b) never checked is_active, so a deactivated admin in
  // that one tenant still passed. It now uses the canonical resolver, which
  // enforces authentication, profile existence, is_active, tenant, and role.
  const state = await resolveActorState()

  // No local ADMIN_ROLES copy: adminDecision() applies the canonical
  // PLATFORM_ADMIN_ROLES group, and is the exact function the tests exercise.
  const decision = adminDecision(state)

  if (decision.action === 'redirect') {
    redirect(decision.to)
  }

  return <>{children}</>
}
