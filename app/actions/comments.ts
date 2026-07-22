'use server'

import { createClient } from '@/lib/supabase/server'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

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
      tenant_id: DEMO_TENANT,
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
