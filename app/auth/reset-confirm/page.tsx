'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { validateResetConfirmParams, buildResetConfirmCallbackUrl, getResetConfirmErrorMessage } from '@/lib/auth/reset-confirm'

export default function ResetConfirmPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isValid, setIsValid] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Extract parameters from URL
    const tokenHash = searchParams.get('token_hash')
    const type = searchParams.get('type')
    const next = searchParams.get('next')

    // Validate using helper
    if (!validateResetConfirmParams({ tokenHash, type, next })) {
      setError(getResetConfirmErrorMessage(tokenHash, type, next))
      return
    }

    // All validations passed
    setIsValid(true)
  }, [searchParams])

  const handleContinue = () => {
    const tokenHash = searchParams.get('token_hash')
    if (!tokenHash) return

    // Build callback URL using helper
    const callbackUrl = buildResetConfirmCallbackUrl(tokenHash)

    // Navigate to callback route
    router.push(callbackUrl)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          {isValid ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Reset Your Password</h1>
              <p className="text-slate-600 text-sm mb-6">
                Click the button below to continue with your password reset.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-800">
                  Your recovery link is ready to be verified. Click below to proceed.
                </p>
              </div>

              <Button
                onClick={handleContinue}
                className="w-full flex items-center justify-center gap-2"
                size="lg"
              >
                Continue to Reset Password
                <ArrowRight className="size-4" />
              </Button>

              <p className="text-center text-xs text-slate-600 mt-4">
                This link will expire after being used.
              </p>
            </>
          ) : (
            <>
              <div className="flex justify-center mb-6">
                <div className="flex size-12 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="size-6 text-red-600" aria-hidden />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">
                Invalid Recovery Link
              </h1>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800">
                  {error || 'The recovery link is invalid or has expired.'}
                </p>
              </div>

              <Button
                onClick={() => router.push('/auth/login')}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Back to Sign In
              </Button>

              <p className="text-center text-xs text-slate-600 mt-4">
                Need help? <a href="/" className="text-slate-900 font-medium hover:underline">Contact support</a>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
