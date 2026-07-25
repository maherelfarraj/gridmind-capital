'use client'

import * as React from 'react'
import { Mail, CheckCircle2, Shield, Smartphone, Monitor, Tablet, LogOut, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

const SESSIONS = [
  { id: 's1', device: 'MacBook Pro 16"', browser: 'Chrome 124', location: 'Riyadh, SA', ip: '82.11.44.201', lastActive: 'Now',         icon: Monitor,    current: true },
  { id: 's2', device: 'iPhone 15 Pro',   browser: 'Safari iOS', location: 'Riyadh, SA', ip: '82.11.44.201', lastActive: '2h ago',      icon: Smartphone, current: false },
  { id: 's3', device: 'iPad Pro 12.9"',  browser: 'Safari iPadOS', location: 'Dubai, AE', ip: '91.74.22.10', lastActive: '3 days ago', icon: Tablet,     current: false },
]

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter',       ok: /[A-Z]/.test(password) },
    { label: 'Number',                 ok: /\d/.test(password) },
    { label: 'Special character',      ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.ok).length
  const colors = ['bg-destructive', 'bg-orange-500', 'bg-amber-500', 'bg-green-500']
  const labels = ['Weak', 'Fair', 'Good', 'Strong']

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < score ? colors[score - 1] : 'bg-muted/40')} />
        ))}
      </div>
      {password && (
        <div className="grid grid-cols-2 gap-1">
          {checks.map((c) => (
            <p key={c.label} className={cn('text-[10px] flex items-center gap-1', c.ok ? 'text-green-500' : 'text-muted-foreground')}>
              <span>{c.ok ? '✓' : '○'}</span> {c.label}
            </p>
          ))}
        </div>
      )}
      {password && <p className="text-xs font-semibold" style={{ color: ['#ef4444','#f97316','#f59e0b','#22c55e'][score - 1] || '#6b7280' }}>{labels[score - 1] || 'Too short'}</p>}
    </div>
  )
}

export function AccountTab({ onSave }: { onSave: () => void }) {
  const [email]           = React.useState('j.morgan@gridmind.com')
  const [currentPw, setCurrentPw] = React.useState('')
  const [newPw, setNewPw] = React.useState('')
  const [confirmPw, setConfirmPw] = React.useState('')
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew]         = React.useState(false)
  const [twoFAEnabled, setTwoFAEnabled] = React.useState(false)
  const [showQR, setShowQR]           = React.useState(false)
  const [sessions, setSessions]       = React.useState(SESSIONS)
  const [dangerConfirm, setDangerConfirm] = React.useState('')

  function revokeSession(id: string) {
    setSessions((s) => s.filter((x) => x.id !== id))
  }

  return (
    <div className="space-y-8">
      {/* Email */}
      <Section title="Email Address">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <Mail className="size-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm text-foreground flex-1">{email}</span>
          <span className="flex items-center gap-1 text-xs text-green-500 font-semibold">
            <CheckCircle2 className="size-3.5" /> Verified
          </span>
        </div>
        <button className="text-xs text-primary hover:underline mt-1">Change email address</button>
      </Section>

      {/* Password */}
      <Section title="Change Password">
        <div className="space-y-3">
          {[
            { label: 'Current password', value: currentPw, set: setCurrentPw, show: showCurrent, toggle: () => setShowCurrent(!showCurrent) },
            { label: 'New password',     value: newPw,     set: setNewPw,     show: showNew,     toggle: () => setShowNew(!showNew) },
          ].map(({ label, value, set, show, toggle }) => (
            <div key={label} className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">{label}</label>
              <div className="relative">
                <input type={show ? 'text' : 'password'} value={value} onChange={(e) => set(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-9 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50" />
                <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </div>
          ))}
          {newPw && <PasswordStrength password={newPw} />}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Confirm new password</label>
            <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              className={cn('w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50',
                confirmPw && confirmPw !== newPw ? 'border-destructive' : 'border-border')} />
            {confirmPw && confirmPw !== newPw && <p className="text-xs text-destructive">Passwords do not match</p>}
          </div>
          <button onClick={onSave} disabled={!currentPw || !newPw || newPw !== confirmPw}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors">
            Update Password
          </button>
        </div>
      </Section>

      {/* 2FA */}
      <Section title="Two-Factor Authentication">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground font-medium">Authenticator App (TOTP)</p>
            <p className="text-xs text-muted-foreground mt-0.5">Use an app like Google Authenticator or Authy.</p>
          </div>
          <Switch checked={twoFAEnabled} onCheckedChange={(v) => { setTwoFAEnabled(v); if (v) setShowQR(true) }} />
        </div>
        {showQR && twoFAEnabled && (
          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-5 space-y-3">
            <p className="text-xs font-semibold text-foreground">Scan with your authenticator app</p>
            {/* QR placeholder */}
            <div className="size-32 rounded-lg bg-white border border-border flex items-center justify-center">
              <div className="grid grid-cols-5 gap-0.5 p-2 opacity-70">
                {QR_PLACEHOLDER_CELLS.map((filled, i) => (
                  <div key={i} className={cn('size-3 rounded-sm', filled ? 'bg-black' : 'bg-transparent')} />
                ))}
              </div>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">JBSWY3DPEHPK3PXP</p>
            <div className="flex gap-2">
              <input placeholder="Enter 6-digit code" maxLength={6}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground font-mono outline-none focus:ring-1 focus:ring-ring/50" />
              <button onClick={() => { setShowQR(false); onSave() }}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors">
                Verify
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Sessions */}
      <Section title="Active Sessions">
        <div className="space-y-2">
          {sessions.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.id} className="flex items-center gap-4 rounded-lg border border-border bg-background px-4 py-3">
                <Icon className="size-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{s.device}</p>
                    {s.current && <span className="text-[10px] font-semibold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full">Current</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.browser} · {s.location} · {s.ip} · {s.lastActive}</p>
                </div>
                {!s.current && (
                  <button onClick={() => revokeSession(s.id)}
                    className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors">
                    Revoke
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button className="flex items-center gap-1.5 text-xs text-destructive hover:text-destructive/80 font-medium mt-2 transition-colors">
          <LogOut className="size-3.5" /> Log out all other sessions
        </button>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone" danger>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-4 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">Deactivate Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Your data will be retained for 30 days before permanent deletion.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Type your password to confirm</label>
            <input type="password" value={dangerConfirm} onChange={(e) => setDangerConfirm(e.target.value)}
              placeholder="Enter password…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-destructive/50" />
          </div>
          <button disabled={!dangerConfirm}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-destructive text-white hover:bg-destructive/90 disabled:opacity-40 transition-colors">
            Deactivate Account
          </button>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="space-y-3">
      <h3 className={cn('text-sm font-semibold', danger ? 'text-destructive' : 'text-foreground')}>{title}</h3>
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">{children}</div>
    </div>
  )
}
