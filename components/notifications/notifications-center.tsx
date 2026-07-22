'use client'

import { useState, useMemo } from 'react'
import { Bell, CheckCheck, AlertTriangle, Info, CheckCircle2, Clock, Megaphone, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { mockStore, type NotificationItem } from '@/lib/mock-store'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'unread' | 'approval_requested' | 'sla_breach' | 'gate_ready' | 'issue_escalated'

const TYPE_ICON: Record<string, React.ReactNode> = {
  approval_requested: <CheckCircle2 size={16} className="text-blue-500" />,
  sla_breach:         <AlertTriangle size={16} className="text-red-500" />,
  gate_ready:         <CheckCircle2 size={16} className="text-green-500" />,
  issue_escalated:    <AlertTriangle size={16} className="text-amber-500" />,
  workflow_advanced:  <Megaphone size={16} className="text-purple-500" />,
  ai_review_ready:    <Info size={16} className="text-blue-400" />,
}

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  warning:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  info:     'bg-muted text-muted-foreground',
}

export function NotificationsCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => mockStore.getNotifications())
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    let list = notifications
    if (filter === 'unread') list = list.filter(n => n.status === 'unread')
    else if (filter !== 'all') list = list.filter(n => n.type === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q))
    }
    return list
  }, [notifications, filter, search])

  const unreadCount = notifications.filter(n => n.status === 'unread').length

  function markRead(id: string) {
    mockStore.markNotificationRead(id)
    setNotifications(mockStore.getNotifications())
  }

  function markAllRead() {
    notifications.forEach(n => mockStore.markNotificationRead(n.id))
    setNotifications(mockStore.getNotifications())
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck size={14} className="mr-1.5" />
          Mark all read
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Tabs value={filter} onValueChange={v => setFilter(v as FilterType)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs px-3">
              Unread {unreadCount > 0 && <Badge variant="secondary" className="ml-1 h-4 text-[10px] px-1">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="approval_requested" className="text-xs px-3">Approvals</TabsTrigger>
            <TabsTrigger value="sla_breach" className="text-xs px-3">SLA</TabsTrigger>
            <TabsTrigger value="gate_ready" className="text-xs px-3">Gates</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <Bell size={32} className="opacity-20" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          filtered.map(n => (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors',
                n.status === 'unread'
                  ? 'bg-primary/5 border-primary/20 hover:bg-primary/8'
                  : 'bg-background border-border/50 hover:bg-muted/40'
              )}
            >
              <div className="mt-0.5 flex-shrink-0">{TYPE_ICON[n.type] ?? <Info size={16} />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', SEVERITY_BADGE[n.severity])}>
                    {n.severity}
                  </span>
                  {n.status === 'unread' && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                  <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                    <Clock size={10} />
                    {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground mt-0.5 truncate">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                {n.projectName && (
                  <p className="mt-1 text-xs text-muted-foreground">Project: {n.projectName}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
