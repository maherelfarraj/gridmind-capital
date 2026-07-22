'use client'

import * as React from 'react'
import useSWR from 'swr'
import { CheckSquare, FileWarning, GitPullRequestArrow, AlarmClock, AtSign, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type NotificationPrefs,
} from '@/app/actions/notification-prefs'

type PrefKey = keyof NotificationPrefs

const EMAIL_TYPES: {
  id: PrefKey
  label: string
  desc: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'email_on_approval',   label: 'Approval requests & decisions', desc: 'When your approval is requested or a request you made is decided.', icon: CheckSquare },
  { id: 'email_on_ncr',        label: 'Non-conformance reports',       desc: 'When an NCR is raised or changes status on your projects.',        icon: FileWarning },
  { id: 'email_on_vo',         label: 'Variation orders',              desc: 'When a VO is submitted, approved, rejected or updated.',           icon: GitPullRequestArrow },
  { id: 'email_on_escalation', label: 'Payment escalations',           desc: 'When an overdue payment milestone is escalated (L1–L4).',          icon: AlarmClock },
  { id: 'email_on_mention',    label: 'Mentions',                      desc: 'When someone @mentions you in a comment.',                        icon: AtSign },
]

const DEFAULT_PREFS: NotificationPrefs = {
  email_on_approval: true,
  email_on_ncr: true,
  email_on_vo: true,
  email_on_escalation: true,
  email_on_mention: true,
}

export function NotificationsTab({ onSave }: { onSave: () => void }) {
  const { data, isLoading, mutate } = useSWR('notification-prefs', () => getNotificationPrefs())
  const [prefs, setPrefs] = React.useState<NotificationPrefs>(DEFAULT_PREFS)
  const [saving, setSaving] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)

  React.useEffect(() => {
    if (data) setPrefs(data)
  }, [data])

  function toggle(key: PrefKey) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }))
    setDirty(true)
  }

  async function handleSave() {
    setSaving(true)
    const res = await updateNotificationPrefs(prefs)
    setSaving(false)
    if (!res.error) {
      setDirty(false)
      await mutate(prefs, { revalidate: false })
      onSave()
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Email Notifications</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose which events send you an email. In-app notifications are always delivered.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {EMAIL_TYPES.map((t) => (
              <li key={t.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted/50">
                  <t.icon className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                </div>
                <Switch
                  checked={prefs[t.id]}
                  onCheckedChange={() => toggle(t.id)}
                  aria-label={t.label}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        {dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        <button
          onClick={handleSave}
          disabled={saving || isLoading || !dirty}
          className={cn(
            'px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground transition-colors',
            'hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2',
          )}
        >
          {saving && <Loader2 className="size-3.5 animate-spin" />}
          Save Preferences
        </button>
      </div>
    </div>
  )
}
