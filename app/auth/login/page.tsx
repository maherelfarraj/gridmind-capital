'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { LoginPage } from '@/components/auth/login-page'
import { createClient } from '@/lib/supabase/client'

export default function Page() {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleLogin = async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message ?? 'Invalid email or password.')
        return
      }

      // Redirect to dashboard on success — router.refresh() ensures the
      // server layout picks up the new session cookie immediately.
      router.refresh()
      router.push('/dashboard')
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
