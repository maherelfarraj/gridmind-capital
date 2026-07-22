'use client'

import * as React from 'react'
import { X, Plus, Trash2, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Endpoint, HttpMethod } from './types'
import { METHOD_STYLES } from './types'
import { CodeBlock } from './code-block'

interface Header { key: string; value: string; enabled: boolean }

interface ApiTesterModalProps {
  endpoint: Endpoint | null
  onClose: () => void
}

const BASE_URL = 'https://api.gridmind.capital'

export function ApiTesterModal({ endpoint, onClose }: ApiTesterModalProps) {
  const [method, setMethod]       = React.useState<HttpMethod>('GET')
  const [url, setUrl]             = React.useState('')
  const [headers, setHeaders]     = React.useState<Header[]>([
    { key: 'Authorization', value: 'Bearer gm_live_sk_...', enabled: true },
    { key: 'Content-Type',  value: 'application/json',      enabled: true },
  ])
  const [body, setBody]           = React.useState('')
  const [bodyError, setBodyError] = React.useState('')
  const [sending, setSending]     = React.useState(false)
  const [response, setResponse]   = React.useState<{ status: number; body: string } | null>(null)

  // Pre-fill from endpoint
  React.useEffect(() => {
    if (!endpoint) return
    setMethod(endpoint.method)
    setUrl(`${BASE_URL}${endpoint.path}`)
    setBody(endpoint.requestBody ?? '')
    setBodyError('')
    setResponse(null)
  }, [endpoint])

  function validateBody(val: string) {
    setBody(val)
    if (!val.trim()) { setBodyError(''); return }
    try { JSON.parse(val); setBodyError('') }
    catch { setBodyError('Invalid JSON') }
  }

  function addHeader() {
    setHeaders(h => [...h, { key: '', value: '', enabled: true }])
  }
  function removeHeader(i: number) {
    setHeaders(h => h.filter((_, idx) => idx !== i))
  }
  function updateHeader(i: number, field: 'key' | 'value' | 'enabled', val: string | boolean) {
    setHeaders(h => h.map((hh, idx) => idx === i ? { ...hh, [field]: val } : hh))
  }

  async function sendRequest() {
    setSending(true)
    setResponse(null)
    // Simulate response — real integration would proxy through a Next.js route handler
    await new Promise(r => setTimeout(r, 900 + Math.random() * 600))
    const simulatedBody = endpoint?.responseBody ?? JSON.stringify({ message: 'OK' }, null, 2)
    setResponse({ status: 200, body: simulatedBody })
    setSending(false)
  }

  if (!endpoint) return null
  const style = METHOD_STYLES[method]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-3xl bg-[#0f1223] border border-white/15 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <Send size={13} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">API Tester</h2>
              <p className="text-[11px] text-slate-500">{endpoint.summary}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Method + URL */}
          <div className="flex gap-2">
            <select
              value={method}
              onChange={e => setMethod(e.target.value as HttpMethod)}
              className="bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-xs font-bold font-mono text-white focus:outline-none focus:border-blue-500/50"
            >
              {(['GET','POST','PUT','PATCH','DELETE'] as HttpMethod[]).map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              className="flex-1 bg-[#1a1a2e] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50"
              placeholder="https://api.gridmind.capital/v1/..."
            />
            <button
              onClick={sendRequest}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Headers</h3>
              <button onClick={addHeader} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <Plus size={11} /> Add
              </button>
            </div>
            <div className="space-y-1.5 rounded-lg border border-white/8 p-3 bg-white/2">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={h.enabled}
                    onChange={e => updateHeader(i, 'enabled', e.target.checked)}
                    className="accent-blue-500 shrink-0"
                  />
                  <input
                    value={h.key}
                    onChange={e => updateHeader(i, 'key', e.target.value)}
                    placeholder="Header name"
                    className="flex-1 bg-transparent border border-white/8 rounded px-2 py-1 text-xs font-mono text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-blue-500/40"
                  />
                  <input
                    value={h.value}
                    onChange={e => updateHeader(i, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 bg-transparent border border-white/8 rounded px-2 py-1 text-xs font-mono text-slate-300 placeholder:text-slate-700 focus:outline-none focus:border-blue-500/40"
                  />
                  <button onClick={() => removeHeader(i)} className="text-slate-600 hover:text-red-400 shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          {method !== 'GET' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Body</h3>
                {bodyError && <span className="text-[10px] text-red-400 flex items-center gap-1"><AlertCircle size={10} />{bodyError}</span>}
              </div>
              <textarea
                value={body}
                onChange={e => validateBody(e.target.value)}
                rows={6}
                className={cn(
                  'w-full bg-[#1a1a2e] border rounded-lg px-3 py-2.5 text-xs font-mono text-slate-200 resize-y focus:outline-none',
                  bodyError ? 'border-red-500/40 focus:border-red-500/60' : 'border-white/10 focus:border-blue-500/40'
                )}
                placeholder='{ "key": "value" }'
              />
            </div>
          )}

          {/* Response */}
          {response && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Response</h3>
                <span className={cn(
                  'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border',
                  response.status < 300
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                    : 'bg-red-500/15 text-red-400 border-red-500/25'
                )}>
                  {response.status < 300 ? <CheckCircle size={9} /> : <AlertCircle size={9} />}
                  {response.status} {response.status < 300 ? 'OK' : 'Error'}
                </span>
              </div>
              <CodeBlock code={response.body} language="json" label="Response body" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
