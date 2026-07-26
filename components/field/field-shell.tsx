'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, ClipboardCheck, Camera, FileText, Globe, TrendingUp } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ToastProvider } from '@/components/ui/toast'
import { PwaProvider } from '@/components/pwa/pwa-provider'
import { FieldProvider, useField } from './field-context'
import { setLocaleAction } from '@/app/actions/locale'

function TopBar() {
  const { project, online } = useField()
  const t = useTranslations('field')
  const locale = useLocale()
  const router = useRouter()
  const [switching, setSwitching] = React.useState(false)

  async function toggleLocale() {
    const next = locale === 'ar' ? 'en' : 'ar'
    setSwitching(true)
    await setLocaleAction(next)
    router.refresh()
    setSwitching(false)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-30 mx-auto flex h-14 max-w-[480px] items-center justify-between gap-3 border-b border-border bg-card px-4">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {t('title')}
        </p>
        <p className="truncate text-sm font-semibold text-card-foreground">
          {project ? project.name : t('selectProject')}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {/* Online indicator */}
        <div className="flex items-center gap-1.5" aria-live="polite">
          <span
            className={cn('size-2 rounded-full', online ? 'bg-[#22c55e]' : 'bg-muted-foreground')}
            aria-hidden="true"
          />
          <span className="text-xs font-medium text-muted-foreground">
            {online ? t('online') : t('offline')}
          </span>
        </div>

        {/* EN / AR language toggle */}
        <button
          type="button"
          onClick={toggleLocale}
          disabled={switching}
          aria-label={t('languageToggle')}
          className={cn(
            'flex items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/80 disabled:opacity-50',
          )}
        >
          <Globe className="size-3 shrink-0" aria-hidden="true" />
          {locale === 'ar' ? 'EN' : 'AR'}
        </button>
      </div>
    </header>
  )
}

function BottomTabs() {
  const pathname = usePathname()
  const t = useTranslations('field')

  const TABS = [
    { href: '/field',          labelKey: 'tabs.today',    icon: CalendarDays },
    { href: '/field/punch',    labelKey: 'tabs.punch',    icon: ClipboardCheck },
    { href: '/field/photos',   labelKey: 'tabs.photos',   icon: Camera },
    { href: '/field/reports',  labelKey: 'tabs.reports',  icon: FileText },
    { href: '/field/schedule', labelKey: 'tabs.schedule', icon: TrendingUp },
  ] as const

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
            {t(tab.labelKey)}
          </Link>
        )
      })}
    </nav>
  )
}

export function FieldShell({ children }: { children: React.ReactNode }) {
  const locale = useLocale()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <ToastProvider position="top-center">
      <FieldProvider>
        {/*
          The field shell is a self-contained pane that sets its own dir/lang so
          the Arabic workforce can use it RTL without affecting the outer app layout.
        */}
        <div
          dir={dir}
          lang={locale}
          className="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-background"
        >
          <TopBar />
          <main className="flex-1 overflow-y-auto pb-24 pt-16 px-4">{children}</main>
          <BottomTabs />
        </div>
        {/* SW registration + offline queue flush + install prompt for the field module */}
        <PwaProvider />
      </FieldProvider>
    </ToastProvider>
  )
}
