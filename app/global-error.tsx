'use client'

import * as React from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  React.useEffect(() => {
    console.error('[GridMind] Global error:', error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0a192f', color: '#e2e8f0', minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '480px' }}>
          {/* Logo mark */}
          <div style={{ width: 56, height: 56, margin: '0 auto 1.5rem', borderRadius: 12, background: '#64ffda18', border: '1.5px solid #64ffda40', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <rect x="3"  y="3"  width="10" height="10" rx="2" fill="#64ffda" />
              <rect x="15" y="3"  width="10" height="10" rx="2" fill="#64ffda" opacity="0.6" />
              <rect x="3"  y="15" width="10" height="10" rx="2" fill="#64ffda" opacity="0.6" />
              <rect x="15" y="15" width="10" height="10" rx="2" fill="#64ffda" opacity="0.3" />
            </svg>
          </div>

          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f1f5f9' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.25rem' }}>
            An unexpected error occurred in GridMind Capital.
          </p>
          {error.digest && (
            <p style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace', marginBottom: '1.5rem' }}>
              Error ID: {error.digest}
            </p>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <button
              onClick={reset}
              style={{ padding: '0.5rem 1.25rem', borderRadius: 8, background: '#64ffda', color: '#0a192f', fontWeight: 600, fontSize: '0.875rem', border: 'none', cursor: 'pointer' }}
            >
              Try again
            </button>
            <a
              href="/dashboard"
              style={{ padding: '0.5rem 1.25rem', borderRadius: 8, background: '#1e293b', color: '#cbd5e1', fontWeight: 500, fontSize: '0.875rem', textDecoration: 'none', border: '1px solid #334155' }}
            >
              Go to dashboard
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
