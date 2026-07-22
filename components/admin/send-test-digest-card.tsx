'use client'

import * as React from 'react'
import { Mail, Loader2, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { sendTestDigest } from '@/app/actions/weekly-digest'

/**
 * Admin-only "Send test digest" control. Triggers the weekly digest for the
 * currently authenticated admin user (compiles their portfolio and emails it,
 * logging to email_log). Mirrors exactly what the Monday 07:00 cron sends.
 */
export function SendTestDigestCard() {
  const { toast } = useToast()
  const [sending, setSending] = React.useState(false)

  async function handleSend() {
    setSending(true)
    try {
      const res = await sendTestDigest()
      toast({
        variant: res.ok ? 'success' : 'warning',
        title: res.ok ? 'Test digest sent' : 'Digest not sent',
        description: res.message,
      })
    } catch {
      toast({ variant: 'danger', title: 'Error', description: 'Failed to trigger the test digest.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900">
            <Mail className="size-5 text-[#64ffda]" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Weekly Digest</h3>
            <p className="mt-1 max-w-prose text-sm text-slate-500">
              An automated summary is emailed to project managers and leadership every Monday at
              07:00 UTC. Send yourself a copy now to preview the content and confirm your numbers.
            </p>
          </div>
        </div>
        <Button onClick={handleSend} disabled={sending} className="shrink-0">
          {sending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Sending…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden="true" /> Send test digest
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
