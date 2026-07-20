'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/* ── Types ──────────────────────────────────── */
export type ToastVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gate'
export type ToastPosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface ToastData {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number       // ms, 0 = persistent
  action?: {
    label: string
    onClick: () => void
  }
}

/* ── Context ─────────────────────────────────── */
interface ToastContextValue {
  toasts: ToastData[]
  toast: (data: Omit<ToastData, 'id'>) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

/* ── Provider ────────────────────────────────── */
export function ToastProvider({
  children,
  position = 'bottom-right',
  maxToasts = 5,
}: {
  children: React.ReactNode
  position?: ToastPosition
  maxToasts?: number
}) {
  const [toasts, setToasts] = React.useState<ToastData[]>([])

  const toast = React.useCallback((data: Omit<ToastData, 'id'>): string => {
    const id = Math.random().toString(36).slice(2)
    const newToast: ToastData = { duration: 5000, variant: 'default', ...data, id }
    setToasts((prev) => [newToast, ...prev].slice(0, maxToasts))
    return id
  }, [maxToasts])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const dismissAll = React.useCallback(() => setToasts([]), [])

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss, dismissAll }}>
      {children}
      <ToastViewport position={position} toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

/* ── Position classes ────────────────────────── */
const positionClasses: Record<ToastPosition, string> = {
  'top-left':      'top-4 left-4 items-start',
  'top-center':    'top-4 left-1/2 -translate-x-1/2 items-center',
  'top-right':     'top-4 right-4 items-end',
  'bottom-left':   'bottom-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right':  'bottom-4 right-4 items-end',
}

/* ── Viewport ────────────────────────────────── */
function ToastViewport({
  position,
  toasts,
  onDismiss,
}: {
  position: ToastPosition
  toasts: ToastData[]
  onDismiss: (id: string) => void
}) {
  return (
    <div
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
      className={cn(
        'fixed z-[9999] flex flex-col gap-2 pointer-events-none',
        positionClasses[position],
      )}
    >
      {toasts.map((t) => (
        <Toast key={t.id} data={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

/* ── Variant config ──────────────────────────── */
const variantConfig: Record<
  ToastVariant,
  { icon: React.ReactNode; bar: string; container: string }
> = {
  default: {
    icon: (
      <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 7.75V5a.75.75 0 011.5 0v3.75a.75.75 0 01-1.5 0zm.75 2.625a.875.875 0 110 1.75.875.875 0 010-1.75z" />
      </svg>
    ),
    bar: 'bg-foreground/40',
    container: 'text-foreground',
  },
  success: {
    icon: (
      <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5 8l2.5 2.5L11 5.5" />
      </svg>
    ),
    bar: 'bg-[#22c55e]',
    container: 'text-[#22c55e]',
  },
  warning: {
    icon: (
      <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M7.11 1.836a1 1 0 011.78 0l6 11A1 1 0 0114 14.5H2a1 1 0 01-.89-1.664l6-11zM8 6a.75.75 0 00-.75.75v2.5a.75.75 0 001.5 0v-2.5A.75.75 0 008 6zm0 6.5a.875.875 0 100-1.75.875.875 0 000 1.75z" />
      </svg>
    ),
    bar: 'bg-[#f59e0b]',
    container: 'text-[#f59e0b]',
  },
  danger: {
    icon: (
      <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3.5a.75.75 0 01-1.5 0V5zm.75 6.5a.875.875 0 110-1.75.875.875 0 010 1.75z" />
      </svg>
    ),
    bar: 'bg-[#ef4444]',
    container: 'text-[#ef4444]',
  },
  info: {
    icon: (
      <svg className="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 5.5a.75.75 0 011.5 0V11a.75.75 0 01-1.5 0V6.5zM8 5a.875.875 0 110-1.75A.875.875 0 018 5z" />
      </svg>
    ),
    bar: 'bg-[#3b82f6]',
    container: 'text-[#3b82f6]',
  },
  gate: {
    icon: (
      <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8h10M9 4l4 4-4 4" />
      </svg>
    ),
    bar: 'bg-[#64ffda]',
    container: 'text-[#64ffda]',
  },
}

/* ── Single Toast ────────────────────────────── */
function Toast({
  data,
  onDismiss,
}: {
  data: ToastData
  onDismiss: (id: string) => void
}) {
  const [exiting, setExiting] = React.useState(false)
  const variant = data.variant ?? 'default'
  const config = variantConfig[variant]

  const dismiss = React.useCallback(() => {
    setExiting(true)
    setTimeout(() => onDismiss(data.id), 200)
  }, [data.id, onDismiss])

  // Auto-dismiss
  React.useEffect(() => {
    if (!data.duration) return
    const t = setTimeout(dismiss, data.duration)
    return () => clearTimeout(t)
  }, [data.duration, dismiss])

  return (
    <div
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        'pointer-events-auto relative flex w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden',
        'rounded-xl border border-border bg-card shadow-[0_8px_30px_rgba(0,0,0,0.2)]',
        'transition-all duration-200',
        exiting
          ? 'animate-[toast-out_0.18s_ease-in_forwards]'
          : 'animate-[toast-in_0.22s_cubic-bezier(0.16,1,0.3,1)]',
      )}
    >
      {/* Accent bar */}
      <div className={cn('w-1 shrink-0', config.bar)} aria-hidden="true" />

      {/* Body */}
      <div className="flex flex-1 items-start gap-3 p-4">
        {/* Icon */}
        <span className={cn('mt-0.5 shrink-0', config.container)} aria-hidden="true">
          {config.icon}
        </span>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="font-sans text-sm font-semibold leading-snug text-card-foreground">
            {data.title}
          </p>
          {data.description && (
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {data.description}
            </p>
          )}
          {data.action && (
            <button
              onClick={() => { data.action!.onClick(); dismiss() }}
              className={cn(
                'mt-2 font-sans text-xs font-semibold underline-offset-2 hover:underline',
                config.container,
              )}
            >
              {data.action.label}
            </button>
          )}
        </div>

        {/* Close */}
        <button
          onClick={dismiss}
          aria-label="Dismiss notification"
          className={cn(
            'mt-0.5 shrink-0 rounded-md p-0.5 text-muted-foreground',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'transition-colors duration-100',
          )}
        >
          <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export { Toast }
