import { NcrDetail } from '@/components/projects/ncr-detail'

export default async function NcrDetailPage({ params }: { params: Promise<{ id: string; ncrId: string }> }) {
  const { id, ncrId } = await params
  return <NcrDetail projectId={id} ncrId={ncrId} />
}
