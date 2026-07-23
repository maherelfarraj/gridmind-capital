import type { Metadata } from 'next'
import { VariationDetail } from '@/components/projects/variation-detail'

export const metadata: Metadata = { title: 'Variation Order' }

export default async function Page({ params }: { params: Promise<{ id: string; voId: string }> }) {
  const { id, voId } = await params
  return <VariationDetail projectId={id} voId={voId} />
}
