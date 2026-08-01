'use client'

import * as React from 'react'
import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'

import { UsersRolesPage } from '@/components/admin/users-roles-page'
import { ExternalAccessTab } from '@/components/admin/external-access-tab'
import { getUsers, updateUserRole, inviteInternalUser } from '@/app/actions/admin'
import { isDbUserRole } from '@/lib/auth/roles'
import { useSession } from '@/lib/session-context'
import { useToast } from '@/components/ui/toast'
import type { UserProfile, UserRole } from '@/components/admin/users-roles-page'

/**
 * `profiles.role` already stores the `user_role` enum, and UsersRolesPage now
 * speaks that same vocabulary (see lib/auth/roles.ts), so no translation is
 * needed here. We only guard against unrecognised values so a bad row renders
 * as Viewer rather than breaking the table.
 */
function toComponentRole(dbRole: string | null | undefined): UserRole {
  return isDbUserRole(dbRole) ? dbRole : 'viewer'
}

function toRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

export default function Page() {
  const [activeTab, setActiveTab] = React.useState<'internal' | 'external'>('internal')
  const { data: rawUsers, isLoading, mutate } = useSWR('admin-users', getUsers)
  const { toast } = useToast()
  const session = useSession()
  // Drives which roles the invite modal offers. Server-side authority still
  // lives in lib/auth/provisioning.ts — this only shapes what is on screen.
  const currentUserRole = session.roles[0] ?? null

  // Map DB profile shape → UsersRolesPage UserProfile shape
  const users: UserProfile[] = React.useMemo(() => (rawUsers ?? []).map((u) => ({
    id: u.id,
    name: u.full_name,
    email: u.email,
    role: toComponentRole(u.role),
    department: u.department ?? '—',
    status: (u.department === 'Deactivated' ? 'inactive' : 'active') as 'active' | 'inactive',
    lastActive: toRelativeTime(u.last_seen_at),
    joinedAt: u.created_at?.split('T')[0] ?? '',
  })), [rawUsers])

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    const res = await updateUserRole(userId, role)
    if (res?.error) {
      toast({ variant: 'danger', title: 'Role Not Updated', description: res.error, duration: 6000 })
      return
    }
    mutate()
  }

  const handleInvite = async (data: {
    email: string
    full_name: string
    role: UserRole
    department?: string
  }) => {
    const res = await inviteInternalUser({
      email: data.email,
      fullName: data.full_name,
      role: data.role,
      department: data.department,
      siteUrl: window.location.origin,
    })

    // Throwing lets UsersRolesPage show a failure toast instead of "Sent".
    if (res.error) throw new Error(res.error)

    mutate()

    if (res.inviteLink) {
      try {
        await navigator.clipboard.writeText(res.inviteLink)
        toast({
          variant: 'success',
          title: res.isExisting ? 'Existing User Updated' : 'Invite Created',
          description: `Sign-in link for ${data.email} copied to your clipboard.`,
          duration: 8000,
        })
      } catch {
        // Clipboard access can be blocked; the invite itself still succeeded.
      }
    }
  }

  // Wait for data before rendering so the component initialises with real rows
  if (isLoading || !rawUsers) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        Loading users...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {(['internal', 'external'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'internal' ? 'Internal users' : 'External access'}
          </button>
        ))}
      </div>

      {activeTab === 'internal' && (
        <UsersRolesPage
          users={users}
          totalCount={users.length}
          isLoading={false}
          onInvite={handleInvite}
          onUpdateRole={handleUpdateRole}
          currentUserRole={currentUserRole}
        />
      )}

      {activeTab === 'external' && <ExternalAccessTab />}
    </div>
  )
}
