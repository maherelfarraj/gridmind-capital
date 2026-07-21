import type { Metadata } from 'next'
import { CommercialPage } from '@/components/projects/commercial-page'

export const metadata: Metadata = { title: 'Commercial Charter' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CommercialPage projectId={id} />
}
