import { NextResponse } from 'next/server'
import { sendWeeklyDigests } from '@/app/actions/weekly-digest'

/**
 * Weekly digest cron endpoint.
 *
 * Invoked by the Supabase `weekly-digest` Edge Function (scheduled via pg_cron
 * every Monday 07:00). Protected by CRON_SECRET — the caller must pass it as a
 * Bearer token or `?secret=` query param. Also compatible with Vercel Cron
 * (which sends `Authorization: Bearer <CRON_SECRET>`).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request) {
  return handle(req)
}
export async function GET(req: Request) {
  return handle(req)
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET
  
  // Fail CLOSED: cron must be configured (secret set) and validation must pass
  if (!secret) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 })
  }
  
  // Accept secret from Authorization header ONLY (not URL params)
  const auth = req.headers.get('authorization') ?? ''
  const provided = auth.replace(/^Bearer\s+/i, '')
  
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  try {
    const result = await sendWeeklyDigests()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[cron] weekly-digest failed:', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'digest failed' },
      { status: 500 },
    )
  }
}
