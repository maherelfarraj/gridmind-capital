import { describe, it, expect, vi } from 'vitest'
import type * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  SessionProvider,
  useSession,
  useDigitStyle,
  useLocalePrefs,
} from '@/lib/session-context'
import type { AppSession } from '@/lib/session'
import { makeTestSession } from '../fixtures/session'

/**
 * Behavioural tests: the hooks are actually rendered, not merely inspected.
 *
 * The defect these guard against is a context whose default value is a
 * fabricated session. With such a default, a component rendered outside an
 * authenticated provider silently receives a role, tenant and permissions
 * instead of failing.
 */

const MISSING_PROVIDER = /useSession must be used within an authenticated SessionProvider/

/** Render a tree, letting any error thrown by a hook propagate. */
function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element)
}

/** Render while suppressing React's error logging for expected throws. */
function renderQuietly(element: React.ReactElement): { markup?: string; error?: Error } {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    return { markup: render(element) }
  } catch (err) {
    return { error: err as Error }
  } finally {
    spy.mockRestore()
  }
}

function SessionProbe() {
  return <span>{useSession().userId}</span>
}

function DigitStyleProbe() {
  return <span>{useDigitStyle()}</span>
}

function LocaleProbe() {
  return <span>{useLocalePrefs().locale}</span>
}

describe('useSession', () => {
  it('throws when rendered outside a SessionProvider', () => {
    const { error } = renderQuietly(<SessionProbe />)

    expect(error?.message).toMatch(MISSING_PROVIDER)
  })

  it('never returns a fabricated fallback identity', () => {
    const { markup } = renderQuietly(<SessionProbe />)

    // A default session would have rendered a user id instead of throwing.
    expect(markup).toBeUndefined()
  })

  it('returns exactly the session supplied to an explicit provider', () => {
    const session = makeTestSession({ userId: 'explicit-user-42' })

    const markup = render(
      <SessionProvider session={session}>
        <SessionProbe />
      </SessionProvider>,
    )

    expect(markup).toContain('explicit-user-42')
  })

  it('reflects a different explicit session, proving no cached default', () => {
    const markup = render(
      <SessionProvider session={makeTestSession({ userId: 'second-user' })}>
        <SessionProbe />
      </SessionProvider>,
    )

    expect(markup).toContain('second-user')
  })
})

describe('SessionProvider', () => {
  it('has no default or optional session behaviour', () => {
    // Cast away the required prop to simulate a caller that omits it: the
    // provider must NOT substitute a default identity.
    const WithoutSession = SessionProvider as unknown as React.FunctionComponent<{
      children: React.ReactNode
      session?: AppSession
    }>

    const { error, markup } = renderQuietly(
      <WithoutSession>
        <SessionProbe />
      </WithoutSession>,
    )

    expect(markup).toBeUndefined()
    expect(error?.message).toMatch(MISSING_PROVIDER)
  })

  it('exports no sample session from production session code', async () => {
    const sessionModule = await import('@/lib/session')

    expect(Object.keys(sessionModule)).not.toContain('mockSession')
  })
})

describe('useDigitStyle / useLocalePrefs', () => {
  it('go through useSession and throw without a provider', () => {
    expect(renderQuietly(<DigitStyleProbe />).error?.message).toMatch(MISSING_PROVIDER)
    expect(renderQuietly(<LocaleProbe />).error?.message).toMatch(MISSING_PROVIDER)
  })

  it('return the supplied session preferences', () => {
    const session = makeTestSession({ locale: 'ar', digitStyle: 'arabic_indic' })

    const digits = render(
      <SessionProvider session={session}>
        <DigitStyleProbe />
      </SessionProvider>,
    )
    const locale = render(
      <SessionProvider session={session}>
        <LocaleProbe />
      </SessionProvider>,
    )

    expect(digits).toContain('arabic_indic')
    expect(locale).toContain('ar')
  })
})
