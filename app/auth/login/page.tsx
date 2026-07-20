'use client'

import React from 'react'
import { LoginPage } from '@/components/auth/login-page'

const DEMO_CREDENTIALS: Record<string, string> = {
  'admin@gridmind.capital': 'Admin123!',
  'pm@gridmind.capital':    'PM123!',
}

export default function Page() {
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      // API route not yet implemented — fall back to demo credentials
      if (response.status === 404) {
        await new Promise((r) => setTimeout(r, 600))
        if (DEMO_CREDENTIALS[email] === password) {
          window.location.href = '/dashboard'
        } else {
          setError('Invalid email or password. Try the demo credentials below.')
        }
        return
      }

      const data = await response.json()
      if (data.success) {
        window.location.href = '/dashboard'
      } else {
        setError(data.error ?? 'Invalid email or password.')
      }
    } catch {
      setError('Network error — please check your connection and try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <LoginPage
      onLogin={handleLogin}
      error={error}
      isLoading={isLoading}
    />
  )
}
