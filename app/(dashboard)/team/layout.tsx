import type { Metadata } from 'next'
import { TeamSubNav } from '@/components/team/team-sub-nav'

export const metadata: Metadata = {
  title: 'Team & Roles',
  description: 'Organisation, RACI, staffing and gate sign-offs',
}

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-balance text-2xl font-semibold text-foreground">Team &amp; Roles</h1>
        <p className="text-pretty text-sm text-muted-foreground">
          Organisation directory, RACI matrix, project staffing and gate sign-offs.
        </p>
      </header>
      <TeamSubNav />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
