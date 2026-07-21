/**
 * Redirect shim: /login → /auth/login
 * The canonical login page lives at app/auth/login/page.tsx
 */
import { redirect } from 'next/navigation'

export default function LoginRedirect() {
  redirect('/auth/login')
}
