import { getClientDocuments } from '@/app/actions/client'
import { ClientDocuments } from '@/components/client/client-documents'

export const dynamic = 'force-dynamic'

export default async function ClientDocumentsPage() {
  const documents = await getClientDocuments()
  return <ClientDocuments documents={documents} />
}
