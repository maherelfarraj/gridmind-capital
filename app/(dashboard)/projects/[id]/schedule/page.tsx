import type { Metadata } from 'next'
import { ScheduleWorkspace } from '@/components/schedule/schedule-workspace'

export const metadata: Metadata = { title: 'Project Schedule' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ScheduleWorkspace projectId={id} />
}
