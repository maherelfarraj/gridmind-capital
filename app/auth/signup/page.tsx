'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { SignupPage } from '@/components/auth/signup-page'
import { signupAction } from '@/app/actions/auth-signup'

export default function SignupPageRoute() {
  const router = useRouter()
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)

  const handleSignup = async (fullName: string, email: string, password: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await signupAction({ fullName, email, password })

      if (!result.success) {
        setError(result.error || 'Signup failed')
        return
      }

      // Show success message briefly, then redirect to pending page
      setSuccess(true)
      setTimeout(() => {
        router.push('/auth/signup/pending')
      }, 2000)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      console.error('[signup] Error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SignupPage
      onSignup={handleSignup}
      error={error}
      isLoading={isLoading}
      success={success}
    />
  )
}
