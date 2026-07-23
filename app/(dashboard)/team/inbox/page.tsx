import { getActor, getInbox } from '@/lib/db/queries'
import { InboxView } from '@/components/team/inbox-view'

export const dynamic = 'force-dynamic'

export default async function TeamInboxPage() {
  const actor = await getActor()
  const items = await getInbox(actor.tenantId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything awaiting action across gate sign-offs, approvals, and tasks.
        </p>
      </div>
      <InboxView items={items} />
    </div>
  )
}
