import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Read role from profiles via admin client (bypasses RLS)
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .eq('tenant_id', DEMO_TENANT)
    .maybeSingle()

  const role = profile?.role as string | null | undefined

  // Only system_admin and tenant_admin may access /admin/*
  if (role !== 'system_admin' && role !== 'tenant_admin') {
    redirect('/dashboard')
  }

  return <>{children}</>
}
