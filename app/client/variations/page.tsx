import { getClientVariations } from '@/app/actions/client'
import { ClientVariations } from '@/components/client/client-variations'

export const dynamic = 'force-dynamic'

export default async function ClientVariationsPage() {
  const variations = await getClientVariations()
  return <ClientVariations variations={variations} />
}
