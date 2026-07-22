'use client'

import * as React from 'react'
import { Key, Plus, Copy, Trash2, Eye, EyeOff, AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApiKey {
  id: string
  name: string
  prefix: string
  secret: string
  scopes: string[]
  created: string
  lastUsed: string
  expires: string | null
}

const MOCK_KEYS: ApiKey[] = [
  { id: 'k1', name: 'CI/CD Pipeline',     prefix: 'gm_', secret: 'gm_sk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', scopes: ['read:projects', 'read:documents'],  created: '2026-01-15', lastUsed: '2h ago',   expires: null           },
  { id: 'k2', name: 'Power BI Integration', prefix: 'gm_', secret: 'gm_sk_live_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4', scopes: ['read:finance', 'read:projects'],  created: '2026-03-22', lastUsed: '1d ago',   expires: '2027-03-22'   },
  { id: 'k3', name: 'Python SDK (Dev)',   prefix: 'gm_', secret: 'gm_sk_dev_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6',  scopes: ['read:projects', 'write:documents'], created: '2026-06-01', lastUsed: 'Never',    expires: '2026-12-31'   },
]

const SCOPE_OPTIONS = ['read:projects', 'write:projects', 'read:documents', 'write:documents', 'read:finance', 'read:approvals', 'admin:users']

export function ApiKeysTab({ onSave }: { onSave: () => void }) {
  const [keys, setKeys] = React.useState(MOCK_KEYS)
  const [revealId, setRevealId] = React.useState<string | null>(null)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [showCreate, setShowCreate] = React.useState(false)
  const [newName, setNewName]     = React.useState('')
  const [newScopes, setNewScopes] = React.useState<string[]>(['read:projects'])
  const [newExpiry, setNewExpiry] = React.useState('')
  const [newKeyShown, setNewKeyShown] = React.useState<string | null>(null)

  function copyKey(secret: string, id: string) {
    navigator.clipboard.writeText(secret).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function revokeKey(id: string) {
    setKeys((k) => k.filter((x) => x.id !== id))
  }

  function createKey() {
    const secret = `gm_sk_live_${Math.random().toString(36).slice(2, 34)}`
    const newKey: ApiKey = {
      id: `k${Date.now()}`, name: newName, prefix: 'gm_', secret,
      scopes: newScopes, created: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never', expires: newExpiry || null,
    }
    setKeys((k) => [newKey, ...k])
    setNewKeyShown(secret)
    setShowCreate(false)
    setNewName('')
    setNewScopes(['read:projects'])
    setNewExpiry('')
    onSave()
  }

  function toggleScope(scope: string) {
    setNewScopes((s) => s.includes(scope) ? s.filter((x) => x !== scope) : [...s, scope])
  }

  return (
    <div className="space-y-6">
      {/* Newly created key banner */}
      {newKeyShown && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm font-semibold text-amber-500">Copy your API key now — it won&apos;t be shown again.</p>
          </div>
          <div className="flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2">
            <code className="text-xs font-mono text-foreground flex-1 truncate">{newKeyShown}</code>
            <button onClick={() => copyKey(newKeyShown, 'new')}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium flex-shrink-0">
              {copiedId === 'new' ? <><Check className="size-3" /> Copied</> : <><Copy className="size-3" /> Copy</>}
            </button>
          </div>
          <button onClick={() => setNewKeyShown(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">API Keys</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Keys grant programmatic access to GridMind APIs.</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-semibold transition-colors">
            <Plus className="size-3" /> New Key
          </button>
        </div>

        {showCreate && (
          <div className="px-5 py-4 border-b border-border bg-muted/10 space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Create New API Key</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Key Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. My Integration"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Expiry (optional)</label>
                <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring/50" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Scopes</label>
              <div className="flex flex-wrap gap-2">
                {SCOPE_OPTIONS.map((s) => (
                  <button key={s} onClick={() => toggleScope(s)}
                    className={cn('text-xs px-2.5 py-1 rounded-full border font-mono transition-all',
                      newScopes.includes(s) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted/40')}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="text-xs px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors">
                Cancel
              </button>
              <button disabled={!newName || newScopes.length === 0} onClick={createKey}
                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 font-semibold transition-colors">
                Generate Key
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-border">
          {keys.map((k) => {
            const revealed = revealId === k.id
            return (
              <div key={k.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center gap-3">
                  <Key className="size-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{k.name}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {k.scopes.map((s) => (
                        <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setRevealId(revealed ? null : k.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                    <button onClick={() => copyKey(k.secret, k.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      {copiedId === k.id ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
                    </button>
                    <button onClick={() => revokeKey(k.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-muted/30 rounded-lg px-3 py-1.5">
                  <code className="text-xs font-mono text-foreground flex-1 truncate">
                    {revealed ? k.secret : `${k.prefix}sk_live_${'•'.repeat(28)}`}
                  </code>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span>Created {k.created}</span>
                  <span>Last used: {k.lastUsed}</span>
                  {k.expires && <span className="text-amber-500">Expires {k.expires}</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
