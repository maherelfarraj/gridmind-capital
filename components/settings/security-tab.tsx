'use client'

import * as React from 'react'
import { Shield, Monitor, Smartphone, Globe, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'

const LOGIN_HISTORY = [
  { id: 'l1', device: 'Chrome on MacBook Pro',  ip: '82.11.44.201', location: 'Riyadh, SA',  time: '2026-07-21 14:32', status: 'success' },
  { id: 'l2', device: 'Safari on iPhone 15',    ip: '82.11.44.201', location: 'Riyadh, SA',  time: '2026-07-21 08:05', status: 'success' },
  { id: 'l3', device: 'Chrome on Windows PC',   ip: '91.74.22.10',  location: 'Dubai, AE',   time: '2026-07-19 11:18', status: 'success' },
  { id: 'l4', device: 'Unknown browser',         ip: '104.16.0.14',  location: 'Unknown',     time: '2026-07-18 02:44', status: 'failed'  },
  { id: 'l5', device: 'Firefox on MacBook Pro', ip: '82.11.44.201', location: 'Riyadh, SA',  time: '2026-07-17 16:50', status: 'success' },
]

const CONNECTED_APPS = [
  { id: 'a1', name: 'Slack Workspace', desc: 'GridMind Capital · notifications, mentions', connected: '2026-01-10', icon: '#4A154B', abbr: 'SL' },
  { id: 'a2', name: 'Microsoft Teams', desc: 'Project activity digest channel',             connected: '2026-03-22', icon: '#5059C9', abbr: 'MT' },
  { id: 'a3', name: 'Power BI',        desc: 'Read-only dashboard data export',             connected: '2026-05-01', icon: '#F2C811', abbr: 'PB' },
]

export function SecurityTab({ onSave }: { onSave: () => void }) {
  const [apps, setApps] = React.useState(CONNECTED_APPS)

  function disconnect(id: string) {
    setApps((a) => a.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Login history */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Login History</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Recent authentication events for your account.</p>
        </div>
        <div className="divide-y divide-border">
          {LOGIN_HISTORY.map((l) => (
            <div key={l.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className={cn('size-2 rounded-full flex-shrink-0', l.status === 'success' ? 'bg-green-500' : 'bg-destructive')} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{l.device}</p>
                <p className="text-xs text-muted-foreground">{l.location} · {l.ip}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-mono text-muted-foreground">{l.time}</p>
                <p className={cn('text-[10px] font-semibold mt-0.5', l.status === 'success' ? 'text-green-500' : 'text-destructive')}>
                  {l.status === 'success' ? 'Success' : 'Failed'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Connected Apps */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Connected Applications</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Third-party apps and OAuth integrations with access to your account.</p>
        </div>
        {apps.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">No connected applications.</div>
        ) : (
          <div className="divide-y divide-border">
            {apps.map((app) => (
              <div key={app.id} className="flex items-center gap-4 px-5 py-4">
                <div className="size-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                  style={{ background: app.icon }}>
                  {app.abbr}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{app.name}</p>
                  <p className="text-xs text-muted-foreground">{app.desc}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">Connected {app.connected}</p>
                </div>
                <button onClick={() => disconnect(app.id)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive font-medium transition-colors flex-shrink-0">
                  <Unlink className="size-3" /> Disconnect
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
