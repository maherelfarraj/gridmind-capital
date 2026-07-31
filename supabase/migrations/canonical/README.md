# Canonical Production Baseline — REVIEW AREA (not yet active)

**Status: DRAFT. Nothing in this directory has been executed anywhere.**

These files are a proposed clean-bootstrap reconstruction of the GREOS production
schema (Supabase project `zmahjutrpvwjcmhkiibj`). They are deliberately **outside**
the active migration replay path (`supabase/migrations/*.sql`) until reviewed and
approved by the schema owner.

Production remains authoritative. These files describe production; they do not
define it, and they have never run against it.

---

## 1. Why the tracked migration history is non-replayable

Supabase branch creation replays the **project's tracked migration history** in
`supabase_migrations.schema_migrations` — not the SQL files in this repository.

Production tracks **34** versions (`20260720231703` … `20260728155932`). The
repository's committed migration files (`20260729000002_full_baseline.sql` onward)
are **not tracked at all**: they were applied out-of-band through the SQL Editor.

Replaying that tracked history **fails**. Branch `gridmind-p0-staging-a`
(`nejenmrimyjwhmibbmwc`) ended at `MIGRATIONS_FAILED` with only **10 of 34**
migrations applied — **30 tables against production's 103** — dying at tracked
migration #11, `20260722132129_external_access_foundation`. That branch has since
been deleted.

The drift runs **both ways**: the branch had `profiles` columns production lacks
(`invited_by`, `updated_at`) and lacked columns production has (`locale`,
`digit_style`, `user_type`, `home_role_id`). A branch is a *different lineage*,
not an older snapshot.

Consequence: **production's schema cannot be reproduced from its own migration
history, and no Supabase branch can currently validate a migration against it.**
Repairing history by inserting bare version rows would not help — replay executes
the `statements text[]` array stored on each row, so a row with an empty
`statements` array reproduces nothing.

This baseline exists to break that deadlock: a single deterministic bootstrap that
*can* stand up a faithful empty replica.

## 2. Why these files are not in the active migration path

Adopting them prematurely would be worse than the current situation:

- They have never executed. Their SQL is **statically** validated only (§6).
- Moving them into `supabase/migrations/` changes what a future branch replays,
  which is exactly the mechanism that is currently broken.
- Production already contains every object they create. Running them against
  production would fail immediately (`42P07 relation already exists`) — they are
  written for an **empty** database, not as an idempotent "works on anything"
  hybrid, per the drafting brief.

## 3. What the baseline represents

A **clean-bootstrap, schema-only snapshot of the verified PRE-P0 production state.**

It deliberately does **not** include the pending P0 lockdown. The intended order is:

```
canonical baseline (this directory)
  → 20260731005000_add_profiles_external_org.sql
  → 20260731010000_p0_identity_and_dml_lockdown.sql
```

`profiles.external_org` does **not** exist in production, and the postconditions
assert its absence. The P0 trigger function dereferences `NEW.external_org`, and
plpgsql does not validate record fields at `CREATE` time — so applying P0 without
`…005000` first would apply cleanly and then raise
`record "new" has no field "external_org"` on **every** insert/update to `profiles`.
**That apply order is mandatory.**

## 4. Provenance of each file

Derived from `20260729000002_full_baseline.sql` — a genuine `pg_dump` of
PostgreSQL 17.6, parsed into its 797 object blocks — with every divergence from
live production corrected from read-only catalog introspection.

The dump was **not** trusted on faith. It was measured against production:

| Property | Production | Dump | Result |
|---|---|---|---|
| Tables | 103 | 103 | match |
| Column-name fingerprint (md5, all tables, ordinal order) | `75f6236…` | differs | **1 table drifted** |
| Total columns | 1177 | 1176 | +1 needed |
| Enum types / labels | 18 | 18 | match |
| PK / UNIQUE / FK / CHECK | 103 / 36 / 153 / 72 | 103 / 36 / 153 / 72 | match |
| Indexes | 220 | 81 explicit + 139 constraint-backed | match |
| Triggers (public) | 24 | 24 | match |
| RLS enabled / forced | 103 / 0 | 103 / 0 | match |
| Functions | 28 | 27 | **1 missing** |
| Views | 6 | 4 | **2 missing** |
| Policies | 144 | 136 | **22 differences** |
| Grants | present | none (dumped `--no-acl`) | **all missing** |

Corrections applied, each sourced from production:

1. **`approval_steps.decision_note text`** — the single genuine column drift.
   After the fix, the canonical file's column fingerprint equals production's
   `75f6236686b82ea3fbcab43debe8c619` exactly.
2. **`increment_copilot_usage(integer)`** — exists in production, absent from the
   dump. Captured via `pg_get_functiondef()`. Note it updates
   `copilot_tenant_budget`, which *does* exist; it is unrelated to the
   nonexistent `copilot_usage` table referenced by the quarantined file (§5).
3. **7 stale policies removed** (present in the dump, absent from production):
   `client_reports.client_reports_read`, `profiles.profiles_update_own`, and the
   five `authenticated_all` policies on `departments`, `gates`,
   `gate_approver_defaults`, `gate_role_requirements`, `gate_signoff_templates`.
4. **15 production-only policies added**, captured from `pg_policies`. These
   include the `*_select_tenant` family (`projects`, `approvals`, `notifications`,
   `portal_invoices`, `gate_templates`), which **already exist in production** —
   the P0 migration drops and recreates them, so this is not a conflict.
   129 + 15 = **144**.
5. **All 6 views** taken verbatim from `pg_get_viewdef()`; the dump's 4 were
   discarded in favour of the live definitions.
6. **Grants** reconstructed from `information_schema.role_table_grants`.

### Policy verification went deeper than names

Matching policy *names* is not enough — a policy can keep its name and change its
meaning. Every policy was therefore compared to production on a **normalized
expression fingerprint** (mode + command + roles + `USING` + `WITH CHECK`, with
whitespace and `public.` prefixes removed).

**140 of 144 matched exactly. 4 did not.** Those four are marked in file 4 with a
`BLOCKED` banner and are the main unresolved item (§11).

This check earned its keep: the name-level diff had already passed on all four.
Three of them (`comments_insert_auth`, `comments_select_tenant`,
`gate_templates_select`) grant access when `tenant_id` equals the demo tenant
`00000000-0000-0000-0000-000000000001` — a clause production **no longer has**.
Adopting the dump verbatim would have re-opened a tenancy hole that production had
already closed.

> A caution recorded from this exercise: an early fingerprint run reported *two*
> drifted tables. The second was an artifact of the verification script itself —
> a character class `[a-z0-9_"]` that silently skipped the camelCase column
> `copilot_messages."tableCard"`. The dump had it all along. A verification tool
> that under-reports columns produces false schema drift; the fingerprint is only
> trustworthy because it now reproduces production's md5 byte-for-byte.

### File order (dependency-ordered — run 1 → 6)

| # | File | Contents |
|---|---|---|
| 1 | `20260801000000_schema_types_tables.sql` | schema, 18 enums, 103 tables, 2 identity sequences, comments |
| 2 | `20260801000001_constraints_indexes.sql` | 139 PK/UNIQUE, 153 FK, 81 indexes |
| 3 | `20260801000002_functions_triggers.sql` | 28 functions, 24 triggers, 1 event trigger |
| 4 | `20260801000003_rls_policies_grants.sql` | 103 RLS enables, 144 policies, grants |
| 5 | `20260801000004_views.sql` | 6 views + view grants |
| 6 | `20260801000005_postconditions.sql` | assertions; aborts on any mismatch |

Functions precede policies because policies call `get_my_tenant_id()`,
`current_user_role()` and `is_external_role()`. Views come after tables. Each file
is wrapped in `BEGIN`/`COMMIT` and commits independently.

## 5. Quarantined and misread source files

- **`20260730000005_views_and_rpc.sql` — QUARANTINED. Never applied; cannot be.**
  It selects from `person`, `person_role_assignment`, `project_role`, `task`,
  `task_assignment` and `copilot_usage`, **none of which exist in production**
  (verified with `to_regclass`). It raises `42P01` wherever it runs. Production's
  `v_person_workload` is an entirely different RACI-based view. Nothing in this
  directory derives from that file.

- **`20260730000004_client_viewer_role.sql` — misnamed.** Its body is 12 bare
  `CREATE ROLE` statements — PostgreSQL *database roles*, not application role
  strings. It does **not** create `profiles_role_check`; that CHECK comes from the
  baseline dump. All 12 roles exist in production, so re-running it fails `42710`.

- **`20260729000002_full_baseline.sql`** — accurate for tables/types/constraints
  but stale for policies, views and functions, and carries no grants. Superseded
  here, but retained in the repo as historical evidence.

Old migrations are **not** deleted. They document how production reached its
current state, however imperfectly.

## 6. Repository-only validation performed

Static checks only — see `validation-report.txt` in this directory:

- balanced parentheses and balanced `$$` dollar-quotes per file
- `BEGIN;` / `COMMIT;` boundaries
- no `INSERT`/`UPDATE`/`DELETE` of application data
- no `auth.users` DML
- no production UUIDs or row identifiers
- no references to the six nonexistent tables from the quarantined file
- every function called by a policy is defined in an earlier file
- every policy's target table is defined in an earlier file
- every view's dependencies are defined in an earlier file
- no duplicate object definitions

**No SQL in this directory has been executed. Statement-level validity is
therefore unproven.** Static parsing cannot catch a type mismatch, a bad cast, or
a dependency Postgres resolves at runtime.

## 7. How to validate for real (disposable database)

Do **not** validate by creating a Supabase branch of this project — branch creation
replays the broken tracked history (§1) and fails before your SQL is ever reached.

Use a disposable empty PostgreSQL 17 database with the Supabase roles present:

```bash
psql "$DISPOSABLE_URL" -v ON_ERROR_STOP=1 \
  -c "CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;" \
  -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

for f in supabase/migrations/canonical/2026*.sql; do
  echo "== $f"; psql "$DISPOSABLE_URL" -v ON_ERROR_STOP=1 -f "$f" || break
done
```

File 6 aborts with a detailed diff if anything is off. Note that
`public.handle_new_user()` is created but the `auth.users` trigger that calls it is
**left commented out** (§9).

### Fingerprint comparison

After a successful bootstrap, compare against production directly:

```sql
SELECT md5(string_agg(tbl||':'||sig, E'\n' ORDER BY tbl))
FROM (
  SELECT c.relname AS tbl, string_agg(a.attname, ',' ORDER BY a.attnum) AS sig
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_attribute a ON a.attrelid=c.oid
  WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
  GROUP BY c.relname
) s;
-- expected: 75f6236686b82ea3fbcab43debe8c619
```

## 8. Security facts recorded, deliberately NOT fixed

The baseline must *describe* production, so these are reproduced as-is. Each is a
candidate for a **separate follow-up migration**, never an edit to these files.

1. **`anon` holds `GRANT ALL` on 108 of 109 public relations.** Every table and
   view except `rate_limit_buckets` is fully writable by the anonymous role at the
   privilege layer; **RLS is the only thing standing between an anonymous request
   and arbitrary DML.** Any table whose RLS is disabled or whose policy is
   permissive is immediately exposed.
2. **All four identity helpers grant `EXECUTE` to `PUBLIC` and to `anon`**
   (`is_external_role`, `has_external_access`, `current_user_role`,
   `get_my_tenant_id`). They are `SECURITY DEFINER` and owned by `postgres`. The
   P0 migration's `REVOKE … FROM PUBLIC, anon` is therefore both necessary and
   administrable.
3. **`search_path` is inconsistent across SECURITY DEFINER functions:** some use
   `public, pg_temp`, others only `public`. The brief's preferred
   `pg_catalog, public` is **not** applied here — changing it would alter
   production behaviour inside a file whose only job is to reproduce it.
4. **`v_inbox` has no tenant filter of its own** and depends entirely on the RLS of
   `approvals` and `approval_items`. The views are not `security_invoker`, so they
   execute as their owner (`postgres`) and bypass RLS on their base tables.
5. **26 of 28 functions grant `EXECUTE` to `anon`.**

## 9. Operations requiring the schema owner

These cannot be performed by an ordinary migration role:

1. **`auth.users` signup trigger.** Production has
   `on_auth_user_created AFTER INSERT ON auth.users → public.handle_new_user()`.
   `auth.users` is owned by `supabase_auth_admin`; creating a trigger on it
   normally fails as the migration role. It is left **commented out** in file 3
   with the exact statement to run. **Until it is created, signups do not create a
   `profiles` row** and every new user is unprovisioned.
2. **Object ownership.** All views, functions and the event trigger are owned by
   `postgres` in production. A migration role that is not `postgres` will own what
   it creates. This is not cosmetic: `SECURITY DEFINER` functions execute as their
   owner, and non-`security_invoker` views read as their owner. Realign with
   `ALTER … OWNER TO postgres;`.
3. **Extensions.** `pgcrypto` and `uuid-ossp` (schema `extensions`), `pg_net`
   (registered in `public`), `pg_cron`, `pg_stat_statements`, `supabase_vault`.
   Managed-platform extensions are assumed pre-installed and are not created here.
4. **Applying anything to production** — per `supabase/migrations/README.md`, only
   the schema owner applies migrations. v0 drafts; it does not apply.

## 10. Adoption and rollback

**Adoption** (only after a successful disposable-database run):

1. Review the diff and the security facts in §8.
2. Move the six files into `supabase/migrations/`, keeping their relative order.
3. Decide the fate of the superseded files. Recommended: keep
   `20260729000002_full_baseline.sql` as history, and **delete or clearly mark**
   `20260730000005_views_and_rpc.sql`, which can never run.
4. Reconcile `supabase_migrations.schema_migrations` so tracked history matches the
   files — otherwise §1 recurs. This requires the schema owner and is the real fix
   for branch replay.

**Rollback:** these files have never run, so rollback is `git revert` of the commit
that added this directory. Nothing to undo in any database. If a *disposable*
database was bootstrapped, destroy it — do not attempt to un-apply the files.

---

## 11. Open blockers — this baseline is NOT ready to adopt

### 11.1 Four policies do not match production (BLOCKING)

Marked with a `BLOCKED` banner in
`20260801000003_rls_policies_grants.sql`. Each still carries the **stale dump
text**, retained only so the object is not silently dropped:

| Policy | Problem |
|---|---|
| `comments.comments_insert_auth` | dump allows `tenant_id = '…0001'` (demo tenant); production does not |
| `comments.comments_select_tenant` | same demo-tenant clause |
| `gate_templates.gate_templates_select` | same demo-tenant clause |
| `approval_matrix.approval_matrix_read` | expression drift, cause not yet determined |

Adopting these as-is would **widen access** relative to production. Capture the
live definitions and replace all four before adoption:

```sql
SELECT tablename, policyname, permissive, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname='public'
   AND policyname IN ('approval_matrix_read','comments_insert_auth',
                      'comments_select_tenant','gate_templates_select');
```

The capture query failed because the Supabase MCP became unavailable
(four consecutive failures, including a minimal probe). This is a tooling
outage, not a schema problem — retry later.

### 11.2 Never executed

No statement here has been run anywhere. Static analysis cannot prove a single
`CREATE` succeeds. §7 (disposable database) is mandatory before adoption.

### 11.3 Not covered by the fingerprints

Verified: table/column names and order, object counts, policy expressions,
view definitions. **Not** verified column-by-column: data types, nullability,
defaults, `ON DELETE`/`ON UPDATE` FK actions, and index predicates — these come
from the dump and are only known to be *count*-correct. The postcondition file
checks counts, not shapes.

### 11.4 The demo tenant is a live production fact

19 tables default `tenant_id` to `00000000-0000-0000-0000-000000000001`, and that
tenant row exists in production. Reproduced faithfully, **not** endorsed: a row
inserted without an explicit `tenant_id` silently lands in the demo tenant.
Worth a follow-up decision, separate from this baseline.

---

*Generated 2026-08-01 from read-only introspection of `zmahjutrpvwjcmhkiibj`.
Production was not modified. Migration history was not modified. No Supabase
branch was created.*
