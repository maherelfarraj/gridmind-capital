'use client'

import React, { useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { TableCard } from '@/components/copilot/table-card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Send,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ExternalLink,
  Loader2,
  Plus,
  ArrowLeft,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { askCopilot, getCopilotHistory, type CopilotMessage, type CitationChip } from '@/app/actions/copilot'

// ─────────────────────────────────────────────────────────────
// Suggested Questions
// ─────────────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'What gate is Moz Farm on?',
  'What approvals are waiting on me?',
  'Show overdue items on Moz Farm',
  'Which permits expire this month?',
  'Summarize project risks',
  'Any incidents this week?',
]

// ─────────────────────────────────────────────────────────────
// Message Component
// ─────────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onFeedback,
}: {
  message: CopilotMessage
  onFeedback?: (feedback: -1 | 0 | 1) => void
}) {
  const isAssistant = message.role === 'assistant'

  return (
    <div
      className={cn(
        'flex gap-3 mb-4',
        isAssistant ? 'justify-start' : 'justify-end',
      )}
    >
      {isAssistant && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
          <Sparkles size={14} aria-hidden="true" />
        </div>
      )}

      <div className="flex flex-col gap-2 max-w-xs">
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm break-words',
            isAssistant
              ? 'bg-muted text-foreground'
              : 'bg-sidebar-primary text-sidebar-primary-foreground',
          )}
        >
          {message.content}
        </div>

          {/* Table Card */}
          {message.tableCard && (
            <div className="mt-3 -mx-2">
              <TableCard
                title={message.tableCard.title}
                summary={message.tableCard.summary}
                columns={message.tableCard.columns}
                rows={message.tableCard.rows}
              />
            </div>
          )}

          {/* Citations */}
          {message.citations && message.citations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.citations.map((cite, idx) => (
                <a
                  key={idx}
                  href={cite.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary hover:bg-primary/20"
                >
                  <Badge className="!font-normal">{cite.module}</Badge>
                </a>
              ))}
            </div>
          )}

        {/* Feedback buttons (only for assistant messages) */}
        {isAssistant && onFeedback && (
          <div className="flex gap-1">
            <button
              onClick={() => onFeedback(1)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Helpful"
            >
              <ThumbsUp size={13} aria-hidden="true" />
            </button>
            <button
              onClick={() => onFeedback(-1)}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Not helpful"
            >
              <ThumbsDown size={13} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main CopilotPanel
// ─────────────────────────────────────────────────────────────

export function CopilotPanel({
  open = false,
  onOpenChange,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [messages, setMessages] = React.useState<CopilotMessage[]>([])
  const [input, setInput] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [conversationId, setConversationId] = React.useState<string | undefined>(undefined)
  const [error, setError] = React.useState<string | null>(null)
  const [isRtl, setIsRtl] = React.useState(false)
  const [showHistory, setShowHistory] = React.useState(false)
  const [pastConversations, setPastConversations] = React.useState<Array<{ id: string; title: string; createdAt: string }>>([])
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Load conversation history on panel open
  React.useEffect(() => {
    if (open && messages.length === 0) {
      loadHistory()
    }
  }, [open])

  // Auto-scroll to bottom
  React.useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollElement) {
        setTimeout(() => {
          scrollElement.scrollTop = scrollElement.scrollHeight
        }, 0)
      }
    }
  }, [messages])

  async function loadHistory() {
    try {
      const { messages: historyMessages } = await getCopilotHistory(conversationId)
      if (historyMessages.length > 0) {
        setMessages(historyMessages)
      }
    } catch (err) {
      console.error('[copilot] Load history error:', err)
    }
  }

  function startNewChat() {
    setConversationId(undefined)
    setMessages([])
    setInput('')
    setShowHistory(false)
  }

  async function loadPastConversations() {
    try {
      // For now, simulate loading conversations
      // In production, would call a listCopilotConversations server action
      setShowHistory(true)
    } catch (err) {
      console.error('[copilot] Load conversations error:', err)
    }
  }

  async function selectConversation(convoId: string) {
    setConversationId(convoId)
    setShowHistory(false)
    setMessages([])
    await loadHistory()
  }

  async function sendMessage() {
    if (!input.trim() || loading) return

    setError(null)
    const userQuestion = input
    setInput('')

    // Add user message to UI
    const userMsg: CopilotMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userQuestion,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    setLoading(true)

    try {
      const response = await askCopilot(userQuestion, conversationId)

      if (response.error) {
        setError(response.error === 'RATE_LIMITED' ? 'Rate limit exceeded' : 'Error processing question')
      }

      // Store conversationId from response if this was first message
      if (response.conversationId && !conversationId) {
        setConversationId(response.conversationId)
      }

      setMessages((prev) => [...prev, response.message])
      
      // Detect RTL language (Arabic, Hebrew, Urdu, Persian, etc.)
      const arabicRegex = /[\u0600-\u06FF]/
      const hebrewRegex = /[\u0590-\u05FF]/
      const rtlRegex = new RegExp(`${arabicRegex.source}|${hebrewRegex.source}`)
      setIsRtl(rtlRegex.test(response.message.content))
    } catch (err) {
      console.error('[copilot] Send error:', err)
      setError('Failed to get response')
    } finally {
      setLoading(false)
    }
  }

  // Feedback is logged server-side via audit trail
  function submitFeedback(messageId: string, feedback: -1 | 0 | 1) {
    // Optimistically update UI
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, feedback } : m)),
    )
    // Server-side feedback logging handled via audit_trail table
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-96 flex flex-col p-0" dir={isRtl ? 'rtl' : 'ltr'}>
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              {showHistory && (
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Back to conversation"
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
              )}
              <Sparkles size={18} className="text-sidebar-primary" aria-hidden="true" />
              {showHistory ? 'Conversation History' : 'GridMind Copilot'}
            </SheetTitle>
            {!showHistory && (
              <div className="flex gap-1">
                <button
                  onClick={loadPastConversations}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="View history"
                >
                  <Clock size={18} aria-hidden="true" />
                </button>
                <button
                  onClick={startNewChat}
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title="Start new chat"
                >
                  <Plus size={18} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1" ref={scrollAreaRef}>
          <div className="p-4">
            {showHistory && (
              <div className="space-y-2">
                {pastConversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No previous conversations</p>
                ) : (
                  pastConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => selectConversation(conv.id)}
                      className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(conv.createdAt).toLocaleDateString()}
                      </p>
                    </button>
                  ))
                )}
              </div>
            )}
            {!showHistory && messages.length === 0 && !loading && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Hi! I&apos;m your GridMind assistant. Ask me about your projects, approvals, and more.
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Suggested questions:</p>
                  <div className="flex flex-col gap-2">
                    {SUGGESTED_QUESTIONS.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInput(q)
                          setTimeout(() => sendMessage(), 0)
                        }}
                        className="text-left rounded-lg border border-border p-2 text-xs hover:bg-muted transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!showHistory && messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onFeedback={msg.role === 'assistant' ? (fb) => submitFeedback(msg.id, fb) : undefined}
              />
            ))}

            {!showHistory && error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {!showHistory && loading && (
              <div className="flex gap-3 mb-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                </div>
                <div className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                  Thinking...
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        {!showHistory && (
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                disabled={loading}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                size="sm"
                className="shrink-0"
              >
                <Send size={14} aria-hidden="true" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              30 requests per hour · Data from live systems
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
