import type { Metadata } from 'next'
import { VariationsRegister } from '@/components/projects/variations-register'

export const metadata: Metadata = { title: 'Variation Orders' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VariationsRegister projectId={id} />
}
