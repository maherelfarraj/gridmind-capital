import { redirect } from 'next/navigation'
import { ToastProvider } from '@/components/ui/toast'
import { PortalHeader } from '@/components/portal/portal-header'
import { getPortalActor } from '@/app/actions/portal'

export const metadata = {
  title: 'Partner Portal — GridMind Capital',
  description: 'Subcontractor and supplier portal for GridMind Capital projects.',
}

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await getPortalActor()

  // Not authenticated → login. Authenticated but not a partner → internal app.
  if (!actor) {
    redirect('/dashboard')
  }

  return (
    <ToastProvider position="bottom-right">
      <div className="min-h-screen bg-background flex flex-col">
        <PortalHeader
          organizationName={actor.organizationName || 'Partner'}
          fullName={actor.fullName}
          email={actor.email}
        />
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8 md:px-6">
          {children}
        </main>
        <footer className="border-t border-border">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>GridMind Capital — Partner Portal</span>
            <span>Restricted access. Data shown is limited to your organization.</span>
          </div>
        </footer>
      </div>
    </ToastProvider>
  )
}
