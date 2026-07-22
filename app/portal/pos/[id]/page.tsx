import { notFound } from 'next/navigation'
import { getPortalPurchaseOrder, getPortalDeliveryDocs } from '@/app/actions/portal'
import { PortalPoDetail } from '@/components/portal/portal-po-detail'

export default async function PortalPoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getPortalPurchaseOrder(id)
  if (!result) notFound()
  const deliveryDocs = await getPortalDeliveryDocs(id)

  return <PortalPoDetail po={result.po} lines={result.lines} deliveryDocs={deliveryDocs} />
}
