import { StakeholdersPage } from '@/components/projects/stakeholders-page'

export default async function G1StakeholdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <StakeholdersPage projectId={id} />
}
