# Canonical Production Baseline — REVIEW AREA (not yet active)

**Status: DRAFT. Executed once on a disposable database; never against production.**

These files are a proposed clean-bootstrap reconstruction of the GREOS production
schema (Supabase project `zmahjutrpvwjcmhkiibj`). They are deliberately **outside**
the active migration replay path (`supabase/migrations/*.sql`) until reviewed and
approved by the schema owner.

Production remains authoritative. These files describe production; they do not
define it, and they have **never run against it**.

---

## 0-A. Execution-correction pass — 2026-08-01 (six defects)

The baseline was **run for the first time** on a disposable
`supabase/postgres:17.6.1.158` container (the exact production PostgreSQL
version). **It did not bootstrap.** Six defects were found — two of them
security-relevant, and neither detectable by reading the files. All six are now
corrected.

| # | Defect | Severity | Where | Correction |
|---|--------|----------|-------|------------|
| D1 | `CREATE SCHEMA public;` failed `42P06` on **statement 1 of 1784**. An "empty" database still has `public` — `initdb` creates it. There was no target on which this could ever have succeeded. | blocker | `…0000` | Replaced with a fail-loud precondition block that verifies `public`, its owner, `auth.users`, the three platform roles, and that `public` is empty. |
| D2 | Grants on the 6 views ran **before the views existed** (`42P01`), because they sat in file `…0003` while the views are created in `…0004`. | blocker | `…0003` → `…0004` | 18 statements relocated after the view definitions; ownership set before grants. Dynamic `DO`-block grant loop deleted in favour of explicit enumeration. |
| **D3** | **`rate_limit_buckets` was granted `arwdDxtm` to `anon` and `authenticated`** — full DML on the rate-limit table for the anonymous role. | **security** | `…0003` | Explicit `REVOKE`. See below. |
| **D4** | **`anon` could `EXECUTE increment_copilot_usage`** despite `REVOKE ALL … FROM PUBLIC`. | **security** | `…0003` | Added `REVOKE … FROM anon`. See below. |
| D5 | A postcondition compared `format('%s', <boolean>)` against `'row=true,before=false,…'`. PostgreSQL renders booleans as `t`/`f`, so the check **could never pass** — it reported a correct trigger as drifted. | false failure | `…0005` | Each `tgtype` bit now asserted as a boolean expression; text used only in the diagnostic message. |
| D6 | Signup was **100% broken**: `handle_new_user()` hardcodes tenant `…0001`, `profiles.tenant_id` has an FK to `tenants`, and the baseline seeds no tenants. The `AFTER INSERT` trigger aborts the whole `auth.users` insert (`23503`) → 0 users, 0 profiles. | blocker | documented | Recorded as an operational prerequisite + disposable test procedure in `…0005`. No seed data added — see below. |

### The lesson from D3 and D4: absence is not denial

Both security defects came from one plausible-sounding but **false** premise:

> *"The bootstrap target is empty, so there is no grant to revoke, and emitting a
> `REVOKE` would create an ACL production does not have."*

The target is empty of **tables** — not of **default privileges**. The
`supabase/postgres` image ships `ALTER DEFAULT PRIVILEGES` records granting
`arwdDxtm` on every new table and `EXECUTE` on every new function in `public` to
`anon`, `authenticated` and `service_role`. Those are active *before* the first
`CREATE TABLE`. A new object is therefore born with that ACL, and **omitting a
statement grants everything rather than nothing.**

D4 adds a second trap: `REVOKE … FROM PUBLIC` **does not remove an explicit
per-role grant**. `PUBLIC` is its own pseudo-grantee, not a superset covering
named roles, so the image's explicit `anon=X` entry survived a `PUBLIC` revoke.

Both were caught by postconditions that already existed (103 granted tables vs
102 expected; 9760 column-privilege rows vs 9720 — a surplus of exactly
5 columns × 2 roles × 4 privileges). **This is the second time a correct
postcondition sat unexecuted beside the defect it was capable of catching.
Postconditions are worthless until something runs them.** New `aclexplode`-based
assertions now inspect the *stored* ACL, not just the effective answer.

### What D6 does not change

`handle_new_user()` is reproduced **verbatim from production**, hardcoded tenant
and all, and production has that tenant row — so production signups work. The
failure is a property of bootstrapping an empty database, not a defect introduced
here. Neither the function nor a seed row was added: changing the function would
stop the baseline describing production, and a tenant row is business data, not
schema. It is documented as a **deployment prerequisite** with a reversible test
procedure instead.

With the prerequisite tenant present, all 11 signup assertions pass — including
`role = 'viewer'`, confirming the earlier F1 escalation fix by execution.

### Also corrected

- **Foreign keys: production has 153, not 128.** The reconciliation report's 128
  matched no rule that was ever run and was nonetheless labelled "all match". The
  local bootstrap's 153 was right all along. Re-verified read-only against
  production under six counting rules, which agree at 153 (145 `public`→`public`
  + 8 → `auth.users`).
- **One column fingerprint, one formula.** Two non-comparable column hashes
  existed; the weaker name-and-order-only hash
  (`75f6236…`) is retired and its assertion deleted. Canonical values, each
  recorded beside its formula: columns `0b1a44c861bb61cc6ca26dee3f63db02`,
  FKs `f061c43fcdf08eccae779b7bcabe6ac6`.

### Verification status

Repository checks pass: **161/161 tests**, typecheck clean, build clean. A static
scanner (comment- and dollar-quote-aware) confirms no `CREATE SCHEMA public`, no
view reference before creation, no executable DML, and balanced transactions in
all six files.

**Superseded 2026-08-01 — the clean re-run has now happened.** It found two more
defects (**D7**, **D8**), both in `…0005_postconditions.sql`; see §0-B. With those
fixed, **all six files execute end-to-end and COMMIT** on a disposable
`supabase/postgres:17.6.1.158` container. D1–D6 are execution-proven fixed.

---

## 0-B. Postcondition-correction pass — 2026-08-01 (D7, D8)

The clean re-run proved files `…0000`–`…0004` all COMMIT and D1–D6 fixed.
`…0005_postconditions.sql` was the **only** remaining failure, for two reasons.

| # | Defect | Severity | Status |
|---|--------|----------|--------|
| D7 | FK fingerprint assertion raised `42725 operator is not unique: text \|\| "char"`. `confmatchtype` / `confupdtype` / `confdeltype` are pg_catalog's internal `"char"` type. The parse-time error aborted the whole file, so **the assertion had never executed once**. | blocker | fixed |
| D8 | `SET client_min_messages = warning` silenced every `RAISE NOTICE`. Since no production grant fingerprint exists, those notices are the *only* output for the privilege dimension — a passing run printed nothing but `BEGIN/SET/SET/DO/COMMIT`. | usability | fixed |

**D7 fix — three casts, nothing else:**

```sql
-- before
||'|'||co.confmatchtype||'|'||co.confupdtype||'|'||co.confdeltype
-- after
||'|'||co.confmatchtype::text||'|'||co.confupdtype::text||'|'||co.confdeltype::text
```

The formula, field order and expected hash are unchanged — a cast changes
operator resolution, not the rendered value. Confirmed: the hash reproduces the
production value exactly.

**D8 fix:** `SET LOCAL client_min_messages = notice` (and `SET LOCAL
statement_timeout = 0`). `notice` is *below* `warning`, so this can only reveal
more — no error or warning behaviour is weakened. `SET LOCAL` additionally keeps
both settings inside the transaction; the previous statements were session-level
and leaked past `COMMIT`.

### Why D7 survived the previous pass

The earlier scan used a **hand-written list** of `"char"` columns that happened to
omit the `conf*` family, so it returned a confident, false "0 found". The list is
now derived from the catalog itself:

```sql
SELECT c.relname||'.'||a.attname FROM pg_attribute a
JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='pg_catalog' AND a.atttypid='"char"'::regtype
  AND a.attnum>0 AND NOT a.attisdropped;
```

45 such columns exist in PG 17.6. Scanning all six files against that list found
**3 unsafe** (the three now fixed) and **26 safe** — `relkind` (17), `contype` (5),
`attidentity`, `attgenerated`, `typtype`, `tgenabled`. The safe ones are
comparisons against a `"char"` literal (`relkind='r'`), which resolve
unambiguously and **must not** be cast.

> **Scanner trap, recorded because it nearly hid the defect again:** the first
> version of this audit stripped dollar-quoted bodies before scanning — and this
> file is one large `DO $$ … $$` block, so stripping removed essentially the whole
> file and reported "0 unsafe". *A scan whose match count collapses to near zero
> is reporting a broken parser, not a clean file.* Run it on raw text with only
> line comments removed.

### Execution result

All six files COMMIT. 103 tables, 6 views, 18 enums, 28 functions, 24 triggers,
144 policies, 220 indexes, **153 FKs**, **1177 columns**; FK fingerprint
`f061c43f…6ac6` and column fingerprint `0b1a44c8…db02` both match production.
Signup passed 13/13 plus cleanup. `P-FK1` was **mutation-tested** — dropping
`profiles_tenant_id_fkey` makes it fail and report the changed hash, proving it is
live rather than merely silent.

Diagnostics now visible: **4**, not the 6 anticipated. The relation ACL
fingerprint covers `relkind IN ('r','v','S')`, so sequences are included in it
rather than hashed separately, and no schema- or function-level ACL hash was ever
written. Nothing is suppressed — the expected count was wrong, not the file. No
fingerprint was invented to reach six.

P0 was correctly **not** applied. The three `supabase_admin` default ACLs remain
platform actions.

---

## 0. Shape-correction pass — 2026-08-01

A value-by-value reconciliation against production
(`shape-reconciliation-report.txt`) found **four defects** in this baseline. All
four have now been corrected in the SQL.

> **Superseded in part by section 0-A above.** When this section was written,
> execution on a disposable database "remained mandatory and had not happened".
> It has since happened, and it found six further defects that no amount of
> reading could have surfaced — including two security defects caused by
> privileges the files never mention. Read 0-A first.

| # | Defect | Where | Correction |
|---|--------|-------|------------|
| F1 | `handle_new_user()` assigned **`project_manager`** to every signup; production assigns **`viewer`**. Also dropped `pg_temp` from its `SECURITY DEFINER` `search_path` and leaked the email local-part into `full_name`. | `…0002_functions_triggers.sql` | Body replaced with production's, `search_path` restored to `'public', 'pg_temp'`. |
| C1 | `profiles_role_check` omitted **`client_viewer`** (11 values vs 12). | `…0000_schema_types_tables.sql` | 12th value added. |
| C2 | `approval_steps_status_check` omitted **`on_hold`** (4 values vs 5). | `…0000_schema_types_tables.sql` | 5th value added. |
| G1 | Grants: sequences, function `EXECUTE` ACLs, ownership and default ACLs entirely absent; the table grants that did exist were a dynamic rule, not a reproduction. | `…0003_rls_policies_grants.sql` | Rewritten as explicit verified statements (section A) plus an explicitly blocked, non-executable section B. |

**F1 was the serious one.** It was a privilege escalation *introduced by this
baseline* and absent from production: any self-service signup on a database
bootstrapped from the old draft would have held `project_manager` authority.

Two corrections to the process itself, both recorded so they are not repeated:

- **The reconciliation report was wrong to say this baseline contained zero
  `GRANT` statements.** It contained grants built dynamically as strings inside a
  `DO` block, invisible to a scan anchored on a statement-initial `GRANT`
  keyword. The report has been amended. This is the same class of regex-scanning
  error that produced five separate waves of false positives during the
  reconciliation.
- **The report also mis-cited this README.** It quoted the row
  "Grants | present | none (dumped `--no-acl`) | all missing" as the README
  admitting the *canonical baseline* had no grants. It does not: that table
  compares **the pg_dump** against production, and the very next section records
  that grants were "reconstructed from `information_schema.role_table_grants`".
  The README was right and the report misread it. Recorded because the misread
  is what made the missing-grants finding look already-known and settled.

### Not fixed, and deliberately so

- **Schema `USAGE` on `public` was never captured.** Without it none of the table
  grants are usable, so a bootstrap is incomplete. Highest-priority gap.
- **`service_role`, `postgres`, `supabase_admin`, `supabase_auth_admin` and
  `dashboard_user` ACLs were never captured.** The old draft granted
  `service_role` unconditionally; that was not evidence-backed and has been
  **removed rather than carried forward**, so a bootstrapped database will most
  likely reject the service-role key until the real ACLs are captured.
- **The 6 default ACLs** are known to exist but their contents were never
  captured. `ALTER DEFAULT PRIVILEGES` is per-grantor and may require a separate
  owner-authorised platform step.
- **One function's `EXECUTE` ACL is unaccounted for**: the reconciliation cites
  "2 exceptions" among 28 functions but names only `increment_copilot_usage`.
- **`on_auth_user_created` is now EXECUTABLE** — corrected 2026-08-01, and this
  entry is no longer a blocker. The previous reasoning ("`auth.users` is owned by
  `supabase_auth_admin`, so the migration role cannot create the trigger") was
  **wrong**: `CREATE TRIGGER` requires the `TRIGGER` privilege on the table plus
  `EXECUTE` on the function, **not ownership**. Both were verified present for the
  migration role. See §9.1. Correcting `handle_new_user()` removed the known
  escalation, and this finding removes the false blocker — neither is proof that
  the signup path works end to end, which still needs disposable-target execution.

Broad `anon`/`authenticated` privileges are reproduced **as production facts to
be matched, not as endorsed configuration.** RLS is the only control over them
and no table sets `FORCE ROW LEVEL SECURITY`.

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
| 4 | `20260801000003_rls_policies_grants.sql` | 103 RLS enables, 144 policies, **table/sequence/function grants only** |
| 5 | `20260801000004_views.sql` | 6 views, **then their ownership and all 18 view grants** |
| 6 | `20260801000005_postconditions.sql` | assertions; aborts on any mismatch |

Functions precede policies because policies call `get_my_tenant_id()`,
`current_user_role()` and `is_external_role()`. Views come after tables. Each file
is wrapped in `BEGIN`/`COMMIT` and commits independently.

> **File 4 must not grant on views (defect D2, fixed 2026-08-01).** File 4
> previously carried `GRANT`/`ALTER VIEW` statements naming the six views, but the
> views are not created until file 5. Executing the baseline failed there with
> `42P01 relation "public.v_gate_progress" does not exist`. The 18 statements
> (6 `anon`/`authenticated` grants, 6 `service_role` grants, 6 `ALTER VIEW … OWNER`)
> now live in file 5 immediately after the view definitions.
>
> The fix was to move the statements after the objects they depend on — **not** to
> renumber the files and **not** to weaken the statements. Ownership is set before
> the grants because the owner is recorded as the grantor in every resulting ACL
> entry, and production shows `grantor=postgres` on all view privileges.
>
> File 5's dynamic `DO`-block grant loop was also **deleted**. It granted to
> whatever views existed at runtime, so a missing or renamed view would have been
> silently skipped instead of failing loudly, and grants buried inside a `DO` block
> are invisible to statement-level scanners — the same blind spot that once let
> this directory be reported as containing "0 grants". All 18 statements are now
> enumerated explicitly, one per line.

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

File 6 aborts with a detailed diff if anything is off. Both
`public.handle_new_user()` **and** the `auth.users` trigger that calls it
(`on_auth_user_created`) are created by normal migration execution (§9.1). The
disposable target must therefore have an `auth.users` table and grant the
bootstrap role `TRIGGER` on it, mirroring production; file 6 asserts that
capability explicitly rather than letting the trigger silently go missing.

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

## 9. Operations by required authority

### 9.1 `auth.users` signup trigger — EXECUTABLE IN NORMAL MIGRATION (corrected)

Production has
`on_auth_user_created AFTER INSERT ON auth.users → public.handle_new_user()`.

This was previously listed here as requiring the schema owner, on the grounds
that `auth.users` is owned by `supabase_auth_admin`. **That reasoning was wrong.**
`CREATE TRIGGER` requires the `TRIGGER` privilege on the target table plus
`EXECUTE` on the trigger function; it does **not** require table ownership. The
capability was verified by read-only catalog introspection on 2026-08-01:

| Fact | Value |
|---|---|
| `auth.users` owner | `supabase_auth_admin` |
| Migration role | `postgres` |
| `auth.users` ACL entry | `postgres=ar*wdDxtm/supabase_auth_admin` — the `t` is `TRIGGER` |
| `has_table_privilege(postgres,'auth.users','TRIGGER')` | **true** |
| `has_function_privilege(postgres,'public.handle_new_user','EXECUTE')` | **true** |
| Trigger present and enabled in production | **true** |

The statement is therefore **executable and uncommented** in file 3
(`…0002_functions_triggers.sql`), and file 6 asserts both its exact shape
(`AFTER INSERT`, `FOR EACH ROW`, bound to `public.handle_new_user()`,
`tgenabled = 'O'`) and the two privileges above.

No ownership is altered, no `SET ROLE` is issued, and no new privilege on
`auth.users` is granted by this baseline. **No trigger has been created or
changed in production by this work** — production already had it.

Execution against a disposable target is still required to validate the complete
signup path end to end; a capability proof is not a behaviour proof.

### 9.2 Operations still requiring the schema owner

These cannot be performed by an ordinary migration role:

1. **Object ownership.** All views, functions and the event trigger are owned by
   `postgres` in production. A migration role that is not `postgres` will own what
   it creates. This is not cosmetic: `SECURITY DEFINER` functions execute as their
   owner, and non-`security_invoker` views read as their owner. Realign with
   `ALTER … OWNER TO postgres;`.
2. **Extensions.** `pgcrypto` and `uuid-ossp` (schema `extensions`), `pg_net`
   (registered in `public`), `pg_cron`, `pg_stat_statements`, `supabase_vault`.
   Managed-platform extensions are assumed pre-installed and are not created here.
3. **The three `supabase_admin`-owned default ACLs** — **PLATFORM ACTION
   REQUIRED.** `ALTER DEFAULT PRIVILEGES` is per-grantor, `supabase_admin` has no
   members, and the migration role is not one of them, so these cannot be issued
   by any migration or by the SQL Editor. They remain commented in file 4.
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

### 11.1 RLS policies — FULLY RECONCILED (no longer blocking)

Resolved 2026-08-01. The four previously `BLOCKED` policies were replaced with
their verified live production definitions, captured read-only from `pg_policy`,
and all `BLOCKED` banners were removed.

| Dimension | Result |
|---|---|
| Policy identities matched | **144 / 144** |
| Control fingerprints matched (mode + command + roles) | **144 / 144** |
| Expression fingerprints matched (USING + WITH CHECK) | **144 / 144** |
| Full fingerprints matched | **144 / 144** |
| Demo-tenant literals in the canonical draft | **0** |
| Unresolved policy blockers | **0** |

What the four corrections fixed:

| Policy | Defect in the pg_dump draft |
|---|---|
| `approval_matrix.approval_matrix_read` | `USING (true)` — unconditional read of the approval matrix, including external subcontractors. Production restricts to `NOT is_external_role()`. |
| `comments.comments_insert_auth` | demo-tenant bypass `tenant_id = '…0001'`, absent from production |
| `comments.comments_select_tenant` | demo-tenant bypass, plus production's tenant predicate replaced by a bare `auth.uid() IS NOT NULL` (cross-tenant read for any logged-in user) |
| `gate_templates.gate_templates_select` | same two defects as above |

All four also omitted `TO authenticated`, which Postgres treats as `PUBLIC` —
reaching `anon`, which holds `GRANT ALL` on nearly every relation with RLS as the
only barrier. Fixed.

**Normalization used** (applied identically to both sides): strip redundant outer
parentheses; treat `TO public` and `PUBLIC` as equivalent; treat an omitted `TO`
as `PUBLIC`; compare exact command, permissive/restrictive mode, sorted roles,
normalized `USING`, normalized `WITH CHECK`. Two `pg_get_expr` deparser artifacts
are also normalized: the output-column alias it adds to a scalar sub-select
(`SELECT auth.uid() AS uid`) and its space after an opening parenthesis. Both are
rendering-only; Postgres reproduces them when it re-deparses the written SQL.

> Reconciliation covers the RLS policy layer **only**. It does not make the
> overall canonical baseline ready for execution — see 11.2 through 11.4.

### 11.2 Never executed — RESOLVED 2026-08-01

~~No statement here has been run anywhere.~~ All six files have now been executed
on a disposable PostgreSQL 17.6 container and **all six COMMIT**. The warning was
justified: the mandatory run found **eight** defects static analysis had missed
(D1–D6, then D7–D8), two of them security defects (D3, D4) that no file-reading
method could have found, because they were caused by default privileges the files
never mention.

Still true, and the reason this section is not deleted: execution on a disposable
container proves the baseline *bootstraps*, not that it is byte-identical to
production. The three platform-owned default ACLs (§9.2) remain outside its reach.

### 11.3 Not covered by the fingerprints

Verified: table/column names and order, object counts, policy expressions,
view definitions. ~~**Not** verified column-by-column: data types, nullability,
defaults, `ON DELETE`/`ON UPDATE` FK actions, and index predicates.~~

**Superseded 2026-08-01.** Two normalized fingerprints now cover most of that gap
and both have been **reproduced by execution**:

- **Column** `0b1a44c861bb61cc6ca26dee3f63db02` — type, typmod, ndims,
  nullability, normalized default, identity, generated and collation for all
  1177 columns.
- **FK** `f061c43fcdf08eccae779b7bcabe6ac6` — target, key-order columns, MATCH,
  ON UPDATE, ON DELETE, deferrability and validity for all 153 FKs
  (ON DELETE a=37 / c=106 / n=10).

`P-FK1` was mutation-tested: dropping one FK makes it fail and report the changed
hash. **Index predicates remain count-only** (220) — no index fingerprint exists,
so that part of the original caveat still stands.

### 11.4 The demo tenant is a live production fact

19 tables default `tenant_id` to `00000000-0000-0000-0000-000000000001`, and that
tenant row exists in production. Reproduced faithfully, **not** endorsed: a row
inserted without an explicit `tenant_id` silently lands in the demo tenant.
Worth a follow-up decision, separate from this baseline.

---

*Generated 2026-08-01 from read-only introspection of `zmahjutrpvwjcmhkiibj`.
Production was not modified. Migration history was not modified. No Supabase
branch was created.*

---

## AMENDMENT — 2026-08-01 — PRIVILEGE GAPS CLOSED (repository only, unexecuted)

The blocked privilege dimensions described above were captured by read-only
metadata introspection of production. Full evidence:
[`privilege-gap-report.txt`](./privilege-gap-report.txt). Nothing was executed;
production is unchanged.

### What changed in `…0003_rls_policies_grants.sql`

| Was | Now |
|---|---|
| No schema-level statement (B1 blocked) | **A0** — `GRANT USAGE ON SCHEMA public` to the 5 captured grantees |
| Zero `service_role` grants (B2 blocked) | **A4b** — 103 tables + 6 views + 2 sequences, enumerated one per line |
| `rate_limit_buckets`: no statement at all | **A2/A4b** — granted to `service_role`; **explicitly `REVOKE`d** from `anon`/`authenticated` (see D3 — omitting the statement leaked the table) |
| No default ACLs (B3 blocked) | **A8** — the 3 `postgres`-owned records; the 3 platform-owned ones documented as commented, non-executable |
| B4 "second function ACL exception" | **Withdrawn — it never existed.** 27 + 1 = 28 |

### Two fidelity numbers, deliberately not merged

- **Executable-baseline fidelity: exact on every dimension the migration role can
  reach** — schema USAGE (semantics), all relation/sequence/function ACLs, zero
  column ACLs, 3 of 6 default ACLs.
- **Full production fidelity: NOT yet reached.** It requires the 3
  platform-owned default ACLs (section B3), which no migration role can create.

Collapsing these into a single percentage would hide the fact that the remaining
gap is an *authority* gap, not a knowledge gap.

### Corrections this forced on earlier claims in this file

1. **Removing the unverified `service_role` grant was right in method and wrong
   in outcome.** The grant is real, on 109 relations and both sequences. Refusing
   to carry it forward on faith is what forced this capture; it is now reinstated
   on evidence. The lesson is *verify*, not *guess next time*.
2. **The schema-USAGE gap was real but already satisfied in production** — with a
   caveat the original note missed entirely: the grantor is `pg_database_owner`,
   so a baseline run as `postgres` is semantically equivalent but **not**
   byte-identical. Marked SEMANTICALLY REPRODUCIBLE, GRANTOR PROVENANCE REQUIRES
   VALIDATION.
3. **B4 was a miscount in my own report,** not a finding.
4. `supabase_admin`, `supabase_auth_admin` and `dashboard_user` hold **nothing**
   on any public relation. Their absence is the correct reproduction.

### Unresolved

- Whether `postgres` holds implicit `pg_database_owner` membership decides
  whether A0 executes at all. `pg_auth_members` does not record implicit
  membership, so this is **not** answerable by introspection — confirm on the
  disposable database.
- The 3 platform-owned default ACLs remain outstanding.
