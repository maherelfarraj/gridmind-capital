'use client'
import * as React from 'react'
import { Zap, Plus, Upload, CheckSquare, FileSearch, Shield, Users, BarChart2, Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { WidgetConfig } from './types'

const ACTIONS = [
  { label: 'New Task',           icon: Plus,        href: '/projects',   color: '#6366f1' },
  { label: 'Upload Doc',         icon: Upload,       href: '/documents',  color: '#3b82f6' },
  { label: 'Request Approval',   icon: CheckSquare,  href: '/approvals',  color: '#22c55e' },
  { label: 'Review Documents',   icon: FileSearch,   href: '/documents',  color: '#f59e0b' },
  { label: 'Gate Review',        icon: Shield,       href: '/projects',   color: '#8b5cf6' },
  { label: 'Team',               icon: Users,        href: '/admin',      color: '#ec4899' },
  { label: 'Reports',            icon: BarChart2,    href: '/finance',    color: '#14b8a6' },
  { label: 'Alerts',             icon: Bell,         href: '/settings',   color: '#ef4444' },
]

export function QuickActionsWidget({ config }: { config: WidgetConfig }) {
  const router = useRouter()
  return (
    <div className="flex flex-col h-full p-4 gap-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Zap className="size-3.5" />
        <span>Quick Actions</span>
      </div>
      <div className="grid grid-cols-4 gap-2 flex-1">
        {ACTIONS.map((a) => {
          const Icon = a.icon
          return (
            <button key={a.label}
              onClick={() => router.push(a.href)}
              className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-border/80 transition-all p-2 group"
            >
              <div className="size-8 rounded-lg flex items-center justify-center"
                style={{ background: `${a.color}20` }}>
                <Icon className="size-4" style={{ color: a.color }} />
              </div>
              <span className="text-[9px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">{a.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
