'use client'

/**
 * CameraCapture — mobile field-photo capture with client-side compression.
 *
 * Uses a native file input with `capture="environment"` so mobile browsers
 * open the rear camera directly (falls back to the file picker on desktop).
 * The chosen image is downscaled + re-encoded to JPEG in a canvas BEFORE
 * upload to keep field uploads small on slow site connections.
 *
 * Photos are stored in the `documents` bucket under `field-photos/` via the
 * uploadFieldPhoto server action and linked to an NCR or inspection.
 */

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2, ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import {
  uploadFieldPhoto,
  listFieldPhotos,
  type FieldPhoto,
} from '@/app/actions/storage'

const MAX_DIMENSION = 1600 // longest edge after downscale
const JPEG_QUALITY = 0.72

/** Downscale + compress an image File to a JPEG data URL using a canvas. */
async function compressImage(file: File): Promise<string> {
  const bitmapUrl = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.crossOrigin = 'anonymous'
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = bitmapUrl
    })

    let { width, height } = img
    if (width > height && width > MAX_DIMENSION) {
      height = Math.round((height * MAX_DIMENSION) / width)
      width = MAX_DIMENSION
    } else if (height >= width && height > MAX_DIMENSION) {
      width = Math.round((width * MAX_DIMENSION) / height)
      height = MAX_DIMENSION
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas not supported')
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  } finally {
    URL.revokeObjectURL(bitmapUrl)
  }
}

export function CameraCapture({
  projectId,
  linkType,
  linkId,
  uploadedBy = 'Field user',
}: {
  projectId: string
  linkType: 'ncr' | 'inspection'
  linkId: string
  uploadedBy?: string
}) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<FieldPhoto[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    listFieldPhotos({ projectId, linkType, linkId })
      .then((p) => { if (active) setPhotos(p) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId, linkType, linkId])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Reset the input so selecting the same file again re-triggers change
    e.target.value = ''
    if (!file) return

    setBusy(true)
    try {
      const dataUrl = await compressImage(file)
      const res = await uploadFieldPhoto({ dataUrl, projectId, linkType, linkId, uploadedBy })
      if ('error' in res) {
        toast({ title: 'Upload failed', description: res.error, variant: 'danger' })
      } else {
        setPhotos((prev) => [res.photo, ...prev])
        toast({ title: 'Photo added', variant: 'success' })
      }
    } catch (err) {
      toast({ title: 'Could not process photo', description: String(err), variant: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
          Field photos {photos.length > 0 && <span className="text-muted-foreground">({photos.length})</span>}
        </h3>
        {/* Native camera input — capture="environment" opens the rear camera on mobile */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={onFile}
          aria-hidden
          tabIndex={-1}
        />
        <Button
          type="button"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          // large touch target for gloved/field use
          className="min-h-11"
        >
          {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Camera className="size-4 mr-1.5" />}
          Add photo
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading photos…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No photos yet. Tap <strong>Add photo</strong> to capture evidence from the field.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url || '/placeholder.svg'}
                alt={`Field photo captured ${new Date(p.createdAt).toLocaleString('en-US')}`}
                className="size-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
