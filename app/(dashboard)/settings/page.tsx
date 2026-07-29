'use client'

import * as React from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  User, Shield, SlidersHorizontal, Folder, Bell,
  Lock, KeyRound, CreditCard, Check, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/session-context'
import { hasRole } from '@/lib/session'
import { ProfileTab }       from '@/components/settings/profile-tab'
import { AccountTab }       from '@/components/settings/account-tab'
import { PreferencesTab }   from '@/components/settings/preferences-tab'
import { ProjectsTab }      from '@/components/settings/projects-tab'
import { NotificationsTab } from '@/components/settings/notifications-tab'
import { SecurityTab }      from '@/components/settings/security-tab'
import { ApiKeysTab }       from '@/components/settings/api-keys-tab'

type TabId = 'profile' | 'account' | 'preferences' | 'projects' | 'notifications' | 'security' | 'api-keys' | 'billing'

const NAV_ITEMS: {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}[] = [
  { id: 'profile',       label: 'Profile',        icon: User             },
  { id: 'account',       label: 'Account',        icon: Shield           },
  { id: 'preferences',   label: 'Preferences',    icon: SlidersHorizontal },
  { id: 'projects',      label: 'Projects',       icon: Folder           },
  { id: 'notifications', label: 'Notifications',  icon: Bell             },
  { id: 'security',      label: 'Security',       icon: Lock             },
  { id: 'api-keys',      label: 'API Keys',       icon: KeyRound         },
  { id: 'billing',       label: 'Billing',        icon: CreditCard, adminOnly: true },
]

const TAB_TITLES: Record<TabId, string> = {
  profile:       'Profile',
  account:       'Account',
  preferences:   'Preferences',
  projects:      'Projects',
  notifications: 'Notifications',
  security:      'Security',
  'api-keys':    'API Keys',
  billing:       'Billing',
}

const TAB_DESCS: Record<TabId, string> = {
  profile:       'Manage your personal information, avatar, skills and contact links.',
  account:       'Email, password, two-factor authentication and active sessions.',
  preferences:   'Theme, language, date format and display options.',
  projects:      'Projects you have access to and your role on each.',
  notifications: 'Choose how and when you get notified.',
  security:      'Login history and connected third-party applications.',
  'api-keys':    'Generate and revoke programmatic API access keys.',
  billing:       'Subscription plan and payment history (Admin only).',
}

function SavedToast({ show }: { show: boolean }) {
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-green-600 text-white text-sm font-semibold px-4 py-2.5 shadow-xl transition-all duration-300',
      show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
    )}>
      <Check className="size-4" /> Saved
    </div>
  )
}

export default function SettingsPage() {
  const router       = useSearchParams()
  const session      = useSession()
  const [tab, setTab] = React.useState<TabId>('profile')
  const [saved, setSaved] = React.useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
  }

  // Real session-driven admin check (system_admin / tenant_admin)
  const isAdmin = session.isSuperAdmin || hasRole(session, 'system_admin', 'tenant_admin')

  const visibleNav = NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-5">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>Platform</span>
            <ChevronRight className="size-3" />
            <span className="text-foreground font-medium">Settings</span>
          </div>
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your account, preferences and project access.</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar nav */}
          <aside className="w-52 flex-shrink-0 hidden md:block">
            <nav className="space-y-0.5 sticky top-6">
              {visibleNav.map((item, i) => {
                const prevAdminOnly = i > 0 && !NAV_ITEMS[i - 1].adminOnly && item.adminOnly
                return (
                  <React.Fragment key={item.id}>
                    {prevAdminOnly && <div className="my-2 border-t border-border" />}
                    <button
                      onClick={() => setTab(item.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
                        tab === item.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      <item.icon className={cn('size-4 flex-shrink-0', tab === item.id ? 'text-primary' : 'text-muted-foreground')} />
                      {item.label}
                      {item.adminOnly && (
                        <span className="ml-auto text-[9px] font-semibold bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                    </button>
                  </React.Fragment>
                )
              })}
            </nav>
          </aside>

          {/* Mobile nav */}
          <div className="md:hidden w-full mb-4 overflow-x-auto">
            <div className="flex gap-1 pb-2">
              {visibleNav.map((item) => (
                <button key={item.id} onClick={() => setTab(item.id)}
                  className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                    tab === item.id ? 'bg-primary/10 text-primary' : 'bg-muted/40 text-muted-foreground hover:bg-muted')}>
                  <item.icon className="size-3.5" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {/* Tab header */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-foreground">{TAB_TITLES[tab]}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{TAB_DESCS[tab]}</p>
            </div>

            {tab === 'profile'       && <ProfileTab       onSave={handleSave} />}
            {tab === 'account'       && <AccountTab       onSave={handleSave} />}
            {tab === 'preferences'   && <PreferencesTab   onSave={handleSave} />}
            {tab === 'projects'      && <ProjectsTab      onSave={handleSave} />}
            {tab === 'notifications' && <NotificationsTab onSave={handleSave} />}
            {tab === 'security'      && <SecurityTab      onSave={handleSave} />}
            {tab === 'api-keys'      && <ApiKeysTab       onSave={handleSave} />}
            {tab === 'billing'       && isAdmin && (
              <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
                <CreditCard className="size-8 mx-auto text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Billing is managed at the tenant level.</p>
                <p className="text-xs text-muted-foreground">Contact your GridMind account manager for plan changes.</p>
              </div>
            )}
          </main>
        </div>
      </div>

      <SavedToast show={saved} />
    </div>
  )
}
