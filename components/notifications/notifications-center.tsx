'use client'

import * as React from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Bell, CheckCheck, AlertTriangle, Info, CheckCircle2, Clock,
  Megaphone, Search, RefreshCw, Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  getNotificationsAction, markNotificationReadAction, markAllReadAction,
  seedNotificationsAction, type LiveNotification,
} from '@/app/actions/notifications'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'unread' | 'urgent' | 'approval' | 'document' | 'mention'

const TYPE_ICON: Record<string, React.ReactNode> = {
  urgent:   <AlertTriangle size={16} className="text-red-500" />,
  alert:    <AlertTriangle size={16} className="text-red-500" />,
  approval: <CheckCircle2 size={16} className="text-blue-500" />,
  document: <Info size={16} className="text-sky-500" />,
  mention:  <Megaphone size={16} className="text-purple-500" />,
  task:     <CheckCircle2 size={16} className="text-emerald-500" />,
  budget:   <AlertTriangle size={16} className="text-amber-500" />,
}

const TYPE_COLOR: Record<string, string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  alert:  'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  approval: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  document: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  mention:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  task:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  budget:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

export function NotificationsCenter() {
  const router = useRouter()
  const [filter, setFilter] = React.useState<FilterType>('all')
  const [search, setSearch] = React.useState('')
  const [seeding, setSeeding] = React.useState(false)

  const { data, isLoading, mutate } = useSWR(
    'notifications-live',
    getNotificationsAction,
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  )

  const notifications: LiveNotification[] = data?.items ?? []

  // ── Supabase Realtime subscription ──────────────────────────
  React.useEffect(() => {
    const supabase = createClient()
    let channel: ReturnType<typeof supabase.channel> | undefined

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      
      channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => mutate(),
        )
        .subscribe()
    })

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [mutate])

  const filtered = React.useMemo(() => {
    let list = notifications
    if (filter === 'unread') list = list.filter(n => !n.is_read)
    else if (filter !== 'all') list = list.filter(n => n.type === filter)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) || (n.body ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [notifications, filter, search])

  const unreadCount = notifications.filter(n => !n.is_read).length

  async function handleMarkRead(n: LiveNotification) {
    if (n.is_read) return
    await markNotificationReadAction(n.id)
    mutate()
    if (n.link) router.push(n.link)
  }

  async function handleMarkAllRead() {
    await markAllReadAction()
    mutate()
  }

  async function handleSeed() {
    setSeeding(true)
    await seedNotificationsAction()
    mutate()
    setSeeding(false)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            <CheckCheck size={14} className="mr-1.5" />
            Mark all read
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSeed} disabled={seeding}>
            {seeding ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notifications…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Tabs value={filter} onValueChange={v => setFilter(v as FilterType)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3">All</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs px-3 flex items-center gap-1">
              Unread
              {unreadCount > 0 && (
                <Badge variant="secondary" className="h-4 text-[10px] px-1">{unreadCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approval" className="text-xs px-3">Approvals</TabsTrigger>
            <TabsTrigger value="urgent" className="text-xs px-3">Urgent</TabsTrigger>
            <TabsTrigger value="mention" className="text-xs px-3">Mentions</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-3">
            <div className="p-4 rounded-full bg-muted">
              <Bell size={28} className="opacity-30" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {notifications.length === 0 ? 'No notifications yet' : 'Nothing matches your filters'}
              </p>
              <p className="text-xs mt-1 text-muted-foreground/70">
                {notifications.length === 0
                  ? 'Notifications will appear here when there is activity on your projects.'
                  : 'Try adjusting the search or filter.'}
              </p>
            </div>
            {notifications.length === 0 && (
              <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding}>
                {seeding ? <RefreshCw size={12} className="animate-spin mr-1.5" /> : <Sparkles size={12} className="mr-1.5" />}
                Load demo notifications
              </Button>
            )}
          </div>
        ) : (
          filtered.map(n => (
            <button
              key={n.id}
              onClick={() => handleMarkRead(n)}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors',
                !n.is_read
                  ? 'bg-primary/5 border-primary/20 hover:bg-primary/8'
                  : 'bg-background border-border/50 hover:bg-muted/40',
              )}
            >
              <div className="mt-0.5 shrink-0">
                {TYPE_ICON[n.type] ?? <Info size={16} className="text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full capitalize', TYPE_COLOR[n.type] ?? 'bg-muted text-muted-foreground')}>
                    {n.type?.replace('_', ' ')}
                  </span>
                  {!n.is_read && (
                    <span className="size-1.5 rounded-full bg-primary shrink-0" />
                  )}
                  <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1 shrink-0">
                    <Clock size={10} />
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground mt-0.5">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
