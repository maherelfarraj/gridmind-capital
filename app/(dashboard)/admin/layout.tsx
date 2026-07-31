import { redirect } from 'next/navigation'
import { resolveActorState } from '@/lib/auth/actor'

/** Platform roles permitted to reach /admin/*. */
const ADMIN_ROLES = ['system_admin', 'tenant_admin'] as const

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

  if (state.kind === 'invalid') {
    if (state.reason === 'not_authenticated') redirect('/auth/login')
    // Authenticated but not usable — the dashboard layout renders the
    // account-setup screen for this case.
    redirect('/dashboard')
  }

  if (!(ADMIN_ROLES as readonly string[]).includes(state.actor.role)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
