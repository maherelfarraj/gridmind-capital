'use client'

import * as React from 'react'
import { Undo2, Eraser, PenLine, Type, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  createSignature,
  type SignatureDraft,
  type SignatureEntityType,
  type SignatureRecord,
} from '@/app/actions/signatures'

interface SignaturePadProps {
  entityType: SignatureEntityType
  entityId: string
  projectId?: string | null
  /** Consent statement shown above the pad and stored with the signature. */
  statement: string
  /** Pre-filled signer identity (from session/profile). */
  signerName?: string
  signerRole?: string | null
  submitLabel?: string
  /**
   * Defer persistence to the caller.
   *
   * When true the pad performs NO server write: it hands the rendered signature
   * back via `onDraft` and the caller persists it atomically with the action being
   * authorized (see SignatureDraft). Use this whenever the signature authorizes a
   * SEPARATE submit step, so abandoning the form leaves nothing behind.
   *
   * Leave false only when the signature IS the terminal action (e.g. issuing a
   * certificate, where the row already exists and the signed image is needed
   * immediately to render the PDF).
   */
  defer?: boolean
  /** Required when `defer` is set. Receives the unpersisted signature. */
  onDraft?: (draft: SignatureDraft) => void
  onSigned?: (signature: SignatureRecord) => void
  onCancel?: () => void
}

type Mode = 'draw' | 'type'

const PEN_COLOR = '#0f172a'   // slate-900 — high contrast on the white pad
const PAD_BG = '#ffffff'

export function SignaturePad({
  entityType,
  entityId,
  projectId,
  statement,
  signerName = '',
  signerRole = null,
  submitLabel = 'Sign',
  defer = false,
  onDraft,
  onSigned,
  onCancel,
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const drawing = React.useRef(false)
  const undoStack = React.useRef<string[]>([])

  const [mode, setMode] = React.useState<Mode>('draw')
  const [hasInk, setHasInk] = React.useState(false)
  const [typedName, setTypedName] = React.useState(signerName)
  const [consent, setConsent] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // ── Canvas setup (high-DPI aware) ──────────────────────────
  const initCanvas = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.fillStyle = PAD_BG
    ctx.fillRect(0, 0, rect.width, rect.height)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = PEN_COLOR
  }, [])

  React.useEffect(() => {
    initCanvas()
  }, [initCanvas])

  function pushUndo() {
    const canvas = canvasRef.current
    if (!canvas) return
    undoStack.current.push(canvas.toDataURL())
    if (undoStack.current.length > 30) undoStack.current.shift()
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'draw') return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    pushUndo()
    drawing.current = true
    canvasRef.current?.setPointerCapture(e.pointerId)
    const { x, y } = pointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || mode !== 'draw') return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasInk) setHasInk(true)
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false
    try { canvasRef.current?.releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }

  function clearPad() {
    initCanvas()
    undoStack.current = []
    setHasInk(false)
    if (mode === 'type') setTypedName('')
  }

  function undo() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const prev = undoStack.current.pop()
    if (!prev) { clearPad(); return }
    const img = new window.Image()
    img.onload = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.fillStyle = PAD_BG
      ctx.fillRect(0, 0, rect.width, rect.height)
      ctx.drawImage(img, 0, 0, rect.width, rect.height)
    }
    img.src = prev
  }

  // ── Typed signature → render script text onto the canvas ───
  const renderTyped = React.useCallback(async (name: string) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = PAD_BG
    ctx.fillRect(0, 0, rect.width, rect.height)
    if (!name.trim()) { setHasInk(false); return }

    const family =
      getComputedStyle(document.documentElement).getPropertyValue('--font-signature').trim() ||
      'cursive'
    try { await document.fonts.load(`600 48px ${family}`) } catch { /* fallback below */ }

    ctx.fillStyle = PEN_COLOR
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let size = 52
    ctx.font = `600 ${size}px ${family}, cursive`
    while (ctx.measureText(name).width > rect.width - 40 && size > 20) {
      size -= 2
      ctx.font = `600 ${size}px ${family}, cursive`
    }
    ctx.fillText(name, rect.width / 2, rect.height / 2)
    setHasInk(true)
  }, [])

  function switchMode(next: Mode) {
    setMode(next)
    undoStack.current = []
    // defer so the canvas is in the DOM before we draw
    requestAnimationFrame(() => {
      if (next === 'type') renderTyped(typedName)
      else { initCanvas(); setHasInk(false) }
    })
  }

  React.useEffect(() => {
    if (mode === 'type') renderTyped(typedName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedName])

  // ── Save ───────────────────────────────────────────────────
  const canSave = consent && hasInk && !saving

  async function handleSave() {
    setError(null)
    if (!consent) { setError('You must confirm the consent statement.'); return }
    if (!hasInk) { setError('Please provide a signature before saving.'); return }
    const canvas = canvasRef.current
    if (!canvas) return

    const dataUrl = canvas.toDataURL('image/png')

    // Deferred mode: hand the signature back UNPERSISTED. No server write happens
    // here, so closing or abandoning the form leaves no orphan signature row.
    if (defer) {
      if (!onDraft) { setError('Signature could not be captured.'); return }
      onDraft({
        dataUrl,
        statement,
        signerName: mode === 'type' ? typedName : signerName,
        signerRole,
      })
      return
    }

    setSaving(true)
    const res = await createSignature({
      dataUrl,
      entityType,
      entityId,
      projectId,
      statement,
      signerName: mode === 'type' ? typedName : signerName,
      signerRole,
    })
    setSaving(false)

    if ('error' in res) { setError(res.error); return }
    onSigned?.(res.signature)
  }

  return (
    <div className="space-y-4">
      {/* Consent statement */}
      <label className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 rounded border-border accent-primary"
          aria-label="Confirm consent statement"
        />
        <span className="text-xs leading-relaxed text-muted-foreground">{statement}</span>
      </label>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-border p-1 w-fit">
        <button
          type="button"
          onClick={() => switchMode('draw')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'draw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <PenLine className="size-3.5" /> Draw
        </button>
        <button
          type="button"
          onClick={() => switchMode('type')}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            mode === 'type' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Type className="size-3.5" /> Type
        </button>
      </div>

      {/* Typed name input */}
      {mode === 'type' && (
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder="Type your full name"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      )}

      {/* Signature pad */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="h-44 w-full rounded-lg border-2 border-dashed border-border bg-white"
          style={{ touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {!hasInk && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
            {mode === 'draw' ? 'Draw your signature here' : 'Your signature preview appears here'}
          </span>
        )}
        <span className="pointer-events-none absolute bottom-2 left-3 text-[10px] uppercase tracking-widest text-slate-300">
          Sign above the line
        </span>
      </div>

      {/* Pad controls */}
      <div className="flex items-center gap-2">
        {mode === 'draw' && (
          <Button type="button" variant="outline" size="sm" onClick={undo} disabled={saving}>
            <Undo2 className="mr-1.5 size-3.5" /> Undo
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={clearPad} disabled={saving}>
          <Eraser className="mr-1.5 size-3.5" /> Clear
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleSave} disabled={!canSave}>
            {saving ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : <Check className="mr-1.5 size-3.5" />}
            {submitLabel}
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
