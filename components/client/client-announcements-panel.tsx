'use client'

import React from 'react'
import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'
import { Megaphone, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import {
  listProjectAnnouncements,
  postClientAnnouncement,
  deleteClientAnnouncement,
  type ClientAnnouncement,
} from '@/app/actions/client'

interface Props {
  projectId: string
  /** Pass the current user role so PMs see the write controls */
  isManager?: boolean
}

export function ClientAnnouncementsPanel({ projectId, isManager = false }: Props) {
  const { toast } = useToast()
  const { data: announcements = [], mutate, isLoading } = useSWR(
    `client-announcements-${projectId}`,
    () => listProjectAnnouncements(projectId),
  )

  const [expanded, setExpanded] = React.useState(true)
  const [composing, setComposing] = React.useState(false)
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [posting, setPosting] = React.useState(false)

  async function handlePost() {
    if (!title.trim()) {
      toast({ title: 'Title is required', variant: 'warning' })
      return
    }
    setPosting(true)
    const res = await postClientAnnouncement({ projectId, title: title.trim(), body: body.trim() })
    setPosting(false)
    if (res.error) {
      toast({ title: 'Failed to post', description: res.error, variant: 'danger' })
    } else {
      toast({ title: 'Announcement posted', description: 'Clients with access will see it immediately.', variant: 'success' })
      setTitle(''); setBody(''); setComposing(false)
      mutate()
    }
  }

  async function handleDelete(id: string) {
    const res = await deleteClientAnnouncement(id, projectId)
    if (res.error) {
      toast({ title: 'Delete failed', description: res.error, variant: 'danger' })
    } else {
      mutate()
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors rounded-t-lg"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2 font-semibold text-sm text-foreground">
          <Megaphone className="size-4 text-primary" aria-hidden />
          Client Announcements
          {announcements.length > 0 && (
            <span className="ml-1 text-xs font-normal text-muted-foreground">({announcements.length})</span>
          )}
        </span>
        {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {/* Compose button */}
          {isManager && !composing && (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Plus className="size-3.5" />
              Post announcement
            </button>
          )}

          {/* Compose form */}
          {isManager && composing && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Announcement title…"
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Body (optional)"
                rows={3}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePost}
                  disabled={posting}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {posting && <RefreshCw className="size-3 animate-spin" />}
                  Post
                </button>
                <button
                  type="button"
                  onClick={() => { setComposing(false); setTitle(''); setBody('') }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-2">Loading…</p>
          ) : announcements.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">No announcements yet.</p>
          ) : (
            <ul className="space-y-2">
              {announcements.map((ann) => (
                <li key={ann.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/30 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{ann.title}</p>
                    {ann.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{ann.body}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {formatDistanceToNow(new Date(ann.published_at), { addSuffix: true })}
                      {ann.author_name ? ` · ${ann.author_name}` : ''}
                    </p>
                  </div>
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => handleDelete(ann.id)}
                      aria-label="Delete announcement"
                      className="shrink-0 p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
