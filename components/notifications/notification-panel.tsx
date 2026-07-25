'use client'

import React from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  AlertCircle, CheckCircle2, FileText, User, Bell, Settings,
  ExternalLink, X, MessageSquare, ArrowRight, Filter, Clock,
  Zap, Building2, CheckSquare, DollarSign, Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllReadAction,
  seedNotificationsAction,
  getActivityFeed,
  type LiveNotification,
} from '@/app/actions/notifications'

// ─── Types ─────────────────────────────────────────────────────────────────

type NotifType = 'urgent' | 'approval' | 'document' | 'mention' | 'budget' | 'task'
type NotifStatus = 'unread' | 'read'

interface Notification {
  id: string
  type: NotifType
  status: NotifStatus
  title: string
  description: string
  project: string
  projectId: string
  timestamp: string
  date: 'today' | 'yesterday' | 'earlier'
  href: string
}

interface ActivityItem {
  id: string
  actorName: string
  actorInitials: string
  actorColor: string
  action: string
  subject: string
  project: string
  projectId: string
  timestamp: string
  type: 'approval' | 'document' | 'task' | 'budget' | 'gate'
}

interface Mention {
  id: string
  from: string
  fromInitials: string
  fromColor: string
  thread: string
  project: string
  excerpt: string
  timestamp: string
  replied: boolean
}

// ─── Mock data ──────────────────────────────────────────────────────────────

const MOCK_NOTIFICATIONS: Notification[] = [
  { id: 'n1',  type: 'urgent',   status: 'unread', title: 'Gate G3 approval overdue',          description: 'Contract Award review has exceeded the 48h SLA window. Chair decision required.',  project: 'Sirius 400MW', projectId: 'sirius',   timestamp: '2m ago',  date: 'today',     href: '/stage-gates' },
  { id: 'n2',  type: 'urgent',   status: 'unread', title: 'Budget threshold breached',          description: 'Phase 1 civil works reached 92% of approved budget. CAPEX overrun risk.',          project: 'Vega BESS',    projectId: 'vega',     timestamp: '18m ago', date: 'today',     href: '/finance' },
  { id: 'n3',  type: 'approval', status: 'unread', title: 'You approved Gate G2',               description: 'Design & Engineering gate approved with conditions. 2 action items outstanding.',    project: 'Lyra Grid',    projectId: 'lyra',     timestamp: '1h ago',  date: 'today',     href: '/stage-gates' },
  { id: 'n4',  type: 'document', status: 'unread', title: 'New document uploaded',              description: "HVAC Specifications v2.1 uploaded by Mike Yuen to Engineering package EPC-ELE-02.", project: 'Orion Wind',   projectId: 'orion',    timestamp: '3h ago',  date: 'today',     href: '/documents' },
  { id: 'n5',  type: 'mention',  status: 'unread', title: 'You were mentioned',                 description: '@you Please review the updated piling report before the G3 convene.',               project: 'Sirius 400MW', projectId: 'sirius',   timestamp: '5h ago',  date: 'today',     href: '/documents' },
  { id: 'n6',  type: 'approval', status: 'read',   title: 'Punch list closure approved',        description: 'Cat-A punch items for Commissioning Package CP-07 cleared by QA lead.',             project: 'Helios Sub',   projectId: 'helios',   timestamp: '1d ago',  date: 'yesterday', href: '/stage-gates' },
  { id: 'n7',  type: 'task',     status: 'read',   title: 'Task completed',                     description: "Foundation Pour milestone marked complete by site supervisor Omar Al-Zaid.",        project: 'Sirius 400MW', projectId: 'sirius',   timestamp: '1d ago',  date: 'yesterday', href: '/construction' },
  { id: 'n8',  type: 'document', status: 'read',   title: 'Transmittal acknowledged',           description: 'TRS-2026-041 acknowledged by contractor ACWA Engineering.',                        project: 'Vega BESS',    projectId: 'vega',     timestamp: '2d ago',  date: 'earlier',   href: '/engineering' },
  { id: 'n9',  type: 'budget',   status: 'read',   title: 'Variance report issued',             description: 'Monthly cost report (June 2026) published. CPI: 0.94, SPI: 0.98.',                 project: 'Lyra Grid',    projectId: 'lyra',     timestamp: '3d ago',  date: 'earlier',   href: '/finance' },
]

const MOCK_ACTIVITY: ActivityItem[] = [
  { id: 'a1', actorName: 'Sarah Chen',        actorInitials: 'SC', actorColor: '#6366f1', action: 'approved Gate G3 for',   subject: 'Contract Award & Kickoff', project: 'Sirius 400MW', projectId: 'sirius', timestamp: '4m ago',  type: 'gate'     },
  { id: 'a2', actorName: 'Mike Yuen',          actorInitials: 'MY', actorColor: '#0ea5e9', action: "uploaded document",      subject: 'HVAC Specs v2.1',          project: 'Orion Wind',   projectId: 'orion',  timestamp: '31m ago', type: 'document' },
  { id: 'a3', actorName: 'Omar Al-Zaid',       actorInitials: 'OZ', actorColor: '#22c55e', action: 'marked task complete',   subject: 'Foundation Pour',          project: 'Sirius 400MW', projectId: 'sirius', timestamp: '1h ago',  type: 'task'     },
  { id: 'a4', actorName: 'System',             actorInitials: '!',  actorColor: '#ef4444', action: 'triggered budget alert', subject: '85% of Phase 1 consumed',  project: 'Vega BESS',    projectId: 'vega',   timestamp: '2h ago',  type: 'budget'   },
  { id: 'a5', actorName: 'Aisha Al-Rashidi',   actorInitials: 'AA', actorColor: '#f59e0b', action: 'submitted IPA-03 for',   subject: 'Interim Payment Review',   project: 'Lyra Grid',    projectId: 'lyra',   timestamp: '3h ago',  type: 'approval' },
  { id: 'a6', actorName: 'James Morgan',       actorInitials: 'JM', actorColor: '#8b5cf6', action: 'opened gate review for', subject: 'G4 Construction Entry',    project: 'Helios Sub',   projectId: 'helios', timestamp: '5h ago',  type: 'gate'     },
  { id: 'a7', actorName: 'Yuki Tanaka',        actorInitials: 'YT', actorColor: '#ec4899', action: 'resolved NCR',           subject: 'NCR-2026-017 Earthing',    project: 'Vega BESS',    projectId: 'vega',   timestamp: '6h ago',  type: 'task'     },
  { id: 'a8', actorName: 'Mohammed Hassan',    actorInitials: 'MH', actorColor: '#14b8a6', action: 'closed punch item',      subject: 'Cat-A #PA-041',            project: 'Sirius 400MW', projectId: 'sirius', timestamp: '8h ago',  type: 'task'     },
  { id: 'a9', actorName: 'Sarah Chen',         actorInitials: 'SC', actorColor: '#6366f1', action: 'added comment on',       subject: 'Feasibility Report Rev 3', project: 'Orion Wind',   projectId: 'orion',  timestamp: '1d ago',  type: 'document' },
]

const MOCK_MENTIONS: Mention[] = [
  { id: 'm1', from: 'Sarah Chen',      fromInitials: 'SC', fromColor: '#6366f1', thread: 'Gate G3 Convene — Piling Report',   project: 'Sirius 400MW', excerpt: "@you Please review the updated piling report and confirm load assumptions before Monday's gate convene.", timestamp: '5h ago',  replied: false },
  { id: 'm2', from: 'Omar Al-Zaid',    fromInitials: 'OZ', fromColor: '#22c55e', thread: 'Earthing Design Review',             project: 'Vega BESS',    excerpt: "@you Can you sign off on the revised earthing grid layout? I've addressed all your previous comments.",      timestamp: '1d ago',  replied: true  },
  { id: 'm3', from: 'Aisha Al-Rashidi',fromInitials: 'AA', fromColor: '#f59e0b', thread: 'IPA-03 Payment Application',        project: 'Lyra Grid',    excerpt: '@you The IPA has been submitted. Your approval is needed before end of week for payment to proceed.',        timestamp: '2d ago',  replied: false },
]

// ─── Helpers ──────────────────────────────────────────────���─────────────────

const TYPE_META: Record<string, { icon: React.ElementType; color: string; border: string; bg: string }> = {
  urgent:   { icon: AlertCircle,  color: '#ef4444', border: 'border-l-red-500',    bg: 'bg-red-500/8'    },
  approval: { icon: CheckCircle2, color: '#22c55e', border: 'border-l-green-500',  bg: 'bg-green-500/8'  },
  document: { icon: FileText,     color: '#3b82f6', border: 'border-l-blue-500',   bg: 'bg-blue-500/8'   },
  mention:  { icon: User,         color: '#8b5cf6', border: 'border-l-violet-500', bg: 'bg-violet-500/8' },
  budget:   { icon: DollarSign,   color: '#f59e0b', border: 'border-l-amber-500',  bg: 'bg-amber-500/8'  },
  task:     { icon: CheckSquare,  color: '#22c55e', border: 'border-l-green-500',  bg: 'bg-green-500/8'  },
}
const TYPE_META_FALLBACK = { icon: FileText, color: '#94a3b8', border: 'border-l-slate-400', bg: 'bg-slate-500/8' }

const ACTIVITY_ICONS: Record<ActivityItem['type'], React.ElementType> = {
  approval: CheckCircle2,
  document: FileText,
  task:     CheckSquare,
  budget:   DollarSign,
  gate:     Zap,
}

function relTime(ts: string) { return ts }

// ─── Notification card ───────────────────────────────────────────────────────

function NotifCard({
  notif,
  onDismiss,
  onView,
}: {
  notif: Notification
  onDismiss: (id: string) => void
  onView: (notif: Notification) => void
}) {
  const meta = TYPE_META[notif.type] ?? TYPE_META_FALLBACK
  const Icon = meta.icon

  return (
    <div
      className={cn(
        'group relative flex gap-3 border-l-2 rounded-r-lg px-4 py-3 transition-colors',
        meta.border,
        notif.status === 'unread' ? meta.bg : 'bg-transparent hover:bg-muted/30',
      )}
    >
      {/* unread dot */}
      {notif.status === 'unread' && (
        <span className="absolute right-3 top-3 size-1.5 rounded-full" style={{ background: meta.color }} />
      )}

      {/* icon */}
      <div className="mt-0.5 flex-shrink-0">
        <Icon size={15} style={{ color: meta.color }} />
      </div>

      {/* body */}
      <div className="flex-1 min-w-0 pr-4">
        <p className={cn('text-sm leading-snug', notif.status === 'unread' ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>
          {notif.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">{notif.description}</p>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5">
            <Building2 size={9} />
            {notif.project}
          </span>
          <span className="text-[10px] text-muted-foreground">{notif.timestamp}</span>
          <button
            onClick={() => onView(notif)}
            className="ml-auto text-[10px] font-semibold text-primary hover:underline flex items-center gap-0.5"
          >
            View <ExternalLink size={9} />
          </button>
        </div>
      </div>

      {/* dismiss */}
      <button
        onClick={() => onDismiss(notif.id)}
        aria-label="Dismiss notification"
        className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
      >
        <X size={12} />
      </button>
    </div>
  )
}

// ─── Notifications tab ───────────────────────────────────────────────────────

function NotificationsTab({
  notifications,
  onDismiss,
  onView,
  onMarkAllRead,
}: {
  notifications: Notification[]
  onDismiss: (id: string) => void
  onView: (n: Notification) => void
  onMarkAllRead: () => void
}) {
  const urgent    = notifications.filter((n) => n.type === 'urgent' && n.status === 'unread')
  const today     = notifications.filter((n) => n.date === 'today'     && n.type !== 'urgent')
  const yesterday = notifications.filter((n) => n.date === 'yesterday')
  const earlier   = notifications.filter((n) => n.date === 'earlier')

  function Group({ label, items }: { label: string; items: Notification[] }) {
    if (!items.length) return null
    return (
      <div>
        <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className="space-y-1 px-2">
          {items.map((n) => (
            <NotifCard key={n.id} notif={n} onDismiss={onDismiss} onView={onView} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {urgent.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-red-500">
            <AlertCircle size={10} /> Requires Action
          </p>
          <div className="space-y-1">
            {urgent.map((n) => (
              <NotifCard key={n.id} notif={n} onDismiss={onDismiss} onView={onView} />
            ))}
          </div>
        </div>
      )}
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="space-y-2 pb-6">
          <Group label="Today"     items={today}     />
          <Group label="Yesterday" items={yesterday} />
          <Group label="Earlier"   items={earlier}   />
          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bell size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">All caught up</p>
              <p className="text-xs text-muted-foreground/60 mt-1">No new notifications</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Activity tab ────────────────────────────────────────────────────────────

function ActivityTab({ items }: { items: ActivityItem[] }) {
  const [filter, setFilter] = React.useState<'all' | ActivityItem['type']>('all')

  const projects = Array.from(new Set(items.map((a) => a.project)))
  const [projectFilter, setProjectFilter] = React.useState<string>('all')

  const filtered = items.filter((a) => {
    const typeOk    = filter === 'all' || a.type === filter
    const projectOk = projectFilter === 'all' || a.project === projectFilter
    return typeOk && projectOk
  })

  const typeFilters: { id: 'all' | ActivityItem['type']; label: string }[] = [
    { id: 'all',      label: 'All'       },
    { id: 'gate',     label: 'Gates'     },
    { id: 'approval', label: 'Approvals' },
    { id: 'document', label: 'Docs'      },
    { id: 'task',     label: 'Tasks'     },
    { id: 'budget',   label: 'Budget'    },
  ]

  return (
    <div>
      {/* Filters */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex gap-1.5 flex-wrap">
          {typeFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors',
                filter === f.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="w-full text-xs rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All projects</option>
          {projects.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <ScrollArea className="h-[calc(100vh-290px)]">
        <div className="px-4 pb-6 space-y-0.5">
          {filtered.map((item, i) => {
            const Icon = ACTIVITY_ICONS[item.type]
            const isLast = i === filtered.length - 1
            return (
              <div key={item.id} className="relative flex gap-3 py-3">
                {/* timeline line */}
                {!isLast && (
                  <div className="absolute left-4 top-9 bottom-0 w-px bg-border" />
                )}
                {/* avatar */}
                <div
                  className="z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: item.actorColor }}
                >
                  {item.actorInitials}
                </div>
                {/* content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-snug">
                    <span className="font-semibold">{item.actorName}</span>
                    {' '}{item.action}{' '}
                    <span className="font-medium text-primary">{item.subject}</span>
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                      <Building2 size={9} />
                      {item.project}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Clock size={9} />{item.timestamp}
                    </span>
                  </div>
                </div>
                {/* icon badge */}
                <div className="flex-shrink-0 mt-1">
                  <div className="rounded bg-muted/60 p-1">
                    <Icon size={11} className="text-muted-foreground" />
                  </div>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">No activity matches filters</p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Mentions tab ────────────────────────────────────────────────────────────

function MentionsTab() {
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null)
  const [replyText, setReplyText]   = React.useState('')

  return (
    <ScrollArea className="h-[calc(100vh-220px)]">
      <div className="px-4 pb-6 space-y-3">
        {MOCK_MENTIONS.map((m) => (
          <div
            key={m.id}
            className={cn(
              'rounded-xl border border-border bg-card p-4 space-y-3',
              !m.replied && 'border-l-2 border-l-violet-500',
            )}
          >
            {/* header */}
            <div className="flex items-start gap-2.5">
              <div
                className="h-8 w-8 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: m.fromColor }}
              >
                {m.fromInitials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{m.from}</p>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">{m.timestamp}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{m.thread}</p>
              </div>
            </div>

            {/* excerpt */}
            <p className="text-xs text-foreground/80 bg-muted/30 rounded-lg px-3 py-2 leading-relaxed">
              {m.excerpt}
            </p>

            {/* project */}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Building2 size={9} />
              <span>{m.project}</span>
              {m.replied && (
                <span className="ml-auto text-green-500 font-medium flex items-center gap-0.5">
                  <CheckCircle2 size={9} /> Replied
                </span>
              )}
            </div>

            {/* reply / go to thread */}
            {!m.replied && (
              <div className="space-y-2">
                {replyingTo === m.id ? (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return
                        if (e.key === 'Enter' && !e.shiftKey) {
                          setReplyingTo(null)
                          setReplyText('')
                        }
                        if (e.key === 'Escape') setReplyingTo(null)
                      }}
                      placeholder="Type a reply…"
                      className="flex-1 text-xs rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      onClick={() => { setReplyingTo(null); setReplyText('') }}
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 px-2 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      <Send size={10} /> Send
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setReplyingTo(m.id)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80"
                    >
                      <MessageSquare size={11} /> Reply
                    </button>
                    <span className="text-muted-foreground/40">·</span>
                    <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                      <ArrowRight size={11} /> Go to thread
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {MOCK_MENTIONS.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">No mentions yet</p>
        )}
      </div>
    </ScrollArea>
  )
}

// ─── Settings sub-panel ──────────────────────────────────────────────────────

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const prefs = [
    { id: 'urgent',   label: 'Urgent alerts',        email: true,  push: true  },
    { id: 'approval', label: 'Approval requests',    email: true,  push: true  },
    { id: 'mention',  label: 'Mentions',             email: true,  push: true  },
    { id: 'document', label: 'Document uploads',     email: false, push: false },
    { id: 'budget',   label: 'Budget alerts',        email: true,  push: false },
    { id: 'task',     label: 'Task completions',     email: false, push: false },
  ]

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight size={15} className="rotate-180" />
        </button>
        <p className="text-sm font-semibold text-foreground">Notification Preferences</p>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-1">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground col-span-1">Type</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-center">Email</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground text-center">Push</span>
          </div>
          {prefs.map((p) => (
            <div key={p.id} className="grid grid-cols-3 gap-2 items-center py-2.5 border-b border-border/50 last:border-0">
              <span className="text-sm text-foreground">{p.label}</span>
              <div className="flex justify-center">
                <input type="checkbox" defaultChecked={p.email} className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
              </div>
              <div className="flex justify-center">
                <input type="checkbox" defaultChecked={p.push} className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface NotificationPanelProps {
  open: boolean
  onClose: () => void
  unreadCount: number
}

// ─── DB row → panel Notification mapper ──────────────────────────────────────

function dbToNotif(n: LiveNotification): Notification {
  const typeMap: Record<string, NotifType> = {
    urgent: 'urgent', alert: 'urgent', approval: 'approval',
    document: 'document', mention: 'mention', budget: 'budget', task: 'task',
  }
  const now = Date.now()
  const created = new Date(n.created_at).getTime()
  const diffH = (now - created) / 3_600_000
  const date: Notification['date'] = diffH < 24 ? 'today' : diffH < 48 ? 'yesterday' : 'earlier'
  const diffM = (now - created) / 60_000
  const timestamp =
    diffM < 1   ? 'just now'
    : diffM < 60 ? `${Math.round(diffM)}m ago`
    : diffH < 24 ? `${Math.round(diffH)}h ago`
    : `${Math.round(diffH / 24)}d ago`
  return {
    id: n.id,
    type: typeMap[n.type] ?? 'task',
    status: n.is_read ? 'read' : 'unread',
    title: n.title,
    description: n.body ?? '',
    project: 'GridMind Capital',
    projectId: '',
    timestamp,
    date,
    href: n.link ?? '/notifications',
  }
}

export function NotificationPanel({ open, onClose, unreadCount }: NotificationPanelProps) {
  const router = useRouter()
  const [showSettings, setShowSettings] = React.useState(false)
  const [dismissed, setDismissed]       = React.useState<Set<string>>(new Set())

  // Live fetch — refresh every 30s while panel is open
  const { data, mutate } = useSWR(
    open ? 'notifications-live' : null,
    () => getNotificationsAction(),
    { refreshInterval: 30_000, revalidateOnFocus: true },
  )

  // Activity feed — fetch once when panel opens
  const { data: feedData } = useSWR(
    open ? 'activity-feed' : null,
    () => getActivityFeed(),
    { revalidateOnFocus: false },
  )
  const activityItems = (feedData && feedData.length > 0
    ? feedData : MOCK_ACTIVITY) as unknown as ActivityItem[]

  // Map live rows → panel type; merge with mock fallback when DB is empty
  const liveItems: Notification[] = data?.items.length
    ? data.items.map(dbToNotif)
    : MOCK_NOTIFICATIONS

  const notifications = liveItems.filter(n => !dismissed.has(n.id))

  async function handleDismiss(id: string) {
    setDismissed(prev => new Set([...prev, id]))
    // optimistically mark read in DB
    await markNotificationReadAction(id).catch(() => {})
    mutate()
  }

  async function handleView(n: Notification) {
    setDismissed(prev => new Set([...prev, n.id]))
    await markNotificationReadAction(n.id).catch(() => {})
    mutate()
    router.push(n.href)
    onClose()
  }

  async function handleMarkAllRead() {
    await markAllReadAction().catch(() => {})
    mutate()
  }

  const liveUnread = notifications.filter(n => n.status === 'unread').length
  const mentionUnread = MOCK_MENTIONS.filter(m => !m.replied).length

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="right"
        className="w-[400px] p-0 flex flex-col gap-0 border-l border-border bg-background"
        style={{ width: 400, maxWidth: '100vw' }}
      >
        {showSettings ? (
          <SettingsPanel onClose={() => setShowSettings(false)} />
        ) : (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-3 border-b border-border flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell size={16} className="text-foreground" />
                  <SheetTitle className="text-base font-semibold">Notifications</SheetTitle>
                  {liveUnread > 0 && (
                    <Badge className="h-5 min-w-[1.25rem] rounded-full px-1.5 text-[10px] font-bold bg-primary text-primary-foreground">
                      {liveUnread}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {liveUnread > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setShowSettings(true)}
                    aria-label="Notification settings"
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                  >
                    <Settings size={14} />
                  </button>
                </div>
              </div>
            </SheetHeader>

            {/* Tabs */}
            <Tabs defaultValue="notifications" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 mb-2 flex-shrink-0 h-8 rounded-lg bg-muted/50 p-0.5">
                <TabsTrigger value="notifications" className="flex-1 h-full text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Notifications
                  {liveUnread > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-primary/15 text-primary text-[9px] font-bold px-1">
                      {liveUnread}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="activity" className="flex-1 h-full text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Activity
                </TabsTrigger>
                <TabsTrigger value="mentions" className="flex-1 h-full text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  Mentions
                  {mentionUnread > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[1rem] rounded-full bg-violet-500/15 text-violet-500 text-[9px] font-bold px-1">
                      {mentionUnread}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="notifications" className="flex-1 overflow-hidden mt-0">
                <NotificationsTab
                  notifications={notifications}
                  onDismiss={handleDismiss}
                  onView={handleView}
                  onMarkAllRead={handleMarkAllRead}
                />
              </TabsContent>

              <TabsContent value="activity" className="flex-1 overflow-hidden mt-0">
                <ActivityTab items={activityItems} />
              </TabsContent>

              <TabsContent value="mentions" className="flex-1 overflow-hidden mt-0">
                <MentionsTab />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
