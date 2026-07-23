'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, ClipboardCheck, Camera, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ToastProvider } from '@/components/ui/toast'
import { FieldProvider, useField } from './field-context'

const TABS = [
  { href: '/field',         label: 'Today',   icon: CalendarDays },
  { href: '/field/punch',   label: 'Punch',   icon: ClipboardCheck },
  { href: '/field/photos',  label: 'Photos',  icon: Camera },
  { href: '/field/reports', label: 'Reports', icon: FileText },
] as const

function TopBar() {
  const { project, online } = useField()
  return (
    <header className="fixed inset-x-0 top-0 z-30 mx-auto flex h-14 max-w-[480px] items-center justify-between gap-3 border-b border-border bg-card px-4">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Field Mode</p>
        <p className="truncate text-sm font-semibold text-card-foreground">
          {project ? project.name : 'Select a project'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5" aria-live="polite">
        <span
          className={cn('size-2.5 rounded-full', online ? 'bg-[#22c55e]' : 'bg-muted-foreground')}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-muted-foreground">{online ? 'Online' : 'Offline'}</span>
      </div>
    </header>
  )
}

function BottomTabs() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[480px] items-stretch border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
      {TABS.map((tab) => {
        const active = tab.href === '/field' ? pathname === '/field' : pathname.startsWith(tab.href)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function FieldShell({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider position="top-center">
      <FieldProvider>
        <div className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-background">
          <TopBar />
          <main className="flex-1 pb-24 pt-16">{children}</main>
          <BottomTabs />
        </div>
      </FieldProvider>
    </ToastProvider>
  )
}
