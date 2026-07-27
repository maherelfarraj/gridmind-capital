'use client'

import React from 'react'
import type { getApprovalEvents } from '@/app/actions/approvals'

type ApprovalEvent = Awaited<ReturnType<typeof getApprovalEvents>>[number]

export interface ApprovalEventsTimelineProps {
  events: ApprovalEvent[]
  auditPageUrl?: string // Link to admin/audit for full view
}

const EVENT_ICONS: Record<string, string> = {
  created: '➕',
  assigned: '👤',
  decided: '✓',
  delegated: '↗️',
  condition_added: '📋',
  condition_status_changed: '🔄',
  migrated: '⏮️',
}

const EVENT_LABELS: Record<string, string> = {
  created: 'Created',
  assigned: 'Assigned',
  decided: 'Decided',
  delegated: 'Delegated',
  condition_added: 'Condition added',
  condition_status_changed: 'Condition updated',
  migrated: 'Migrated (legacy)',
}

export function ApprovalEventsTimeline({ events, auditPageUrl }: ApprovalEventsTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
        No events recorded for this approval.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

        {/* Events */}
        <div className="space-y-6">
          {events.map((event, idx) => (
            <div key={event.id} className="relative pl-12">
              {/* Timeline dot */}
              <div className="absolute left-0 top-1.5 size-3 rounded-full bg-blue-500 ring-2 ring-white dark:ring-slate-900" />

              {/* Event card */}
              <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{EVENT_ICONS[event.type] || '•'}</span>
                      <h4 className="font-medium text-slate-900 dark:text-slate-100">
                        {EVENT_LABELS[event.type] || event.type}
                      </h4>
                    </div>

                    {/* Actor details */}
                    {event.actorName && (
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-medium">{event.actorName}</span>
                        {event.actorRole && <span> • {event.actorRole}</span>}
                      </div>
                    )}

                    {/* Event metadata */}
                    {event.metadata && (
                      <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        {Object.entries(event.metadata).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-slate-500 dark:text-slate-500">{key}:</span>{' '}
                            <span className="text-slate-700 dark:text-slate-300">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <time className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(event.timestamp).toLocaleString()}
                  </time>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Link to admin audit page */}
      {auditPageUrl && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
          <a
            href={auditPageUrl}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            View full audit log →
          </a>
        </div>
      )}
    </div>
  )
}
