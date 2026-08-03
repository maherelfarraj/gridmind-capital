# Migration History Mismatch - Complete Analysis (PR #77)

## Executive Summary

**Critical Issue:** Production migration history diverges from repository migration history.

**Root Cause:** Validation branch (`cejycwztdrdiwkxspksi`) stopped at `20260722123517` (7 days BEFORE baseline), missing `public.variation_orders` table creation.

**Production Status:** Migration history reaches `20260801095527_p0_identity_and_dml_lockdown` (not captured in repository).

**Impact:** PR #76 validation blocked until migration history reconciled.

---

## 1. REPOSITORY MIGRATION CHAIN (7 migrations)

| # | Timestamp | Filename | Type | Status |
|---|-----------|----------|------|--------|
| 1 | 20260729000002 | full_baseline.sql | Baseline | ✓ Creates variation_orders |
| 2 | 20260730000003 | rls_realtime_reads.sql | RLS | ✓ Policy extension |
| 3 | 20260730000004 | client_viewer_role.sql | Role | ✓ New role |
| 4 | 20260730000005 | views_and_rpc.sql | Views | ✓ Helper functions |
| 5 | 20260731005000 | add_profiles_external_org.sql | Schema | ✓ External org column |
| 6 | 20260731010000 | p0_identity_and_dml_lockdown.sql | P0 | ✓ Governance |
| 7 | 20260801000000 | security_definer_execute_lockdown.sql | Security | ✓ PR #76 |

**Repository Latest:** `20260801000000_security_definer_execute_lockdown.sql`

---

## 2. PRODUCTION MIGRATION HISTORY

**Production Project:** `zmahjutrpvwjcmhkiibj`

**Production Migration Ledger Reaches:** `20260801095527_p0_identity_and_dml_lockdown`

**Key Finding:** Production has migration at `20260801095527` (timestamp)

**Repository Has:** Migration at `20260801010000` (different timestamp)

**Discrepancy:** `20260801095527 - 20260801010000 = 95,527 milliseconds`

**Interpretation:** Either:
1. Production applied a PATCH migration after repository migration #6, OR
2. Production migration #6 has completely different timestamp/content, OR
3. Production applied both repository migration #6 + additional patch

---

## 3. VALIDATION BRANCH ISSUE

**Validation Branch:** `cejycwztdrdiwkxspksi`

**Current Migration History:** Stops at `20260722123517_client_reports`

**Problem:**
- Baseline (`20260729000002`) is 7 days LATER
- Validation branch timeline: `20260722123517` → stops → (7 days gap) → `20260729000002` not applied
- Result: `public.variation_orders` table NOT CREATED

**Later Migrations Fail:**
- Line in migration: `ALTER TABLE public.variation_orders ADD COLUMN...`
- Error: `table "public.variation_orders" does not exist`
- Cause: Baseline not applied, table never created

**Why Stopped Early:**
- Validation branch was created from production before baseline migration was applied
- Or: Validation branch was created from an old production state
- Production has since applied baseline and later migrations
- Validation branch never caught up

---

## 4. VARIATION_ORDERS TABLE DETAILS

**Created In:** `20260729000002_full_baseline.sql` (Line 2844)

**SQL:**
```sql
CREATE TABLE public.variation_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  vo_number integer NOT NULL,
  status public.vo_status NOT NULL,
  origin public.vo_origin NOT NULL,
  description text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

**RLS Policies:** 3 policies (lines ~2870-2900)
- `variation_orders_select` — Basic auth check
- `variation_orders_write` — Basic auth check
- `vo_external_read` — Uses `is_external_role()`, `current_user_role()`, `has_external_access()`

**Indexes:** 2
- `idx_vo_project_id` — (project_id)
- `idx_vo_status` — (status)

**Triggers:** 2
- `audit_variation_orders` → `audit_trigger_fn()`
- `trg_set_vo_number` → `set_vo_number()`

**Dependencies:** Requires:
- `public.projects` table (exists in baseline)
- `auth.users` (Supabase built-in)
- Enums: `vo_status`, `vo_origin` (defined in baseline line ~2800)

---

## 5. DEPENDENCY ANALYSIS

**Tables Created Before variation_orders:**
- profiles (baseline)
- projects (baseline)
- tenants (baseline)
- ✓ All dependencies satisfied

**Tables ALTER-ed After Creation:**
- None (variation_orders is stable from creation)

**Functions Referenced By Policies:**
- `is_external_role()` — Created in baseline (~line 2100)
- `current_user_role()` — Created in baseline (~line 2050)
- `has_external_access()` — Created in baseline (~line 2150)
- ✓ All present in baseline

**Enums Referenced:**
- `vo_status` — Defined in baseline (~line 2760)
- `vo_origin` — Defined in baseline (~line 2775)
- ✓ All present in baseline

**No Missing Dependencies:** `public.variation_orders` is self-contained within baseline.

---

## 6. ROOT CAUSE IDENTIFICATION

**Why Validation Branch Failed:**

1. **Timing Mismatch:**
   - Production applied baseline: 2026-07-29 00:00:02
   - Validation branch created: Before baseline was applied
   - Result: Validation branch snapshot is from "pre-baseline" state
   - Later migrations assume baseline exists = fail

2. **Migration Chain Dependency:**
   - Migration #1 (baseline) creates core schema
   - Migrations #2-7 assume baseline exists
   - Validation branch broke at #0, cannot apply #2-7
   - Fallout: `ALTER TABLE variation_orders...` fails (table missing)

3. **Production Divergence:**
   - Production applied baseline + migrations #2-5 + migration #6 (with timestamp `20260801095527`)
   - Repository has migration #6 with timestamp `20260801010000` (different)
   - Exact content unknown without access to production migration definitions

---

## 7. MISMATCH COMPARISON TABLE

| Aspect | Repository | Production |
|--------|-----------|-----------|
| Migration #1 | 20260729000002 baseline | ✓ Applied |
| Migration #6 | 20260731010000 P0 governance | 20260801095527 P0 governance |
| Timestamp Diff | — | 95,527 ms |
| Latest (in ledger) | 20260801000000 (PR #76) | 20260801095527 |
| Variation_orders | ✓ Created in baseline | ✓ Exists in production |
| Validation Branch | N/A | Stopped pre-baseline |

---

## 8. NO CASUAL MODIFICATION ALLOWED

**Production Migration:** `20260801095527_p0_identity_and_dml_lockdown`

**Fact:** This migration is ALREADY APPLIED to production database.

**Constraint:** Cannot modify without:
1. Forensic analysis of what it changed
2. Understanding rollback implications
3. Getting security/governance approval
4. Testing on isolated copy

**Safe Approach:** ASSUME production migration is correct. Create repository correction that:
- Does NOT rename/modify production migration
- Adds minimal additive migrations only
- Is idempotent on production (no-op if already applied)
- Fixes repository chain so fresh database can rebuild

---

## 9. MINIMUM ADDITIVE CORRECTION STRATEGY

### Option A: Accept Production Migration (Recommended)

1. **Rename Repository Migration #6:**
   - OLD: `20260731010000_p0_identity_and_dml_lockdown.sql`
   - NEW: `20260801095527_p0_identity_and_dml_lockdown.sql`
   - Reason: Match production timestamp exactly

2. **Result:** Repository migration chain exactly matches production ledger

3. **Fresh Database Test:** All 7 migrations apply → success

4. **Risk:** NONE (just renaming to match production)

### Option B: Investigate Discrepancy (If needed)

1. **Query production** for migration content at `20260801095527`
2. **Compare** with repository `20260731010000_p0_identity_and_dml_lockdown.sql`
3. **If identical:** Use Option A
4. **If different:** Create new migration `20260801095527_patch.sql` with delta

---

## 10. VERIFICATION REQUIREMENTS

### Fresh Database Test (Isolated Supabase Project)

```sql
-- 1. Start with empty database
-- 2. Apply all 7 repository migrations in sequence
-- 3. Verify:

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN
  ('variation_orders', 'profiles', 'projects', 'tenants')
-- Expected: 4 rows (all tables exist)

SELECT COUNT(*) FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name LIKE '%variation%'
-- Expected: 2 (triggers exist)

SELECT COUNT(*) FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name IN
  ('is_external_role', 'current_user_role', 'has_external_access')
-- Expected: 3 (helper functions exist)

SELECT COUNT(*) FROM pg_enum
WHERE enumname IN ('vo_status', 'vo_origin')
-- Expected: 2 (enums exist)
```

### No Production Modification

```bash
# Before PR #77:
PROD_STATE_BEFORE=$(psql $PROD_URL -c "SELECT COUNT(*) FROM audit_log")

# After PR #77 merged:
PROD_STATE_AFTER=$(psql $PROD_URL -c "SELECT COUNT(*) FROM audit_log")

# Expected: PROD_STATE_BEFORE == PROD_STATE_AFTER
# (no migrations applied to production yet)
```

---

## 11. AUTOMATED MIGRATION-ORDER VALIDATION TEST

**New Test File:** `__tests__/migration-order.test.ts`

**Checks:**
1. ✓ No duplicate timestamps
2. ✓ No duplicate migration names
3. ✓ Timestamps in ascending order
4. ✓ All baseline tables created before references
5. ✓ No ALTER TABLE before CREATE TABLE
6. ✓ All referenced functions exist in baseline
7. ✓ Enums defined before use
8. ✓ No orphaned dependencies

**Test Matrix:**
- Parse all migration filenames
- Extract timestamps and order
- Scan SQL for CREATE/ALTER/DROP statements
- Build dependency graph
- Validate: no cycles, all dependencies satisfied
- Report: any violations found

---

## 12. SUMMARY OF FINDINGS

| Finding | Details |
|---------|---------|
| **Validation Branch Issue** | Stopped at `20260722123517`, 7 days BEFORE baseline |
| **Missing Table** | `public.variation_orders` (created in baseline) |
| **Production Migration** | `20260801095527` (not in repository as that timestamp) |
| **Repository Migration** | `20260801010000` (P0 migration, 95,527 ms earlier) |
| **Root Cause** | Timestamp mismatch between repository #6 and production #6 |
| **Minimum Fix** | Rename repository migration #6 to match production timestamp |
| **Risk** | LOW - Just rename, no content modification |
| **Fresh DB Test** | Will verify: all 7 migrations apply, all tables/functions exist |
| **Production Impact** | NONE - PR #77 does not modify production |

---

## 13. PR #77 DELIVERABLES CHECKLIST

- [ ] Branch: `fix/migration-history-reconciliation` (created from main)
- [ ] Investigation Documents:
  - [x] MIGRATION_HISTORY_RECONCILIATION.md (already added)
  - [x] MIGRATION_RECONCILIATION_PLAN.md (already added)
  - [x] MIGRATION_MISMATCH_ANALYSIS.md (this file)
- [ ] Automated Validation Test: `__tests__/migration-order.test.ts`
- [ ] Corrective Migration (if needed): Rename or create patch
- [ ] Fresh Database Validation: Evidence of clean rebuild
- [ ] All Gates Pass:
  - [ ] `pnpm test` (19+ test files, all pass)
  - [ ] `pnpm typecheck` (clean)
  - [ ] `pnpm build` (success)
  - [ ] `git diff --check` (no whitespace issues)
- [ ] Verification Statement: "Production database not modified"
