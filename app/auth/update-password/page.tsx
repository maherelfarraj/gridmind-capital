'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { Eye, EyeOff, Check, X } from 'lucide-react'

const PASSWORD_MIN_LENGTH = 8
const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'At least 8 characters', regex: /.{8,}/ },
  { id: 'upper', label: 'Uppercase letter', regex: /[A-Z]/ },
  { id: 'number', label: 'Number', regex: /\d/ },
  { id: 'special', label: 'Special character (!@#$%^&*)', regex: /[!@#$%^&*]/ },
]

export default function UpdatePasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check password requirements
  const passwordMet = PASSWORD_REQUIREMENTS.map(req => ({
    ...req,
    met: req.regex.test(password),
  }))
  const allRequirementsMet = passwordMet.every(r => r.met)
  const passwordsMatch = password === confirmPassword && password.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate
    if (!allRequirementsMet) {
      setError('Password does not meet all requirements.')
      return
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message || 'Failed to update password.')
        return
      }

      toast({
        variant: 'success',
        title: 'Password Updated',
        description: 'Your password has been successfully changed. Redirecting to login...',
        duration: 3000,
      })

      // Redirect to login after a brief delay
      setTimeout(() => {
        router.push('/auth/login')
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Reset Your Password</h1>
          <p className="text-slate-600 text-sm mb-6">
            Choose a strong password to secure your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-900 mb-2">
                New Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={isLoading}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              {/* Password Requirements Checklist */}
              <div className="mt-4 space-y-2">
                {passwordMet.map(req => (
                  <div key={req.id} className="flex items-center gap-2 text-sm">
                    {req.met ? (
                      <Check className="size-4 text-green-600 flex-shrink-0" />
                    ) : (
                      <X className="size-4 text-slate-300 flex-shrink-0" />
                    )}
                    <span className={req.met ? 'text-green-700' : 'text-slate-600'}>
                      {req.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-900 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={isLoading}
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  disabled={isLoading}
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="mt-2 text-sm text-red-600">Passwords do not match.</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || !allRequirementsMet || !passwordsMatch}
              className="w-full"
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </Button>

            <p className="text-center text-xs text-slate-600">
              Remember your new password for future logins.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
