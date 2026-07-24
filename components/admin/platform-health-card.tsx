'use client'

import * as React from 'react'
import useSWR from 'swr'
import { getPlatformHealth } from '@/app/actions/admin'
import type { HealthCheck } from '@/app/actions/admin'
import {
  CheckCircle2, AlertTriangle, XCircle, RefreshCw, Activity,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ─────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  green: {
    icon:  CheckCircle2,
    bg:    'bg-emerald-50',
    border:'border-emerald-200',
    text:  'text-emerald-700',
    dot:   'bg-emerald-500',
    label: 'OK',
  },
  amber: {
    icon:  AlertTriangle,
    bg:    'bg-amber-50',
    border:'border-amber-200',
    text:  'text-amber-700',
    dot:   'bg-amber-500',
    label: 'Warning',
  },
  red: {
    icon:  XCircle,
    bg:    'bg-red-50',
    border:'border-red-200',
    text:  'text-red-700',
    dot:   'bg-red-500',
    label: 'Critical',
  },
} as const

// ─────────────────────────────────────────────────────────────
// Single check row
// ─────────────────────────────────────────────────────────────

function CheckRow({ check }: { check: HealthCheck }) {
  const cfg = STATUS_CONFIG[check.status]
  const Icon = cfg.icon

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${cfg.bg} ${cfg.border}`}
      role="listitem"
    >
      <Icon
        className={`size-4 mt-0.5 shrink-0 ${cfg.text}`}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-900">{check.label}</span>
          {check.count >= 0 && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
              {check.count}
            </span>
          )}
          <span className={`ms-auto text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{check.detail}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Summary pill row
// ─────────────────────────────────────────────────────────────

function SummaryPills({ checks }: { checks: HealthCheck[] }) {
  const counts = { green: 0, amber: 0, red: 0 }
  for (const c of checks) counts[c.status]++

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {counts.green > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
          {counts.green} OK
        </span>
      )}
      {counts.amber > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700">
          <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
          {counts.amber} Warning
        </span>
      )}
      {counts.red > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700">
          <span className="size-1.5 rounded-full bg-red-500" aria-hidden />
          {counts.red} Critical
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main card
// ─────────────────────────────────────────────────────────────

export function PlatformHealthCard() {
  const { data, error, isLoading, mutate } = useSWR(
    'platform-health',
    getPlatformHealth,
    { revalidateOnFocus: false },
  )

  const isError = error || (data && 'error' in data)
  const health  = data && !('error' in data) ? data : null

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
      aria-label="Platform health"
    >
      {/* Card header */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <Activity className="size-5 text-slate-500" aria-hidden />
          <h2 className="text-base font-semibold text-slate-900">Platform Health</h2>
        </div>

        <div className="flex items-center gap-3">
          {health && (
            <span className="text-xs text-slate-400">
              Checked {formatDistanceToNow(new Date(health.checkedAt), { addSuffix: true })}
            </span>
          )}
          <button
            type="button"
            onClick={() => mutate()}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
            aria-label="Refresh health checks"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
            <RefreshCw className="size-4 animate-spin" aria-hidden />
            Running health checks...
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <XCircle className="size-4 shrink-0" aria-hidden />
            {typeof data === 'object' && data && 'error' in data
              ? String(data.error)
              : 'Failed to run health checks. You may not have admin access.'}
          </div>
        )}

        {health && !isLoading && (
          <div className="flex flex-col gap-4">
            {/* Summary row */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <SummaryPills checks={health.checks} />
              <span className="text-xs text-slate-400 font-mono">
                {health.checks.length} checks
              </span>
            </div>

            {/* Check list */}
            <div className="flex flex-col gap-2" role="list">
              {health.checks.map((check) => (
                <CheckRow key={check.key} check={check} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
