import { getPortalHome } from '@/app/actions/portal'
import { PortalHome } from '@/components/portal/portal-home'

export default async function PortalHomePage() {
  const home = await getPortalHome()
  return <PortalHome home={home} />
}
