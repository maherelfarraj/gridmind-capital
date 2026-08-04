'use client'

import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/ui/toast'

/**
 * Wraps the entire /auth subtree in a ToastProvider.
 *
 * The update-password page calls useToast(), which throws
 * "useToast must be used within a ToastProvider" when no provider is present in
 * the tree. Without this layout that call crashed the page on render. The
 * layout adds the provider only (no visual chrome) so each auth page keeps
 * owning its own layout and styling.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
