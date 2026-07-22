'use client'

import * as React from 'react'
import Link from 'next/link'
import { Home, ClipboardCheck, Bell, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomTabBarProps {
  pathname: string
  approvalCount?: number
  notificationCount?: number
  /** Opens the full navigation drawer. */
  onMore: () => void
  /** Opens the notifications panel. */
  onNotifications: () => void
}

/**
 * Mobile-only (≤768px) bottom tab bar for primary navigation:
 * Home · Approvals · Notifications · More.
 * The hamburger drawer is preserved for everything else via "More".
 */
export function BottomTabBar({
  pathname,
  approvalCount,
  notificationCount,
  onMore,
  onNotifications,
}: BottomTabBarProps) {
  const isHome = pathname === '/dashboard' || pathname === '/'
  const isApprovals = pathname.startsWith('/approvals')

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 md:hidden',
        'flex items-stretch justify-around',
        'border-t border-border bg-card/95 backdrop-blur',
        'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <TabLink href="/dashboard" label="Home" active={isHome} Icon={Home} />
      <TabLink
        href="/approvals"
        label="Approvals"
        active={isApprovals}
        Icon={ClipboardCheck}
        badge={approvalCount}
      />
      <TabButton
        label="Alerts"
        Icon={Bell}
        badge={notificationCount}
        onClick={onNotifications}
      />
      <TabButton label="More" Icon={Menu} onClick={onMore} />
    </nav>
  )
}

// ── Shared tab visuals ───────────────────────────────────────
const tabBase =
  'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'

function Badge({ count }: { count?: number }) {
  if (!count || count <= 0) return null
  return (
    <span
      className="absolute right-[22%] top-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white"
      aria-hidden="true"
    >
      {count > 9 ? '9+' : count}
    </span>
  )
}

function TabLink({
  href,
  label,
  active,
  Icon,
  badge,
}: {
  href: string
  label: string
  active: boolean
  Icon: React.ElementType
  badge?: number
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(tabBase, active ? 'text-[#0a192f] dark:text-[#64ffda]' : 'text-muted-foreground')}
    >
      <Icon className="size-5" aria-hidden="true" />
      <Badge count={badge} />
      <span>{label}</span>
    </Link>
  )
}

function TabButton({
  label,
  Icon,
  badge,
  onClick,
}: {
  label: string
  Icon: React.ElementType
  badge?: number
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={cn(tabBase, 'text-muted-foreground')}>
      <Icon className="size-5" aria-hidden="true" />
      <Badge count={badge} />
      <span>{label}</span>
    </button>
  )
}
