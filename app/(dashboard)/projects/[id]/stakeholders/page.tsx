import type { Metadata } from 'next'
import { StakeholdersPage } from '@/components/projects/stakeholders-page'

export const metadata: Metadata = { title: 'Stakeholder Matrix' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StakeholdersPage projectId={id} />
}
