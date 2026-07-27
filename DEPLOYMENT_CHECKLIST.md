# Deployment Checklist - 8-Phase Gate System Go Live

## Pre-Deployment Verification ✓

- [x] TypeScript: 0 errors
- [x] Git: Working tree clean, 65 commits ahead of main
- [x] Database: 128 phase_gates rows verified
- [x] Schema: All tables and RLS policies in place
- [x] Environment variables: Configured for Supabase

## Core Features Ready ✓

- [x] advanceProjectGate: Queries phase_gates, marks gates approved/in_review, recomputes current_phase
- [x] getProjectGateState: Returns real gateNames from phase_gates table
- [x] Vocabulary Unification: Stepper, panel, registry badge all use real phase_names
- [x] workflow_events: Logs phase_number + phase_name with full metadata
- [x] Approval System: Complete with SOD enforcement and signature management

## Pilot Data ✓

- [x] Moz Farm (PRJ-2026-383): Ready for G0→G1 gate advancement
- [x] All 16 projects: Have phase_gates rows with real 8-phase names
- [x] OPP-001: Phase 1 approved, ready for testing

## Known Limitations (Non-blocking)

- Sidebar nav: Hardcoded G0–G6 labels (architectural constraint, not critical path)
- This is acceptable for MVP launch

## Post-Deployment Steps

1. Merge v0 branch to main
2. Deploy to Vercel production
3. Verify Moz Farm gate advancement works end-to-end
4. Monitor workflow_events logs for phase transitions
5. Begin testing multi-project workflow

## Next Phase: Testing & Multi-Project

After deployment:
1. Create comprehensive E2E test suite
2. Add multi-project testing scenarios
3. Keep admin-only portal access for MVP
4. Fresh start approach: Simple, focused, admins-only
