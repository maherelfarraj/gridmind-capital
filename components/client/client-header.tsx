'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid, TrendingUp, FileBarChart, CalendarClock, GitPullRequestArrow, FolderOpen, LogOut,
} from 'lucide-react'
import { signOutAction } from '@/app/actions/auth'

const NAV = [
  { href: '/client', label: 'Overview', icon: LayoutGrid, exact: true },
  { href: '/client/progress', label: 'Progress', icon: TrendingUp },
  { href: '/client/reports', label: 'Reports', icon: FileBarChart },
  { href: '/client/milestones', label: 'Milestones', icon: CalendarClock },
  { href: '/client/variations', label: 'Variations', icon: GitPullRequestArrow },
  { href: '/client/documents', label: 'Documents', icon: FolderOpen },
]

export function ClientHeader({ clientName }: { clientName: string }) {
  const pathname = usePathname()

  return (
    <header className="border-b border-border bg-primary text-primary-foreground">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight">GridMind Capital</span>
            <span className="rounded-md border border-[#64ffda]/40 bg-[#64ffda]/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#64ffda]">
              Client Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            <p className="hidden text-sm font-medium sm:block">{clientName}</p>
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md border border-primary-foreground/20 px-3 py-1.5 text-xs font-medium text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10"
              >
                <LogOut className="size-3.5" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Client portal navigation">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-[#64ffda] text-[#64ffda]'
                    : 'border-transparent text-primary-foreground/70 hover:text-primary-foreground'
                }`}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
