'use client'

import * as React from 'react'
import { ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Endpoint } from './types'
import { METHOD_STYLES } from './types'
import { CodeBlock } from './code-block'

interface EndpointCardProps {
  endpoint: Endpoint
  onTryIt: (endpoint: Endpoint) => void
}

const LOCATION_BADGE: Record<string, string> = {
  path:  'bg-violet-500/15 text-violet-400 border-violet-500/25',
  query: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  body:  'bg-orange-500/15 text-orange-400 border-orange-500/25',
}

export function EndpointCard({ endpoint, onTryIt }: EndpointCardProps) {
  const [expanded, setExpanded] = React.useState(false)
  const [showResponse, setShowResponse] = React.useState(false)
  const style = METHOD_STYLES[endpoint.method]

  return (
    <div className={cn(
      'rounded-xl border transition-all duration-200',
      expanded ? 'border-white/15 shadow-lg shadow-black/20' : 'border-white/8 hover:border-white/15'
    )}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start justify-between gap-3 px-4 py-4 text-left group"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn(
            'text-[11px] font-bold font-mono px-2 py-0.5 rounded border w-16 text-center shrink-0',
            style.bg, style.text, style.border
          )}>
            {endpoint.method}
          </span>
          <code className="text-sm text-slate-200 font-mono truncate">{endpoint.path}</code>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 hidden sm:block truncate max-w-48">
            {endpoint.summary}
          </span>
          {expanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-5 border-t border-white/8 pt-4">
          {/* Description */}
          <p className="text-sm text-slate-400 leading-relaxed">{endpoint.description}</p>

          {/* Parameters table */}
          {endpoint.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">Parameters</h4>
              <div className="rounded-lg border border-white/8 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-white/3">
                    <tr>
                      {['Name', 'Type', 'Location', 'Req.', 'Description'].map(h => (
                        <th key={h} className="text-left px-3 py-2 text-slate-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.params.map((p, i) => (
                      <tr key={p.name} className={cn('border-t border-white/5', i % 2 === 0 ? '' : 'bg-white/2')}>
                        <td className="px-3 py-2">
                          <code className="text-blue-300 font-mono">{p.name}</code>
                        </td>
                        <td className="px-3 py-2">
                          <code className="text-slate-400 font-mono">{p.type}</code>
                        </td>
                        <td className="px-3 py-2">
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border', LOCATION_BADGE[p.location] ?? 'bg-slate-500/15 text-slate-400')}>
                            {p.location}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {p.required
                            ? <span className="text-red-400 font-medium">yes</span>
                            : <span className="text-slate-600">no</span>}
                        </td>
                        <td className="px-3 py-2 text-slate-400">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Request body */}
          {endpoint.requestBody && (
            <div>
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">Request Body</h4>
              <CodeBlock code={endpoint.requestBody} language="json" label="application/json" />
            </div>
          )}

          {/* Code examples with language tabs */}
          <div>
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5">Example Request</h4>
            <CodeBlock
              code={endpoint.examples[0].code}
              tabs={endpoint.examples.map(e => ({ language: e.language as any, code: e.code }))}
            />
          </div>

          {/* Response */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Response</h4>
              <div className="flex items-center gap-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-mono font-bold">200 OK</span>
                <button
                  onClick={() => setShowResponse(r => !r)}
                  className="text-xs text-slate-500 hover:text-slate-300 ml-1"
                >
                  {showResponse ? 'hide' : 'show schema'}
                </button>
              </div>
            </div>
            {showResponse && (
              <CodeBlock code={endpoint.responseBody} language="json" label="Response body" />
            )}
          </div>

          {/* Try It button */}
          <button
            onClick={() => onTryIt(endpoint)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
          >
            <Zap size={14} />
            Try It
          </button>
        </div>
      )}
    </div>
  )
}
