# GridMind Capital - Implementation Roadmap

Complete sequence for merging all four feature PRs to production.

---

## Phase 1: Foundation Features (COMPLETE ✅)

### PR #74: Secure Self-Profile Editing
- **Status:** ✅ MERGED
- **Changes:** Secure profile self-editing (full_name only)
- **Files:** 4 changed (+487/-60 lines)
- **Tests:** 265 passed
- **Date:** 2026-08-02

### PR #75: Fail-Closed Self-Signup
- **Status:** ✅ MERGED
- **Changes:** Fail-closed signup flow with database trigger
- **Files:** 5 changed (+793 lines)
- **Tests:** 342 passed
- **Date:** 2026-08-02

---

## Phase 2: Migration Reconciliation (CURRENT ⏳)

### PR #77: Migration History Reconciliation
- **Status:** ✅ PUSHED, Awaiting merge
- **Branch:** `fix/migration-history-reconciliation`
- **Commits Ahead:** 3
- **Changes:**
  - Renamed migration: 20260731010000 → 20260801095527
  - Added `MIGRATION_MISMATCH_ANALYSIS.md` (+317 lines)
  - Added `__tests__/migration-order.test.ts` (+279 lines)
  - Updated test references
- **Tests:** 19 test files passed (327 total)
- **TypeScript:** Clean
- **Build:** Success
- **Risk:** MINIMAL (rename only, no content change)
- **Production Impact:** ZERO

**Required Before Merge:**
- [ ] Run Phase 1-7 validation checklist (see `PR_77_VALIDATION_CHECKLIST.md`)
- [ ] Verify fresh database replay succeeds
- [ ] Confirm all 7 migrations apply cleanly
- [ ] Verify tables and functions exist
- [ ] Sign off on validation

**Approval Gate:** All Phase 1-7 validation checkboxes complete

---

## Phase 3: Security Hardening (BLOCKED ⏳)

### PR #76: SECURITY DEFINER Execute Lockdown
- **Status:** ⏳ BLOCKED (awaiting PR #77 merge)
- **Branch:** `fix/security-definer-execute-lockdown`
- **Commits Ahead:** 2
- **Changes:**
  - Revoke PUBLIC/anon/authenticated EXECUTE on 14 SECURITY DEFINER functions
  - Grant supabase_admin and service_role
  - Migration: `20260801000000_security_definer_execute_lockdown.sql`
  - Added validation procedures and real SQL tests
- **Tests:** 342 passed
- **TypeScript:** Clean
- **Build:** Success

**Blocked Until:**
1. PR #77 merges
2. Validation branch reset with correct baseline
3. Fresh database reaches migration 20260801095527

**Required Before Merge:**
- [ ] Execute Phase 1-9 validation procedures (see `SECURITY_DEFINER_VALIDATION_PLAN.md`)
- [ ] Test RLS policy evaluation after EXECUTE revocation
- [ ] Document all Phase 1-9 results
- [ ] If RLS policies fail: Retain authenticated EXECUTE grants (acceptable)
- [ ] Sign off on validation

**Critical Test:** Phase 3 - RLS policy evaluation
- Must verify current_user_role() and current_user_org() work in policy context
- If policies fail: Retain EXECUTE grants (still hardens PUBLIC/anon)

**Approval Gate:** All Phase 1-9 validation checkboxes complete

---

## Merge Sequence (Non-Negotiable Order)

```
1. PR #77 (Migration Reconciliation)
   └─ Validates Phase 1-7 checklist
   └─ Fresh database replay succeeds
   └─ Repository migration history reconciled

2. PR #76 (Security DEFINER Lockdown) — After PR #77 merges
   └─ Validates Phase 1-9 checklist
   └─ RLS policies verified
   └─ 14 SECURITY DEFINER functions hardened
```

---

## Timeline

| Phase | PR | Status | Est. Start | Est. Complete |
|-------|----|----|--------|---------|
| Phase 1 | #74 | ✅ MERGED | 2026-08-02 | 2026-08-02 |
| Phase 1 | #75 | ✅ MERGED | 2026-08-02 | 2026-08-02 |
| Phase 2 | #77 | ⏳ PENDING | NOW | TBD |
| Phase 3 | #76 | ⏳ BLOCKED | After #77 | TBD |

---

## Validation Checkpoints

### PR #77 Checkpoint (Before Merge)
1. **Repository Migration Replay** (7 migrations)
   - Run: All migrations apply cleanly
   - Verify: No errors, no warnings
   - Confirm: Tables and functions exist

2. **Critical Tables**
   - public.profiles (103 columns total, 8 for profiles)
   - public.variation_orders (created and altered successfully)
   - public.projects
   - public.tenants

3. **Functions & Policies**
   - 28 functions
   - 24 triggers
   - 144 RLS policies
   - 6 SECURITY INVOKER views

### PR #76 Checkpoint (After PR #77 Merges)
1. **RLS Policy Evaluation** (CRITICAL)
   - Test authenticated user SELECT with current_user_role() in policy
   - Expected: Rows visible (policy works)
   - If fails: Retain EXECUTE grants on helper functions (acceptable)

2. **Audit Triggers**
   - Test INSERT/UPDATE/DELETE on audited table
   - Verify audit_log row created before and after migration

3. **Rate Limiting**
   - Verify consume_rate_limit accessible to infrastructure
   - Confirm no authenticated workflows broken

4. **Governance Rules**
   - Verify gm_rule_b1-b10 metadata-only (not executed)
   - Confirm no application code changes needed

---

## Risk Assessment

### PR #77 Risk: MINIMAL
- Single file rename (no content modification)
- No migration SQL changes
- No production database modification
- Tests validate migration chain
- Rollback: Simple (rename file back)

### PR #76 Risk: LOW
- RLS policies may require EXECUTE grants retained
- Acceptable outcome if grants needed
- Audit triggers unaffected (trigger context)
- Rate limiting preserved
- Rollback: Revert REVOKE statements to GRANT

---

## Success Criteria

**PR #77 Merge Success:**
- [ ] Fresh database replay: 7 migrations apply cleanly
- [ ] All tables exist with correct schemas
- [ ] All functions and policies created
- [ ] Migration ledger reaches 20260801095527
- [ ] Zero production database modifications

**PR #76 Merge Success:**
- [ ] All Phase 1-9 validation procedures pass
- [ ] RLS policies work after EXECUTE revocation
- [ ] Audit triggers fire before and after
- [ ] No authenticated user workflows broken
- [ ] Security hardening complete

---

## Documentation References

- `MIGRATION_MISMATCH_ANALYSIS.md` — Root cause analysis
- `PR_77_VALIDATION_CHECKLIST.md` — Pre-merge validation procedures
- `SECURITY_DEFINER_VALIDATION_PLAN.md` — PR #76 Phase 1-9 procedures
- `SECURITY_DEFINER_AUDIT.md` — Privilege matrix and risk assessment

---

**Status:** Roadmap ready. Awaiting PR #77 validation checklist completion.
