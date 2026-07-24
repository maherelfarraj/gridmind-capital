import { PaymentsDashboard } from '@/components/payments/payments-dashboard'

export const metadata = { title: 'Payment Certificates — GridMind Capital' }

export default async function ProjectPaymentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <PaymentsDashboard projectId={id} />
}
