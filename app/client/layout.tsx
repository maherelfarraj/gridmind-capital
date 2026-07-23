import { redirect } from 'next/navigation'
import { getClientActor } from '@/app/actions/client'
import { ClientHeader } from '@/components/client/client-header'

export const dynamic = 'force-dynamic'

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const actor = await getClientActor()
  if (!actor) redirect('/auth/login')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ClientHeader clientName={actor.fullName || actor.email} />
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>
      <footer className="border-t border-border py-4">
        <p className="mx-auto max-w-6xl px-4 md:px-6 text-xs text-muted-foreground text-pretty">
          GridMind Capital — Client Portal. This is a confidential read-only view provided to authorized project stakeholders.
        </p>
      </footer>
    </div>
  )
}
