import { redirect } from 'next/navigation'

export default async function SignoffsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  const { project } = await searchParams
  redirect(project ? `/team/gates?project=${project}` : '/team/gates')
}
