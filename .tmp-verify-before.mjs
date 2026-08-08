import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY)

const { data, error } = await supabase
  .from('gate_submissions')
  .select('id, project_id, tenant_id, gate_number, status, submitted_at')
  .gte('gate_number', 2)
  .lte('gate_number', 7)
  .order('gate_number', { ascending: true })

if (error) {
  console.error('[v0] query error:', error)
  process.exit(1)
}

console.log('[v0] BEFORE migration — rows at gate_number 2-7:')
console.log(JSON.stringify(data, null, 2))
