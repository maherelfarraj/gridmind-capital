import { NcrRegister } from '@/components/projects/ncr-register'

export default async function NcrsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <NcrRegister projectId={id} />
}
