'use client'

import * as React from 'react'
import { Bell, Mail, Smartphone, Hash, Clock } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

type Channel = 'inapp' | 'email' | 'push' | 'slack'
type Category = 'approvals' | 'tasks' | 'documents' | 'mentions' | 'budget' | 'system'
type Digest = 'realtime' | 'hourly' | 'daily' | 'weekly'

const CHANNELS: { id: Channel; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'inapp', label: 'In-app', icon: Bell },
  { id: 'email', label: 'Email',  icon: Mail },
  { id: 'push',  label: 'Push',   icon: Smartphone },
  { id: 'slack', label: 'Slack',  icon: Hash },
]

const CATEGORIES: { id: Category; label: string; desc: string }[] = [
  { id: 'approvals',  label: 'Approvals',     desc: 'Gate reviews, approval requests, decisions' },
  { id: 'tasks',      label: 'Tasks',         desc: 'Assignments, due dates, completions' },
  { id: 'documents',  label: 'Documents',     desc: 'Uploads, reviews, transmittals' },
  { id: 'mentions',   label: 'Mentions',      desc: 'When someone @mentions you' },
  { id: 'budget',     label: 'Budget Alerts', desc: 'Cost overruns, forecast changes' },
  { id: 'system',     label: 'System',        desc: 'Platform updates, maintenance windows' },
]

const DIGEST_OPTIONS: { id: Digest; label: string }[] = [
  { id: 'realtime', label: 'Real-time' },
  { id: 'hourly',   label: 'Hourly digest' },
  { id: 'daily',    label: 'Daily digest' },
  { id: 'weekly',   label: 'Weekly digest' },
]

type Settings = Record<Category, Record<Channel, boolean>>

const DEFAULT_SETTINGS: Settings = {
  approvals:  { inapp: true,  email: true,  push: true,  slack: true  },
  tasks:      { inapp: true,  email: true,  push: false, slack: false },
  documents:  { inapp: true,  email: false, push: false, slack: false },
  mentions:   { inapp: true,  email: true,  push: true,  slack: true  },
  budget:     { inapp: true,  email: true,  push: true,  slack: false },
  system:     { inapp: true,  email: true,  push: false, slack: false },
}

export function NotificationsTab({ onSave }: { onSave: () => void }) {
  const [settings, setSettings] = React.useState<Settings>(DEFAULT_SETTINGS)
  const [digest, setDigest]     = React.useState<Digest>('realtime')
  const [quietFrom, setQuietFrom] = React.useState('22:00')
  const [quietTo, setQuietTo]     = React.useState('07:00')
  const [quietEnabled, setQuietEnabled] = React.useState(true)

  function toggle(cat: Category, ch: Channel) {
    setSettings((s) => ({ ...s, [cat]: { ...s[cat], [ch]: !s[cat][ch] } }))
  }

  return (
    <div className="space-y-6">
      {/* Matrix */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 pt-5 pb-3">
          <h3 className="text-sm font-semibold text-foreground">Notification Channels</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Choose how you receive each category of notification.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground w-48">Category</th>
                {CHANNELS.map((ch) => (
                  <th key={ch.id} className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <div className="flex flex-col items-center gap-1">
                      <ch.icon className="size-3.5 text-muted-foreground" />
                      <span>{ch.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat, i) => (
                <tr key={cat.id} className={cn('border-b border-border last:border-0', i % 2 === 0 ? 'bg-card' : 'bg-muted/5')}>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{cat.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{cat.desc}</p>
                  </td>
                  {CHANNELS.map((ch) => (
                    <td key={ch.id} className="px-4 py-3 text-center">
                      <div className="flex justify-center">
                        <Switch
                          checked={settings[cat.id][ch.id]}
                          onCheckedChange={() => toggle(cat.id, ch.id)}
                          aria-label={`${cat.label} ${ch.label}`}
                        />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Digest frequency */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Digest Frequency</h3>
          <p className="text-xs text-muted-foreground mt-0.5">How often email digests are bundled and sent.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DIGEST_OPTIONS.map((d) => (
            <button key={d.id} onClick={() => setDigest(d.id)}
              className={cn('px-4 py-2 rounded-lg border text-sm font-medium transition-all',
                digest === d.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-foreground hover:bg-muted/40')}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quiet hours */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" /> Quiet Hours
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Mute push and Slack notifications during these hours.</p>
          </div>
          <Switch checked={quietEnabled} onCheckedChange={setQuietEnabled} />
        </div>
        {quietEnabled && (
          <div className="flex items-center gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <input type="time" value={quietFrom} onChange={(e) => setQuietFrom(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50" />
            </div>
            <div className="mt-5 text-muted-foreground text-sm">to</div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <input type="time" value={quietTo} onChange={(e) => setQuietTo(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50" />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2 border-t border-border">
        <button onClick={onSave} className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          Save Preferences
        </button>
      </div>
    </div>
  )
}
