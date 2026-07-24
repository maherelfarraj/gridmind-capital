import { ContractsRegister } from '@/components/commercial/contracts-register'

export const metadata = { title: 'Contracts — GridMind Capital' }

export default async function ContractsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ContractsRegister projectId={id} />
}
