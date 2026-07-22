'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sidebar } from './sidebar'
import { TopBar, type Breadcrumb } from './topbar'
import { useSession } from '@/lib/session-context'
import { getInitials, ROLE_LABELS, toNavRole } from '@/lib/session'
import { HelpHubPanel } from '@/components/layout/HelpHubPanel'
import { ToastProvider } from '@/components/ui/toast'
import { GlobalCommandPalette } from '@/components/command-palette/global-command-palette'
import { NotificationPanel } from '@/components/notifications/notification-panel'
import { PwaProvider } from '@/components/pwa/pwa-provider'
import { BottomTabBar } from '@/components/pwa/bottom-tab-bar'

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
  const session = useSession()
  const [collapsed, setCollapsed] = useCollapsed()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [notifOpen, setNotifOpen]     = React.useState(false)

  // Global CMD+K / Ctrl+K listener
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // Derive sidebar user from session
  const sidebarUser = React.useMemo(() => ({
    name: session.fullName,
    role: toNavRole(session),
    roleLabel: ROLE_LABELS[session.roles[0]] ?? 'User',
    initials: getInitials(session.fullName),
  }), [session])

  // Derive help context module from the current pathname segment
  const contextModule = React.useMemo(() => {
    const segment = pathname.split('/').filter(Boolean)[0] ?? 'general'
    // Map common route prefixes to HelpModuleKey values
    const map: Record<string, string> = {
      projects:       'construction',
      engineering:    'engineering',
      procurement:    'procurement',
      finance:        'finance',
      commercial:     'commercial',
      hse:            'hse',
      construction:   'construction',
      commissioning:  'commissioning',
      'stage-gates':  'stage-gate',
      esg:            'esg',
      risk:           'governance',
      admin:          'governance',
    }
    return map[segment] ?? segment
  }, [pathname])

  // Auto-collapse sidebar on tablet (768–1199px), expand on desktop (≥1200px)
  React.useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px) and (max-width: 1199px)')
    const handle = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setCollapsed(true)
      else if (window.innerWidth >= 1200) setCollapsed(false)
    }
    handle(mq)
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    <ToastProvider position="bottom-right">
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Sidebar ── */}
      <Sidebar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        pathname={pathname}
        user={sidebarUser}
        approvalCount={approvalCount}
      />

      {/* ── Main column ── */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col overflow-hidden',
          // Use logical margin-inline-start so the column shifts away from the
          // sidebar whether it is on the left (LTR) or the right (RTL).
          'md:transition-[margin-inline-start] md:duration-200 md:ease-out',
          collapsed ? 'md:ms-16' : 'md:ms-64',
        )}
      >
        {/* Top bar */}
        <TopBar
          onMobileMenuOpen={() => setMobileOpen(true)}
          title={title}
          breadcrumbs={breadcrumbs}
          notificationCount={notificationCount}
          onSearchOpen={() => setPaletteOpen(true)}
          onNotifOpen={() => setNotifOpen(true)}
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

          {/* Page fade-in wrapper.
              pb accounts for the mobile bottom tab bar (md:hidden) so
              content is never hidden behind it. */}
          <div
            key={pathname}
            className="animate-[fade-in_0.18s_ease-out] p-4 pb-[calc(env(safe-area-inset-bottom)+76px)] sm:p-6 md:pb-6"
          >
            {children}
          </div>
        </main>
      </div>
      {/* ── Global Help Hub (floating FAB, context-aware) ── */}
      <HelpHubPanel
        contextModule={contextModule}
        userRole={session.roles[0]}
      />
      {/* ── Global Command Palette ── */}
      <GlobalCommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {/* ── Notifications & Activity Feed ── */}
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} unreadCount={notificationCount} />
      {/* ── Mobile bottom tab bar (≤768px) ── */}
      <BottomTabBar
        pathname={pathname}
        approvalCount={approvalCount}
        notificationCount={notificationCount}
        onMore={() => setMobileOpen(true)}
        onNotifications={() => setNotifOpen(true)}
      />
      {/* ── PWA runtime: SW registration, offline banner, install prompt, queue sync ── */}
      <PwaProvider />
    </div>
    </ToastProvider>
  )
}
