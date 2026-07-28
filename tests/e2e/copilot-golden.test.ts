import { test, expect } from '@playwright/test'

/**
 * GridMind Copilot Golden Test Suite
 *
 * Three core scenarios:
 * 1. Table card: "What approvals are waiting on me?" → PRJ-2026-383 (Moz Farm) with deep link
 * 2. Honest no-data: "What is the capacity factor?" → "I don't have that data" (no invented numbers)
 * 3. RTL support: Arabic "أظهر الموافقات المعلقة" → Arabic response, panel dir="rtl"
 */

test.describe('Copilot - Golden Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app (assumes logged-in state via test env)
    await page.goto('/dashboard')
  })

  test('Test 1: Prose response for pending approvals (catalog disabled)', async ({ page }) => {
    // Open Copilot panel
    await page.click('button[aria-label="Open GridMind Copilot"]')
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    // Ask for pending approvals
    await page.fill('input[placeholder="Ask me anything..."]', 'What approvals are waiting on me?')
    await page.press('input[placeholder="Ask me anything..."]', 'Enter')
    
    // Expect prose response (catalog fast path disabled)
    await page.waitForTimeout(2000)
    
    // Verify NO table card appears (catalog disabled)
    const tableCard = page.locator('[data-testid="table-card"]')
    await expect(tableCard).not.toBeVisible()
    
    // Verify prose response is visible
    const response = page.locator('[role="region"]')
    await expect(response).toBeVisible()
    
    // Verify response contains context-driven answer (not "0 results")
    const responseText = await response.textContent()
    expect(responseText).not.toContain('0 results')
  })

  test('Test 2: General-knowledge answer with NO brackets and disclaimer', async ({ page }) => {
    // Open Copilot panel
    await page.click('button[aria-label="Open GridMind Copilot"]')
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    // Ask general-knowledge question (not about user data)
    await page.fill('input[placeholder="Ask me anything..."]', 'What is the capacity factor?')
    await page.press('input[placeholder="Ask me anything..."]', 'Enter')
    
    // Wait for response
    await page.waitForTimeout(3000)
    
    // Fetch response text
    const response = page.locator('[role="region"]')
    const responseText = await response.textContent()
    
    // CRITICAL CHECK 1: Verify NO bracket markers appear anywhere in response
    // This catches malformed junk like "[module: I don't have that data]"
    if ((responseText || '').includes('[')) {
      throw new Error(`Response contains bracket markers (should be stripped): "${responseText}"`)
    }
    
    // CRITICAL CHECK 2: Verify disclaimer line is present
    // General-knowledge answers MUST end with this exact disclaimer
    const hasDisclaimer = responseText?.includes('— General knowledge, not from your GridMind data')
    expect(hasDisclaimer).toBe(true)
    
    // Additional check: Verify response doesn't contain fabricated citations
    const citationPattern = /\[[a-z_]+:[a-z0-9_\-]+\]/i
    expect(citationPattern.test(responseText || '')).toBe(false)
  })

  test('Test 3: RTL support for Arabic', async ({ page }) => {
    // Open Copilot panel
    await page.click('button[aria-label="Open GridMind Copilot"]')
    await expect(page.locator('[role="dialog"]')).toBeVisible()
    
    // Ask in Arabic: "أظهر الموافقات المعلقة" (Show pending approvals)
    await page.fill('input[placeholder="Ask me anything..."]', 'أظهر الموافقات المعلقة')
    await page.press('input[placeholder="Ask me anything..."]', 'Enter')
    
    // Wait for response
    await page.waitForTimeout(3000)
    
    // Verify response is in Arabic (contains Arabic characters)
    const response = page.locator('[role="region"] >> text=/[\u0600-\u06FF]/')
    await expect(response).toBeVisible()
    
    // Verify panel has RTL direction applied
    const panel = page.locator('[role="dialog"]')
    const dir = await panel.getAttribute('dir')
    expect(dir).toBe('rtl')
  })
})

// RTL language test
test.describe('Copilot - RTL Support', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="email"]', 'viewer@gridmind.test')
    await page.fill('input[name="password"]', 'test-password-123')
    await page.click('button:has-text("Sign In")')
    await page.waitForURL('/dashboard')
  })

  test('Arabic response renders with RTL layout', async ({ page }) => {
    test.skip() // Requires Arabic LLM response
    
    await page.click('button[aria-label="Open GridMind Copilot"]')
    
    // Ask in Arabic or trigger Arabic response
    await page.fill('input[placeholder="Ask me anything..."]', 'ما هي بوابة مزرعة الموز؟')
    await page.click('button:has-text("Send") >> nth=1')
    
    await page.waitForTimeout(2000)
    
    // Verify panel has dir="rtl"
    const panel = page.locator('[role="presentation"]').first()
    await expect(panel).toHaveAttribute('dir', 'rtl')
  })
})

// Budget and quota tests
test.describe('Copilot - Tenant Budget', () => {
  test('token usage is logged in audit trail', async ({ page, context }) => {
    test.skip() // Requires database access in test

    // This test would verify:
    // 1. askCopilot logs to copilot_audit_trail
    // 2. input_tokens, output_tokens, total_tokens are recorded
    // 3. context_sources (modules called) are stored
    // 4. model_used is recorded
    // 5. response_time_ms is captured
  })

  test('tenant budget is updated after each query', async ({ page }) => {
    test.skip() // Requires database access in test

    // This test would verify:
    // 1. copilot_tenant_budget.current_month_tokens increments
    // 2. Exceeding limit blocks new queries with message
    // 3. Budget resets at month boundary
  })
})
