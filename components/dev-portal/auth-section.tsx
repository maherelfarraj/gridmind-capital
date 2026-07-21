'use client'

import * as React from 'react'
import { Eye, EyeOff, Copy, Check, Plus, Trash2, RefreshCw, ArrowRight, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CodeBlock } from './code-block'
import { MOCK_API_KEYS, type ApiKey } from './types'

export function AuthSection() {
  const [keys, setKeys]           = React.useState<ApiKey[]>(MOCK_API_KEYS)
  const [revealed, setRevealed]   = React.useState<Record<string, boolean>>({})
  const [copied, setCopied]       = React.useState<Record<string, boolean>>({})
  const [creating, setCreating]   = React.useState(false)
  const [newKeyName, setNewKeyName] = React.useState('')
  const [newKey, setNewKey]       = React.useState<string | null>(null)

  function mask(key: string) {
    return key.slice(0, 14) + '••••••••••••••••••••' + key.slice(-4)
  }

  function handleCopy(key: ApiKey) {
    navigator.clipboard.writeText(key.key)
    setCopied(c => ({ ...c, [key.id]: true }))
    setTimeout(() => setCopied(c => ({ ...c, [key.id]: false })), 2000)
  }

  function generateKey(name: string): string {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    return `gm_live_sk_${rand}`
  }

  function handleCreate() {
    if (!newKeyName.trim()) return
    const key = generateKey(newKeyName)
    const newEntry: ApiKey = {
      id: `key_${Date.now()}`,
      name: newKeyName,
      key,
      created: new Date().toISOString().slice(0, 10),
      lastUsed: 'Never',
      scopes: ['read'],
    }
    setKeys(k => [...k, newEntry])
    setNewKey(key)
    setNewKeyName('')
    setCreating(false)
  }

  function handleRevoke(id: string) {
    setKeys(k => k.filter(key => key.id !== id))
  }

  const SCOPE_COLORS: Record<string, string> = {
    read:  'bg-blue-500/15 text-blue-400 border-blue-500/25',
    write: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    admin: 'bg-red-500/15 text-red-400 border-red-500/25',
  }

  return (
    <div className="space-y-8">
      {/* Overview */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-3">Authentication</h2>
        <p className="text-slate-400 leading-relaxed text-sm">
          GridMind Capital API uses Bearer token authentication. Include your API key in the{' '}
          <code className="text-blue-300 bg-blue-500/10 px-1 py-0.5 rounded text-xs">Authorization</code> header of every request.
        </p>
      </div>

      <CodeBlock
        code={`curl https://api.gridmind.capital/v1/projects \\
  -H "Authorization: Bearer gm_live_sk_1234567890abcdef"`}
        language="curl"
        label="Authorization header"
      />

      {/* API Key Management */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-white">API Keys</h3>
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
          >
            <Plus size={12} /> Generate New Key
          </button>
        </div>

        {/* New key banner */}
        {newKey && (
          <div className="mb-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/8">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400 mb-2">
              <ShieldCheck size={15} /> Your new API key (copy it now — shown only once)
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-emerald-300 bg-black/20 px-3 py-2 rounded-lg truncate">{newKey}</code>
              <button
                onClick={() => { navigator.clipboard.writeText(newKey); }}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/25"
              >
                <Copy size={11} /> Copy
              </button>
              <button onClick={() => setNewKey(null)} className="text-slate-500 hover:text-white">
                <Check size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        {creating && (
          <div className="mb-4 p-4 rounded-xl border border-white/12 bg-white/3 flex items-center gap-3">
            <input
              autoFocus
              type="text"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Key name (e.g. Production)"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
            />
            <button onClick={handleCreate} className="text-xs px-3 py-1.5 rounded-lg bg-blue-500 text-white hover:bg-blue-600">Create</button>
            <button onClick={() => setCreating(false)} className="text-slate-500 hover:text-white"><X size={14} /></button>
          </div>
        )}

        {/* Keys table */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/3 border-b border-white/8">
              <tr>
                {['Name', 'Key', 'Scopes', 'Created', 'Last Used', ''].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((key, i) => (
                <tr key={key.id} className={cn('border-t border-white/5', i % 2 !== 0 && 'bg-white/2')}>
                  <td className="px-4 py-3 text-slate-200 font-medium text-xs">{key.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono text-slate-400 truncate max-w-40">
                        {revealed[key.id] ? key.key : mask(key.key)}
                      </code>
                      <button onClick={() => setRevealed(r => ({ ...r, [key.id]: !r[key.id] }))} className="text-slate-600 hover:text-slate-300 shrink-0">
                        {revealed[key.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button onClick={() => handleCopy(key)} className="text-slate-600 hover:text-slate-300 shrink-0">
                        {copied[key.id] ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {key.scopes.map(s => (
                        <span key={s} className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', SCOPE_COLORS[s] ?? 'bg-slate-500/15 text-slate-400')}>{s}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{key.created}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{key.lastUsed}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleRevoke(key.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* OAuth 2.0 flow */}
      <div>
        <h3 className="text-base font-semibold text-white mb-3">OAuth 2.0 Flow</h3>
        <div className="rounded-xl border border-white/10 p-5 bg-white/2">
          <div className="flex items-center gap-2 flex-wrap text-xs text-slate-300 font-mono">
            {[
              { label: 'Your App', bg: 'bg-blue-500/20 border-blue-500/30 text-blue-300' },
              null,
              { label: 'Authorization Request', bg: 'bg-white/5 border-white/10 text-slate-400', small: true },
              null,
              { label: 'GridMind Auth', bg: 'bg-violet-500/20 border-violet-500/30 text-violet-300' },
              null,
              { label: 'Authorization Code', bg: 'bg-white/5 border-white/10 text-slate-400', small: true },
              null,
              { label: 'Token Exchange', bg: 'bg-white/5 border-white/10 text-slate-400', small: true },
              null,
              { label: 'Access Token', bg: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' },
            ].map((item, i) =>
              item === null
                ? <ArrowRight key={i} size={14} className="text-slate-600 shrink-0" />
                : (
                  <span key={i} className={cn('px-2.5 py-1.5 rounded-lg border font-medium', item.bg, item.small && 'text-[10px]')}>
                    {item.label}
                  </span>
                )
            )}
          </div>
        </div>

        <CodeBlock
          code={`POST https://auth.gridmind.capital/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTH_CODE_HERE
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&redirect_uri=https://your-app.com/callback`}
          language="bash"
          label="Token exchange"
        />
      </div>

      {/* JWT */}
      <div>
        <h3 className="text-base font-semibold text-white mb-3">JWT Tokens</h3>
        <p className="text-sm text-slate-400 mb-3 leading-relaxed">
          Access tokens are signed JWTs with a 1-hour expiry. Refresh tokens last 30 days.
          Decode the payload to inspect claims — never trust decoded claims without verifying the signature.
        </p>
        <CodeBlock
          code={JSON.stringify({
            sub: 'usr_01J2XABC',
            iss: 'https://auth.gridmind.capital',
            aud: 'gridmind-api',
            exp: 1753091200,
            iat: 1753087600,
            roles: ['PROJECT_DIRECTOR'],
            tenant: 'ten_01J2XDEF',
          }, null, 2)}
          language="json"
          label="JWT payload (decoded)"
        />
      </div>
    </div>
  )
}

function X({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
