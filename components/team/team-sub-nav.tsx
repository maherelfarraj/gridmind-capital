'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/team', label: 'Overview', exact: true },
  { href: '/team/org', label: 'Org & Roles' },
  { href: '/team/staffing', label: 'Staffing' },
  { href: '/team/raci', label: 'RACI Matrix' },
  { href: '/team/signoffs', label: 'Gate Sign-offs' },
  { href: '/team/tasks', label: 'Tasks' },
  { href: '/team/workload', label: 'Workload' },
  { href: '/team/inbox', label: 'Inbox' },
]

export function TeamSubNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Team sections" className="border-b border-border">
      <ul className="-mb-px flex flex-wrap gap-1" role="list">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
