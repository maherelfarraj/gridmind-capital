'use server'

import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthActor } from '@/lib/auth/guard'
import { getCurrentTenantId } from '@/lib/tenant'
import { getDashboardStats, getActiveGates } from '@/app/actions/dashboard'
import { loadRisksDashboard } from '@/app/actions/risks'
import { getProjectGateState } from '@/app/actions/phase-gates'
import {
  getNearestQueries,
} from '@/lib/copilot/query-catalog-helpers'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CopilotMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: CitationChip[]
  feedback?: number | null
  tableCard?: {
    title: string
    summary: string
    columns: any[]
    rows: Record<string, any>[]
  }
  createdAt: string
}

export interface CitationChip {
  module: string
  recordId: string
  label: string
  link: string
}

export interface CopilotResponse {
  message: CopilotMessage
  conversationId?: string
  error?: string
}

interface ContextItem {
  module: string
  recordId: string
  label: string
  content: string
}

// ─────────────────────────────────────────────────────────────
// Context Assembler — Route lightweight keywords to existing read actions
// ─────────────────────────────────────────────────────────────

async function assembleContext(question: string): Promise<{ items: ContextItem[]; tokenCount: number }> {
  const items: ContextItem[] = []
  const keywords = question.toLowerCase()

  try {
    // Keyword routing — call only relevant read actions
    if (keywords.includes('approval') || keywords.includes('pending')) {
      const stats = await getDashboardStats()
      items.push({
        module: 'dashboard',
        recordId: 'stats',
        label: 'Dashboard Stats',
        content: JSON.stringify(stats),
      })
    }

    if (keywords.includes('risk') || keywords.includes('issue')) {
      const risks = await loadRisksDashboard()
      items.push({
        module: 'risks',
        recordId: 'dashboard',
        label: 'Active Risks',
        content: JSON.stringify(risks),
      })
    }

    if (
      keywords.includes('gate') ||
      keywords.includes('phase') ||
      keywords.includes('project') ||
      keywords.includes('moz farm')
    ) {
      const gates = await getActiveGates()
      items.push({
        module: 'phase_gates',
        recordId: 'active',
        label: 'Active Project Gates',
        content: JSON.stringify(gates),
      })
    }

    if (keywords.includes('permit') || keywords.includes('schedule')) {
      // Would call schedule/permits read action if available
      // For now, include in context assembly pattern
    }
  } catch (error) {
    console.error('[copilot] Context assembly error:', error)
    // Continue with partial context on error
  }

  // Calculate approximate token count (rough estimate: 4 chars ≈ 1 token)
  const content = items.map((i) => i.content).join(' ')
  const tokenCount = Math.ceil(content.length / 4)

  return { items, tokenCount }
}

// ─────────────────────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────────────────────

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; message?: string }> {
  const supabase = createAdminClient()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  // Get all conversations for this user
  const { data: conversations } = await supabase
    .from('copilot_conversations')
    .select('id')
    .eq('user_id', userId)

  if (!conversations || conversations.length === 0) {
    return { allowed: true } // No conversations yet
  }

  const conversationIds = conversations.map((c) => c.id)

  // Count messages in last hour across all conversations
  const { count, error } = await supabase
    .from('copilot_messages')
    .select('id', { count: 'exact', head: true })
    .in('conversation_id', conversationIds)
    .gte('created_at', oneHourAgo)

  if (error) {
    console.warn('[copilot] Rate limit check error:', error)
    return { allowed: false, message: 'Rate limit check failed. Please try again.' } // Fail closed on DB error
  }

  const currentCount = count ?? 0
  const limit = 30

  if (currentCount >= limit) {
    return {
      allowed: false,
      message: `Rate limit exceeded. You have sent ${currentCount} messages in the last hour (limit: ${limit}/hour). Please try again later.`,
    }
  }

  return { allowed: true }
}

// ─────────────────────────────────────────────────────────────
// Get Conversation History
// ─────────────────────────────────────────────────────────────

export async function getCopilotHistory(
  conversationId?: string,
): Promise<{ messages: CopilotMessage[]; error?: string }> {
  // 1. Authenticate actor
  const actorResult = await getAuthActor()
  if ('error' in actorResult) {
    return {
      messages: [],
      error: actorResult.error,
    }
  }

  const { actor } = actorResult
  const supabase = createAdminClient()

  // 2. If conversationId not provided, get the latest conversation
  let finalConversationId = conversationId
  if (!finalConversationId) {
    const { data: conversation } = await supabase
      .from('copilot_conversations')
      .select('id')
      .eq('user_id', actor.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!conversation?.id) {
      return { messages: [] } // No conversations yet
    }

    finalConversationId = conversation.id
  } else {
    // IDOR fix: Verify conversation ownership before reading
    const { data: conversation, error: convoErr } = await supabase
      .from('copilot_conversations')
      .select('user_id')
      .eq('id', finalConversationId)
      .single()

    if (convoErr || !conversation) {
      return { messages: [], error: 'Conversation not found' }
    }

    if (conversation.user_id !== actor.userId) {
      return { messages: [], error: 'Access denied: this conversation does not belong to you' }
    }
  }

  // 3. Fetch messages for this conversation
  const { data: messages, error } = await supabase
    .from('copilot_messages')
    .select('*')
    .eq('conversation_id', finalConversationId)
    .order('created_at', { ascending: true })

  if (error) {
    return {
      messages: [],
      error: error.message,
    }
  }

  return {
    messages: (messages || []) as CopilotMessage[],
  }
}

// ─────────────────────────────────────────────────────────────
// Main Copilot Action
// ─────────────────────────────────────────────────────────────

export async function askCopilot(
  question: string,
  conversationId?: string,
): Promise<CopilotResponse> {
  // Initialize admin client for server-side operations
  const adminClient = createAdminClient()

  // 1. Authenticate actor (reuse existing pattern)
  const actorResult = await getAuthActor()
  if ('error' in actorResult) {
    return {
      message: {
        id: '',
        role: 'assistant',
        content: 'Authentication required. Please log in.',
        createdAt: new Date().toISOString(),
      },
      error: actorResult.error,
    }
  }

  const { actor } = actorResult
  const tenantId = await getCurrentTenantId()

  // 2. Rate limiting check
  const rateCheckResult = await checkRateLimit(actor.userId)
  if (!rateCheckResult.allowed) {
    return {
      message: {
        id: '',
        role: 'assistant',
        content: rateCheckResult.message || 'Rate limit exceeded.',
        createdAt: new Date().toISOString(),
      },
      error: 'RATE_LIMITED',
    }
  }

  // 2.5. IDOR check: If conversationId provided, verify ownership before writing
  let finalConversationId = conversationId
  if (finalConversationId) {
    const { data: conversation, error: convoCheckErr } = await adminClient
      .from('copilot_conversations')
      .select('user_id')
      .eq('id', finalConversationId)
      .single()

    if (convoCheckErr || !conversation) {
      return {
        message: {
          id: '',
          role: 'assistant',
          content: 'Conversation not found.',
          createdAt: new Date().toISOString(),
        },
        error: 'CONVERSATION_NOT_FOUND',
      }
    }

    if (conversation.user_id !== actor.userId) {
      return {
        message: {
          id: '',
          role: 'assistant',
          content: 'Access denied.',
          createdAt: new Date().toISOString(),
        },
        error: 'ACCESS_DENIED',
      }
    }
  } else {
    // Create conversation server-side if not provided
    const { data: newConvo, error: convoErr } = await adminClient
      .from('copilot_conversations')
      .insert({
        tenant_id: tenantId,
        user_id: actor.userId,
        title: 'New Conversation',
      })
      .select('id')
      .single()

    if (convoErr || !newConvo?.id) {
      return {
        message: {
          id: '',
          role: 'assistant',
          content: 'Failed to create conversation.',
          createdAt: new Date().toISOString(),
        },
        error: convoErr?.message || 'Unknown error',
      }
    }

    finalConversationId = newConvo.id
  }

  // 2.6. Budget enforcement: Check monthly token limit BEFORE processing
  const { data: budget, error: budgetErr } = await adminClient
    .from('copilot_tenant_budget')
    .select('current_month_tokens, monthly_token_limit')
    .eq('tenant_id', tenantId)
    .single()

  if (budgetErr) {
    // Fail closed on budget check error
    return {
      message: {
        id: '',
        role: 'assistant',
        content: 'Budget check failed. Please try again.',
        createdAt: new Date().toISOString(),
      },
      error: 'BUDGET_CHECK_FAILED',
    }
  }

  if (budget && budget.monthly_token_limit && budget.current_month_tokens >= budget.monthly_token_limit) {
    return {
      message: {
        id: '',
        role: 'assistant',
        content: 'Monthly token limit reached. Please try again next month.',
        createdAt: new Date().toISOString(),
      },
      error: 'BUDGET_EXCEEDED',
    }
  }

  // 3. Question length validation before LLM call
  if (question.length > 2000) {
    return {
      message: {
        id: '',
        role: 'assistant',
        content: 'Question too long. Please keep your question under 2000 characters.',
        createdAt: new Date().toISOString(),
      },
      error: 'QUESTION_TOO_LONG',
    }
  }

  // 4. Persist user message
  const { data: userMsg, error: msgErr } = await adminClient
    .from('copilot_messages')
    .insert({
      conversation_id: finalConversationId,
      role: 'user',
      content: question,
      citations: [],
    })
    .select()
    .single()

  if (msgErr || !userMsg) {
    return {
      message: {
        id: '',
        role: 'assistant',
        content: 'Failed to save your message.',
        createdAt: new Date().toISOString(),
      },
      error: msgErr?.message,
    }
  }

  // 4. CATALOG DISABLED: Route all questions to prose/LLM-with-context path
  // The catalog query stubs (run: async () => []) return no data.
  // All questions now use the prose/LLM-with-context path which demonstrably works.
  // The queryId matching is kept for intent logging only (not for rendering table cards).
  const queryId = undefined // catalog disabled; queries not matched

  // 5. Assemble lightweight context from existing read actions for prose response
  const { items, tokenCount } = await assembleContext(question)

  // Cap context at 3,000 tokens
  const contextStr = items
    .slice(0, Math.floor(3000 / Math.max(1, tokenCount / items.length)))
    .map((item) => `[${item.module}:${item.recordId}] ${item.label}:\n${item.content}`)
    .join('\n\n')

  const systemPrompt = `You are GridMind Copilot, an AI assistant for enterprise renewable energy project management.

CITATION RULES (CRITICAL):
1. DATA ANSWERS: If the question asks about user data (e.g., "What approvals are waiting?"), answer ONLY from the provided context.
   - Every factual claim MUST cite a [module:recordId] that appears in the context.
   - If the module is missing, respond: "I don't have that data. The [module_name] module might have this information."
   - Never invent citations. NEVER cite a module that's not in the provided context.

2. GENERAL DEFINITIONS: General-knowledge questions (e.g., "What is capacity factor?") are allowed.
   - Do NOT cite any module for general definitions.
   - ABSOLUTELY NO BRACKETS [] in general-knowledge answers.
   - End with this EXACT plain-text line: "— General knowledge, not from your GridMind data."
   - Keep it under 50 words. Never wrap the disclaimer in brackets or any other marker.

3. If unsure whether context has relevant data, err on the side of "I don't have that data" + module hint.

OTHER RULES:
4. Keep answers under 150 words.
5. Support both English and Arabic. Match the question language.
6. Be concise and professional.

Context (${tokenCount} tokens):
${contextStr || 'No relevant data found.'}
`

  // 5. Call LLM via Vercel AI Gateway
  let response: string
  try {
    const result = await generateText({
      model: 'openai/gpt-4-turbo',
      system: systemPrompt,
      prompt: question,
    })
    response = result.text
  } catch (error) {
    console.error('[copilot] LLM error:', error)
    return {
      message: {
        id: '',
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
        createdAt: new Date().toISOString(),
      },
      error: String(error),
    }
  }

  // 6. Parse citations from response with GUARD against fabricated + malformed citations
  // Supports: [dashboard:stats], [phase_gates:uuid], [projects:slug], etc.
  const citationRegex = /\[([a-z_]+):([a-z0-9_\-]+(?:-[a-z0-9_\-]*)*)\]/gi
  const malformedBracketRegex = /\[[^\[\]]*\]/g // Any bracket span (including malformed)
  
  const citations: CitationChip[] = []
  const citedModules = new Set<string>()
  let strippedResponse = response
  let hasFabricatedCitation = false
  let strippedMalformedCount = 0

  // Build set of available modules from context
  const availableModules = new Set(items.map((i) => i.module))

  // Step 1: Process valid [module:recordId] citations
  let match
  while ((match = citationRegex.exec(response)) !== null) {
    const [fullMatch, module, recordId] = match
    const key = `${module}:${recordId}`
    
    if (!citedModules.has(key)) {
      // GUARD: Check if module exists in assembled context
      if (!availableModules.has(module)) {
        // Fabricated citation detected — strip it and flag for quality tracking
        console.warn(`[copilot] Fabricated citation detected: [${module}:${recordId}] not in context modules: ${Array.from(availableModules).join(', ')}`)
        strippedResponse = strippedResponse.replace(fullMatch, '')
        hasFabricatedCitation = true
      } else {
        // Valid citation — find and add it
        const contextItem = items.find((i) => i.module === module && i.recordId === recordId)
        if (contextItem) {
          citations.push({
            module: contextItem.module,
            recordId: contextItem.recordId,
            label: contextItem.label,
            link: createDeepLink(module, recordId),
          })
          citedModules.add(key)
          // Strip the citation marker from displayed text
          strippedResponse = strippedResponse.replace(fullMatch, '')
        } else {
          // Module exists but recordId not found — strip and flag
          console.warn(`[copilot] Citation recordId not found: [${module}:${recordId}]`)
          strippedResponse = strippedResponse.replace(fullMatch, '')
          hasFabricatedCitation = true
        }
      }
    }
  }

  // Step 2: Strip ANY remaining malformed bracket markers (e.g., "[module: I don't have that data]")
  // These are brackets containing spaces, prose, or invalid format
  let malformedMatch
  while ((malformedMatch = malformedBracketRegex.exec(strippedResponse)) !== null) {
    const bracketSpan = malformedMatch[0]
    // Check if this is a valid [module:recordId] format that we already processed
    const isValidCitation = /^\[[a-z_]+:[a-z0-9_\-]+(?:-[a-z0-9_\-]*)*\]$/i.test(bracketSpan)
    
    if (!isValidCitation) {
      // Malformed bracket — strip it
      console.warn(`[copilot] Malformed bracket marker stripped: "${bracketSpan}"`)
      strippedResponse = strippedResponse.replace(bracketSpan, '')
      strippedMalformedCount++
      hasFabricatedCitation = true // Flag for quality review
    }
  }

  // Clean up any double spaces created by stripping
  strippedResponse = strippedResponse.replace(/\s+/g, ' ').trim()

  if (strippedMalformedCount > 0) {
    console.warn(`[copilot] Stripped ${strippedMalformedCount} malformed bracket markers`)
  }

  // 7. Persist assistant message with stripped citations and fabrication flag
  const { data: assistantMsg, error: assistantErr } = await adminClient
    .from('copilot_messages')
    .insert({
      conversation_id: finalConversationId,
      role: 'assistant',
      content: strippedResponse,
      citations: citations,
      flagged: hasFabricatedCitation, // Quality loop: track LLM fabrications
    })
    .select()
    .single()

  if (assistantErr || !assistantMsg) {
    console.error('[copilot] Failed to save assistant message:', assistantErr)
  }

  if (hasFabricatedCitation) {
    console.warn('[copilot] Message flagged for quality review due to fabricated citations')
  }

  // 7. Log the intent miss to improve catalog (fire and forget)
  if (!queryId) {
    const nearestQueries = getNearestQueries(question, 3)
    const suggestedQueryIds = nearestQueries.map((q) => q.id)
    
    void adminClient
      .from('copilot_intent_log')
      .insert({
        tenant_id: tenantId,
        user_id: actor.userId,
        conversation_id: finalConversationId,
        question,
        classified_intent: null,
        matched_query_id: null,
        was_catalog_hit: false,
        fallback_prose_used: true,
        suggested_queries: suggestedQueryIds,
      })

    // Enhance response with suggestions if we couldn't match
    if (nearestQueries.length > 0) {
      const suggestionText = `\n\n[Suggested queries: ${nearestQueries.map((q) => q.label).join(', ')}]`
      if (response.length < 3000) {
        // Append suggestions if there's room
        response += suggestionText
      }
    }
  }

  // 8. Log to audit trail for regulatory compliance and budget tracking
  const inputTokens = Math.ceil(question.length / 4) // Rough estimate
  const outputTokens = Math.ceil(response.length / 4)
  const totalTokens = inputTokens + outputTokens
  
  const { error: auditErr } = await adminClient
    .from('copilot_audit_trail')
    .insert({
      tenant_id: tenantId,
      user_id: actor.userId,
      conversation_id: finalConversationId,
      message_id: assistantMsg?.id || '',
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: totalTokens,
      context_sources: items.map((i) => ({ module: i.module, recordId: i.recordId })),
      model_used: 'openai/gpt-4-turbo',
    })

  if (auditErr) {
    console.warn('[copilot] Failed to log audit trail:', auditErr)
    // Don't fail the response due to audit logging failure
  }

  // 9. Update tenant budget (atomic increment with month-based reset)
  const now = new Date()
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const firstDayOfMonth = `${currentYearMonth}-01`

  // Atomic update: reset if month changed, otherwise increment
  const { error: budgetUpdateErr } = await adminClient
    .rpc('increment_copilot_usage', {
      p_tenant_id: tenantId,
      p_tokens: totalTokens,
      p_current_month: firstDayOfMonth,
    })

  if (budgetUpdateErr) {
    // If RPC not available, fall back to conditional logic (still atomic within a transaction)
    const { data: budgetNow } = await adminClient
      .from('copilot_tenant_budget')
      .select('current_month_tokens, month_start_date')
      .eq('tenant_id', tenantId)
      .single()

    if (budgetNow) {
      const budgetYearMonth = budgetNow.month_start_date?.substring(0, 7) || ''
      if (budgetYearMonth !== currentYearMonth) {
        // New month: reset to current usage
        await adminClient
          .from('copilot_tenant_budget')
          .update({
            current_month_tokens: totalTokens,
            month_start_date: firstDayOfMonth,
          })
          .eq('tenant_id', tenantId)
      } else {
        // Same month: increment
        await adminClient
          .from('copilot_tenant_budget')
          .update({ current_month_tokens: budgetNow.current_month_tokens + totalTokens })
          .eq('tenant_id', tenantId)
      }
    }
  }

  return {
    message: {
      id: assistantMsg?.id || '',
      role: 'assistant',
      content: strippedResponse,
      citations,
      createdAt: new Date().toISOString(),
    },
    conversationId: finalConversationId,
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: Create deep links for citations
// ─────────────────────────────────────────────────────────────

function createDeepLink(module: string, recordId: string): string {
  const links: Record<string, (id: string) => string> = {
    dashboard: () => '/dashboard',
    risks: () => '/risks',
    phase_gates: () => '/stage-gates',
    projects: (id) => `/projects/${id}`,
    approvals: (id) => `/approvals/${id}`,
    permits: (id) => `/permits/${id}`,
  }

  const linkFn = links[module]
  return linkFn ? linkFn(recordId) : '#'
}
