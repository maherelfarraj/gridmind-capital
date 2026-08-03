'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Zap,
  Edit2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProfileEditModal } from '@/components/profile/profile-edit-modal'
import {
  NAV_SECTIONS,
  NAV_BOTTOM,
  PHASE_META,
  EXTERNAL_NAV_SECTIONS,
  EXTERNAL_ROLES,
  filterSectionsByRole,
  type NavItem,
  type NavChild,
  type UserRole,
} from './nav-config'
import { signOutAction } from '@/app/actions/auth'

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
  const isChildActive = item.children?.some(
    (c) => pathname === c.href || pathname.startsWith(c.href.split('?')[0] + '/')
  ) ?? false
  const [open, setOpen] = React.useState(defaultOpen || isChildActive)

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
          'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2',
          'text-sm font-medium transition-colors duration-150',
          'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
          isChildActive && 'text-sidebar-foreground',
          collapsed && 'justify-center px-2',
        )}
        title={collapsed ? item.label : undefined}
      >
        {isChildActive && !collapsed && (
          <span className="absolute start-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
        )}
        <Icon
          className={cn(
            'shrink-0 transition-colors',
            isChildActive
              ? 'text-sidebar-primary'
              : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground',
          )}
          size={16}
          aria-hidden="true"
        />
        {!collapsed && (
          <>
            <span className="flex-1 text-start">{item.label}</span>
            <ChevronRight
              size={13}
              className={cn(
                'shrink-0 text-sidebar-foreground/30 transition-transform duration-200',
                open && 'rotate-90',
              )}
              aria-hidden="true"
            />
          </>
        )}
      </button>

      {!collapsed && (
        <div
          id={`nav-group-${item.id}`}
          role="group"
          className={cn(
            'overflow-hidden transition-all duration-200 ease-out',
            open ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
          )}
        >
          <ul className="ms-2 mt-0.5 space-y-0.5 border-s border-sidebar-border/60 ps-3 pb-1">
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
// Nav child item
// ─────────────────────────────────────────────────────────────

function NavChildItem({ child, pathname }: { child: NavChild; pathname: string }) {
  const isActive = pathname === child.href || pathname === child.href.split('?')[0]
  const phase = child.phase ? PHASE_META[child.phase] : null

  return (
    <li>
      <Link
        href={child.href}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'group flex items-center gap-2 rounded-md px-2 py-1.5',
          'text-xs font-medium transition-colors duration-150',
          isActive
            ? 'bg-sidebar-primary/10 text-sidebar-primary'
            : 'text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        )}
      >
        {phase ? (
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: phase.color }}
            aria-hidden="true"
          />
        ) : (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sidebar-foreground/20" aria-hidden="true" />
        )}
        {child.label}
      </Link>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────
// Nav leaf item
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
  const isActive = item.href
    ? pathname === item.href || pathname.startsWith(item.href + '/')
    : false
  const Icon = item.icon

  return (
    <Link
      href={item.href ?? '#'}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2',
        'text-sm font-medium transition-colors duration-150',
        isActive
          ? 'bg-sidebar-accent text-sidebar-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground',
        collapsed && 'justify-center px-2',
      )}
      title={collapsed ? item.label : undefined}
    >
      {isActive && (
        <span className="absolute start-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
      )}
      <Icon
        className={cn(
          'shrink-0 transition-colors',
          isActive
            ? 'text-sidebar-primary'
            : 'text-sidebar-foreground/50 group-hover:text-sidebar-foreground',
        )}
        size={16}
        aria-hidden="true"
      />
      {!collapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge != null && item.badge > 0 && (
            <span
              className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-sidebar-primary px-1 text-[10px] font-bold leading-none text-sidebar-primary-foreground"
              aria-label={`${item.badge} pending`}
            >
              {item.badge > 99 ? '99+' : item.badge}
            </span>
          )}
        </>
      )}
      {collapsed && item.badge != null && item.badge > 0 && (
        <span
          className="absolute end-1 top-1 h-2 w-2 rounded-full bg-sidebar-primary"
          aria-hidden="true"
        />
      )}
    </Link>
  )
}

// ───��─────────────────────────────────────────────────────────
// Section label
// ─────────────────────────────────────────────────────────────

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return null
  return (
    <div className="px-3 pb-1 pt-3">
      <p className="text-[10px] font-semibold tracking-widest text-sidebar-foreground/30 uppercase">
        {label}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Sidebar inner content
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
  const [profileModalOpen, setProfileModalOpen] = React.useState(false)
  const isExternalRole = EXTERNAL_ROLES.includes(user.role)
  const baseSections = isExternalRole ? EXTERNAL_NAV_SECTIONS : NAV_SECTIONS
  const sections = filterSectionsByRole(baseSections, user.role).map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.id === 'approvals' && approvalCount != null
        ? { ...item, badge: approvalCount }
        : item
    ),
  }))
  const filteredBottom = NAV_BOTTOM

  return (
    <div className="flex h-full flex-col">
      {/* ── Logo strip ── */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'gap-3 px-4',
        )}
      >
        {/* Logo mark: bold G inside a teal-tinged diamond */}
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
          <div className="absolute inset-0 rounded-lg bg-sidebar-primary/15 ring-1 ring-sidebar-primary/30" />
          <Zap size={16} className="relative text-sidebar-primary" aria-hidden="true" />
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight tracking-tight text-sidebar-foreground">
              GridMind
              <span className="ms-1 text-sidebar-primary">Capital</span>
            </p>
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/30">
              EPC Operating System
            </p>
          </div>
        )}

        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="ms-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <X size={15} />
          </button>
        ) : (
          !collapsed && (
            <button
              type="button"
              onClick={() => onCollapse(true)}
              aria-label="Collapse sidebar"
              className="ms-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
            >
              <PanelLeftClose size={15} />
            </button>
          )
        )}
      </div>

      {/* ── Sectioned nav ── */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="flex-1 overflow-y-auto py-2 px-2"
      >
        {sections.map((section, si) => (
          <div key={section.id}>
            {si > 0 && !collapsed && (
              <div className="mx-2 my-1 h-px bg-sidebar-border/50" />
            )}
            <SectionLabel label={section.label} collapsed={collapsed} />
            <ul className="space-y-0.5" role="list">
              {section.items.map((item) => (
                <li key={item.id} onClick={onItemClick}>
                  {item.children ? (
                    <NavGroup
                      item={item}
                      pathname={pathname}
                      collapsed={collapsed}
                      defaultOpen={
                        item.children.some(
                          (c) => pathname === c.href || pathname.startsWith(c.href.split('?')[0] + '/')
                        )
                      }
                    />
                  ) : (
                    <NavLeafItem item={item} pathname={pathname} collapsed={collapsed} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Bottom nav ── */}
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
          'flex items-center gap-2.5 border-t border-sidebar-border p-3',
          collapsed && 'flex-col gap-2',
        )}
      >
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-[10px] font-bold text-sidebar-primary ring-1 ring-sidebar-primary/30"
          aria-hidden="true"
        >
          {user.initials}
        </div>

        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold leading-tight text-sidebar-foreground">
              {user.name}
            </p>
            <p className="truncate text-[10px] text-sidebar-foreground/40">
              {user.roleLabel}
            </p>
          </div>
        )}

        <button
          onClick={() => setProfileModalOpen(true)}
          aria-label="Edit profile"
          title="Edit profile"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150"
        >
          <Edit2 size={13} />
        </button>

        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors duration-150"
          >
            <LogOut size={13} />
          </button>
        </form>
      </div>

      {/* ── Profile Edit Modal ── */}
      <ProfileEditModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />

      {/* ── Expand toggle (collapsed state) ── */}
      {collapsed && !showCloseButton && (
        <div className="flex justify-center border-t border-sidebar-border py-2">
          <button
            type="button"
            onClick={() => onCollapse(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground/40 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <PanelLeftOpen size={15} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Sidebar component
// ─────────��───────────────────────────────────────────────────

export function Sidebar(props: SidebarProps) {
  const { collapsed, mobileOpen, onMobileClose } = props

  const touchStartX = React.useRef<number>(0)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    if (dx > 80) onMobileClose()
  }

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
      {/* Desktop */}
      <aside
        className={cn(
          // Logical inset: start-0 = left in LTR, right in RTL.
          // border-s = border-left in LTR, border-right in RTL.
          'hidden md:flex flex-col fixed start-0 top-0 h-screen z-30',
          'bg-sidebar border-e border-sidebar-border',
          'transition-[width] duration-200 ease-out overflow-hidden',
          collapsed ? 'w-16' : 'w-64',
        )}
        aria-label="Main navigation"
      >
        <SidebarContent {...props} />
      </aside>

      {/* Mobile overlay */}
      <div
        className={cn(
          'md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm',
          'transition-opacity duration-200',
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        aria-hidden="true"
        onClick={onMobileClose}
      />

      {/* Mobile drawer
          Logical positioning: start-0 = left in LTR / right in RTL.
          The slide-in direction also flips: in LTR the drawer enters from the
          left (-translate-x-full hidden → 0 visible); in RTL the drawer must
          enter from the right (translate-x-full hidden → 0 visible).
          We achieve this with the rtl: variant. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          'md:hidden fixed start-0 top-0 h-screen w-64 z-50',
          'bg-sidebar border-e border-sidebar-border',
          'transition-transform duration-200 ease-out',
          mobileOpen
            ? 'translate-x-0'
            : '-translate-x-full rtl:translate-x-full',
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
