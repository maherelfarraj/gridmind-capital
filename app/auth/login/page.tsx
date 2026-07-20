'use client'

import React from 'react'
import { LoginPage } from '@/components/auth/login-page'

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
