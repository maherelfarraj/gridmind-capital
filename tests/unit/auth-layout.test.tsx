import { describe, it, expect, vi } from 'vitest'
import type * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AuthLayout from '@/app/auth/layout'
import { useToast } from '@/components/ui/toast'

/**
 * The /auth route tree must provide a ToastProvider, otherwise any page that
 * calls useToast() (e.g. update-password) throws during rendering.
 */

const MISSING_PROVIDER = /useToast must be used within a ToastProvider/

/** A child that exercises the toast context by calling the hook. */
function ToastProbe() {
  const { toast, dismiss, dismissAll } = useToast()
  const ok = typeof toast === 'function' && typeof dismiss === 'function' && typeof dismissAll === 'function'
  return <span>{ok ? 'toast-context-ready' : 'toast-context-broken'}</span>
}

function renderQuietly(element: React.ReactElement): { markup?: string; error?: Error } {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    return { markup: renderToStaticMarkup(element) }
  } catch (err) {
    return { error: err as Error }
  } finally {
    spy.mockRestore()
  }
}

describe('AuthLayout', () => {
  it('supplies a ToastProvider so a child using useToast does not throw', () => {
    const { markup, error } = renderQuietly(
      <AuthLayout>
        <ToastProbe />
      </AuthLayout>,
    )

    expect(error).toBeUndefined()
    expect(markup).toContain('toast-context-ready')
  })

  it('a useToast child throws WITHOUT the layout (proves the layout is the provider)', () => {
    // Non-tautological guard: the same probe must fail when not wrapped, so the
    // passing test above can only be explained by AuthLayout supplying context.
    const { markup, error } = renderQuietly(<ToastProbe />)

    expect(markup).toBeUndefined()
    expect(error?.message).toMatch(MISSING_PROVIDER)
  })

  it('renders its children (adds no visual wrapper that hides content)', () => {
    const { markup } = renderQuietly(
      <AuthLayout>
        <span>child-content-visible</span>
      </AuthLayout>,
    )

    expect(markup).toContain('child-content-visible')
  })
})
