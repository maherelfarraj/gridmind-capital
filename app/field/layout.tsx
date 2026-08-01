import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SessionProvider } from '@/lib/session-context'
import { resolveSessionState } from '@/lib/auth/resolve-session'
import { fieldDecision } from '@/lib/auth/routing'
import { FieldShell } from '@/components/field/field-shell'

export const metadata: Metadata = {
  title: 'Field Mode',
  description: 'Mobile field reporting — daily reports, punch items and site photos.',
}

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  // resolveSessionState() distinguishes "not signed in" from "signed in but not
  // provisioned". The previous resolveSession() collapsed both to null and sent
  // an authenticated-but-unprovisioned user to a login page they had already
  // completed, which loops.
  const state = await resolveSessionState()

  // Field access is decided by the exhaustive writer classification via
  // fieldDecision(), not by a locally maintained blocked-role list. That list
  // blocked a phantom `client_pmc` role while admitting `viewer`.
  const decision = fieldDecision(state)

  if (decision.action === 'redirect') {
    redirect(decision.to)
  }

  // Only an `active` writer session reaches here; narrow before providing it.
  if (state.kind !== 'active') redirect('/auth/login')

  return (
    <SessionProvider session={state.session}>
      <FieldShell>{children}</FieldShell>
    </SessionProvider>
  )
}
