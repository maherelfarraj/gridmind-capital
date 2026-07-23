import { WorkPermitsBoard } from '@/components/hse/work-permits-board'

export const metadata = { title: 'Permits to Work — GridMind Capital' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <WorkPermitsBoard projectId={id} />
}
