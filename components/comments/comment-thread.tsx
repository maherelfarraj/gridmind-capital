'use client'

import React from 'react'
import useSWR from 'swr'
import { MessageSquare, Send, Check, AtSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getComments,
  addComment,
  resolveComment,
  type Comment,
} from '@/app/actions/comments'
import { getUsers } from '@/app/actions/admin'

interface CommentThreadProps {
  entityType: string
  entityId: string
  title?: string
  className?: string
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000
  if (diff < 1) return 'just now'
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 1440) return `${Math.round(diff / 60)}h ago`
  return `${Math.round(diff / 1440)}d ago`
}

/** Renders comment body with @mentions highlighted. */
function renderBody(body: string) {
  const parts = body.split(/(@[a-zA-Z0-9._-]+)/g)
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-medium text-sky-600">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

export function CommentThread({ entityType, entityId, title = 'Discussion', className }: CommentThreadProps) {
  const [body, setBody] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [showMentions, setShowMentions] = React.useState(false)
  const [mentionQuery, setMentionQuery] = React.useState('')
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const { data: comments, mutate } = useSWR<Comment[]>(
    ['comments', entityType, entityId],
    () => getComments(entityType, entityId),
    { revalidateOnFocus: true },
  )

  const { data: allUsers = [] } = useSWR(
    'admin-users',
    () => getUsers(),
    { revalidateOnFocus: false },
  )

  const filteredUsers = allUsers.filter((u) =>
    u.full_name && u.full_name.toLowerCase().includes(mentionQuery.toLowerCase()),
  ).slice(0, 5)

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setBody(value)
    const match = value.slice(0, e.target.selectionStart).match(/@([a-zA-Z0-9._-]*)$/)
    if (match) {
      setMentionQuery(match[1])
      setShowMentions(true)
    } else {
      setShowMentions(false)
    }
  }

  function insertMention(name: string) {
    const handle = name.replace(/\s+/g, '')
    setBody((prev) => prev.replace(/@([a-zA-Z0-9._-]*)$/, `@${handle} `))
    setShowMentions(false)
    textareaRef.current?.focus()
  }

  async function handleSubmit() {
    if (!body.trim() || submitting) return
    setSubmitting(true)
    // optimistic
    const optimistic: Comment = {
      id: `tmp-${Date.now()}`,
      entityType, entityId,
      authorId: null,
      authorName: 'You',
      body: body.trim(),
      mentions: [],
      isResolved: false,
      createdAt: new Date().toISOString(),
    }
    mutate((prev) => [...(prev ?? []), optimistic], false)
    const text = body.trim()
    setBody('')
    try {
      const result = await addComment({ entityType, entityId, body: text })
      if (result.error) {
        toast({ variant: 'danger', title: 'Error', description: result.error, duration: 3000 })
        mutate()
      } else {
        mutate()
      }
    } catch (err) {
      toast({ variant: 'danger', title: 'Error', description: 'Failed to add comment', duration: 3000 })
      mutate()
    }
    setSubmitting(false)
  }

  async function handleResolve(id: string) {
    try {
      const result = await resolveComment(id)
      if (result?.error) {
        toast({ variant: 'danger', title: 'Error', description: result.error, duration: 3000 })
      } else {
        mutate()
      }
    } catch (err) {
      toast({ variant: 'danger', title: 'Error', description: 'Failed to resolve comment', duration: 3000 })
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const list = comments ?? []

  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
        <MessageSquare className="size-4 text-slate-400" aria-hidden />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          {list.length}
        </span>
      </div>

      {/* Thread */}
      <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto p-4">
        {list.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <MessageSquare className="size-8 text-slate-300" aria-hidden />
            <p className="text-sm text-slate-400">No comments yet. Start the discussion.</p>
          </div>
        ) : (
          list.map((c) => (
            <div key={c.id} className={cn('flex gap-3', c.isResolved && 'opacity-50')}>
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                {initials(c.authorName)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{c.authorName}</span>
                  <span className="text-xs text-slate-400">{timeAgo(c.createdAt)}</span>
                  {c.isResolved && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                      <Check className="size-2.5" /> Resolved
                    </span>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600">
                  {renderBody(c.body)}
                </p>
                {!c.isResolved && !c.id.startsWith('tmp-') && (
                  <button
                    type="button"
                    onClick={() => handleResolve(c.id)}
                    className="mt-1 text-xs font-medium text-slate-400 hover:text-emerald-600"
                  >
                    Mark resolved
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <div className="relative border-t border-slate-100 p-3">
        {showMentions && filteredUsers.length > 0 && (
          <div className="absolute bottom-full left-3 mb-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
            {filteredUsers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u.full_name)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <AtSign className="size-3.5 text-slate-400" />
                <span className="font-medium text-slate-700">{u.full_name}</span>
                <span className="ml-auto text-xs text-slate-400">{u.role}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={handleBodyChange}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder="Add a comment… use @ to mention"
            className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#0a192f] focus:outline-none focus:ring-2 focus:ring-[#0a192f]/20"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!body.trim() || submitting}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#0a192f] text-white transition hover:bg-slate-800 disabled:opacity-40"
            aria-label="Send comment"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">Press ⌘/Ctrl + Enter to send</p>
      </div>
    </div>
  )
}
