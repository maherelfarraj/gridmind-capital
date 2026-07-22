import { AnnouncementsManager } from '@/components/projects/announcements-manager'

export default async function AnnouncementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AnnouncementsManager projectId={id} />
}
