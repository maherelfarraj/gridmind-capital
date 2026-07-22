import { getPortalPurchaseOrders } from '@/app/actions/portal'
import { PortalPosList } from '@/components/portal/portal-pos-list'

export default async function PortalPosPage() {
  const pos = await getPortalPurchaseOrders()
  return <PortalPosList pos={pos} />
}
