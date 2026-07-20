import { redirect } from 'next/navigation'

/**
 * Route: / (root index of the (dashboard) layout group)
 * Hard redirects to /dashboard — the canonical home route.
 */
export default function Page() {
  redirect('/dashboard')
}
