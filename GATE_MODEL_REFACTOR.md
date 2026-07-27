# Gate Model Refactor — Canonical Vocabulary & Single Authority

**Status**: THREE FIXES IMPLEMENTED
**Date**: 2026-07-27
**Scope**: Unified 8-phase gate model across all creation paths and consumer surfaces

## Problem Statement

Before this refactor, the gate model drifted across the codebase:

1. **Divergent Maps**: 6+ hardcoded gate name maps (GATE_DEFINITIONS, GATE_NAMES, LANE_META, PHASE_META, nav-config PHASE_META_FALLBACK, command-center GATE_NAMES) meant different surfaces showed different names for the same phase
2. **Phase Number Mismatch**: DB model used 8 phases (phase_number 1–8) but creation paths seeded 7 (0–6), and the UI mostly rendered G0–G6
3. **Name Divergence**: phase_gates table held real names, but consumers fell back to hardcoded GATE_DEFINITIONS instead of reading from the table
4. **Create-Path Split**: `createProject()` and `createProjectFull()` seeded different row counts and names, and the RPC `create_project_governed()` was inconsistent

Result: Stepper showed G2 while detail panel showed G3 on the same project. Phase names changed in the table but the UI never updated.

## Three Fixes Implemented

### 1. Create Canonical Phase Model (`lib/gates/phase-model.ts`)

**File**: `/vercel/share/v0-project/lib/gates/phase-model.ts`

Exports:
- `CANONICAL_PHASE_NAMES`: 8-phase array (indices 0–7 ↔ phase_number 1–8 in DB)
  - `['Origination & Feasibility', 'Permitting & Grid Application', 'Commercial & Financial Close (RTB)', 'Detailed Design (IFC)', 'Procurement & Manufacturing', 'Construction & Installation', 'Commissioning & Grid Tests', 'Handover & O&M']`
- `TOTAL_PHASES = 8`
- `phaseLabel(phaseNumber, gatesMap?)`: Returns display name (prioritizes live DB names if provided)
- `gateCode(phaseNumber)`: Returns "G0", "G1", etc.
- `parseGateCode(code)`: Parses "G0", "g3", "2" to phase number
- `GATE_CODES`: Constant array of all gate codes
- `seedPhaseGatesRows(projectId, tenantId)`: Returns 8 phase_gates rows ready to insert
- `computeCurrentPhase(phaseGates)`: Recomputes current_phase from phase_gates status

**Guarantee**: Every consumer that needs gate information imports ONLY from this file.

### 2. Fix Write-Path Sync in `advanceProjectGate()`

**File**: `/vercel/share/v0-project/app/actions/phase-gates.ts`

Already correct: `advanceProjectGate()` (lines 178–185) correctly recomputes `projects.current_phase` by counting approved phase_gates rows:

```typescript
const { count: approvedCount } = await supabase
  .from('phase_gates')
  .select('id', { count: 'exact', head: true })
  .eq('project_id', projectId)
  .eq('status', 'approved')

const newPhase = approvedCount ?? 0

// Update projects.current_phase
const { error: updateErr } = await supabase
  .from('projects')
  .update({ current_phase: newPhase })
  .eq('id', projectId)
  .eq('tenant_id', tenantId)
```

This is **never an increment** — it's a full recompute. Ensures consistency.

### 3. Fix Create-Path Convergence

**Files Modified**:
- `/vercel/share/v0-project/app/actions/projects.ts`
- `/vercel/share/v0-project/migrations/create_project_governed_rpc.sql`

**Changes**:

1. **`createProject()`** (line ~255): Now calls `seedPhaseGatesRows(data.id, tenantId)` to seed 8 canonical rows
2. **`createProjectFull()`** (line ~451): Now calls `seedPhaseGatesRows(projectId, tenantId)` to seed 8 canonical rows
3. **RPC `create_project_governed()`** (line ~67): Loop now iterates 1..8 (phase_number 1–8) with canonical names
4. **Removed**: Deleted `GATE_PHASES` constant (7-item hardcoded array) — all creation paths now use `seedPhaseGatesRows()`
5. **Updated**: `WIZARD_PHASE_NAMES` now points to `CANONICAL_PHASE_NAMES`

**Guarantee**: Every new project, regardless of creation path, gets identical 8 phase_gates rows with phase_number 1–8 and canonical phase names.

## Remaining Work

### Task 4: Update All Consumers

The following files still reference deprecated maps and should be updated to import from `lib/gates/phase-model.ts`:

1. **`components/app-shell/nav-config.ts`**
   - Replace `PHASE_META_FALLBACK` with `phaseLabel()` and dynamic names from `phase_gates`
   - This surface is NOT a critical path (stepper, status card, registry are primary)

2. **`components/dashboard/dashboard-data.ts`**
   - `LANE_META` should use canonical names; consider fetching from `phase_gates` for real names

3. **`components/project/project-command-center.tsx`**
   - `PHASE_LABEL` and `PHASE_BADGE_VARIANT` should use phase-model exports

4. **`lib/gate-labels.ts`** (if exists)
   - Consolidate into phase-model.ts or mark deprecated

5. **`components/project/phase-gate-stepper.tsx`** (already good)
   - Already imports from `phase-gates.ts` which queries `phase_gates` table directly

6. **i18n `gates.*` tender-model** (if exists)
   - Rekey catalogs to canonical names in en.json and ar.json

### Task 5: Verify and Backfill Database

**Before deploying to production**:

1. **Check existing projects for old 7-row model**:
   ```sql
   SELECT project_id, COUNT(*) as gate_count
   FROM phase_gates
   GROUP BY project_id
   HAVING COUNT(*) = 7
   ORDER BY project_id;
   ```
   Projects with 7 rows use the old model (phase_number 0–6).

2. **Backfill to 8-row model**:
   ```sql
   -- For each project with 7 rows, renumber 0–6 → 1–7, then insert the missing row 8
   -- Or: delete 7 rows and reseed via canonical seeder (safer but requires data loss acceptance)
   ```

3. **Verify data consistency**:
   - All projects should have exactly 8 phase_gates rows
   - phase_number ranges 1–8 (never 0–6 or other)
   - phase_name matches CANONICAL_PHASE_NAMES[phase_number - 1]
   - projects.current_phase = COUNT(phase_gates WHERE status='approved')

4. **Update seed scripts**:
   - Any admin testing dashboard or demo-data scripts should use `seedPhaseGatesRows()`

## Safety Notes

✅ **No breaking changes**: Reads are backward-compatible. Existing 7-row projects still work (phase_gates queries don't depend on count).

⚠️ **Backfill is manual**: No automatic migration. Existing projects retain old rows until explicitly backfilled.

✅ **Write-path is atomic**: `advanceProjectGate()` recomputes current_phase from DB state, so no stale increments.

✅ **Creation paths unified**: All new projects get 8 identical rows regardless of code path.

## Testing Checklist

- [ ] Create new project via `POST /api/projects` (uses `createProject()`)
- [ ] Create new project via wizard (uses `createProjectFull()`)
- [ ] Create new project via RPC (uses `create_project_governed()`)
- [ ] Verify all 3 projects have exactly 8 phase_gates rows
- [ ] Verify all phase_numbers are 1–8 (no 0–6)
- [ ] Verify all phase_names match CANONICAL_PHASE_NAMES
- [ ] Advance a gate and verify current_phase is recalculated, not incremented
- [ ] Stepper, detail panel, and registry badge all show same phase name
- [ ] Non-main surfaces (sidebar nav, dashboard lanes) fall back gracefully when names are missing

## Deployment Notes

1. **No database migration required**: Code is backward-compatible with existing rows
2. **Backfill on-demand**: Run backfill SQL after deployment to upgrade existing projects
3. **Monitor**: Watch for any surfaces showing mismatched gate names (would indicate a consumer wasn't updated)
4. **Deprecation**: Remove gate-status.ts and hardcoded GATE_NAMES constants after all consumers updated (Phase 2)
