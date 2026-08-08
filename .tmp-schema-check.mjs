import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const tables = ['gate_submissions', 'projects', 'approvals', 'phase_gates', 'gate_signoffs']
for (const t of tables) {
  const { data, error } = await supabase.from(t).select('*').limit(1)
  console.log(`--- ${t} ---`)
  if (error) {
    console.log('error:', error.message)
  } else if (data && data[0]) {
    console.log('columns:', Object.keys(data[0]).sort())
  } else {
    console.log('columns: (no rows to sample, trying insert-shape probe skipped)')
  }
}
