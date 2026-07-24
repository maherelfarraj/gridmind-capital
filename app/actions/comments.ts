'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMentionEmail } from '@/lib/email/send'

import { getCurrentTenantId } from '@/lib/tenant'

/** Build the deep-link for a comment thread based on its entity. */
function commentLink(entityType: string, entityId: string): string {
  if (entityType === 'project') return `/projects/${entityId}`
  return `/projects/${entityId}`
}

/**
 * Resolve @mention tokens to active tenant profiles and email them.
 * Tokens match a profile's email local-part (before @) or a normalized full name.
 */
async function emailMentions(opts: {
  mentions: string[]
  mentionedBy: string
  snippet: string
  entityType: string
  entityId: string
}) {
  const tenantId = await getCurrentTenantId()
  if (opts.mentions.length === 0) return
  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
  if (!profiles?.length) return

  const wanted = new Set(opts.mentions.map((m) => m.toLowerCase()))
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '.')
  const matched = profiles.filter((p) => {
    if (!p.email) return false
    const local = (p.email as string).split('@')[0].toLowerCase()
    const name = p.full_name ? norm(p.full_name) : ''
    return wanted.has(local) || (name && wanted.has(name))
  })

  const link = commentLink(opts.entityType, opts.entityId)
  await Promise.all(
    matched.map((p) =>
      sendMentionEmail({
        to: p.email as string,
        userId: p.id,
        mentionedBy: opts.mentionedBy,
        snippet: opts.snippet.length > 160 ? `${opts.snippet.slice(0, 157)}…` : opts.snippet,
        link,
      }),
    ),
  )
}

export interface Comment {
  id: string
  entityType: string
  entityId: string
  authorId: string | null
  authorName: string
  body: string
  mentions: string[]
  isResolved: boolean
  createdAt: string
}

interface CommentRow {
  id: string
  object_type: string
  object_id: string
  author_id: string | null
  author_name: string | null
  content: string
  mentions: string[] | null
  is_resolved: boolean | null
  created_at: string
}

function mapRow(r: CommentRow): Comment {
  return {
    id: r.id,
    entityType: r.object_type,
    entityId: r.object_id,
    authorId: r.author_id,
    authorName: r.author_name ?? 'Unknown',
    body: r.content,
    mentions: r.mentions ?? [],
    isResolved: r.is_resolved ?? false,
    createdAt: r.created_at,
  }
}

/** Extract @mentions from raw comment text. */
function parseMentions(body: string): string[] {
  const matches = body.match(/@([a-zA-Z0-9._-]+)/g) ?? []
  return Array.from(new Set(matches.map((m) => m.slice(1))))
}

export async function getComments(
  entityType: string,
  entityId: string,
): Promise<Comment[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('object_type', entityType)
    .eq('object_id', entityId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as CommentRow[]).map(mapRow)
}

export async function addComment(input: {
  entityType: string
  entityId: string
  body: string
}): Promise<{ comment?: Comment; error?: string }> {
  const tenantId = await getCurrentTenantId()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const authorName =
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email?.split('@')[0] ??
    'Team Member'

  const { data, error } = await supabase
    .from('comments')
    .insert({
      tenant_id: tenantId,
      object_type: input.entityType,
      object_id: input.entityId,
      author_id: user?.id ?? null,
      author_name: authorName,
      content: input.body,
      mentions: parseMentions(input.body),
    })
    .select('*')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to add comment' }

  // Email mentioned users (prefs-aware, logged) — fire-and-forget.
  const mentions = parseMentions(input.body)
  if (mentions.length > 0) {
    void emailMentions({
      mentions,
      mentionedBy: authorName,
      snippet: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    }).catch((e) => console.error('[comments] mention email failed:', e))
  }

  return { comment: mapRow(data as CommentRow) }
}

export async function resolveComment(id: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('comments')
    .update({ is_resolved: true })
    .eq('id', id)
  return error ? { error: error.message } : {}
}
