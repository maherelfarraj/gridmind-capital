'use client'

import Link from 'next/link'
import { Mail, Clock } from 'lucide-react'
import { signOutAction } from '@/app/actions/auth'

export default function SignupPendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <Mail className="h-6 w-6 text-blue-600" aria-hidden="true" />
        </div>

        {/* Title */}
        <h1 className="text-balance text-xl font-semibold text-card-foreground">
          Account created successfully
        </h1>

        {/* Message */}
        <p className="mt-3 text-pretty leading-relaxed text-muted-foreground">
          Your account has been created and is awaiting administrator activation.
          A confirmation email has been sent to your registered email address.
        </p>

        {/* Info box */}
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="text-left">
              <h3 className="font-medium text-amber-900 text-sm">What happens next?</h3>
              <ul className="mt-2 text-xs text-amber-800 space-y-1">
                <li>• Confirm your email when you receive the confirmation link</li>
                <li>• An administrator will review and activate your account</li>
                <li>• You&apos;ll be assigned a role and tenant when your account is activated</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 space-y-3">
          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/auth/login"
            className="block w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Back to login
          </Link>
        </div>

        {/* Contact info */}
        <p className="mt-6 text-xs text-muted-foreground">
          Need help? Contact your administrator or visit our support page.
        </p>
      </div>
    </div>
  )
}
