'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Megaphone, Send, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import {
  listProjectAnnouncements, postClientAnnouncement, deleteClientAnnouncement,
} from '@/app/actions/client'

function formatDate(d: string): string {
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function AnnouncementsManager({ projectId }: { projectId: string }) {
  const { toast } = useToast()
  const { data: announcements, mutate, isLoading } =
    useSWR(['project-announcements', projectId], () => listProjectAnnouncements(projectId))

  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [posting, setPosting] = React.useState(false)

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast({ title: 'Title is required', variant: 'warning' })
      return
    }
    setPosting(true)
    const res = await postClientAnnouncement({ projectId, title, body })
    setPosting(false)
    if (res.error) {
      toast({ title: 'Could not post', description: res.error, variant: 'danger' })
    } else {
      setTitle(''); setBody('')
      toast({ title: 'Announcement posted', description: 'Visible to the client on their portal.', variant: 'success' })
      mutate()
    }
  }

  const handleDelete = async (id: string) => {
    const res = await deleteClientAnnouncement(id, projectId)
    if (res.error) {
      toast({ title: 'Could not delete', description: res.error, variant: 'danger' })
    } else {
      toast({ title: 'Announcement removed', variant: 'success' })
      mutate()
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Megaphone className="size-5 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold text-foreground">Client Announcements</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Post updates that appear on the client portal home page for this project.
      </p>

      {/* Compose */}
      <Card className="p-5">
        <form onSubmit={handlePost} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Site works commenced on schedule"
              maxLength={160}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Message</Label>
            <textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Share a client-facing update…"
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={posting}>
              {posting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
              Post announcement
            </Button>
          </div>
        </form>
      </Card>

      {/* Existing */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Posted announcements</h2>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        ) : (announcements ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No announcements posted yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {(announcements ?? []).map((a) => (
              <li key={a.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground text-pretty">{a.title}</p>
                    {a.body && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground text-pretty">{a.body}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(a.publishedAt)}{a.authorName ? ` • ${a.authorName}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    aria-label="Delete announcement"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
