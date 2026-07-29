'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireWriter } from '@/lib/auth/guard'
import { revalidatePath } from 'next/cache'
import { sendDocumentUploadEmail } from '@/lib/email/send'

const BUCKET = 'documents'
import { getCurrentTenantId } from '@/lib/tenant'
import { requireUser } from '@/lib/guards'

/** Sanitize fileName: remove path separators, strip .., whitelist safe chars */
function sanitizeFileName(fileName: string): string {
  // Remove path separators and .. traversal
  let safe = fileName.replace(/[/\\]+/g, '').replace(/\.\./g, '')
  // Whitelist: alphanumeric, dots, underscores, hyphens
  safe = safe.replace(/[^A-Za-z0-9._-]/g, '')
  return safe || 'file'
}

/** Validate file extension against allowlist */
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'dwg', 'dgn', 'rvt', 'nwd', 'ipt', 'iam',
  'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff',
  'csv', 'txt', 'zip', 'rar', '7z',
])

function validateExtension(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return ALLOWED_EXTENSIONS.has(ext)
}

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
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  // Sanitize and validate fileName
  const sanitized = sanitizeFileName(opts.fileName)
  if (!validateExtension(sanitized)) {
    return { error: `File extension not allowed for: ${opts.fileName}` }
  }

  await ensureStorageBucket()
  const supabase = createAdminClient()

  const stamp = Date.now()
  const storagePath = opts.projectCode
    ? `${tenantId}/${opts.projectCode}/${stamp}-${sanitized}`
    : `${tenantId}/general/${stamp}-${sanitized}`

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
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  const supabase = createAdminClient()

  // Auto-generate document code
  const categoryPrefix = opts.category.slice(0, 4).toUpperCase()
  const code = `${opts.projectCode ?? 'GEN'}-${categoryPrefix}-${Date.now().toString(36).toUpperCase()}`

  const { data, error } = await supabase
    .from('document_files')
    .insert({
      tenant_id:    tenantId,
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
    to: [process.env.NOTIFICATION_EMAIL || 'admin@gridmind.capital'],
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
  try {
    await requireUser()
  } catch (e: any) {
    return { error: 'Unauthorized' }
  }

  // Verify storagePath belongs to the caller's tenant
  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()
  
  // Look up document_files to ensure it exists and belongs to this tenant
  const { data: docFile, error: docErr } = await supabase
    .from('document_files')
    .select('id')
    .eq('storage_path', storagePath)
    .eq('tenant_id', tenantId)
    .single()
  
  if (docErr || !docFile) return { error: 'Document not found or access denied' }

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 300) // 5-min TTL

  if (error || !data) return { error: error?.message ?? 'Could not generate download URL' }
  return { url: data.signedUrl }
}

/** List all documents for a tenant, optionally filtered by project. */
export async function listDocuments(projectCode?: string): Promise<StoredDocument[]> {
  try {
    await requireUser()
  } catch (e: any) {
    return []
  }

  const tenantId = await getCurrentTenantId()
  const supabase = createAdminClient()

  let query = supabase
    .from('document_files')
    .select('*')
    .eq('tenant_id', tenantId)
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
  const gate = await requireWriter()
  if ('error' in gate) return gate

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
  const gate = await requireWriter()
  if ('error' in gate) return gate

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

// ─────────────────────────────────────────────────────────────
// Field photos (mobile camera capture)
// Stored in the same `documents` bucket under a `field-photos/`
// prefix, categorised so they can be filtered out of the formal
// document register. Client compresses before upload; this action
// receives an already-compressed JPEG data URL.
// ─────────────────────────────────────────────────────────────

export interface FieldPhoto {
  id: string
  url: string
  storagePath: string
  createdAt: string
  uploadedBy: string
}

/**
 * Upload a field photo captured on a mobile device.
 * @param dataUrl  a compressed JPEG as a base64 data URL (image/jpeg)
 * @param linkType e.g. 'ncr' | 'inspection'
 * @param linkId   the id of the NCR / inspection it documents
 */
export async function uploadFieldPhoto(opts: {
  dataUrl: string
  projectId: string
  linkType: string
  linkId: string
  uploadedBy: string
}): Promise<{ photo: FieldPhoto } | { error: string }> {
  const tenantId = await getCurrentTenantId()
  const gate = await requireWriter()
  if ('error' in gate) return gate

  await ensureStorageBucket()
  const supabase = createAdminClient()

  // Decode the data URL → binary
  const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(opts.dataUrl)
  if (!match) return { error: 'Invalid image data' }
  const mimeType = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength > 8 * 1024 * 1024) {
    return { error: 'Photo too large after compression (max 8 MB)' }
  }

  // Resolve project code for a readable path
  const { data: proj } = await supabase
    .from('projects').select('code').eq('id', opts.projectId).maybeSingle()
  const projectCode = proj?.code ?? 'GEN'

  const stamp = Date.now()
  const fileName = `${opts.linkType}-${opts.linkId}-${stamp}.jpg`
  const storagePath = `field-photos/${tenantId}/${projectCode}/${fileName}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false })
  if (upErr) return { error: upErr.message }

  // Register in document_files so it appears in the document layer + audit
  const { data, error } = await supabase
    .from('document_files')
    .insert({
      tenant_id:    tenantId,
      project_id:   opts.projectId,
      project_code: projectCode,
      storage_path: storagePath,
      file_name:    fileName,
      title:        `Field photo · ${opts.linkType.toUpperCase()} ${opts.linkId.slice(0, 8)}`,
      code:         `FP-${stamp.toString(36).toUpperCase()}`,
      category:     'field-photo',
      size_bytes:   buffer.byteLength,
      mime_type:    mimeType,
      uploaded_by:  opts.uploadedBy,
      status:       'draft',
    })
    .select('id, created_at')
    .single()
  if (error) return { error: error.message }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600)

  revalidatePath('/documents')
  return {
    photo: {
      id: data.id,
      url: signed?.signedUrl ?? '',
      storagePath,
      createdAt: data.created_at,
      uploadedBy: opts.uploadedBy,
    },
  }
}

/** List field photos attached to a given NCR / inspection. */
export async function listFieldPhotos(opts: {
  projectId: string
  linkType: string
  linkId: string
}): Promise<FieldPhoto[]> {
  const supabase = createAdminClient()
  const prefixMatch = `${opts.linkType}-${opts.linkId}-`

  const { data, error } = await supabase
    .from('document_files')
    .select('id, storage_path, created_at, uploaded_by, file_name')
    .eq('project_id', opts.projectId)
    .eq('category', 'field-photo')
    .like('file_name', `${prefixMatch}%`)
    .order('created_at', { ascending: false })
  if (error || !data) return []

  const photos = await Promise.all(
    data.map(async (d) => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600)
      return {
        id: d.id,
        url: signed?.signedUrl ?? '',
        storagePath: d.storage_path,
        createdAt: d.created_at,
        uploadedBy: d.uploaded_by ?? 'Field',
      }
    }),
  )
  return photos
}
