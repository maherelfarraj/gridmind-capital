'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEMO_TENANT = '00000000-0000-0000-0000-000000000001'

export interface LogExportArgs {
  /** Null/undefined for portfolio-wide exports. */
  projectId?: string | null
  /** Machine key for the register, e.g. "variation-orders", "ncrs", "portfolio". */
  register: string
  /** Snapshot of the filters that were active at export time. */
  filters?: Record<string, unknown>
  /** Number of data rows written (excludes header/footer). */
  rowCount: number
}

/**
 * Records a register export to workflow_events and returns the project code
 * (RLS-respecting) so the client can build the {CODE}_{register}_{date}.xlsx
 * file name. Returns "PORTFOLIO" when no project is scoped, or "PROJECT" when
 * the code is not visible to the current user.
 */
export async function logExport(args: LogExportArgs): Promise<{ code: string }> {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user ?? null

  let code = args.projectId ? 'PROJECT' : 'PORTFOLIO'
  let fullName: string | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()
    fullName = profile?.full_name ?? null
  }

  if (args.projectId) {
    // Read through the RLS-scoped client — falls back to "PROJECT" if not visible.
    const { data: proj } = await supabase
      .from('projects')
      .select('code')
      .eq('id', args.projectId)
      .single()
    if (proj?.code) code = proj.code
  }

  const admin = createAdminClient()
  await admin.from('workflow_events').insert({
    instance_id: null,
    from_state: null,
    to_state: 'exported',
    transition_code: 'REGISTER_EXPORTED',
    actor_id: user?.id ?? null,
    comment: `Exported ${args.rowCount} ${args.register} row(s) to Excel`,
    metadata: {
      module: 'export',
      project_id: args.projectId ?? null,
      register: args.register,
      filters: args.filters ?? {},
      row_count: args.rowCount,
      format: 'xlsx',
      exported_by: fullName,
    },
  })

  return { code }
}
