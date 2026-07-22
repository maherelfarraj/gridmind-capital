'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendDocumentUploadEmail } from '@/lib/email/send'

const BUCKET = 'documents'
const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

export interface StoredDocument {
  id: string
  name: string
  code: string
  title: string
  category: string
  size: number
  sizeLabel: string
  mimeType: string
  projectId: string | null
  projectCode: string | null
  uploadedBy: string
  storagePath: string
  publicUrl: string | null
  createdAt: string
  visibleToClient: boolean
}

/** Ensure the documents bucket exists (idempotent). */
export async function ensureStorageBucket() {
  const supabase = createAdminClient()
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b) => b.name === BUCKET)
  if (!exists) {
    await supabase.storage.createBucket(BUCKET, {
      public: false,
      allowedMimeTypes: [
        'application/pdf',
        'image/png', 'image/jpeg',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/dwg', 'image/vnd.dwg',
        'application/zip',
      ],
      fileSizeLimit: 52428800, // 50 MB
    })
  }
}

/** Generate a signed upload URL for the client to PUT directly. */
export async function createUploadUrl(opts: {
  fileName: string
  projectId: string | null
  projectCode: string | null
  uploadedBy: string
}): Promise<{ uploadUrl: string; storagePath: string } | { error: string }> {
  await ensureStorageBucket()
  const supabase = createAdminClient()

  const ext = opts.fileName.split('.').pop()?.toLowerCase() ?? 'bin'
  const stamp = Date.now()
  const storagePath = opts.projectCode
    ? `${DEMO_TENANT}/${opts.projectCode}/${stamp}-${opts.fileName}`
    : `${DEMO_TENANT}/general/${stamp}-${opts.fileName}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) return { error: error?.message ?? 'Upload URL generation failed' }
  return { uploadUrl: data.signedUrl, storagePath }
}

/** Register a completed upload in the document_files table. */
export async function registerDocument(opts: {
  storagePath: string
  fileName: string
  title: string
  category: string
  size: number
  mimeType: string
  projectId: string | null
  projectCode: string | null
  uploadedBy: string
}): Promise<{ id: string } | { error: string }> {
  const supabase = createAdminClient()

  // Auto-generate document code
  const categoryPrefix = opts.category.slice(0, 4).toUpperCase()
  const code = `${opts.projectCode ?? 'GEN'}-${categoryPrefix}-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from('document_files')
    .insert({
      tenant_id:    DEMO_TENANT,
      project_id:   opts.projectId,
      project_code: opts.projectCode,
      storage_path: opts.storagePath,
      file_name:    opts.fileName,
      title:        opts.title,
      code,
      category:     opts.category,
      size_bytes:   opts.size,
      mime_type:    opts.mimeType,
      uploaded_by:  opts.uploadedBy,
      status:       'draft',
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/documents')

  // Notify document register team — fire-and-forget
  sendDocumentUploadEmail({
    to: ['admin@gridmind.capital'],
    uploaderName: opts.uploadedBy,
    fileName: opts.fileName,
    documentCode: code,
    projectCode: opts.projectCode ?? 'General',
    projectId: opts.projectId ?? undefined,
  }).catch(() => {})

  return { id: data.id }
}

/** Get a short-lived signed download URL. */
export async function getDownloadUrl(storagePath: string): Promise<{ url: string } | { error: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 300) // 5-min TTL

  if (error || !data) return { error: error?.message ?? 'Could not generate download URL' }
  return { url: data.signedUrl }
}

/** List all documents for a tenant, optionally filtered by project. */
export async function listDocuments(projectCode?: string): Promise<StoredDocument[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('document_files')
    .select('*')
    .eq('tenant_id', DEMO_TENANT)
    .order('created_at', { ascending: false })

  if (projectCode) query = query.eq('project_code', projectCode)

  const { data, error } = await query
  if (error || !data) return []

  return data.map((d) => ({
    id:           d.id,
    name:         d.file_name,
    code:         d.code,
    title:        d.title ?? d.file_name,
    category:     d.category ?? 'general',
    size:         d.size_bytes ?? 0,
    sizeLabel:    formatBytes(d.size_bytes ?? 0),
    mimeType:     d.mime_type ?? 'application/octet-stream',
    projectId:    d.project_id,
    projectCode:  d.project_code,
    uploadedBy:   d.uploaded_by ?? 'Unknown',
    storagePath:     d.storage_path,
    publicUrl:       null,
    createdAt:       d.created_at,
    visibleToClient: d.visible_to_client ?? false,
  }))
}

/** Toggle the client-visible flag on a document file. PM/admin only (enforced in UI). */
export async function toggleDocumentFileVisibility(
  id: string,
  visibleToClient: boolean,
): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('document_files')
    .update({ visible_to_client: visibleToClient })
    .eq('id', id)
  revalidatePath('/documents')
  return { error: error?.message ?? null }
}

/** Delete a document from storage + the DB record. */
export async function deleteDocument(id: string, storagePath: string): Promise<{ error: string | null }> {
  const supabase = createAdminClient()
  await supabase.storage.from(BUCKET).remove([storagePath])
  const { error } = await supabase.from('document_files').delete().eq('id', id)
  revalidatePath('/documents')
  return { error: error?.message ?? null }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
