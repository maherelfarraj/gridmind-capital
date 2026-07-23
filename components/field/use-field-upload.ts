'use client'

import { getPhotoUploadUrl, registerFieldPhoto } from '@/app/actions/field'

/** Compress an image File to a JPEG blob, capped at maxEdge px on the longest side. */
export async function compressImage(file: File, maxEdge = 1600, quality = 0.72): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = 'anonymous'
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Could not load image'))
    el.src = dataUrl
  })

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unsupported')
  ctx.drawImage(img, 0, 0, w, h)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Compression failed'))),
      'image/jpeg',
      quality,
    )
  })
}

export interface UploadResult {
  storagePath?: string
  error?: string
}

/**
 * Full field-photo upload: compress -> get signed URL -> PUT to storage -> register row.
 * Returns the stored path (or an error). Safe to call from a click handler.
 */
export async function uploadFieldPhoto(
  projectId: string,
  file: File,
  opts: { caption?: string; reportId?: string; ticketId?: string } = {},
): Promise<UploadResult> {
  try {
    const compressed = await compressImage(file)
    const signed = await getPhotoUploadUrl(projectId, file.name.replace(/\.[^.]+$/, '.jpg'))
    if ('error' in signed) return { error: signed.error }

    const put = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: compressed,
    })
    if (!put.ok) return { error: `Upload failed (${put.status})` }

    const reg = await registerFieldPhoto(
      projectId,
      signed.storagePath,
      opts.caption ?? '',
      opts.reportId,
      opts.ticketId,
    )
    if (reg && 'error' in reg) return { error: reg.error }

    return { storagePath: signed.storagePath }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Upload error' }
  }
}
