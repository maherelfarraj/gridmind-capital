import { TransmittalsRegister } from '@/components/engineering/transmittals-register'

export default async function TransmittalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TransmittalsRegister projectId={id} />
}
