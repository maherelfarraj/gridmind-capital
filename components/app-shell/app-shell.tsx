'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { TopBar, type Breadcrumb } from './topbar'
import { MOCK_USER } from './nav-config'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface AppShellProps {
  children: React.ReactNode
  /** Page title shown in the topbar */
  title?: string
  /** Breadcrumb trail. Defaults to [{ label: title }] */
  breadcrumbs?: Breadcrumb[]
  /** Unread notification count */
  notificationCount?: number
  /** Pending approval count (shown on Approvals nav item) */
  approvalCount?: number
}

// ─────────────────────────────────────────────────────────────
// Sidebar state persisted in localStorage
// ─────────────────────────────────────────────────────────────

const COLLAPSED_KEY = 'gmc-sidebar-collapsed'

function useCollapsed() {
  const [collapsed, setCollapsedState] = React.useState(false)

  // Read persisted value on mount (avoids SSR mismatch)
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_KEY)
      if (stored !== null) setCollapsedState(stored === 'true')
    } catch {}
  }, [])

  const setCollapsed = React.useCallback((v: boolean) => {
    setCollapsedState(v)
    try {
      localStorage.setItem(COLLAPSED_KEY, String(v))
    } catch {}
  }, [])

  return [collapsed, setCollapsed] as const
}

// ─────────────────────────────────────────────────────────────
// AppShell
// ─────────────────────────────────────────────────────────────

export function AppShell({
  children,
  title = 'Dashboard',
  breadcrumbs,
  notificationCount = 0,
  approvalCount,
}: AppShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useCollapsed()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Prevent body scroll when mobile drawer is open
  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <Sidebar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        pathname={pathname}
        user={MOCK_USER}
        approvalCount={approvalCount}
      />

      {/* ── Main column ── */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col overflow-hidden',
          // Desktop: margin matches sidebar width with same transition
          'md:transition-[margin-left] md:duration-200 md:ease-out',
          collapsed ? 'md:ml-16' : 'md:ml-64',
        )}
      >
        {/* Top bar */}
        <TopBar
          onMobileMenuOpen={() => setMobileOpen(true)}
          title={title}
          breadcrumbs={breadcrumbs}
          notificationCount={notificationCount}
        />

        {/* Scrollable content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto"
          tabIndex={-1}
        >
          {/* Skip-to-content target */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-sidebar-primary focus:px-3 focus:py-1.5 focus:text-sm focus:font-medium focus:text-sidebar-primary-foreground"
          >
            Skip to main content
          </a>

          {/* Page fade-in wrapper */}
          <div
            key={pathname}
            className="animate-[fade-in_0.18s_ease-out] p-4 sm:p-6"
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
