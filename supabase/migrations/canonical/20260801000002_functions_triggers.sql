-- =====================================================================
-- CANONICAL PRODUCTION BASELINE -- FUNCTIONS, TRIGGERS, EVENT TRIGGER
-- File 3 of 6  |  source of truth: project zmahjutrpvwjcmhkiibj (read-only introspection)
--
-- REVIEW ARTIFACT. Not in the active migration replay path.
-- Represents the VERIFIED PRE-P0 production state. Do not embed P0 changes here.
-- Intended target: an EMPTY bootstrap database (see 20260801000005_postconditions.sql).
-- =====================================================================

BEGIN;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;
SELECT pg_catalog.set_config('search_path', '', false);

-- ---------------------------------------------------------------------
-- FUNCTIONS (28)
-- ---------------------------------------------------------------------

CREATE FUNCTION public.audit_trigger_fn() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into audit_log (tenant_id, table_name, record_id, action, changed_by, new_values)
    values (new.tenant_id, tg_table_name, new.id::text, 'insert', auth.uid(), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into audit_log (tenant_id, table_name, record_id, action, changed_by, old_values, new_values)
    values (new.tenant_id, tg_table_name, new.id::text, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  elsif tg_op = 'DELETE' then
    insert into audit_log (tenant_id, table_name, record_id, action, changed_by, old_values)
    values (old.tenant_id, tg_table_name, old.id::text, 'delete', auth.uid(), to_jsonb(old));
    return old;
  end if;
end;
$$;

CREATE FUNCTION public.consume_rate_limit(p_key text, p_capacity integer, p_refill_per_sec numeric) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_tokens numeric; v_updated timestamptz; v_new numeric;
begin
  insert into public.rate_limit_buckets (key, tokens, capacity, refill_per_sec, updated_at)
  values (p_key, p_capacity, p_capacity, p_refill_per_sec, now())
  on conflict (key) do nothing;

  select b.tokens, b.updated_at into v_tokens, v_updated
  from public.rate_limit_buckets b where b.key = p_key for update;

  v_new := least(
    p_capacity,
    v_tokens + extract(epoch from (now() - v_updated)) * p_refill_per_sec
  );

  if v_new >= 1 then
    update public.rate_limit_buckets
    set tokens = v_new - 1, capacity = p_capacity,
        refill_per_sec = p_refill_per_sec, updated_at = now()
    where key = p_key;
    return true;
  else
    update public.rate_limit_buckets
    set tokens = v_new, capacity = p_capacity,
        refill_per_sec = p_refill_per_sec, updated_at = now()
    where key = p_key;
    return false;
  end if;
end;
$$;

CREATE FUNCTION public.current_user_org() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT organization_name FROM public.external_access
  WHERE user_id = auth.uid() AND revoked_at IS NULL
  ORDER BY granted_at DESC LIMIT 1;
$$;

CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE FUNCTION public.enforce_gate_approval() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE missing int;
BEGIN
  IF NEW.status = 'approved'::gate_status AND OLD.status IS DISTINCT FROM 'approved'::gate_status THEN
    SELECT COUNT(*) INTO missing FROM gate_signoffs
     WHERE phase_gate_id = NEW.id AND status <> 'signed';
    IF missing > 0 THEN
      RAISE EXCEPTION 'Gate cannot be approved: % sign-off(s) still pending', missing;
    END IF;
    NEW.reviewed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.get_my_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE FUNCTION public.gm_rule_b1() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'ok', count(*) = 0, 'count', count(*),
    'details', coalesce(jsonb_agg(jsonb_build_object('project_id', pg.project_id, 'phase', pg.phase_number, 'phase_name', pg.phase_name)), '[]'::jsonb),
    'note', 'Approved gates with no signature row (entity_type=gate_approval).')
  from phase_gates pg
  where pg.status = 'approved'
    and not exists (select 1 from signatures s where s.entity_type = 'gate_approval' and s.entity_id::text = pg.id::text);
$$;

CREATE FUNCTION public.gm_rule_b10() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with ev as (select count(*) c from workflow_events where created_at > now() - interval '30 days'),
  tabs as (
    select 'variation_orders' t, count(*) c from variation_orders where updated_at > now() - interval '30 days'
    union all select 'payment_milestones', count(*) from payment_milestones where updated_at > now() - interval '30 days'
    union all select 'ncrs', count(*) from ncrs where updated_at > now() - interval '30 days'
    union all select 'guarantees', count(*) from guarantees where updated_at > now() - interval '30 days'
    union all select 'profiles', count(*) from profiles where updated_at > now() - interval '30 days'
    union all select 'approvals', count(*) from approvals where updated_at > now() - interval '30 days')
  select jsonb_build_object(
    'ok', ((select c from ev) > 0) or not exists (select 1 from tabs where c > 0),
    'count', (select c from ev),
    'details', (select coalesce(jsonb_agg(jsonb_build_object('table', t, 'recent_mods', c) order by t), '[]'::jsonb) from tabs where c > 0),
    'note', 'workflow_events logged in last 30d vs tables with recent modifications.');
$$;

CREATE FUNCTION public.gm_rule_b2() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'ok', count(*) = 0, 'count', count(*),
    'details', coalesce(jsonb_agg(distinct jsonb_build_object('project_id', pg.project_id)), '[]'::jsonb),
    'note', 'Phase-6 approved projects with a non-closed NCR.')
  from phase_gates pg
  where pg.phase_number = 6 and pg.status = 'approved'
    and exists (select 1 from ncrs n where n.project_id = pg.project_id and n.status <> 'closed');
$$;

CREATE FUNCTION public.gm_rule_b3() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'ok', count(*) = 0, 'count', count(*),
    'details', coalesce(jsonb_agg(jsonb_build_object('vo_number', vo.vo_number, 'status', vo.status, 'baseline_updated', vo.baseline_updated)), '[]'::jsonb),
    'note', 'Executed VOs not approved or with baseline not updated.')
  from variation_orders vo
  where vo.executed = true and (vo.status <> 'approved' or vo.baseline_updated = false);
$$;

CREATE FUNCTION public.gm_rule_b4() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'ok', count(*) = 0, 'count', count(*),
    'details', coalesce(jsonb_agg(distinct jsonb_build_object('project_id', pg.project_id)), '[]'::jsonb),
    'note', 'Phase-8 approved projects with guarantees still active.')
  from phase_gates pg
  where pg.phase_number = 8 and pg.status = 'approved'
    and exists (select 1 from guarantees g where g.project_id = pg.project_id and g.status = 'active');
$$;

CREATE FUNCTION public.gm_rule_b5() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with ref as (select unnest(array['departments','roles','gates','raci_deliverables','raci_assignments','gate_signoff_templates','gate_approver_defaults','gate_role_requirements','approval_matrix','approval_rules','object_types']) as t),
  missing as (select tablename from pg_tables where schemaname = 'public' and rowsecurity = false and tablename not in (select t from ref))
  select jsonb_build_object(
    'ok', coalesce((select rowsecurity from pg_tables where schemaname='public' and tablename='tasks'), false),
    'count', (select count(*) from missing),
    'details', (select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb) from missing),
    'note', 'Non-reference tables without RLS (informational). Pass = tasks RLS enabled.');
$$;

CREATE FUNCTION public.gm_rule_b6() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'ok', count(*) = 0, 'count', count(*),
    'details', coalesce(jsonb_agg(jsonb_build_object('approval_id', a.id, 'title', a.title)), '[]'::jsonb),
    'note', 'Decided approvals where requester_id = assignee_id (segregation proxy).')
  from approvals a
  where a.decided_at is not null and a.requester_id is not null and a.requester_id = a.assignee_id;
$$;

CREATE FUNCTION public.gm_rule_b7() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'ok', count(*) > 0, 'count', count(*),
    'details', coalesce(jsonb_agg(policyname), '[]'::jsonb),
    'note', 'UPDATE/ALL RLS policies on raci_deliverables.')
  from pg_policies
  where schemaname = 'public' and tablename = 'raci_deliverables' and cmd in ('UPDATE','ALL');
$$;

CREATE FUNCTION public.gm_rule_b8() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'ok', count(*) = 0, 'count', count(*),
    'details', coalesce(jsonb_agg(jsonb_build_object('report_id', cr.id, 'project_id', cr.project_id)), '[]'::jsonb),
    'note', 'Draft client reports with a non-null storage_path.')
  from client_reports cr
  where cr.status = 'draft' and cr.storage_path is not null;
$$;

CREATE FUNCTION public.gm_rule_b9() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'ok', count(*) = 0, 'count', count(*),
    'details', coalesce(jsonb_agg(jsonb_build_object('milestone_id', pm.id, 'title', pm.title)), '[]'::jsonb),
    'note', 'Milestones marked paid with null paid_at or paid_amount.')
  from payment_milestones pm
  where pm.status = 'paid' and (pm.paid_at is null or pm.paid_amount is null);
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user() -- CORRECTED 2026-08-01 from verified production prosrc.
--
-- DEFECT F1 (reconciliation report section 4). The previous draft of this
-- function differed from production in two independent ways:
--   (a) it assigned the signup role 'project_manager'; production assigns
--       'viewer'. That was a PRIVILEGE ESCALATION introduced by this baseline
--       and absent from production -- every self-service signup on a
--       bootstrapped database would have held project_manager authority.
--   (b) it dropped 'pg_temp' from the SECURITY DEFINER search_path, and its
--       full_name fallback leaked the email local-part instead of ''.
-- Both are corrected below. Column order, the conflict clause and the tenant
-- default are reproduced exactly as production stores them.
--
-- Owner in production: postgres. Ownership and the EXECUTE ACL are NOT set
-- here -- they belong to the grants file (20260801000003), per section 4 of
-- the reconciliation report.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
begin
  insert into public.profiles (id, email, full_name, role, tenant_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'viewer',
    '00000000-0000-0000-0000-000000000001'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

CREATE FUNCTION public.has_external_access(p_project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.external_access
    WHERE user_id = auth.uid()
      AND project_id = p_project_id
      AND revoked_at IS NULL
  );
$$;

CREATE FUNCTION public.is_external_role() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT role::text IN ('subcontractor','client_viewer')
     FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

CREATE FUNCTION public.prevent_profiles_drop() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
begin
  if exists (
    select 1 from pg_event_trigger_dropped_objects()
    where object_type = 'table'
      and object_name = 'profiles'
      and schema_name = 'public'
  ) then
    raise exception 'PROTECTED: dropping public.profiles is forbidden. Disable the prevent_profiles_drop event trigger first.';
  end if;
end;
$$;

CREATE FUNCTION public.set_ncr_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE next_seq integer;
BEGIN
  IF NEW.ncr_number IS NULL OR NEW.ncr_number = '' THEN
    SELECT COALESCE(MAX((regexp_replace(ncr_number, '\D', '', 'g'))::int), 0) + 1
      INTO next_seq
      FROM public.ncrs
      WHERE project_id = NEW.project_id;
    NEW.ncr_number := 'NCR-' || lpad(next_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.set_risk_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.risk_number is null then
    new.risk_number := 'RSK-' || lpad(
      (coalesce((select count(*) from public.risks where tenant_id = new.tenant_id), 0) + 1)::text, 4, '0');
  end if;
  return new;
end;
$$;

CREATE FUNCTION public.set_ticket_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.ticket_number is null then
    new.ticket_number := 'TKT-' || lpad(
      (coalesce((select count(*) from public.tickets where tenant_id = new.tenant_id), 0) + 1)::text, 4, '0');
  end if;
  return new;
end;
$$;

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.set_vo_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE next_seq integer;
BEGIN
  IF NEW.vo_number IS NULL OR NEW.vo_number = '' THEN
    SELECT COALESCE(MAX((regexp_replace(vo_number, '\D', '', 'g'))::int), 0) + 1
      INTO next_seq
      FROM public.variation_orders
      WHERE project_id = NEW.project_id;
    NEW.vo_number := 'VO-' || lpad(next_seq::text, 3, '0');
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.spawn_gate_signoffs() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE v_gate_id uuid; v_gate_code text; v_tenant uuid;
BEGIN
  IF NEW.status = 'in_review'::gate_status AND (OLD.status IS DISTINCT FROM 'in_review'::gate_status) THEN
    SELECT g.id, g.code INTO v_gate_id, v_gate_code FROM gates g
     WHERE g.sort_order = NEW.phase_number AND g.name = NEW.phase_name;
    IF v_gate_id IS NULL THEN RETURN NEW; END IF;
    SELECT p.tenant_id INTO v_tenant FROM projects p WHERE p.id = NEW.project_id;

    INSERT INTO gate_signoffs (tenant_id, phase_gate_id, role_id, person_id, status)
    SELECT v_tenant, NEW.id, gst.role_id,
           (SELECT pt.person_id FROM project_team pt
             WHERE pt.project_id = NEW.project_id AND pt.role_id = gst.role_id),
           'pending'
    FROM gate_signoff_templates gst WHERE gst.gate_id = v_gate_id
    ON CONFLICT (phase_gate_id, role_id) DO NOTHING;

    INSERT INTO approval_items (tenant_id, project_id, phase_gate_id, role_id, person_id, title, type, status)
    SELECT v_tenant, NEW.project_id, NEW.id, gst.role_id,
           (SELECT pt.person_id FROM project_team pt
             WHERE pt.project_id = NEW.project_id AND pt.role_id = gst.role_id),
           v_gate_code || ' sign-off required - ' || NEW.phase_name, 'gate_signoff', 'pending'
    FROM gate_signoff_templates gst WHERE gst.gate_id = v_gate_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

SET default_table_access_method = heap;

-- DELTA vs dump: present in production, absent from the dump.
CREATE FUNCTION public.increment_copilot_usage(p_token_count integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
declare
  v_tenant uuid;
begin
  select tenant_id into v_tenant from profiles where id = auth.uid();
  if v_tenant is null then
    raise exception 'No tenant for user';
  end if;
  update copilot_tenant_budget
     set current_month_tokens = coalesce(current_month_tokens, 0) + p_token_count,
         updated_at = now()
   where tenant_id = v_tenant;
end;
$$;

-- ---------------------------------------------------------------------
-- TABLE TRIGGERS (24)
-- ---------------------------------------------------------------------

CREATE TRIGGER approvals_updated_at BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER audit_approvals AFTER INSERT OR DELETE OR UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_claims AFTER INSERT OR DELETE OR UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_contracts AFTER INSERT OR DELETE OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_finance_records AFTER INSERT OR DELETE OR UPDATE ON public.finance_records FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_ncrs AFTER INSERT OR DELETE OR UPDATE ON public.ncrs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_payment_certificates AFTER INSERT OR DELETE OR UPDATE ON public.payment_certificates FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_projects AFTER INSERT OR DELETE OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_risks AFTER INSERT OR DELETE OR UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_schedule_milestones AFTER INSERT OR DELETE OR UPDATE ON public.schedule_milestones FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_variation_orders AFTER INSERT OR DELETE OR UPDATE ON public.variation_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER audit_work_permits AFTER INSERT OR DELETE OR UPDATE ON public.work_permits FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER phase_gates_updated_at BEFORE UPDATE ON public.phase_gates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_enforce_gate_approval BEFORE UPDATE OF status ON public.phase_gates FOR EACH ROW EXECUTE FUNCTION public.enforce_gate_approval();

CREATE TRIGGER trg_set_ncr_number BEFORE INSERT ON public.ncrs FOR EACH ROW EXECUTE FUNCTION public.set_ncr_number();

CREATE TRIGGER trg_set_risk_number BEFORE INSERT ON public.risks FOR EACH ROW EXECUTE FUNCTION public.set_risk_number();

CREATE TRIGGER trg_set_ticket_number BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();

CREATE TRIGGER trg_set_vo_number BEFORE INSERT ON public.variation_orders FOR EACH ROW EXECUTE FUNCTION public.set_vo_number();

CREATE TRIGGER trg_spawn_gate_signoffs AFTER INSERT OR UPDATE OF status ON public.phase_gates FOR EACH ROW EXECUTE FUNCTION public.spawn_gate_signoffs();

CREATE TRIGGER trg_tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER wf_inst_updated_at BEFORE UPDATE ON public.workflow_instances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- EVENT TRIGGER
-- ---------------------------------------------------------------------

-- Production fact: guards against dropping public.profiles.
CREATE EVENT TRIGGER block_profiles_drop ON sql_drop
    WHEN TAG IN ('DROP TABLE')
    EXECUTE FUNCTION public.prevent_profiles_drop();

-- ---------------------------------------------------------------------
-- auth.users SIGNUP TRIGGER -- EXECUTABLE IN NORMAL MIGRATION
-- ---------------------------------------------------------------------

-- CORRECTED 2026-08-01. This statement was previously commented out on the
-- stated grounds that "auth.users is owned by supabase_auth_admin, so creating
-- a trigger on it requires that owner". THAT REASONING WAS WRONG and is now
-- disproven by direct capability introspection against production.
--
-- CREATE TRIGGER requires the TRIGGER privilege on the target table plus
-- EXECUTE on the trigger function. It does NOT require table ownership.
-- Verified production facts (read-only catalog introspection, 2026-08-01):
--   auth.users owner .................. supabase_auth_admin
--   migration role .................... postgres
--   auth.users relacl ................. postgres=ar*wdDxtm/supabase_auth_admin
--                                       (the 't' is the TRIGGER privilege,
--                                        granted BY supabase_auth_admin)
--   has_table_privilege(postgres,'auth.users','TRIGGER') ............. true
--   has_function_privilege(postgres,'public.handle_new_user','EXECUTE') true
--   trigger already present and enabled in production ................ true
--
-- So the bootstrap role holds exactly the two privileges the statement needs,
-- and no ownership change, SET ROLE, or new grant on auth.users is required
-- or performed here.
--
-- Timing, event, row-level scope, function binding and enabled state below
-- reproduce production's pg_get_triggerdef output exactly. tgenabled = 'O'
-- (origin, i.e. enabled) is the default for a freshly created trigger and is
-- therefore not set explicitly; postconditions assert it.
--
-- Execution against a disposable target is still required to validate the
-- complete signup path end to end. Defect F1 (the 'project_manager'
-- escalation) is corrected above, so the known escalation is gone -- but that
-- is not by itself proof that the path works.
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

COMMIT;
