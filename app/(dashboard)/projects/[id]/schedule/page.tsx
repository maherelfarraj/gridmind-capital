import type { Metadata } from 'next'
import { SchedulePage } from '@/components/projects/schedule-page'

export const metadata: Metadata = { title: 'Project Schedule' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SchedulePage projectId={id} />
}
