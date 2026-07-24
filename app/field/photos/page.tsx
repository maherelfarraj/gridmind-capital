'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { ImageIcon, Camera, Loader2, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useFieldProject } from '@/components/field/field-context'
import { getFieldHome, deleteFieldPhoto, type FieldPhoto } from '@/app/actions/field'
import { uploadFieldPhoto } from '@/components/field/use-field-upload'
import { useToast } from '@/components/ui/toast'

export default function PhotosPage() {
  const { activeProjectId } = useFieldProject()
  const { toast } = useToast()
  const t = useTranslations('field.photos')
  const { data, isLoading, mutate } = useSWR(
    activeProjectId ? `field-home-${activeProjectId}` : null,
    () => getFieldHome(activeProjectId as string),
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const photos = data?.recentPhotos ?? []

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f || !activeProjectId) return
    setUploading(true)
    const res = await uploadFieldPhoto(activeProjectId, f)
    setUploading(false)
    if (res.error) toast({ title: res.error, variant: 'danger' })
    else { toast({ title: t('uploaded'), variant: 'success' }); mutate() }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function remove(p: FieldPhoto) {
    const res = await deleteFieldPhoto(p.id)
    if (res.error) toast({ title: res.error, variant: 'danger' })
    else { toast({ title: t('removed'), variant: 'success' }); mutate() }
  }

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ImageIcon className="size-5 text-primary" aria-hidden="true" />
          {t('title')}
        </h1>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={!activeProjectId || uploading}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {uploading
            ? <Loader2 className="size-4 animate-spin" />
            : <Camera className="size-4" aria-hidden="true" />}
          {uploading ? t('uploading') : t('capture')}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onPick} className="hidden" />

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <ImageIcon className="size-8 text-muted-foreground/50 mx-auto mb-3" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{t('noPhotos')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('noPhotosDetail')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url || '/placeholder.svg'}
                alt={p.caption ?? 'Site photo'}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
              {p.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <p className="text-[11px] text-white line-clamp-1">{p.caption}</p>
                </div>
              )}
              <button
                onClick={() => remove(p)}
                className="absolute top-1.5 end-1.5 rounded-full bg-black/55 p-1.5"
                aria-label="Delete photo"
              >
                <Trash2 className="size-3.5 text-white" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
