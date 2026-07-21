'use client'

import * as React from 'react'
import Link from 'next/link'
import { Menu, Bell, Search, ChevronRight, X, Command } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Breadcrumb {
  label: string
  href?: string
}

export interface TopBarProps {
  onMobileMenuOpen: () => void
  title: string
  breadcrumbs?: Breadcrumb[]
  notificationCount?: number
}

// ─────────────────────────────────────────────────────────────
// Live clock
// ─────────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = React.useState('')
  const [date, setDate] = React.useState('')

  React.useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(
        now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      )
      setDate(
        now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }),
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  if (!time) return null

  return (
    <div className="hidden items-center gap-2 lg:flex">
      {/* System status dot */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <span className="font-mono text-xs text-muted-foreground/60 tabular-nums">
        {time}
      </span>
      <span className="text-border">|</span>
      <span className="text-xs text-muted-foreground/50">{date}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Search bar (expandable, ⌘K)
// ─────────────────────────────────────────────────────────────

function SearchBar() {
  const [expanded, setExpanded] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setExpanded(true)
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && expanded) setExpanded(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [expanded])

  React.useEffect(() => {
    if (expanded) inputRef.current?.focus()
  }, [expanded])

  return (
    <div className="relative flex items-center">
      {expanded ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/60 px-3 py-1.5 ring-1 ring-ring/30 transition-all">
          <Search size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search projects, documents, approvals…"
            aria-label="Search"
            className="w-56 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none border-none ring-0 sm:w-72"
            onBlur={() => setExpanded(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setExpanded(false) }}
          />
          <kbd className="hidden items-center gap-0.5 rounded border border-border bg-muted px-1 text-[10px] font-medium text-muted-foreground sm:flex">
            Esc
          </kbd>
          <button
            type="button"
            aria-label="Close search"
            onClick={() => setExpanded(false)}
            className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          aria-label="Search (⌘K)"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
        >
          <Search size={13} aria-hidden="true" />
          <span className="hidden text-xs sm:block">Search</span>
          <kbd className="hidden items-center gap-0.5 rounded border border-border bg-background/60 px-1 text-[10px] font-medium sm:flex">
            <Command size={9} />
            <span>K</span>
          </kbd>
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Notification bell
// ─────────────────────────────────────────────────────────────

function NotificationBell({ count = 0 }: { count?: number }) {
  return (
    <button
      type="button"
      aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-150"
    >
      <Bell size={15} aria-hidden="true" />
      {count > 0 && (
        <span
          className="absolute right-1 top-1 flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-sidebar-primary px-0.5 text-[9px] font-bold leading-none text-sidebar-primary-foreground"
          aria-hidden="true"
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Breadcrumbs
// ─────────────────────────────────────────────────────────────

function Breadcrumbs({ items }: { items: Breadcrumb[] }) {
  if (!items.length) return null
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1 sm:flex">
      <ol className="flex items-center gap-1" role="list">
        {items.map((crumb, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight size={11} className="text-muted-foreground/40" aria-hidden="true" />
              )}
              {isLast || !crumb.href ? (
                <span
                  className={cn('text-sm', isLast ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────
// TopBar
// ─────────────────────────────────────────────────────────────

export function TopBar({
  onMobileMenuOpen,
  title,
  breadcrumbs = [],
  notificationCount = 0,
}: TopBarProps) {
  const crumbs: Breadcrumb[] = breadcrumbs.length > 0 ? breadcrumbs : [{ label: title }]

  return (
    <header className="sticky top-0 z-20 flex h-13 shrink-0 items-center gap-3 px-4 border-b border-border bg-background/90 backdrop-blur-md">
      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label="Open navigation menu"
        onClick={onMobileMenuOpen}
        className="flex h-8 w-8 items-center justify-center rounded-lg md:hidden text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        <Menu size={17} aria-hidden="true" />
      </button>

      {/* Page title / breadcrumbs */}
      <div className="flex min-w-0 flex-1 items-center">
        <h1 className="truncate text-sm font-semibold text-foreground sm:hidden">{title}</h1>
        <Breadcrumbs items={crumbs} />
      </div>

      {/* Right actions */}
      <div className="flex shrink-0 items-center gap-3">
        <LiveClock />
        <div className="h-4 w-px bg-border hidden lg:block" />
        <SearchBar />
        <NotificationBell count={notificationCount} />
      </div>
    </header>
  )
}
