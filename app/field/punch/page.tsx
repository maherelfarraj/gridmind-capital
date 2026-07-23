'use client'

import { useState, useRef } from 'react'
import useSWR from 'swr'
import { ClipboardList, Plus, Camera, Loader2, MapPin, X, Check } from 'lucide-react'
import { useFieldProject } from '@/components/field/field-context'
import { getFieldHome, createFieldPunchItem, type FieldPunchItem } from '@/app/actions/field'
import { uploadFieldPhoto } from '@/components/field/use-field-upload'
import { useToast } from '@/components/ui/toast'

const CAT_META: Record<string, { label: string; cls: string }> = {
  A: { label: 'Cat A · Critical', cls: 'bg-red-500/15 text-red-600 border-red-500/30' },
  B: { label: 'Cat B · Major',    cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30' },
  C: { label: 'Cat C · Minor',    cls: 'bg-sky-500/15 text-sky-600 border-sky-500/30' },
}

export default function PunchPage() {
  const { activeProjectId } = useFieldProject()
  const { toast } = useToast()
  const { data, isLoading, mutate } = useSWR(
    activeProjectId ? `field-home-${activeProjectId}` : null,
    () => getFieldHome(activeProjectId as string),
  )
  const [open, setOpen] = useState(false)

  const punch = data?.punchItems ?? []

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <ClipboardList className="size-5 text-primary" /> My Punch List
        </h1>
        <button
          onClick={() => setOpen(true)}
          disabled={!activeProjectId}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Plus className="size-4" /> Raise
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : punch.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <ClipboardList className="size-8 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No open punch items</p>
          <p className="text-xs text-muted-foreground mt-1">Items assigned to you appear here. Tap Raise to log a new one.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {punch.map((p) => <PunchCard key={p.id} item={p} />)}
        </ul>
      )}

      {open && activeProjectId && (
        <RaisePunchSheet
          projectId={activeProjectId}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); mutate(); toast({ title: 'Punch item raised', variant: 'success' }) }}
        />
      )}
    </div>
  )
}

function PunchCard({ item }: { item: FieldPunchItem }) {
  const cat = CAT_META[item.punch_cat] ?? CAT_META.B
  return (
    <li className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground leading-snug">{item.title}</p>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cat.cls}`}>{item.punch_cat}</span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="capitalize">{item.status.replace(/_/g, ' ')}</span>
        {item.location && <span className="flex items-center gap-1"><MapPin className="size-3" /> {item.location}</span>}
      </div>
    </li>
  )
}

function RaisePunchSheet({
  projectId, onClose, onSaved,
}: {
  projectId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [title, setTitle] = useState('')
  const [location, setLocation] = useState('')
  const [cat, setCat] = useState('B')
  const [description, setDescription] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setPhoto(f)
    setPreview(URL.createObjectURL(f))
  }

  async function submit() {
    if (!title.trim()) { toast({ title: 'Add a title first', variant: 'warning' }); return }
    setBusy(true)
    const res = await createFieldPunchItem(projectId, {
      title: title.trim(),
      location: location.trim() || null,
      punch_cat: cat,
      description: description.trim() || null,
    })
    if ('error' in res) { setBusy(false); toast({ title: res.error, variant: 'danger' }); return }

    if (photo) {
      const up = await uploadFieldPhoto(projectId, photo, { caption: title.trim(), ticketId: res.id })
      if (up.error) toast({ title: `Item saved, photo failed: ${up.error}`, variant: 'warning' })
    }
    setBusy(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="w-full rounded-t-2xl bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground">Raise Punch Item</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="size-5 text-muted-foreground" /></button>
        </div>

        <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Cable tray support missing at grid C4"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm mb-3"
        />

        <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['A', 'B', 'C'] as const).map((c) => (
            <button
              key={c} onClick={() => setCat(c)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold ${cat === c ? CAT_META[c].cls : 'border-border text-muted-foreground'}`}
            >
              {CAT_META[c].label}
            </button>
          ))}
        </div>

        <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
        <input
          value={location} onChange={(e) => setLocation(e.target.value)}
          placeholder="Area / grid ref"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm mb-3"
        />

        <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
        <textarea
          value={description} onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm mb-3 resize-none"
        />

        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickPhoto} className="hidden" />
        {preview ? (
          <div className="relative mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Punch item" className="w-full h-40 object-cover rounded-lg" />
            <button
              onClick={() => { setPhoto(null); setPreview(null) }}
              className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5"
            ><X className="size-4 text-white" /></button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full mb-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-sm text-muted-foreground"
          >
            <Camera className="size-4" /> Attach photo
          </button>
        )}

        <button
          onClick={submit} disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          {busy ? 'Saving…' : 'Save punch item'}
        </button>
      </div>
    </div>
  )
}
