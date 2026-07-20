'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Zap,
  ChevronRight,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  NAV_ITEMS,
  NAV_BOTTOM,
  PHASE_META,
  filterNavByRole,
  type NavItem,
  type NavChild,
  type UserRole,
} from './nav-config'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface SidebarUser {
  name: string
  roleLabel: string
  initials: string
  role: UserRole
}

export interface SidebarProps {
  collapsed: boolean
  onCollapse: (v: boolean) => void
  mobileOpen: boolean
  onMobileClose: () => void
  pathname: string
  user: SidebarUser
  approvalCount?: number
}

// ─────────────────────────────────────────────────────────────
// Nav group (expandable accordion)
// ─────────────────────────────────────────────────────────────

function NavGroup({
  item,
  pathname,
  collapsed,
  defaultOpen,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
  defaultOpen?: boolean
}) {
  const isChildActive = item.children?.some((c) => pathname === c.href) ?? false
  const [open, setOpen] = React.useState(defaultOpen || isChildActive)

  // Collapse closes all groups
  React.useEffect(() => {
    if (collapsed) setOpen(false)
  }, [collapsed])

  const Icon = item.icon

  return (
    <div>
      <button
        type="button"
        onClick={() => !collapsed && setOpen((v) => !v)}
        aria-expanded={!collapsed && open}
        aria-controls={`nav-group-${item.id}`}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5',
          'text-sm font-medium transition-colors duration-150',
          'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          isChildActive && 'text-sidebar-foreground',
          collapsed && 'justify-center px-2',
        )}
        title={collapsed ? item.label : undefined}
      >
        {/* Active indicator bar */}
        {isChildActive && !collapsed && (
          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
        )}

        <Icon
          className={cn(
            'shrink-0 transition-colors',
            isChildActive
              ? 'text-sidebar-primary'
              : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground',
          )}
          size={18}
          aria-hidden="true"
        />

        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            <ChevronRight
              size={14}
              className={cn(
                'shrink-0 text-sidebar-foreground/40 transition-transform duration-200',
                open && 'rotate-90',
              )}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {/* Children */}
      {!collapsed && (
        <div
          id={`nav-group-${item.id}`}
          role="group"
          className={cn(
            'overflow-hidden transition-all duration-200 ease-out',
            open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3 pb-1">
            {item.children?.map((child) => (
              <NavChildItem key={child.id} child={child} pathname={pathname} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Nav child item (inside expandable group)
// ─────────────────────────────────────────────────────────────

function NavChildItem({
  child,
  pathname,
}: {
  child: NavChild
  pathname: string
}) {
  const isActive = pathname === child.href
  const phase = child.phase ? PHASE_META[child.phase] : null

  return (
    <li>
      <Link
        href={child.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex items-center gap-2.5 rounded-md px-2 py-1.5',
          'text-xs font-medium transition-colors duration-150',
          isActive
            ? 'bg-sidebar-primary/10 text-sidebar-primary'
            : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        )}
      >
        {/* Phase dot */}
        {phase && (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: phase.color }}
            aria-hidden="true"
          />
        )}
        {child.label}
      </Link>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────
// Nav leaf item (no children)
// ─────────────────────────────────────────────────────────────

function NavLeafItem({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem
  pathname: string
  collapsed: boolean
}) {
  const isActive = item.href ? pathname === item.href : false
  const Icon = item.icon

  return (
    <Link
      href={item.href ?? '#'}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5',
        'text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-sidebar-accent text-sidebar-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        collapsed && 'justify-center px-2',
      )}
      title={collapsed ? item.label : undefined}
    >
      {/* Active left bar */}
      {isActive && (
        <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
      )}

      <Icon
        className={cn(
          'shrink-0 transition-colors',
          isActive
            ? 'text-sidebar-primary'
            : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground',
        )}
        size={18}
        aria-hidden="true"
      />

      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge != null && item.badge > 0 && (
            <span
              className="flex h-4.5 min-w-[1.125rem] items-center justify-center rounded-full bg-sidebar-primary px-1 text-[10px] font-bold leading-none text-sidebar-primary-foreground"
              aria-label={`${item.badge} pending`}
            >
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </>
      )}

      {/* Collapsed badge dot */}
      {collapsed && item.badge != null && item.badge > 0 && (
        <span
          className="absolute right-1 top-1 h-2 w-2 rounded-full bg-sidebar-primary"
          aria-hidden="true"
        />
      )}
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Sidebar inner content (shared between desktop + mobile)
// ─────────────────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  onCollapse,
  pathname,
  user,
  approvalCount,
  onItemClick,
  showCloseButton,
  onClose,
}: SidebarProps & { onItemClick?: () => void; showCloseButton?: boolean; onClose?: () => void }) {
  const filteredMain = filterNavByRole(NAV_ITEMS, user.role).map((item) =>
    item.id === 'approvals' && approvalCount != null
      ? { ...item, badge: approvalCount }
      : item,
  )
  const filteredBottom = filterNavByRole(NAV_BOTTOM, user.role)

  return (
    <div className="flex h-full flex-col">
      {/* ── Logo strip ── */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'gap-2 px-4',
        )}
      >
        {/* Zap icon */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/10">
          <Zap size={18} className="text-sidebar-primary" aria-hidden="true" />
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight tracking-tight text-sidebar-foreground">
              GridMind Capital
            </p>
            <p className="truncate text-[10px] font-medium uppercase tracking-widest text-sidebar-foreground/40">
              Renewable EPC OS
            </p>
          </div>
        )}

        {/* Mobile close / desktop collapse toggle */}
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <X size={16} />
          </button>
        ) : (
          !collapsed && (
            <button
              type="button"
              onClick={() => onCollapse(true)}
              aria-label="Collapse sidebar"
              className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            >
              <PanelLeftClose size={16} />
            </button>
          )
        )}
      </div>

      {/* ── Main nav ── */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto py-3 px-2"
      >
        <ul className="space-y-0.5" role="list">
          {filteredMain.map((item) => (
            <li key={item.id} onClick={onItemClick}>
              {item.children ? (
                <NavGroup
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  defaultOpen={item.children.some((c) => pathname === c.href)}
                />
              ) : (
                <NavLeafItem item={item} pathname={pathname} collapsed={collapsed} />
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Bottom nav (settings, help) ── */}
      <div className="border-t border-sidebar-border px-2 pt-2 pb-1">
        <ul className="space-y-0.5" role="list">
          {filteredBottom.map((item) => (
            <li key={item.id} onClick={onItemClick}>
              <NavLeafItem item={item} pathname={pathname} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </div>

      {/* ── User section ── */}
      <div
        className={cn(
          'flex items-center gap-3 border-t border-sidebar-border p-3',
          collapsed && 'flex-col gap-2',
        )}
      >
        {/* Avatar */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-[11px] font-bold text-sidebar-primary ring-1 ring-sidebar-primary/30"
          aria-hidden="true"
        >
          {user.initials}
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-sidebar-foreground">
              {user.name}
            </p>
            <p className="truncate text-[10px] text-sidebar-foreground/50">
              {user.roleLabel}
            </p>
          </div>
        )}

        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            'text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground',
            'transition-colors duration-150',
          )}
        >
          <LogOut size={14} />
        </button>
      </div>

      {/* ── Expand toggle (collapsed state only, desktop) ── */}
      {collapsed && !showCloseButton && (
        <div className="flex justify-center border-t border-sidebar-border py-2">
          <button
            type="button"
            onClick={() => onCollapse(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Sidebar component
// ─────────────────────────────────────────────────────────────

export function Sidebar(props: SidebarProps) {
  const { collapsed, mobileOpen, onMobileClose } = props

  // ── Swipe-to-close on mobile ──
  const touchStartX = React.useRef<number>(0)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    if (dx > 80) onMobileClose()
  }

  // ── Keyboard: Escape closes mobile drawer ──
  React.useEffect(() => {
    if (!mobileOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onMobileClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, onMobileClose])

  return (
    <>
      {/* ────── Desktop sidebar ────── */}
      <aside
        className={cn(
          'hidden md:flex flex-col fixed left-0 top-0 h-screen z-30',
          'bg-sidebar border-r border-sidebar-border',
          'transition-[width] duration-200 ease-out overflow-hidden',
          collapsed ? 'w-16' : 'w-64',
        )}
        aria-label="Main navigation"
      >
        <SidebarContent {...props} />
      </aside>

      {/* ────── Mobile overlay ────── */}
      {/* Backdrop */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm',
          'transition-opacity duration-200',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
        onClick={onMobileClose}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'md:hidden fixed left-0 top-0 h-screen w-64 z-50',
          'bg-sidebar border-r border-sidebar-border',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <SidebarContent
          {...props}
          collapsed={false}
          showCloseButton
          onClose={onMobileClose}
          onItemClick={onMobileClose}
        />
      </aside>
    </>
  )
}
