'use client'

import * as React from 'react'
import { Megaphone, Send, CheckCircle2 } from 'lucide-react'
import type { ClientHome as ClientHomeData } from '@/app/actions/client'
import { submitInformationRequest } from '@/app/actions/client'
import { useToast } from '@/components/ui/toast'
import { GateStepper, StatCard, formatDate } from './client-utils'

export function ClientHome({ home }: { home: ClientHomeData }) {
  const { toast } = useToast()
  const [message, setMessage] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setSubmitting(true)
    const res = await submitInformationRequest({ projectId: home.project.id, message })
    setSubmitting(false)
    if (res.error) {
      toast({ title: 'Could not send', description: res.error, variant: 'danger' })
    } else {
      setSent(true)
      setMessage('')
      toast({ title: 'Request sent', description: 'Your project manager has been notified.', variant: 'success' })
    }
  }

  return (
    <div className="space-y-6">
      {/* Project header */}
      <div>
        <p className="text-sm font-medium text-muted-foreground">{home.project.code}</p>
        <h1 className="text-2xl font-semibold text-foreground text-balance">{home.project.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[home.project.technology, home.project.location, home.project.country].filter(Boolean).join(' • ') || 'Project overview'}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Current Gate" value={home.currentGate} sub="Stage-gate lifecycle" />
        <StatCard label="Overall Progress" value={`${home.percentComplete}%`} sub={`${home.gates.filter((g) => g.status === 'approved').length} of 8 gates approved`} />
        <StatCard
          label="Next Milestone"
          value={home.nextMilestone ? formatDate(home.nextMilestone.plannedDate) : '—'}
          sub={home.nextMilestone?.title ?? 'No upcoming milestone'}
        />
      </div>

      {/* Gate stepper */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Project Lifecycle</h2>
          <span className="text-xs text-muted-foreground">{home.percentComplete}% complete</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[#0a2540] transition-all" style={{ width: `${home.percentComplete}%` }} />
        </div>
        <div className="mt-4">
          <GateStepper gates={home.gates} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Announcements */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="size-4 text-muted-foreground" aria-hidden />
            Announcements
          </h2>
          {home.announcements.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No announcements yet. Your project team will post updates here.
            </div>
          ) : (
            <ul className="space-y-3">
              {home.announcements.map((a) => (
                <li key={a.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium text-foreground text-pretty">{a.title}</h3>
                    <time className="shrink-0 text-xs text-muted-foreground">{formatDate(a.publishedAt)}</time>
                  </div>
                  {a.body && <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground text-pretty">{a.body}</p>}
                  {a.authorName && <p className="mt-2 text-xs text-muted-foreground">— {a.authorName}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Request information */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Request Information</h2>
          <div className="rounded-lg border border-border bg-card p-4">
            {sent ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CheckCircle2 className="size-8 text-emerald-600" aria-hidden />
                <p className="text-sm font-medium text-foreground">Request sent</p>
                <p className="text-xs text-muted-foreground">Your project manager will follow up with you.</p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="mt-1 text-xs font-medium text-[#0a2540] underline underline-offset-2"
                >
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="text-xs text-muted-foreground text-pretty">
                  Have a question for the project team? Send a message and your project manager will be notified.
                </p>
                <label htmlFor="info-request" className="sr-only">Your message</label>
                <textarea
                  id="info-request"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="Type your question or request…"
                  className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-[#0a2540] focus:ring-1 focus:ring-[#0a2540]"
                />
                <button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-[#0a2540] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="size-3.5" aria-hidden />
                  {submitting ? 'Sending…' : 'Send request'}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
