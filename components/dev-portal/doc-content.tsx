'use client'

import * as React from 'react'
import { ExternalLink, Package, GitBranch, AlertCircle, Info, CheckCircle } from 'lucide-react'
import type { Endpoint } from './types'
import { PROJECTS_ENDPOINTS, GATES_ENDPOINTS, TASKS_ENDPOINTS } from './types'
import { EndpointCard } from './endpoint-card'
import { AuthSection } from './auth-section'
import { CodeBlock } from './code-block'

interface DocContentProps {
  section: string
  onTryIt: (ep: Endpoint) => void
}

function SectionHeader({ title, description, badge }: { title: string; description?: string; badge?: string }) {
  return (
    <div className="mb-6 pb-5 border-b border-white/8">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {badge && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
            {badge}
          </span>
        )}
      </div>
      {description && <p className="text-sm text-slate-400 leading-relaxed">{description}</p>}
    </div>
  )
}

function Callout({ type, children }: { type: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info:    { bg: 'bg-blue-500/8 border-blue-500/25',    icon: <Info size={14} className="text-blue-400 shrink-0 mt-0.5" /> },
    warning: { bg: 'bg-amber-500/8 border-amber-500/25',  icon: <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" /> },
    success: { bg: 'bg-emerald-500/8 border-emerald-500/25', icon: <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5" /> },
  }
  const s = styles[type]
  return (
    <div className={`flex gap-3 p-4 rounded-xl border text-sm text-slate-300 leading-relaxed ${s.bg}`}>
      {s.icon}
      <div>{children}</div>
    </div>
  )
}

function ErrorTable() {
  const errors = [
    { code: '400', name: 'Bad Request',      description: 'The request body or parameters are invalid.' },
    { code: '401', name: 'Unauthorized',     description: 'Missing or invalid API key.' },
    { code: '403', name: 'Forbidden',        description: 'Insufficient permissions for this resource.' },
    { code: '404', name: 'Not Found',        description: 'The requested resource does not exist.' },
    { code: '409', name: 'Conflict',         description: 'The request conflicts with current state.' },
    { code: '422', name: 'Unprocessable',    description: 'Business rule validation failed.' },
    { code: '429', name: 'Rate Limited',     description: 'Too many requests. See X-RateLimit-Reset header.' },
    { code: '500', name: 'Server Error',     description: 'Internal server error. Contact support.' },
  ]
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-white/3 border-b border-white/8">
          <tr>
            {['Code', 'Name', 'Description'].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {errors.map((e, i) => (
            <tr key={e.code} className={`border-t border-white/5 ${i % 2 !== 0 ? 'bg-white/2' : ''}`}>
              <td className="px-4 py-2.5">
                <span className={`font-mono font-bold text-xs ${parseInt(e.code) < 500 ? 'text-amber-400' : 'text-red-400'}`}>{e.code}</span>
              </td>
              <td className="px-4 py-2.5 text-slate-300 font-medium">{e.name}</td>
              <td className="px-4 py-2.5 text-slate-500">{e.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function DocContent({ section, onTryIt }: DocContentProps) {
  switch (section) {
    case 'introduction':
      return (
        <div className="space-y-6">
          <SectionHeader
            title="GridMind Capital API"
            description="The GridMind Capital API provides programmatic access to your capital project governance platform. Manage projects, stage gates, documents, tasks, and workflows via REST."
            badge="v1 stable"
          />
          <Callout type="success">
            The API is generally available. All endpoints follow REST conventions and return JSON.
          </Callout>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { title: '47 Endpoints', desc: 'Across 8 resource types' },
              { title: 'REST + JSON', desc: 'Standard HTTP conventions' },
              { title: 'SDKs for 4 languages', desc: 'JS, Python, Go, Ruby' },
            ].map(c => (
              <div key={c.title} className="p-4 rounded-xl border border-white/8 bg-white/2">
                <div className="text-sm font-bold text-white">{c.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{c.desc}</div>
              </div>
            ))}
          </div>
          <CodeBlock
            code={`curl https://api.gridmind.capital/v1/projects \\
  -H "Authorization: Bearer gm_live_sk_1234567890abcdef"`}
            language="curl"
            label="Quick start"
          />
        </div>
      )

    case 'authentication':
      return <AuthSection />

    case 'base-urls':
      return (
        <div className="space-y-6">
          <SectionHeader title="Base URLs" description="Use the appropriate base URL for your environment." />
          {[
            { env: 'Production', url: 'https://api.gridmind.capital/v1', badge: 'Live data' },
            { env: 'Sandbox',    url: 'https://sandbox.api.gridmind.capital/v1', badge: 'Test data' },
          ].map(b => (
            <div key={b.env} className="p-4 rounded-xl border border-white/8 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white mb-0.5">{b.env}</div>
                <code className="text-xs font-mono text-blue-300">{b.url}</code>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-white/10 text-slate-500 shrink-0">{b.badge}</span>
            </div>
          ))}
          <Callout type="info">
            Sandbox requests are isolated and have no effect on production data. Use test API keys (prefixed <code className="text-blue-300">gm_test_sk_</code>) with the sandbox URL.
          </Callout>
        </div>
      )

    case 'rate-limits':
      return (
        <div className="space-y-6">
          <SectionHeader title="Rate Limits" description="Rate limits are applied per API key per minute." />
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-white/3 border-b border-white/8">
                <tr>
                  {['Plan', 'Requests / min', 'Burst'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-slate-500 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { plan: 'Developer', rpm: '60', burst: '100' },
                  { plan: 'Professional', rpm: '300', burst: '500' },
                  { plan: 'Enterprise', rpm: 'Unlimited', burst: 'Custom' },
                ].map((r, i) => (
                  <tr key={r.plan} className={`border-t border-white/5 ${i % 2 !== 0 ? 'bg-white/2' : ''}`}>
                    <td className="px-4 py-2.5 text-slate-300 font-medium">{r.plan}</td>
                    <td className="px-4 py-2.5 text-emerald-400 font-mono font-bold">{r.rpm}</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono">{r.burst}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">Headers: <code className="text-blue-300">X-RateLimit-Limit</code>, <code className="text-blue-300">X-RateLimit-Remaining</code>, <code className="text-blue-300">X-RateLimit-Reset</code> (Unix timestamp)</p>
        </div>
      )

    case 'error-handling':
      return (
        <div className="space-y-6">
          <SectionHeader title="Error Handling" description="All errors return a consistent JSON envelope." />
          <CodeBlock
            code={JSON.stringify({ error: { code: 'GATE_PRECONDITION_FAILED', message: 'Gate G4 has 3 open Cat-A punch items.', details: [{ field: 'punch_items', count: 3 }] } }, null, 2)}
            language="json"
            label="Error response"
          />
          <ErrorTable />
        </div>
      )

    case 'projects':
      return (
        <div className="space-y-5">
          <SectionHeader title="Projects" description="A Project is the top-level entity in GridMind Capital. All gates, documents, tasks, and budgets belong to a project." badge={`${PROJECTS_ENDPOINTS.length} endpoints`} />
          {PROJECTS_ENDPOINTS.map(ep => <EndpointCard key={ep.id} endpoint={ep} onTryIt={onTryIt} />)}
        </div>
      )

    case 'gates':
      return (
        <div className="space-y-5">
          <SectionHeader title="Stage Gates" description="Stage gates are governance checkpoints that projects must pass through to advance. Each gate requires quorum, decisions, and may require external signatures." badge={`${GATES_ENDPOINTS.length} endpoints`} />
          <Callout type="warning">
            Gate decisions are immutable once recorded. The creator of a gate instance may never be the sole approver (segregation of duties).
          </Callout>
          {GATES_ENDPOINTS.map(ep => <EndpointCard key={ep.id} endpoint={ep} onTryIt={onTryIt} />)}
        </div>
      )

    case 'tasks':
      return (
        <div className="space-y-5">
          <SectionHeader title="Tasks" description="Tasks are actionable work items assigned to users, linked to projects and gates." badge={`${TASKS_ENDPOINTS.length} endpoints`} />
          {TASKS_ENDPOINTS.map(ep => <EndpointCard key={ep.id} endpoint={ep} onTryIt={onTryIt} />)}
        </div>
      )

    case 'documents':
    case 'users':
    case 'reports':
      return (
        <div className="space-y-6">
          <SectionHeader title={section.charAt(0).toUpperCase() + section.slice(1)} description="Full API reference coming soon. Contact your account manager for early access." />
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
              <Package size={20} className="text-slate-500" />
            </div>
            <div className="text-sm font-medium text-slate-400 mb-1">Endpoints in progress</div>
            <div className="text-xs text-slate-600">This section will be available in the next release.</div>
          </div>
        </div>
      )

    case 'webhooks':
      return (
        <div className="space-y-6">
          <SectionHeader title="Webhooks" description="Receive real-time event notifications via HTTP POST to your registered endpoint." />
          <Callout type="info">
            Verify authenticity using <code className="text-blue-300">X-GridMind-Signature</code> (HMAC-SHA256 of the raw body with your webhook secret).
          </Callout>
          {[
            'project.created', 'gate.advanced', 'gate.approved',
            'document.approved', 'task.completed', 'budget.exceeded',
          ].map(ev => (
            <div key={ev} className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/8 bg-white/2">
              <code className="text-xs font-mono text-violet-300">{ev}</code>
              <span className="text-xs text-slate-600">
                {{
                  'project.created': 'A new project was created',
                  'gate.advanced': 'A stage gate changed status',
                  'gate.approved': 'A gate was approved',
                  'document.approved': 'A document completed review',
                  'task.completed': 'A task was marked complete',
                  'budget.exceeded': 'Budget threshold was breached',
                }[ev]}
              </span>
            </div>
          ))}
          <CodeBlock
            code={JSON.stringify({ id: 'evt_01J2XABC', type: 'gate.approved', created_at: '2026-07-21T10:00:00Z', data: { gate_id: 'gate_g4', project_id: 'proj_01J2XABC', decided_by: 'usr_ABC' } }, null, 2)}
            language="json"
            label="Webhook payload"
          />
        </div>
      )

    case 'sdks':
      return (
        <div className="space-y-6">
          <SectionHeader title="SDKs & Libraries" description="Official client libraries for common languages." />
          {[
            { lang: 'JavaScript / TypeScript', pkg: '@gridmind/api', install: 'npm install @gridmind/api', stars: '1.2k', color: 'text-yellow-400' },
            { lang: 'Python',                  pkg: 'gridmind',       install: 'pip install gridmind',     stars: '840',  color: 'text-blue-400' },
            { lang: 'Go',                      pkg: 'gridmind-go',    install: 'go get gridmind.capital/go',stars: '320',  color: 'text-cyan-400' },
          ].map(sdk => (
            <div key={sdk.pkg} className="p-4 rounded-xl border border-white/8 bg-white/2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${sdk.color}`}>{sdk.lang}</span>
                  <span className="text-xs text-slate-600 font-mono">{sdk.pkg}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-600">
                  <GitBranch size={11} /> {sdk.stars}
                </div>
              </div>
              <CodeBlock code={sdk.install} language="bash" />
            </div>
          ))}
        </div>
      )

    case 'changelog':
      return (
        <div className="space-y-6">
          <SectionHeader title="Changelog" description="Recent API changes and additions." />
          {[
            { version: 'v1.4.2', date: 'Jul 2026', changes: ['Added gate.signatures endpoint', 'Improved error messages for 422 responses', 'Deprecated /v1/gates/legacy'] },
            { version: 'v1.4.0', date: 'Jun 2026', changes: ['New: Webhooks API (6 event types)', 'Added OAuth 2.0 authorization flow', 'Projects now support custom_fields'] },
            { version: 'v1.3.0', date: 'Apr 2026', changes: ['Tasks API launched', 'Rate limit headers added to all responses', 'Sandbox environment now available'] },
          ].map(entry => (
            <div key={entry.version} className="flex gap-4">
              <div className="flex flex-col items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                <div className="w-0.5 flex-1 bg-white/6" />
              </div>
              <div className="pb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-white">{entry.version}</span>
                  <span className="text-xs text-slate-600">{entry.date}</span>
                </div>
                <ul className="space-y-1">
                  {entry.changes.map(c => (
                    <li key={c} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="text-blue-500 mt-0.5">•</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )

    default:
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="text-sm text-slate-600">Select a section to view documentation</div>
        </div>
      )
  }
}
