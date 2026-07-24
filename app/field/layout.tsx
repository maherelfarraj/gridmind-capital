import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SessionProvider } from '@/lib/session-context'
import { resolveSession } from '@/lib/auth/resolve-session'
import { FieldShell } from '@/components/field/field-shell'

export const metadata: Metadata = {
  title: 'Field Mode',
  description: 'Mobile field reporting — daily reports, punch items and site photos.',
}

// External viewer roles have no place in the field workflow.
const BLOCKED_ROLES = ['client_viewer', 'subcontractor', 'client_pmc']

export default async function FieldLayout({ children }: { children: React.ReactNode }) {
  const session = await resolveSession()
  if (!session) redirect('/auth/login')
  if (session.roles.some((r) => BLOCKED_ROLES.includes(r))) redirect('/')

  return (
    <SessionProvider session={session}>
      <FieldShell>{children}</FieldShell>
    </SessionProvider>
  )
}
