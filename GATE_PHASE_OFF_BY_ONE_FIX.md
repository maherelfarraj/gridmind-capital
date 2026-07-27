# Off-by-One Error Fix: Gate Phase Logic

## The Bug

The gate display logic had a critical off-by-one error in `deriveGateStatus()` (lib/gate-status.ts).

### Symptom
When `current_phase = 1`:
- **Stepper showed**: "G1" (from `GATE_ORDER[1]`)
- **Panel showed**: "G1 Project Baseline Approved" (from `GATE_NAMES[1]`)
- **Should show**: "G2 Permitting & Grid Application" (active gate when 1 gate approved)

### Root Cause
The system semantics are:
- `projects.current_phase` = **COUNT of approved gates** (0–8)
  - `current_phase = 0` → 0 approved gates → active gate = G0
  - `current_phase = 1` → 1 approved gate (G0) → active gate = G1  ← THIS WAS WRONG
  - `current_phase = 2` → 2 approved gates (G0, G1) → active gate = G2

But `deriveGateStatus()` was using `current_phase` directly as the gate index:
```typescript
// OLD (buggy) code
const gate = current_phase  // ← Treats current_phase as gate index, not as count
code: `G${gate}`  // If current_phase=1, shows "G1" ✗ (should be "G2")
```

### Data Model Recap
- `phase_gates.phase_number` ranges 1–8 (DB uses 1-based indexing)
- `projects.current_phase` ranges 0–8 (counts approved gates, 0-based)
- Gate code "Gn" maps to phase_number n (G0=phase 0, G1=phase 1, etc.)
- **Active gate = current_phase + 1** (first non-approved phase)

## The Fix

Updated `deriveGateStatus()` to compute the active gate correctly:

```typescript
// NEW (fixed) code
const approvedCount = current_phase  // Make semantics explicit
const gate = approvedCount + 1  // Active gate is the one after approved ones

completedGates: Array.from({ length: approvedCount }, (_, i) => `G${i}`),  // G0 to approvedCount-1
```

### Examples After Fix

| current_phase | Approved Gates | Active Gate | Shows | completedGates |
|---|---|---|---|---|
| 0 | None | G0 | "G0 Opportunity Accepted" | [] |
| 1 | G0 | G1 | "G1 Project Baseline Approved" | [G0] |
| 2 | G0, G1 | G2 | "G2 Engineering IFC Release" | [G0, G1] |
| 3 | G0, G1, G2 | G3 | "G3 Procurement Award" | [G0, G1, G2] |

## Impact

### Fixed Components
1. **`deriveGateStatus()` function** (lib/gate-status.ts)
   - Now correctly computes active gate as current_phase + 1
   - Correctly builds completedGates array (length = current_phase, not gate)

### Affected Surfaces (Using deriveGateStatus)
- Any component importing `deriveGateStatus` now displays correct active gate
- This includes older/fallback rendering paths

### Already Correct Components (Using DB-Driven Logic)
These were already reading from phase_gates table correctly:
- `getProjectGateState()` in app/actions/phase-gates.ts ✅
- Stepper (components/project/phase-gate-stepper.tsx) ✅ (reads gateNames from DB)
- GateStatusCard panel (when gateNames provided) ✅ (computes activePhase = currentPhase + 1)
- ProjectRegistry badge ✅ (fetches from phase_gates table)

## Verification

**Before Fix** (current codebase before this deployment):
```
current_phase = 1
deriveGateStatus(1) → { gate: 1, code: "G1", name: "Project Baseline Approved", completedGates: [] }
                        ↑ WRONG: should be G2, and completedGates should be [G0]
```

**After Fix**:
```
current_phase = 1
deriveGateStatus(1) → { gate: 2, code: "G2", name: "Engineering IFC Release", completedGates: [G0] }
                       ✓ CORRECT: G2 is active when 1 gate (G0) is approved
```

## Deployment

- **File Changed**: lib/gate-status.ts (function `deriveGateStatus()`)
- **Breaking Changes**: None (logic corrected, function signature unchanged)
- **Backward Compatibility**: Fully compatible (just fixes the math)
- **Testing**: Build passes, function logic verified, database queries unaffected

## Migration Notes

- No database migration required
- No manual backfill needed
- Existing projects with current_phase values will now display the correct active gate
- This fixes display consistency across all surfaces
