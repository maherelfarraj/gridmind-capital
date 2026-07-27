import { test, expect } from '@playwright/test'

/**
 * E2E Test Suite: 8-Phase Gate Advancement
 * Tests the complete gate lifecycle from initiation through phase transitions
 */

test.describe('Gate Advancement System', () => {
  test('G0→G1: Sign and approve opportunity gate', async ({ page }) => {
    // Navigate to Moz Farm project
    await page.goto('/projects/fc9241f0-5670-485b-916c-c0cdc547d2f7')
    
    // Verify G0 is current gate
    await expect(page.locator('[data-testid="stepper-g0"]')).toHaveAttribute('aria-current', 'step')
    
    // Open G0 approval review
    await page.click('[data-testid="view-g0-approval"]')
    
    // Sign all 5 G0 sign-offs (PD, DM, FIN, GCM, DEV)
    const signRoles = ['project_director', 'dev_manager', 'finance_lead', 'guarantor_mgr', 'dev_lead']
    for (const role of signRoles) {
      await page.click(`[data-testid="sign-button-${role}"]`)
      await page.fill('[data-testid="signature-canvas"]', 'Signed')
      await page.click('[data-testid="submit-signature"]')
      await page.waitForSelector('[data-testid="signature-confirmed"]')
    }
    
    // Approve gate
    await page.click('[data-testid="approve-gate-button"]')
    
    // Verify transition to G1
    await expect(page.locator('[data-testid="current-gate-status"]')).toContainText('G1')
    await expect(page.locator('[data-testid="stepper-g1"]')).toHaveAttribute('aria-current', 'step')
  })

  test('G1→G2: Baseline approved advancement', async ({ page }) => {
    // Start at G1 active state
    await page.goto('/projects/fc9241f0-5670-485b-916c-c0cdc547d2f7/g1')
    
    // Verify phase_name displays real name (not hardcoded 'Baseline Approved')
    const panelTitle = await page.locator('[data-testid="gate-status-title"]').textContent()
    expect(panelTitle).toContain('Origination & Feasibility')
    
    // Submit G1 deliverables
    await page.click('[data-testid="submit-g1-deliverables"]')
    await page.fill('[data-testid="feasibility-report"]', 'Report content')
    await page.click('[data-testid="save-g1-package"]')
    
    // Sign all G1 approvals
    await page.click('[data-testid="open-g1-approvals"]')
    for (let i = 0; i < 5; i++) {
      await page.click(`[data-testid="sign-slot-${i}"]`)
      await page.fill('[data-testid="signature-input"]', 'Signature')
      await page.click('[data-testid="confirm-signature"]')
    }
    
    // Approve G1
    await page.click('[data-testid="approve-g1"]')
    
    // Verify G2 is now active
    await expect(page.locator('[data-testid="current-phase"]')).toContainText('Permitting & Grid Application')
  })

  test('Multi-phase: Complete G0-G3 sequence', async ({ page }) => {
    // Test complete advancement from start through G3
    const phases = [
      { gate: 'G0', name: 'Opportunity Accepted', nextGate: 'G1' },
      { gate: 'G1', name: 'Origination & Feasibility', nextGate: 'G2' },
      { gate: 'G2', name: 'Permitting & Grid Application', nextGate: 'G3' },
      { gate: 'G3', name: 'Commercial & Financial', nextGate: 'G4' },
    ]

    for (const phase of phases) {
      // Navigate to current gate
      await page.goto(`/projects/fc9241f0-5670-485b-916c-c0cdc547d2f7/${phase.gate.toLowerCase()}`)
      
      // Verify phase name from DB (not hardcoded)
      const statusText = await page.locator('[data-testid="gate-status-title"]').textContent()
      expect(statusText).toContain(phase.name)
      
      // Complete all approvals for this phase
      await page.click('[data-testid="start-phase-approvals"]')
      
      // Sign all required slots
      const signButtons = await page.locator('[data-testid^="sign-slot-"]').count()
      for (let i = 0; i < signButtons; i++) {
        await page.click(`[data-testid="sign-slot-${i}"]`)
        await page.fill('[data-testid="signature-pad"]', `Signature ${i}`)
        await page.click('[data-testid="save-signature"]')
      }
      
      // Submit and approve
      await page.click('[data-testid="submit-approvals"]')
      await page.click('[data-testid="approve-gate"]')
      
      // Verify advancement to next gate
      await expect(page.locator('[data-testid="current-gate"]')).toContainText(phase.nextGate)
    }
  })

  test('Vocabulary unification: All surfaces show same phase names', async ({ page }) => {
    await page.goto('/projects/fc9241f0-5670-485b-916c-c0cdc547d2f7')
    
    // Get phase name from stepper
    const stepperName = await page.locator('[data-testid="stepper-g2-label"]').textContent()
    
    // Get phase name from status panel
    await page.goto('/projects/fc9241f0-5670-485b-916c-c0cdc547d2f7/g2')
    const panelName = await page.locator('[data-testid="gate-status-title"]').textContent()
    
    // Get phase name from registry
    await page.goto('/projects')
    const registryName = await page.locator('[data-testid="moz-farm-gate-badge"]').textContent()
    
    // All three should show the same real phase_name
    expect(stepperName).toContain('Permitting & Grid Application')
    expect(panelName).toContain('Permitting & Grid Application')
    expect(registryName).toContain('Permitting & Grid Application')
  })

  test('Admin portal: Only admins can access testing dashboard', async ({ page, context }) => {
    // Create new browser context for non-admin user
    const nonAdminPage = await context.newPage()
    
    // Try to access admin testing dashboard as non-admin
    await nonAdminPage.goto('/admin/testing')
    
    // Should be redirected to unauthorized
    await expect(nonAdminPage).toHaveURL(/unauthorized|login/)
    
    // Login as admin
    await page.goto('/admin/testing')
    await expect(page).toHaveURL('/admin/testing')
    
    await nonAdminPage.close()
  })

  test('Fresh start: Reset project to initial state', async ({ page }) => {
    // Navigate to admin testing dashboard
    await page.goto('/admin/testing')
    
    // Click fresh start button for a test project
    await page.click('[data-testid="fresh-start-moz-farm"]')
    
    // Confirm reset
    await page.click('[data-testid="confirm-reset"]')
    
    // Verify project is reset to G0
    await page.goto('/projects/fc9241f0-5670-485b-916c-c0cdc547d2f7')
    await expect(page.locator('[data-testid="current-phase"]')).toContainText('G0')
    await expect(page.locator('[data-testid="phase-status"]')).toContainText('pending')
  })
})

test.describe('Multi-Project Testing', () => {
  test('Concurrent gate advancement across multiple projects', async ({ page, context }) => {
    const projects = [
      'fc9241f0-5670-485b-916c-c0cdc547d2f7', // Moz Farm
      // Add other project IDs
    ]

    for (const projectId of projects) {
      const projectPage = await context.newPage()
      await projectPage.goto(`/projects/${projectId}`)
      
      // Verify each project has correct phase_gates
      const gateCount = await projectPage.locator('[data-testid^="stepper-g"]').count()
      expect(gateCount).toBe(8)
      
      await projectPage.close()
    }
  })

  test('Admin can view all projects in testing dashboard', async ({ page }) => {
    await page.goto('/admin/testing')
    
    // Verify all 16 projects are listed
    const projectRows = await page.locator('[data-testid="project-row"]').count()
    expect(projectRows).toBeGreaterThanOrEqual(16)
    
    // Each project should have phase info
    const phaseLabels = await page.locator('[data-testid^="project-phase-"]').count()
    expect(phaseLabels).toBeGreaterThanOrEqual(16)
  })
})
