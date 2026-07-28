--
-- PostgreSQL database dump
--

\restrict lrbsij4b3k5QjGMncZAdnENguVmPNWfuhknNYJm8c17tA77YqyWejhDkjurknbz

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: approval_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.approval_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'delegated'
);


--
-- Name: cost_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cost_category AS ENUM (
    'engineering',
    'procurement',
    'subcontracts',
    'construction',
    'overhead',
    'contingency'
);


--
-- Name: email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_status AS ENUM (
    'sent',
    'failed'
);


--
-- Name: gate_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gate_status AS ENUM (
    'pending',
    'in_review',
    'approved',
    'rejected',
    'conditional'
);


--
-- Name: guarantee_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.guarantee_status AS ENUM (
    'active',
    'released',
    'expired',
    'called'
);


--
-- Name: guarantee_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.guarantee_type AS ENUM (
    'bid_bond',
    'performance_bond',
    'advance_payment_guarantee',
    'retention_bond'
);


--
-- Name: milestone_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.milestone_status AS ENUM (
    'planned',
    'invoiced',
    'overdue',
    'paid'
);


--
-- Name: ncr_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ncr_source AS ENUM (
    'failed_inspection',
    'audit',
    'site_observation'
);


--
-- Name: ncr_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ncr_status AS ENUM (
    'open',
    'in_rectification',
    're_inspection',
    'closed'
);


--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_channel AS ENUM (
    'email',
    'push',
    'in_app',
    'sms'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'planning',
    'active',
    'on_hold',
    'completed',
    'cancelled'
);


--
-- Name: raci_letter; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.raci_letter AS ENUM (
    'R',
    'A',
    'A/R',
    'C',
    'I'
);


--
-- Name: retention_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.retention_status AS ENUM (
    'held',
    'release_requested',
    'released'
);


--
-- Name: signature_entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.signature_entity_type AS ENUM (
    'gate_approval',
    'vo_approval',
    'client_report',
    'certificate'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'system_admin',
    'tenant_admin',
    'project_director',
    'project_manager',
    'engineer',
    'hse_manager',
    'commissioning_manager',
    'finance_manager',
    'commercial_manager',
    'viewer',
    'subcontractor',
    'client_viewer'
);


--
-- Name: vo_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vo_origin AS ENUM (
    'ifc_discrepancy',
    'client_request',
    'site_condition'
);


--
-- Name: vo_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vo_status AS ENUM (
    'draft',
    'submitted',
    'approved',
    'rejected',
    'withdrawn'
);


--
-- Name: workflow_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.workflow_status AS ENUM (
    'draft',
    'active',
    'completed',
    'cancelled'
);


--
-- Name: audit_trigger_fn(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: consume_rate_limit(text, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: current_user_org(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_org() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT organization_name FROM public.external_access
  WHERE user_id = auth.uid() AND revoked_at IS NULL
  ORDER BY granted_at DESC LIMIT 1;
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;


--
-- Name: enforce_gate_approval(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: get_my_tenant_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;


--
-- Name: gm_rule_b1(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: gm_rule_b10(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: gm_rule_b2(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: gm_rule_b3(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: gm_rule_b4(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: gm_rule_b5(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: gm_rule_b6(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: gm_rule_b7(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: gm_rule_b8(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: gm_rule_b9(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.profiles (id, tenant_id, full_name, email, role)
  values (
    new.id,
    '00000000-0000-0000-0000-000000000001',
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'project_manager'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


--
-- Name: has_external_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: is_external_role(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: prevent_profiles_drop(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: set_ncr_number(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: set_risk_number(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: set_ticket_number(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: set_vo_number(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: spawn_gate_signoffs(); Type: FUNCTION; Schema: public; Owner: -
--

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


--
-- Name: touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_dependencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_dependencies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    predecessor_id uuid NOT NULL,
    successor_id uuid NOT NULL,
    type text DEFAULT 'FS'::text,
    lag_days integer DEFAULT 0,
    CONSTRAINT activity_dependencies_type_check CHECK ((type = ANY (ARRAY['FS'::text, 'SS'::text, 'FF'::text, 'SF'::text])))
);


--
-- Name: ai_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    module text,
    title text NOT NULL,
    description text,
    confidence integer DEFAULT 80,
    severity text DEFAULT 'medium'::text,
    status text DEFAULT 'open'::text,
    recommended_action text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ai_insights_module_check CHECK ((module = ANY (ARRAY['predictive_maintenance'::text, 'anomaly_detection'::text, 'schedule_risk'::text, 'cost_overrun'::text, 'safety'::text]))),
    CONSTRAINT ai_insights_severity_check CHECK ((severity = ANY (ARRAY['critical'::text, 'high'::text, 'medium'::text, 'low'::text, 'info'::text]))),
    CONSTRAINT ai_insights_status_check CHECK ((status = ANY (ARRAY['open'::text, 'acknowledged'::text, 'resolved'::text, 'dismissed'::text])))
);


--
-- Name: approval_conditions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_conditions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    approval_id uuid NOT NULL,
    title text NOT NULL,
    detail text,
    status text DEFAULT 'open'::text,
    due_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approval_conditions_status_check CHECK ((status = ANY (ARRAY['open'::text, 'met'::text, 'waived'::text, 'breached'::text])))
);


--
-- Name: approval_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_events (
    id bigint NOT NULL,
    tenant_id uuid,
    approval_id uuid,
    event text NOT NULL,
    actor_id uuid,
    actor_role text,
    from_status text,
    to_status text,
    detail jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: approval_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.approval_events ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.approval_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: approval_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    phase_gate_id uuid,
    role_id uuid,
    person_id uuid,
    title text NOT NULL,
    type text DEFAULT 'gate_signoff'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    CONSTRAINT approval_items_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: approval_matrix; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_matrix (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    action_code text NOT NULL,
    action_name text NOT NULL,
    category text NOT NULL,
    department_code text NOT NULL,
    initiator_role text NOT NULL,
    approver_role text NOT NULL,
    secondary_approver_role text,
    threshold_usd numeric,
    requires_segregation boolean DEFAULT true NOT NULL,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    name text NOT NULL,
    object_type text NOT NULL,
    min_amount numeric,
    max_amount numeric,
    required_roles text[] DEFAULT '{}'::text[] NOT NULL,
    approval_levels integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: approval_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_steps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    approval_id uuid NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    assigned_to uuid,
    assigned_role text,
    status text DEFAULT 'pending'::text,
    decided_at timestamp with time zone,
    decided_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT approval_steps_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'skipped'::text])))
);


--
-- Name: approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    instance_id uuid,
    object_id uuid,
    object_type text NOT NULL,
    title text NOT NULL,
    description text,
    amount numeric,
    currency text DEFAULT 'USD'::text,
    priority text DEFAULT 'normal'::text NOT NULL,
    status public.approval_status DEFAULT 'pending'::public.approval_status NOT NULL,
    assignee_id uuid,
    requester_id uuid,
    due_date timestamp with time zone,
    decided_at timestamp with time zone,
    decision_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by uuid,
    decision text,
    CONSTRAINT approvals_decision_check CHECK ((decision = ANY (ARRAY['proceed'::text, 'conditional_proceed'::text, 'hold'::text, 'reject'::text]))),
    CONSTRAINT approvals_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'critical'::text])))
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    asset_tag text NOT NULL,
    name text NOT NULL,
    category text,
    status text DEFAULT 'active'::text NOT NULL,
    location text,
    purchase_date date,
    purchase_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    tenant_id uuid,
    table_name text NOT NULL,
    record_id text,
    action text NOT NULL,
    changed_by uuid,
    old_values jsonb,
    new_values jsonb,
    changed_at timestamp with time zone DEFAULT now(),
    CONSTRAINT audit_log_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text])))
);


--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: bess_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bess_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    date date NOT NULL,
    soc_pct numeric,
    cycles_cumulative numeric DEFAULT 0,
    throughput_mwh numeric DEFAULT 0,
    soh_pct numeric,
    warranty_cycle_limit numeric DEFAULT 6000,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: cash_flow_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_flow_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    period text NOT NULL,
    planned_inflow numeric DEFAULT 0,
    actual_inflow numeric DEFAULT 0,
    planned_outflow numeric DEFAULT 0,
    actual_outflow numeric DEFAULT 0,
    cumulative_net numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    claim_number text NOT NULL,
    title text NOT NULL,
    type text DEFAULT 'cost'::text,
    description text,
    amount numeric DEFAULT 0,
    eot_days integer DEFAULT 0,
    status text DEFAULT 'submitted'::text,
    submitted_date date DEFAULT CURRENT_DATE,
    response_due date,
    resolved_date date,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT claims_status_check CHECK ((status = ANY (ARRAY['submitted'::text, 'under_review'::text, 'accepted'::text, 'rejected'::text, 'settled'::text, 'withdrawn'::text]))),
    CONSTRAINT claims_type_check CHECK ((type = ANY (ARRAY['time'::text, 'cost'::text, 'disruption'::text, 'other'::text])))
);


--
-- Name: client_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    author_id uuid,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_information_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_information_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: client_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    version integer NOT NULL,
    period_label text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    storage_path text,
    generated_by uuid,
    issued_by uuid,
    issued_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    object_type text NOT NULL,
    object_id uuid NOT NULL,
    content text NOT NULL,
    author_id uuid,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    author_name text,
    mentions text[] DEFAULT '{}'::text[],
    is_resolved boolean DEFAULT false NOT NULL,
    parent_id uuid
);


--
-- Name: commissioning_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.commissioning_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    test_number text NOT NULL,
    title text NOT NULL,
    system text,
    status text DEFAULT 'pending'::text NOT NULL,
    scheduled_date date,
    completed_date date,
    result text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contract_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contract_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    contract_id uuid NOT NULL,
    title text NOT NULL,
    due_date date,
    amount numeric DEFAULT 0,
    status text DEFAULT 'pending'::text,
    achieved_date date,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contract_milestones_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'achieved'::text, 'missed'::text, 'paid'::text])))
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    contract_no text NOT NULL,
    title text NOT NULL,
    party text,
    type text DEFAULT 'subcontract'::text,
    value numeric DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    status text DEFAULT 'draft'::text,
    signed_date date,
    commencement date,
    completion date,
    retention_pct numeric DEFAULT 5,
    ld_rate_per_day numeric DEFAULT 0,
    ld_cap_pct numeric DEFAULT 10,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contracts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'suspended'::text, 'completed'::text, 'terminated'::text]))),
    CONSTRAINT contracts_type_check CHECK ((type = ANY (ARRAY['epc'::text, 'subcontract'::text, 'supply'::text, 'service'::text, 'consultancy'::text])))
);


--
-- Name: copilot_audit_trail; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copilot_audit_trail (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    message_id uuid NOT NULL,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    total_tokens integer DEFAULT 0 NOT NULL,
    context_sources jsonb DEFAULT '[]'::jsonb NOT NULL,
    model_used text DEFAULT 'gpt-4-turbo'::text,
    response_time_ms integer,
    feedback_at timestamp with time zone,
    feedback_value smallint,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_audit_feedback CHECK ((feedback_value = ANY (ARRAY['-1'::integer, 0, 1, NULL::integer]))),
    CONSTRAINT check_audit_tokens CHECK ((total_tokens > 0))
);


--
-- Name: copilot_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copilot_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_tenant_id CHECK ((tenant_id IS NOT NULL)),
    CONSTRAINT check_user_id CHECK ((user_id IS NOT NULL))
);


--
-- Name: copilot_intent_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copilot_intent_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    question text NOT NULL,
    classified_intent text,
    matched_query_id text,
    was_catalog_hit boolean DEFAULT false NOT NULL,
    fallback_prose_used boolean DEFAULT false NOT NULL,
    suggested_queries text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_intent_log_question CHECK ((length(question) > 0))
);


--
-- Name: copilot_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copilot_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    citations jsonb DEFAULT '[]'::jsonb,
    feedback smallint,
    created_at timestamp with time zone DEFAULT now(),
    flagged boolean DEFAULT false NOT NULL,
    "tableCard" jsonb,
    CONSTRAINT check_content CHECK ((content IS NOT NULL)),
    CONSTRAINT check_conversation_id CHECK ((conversation_id IS NOT NULL)),
    CONSTRAINT check_role CHECK ((role IS NOT NULL)),
    CONSTRAINT copilot_messages_feedback_check CHECK ((feedback = ANY (ARRAY['-1'::integer, 0, 1, NULL::integer]))),
    CONSTRAINT copilot_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);


--
-- Name: copilot_tenant_budget; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.copilot_tenant_budget (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    monthly_token_limit integer DEFAULT 100000 NOT NULL,
    current_month_tokens integer DEFAULT 0 NOT NULL,
    month_start_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_budget_positive CHECK ((monthly_token_limit > 0)),
    CONSTRAINT check_current_positive CHECK ((current_month_tokens >= 0))
);


--
-- Name: cost_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    period text NOT NULL,
    category public.cost_category NOT NULL,
    budgeted_amount numeric(16,2) DEFAULT 0 NOT NULL,
    actual_amount numeric(16,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: daily_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    report_date date DEFAULT CURRENT_DATE NOT NULL,
    weather text,
    temp_high_c numeric,
    wind_kmh numeric,
    workforce_count integer DEFAULT 0,
    equipment_count integer DEFAULT 0,
    work_performed text,
    delays text,
    safety_notes text,
    visitors text,
    status text DEFAULT 'draft'::text,
    submitted_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT daily_reports_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text])))
);


--
-- Name: delivery_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.delivery_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    po_id uuid NOT NULL,
    project_id uuid,
    organization_name text DEFAULT ''::text NOT NULL,
    submitted_by uuid NOT NULL,
    doc_type text DEFAULT 'delivery_note'::text NOT NULL,
    file_name text NOT NULL,
    storage_path text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL
);


--
-- Name: document_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    project_code text,
    storage_path text DEFAULT ''::text NOT NULL,
    file_name text NOT NULL,
    title text,
    code text,
    category text DEFAULT 'general'::text,
    size_bytes bigint DEFAULT 0,
    mime_type text,
    uploaded_by text DEFAULT 'Unknown'::text,
    status text DEFAULT 'draft'::text,
    revision text DEFAULT 'A'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    visible_to_client boolean DEFAULT false NOT NULL,
    CONSTRAINT document_files_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'approved'::text, 'superseded'::text, 'rejected'::text])))
);


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    title text NOT NULL,
    doc_number text,
    revision text DEFAULT 'A'::text NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    file_url text,
    file_size bigint,
    uploaded_by uuid,
    approved_by uuid,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    visible_to_client boolean DEFAULT false NOT NULL,
    CONSTRAINT documents_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'superseded'::text])))
);


--
-- Name: email_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    type text NOT NULL,
    subject text NOT NULL,
    status public.email_status DEFAULT 'sent'::public.email_status NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: energy_production; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.energy_production (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    date date NOT NULL,
    energy_mwh numeric DEFAULT 0,
    availability_pct numeric DEFAULT 100,
    curtailment_mwh numeric DEFAULT 0,
    p50_mwh numeric,
    p90_mwh numeric,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: engineering_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.engineering_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    package_code text NOT NULL,
    title text NOT NULL,
    discipline text,
    status text DEFAULT 'draft'::text NOT NULL,
    progress_pct numeric DEFAULT 0 NOT NULL,
    due_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    visible_to_client boolean DEFAULT false NOT NULL,
    gate_number integer DEFAULT 0 NOT NULL
);


--
-- Name: external_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.external_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    user_id uuid NOT NULL,
    project_id uuid NOT NULL,
    organization_name text DEFAULT ''::text NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: field_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.field_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    storage_path text NOT NULL,
    caption text,
    report_id uuid,
    ticket_id uuid,
    taken_at timestamp with time zone DEFAULT now(),
    uploaded_by text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: finance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.finance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    record_type text NOT NULL,
    description text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    transaction_date date,
    cost_code text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gate_approver_defaults; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_approver_defaults (
    gate_number integer NOT NULL,
    primary_role text NOT NULL,
    secondary_role text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    CONSTRAINT gate_approver_defaults_gate_number_check CHECK (((gate_number >= 1) AND (gate_number <= 8)))
);


--
-- Name: gate_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    gate_code text NOT NULL,
    gate_name text,
    verification_id text NOT NULL,
    deliverables jsonb DEFAULT '[]'::jsonb NOT NULL,
    storage_path text,
    issued_by uuid,
    issued_by_name text,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gate_role_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_role_requirements (
    gate_number integer NOT NULL,
    role_code text NOT NULL,
    CONSTRAINT gate_role_requirements_gate_number_check CHECK (((gate_number >= 1) AND (gate_number <= 8)))
);


--
-- Name: gate_signoff_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_signoff_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gate_id uuid NOT NULL,
    role_id uuid NOT NULL,
    is_approver boolean DEFAULT false NOT NULL,
    letter public.raci_letter DEFAULT 'C'::public.raci_letter NOT NULL
);


--
-- Name: gate_signoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_signoffs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    phase_gate_id uuid NOT NULL,
    role_id uuid NOT NULL,
    person_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    signed_at timestamp with time zone,
    CONSTRAINT gate_signoffs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'signed'::text, 'rejected'::text])))
);


--
-- Name: gate_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    gate_number integer NOT NULL,
    form_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text,
    submitted_by text,
    submitted_at timestamp with time zone,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    comments text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT gate_submissions_gate_number_check CHECK ((gate_number >= 0)),
    CONSTRAINT gate_submissions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: gate_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gate_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    name text NOT NULL,
    description text,
    technology text,
    is_active boolean DEFAULT true NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    gates jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    milestone text NOT NULL,
    sort_order integer NOT NULL
);


--
-- Name: grid_compliance_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grid_compliance_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    test_name text NOT NULL,
    standard text,
    test_date date,
    result text DEFAULT 'scheduled'::text,
    certificate_ref text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT grid_compliance_tests_result_check CHECK ((result = ANY (ARRAY['scheduled'::text, 'passed'::text, 'failed'::text, 'retest_required'::text])))
);


--
-- Name: guarantees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guarantees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    type public.guarantee_type DEFAULT 'performance_bond'::public.guarantee_type NOT NULL,
    bank_name text,
    amount numeric(16,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    issue_date date,
    expiry_date date,
    status public.guarantee_status DEFAULT 'active'::public.guarantee_status NOT NULL,
    release_date timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: handover_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.handover_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    document_type text,
    title text NOT NULL,
    revision text DEFAULT 'A'::text,
    status text DEFAULT 'pending'::text,
    submitted_by text,
    approved_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT handover_records_document_type_check CHECK ((document_type = ANY (ARRAY['as_built'::text, 'operation_manual'::text, 'warranty'::text, 'training_cert'::text, 'spare_parts'::text]))),
    CONSTRAINT handover_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'submitted'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: help_articles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_articles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    zone text DEFAULT 'general'::text NOT NULL,
    content text,
    summary text,
    tags text[] DEFAULT '{}'::text[],
    view_count integer DEFAULT 0 NOT NULL,
    helpful integer DEFAULT 0 NOT NULL,
    not_helpful integer DEFAULT 0 NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: help_topics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.help_topics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    title text NOT NULL,
    content text,
    category text,
    tags text[] DEFAULT '{}'::text[],
    is_published boolean DEFAULT false NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hse_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hse_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    title text NOT NULL,
    type text,
    severity text DEFAULT 'minor'::text,
    date date,
    location text,
    description text,
    status text DEFAULT 'open'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: hse_permits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hse_permits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid,
    title text NOT NULL,
    type text,
    issuer text,
    issue_date date,
    expiry_date date,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: inspections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    inspection_number text NOT NULL,
    title text NOT NULL,
    type text,
    status text DEFAULT 'scheduled'::text NOT NULL,
    scheduled_date date,
    completed_date date,
    result text,
    inspector_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: itp_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itp_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    itp_id uuid NOT NULL,
    seq integer DEFAULT 1 NOT NULL,
    description text NOT NULL,
    inspection_type text DEFAULT 'surveillance'::text,
    reference_doc text,
    responsible text,
    status text DEFAULT 'pending'::text,
    result_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT itp_activities_inspection_type_check CHECK ((inspection_type = ANY (ARRAY['hold'::text, 'witness'::text, 'surveillance'::text, 'review'::text]))),
    CONSTRAINT itp_activities_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'passed'::text, 'failed'::text, 'waived'::text])))
);


--
-- Name: itp_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.itp_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    itp_no text NOT NULL,
    title text NOT NULL,
    work_package text,
    discipline text,
    status text DEFAULT 'draft'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT itp_plans_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'completed'::text, 'superseded'::text])))
);


--
-- Name: lender_facilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lender_facilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    lender_name text,
    facility_amount numeric DEFAULT 0,
    currency text DEFAULT 'USD'::text,
    reporting_frequency text DEFAULT 'monthly'::text,
    contact_email text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT lender_facilities_reporting_frequency_check CHECK ((reporting_frequency = ANY (ARRAY['monthly'::text, 'quarterly'::text])))
);


--
-- Name: lender_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lender_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    title text,
    snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
    generated_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: maintenance_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.maintenance_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid,
    tenant_id uuid,
    title text NOT NULL,
    frequency text,
    last_performed date,
    next_due date,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marketplace_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marketplace_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    category text,
    description text,
    logo_url text,
    integration_type text,
    status text DEFAULT 'available'::text,
    rating numeric DEFAULT 0,
    review_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT marketplace_providers_category_check CHECK ((category = ANY (ARRAY['data_feed'::text, 'analytics'::text, 'epc_tool'::text, 'compliance'::text, 'finance'::text, 'field_service'::text]))),
    CONSTRAINT marketplace_providers_integration_type_check CHECK ((integration_type = ANY (ARRAY['api'::text, 'webhook'::text, 'file_import'::text, 'oauth'::text]))),
    CONSTRAINT marketplace_providers_status_check CHECK ((status = ANY (ARRAY['available'::text, 'connected'::text, 'pending'::text, 'deprecated'::text])))
);


--
-- Name: ncrs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ncrs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    ncr_number text NOT NULL,
    title text NOT NULL,
    description text,
    raised_by uuid,
    source public.ncr_source DEFAULT 'failed_inspection'::public.ncr_source NOT NULL,
    root_cause text,
    corrective_action text,
    status public.ncr_status DEFAULT 'open'::public.ncr_status NOT NULL,
    cycle integer DEFAULT 1 NOT NULL,
    reinspection_passed boolean DEFAULT false NOT NULL,
    closure_note text,
    raised_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    severity text,
    cost_impact numeric,
    CONSTRAINT ncrs_cost_impact_check CHECK (((cost_impact IS NULL) OR (cost_impact >= (0)::numeric))),
    CONSTRAINT ncrs_severity_check CHECK (((severity IS NULL) OR (severity = ANY (ARRAY['critical'::text, 'major'::text, 'minor'::text]))))
);


--
-- Name: notification_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_prefs (
    user_id uuid NOT NULL,
    email_on_approval boolean DEFAULT true NOT NULL,
    email_on_ncr boolean DEFAULT true NOT NULL,
    email_on_vo boolean DEFAULT true NOT NULL,
    email_on_escalation boolean DEFAULT true NOT NULL,
    email_on_mention boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email_weekly_digest boolean DEFAULT true NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    body text,
    type text DEFAULT 'info'::text NOT NULL,
    channel public.notification_channel DEFAULT 'in_app'::public.notification_channel NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    link text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: opportunities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.opportunities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text,
    technology text,
    capacity_mw numeric,
    location text,
    country text,
    stage text DEFAULT 'prospect'::text,
    irr_pct numeric,
    capex_usd numeric,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT opportunities_stage_check CHECK ((stage = ANY (ARRAY['prospect'::text, 'screening'::text, 'feasibility'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: payment_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_certificates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    pc_number text NOT NULL,
    period_start date,
    period_end date,
    progress_pct numeric DEFAULT 0,
    contract_value numeric DEFAULT 0,
    gross_amount numeric DEFAULT 0,
    previous_certified numeric DEFAULT 0,
    this_period numeric DEFAULT 0,
    retention_pct numeric DEFAULT 5,
    retention_amount numeric DEFAULT 0,
    advance_recovery numeric DEFAULT 0,
    net_amount numeric DEFAULT 0,
    status text DEFAULT 'draft'::text,
    submitted_date date,
    certified_date date,
    paid_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_certificates_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'certified'::text, 'invoiced'::text, 'paid'::text])))
);


--
-- Name: payment_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    title text NOT NULL,
    planned_date date,
    planned_amount numeric(16,2) DEFAULT 0 NOT NULL,
    invoiced_at timestamp with time zone,
    invoice_amount numeric(16,2),
    due_date date,
    paid_at timestamp with time zone,
    paid_amount numeric(16,2),
    status public.milestone_status DEFAULT 'planned'::public.milestone_status NOT NULL,
    escalation_level integer DEFAULT 0 NOT NULL,
    retention_pct numeric(6,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_visible boolean DEFAULT false NOT NULL,
    CONSTRAINT payment_milestones_escalation_level_check CHECK (((escalation_level >= 0) AND (escalation_level <= 4)))
);


--
-- Name: phase_gates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.phase_gates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    phase_number integer NOT NULL,
    phase_name text NOT NULL,
    status public.gate_status DEFAULT 'pending'::public.gate_status NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: portal_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.portal_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    submitted_by uuid NOT NULL,
    invoice_ref text NOT NULL,
    amount numeric(18,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    period_label text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'submitted'::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    po_id uuid,
    invoice_date date,
    pdf_path text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    tenant_id uuid,
    full_name text,
    email text,
    role text DEFAULT 'viewer'::text,
    department text,
    avatar_url text,
    locale text DEFAULT 'en'::text NOT NULL,
    digit_style text DEFAULT 'western'::text NOT NULL,
    last_active timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true NOT NULL,
    user_type text DEFAULT 'internal'::text NOT NULL,
    home_role_id uuid,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text, 'project_director'::text, 'project_manager'::text, 'engineer'::text, 'hse_manager'::text, 'commissioning_manager'::text, 'finance_manager'::text, 'commercial_manager'::text, 'viewer'::text, 'subcontractor'::text])))
);


--
-- Name: progress_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.progress_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    update_date date DEFAULT CURRENT_DATE NOT NULL,
    percent_complete numeric NOT NULL,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT progress_updates_percent_complete_check CHECK (((percent_complete >= (0)::numeric) AND (percent_complete <= (100)::numeric)))
);


--
-- Name: project_gate_approvers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_gate_approvers (
    project_id uuid NOT NULL,
    gate_number integer NOT NULL,
    primary_role text NOT NULL,
    secondary_role text,
    CONSTRAINT project_gate_approvers_gate_number_check CHECK (((gate_number >= 1) AND (gate_number <= 8)))
);


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    user_id uuid,
    tenant_id uuid,
    role text DEFAULT 'member'::text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_team; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_team (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    role_id uuid NOT NULL,
    person_id uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_by uuid
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    status public.project_status DEFAULT 'planning'::public.project_status NOT NULL,
    technology text DEFAULT 'Solar PV'::text NOT NULL,
    capacity_mw numeric,
    location text,
    country text,
    start_date date,
    target_completion date,
    actual_completion date,
    budget_usd numeric,
    spent_usd numeric DEFAULT 0 NOT NULL,
    current_phase integer DEFAULT 0 NOT NULL,
    health text DEFAULT 'green'::text NOT NULL,
    project_manager uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    bess_mwh numeric,
    provenance jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT projects_health_check CHECK ((health = ANY (ARRAY['green'::text, 'amber'::text, 'red'::text])))
);


--
-- Name: COLUMN projects.provenance; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.projects.provenance IS 'Per-field source metadata, e.g. {"budget_usd":{"source":"pilot_assumption","at":"..."}}. Values sourced from pilot_assumption are NOT lender-verified.';


--
-- Name: purchase_order_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_order_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    po_id uuid NOT NULL,
    line_no integer DEFAULT 1 NOT NULL,
    description text NOT NULL,
    quantity numeric(18,2) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'ea'::text NOT NULL,
    unit_price numeric(18,2) DEFAULT 0 NOT NULL,
    amount numeric(18,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    po_number text NOT NULL,
    vendor_name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    amount numeric DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    issue_date date,
    delivery_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_name text DEFAULT ''::text NOT NULL,
    description text,
    delivery_address text,
    acknowledged_at timestamp with time zone,
    acknowledged_by uuid,
    vendor_contact_email text,
    vendor_contact_email_updated_at timestamp with time zone,
    vendor_contact_email_updated_by uuid
);


--
-- Name: raci_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raci_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deliverable_id uuid NOT NULL,
    role_id uuid NOT NULL,
    letter public.raci_letter NOT NULL
);


--
-- Name: raci_deliverables; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raci_deliverables (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    gate_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: rate_limit_buckets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_buckets (
    key text NOT NULL,
    tokens numeric NOT NULL,
    capacity integer NOT NULL,
    refill_per_sec numeric NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_limit_buckets_capacity_check CHECK ((capacity > 0)),
    CONSTRAINT rate_limit_buckets_refill_per_sec_check CHECK ((refill_per_sec > (0)::numeric))
);


--
-- Name: resource_plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resource_plan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    plan_month date NOT NULL,
    planned_workforce integer DEFAULT 0 NOT NULL,
    planned_equipment integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: retention_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retention_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    payment_milestone_id uuid,
    invoice_ref text,
    invoice_amount numeric(16,2) DEFAULT 0 NOT NULL,
    retention_pct numeric(6,3) DEFAULT 0 NOT NULL,
    retention_amount numeric(16,2) DEFAULT 0 NOT NULL,
    status public.retention_status DEFAULT 'held'::public.retention_status NOT NULL,
    release_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rfq_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfq_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    rfq_id uuid NOT NULL,
    organization_name text DEFAULT ''::text NOT NULL,
    submitted_by uuid NOT NULL,
    price numeric(18,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    validity_days integer DEFAULT 30 NOT NULL,
    notes text,
    attachment_path text,
    status text DEFAULT 'submitted'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: rfqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rfqs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    rfq_number text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    issue_date date,
    close_date date,
    awarded_vendor text,
    estimated_value numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_name text DEFAULT ''::text NOT NULL,
    scope_summary text,
    amount_usd numeric
);


--
-- Name: risks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    risk_number text NOT NULL,
    title text NOT NULL,
    description text,
    category text,
    probability integer DEFAULT 3 NOT NULL,
    impact integer DEFAULT 3 NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    mitigation text,
    owner_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT risks_impact_range CHECK (((impact IS NULL) OR ((impact >= 1) AND (impact <= 5)))),
    CONSTRAINT risks_probability_range CHECK (((probability IS NULL) OR ((probability >= 1) AND (probability <= 5))))
);


--
-- Name: COLUMN risks.risk_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.risks.risk_number IS 'Canonical human id (RSK-####), auto-filled by set_risk_number. There is deliberately no separate `code` column.';


--
-- Name: COLUMN risks.probability; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.risks.probability IS 'Likelihood 1-5 (5x5 matrix axis).';


--
-- Name: COLUMN risks.impact; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.risks.impact IS 'Consequence 1-5 (5x5 matrix axis).';


--
-- Name: COLUMN risks.owner_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.risks.owner_id IS 'FK -> profiles.id. Risk owner; display name via join.';


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    department_id uuid NOT NULL,
    mission text,
    is_bess_critical boolean DEFAULT false NOT NULL,
    counts_toward_staffing boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: schedule_activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    activity_code text,
    name text NOT NULL,
    phase text,
    discipline text,
    gate_number integer,
    duration_days integer DEFAULT 1,
    planned_start date,
    planned_finish date,
    actual_start date,
    actual_finish date,
    percent_complete numeric DEFAULT 0,
    weight numeric DEFAULT 1,
    is_critical boolean DEFAULT false,
    is_milestone boolean DEFAULT false,
    status text DEFAULT 'not_started'::text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT schedule_activities_percent_complete_check CHECK (((percent_complete >= (0)::numeric) AND (percent_complete <= (100)::numeric))),
    CONSTRAINT schedule_activities_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'in_progress'::text, 'completed'::text, 'on_hold'::text])))
);


--
-- Name: schedule_baselines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_baselines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    name text DEFAULT 'Baseline 1'::text NOT NULL,
    snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: schedule_milestones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_milestones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    planned_start date NOT NULL,
    planned_end date NOT NULL,
    actual_start date,
    actual_end date,
    status text DEFAULT 'not_started'::text NOT NULL,
    is_critical boolean DEFAULT false NOT NULL,
    gate_number integer DEFAULT 0 NOT NULL,
    owner text DEFAULT 'Unassigned'::text NOT NULL,
    progress_pct integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: securities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.securities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    contract_id uuid,
    type text NOT NULL,
    issuer text,
    reference text,
    amount numeric DEFAULT 0,
    issue_date date,
    expiry_date date,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT securities_status_check CHECK ((status = ANY (ARRAY['active'::text, 'expired'::text, 'released'::text, 'claimed'::text]))),
    CONSTRAINT securities_type_check CHECK ((type = ANY (ARRAY['advance_payment_bond'::text, 'performance_bond'::text, 'parent_company_guarantee'::text, 'retention_bond'::text, 'insurance'::text])))
);


--
-- Name: signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid,
    entity_type public.signature_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    signer_id uuid NOT NULL,
    signer_name text NOT NULL,
    signer_role text,
    signature_image_path text NOT NULL,
    signed_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address text,
    statement text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: task_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.task_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    author_id uuid,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    deliverable_id uuid,
    title text NOT NULL,
    description text,
    assignee_role_id uuid,
    assignee_person_id uuid,
    status text DEFAULT 'todo'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    due_date date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT tasks_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text]))),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'blocked'::text, 'done'::text])))
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    plan text DEFAULT 'enterprise'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    date_format text DEFAULT 'DD/MM/YYYY'::text NOT NULL,
    language text DEFAULT 'en'::text NOT NULL,
    default_currency text DEFAULT 'USD'::text NOT NULL,
    approval_threshold_low numeric DEFAULT 50000 NOT NULL,
    approval_threshold_medium numeric DEFAULT 250000 NOT NULL,
    approval_threshold_high numeric DEFAULT 1000000 NOT NULL,
    auto_escalation_hours integer DEFAULT 24 NOT NULL,
    escalation_target text,
    notifications_email boolean DEFAULT true NOT NULL,
    notifications_push boolean DEFAULT true NOT NULL,
    notifications_in_app boolean DEFAULT true NOT NULL,
    notifications_sms boolean DEFAULT false NOT NULL,
    sso_provider text DEFAULT 'local'::text NOT NULL,
    mfa_required boolean DEFAULT false NOT NULL,
    session_timeout text DEFAULT '2 hours'::text NOT NULL,
    max_concurrent_sessions integer DEFAULT 5 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    ticket_number text NOT NULL,
    title text NOT NULL,
    description text,
    type text DEFAULT 'issue'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'normal'::text NOT NULL,
    assigned_to uuid,
    created_by uuid,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: transmittal_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transmittal_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    transmittal_id uuid NOT NULL,
    document_id uuid,
    title text NOT NULL,
    revision text DEFAULT 'A'::text,
    copies integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: transmittals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transmittals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    transmittal_no text NOT NULL,
    direction text DEFAULT 'outgoing'::text,
    from_party text,
    to_party text,
    subject text NOT NULL,
    purpose text DEFAULT 'for_information'::text,
    status text DEFAULT 'draft'::text,
    issue_date date,
    response_due date,
    response_date date,
    response_code text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT transmittals_direction_check CHECK ((direction = ANY (ARRAY['outgoing'::text, 'incoming'::text]))),
    CONSTRAINT transmittals_purpose_check CHECK ((purpose = ANY (ARRAY['for_information'::text, 'for_review'::text, 'for_approval'::text, 'for_construction'::text, 'as_built'::text]))),
    CONSTRAINT transmittals_response_code_check CHECK ((response_code = ANY (ARRAY['A'::text, 'B'::text, 'C'::text, 'D'::text]))),
    CONSTRAINT transmittals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'acknowledged'::text, 'responded'::text, 'closed'::text])))
);


--
-- Name: v_gate_progress; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_gate_progress AS
 SELECT pg.id AS phase_gate_id,
    pg.project_id,
    pg.phase_number,
    pg.phase_name,
    (pg.status)::text AS status,
    count(gs.id) AS total_signoffs,
    count(*) FILTER (WHERE (gs.status = 'signed'::text)) AS signed_count,
    COALESCE(bool_and((gs.status = 'signed'::text)), false) AS ready_to_approve
   FROM (public.phase_gates pg
     LEFT JOIN public.gate_signoffs gs ON ((gs.phase_gate_id = pg.id)))
  GROUP BY pg.id, pg.project_id, pg.phase_number, pg.phase_name, pg.status;


--
-- Name: v_inbox; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_inbox AS
 SELECT approvals.id,
    approvals.tenant_id,
    approvals.title,
    (approvals.status)::text AS status,
    (approvals.due_date)::text AS due_date,
    approvals.created_at,
    'workflow_approval'::text AS source,
    approvals.object_type
   FROM public.approvals
UNION ALL
 SELECT approval_items.id,
    approval_items.tenant_id,
    approval_items.title,
    approval_items.status,
    NULL::text AS due_date,
    approval_items.created_at,
    approval_items.type AS source,
    approval_items.type AS object_type
   FROM public.approval_items;


--
-- Name: v_project_staffing; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_project_staffing AS
 SELECT pr.id AS project_id,
    pr.name,
    count(pt.id) FILTER (WHERE r.counts_toward_staffing) AS assigned_roles,
    ( SELECT count(*) AS count
           FROM public.roles
          WHERE roles.counts_toward_staffing) AS total_roles,
    round(((100.0 * (count(pt.id) FILTER (WHERE r.counts_toward_staffing))::numeric) / (( SELECT count(*) AS count
           FROM public.roles
          WHERE roles.counts_toward_staffing))::numeric), 1) AS staffing_pct
   FROM ((public.projects pr
     LEFT JOIN public.project_team pt ON ((pt.project_id = pr.id)))
     LEFT JOIN public.roles r ON ((r.id = pt.role_id)))
  GROUP BY pr.id, pr.name;


--
-- Name: v_role_workload; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_role_workload AS
 SELECT r.id AS role_id,
    r.code,
    r.title,
    d.name AS department,
    count(*) FILTER (WHERE (ra.letter = ANY (ARRAY['A'::public.raci_letter, 'A/R'::public.raci_letter]))) AS a_count,
    count(*) FILTER (WHERE (ra.letter = ANY (ARRAY['R'::public.raci_letter, 'A/R'::public.raci_letter]))) AS r_count,
    count(*) FILTER (WHERE (ra.letter = 'C'::public.raci_letter)) AS c_count,
    count(*) FILTER (WHERE (ra.letter = 'I'::public.raci_letter)) AS i_count
   FROM ((public.roles r
     JOIN public.departments d ON ((d.id = r.department_id)))
     LEFT JOIN public.raci_assignments ra ON ((ra.role_id = r.id)))
  GROUP BY r.id, r.code, r.title, d.name;


--
-- Name: variation_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variation_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    project_id uuid NOT NULL,
    vo_number text NOT NULL,
    title text NOT NULL,
    description text,
    origin public.vo_origin DEFAULT 'client_request'::public.vo_origin NOT NULL,
    cost_impact numeric(16,2),
    time_impact_days integer,
    status public.vo_status DEFAULT 'draft'::public.vo_status NOT NULL,
    submitted_at timestamp with time zone,
    decided_at timestamp with time zone,
    baseline_updated boolean DEFAULT false NOT NULL,
    executed boolean DEFAULT false NOT NULL,
    executed_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    client_visible boolean DEFAULT false NOT NULL,
    client_cost_visible boolean DEFAULT false NOT NULL
);


--
-- Name: variations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.variations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    vo_number text NOT NULL,
    title text NOT NULL,
    description text,
    origin text DEFAULT 'client'::text,
    status text DEFAULT 'draft'::text,
    cost_impact numeric DEFAULT 0,
    schedule_impact_days integer DEFAULT 0,
    submitted_date date,
    decided_date date,
    decided_by text,
    approval_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT variations_origin_check CHECK ((origin = ANY (ARRAY['client'::text, 'contractor'::text, 'internal'::text, 'design_development'::text, 'site_condition'::text, 'force_majeure'::text]))),
    CONSTRAINT variations_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'submitted'::text, 'under_review'::text, 'approved'::text, 'rejected'::text, 'implemented'::text])))
);


--
-- Name: work_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid,
    tenant_id uuid,
    wp_code text NOT NULL,
    title text NOT NULL,
    discipline text,
    status text DEFAULT 'not_started'::text NOT NULL,
    progress_pct numeric DEFAULT 0 NOT NULL,
    planned_start date,
    planned_finish date,
    actual_start date,
    actual_finish date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    visible_to_client boolean DEFAULT false NOT NULL,
    gate_number integer DEFAULT 0 NOT NULL
);


--
-- Name: work_permits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_permits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    project_id uuid NOT NULL,
    permit_no text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    location text,
    description text,
    hazards text[] DEFAULT '{}'::text[],
    precautions text[] DEFAULT '{}'::text[],
    requested_by text,
    issuer text,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    status text DEFAULT 'requested'::text,
    suspension_reason text,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT work_permits_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'issued'::text, 'suspended'::text, 'closed'::text, 'cancelled'::text, 'expired'::text]))),
    CONSTRAINT work_permits_type_check CHECK ((type = ANY (ARRAY['hot_work'::text, 'confined_space'::text, 'working_at_height'::text, 'excavation'::text, 'electrical'::text, 'lifting'::text, 'general'::text])))
);


--
-- Name: workflow_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_definitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    object_type text NOT NULL,
    states jsonb DEFAULT '[]'::jsonb NOT NULL,
    transitions jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    instance_id uuid,
    from_state text,
    to_state text NOT NULL,
    transition_code text,
    actor_id uuid,
    comment text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: workflow_instances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workflow_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    definition_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    object_id uuid,
    object_type text NOT NULL,
    current_state text NOT NULL,
    status public.workflow_status DEFAULT 'active'::public.workflow_status NOT NULL,
    started_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_dependencies activity_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_pkey PRIMARY KEY (id);


--
-- Name: activity_dependencies activity_dependencies_predecessor_id_successor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_predecessor_id_successor_id_key UNIQUE (predecessor_id, successor_id);


--
-- Name: ai_insights ai_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_insights
    ADD CONSTRAINT ai_insights_pkey PRIMARY KEY (id);


--
-- Name: approval_conditions approval_conditions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_conditions
    ADD CONSTRAINT approval_conditions_pkey PRIMARY KEY (id);


--
-- Name: approval_events approval_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_events
    ADD CONSTRAINT approval_events_pkey PRIMARY KEY (id);


--
-- Name: approval_items approval_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_pkey PRIMARY KEY (id);


--
-- Name: approval_matrix approval_matrix_action_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_action_code_key UNIQUE (action_code);


--
-- Name: approval_matrix approval_matrix_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_pkey PRIMARY KEY (id);


--
-- Name: approval_rules approval_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_rules
    ADD CONSTRAINT approval_rules_pkey PRIMARY KEY (id);


--
-- Name: approval_steps approval_steps_approval_id_level_assigned_to_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_approval_id_level_assigned_to_key UNIQUE (approval_id, level, assigned_to);


--
-- Name: approval_steps approval_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: bess_metrics bess_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bess_metrics
    ADD CONSTRAINT bess_metrics_pkey PRIMARY KEY (id);


--
-- Name: bess_metrics bess_metrics_project_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bess_metrics
    ADD CONSTRAINT bess_metrics_project_id_date_key UNIQUE (project_id, date);


--
-- Name: cash_flow_records cash_flow_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_flow_records
    ADD CONSTRAINT cash_flow_records_pkey PRIMARY KEY (id);


--
-- Name: claims claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_pkey PRIMARY KEY (id);


--
-- Name: claims claims_project_id_claim_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_project_id_claim_number_key UNIQUE (project_id, claim_number);


--
-- Name: client_announcements client_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_announcements
    ADD CONSTRAINT client_announcements_pkey PRIMARY KEY (id);


--
-- Name: client_information_requests client_information_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_information_requests
    ADD CONSTRAINT client_information_requests_pkey PRIMARY KEY (id);


--
-- Name: client_reports client_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_reports
    ADD CONSTRAINT client_reports_pkey PRIMARY KEY (id);


--
-- Name: client_reports client_reports_project_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_reports
    ADD CONSTRAINT client_reports_project_id_version_key UNIQUE (project_id, version);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: commissioning_tests commissioning_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissioning_tests
    ADD CONSTRAINT commissioning_tests_pkey PRIMARY KEY (id);


--
-- Name: contract_milestones contract_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_milestones
    ADD CONSTRAINT contract_milestones_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_project_id_contract_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_project_id_contract_no_key UNIQUE (project_id, contract_no);


--
-- Name: copilot_audit_trail copilot_audit_trail_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_pkey PRIMARY KEY (id);


--
-- Name: copilot_conversations copilot_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_conversations
    ADD CONSTRAINT copilot_conversations_pkey PRIMARY KEY (id);


--
-- Name: copilot_intent_log copilot_intent_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_intent_log
    ADD CONSTRAINT copilot_intent_log_pkey PRIMARY KEY (id);


--
-- Name: copilot_messages copilot_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_messages
    ADD CONSTRAINT copilot_messages_pkey PRIMARY KEY (id);


--
-- Name: copilot_tenant_budget copilot_tenant_budget_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_tenant_budget
    ADD CONSTRAINT copilot_tenant_budget_pkey PRIMARY KEY (id);


--
-- Name: copilot_tenant_budget copilot_tenant_budget_tenant_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_tenant_budget
    ADD CONSTRAINT copilot_tenant_budget_tenant_id_key UNIQUE (tenant_id);


--
-- Name: cost_entries cost_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_entries
    ADD CONSTRAINT cost_entries_pkey PRIMARY KEY (id);


--
-- Name: cost_entries cost_entries_project_id_period_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_entries
    ADD CONSTRAINT cost_entries_project_id_period_category_key UNIQUE (project_id, period, category);


--
-- Name: daily_reports daily_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_pkey PRIMARY KEY (id);


--
-- Name: daily_reports daily_reports_project_id_report_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_project_id_report_date_key UNIQUE (project_id, report_date);


--
-- Name: delivery_documents delivery_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_documents
    ADD CONSTRAINT delivery_documents_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: document_files document_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_files
    ADD CONSTRAINT document_files_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: email_log email_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_pkey PRIMARY KEY (id);


--
-- Name: energy_production energy_production_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energy_production
    ADD CONSTRAINT energy_production_pkey PRIMARY KEY (id);


--
-- Name: energy_production energy_production_project_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energy_production
    ADD CONSTRAINT energy_production_project_id_date_key UNIQUE (project_id, date);


--
-- Name: engineering_packages engineering_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineering_packages
    ADD CONSTRAINT engineering_packages_pkey PRIMARY KEY (id);


--
-- Name: external_access external_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_access
    ADD CONSTRAINT external_access_pkey PRIMARY KEY (id);


--
-- Name: external_access external_access_user_id_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_access
    ADD CONSTRAINT external_access_user_id_project_id_key UNIQUE (user_id, project_id);


--
-- Name: field_photos field_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_photos
    ADD CONSTRAINT field_photos_pkey PRIMARY KEY (id);


--
-- Name: finance_records finance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_records
    ADD CONSTRAINT finance_records_pkey PRIMARY KEY (id);


--
-- Name: gate_approver_defaults gate_approver_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_approver_defaults
    ADD CONSTRAINT gate_approver_defaults_pkey PRIMARY KEY (gate_number);


--
-- Name: gate_certificates gate_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_certificates
    ADD CONSTRAINT gate_certificates_pkey PRIMARY KEY (id);


--
-- Name: gate_certificates gate_certificates_verification_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_certificates
    ADD CONSTRAINT gate_certificates_verification_id_key UNIQUE (verification_id);


--
-- Name: gate_role_requirements gate_role_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_role_requirements
    ADD CONSTRAINT gate_role_requirements_pkey PRIMARY KEY (gate_number, role_code);


--
-- Name: gate_signoff_templates gate_signoff_templates_gate_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoff_templates
    ADD CONSTRAINT gate_signoff_templates_gate_id_role_id_key UNIQUE (gate_id, role_id);


--
-- Name: gate_signoff_templates gate_signoff_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoff_templates
    ADD CONSTRAINT gate_signoff_templates_pkey PRIMARY KEY (id);


--
-- Name: gate_signoffs gate_signoffs_phase_gate_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_phase_gate_id_role_id_key UNIQUE (phase_gate_id, role_id);


--
-- Name: gate_signoffs gate_signoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_pkey PRIMARY KEY (id);


--
-- Name: gate_submissions gate_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_submissions
    ADD CONSTRAINT gate_submissions_pkey PRIMARY KEY (id);


--
-- Name: gate_submissions gate_submissions_project_id_gate_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_submissions
    ADD CONSTRAINT gate_submissions_project_id_gate_number_key UNIQUE (project_id, gate_number);


--
-- Name: gate_templates gate_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_templates
    ADD CONSTRAINT gate_templates_pkey PRIMARY KEY (id);


--
-- Name: gate_templates gate_templates_tenant_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_templates
    ADD CONSTRAINT gate_templates_tenant_id_name_key UNIQUE (tenant_id, name);


--
-- Name: gates gates_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gates
    ADD CONSTRAINT gates_code_key UNIQUE (code);


--
-- Name: gates gates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gates
    ADD CONSTRAINT gates_pkey PRIMARY KEY (id);


--
-- Name: grid_compliance_tests grid_compliance_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grid_compliance_tests
    ADD CONSTRAINT grid_compliance_tests_pkey PRIMARY KEY (id);


--
-- Name: guarantees guarantees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guarantees
    ADD CONSTRAINT guarantees_pkey PRIMARY KEY (id);


--
-- Name: handover_records handover_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.handover_records
    ADD CONSTRAINT handover_records_pkey PRIMARY KEY (id);


--
-- Name: help_articles help_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_pkey PRIMARY KEY (id);


--
-- Name: help_topics help_topics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_topics
    ADD CONSTRAINT help_topics_pkey PRIMARY KEY (id);


--
-- Name: hse_incidents hse_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hse_incidents
    ADD CONSTRAINT hse_incidents_pkey PRIMARY KEY (id);


--
-- Name: hse_permits hse_permits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hse_permits
    ADD CONSTRAINT hse_permits_pkey PRIMARY KEY (id);


--
-- Name: inspections inspections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_pkey PRIMARY KEY (id);


--
-- Name: itp_activities itp_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itp_activities
    ADD CONSTRAINT itp_activities_pkey PRIMARY KEY (id);


--
-- Name: itp_plans itp_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itp_plans
    ADD CONSTRAINT itp_plans_pkey PRIMARY KEY (id);


--
-- Name: itp_plans itp_plans_project_id_itp_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itp_plans
    ADD CONSTRAINT itp_plans_project_id_itp_no_key UNIQUE (project_id, itp_no);


--
-- Name: lender_facilities lender_facilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lender_facilities
    ADD CONSTRAINT lender_facilities_pkey PRIMARY KEY (id);


--
-- Name: lender_facilities lender_facilities_project_id_lender_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lender_facilities
    ADD CONSTRAINT lender_facilities_project_id_lender_name_key UNIQUE (project_id, lender_name);


--
-- Name: lender_reports lender_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lender_reports
    ADD CONSTRAINT lender_reports_pkey PRIMARY KEY (id);


--
-- Name: maintenance_plans maintenance_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_plans
    ADD CONSTRAINT maintenance_plans_pkey PRIMARY KEY (id);


--
-- Name: marketplace_providers marketplace_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marketplace_providers
    ADD CONSTRAINT marketplace_providers_pkey PRIMARY KEY (id);


--
-- Name: ncrs ncrs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncrs
    ADD CONSTRAINT ncrs_pkey PRIMARY KEY (id);


--
-- Name: ncrs ncrs_project_id_ncr_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncrs
    ADD CONSTRAINT ncrs_project_id_ncr_number_key UNIQUE (project_id, ncr_number);


--
-- Name: notification_prefs notification_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_prefs
    ADD CONSTRAINT notification_prefs_pkey PRIMARY KEY (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: opportunities opportunities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.opportunities
    ADD CONSTRAINT opportunities_pkey PRIMARY KEY (id);


--
-- Name: payment_certificates payment_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_certificates
    ADD CONSTRAINT payment_certificates_pkey PRIMARY KEY (id);


--
-- Name: payment_certificates payment_certificates_project_id_pc_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_certificates
    ADD CONSTRAINT payment_certificates_project_id_pc_number_key UNIQUE (project_id, pc_number);


--
-- Name: payment_milestones payment_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_milestones
    ADD CONSTRAINT payment_milestones_pkey PRIMARY KEY (id);


--
-- Name: phase_gates phase_gates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phase_gates
    ADD CONSTRAINT phase_gates_pkey PRIMARY KEY (id);


--
-- Name: phase_gates phase_gates_project_id_phase_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phase_gates
    ADD CONSTRAINT phase_gates_project_id_phase_number_key UNIQUE (project_id, phase_number);


--
-- Name: portal_invoices portal_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_invoices
    ADD CONSTRAINT portal_invoices_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: progress_updates progress_updates_activity_id_update_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT progress_updates_activity_id_update_date_key UNIQUE (activity_id, update_date);


--
-- Name: progress_updates progress_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT progress_updates_pkey PRIMARY KEY (id);


--
-- Name: project_gate_approvers project_gate_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gate_approvers
    ADD CONSTRAINT project_gate_approvers_pkey PRIMARY KEY (project_id, gate_number);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_team project_team_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_pkey PRIMARY KEY (id);


--
-- Name: project_team project_team_project_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_project_id_role_id_key UNIQUE (project_id, role_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: purchase_order_lines purchase_order_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: raci_assignments raci_assignments_deliverable_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raci_assignments
    ADD CONSTRAINT raci_assignments_deliverable_id_role_id_key UNIQUE (deliverable_id, role_id);


--
-- Name: raci_assignments raci_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raci_assignments
    ADD CONSTRAINT raci_assignments_pkey PRIMARY KEY (id);


--
-- Name: raci_deliverables raci_deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raci_deliverables
    ADD CONSTRAINT raci_deliverables_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_buckets rate_limit_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_buckets
    ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (key);


--
-- Name: resource_plan resource_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_plan
    ADD CONSTRAINT resource_plan_pkey PRIMARY KEY (id);


--
-- Name: resource_plan resource_plan_project_id_plan_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_plan
    ADD CONSTRAINT resource_plan_project_id_plan_month_key UNIQUE (project_id, plan_month);


--
-- Name: retention_entries retention_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_entries
    ADD CONSTRAINT retention_entries_pkey PRIMARY KEY (id);


--
-- Name: rfq_responses rfq_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_responses
    ADD CONSTRAINT rfq_responses_pkey PRIMARY KEY (id);


--
-- Name: rfqs rfqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT rfqs_pkey PRIMARY KEY (id);


--
-- Name: risks risks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT risks_pkey PRIMARY KEY (id);


--
-- Name: roles roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_code_key UNIQUE (code);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: schedule_activities schedule_activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_activities
    ADD CONSTRAINT schedule_activities_pkey PRIMARY KEY (id);


--
-- Name: schedule_baselines schedule_baselines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baselines
    ADD CONSTRAINT schedule_baselines_pkey PRIMARY KEY (id);


--
-- Name: schedule_milestones schedule_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_milestones
    ADD CONSTRAINT schedule_milestones_pkey PRIMARY KEY (id);


--
-- Name: securities securities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_pkey PRIMARY KEY (id);


--
-- Name: signatures signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_pkey PRIMARY KEY (id);


--
-- Name: task_comments task_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_slug_key UNIQUE (slug);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: transmittal_items transmittal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transmittal_items
    ADD CONSTRAINT transmittal_items_pkey PRIMARY KEY (id);


--
-- Name: transmittals transmittals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_pkey PRIMARY KEY (id);


--
-- Name: transmittals transmittals_project_id_transmittal_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_project_id_transmittal_no_key UNIQUE (project_id, transmittal_no);


--
-- Name: variation_orders variation_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_pkey PRIMARY KEY (id);


--
-- Name: variation_orders variation_orders_project_id_vo_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_project_id_vo_number_key UNIQUE (project_id, vo_number);


--
-- Name: variations variations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variations
    ADD CONSTRAINT variations_pkey PRIMARY KEY (id);


--
-- Name: variations variations_project_id_vo_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variations
    ADD CONSTRAINT variations_project_id_vo_number_key UNIQUE (project_id, vo_number);


--
-- Name: work_packages work_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_packages
    ADD CONSTRAINT work_packages_pkey PRIMARY KEY (id);


--
-- Name: work_permits work_permits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_permits
    ADD CONSTRAINT work_permits_pkey PRIMARY KEY (id);


--
-- Name: work_permits work_permits_project_id_permit_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_permits
    ADD CONSTRAINT work_permits_project_id_permit_no_key UNIQUE (project_id, permit_no);


--
-- Name: workflow_definitions workflow_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_pkey PRIMARY KEY (id);


--
-- Name: workflow_definitions workflow_definitions_tenant_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_tenant_id_code_key UNIQUE (tenant_id, code);


--
-- Name: workflow_events workflow_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_pkey PRIMARY KEY (id);


--
-- Name: workflow_instances workflow_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_pkey PRIMARY KEY (id);


--
-- Name: cir_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cir_project_idx ON public.client_information_requests USING btree (project_id, created_at DESC);


--
-- Name: client_ann_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_ann_project_idx ON public.client_announcements USING btree (project_id, published_at DESC);


--
-- Name: client_announcements_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_announcements_project_idx ON public.client_announcements USING btree (project_id, published_at DESC);


--
-- Name: client_reports_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX client_reports_project_idx ON public.client_reports USING btree (project_id, version DESC);


--
-- Name: comments_object_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX comments_object_idx ON public.comments USING btree (object_type, object_id);


--
-- Name: cost_entries_project_period_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cost_entries_project_period_idx ON public.cost_entries USING btree (project_id, period);


--
-- Name: delivery_docs_po_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX delivery_docs_po_idx ON public.delivery_documents USING btree (po_id);


--
-- Name: email_log_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_log_created_idx ON public.email_log USING btree (created_at DESC);


--
-- Name: email_log_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_log_user_idx ON public.email_log USING btree (user_id);


--
-- Name: external_access_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_access_active_idx ON public.external_access USING btree (user_id, project_id) WHERE (revoked_at IS NULL);


--
-- Name: external_access_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_access_project_idx ON public.external_access USING btree (project_id);


--
-- Name: external_access_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX external_access_user_idx ON public.external_access USING btree (user_id);


--
-- Name: gate_certs_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gate_certs_project_idx ON public.gate_certificates USING btree (project_id, issued_at DESC);


--
-- Name: gate_templates_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gate_templates_tenant_idx ON public.gate_templates USING btree (tenant_id);


--
-- Name: guarantees_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guarantees_project_idx ON public.guarantees USING btree (project_id);


--
-- Name: idx_approval_events; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_events ON public.approval_events USING btree (approval_id, created_at);


--
-- Name: idx_approval_events_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_events_approval ON public.approval_events USING btree (approval_id, created_at);


--
-- Name: idx_approval_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approval_items_status ON public.approval_items USING btree (status);


--
-- Name: idx_approvals_tenant_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_tenant_pending ON public.approvals USING btree (tenant_id) WHERE (status = 'pending'::public.approval_status);


--
-- Name: idx_approvals_tenant_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_approvals_tenant_status_created ON public.approvals USING btree (tenant_id, status, created_at DESC);


--
-- Name: idx_audit_changed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_changed_at ON public.audit_log USING btree (changed_at);


--
-- Name: idx_audit_log_tenant_changed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_tenant_changed ON public.audit_log USING btree (tenant_id, changed_at DESC);


--
-- Name: idx_audit_table_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_table_record ON public.audit_log USING btree (table_name, record_id);


--
-- Name: idx_conditions_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conditions_approval ON public.approval_conditions USING btree (approval_id);


--
-- Name: idx_copilot_audit_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_audit_created ON public.copilot_audit_trail USING btree (created_at DESC);


--
-- Name: idx_copilot_audit_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_audit_tenant ON public.copilot_audit_trail USING btree (tenant_id);


--
-- Name: idx_copilot_audit_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_audit_user ON public.copilot_audit_trail USING btree (user_id);


--
-- Name: idx_copilot_budget_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_budget_tenant ON public.copilot_tenant_budget USING btree (tenant_id);


--
-- Name: idx_copilot_conversations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_conversations_created_at ON public.copilot_conversations USING btree (created_at DESC);


--
-- Name: idx_copilot_conversations_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_conversations_tenant_id ON public.copilot_conversations USING btree (tenant_id);


--
-- Name: idx_copilot_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_conversations_user_id ON public.copilot_conversations USING btree (user_id);


--
-- Name: idx_copilot_intent_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_intent_created ON public.copilot_intent_log USING btree (created_at DESC);


--
-- Name: idx_copilot_intent_hit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_intent_hit ON public.copilot_intent_log USING btree (was_catalog_hit);


--
-- Name: idx_copilot_intent_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_intent_tenant ON public.copilot_intent_log USING btree (tenant_id);


--
-- Name: idx_copilot_intent_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_intent_user ON public.copilot_intent_log USING btree (user_id);


--
-- Name: idx_copilot_messages_conversation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_messages_conversation_id ON public.copilot_messages USING btree (conversation_id);


--
-- Name: idx_copilot_messages_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_copilot_messages_created_at ON public.copilot_messages USING btree (created_at DESC);


--
-- Name: idx_daily_reports_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_daily_reports_project ON public.daily_reports USING btree (project_id, report_date);


--
-- Name: idx_documents_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documents_project ON public.documents USING btree (project_id, created_at DESC);


--
-- Name: idx_field_photos_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_field_photos_project ON public.field_photos USING btree (project_id);


--
-- Name: idx_finance_records_tenant_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_finance_records_tenant_project ON public.finance_records USING btree (tenant_id, project_id);


--
-- Name: idx_itp_activities_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_itp_activities_plan ON public.itp_activities USING btree (itp_id, seq);


--
-- Name: idx_lender_reports_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lender_reports_project ON public.lender_reports USING btree (project_id, period_end);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, created_at DESC) WHERE (is_read = false);


--
-- Name: idx_phase_gates_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_phase_gates_project ON public.phase_gates USING btree (project_id, phase_number);


--
-- Name: idx_progress_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_progress_project ON public.progress_updates USING btree (project_id, update_date);


--
-- Name: idx_project_team_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_project_team_person ON public.project_team USING btree (person_id);


--
-- Name: idx_projects_tenant_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_tenant_created ON public.projects USING btree (tenant_id, created_at DESC);


--
-- Name: idx_raci_deliv_gate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raci_deliv_gate ON public.raci_deliverables USING btree (gate_id);


--
-- Name: idx_resource_plan_project_month; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resource_plan_project_month ON public.resource_plan USING btree (project_id, plan_month);


--
-- Name: idx_risks_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risks_tenant_status ON public.risks USING btree (tenant_id, status);


--
-- Name: idx_sched_act_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sched_act_project ON public.schedule_activities USING btree (project_id);


--
-- Name: idx_schedule_activities_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schedule_activities_project ON public.schedule_activities USING btree (project_id);


--
-- Name: idx_securities_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_securities_expiry ON public.securities USING btree (project_id, expiry_date);


--
-- Name: idx_steps_approval; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_steps_approval ON public.approval_steps USING btree (approval_id, level);


--
-- Name: idx_tasks_assignee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_assignee ON public.tasks USING btree (assignee_person_id, status);


--
-- Name: idx_tasks_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_due ON public.tasks USING btree (due_date) WHERE (status <> 'done'::text);


--
-- Name: idx_tasks_project_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_project_status ON public.tasks USING btree (project_id, status);


--
-- Name: idx_variations_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_variations_project ON public.variations USING btree (project_id);


--
-- Name: idx_work_permits_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_work_permits_project ON public.work_permits USING btree (project_id, status);


--
-- Name: idx_workflow_events_instance_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_events_instance_created ON public.workflow_events USING btree (instance_id, created_at DESC);


--
-- Name: idx_workflow_events_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workflow_events_project ON public.workflow_events USING btree (((metadata ->> 'project_id'::text)));


--
-- Name: ncrs_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ncrs_project_idx ON public.ncrs USING btree (project_id);


--
-- Name: ncrs_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ncrs_status_idx ON public.ncrs USING btree (status);


--
-- Name: one_accountable_per_deliverable; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_accountable_per_deliverable ON public.raci_assignments USING btree (deliverable_id) WHERE (letter = ANY (ARRAY['A'::public.raci_letter, 'A/R'::public.raci_letter]));


--
-- Name: payment_milestones_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_milestones_project_idx ON public.payment_milestones USING btree (project_id);


--
-- Name: po_lines_po_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX po_lines_po_idx ON public.purchase_order_lines USING btree (po_id, line_no);


--
-- Name: portal_invoices_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portal_invoices_project_idx ON public.portal_invoices USING btree (project_id);


--
-- Name: portal_invoices_submitter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX portal_invoices_submitter_idx ON public.portal_invoices USING btree (submitted_by);


--
-- Name: projects_tenant_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX projects_tenant_code_key ON public.projects USING btree (tenant_id, code);


--
-- Name: retention_entries_milestone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX retention_entries_milestone_idx ON public.retention_entries USING btree (payment_milestone_id);


--
-- Name: retention_entries_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX retention_entries_project_idx ON public.retention_entries USING btree (project_id);


--
-- Name: rfq_responses_rfq_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rfq_responses_rfq_idx ON public.rfq_responses USING btree (rfq_id);


--
-- Name: rfq_responses_submitter_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rfq_responses_submitter_idx ON public.rfq_responses USING btree (submitted_by);


--
-- Name: risks_owner_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risks_owner_id_idx ON public.risks USING btree (owner_id);


--
-- Name: risks_project_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX risks_project_id_idx ON public.risks USING btree (project_id);


--
-- Name: schedule_milestones_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_milestones_project_idx ON public.schedule_milestones USING btree (project_id, planned_start);


--
-- Name: signatures_entity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signatures_entity_idx ON public.signatures USING btree (entity_type, entity_id);


--
-- Name: signatures_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX signatures_project_idx ON public.signatures USING btree (project_id, signed_at DESC);


--
-- Name: variation_orders_project_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX variation_orders_project_idx ON public.variation_orders USING btree (project_id);


--
-- Name: variation_orders_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX variation_orders_status_idx ON public.variation_orders USING btree (status);


--
-- Name: approvals approvals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER approvals_updated_at BEFORE UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: approvals audit_approvals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_approvals AFTER INSERT OR DELETE OR UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: claims audit_claims; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_claims AFTER INSERT OR DELETE OR UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: contracts audit_contracts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_contracts AFTER INSERT OR DELETE OR UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: finance_records audit_finance_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_finance_records AFTER INSERT OR DELETE OR UPDATE ON public.finance_records FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: ncrs audit_ncrs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_ncrs AFTER INSERT OR DELETE OR UPDATE ON public.ncrs FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: payment_certificates audit_payment_certificates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_payment_certificates AFTER INSERT OR DELETE OR UPDATE ON public.payment_certificates FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: projects audit_projects; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_projects AFTER INSERT OR DELETE OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: risks audit_risks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_risks AFTER INSERT OR DELETE OR UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: schedule_milestones audit_schedule_milestones; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_schedule_milestones AFTER INSERT OR DELETE OR UPDATE ON public.schedule_milestones FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: variation_orders audit_variation_orders; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_variation_orders AFTER INSERT OR DELETE OR UPDATE ON public.variation_orders FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: work_permits audit_work_permits; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER audit_work_permits AFTER INSERT OR DELETE OR UPDATE ON public.work_permits FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


--
-- Name: documents documents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: phase_gates phase_gates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER phase_gates_updated_at BEFORE UPDATE ON public.phase_gates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: tenants tenants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: phase_gates trg_enforce_gate_approval; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_gate_approval BEFORE UPDATE OF status ON public.phase_gates FOR EACH ROW EXECUTE FUNCTION public.enforce_gate_approval();


--
-- Name: ncrs trg_set_ncr_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_ncr_number BEFORE INSERT ON public.ncrs FOR EACH ROW EXECUTE FUNCTION public.set_ncr_number();


--
-- Name: risks trg_set_risk_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_risk_number BEFORE INSERT ON public.risks FOR EACH ROW EXECUTE FUNCTION public.set_risk_number();


--
-- Name: tickets trg_set_ticket_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_ticket_number BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.set_ticket_number();


--
-- Name: variation_orders trg_set_vo_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_vo_number BEFORE INSERT ON public.variation_orders FOR EACH ROW EXECUTE FUNCTION public.set_vo_number();


--
-- Name: phase_gates trg_spawn_gate_signoffs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_spawn_gate_signoffs AFTER INSERT OR UPDATE OF status ON public.phase_gates FOR EACH ROW EXECUTE FUNCTION public.spawn_gate_signoffs();


--
-- Name: tasks trg_tasks_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tasks_touch BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();


--
-- Name: workflow_instances wf_inst_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER wf_inst_updated_at BEFORE UPDATE ON public.workflow_instances FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: activity_dependencies activity_dependencies_predecessor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_predecessor_id_fkey FOREIGN KEY (predecessor_id) REFERENCES public.schedule_activities(id) ON DELETE CASCADE;


--
-- Name: activity_dependencies activity_dependencies_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: activity_dependencies activity_dependencies_successor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_dependencies
    ADD CONSTRAINT activity_dependencies_successor_id_fkey FOREIGN KEY (successor_id) REFERENCES public.schedule_activities(id) ON DELETE CASCADE;


--
-- Name: approval_conditions approval_conditions_approval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_conditions
    ADD CONSTRAINT approval_conditions_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE CASCADE;


--
-- Name: approval_events approval_events_approval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_events
    ADD CONSTRAINT approval_events_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE CASCADE;


--
-- Name: approval_items approval_items_phase_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_phase_gate_id_fkey FOREIGN KEY (phase_gate_id) REFERENCES public.phase_gates(id) ON DELETE SET NULL;


--
-- Name: approval_items approval_items_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: approval_items approval_items_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: approval_items approval_items_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_items
    ADD CONSTRAINT approval_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: approval_matrix approval_matrix_approver_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_approver_role_fkey FOREIGN KEY (approver_role) REFERENCES public.roles(code);


--
-- Name: approval_matrix approval_matrix_department_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_department_code_fkey FOREIGN KEY (department_code) REFERENCES public.departments(code);


--
-- Name: approval_matrix approval_matrix_initiator_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_initiator_role_fkey FOREIGN KEY (initiator_role) REFERENCES public.roles(code);


--
-- Name: approval_matrix approval_matrix_secondary_approver_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_matrix
    ADD CONSTRAINT approval_matrix_secondary_approver_role_fkey FOREIGN KEY (secondary_approver_role) REFERENCES public.roles(code);


--
-- Name: approval_rules approval_rules_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_rules
    ADD CONSTRAINT approval_rules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: approval_steps approval_steps_approval_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_steps
    ADD CONSTRAINT approval_steps_approval_id_fkey FOREIGN KEY (approval_id) REFERENCES public.approvals(id) ON DELETE CASCADE;


--
-- Name: approvals approvals_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.profiles(id);


--
-- Name: approvals approvals_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.workflow_instances(id);


--
-- Name: approvals approvals_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: assets assets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: assets assets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: bess_metrics bess_metrics_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bess_metrics
    ADD CONSTRAINT bess_metrics_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: claims claims_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.claims
    ADD CONSTRAINT claims_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: client_announcements client_announcements_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_announcements
    ADD CONSTRAINT client_announcements_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: client_information_requests client_information_requests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_information_requests
    ADD CONSTRAINT client_information_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: client_reports client_reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_reports
    ADD CONSTRAINT client_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: comments comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id);


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: commissioning_tests commissioning_tests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissioning_tests
    ADD CONSTRAINT commissioning_tests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: commissioning_tests commissioning_tests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.commissioning_tests
    ADD CONSTRAINT commissioning_tests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: contract_milestones contract_milestones_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contract_milestones
    ADD CONSTRAINT contract_milestones_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;


--
-- Name: contracts contracts_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: copilot_audit_trail copilot_audit_trail_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id) ON DELETE CASCADE;


--
-- Name: copilot_audit_trail copilot_audit_trail_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.copilot_messages(id) ON DELETE CASCADE;


--
-- Name: copilot_audit_trail copilot_audit_trail_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: copilot_audit_trail copilot_audit_trail_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_audit_trail
    ADD CONSTRAINT copilot_audit_trail_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: copilot_conversations copilot_conversations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_conversations
    ADD CONSTRAINT copilot_conversations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: copilot_conversations copilot_conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_conversations
    ADD CONSTRAINT copilot_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: copilot_intent_log copilot_intent_log_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_intent_log
    ADD CONSTRAINT copilot_intent_log_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id) ON DELETE CASCADE;


--
-- Name: copilot_intent_log copilot_intent_log_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_intent_log
    ADD CONSTRAINT copilot_intent_log_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: copilot_intent_log copilot_intent_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_intent_log
    ADD CONSTRAINT copilot_intent_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: copilot_messages copilot_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_messages
    ADD CONSTRAINT copilot_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.copilot_conversations(id) ON DELETE CASCADE;


--
-- Name: copilot_tenant_budget copilot_tenant_budget_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.copilot_tenant_budget
    ADD CONSTRAINT copilot_tenant_budget_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: cost_entries cost_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_entries
    ADD CONSTRAINT cost_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: daily_reports daily_reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_reports
    ADD CONSTRAINT daily_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: delivery_documents delivery_documents_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_documents
    ADD CONSTRAINT delivery_documents_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: delivery_documents delivery_documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_documents
    ADD CONSTRAINT delivery_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: documents documents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: documents documents_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: energy_production energy_production_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.energy_production
    ADD CONSTRAINT energy_production_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: engineering_packages engineering_packages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineering_packages
    ADD CONSTRAINT engineering_packages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: engineering_packages engineering_packages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.engineering_packages
    ADD CONSTRAINT engineering_packages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: external_access external_access_granted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_access
    ADD CONSTRAINT external_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id);


--
-- Name: external_access external_access_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.external_access
    ADD CONSTRAINT external_access_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: field_photos field_photos_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_photos
    ADD CONSTRAINT field_photos_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: field_photos field_photos_report_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_photos
    ADD CONSTRAINT field_photos_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.daily_reports(id) ON DELETE CASCADE;


--
-- Name: field_photos field_photos_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.field_photos
    ADD CONSTRAINT field_photos_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: finance_records finance_records_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_records
    ADD CONSTRAINT finance_records_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: finance_records finance_records_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.finance_records
    ADD CONSTRAINT finance_records_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: gate_approver_defaults gate_approver_defaults_primary_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_approver_defaults
    ADD CONSTRAINT gate_approver_defaults_primary_role_fkey FOREIGN KEY (primary_role) REFERENCES public.roles(code);


--
-- Name: gate_approver_defaults gate_approver_defaults_secondary_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_approver_defaults
    ADD CONSTRAINT gate_approver_defaults_secondary_role_fkey FOREIGN KEY (secondary_role) REFERENCES public.roles(code);


--
-- Name: gate_certificates gate_certificates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_certificates
    ADD CONSTRAINT gate_certificates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: gate_role_requirements gate_role_requirements_role_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_role_requirements
    ADD CONSTRAINT gate_role_requirements_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code);


--
-- Name: gate_signoff_templates gate_signoff_templates_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoff_templates
    ADD CONSTRAINT gate_signoff_templates_gate_id_fkey FOREIGN KEY (gate_id) REFERENCES public.gates(id);


--
-- Name: gate_signoff_templates gate_signoff_templates_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoff_templates
    ADD CONSTRAINT gate_signoff_templates_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: gate_signoffs gate_signoffs_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.profiles(id);


--
-- Name: gate_signoffs gate_signoffs_phase_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_phase_gate_id_fkey FOREIGN KEY (phase_gate_id) REFERENCES public.phase_gates(id) ON DELETE CASCADE;


--
-- Name: gate_signoffs gate_signoffs_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: gate_signoffs gate_signoffs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gate_signoffs
    ADD CONSTRAINT gate_signoffs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: grid_compliance_tests grid_compliance_tests_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grid_compliance_tests
    ADD CONSTRAINT grid_compliance_tests_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: guarantees guarantees_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guarantees
    ADD CONSTRAINT guarantees_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: help_articles help_articles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_articles
    ADD CONSTRAINT help_articles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: help_topics help_topics_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.help_topics
    ADD CONSTRAINT help_topics_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: hse_incidents hse_incidents_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hse_incidents
    ADD CONSTRAINT hse_incidents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: hse_permits hse_permits_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hse_permits
    ADD CONSTRAINT hse_permits_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: inspections inspections_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: inspections inspections_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inspections
    ADD CONSTRAINT inspections_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: itp_activities itp_activities_itp_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itp_activities
    ADD CONSTRAINT itp_activities_itp_id_fkey FOREIGN KEY (itp_id) REFERENCES public.itp_plans(id) ON DELETE CASCADE;


--
-- Name: itp_plans itp_plans_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.itp_plans
    ADD CONSTRAINT itp_plans_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: lender_facilities lender_facilities_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lender_facilities
    ADD CONSTRAINT lender_facilities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: lender_reports lender_reports_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lender_reports
    ADD CONSTRAINT lender_reports_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: maintenance_plans maintenance_plans_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_plans
    ADD CONSTRAINT maintenance_plans_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.assets(id) ON DELETE CASCADE;


--
-- Name: maintenance_plans maintenance_plans_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.maintenance_plans
    ADD CONSTRAINT maintenance_plans_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: ncrs ncrs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncrs
    ADD CONSTRAINT ncrs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: ncrs ncrs_raised_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ncrs
    ADD CONSTRAINT ncrs_raised_by_fkey FOREIGN KEY (raised_by) REFERENCES public.profiles(id);


--
-- Name: notifications notifications_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: payment_certificates payment_certificates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_certificates
    ADD CONSTRAINT payment_certificates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: payment_milestones payment_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_milestones
    ADD CONSTRAINT payment_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: phase_gates phase_gates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.phase_gates
    ADD CONSTRAINT phase_gates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: portal_invoices portal_invoices_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_invoices
    ADD CONSTRAINT portal_invoices_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;


--
-- Name: portal_invoices portal_invoices_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.portal_invoices
    ADD CONSTRAINT portal_invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: progress_updates progress_updates_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT progress_updates_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.schedule_activities(id) ON DELETE CASCADE;


--
-- Name: progress_updates progress_updates_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.progress_updates
    ADD CONSTRAINT progress_updates_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_gate_approvers project_gate_approvers_primary_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gate_approvers
    ADD CONSTRAINT project_gate_approvers_primary_role_fkey FOREIGN KEY (primary_role) REFERENCES public.roles(code);


--
-- Name: project_gate_approvers project_gate_approvers_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gate_approvers
    ADD CONSTRAINT project_gate_approvers_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_gate_approvers project_gate_approvers_secondary_role_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_gate_approvers
    ADD CONSTRAINT project_gate_approvers_secondary_role_fkey FOREIGN KEY (secondary_role) REFERENCES public.roles(code);


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_team project_team_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.profiles(id);


--
-- Name: project_team project_team_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_team project_team_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: project_team project_team_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_team
    ADD CONSTRAINT project_team_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: projects projects_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: purchase_order_lines purchase_order_lines_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_order_lines
    ADD CONSTRAINT purchase_order_lines_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: raci_assignments raci_assignments_deliverable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raci_assignments
    ADD CONSTRAINT raci_assignments_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.raci_deliverables(id) ON DELETE CASCADE;


--
-- Name: raci_assignments raci_assignments_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raci_assignments
    ADD CONSTRAINT raci_assignments_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id);


--
-- Name: raci_deliverables raci_deliverables_gate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raci_deliverables
    ADD CONSTRAINT raci_deliverables_gate_id_fkey FOREIGN KEY (gate_id) REFERENCES public.gates(id);


--
-- Name: resource_plan resource_plan_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_plan
    ADD CONSTRAINT resource_plan_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: retention_entries retention_entries_payment_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_entries
    ADD CONSTRAINT retention_entries_payment_milestone_id_fkey FOREIGN KEY (payment_milestone_id) REFERENCES public.payment_milestones(id) ON DELETE SET NULL;


--
-- Name: retention_entries retention_entries_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retention_entries
    ADD CONSTRAINT retention_entries_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: rfq_responses rfq_responses_rfq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfq_responses
    ADD CONSTRAINT rfq_responses_rfq_id_fkey FOREIGN KEY (rfq_id) REFERENCES public.rfqs(id) ON DELETE CASCADE;


--
-- Name: rfqs rfqs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT rfqs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: rfqs rfqs_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rfqs
    ADD CONSTRAINT rfqs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: risks risks_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT risks_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: risks risks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT risks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: risks risks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risks
    ADD CONSTRAINT risks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: roles roles_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: schedule_activities schedule_activities_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_activities
    ADD CONSTRAINT schedule_activities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: schedule_baselines schedule_baselines_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_baselines
    ADD CONSTRAINT schedule_baselines_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: schedule_milestones schedule_milestones_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_milestones
    ADD CONSTRAINT schedule_milestones_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: securities securities_contract_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_contract_id_fkey FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE SET NULL;


--
-- Name: securities securities_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.securities
    ADD CONSTRAINT securities_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: signatures signatures_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.signatures
    ADD CONSTRAINT signatures_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;


--
-- Name: task_comments task_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);


--
-- Name: task_comments task_comments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.task_comments
    ADD CONSTRAINT task_comments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_assignee_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_person_id_fkey FOREIGN KEY (assignee_person_id) REFERENCES public.profiles(id);


--
-- Name: tasks tasks_assignee_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_assignee_role_id_fkey FOREIGN KEY (assignee_role_id) REFERENCES public.roles(id);


--
-- Name: tasks tasks_deliverable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.raci_deliverables(id) ON DELETE SET NULL;


--
-- Name: tasks tasks_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: tickets tickets_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);


--
-- Name: tickets tickets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: tickets tickets_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: transmittal_items transmittal_items_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transmittal_items
    ADD CONSTRAINT transmittal_items_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.document_files(id) ON DELETE SET NULL;


--
-- Name: transmittal_items transmittal_items_transmittal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transmittal_items
    ADD CONSTRAINT transmittal_items_transmittal_id_fkey FOREIGN KEY (transmittal_id) REFERENCES public.transmittals(id) ON DELETE CASCADE;


--
-- Name: transmittals transmittals_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transmittals
    ADD CONSTRAINT transmittals_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: variation_orders variation_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id);


--
-- Name: variation_orders variation_orders_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variation_orders
    ADD CONSTRAINT variation_orders_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: variations variations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.variations
    ADD CONSTRAINT variations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: work_packages work_packages_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_packages
    ADD CONSTRAINT work_packages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: work_packages work_packages_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_packages
    ADD CONSTRAINT work_packages_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: work_permits work_permits_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_permits
    ADD CONSTRAINT work_permits_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: workflow_definitions workflow_definitions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_definitions
    ADD CONSTRAINT workflow_definitions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: workflow_events workflow_events_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id);


--
-- Name: workflow_events workflow_events_instance_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_events
    ADD CONSTRAINT workflow_events_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.workflow_instances(id) ON DELETE CASCADE;


--
-- Name: workflow_instances workflow_instances_definition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_definition_id_fkey FOREIGN KEY (definition_id) REFERENCES public.workflow_definitions(id);


--
-- Name: workflow_instances workflow_instances_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workflow_instances
    ADD CONSTRAINT workflow_instances_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: activity_dependencies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_dependencies ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

--
-- Name: client_announcements ann_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ann_external_read ON public.client_announcements FOR SELECT TO authenticated USING ((public.is_external_role() AND public.has_external_access(project_id)));


--
-- Name: client_announcements ann_internal_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ann_internal_read ON public.client_announcements FOR SELECT TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: approval_conditions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_conditions ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_items ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_matrix; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_matrix ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_matrix approval_matrix_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_matrix_read ON public.approval_matrix FOR SELECT USING (true);


--
-- Name: approval_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: approval_rules approval_rules_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_rules_insert ON public.approval_rules FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: approval_rules approval_rules_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approval_rules_select ON public.approval_rules FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: approval_steps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: approvals approvals_external_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approvals_external_block ON public.approvals AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: approvals approvals_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approvals_insert ON public.approvals FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: approvals approvals_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approvals_select ON public.approvals FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: approvals approvals_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY approvals_update ON public.approvals FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: assets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log audit_log_select_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY audit_log_select_admin ON public.audit_log FOR SELECT USING ((public.current_user_role() = ANY (ARRAY['system_admin'::text, 'tenant_admin'::text])));


--
-- Name: departments authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.departments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: gate_approver_defaults authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.gate_approver_defaults TO authenticated USING (true) WITH CHECK (true);


--
-- Name: gate_role_requirements authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.gate_role_requirements TO authenticated USING (true) WITH CHECK (true);


--
-- Name: gate_signoff_templates authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.gate_signoff_templates TO authenticated USING (true) WITH CHECK (true);


--
-- Name: gates authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.gates TO authenticated USING (true) WITH CHECK (true);


--
-- Name: raci_assignments authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.raci_assignments TO authenticated USING (true) WITH CHECK (true);


--
-- Name: raci_deliverables authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.raci_deliverables TO authenticated USING (true) WITH CHECK (true);


--
-- Name: roles authenticated_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authenticated_all ON public.roles TO authenticated USING (true) WITH CHECK (true);


--
-- Name: bess_metrics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bess_metrics ENABLE ROW LEVEL SECURITY;

--
-- Name: bess_metrics bess_metrics_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bess_metrics_delete ON public.bess_metrics FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: bess_metrics bess_metrics_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bess_metrics_insert ON public.bess_metrics FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: bess_metrics bess_metrics_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bess_metrics_select ON public.bess_metrics FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: bess_metrics bess_metrics_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bess_metrics_update ON public.bess_metrics FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: client_announcements ca_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ca_read ON public.client_announcements FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR public.has_external_access(project_id)));


--
-- Name: cash_flow_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cash_flow_records ENABLE ROW LEVEL SECURITY;

--
-- Name: client_information_requests cir_client_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cir_client_insert ON public.client_information_requests FOR INSERT TO authenticated WITH CHECK (((requested_by = auth.uid()) AND public.is_external_role() AND public.has_external_access(project_id)));


--
-- Name: client_information_requests cir_client_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cir_client_read ON public.client_information_requests FOR SELECT TO authenticated USING ((requested_by = auth.uid()));


--
-- Name: client_information_requests cir_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cir_insert ON public.client_information_requests FOR INSERT TO authenticated WITH CHECK ((requested_by = auth.uid()));


--
-- Name: client_information_requests cir_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cir_update ON public.client_information_requests FOR UPDATE TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

--
-- Name: client_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: client_information_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_information_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: client_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: client_reports client_reports_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_reports_external_read ON public.client_reports AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((status = 'issued'::text) AND public.has_external_access(project_id))));


--
-- Name: client_reports client_reports_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_reports_read ON public.client_reports FOR SELECT TO authenticated USING (true);


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: comments comments_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_insert_auth ON public.comments FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) OR (tenant_id = '00000000-0000-0000-0000-000000000001'::uuid)));


--
-- Name: comments comments_select_tenant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_select_tenant ON public.comments FOR SELECT USING (((tenant_id = '00000000-0000-0000-0000-000000000001'::uuid) OR (auth.uid() IS NOT NULL)));


--
-- Name: comments comments_update_author; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY comments_update_author ON public.comments FOR UPDATE USING ((auth.uid() = author_id));


--
-- Name: commissioning_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.commissioning_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contract_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: contract_milestones contract_milestones_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contract_milestones_delete ON public.contract_milestones FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: contract_milestones contract_milestones_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contract_milestones_insert ON public.contract_milestones FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: contract_milestones contract_milestones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contract_milestones_select ON public.contract_milestones FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: contract_milestones contract_milestones_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contract_milestones_update ON public.contract_milestones FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts contracts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_delete ON public.contracts FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: contracts contracts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_insert ON public.contracts FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: contracts contracts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_select ON public.contracts FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: contracts contracts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_update ON public.contracts FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: copilot_audit_trail; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.copilot_audit_trail ENABLE ROW LEVEL SECURITY;

--
-- Name: copilot_audit_trail copilot_audit_viewer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY copilot_audit_viewer ON public.copilot_audit_trail USING ((user_id = auth.uid())) WITH CHECK (false);


--
-- Name: copilot_tenant_budget copilot_budget_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY copilot_budget_admin ON public.copilot_tenant_budget USING (false) WITH CHECK (false);


--
-- Name: copilot_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: copilot_conversations copilot_conversations_user_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY copilot_conversations_user_access ON public.copilot_conversations USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: copilot_intent_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.copilot_intent_log ENABLE ROW LEVEL SECURITY;

--
-- Name: copilot_intent_log copilot_intent_log_viewer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY copilot_intent_log_viewer ON public.copilot_intent_log USING ((user_id = auth.uid())) WITH CHECK (false);


--
-- Name: copilot_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.copilot_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: copilot_messages copilot_messages_access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY copilot_messages_access ON public.copilot_messages USING ((conversation_id IN ( SELECT copilot_conversations.id
   FROM public.copilot_conversations
  WHERE (copilot_conversations.user_id = auth.uid())))) WITH CHECK ((conversation_id IN ( SELECT copilot_conversations.id
   FROM public.copilot_conversations
  WHERE (copilot_conversations.user_id = auth.uid()))));


--
-- Name: copilot_tenant_budget; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.copilot_tenant_budget ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cost_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: cost_entries cost_entries_external_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_entries_external_block ON public.cost_entries AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: cost_entries cost_entries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cost_entries_select ON public.cost_entries FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: client_reports cr_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cr_external_read ON public.client_reports AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((status = 'issued'::text) AND (public.current_user_role() = 'client_viewer'::text) AND public.has_external_access(project_id))));


--
-- Name: daily_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: delivery_documents dd_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY dd_insert ON public.delivery_documents FOR INSERT TO authenticated WITH CHECK ((submitted_by = auth.uid()));


--
-- Name: delivery_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.delivery_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: departments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

--
-- Name: document_files doc_files_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY doc_files_external_read ON public.document_files AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((visible_to_client = true) AND public.has_external_access(project_id))));


--
-- Name: documents docs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY docs_insert ON public.documents FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: documents docs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY docs_select ON public.documents FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: documents docs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY docs_update ON public.documents FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: document_files; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;

--
-- Name: documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

--
-- Name: documents documents_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documents_external_read ON public.documents AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((visible_to_client = true) AND public.has_external_access(project_id))));


--
-- Name: email_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_log email_log_external_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_log_external_block ON public.email_log AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: email_log email_log_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_log_select_own ON public.email_log FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: energy_production; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.energy_production ENABLE ROW LEVEL SECURITY;

--
-- Name: energy_production energy_production_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY energy_production_delete ON public.energy_production FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: energy_production energy_production_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY energy_production_insert ON public.energy_production FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: energy_production energy_production_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY energy_production_select ON public.energy_production FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: energy_production energy_production_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY energy_production_update ON public.energy_production FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: engineering_packages eng_packages_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eng_packages_external_read ON public.engineering_packages AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((visible_to_client = true) AND public.has_external_access(project_id))));


--
-- Name: engineering_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.engineering_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: external_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.external_access ENABLE ROW LEVEL SECURITY;

--
-- Name: field_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.field_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: finance_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: gate_approver_defaults; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gate_approver_defaults ENABLE ROW LEVEL SECURITY;

--
-- Name: gate_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gate_certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: gate_role_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gate_role_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: gate_signoff_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gate_signoff_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: gate_signoffs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gate_signoffs ENABLE ROW LEVEL SECURITY;

--
-- Name: gate_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gate_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: gate_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gate_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: gate_templates gate_templates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gate_templates_select ON public.gate_templates FOR SELECT USING (((tenant_id = '00000000-0000-0000-0000-000000000001'::uuid) OR (auth.uid() IS NOT NULL)));


--
-- Name: gate_templates gate_templates_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY gate_templates_write ON public.gate_templates USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: gates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.gates ENABLE ROW LEVEL SECURITY;

--
-- Name: grid_compliance_tests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.grid_compliance_tests ENABLE ROW LEVEL SECURITY;

--
-- Name: grid_compliance_tests grid_compliance_tests_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grid_compliance_tests_delete ON public.grid_compliance_tests FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: grid_compliance_tests grid_compliance_tests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grid_compliance_tests_insert ON public.grid_compliance_tests FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: grid_compliance_tests grid_compliance_tests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grid_compliance_tests_select ON public.grid_compliance_tests FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: grid_compliance_tests grid_compliance_tests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY grid_compliance_tests_update ON public.grid_compliance_tests FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: guarantees; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guarantees ENABLE ROW LEVEL SECURITY;

--
-- Name: guarantees guarantees_external_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guarantees_external_block ON public.guarantees AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: guarantees guarantees_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guarantees_select ON public.guarantees FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: handover_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.handover_records ENABLE ROW LEVEL SECURITY;

--
-- Name: help_articles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

--
-- Name: help_articles help_articles_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY help_articles_insert ON public.help_articles FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: help_articles help_articles_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY help_articles_select ON public.help_articles FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: help_articles help_articles_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY help_articles_update ON public.help_articles FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: help_articles help_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY help_public ON public.help_articles FOR SELECT USING ((is_public = true));


--
-- Name: help_topics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.help_topics ENABLE ROW LEVEL SECURITY;

--
-- Name: help_topics help_topics_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY help_topics_insert ON public.help_topics FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: help_topics help_topics_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY help_topics_select ON public.help_topics FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: hse_incidents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hse_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: hse_permits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hse_permits ENABLE ROW LEVEL SECURITY;

--
-- Name: inspections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

--
-- Name: itp_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.itp_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: itp_activities itp_activities_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itp_activities_delete ON public.itp_activities FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: itp_activities itp_activities_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itp_activities_insert ON public.itp_activities FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: itp_activities itp_activities_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itp_activities_select ON public.itp_activities FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: itp_activities itp_activities_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itp_activities_update ON public.itp_activities FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: itp_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.itp_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: itp_plans itp_plans_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itp_plans_delete ON public.itp_plans FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: itp_plans itp_plans_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itp_plans_insert ON public.itp_plans FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: itp_plans itp_plans_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itp_plans_select ON public.itp_plans FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: itp_plans itp_plans_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY itp_plans_update ON public.itp_plans FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: lender_facilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lender_facilities ENABLE ROW LEVEL SECURITY;

--
-- Name: lender_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lender_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: maintenance_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.maintenance_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: marketplace_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marketplace_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: ncrs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ncrs ENABLE ROW LEVEL SECURITY;

--
-- Name: ncrs ncrs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ncrs_delete ON public.ncrs FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: ncrs ncrs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ncrs_insert ON public.ncrs FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: ncrs ncrs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ncrs_select ON public.ncrs FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: ncrs ncrs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ncrs_update ON public.ncrs FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: notifications notif_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_insert ON public.notifications FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: notifications notif_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_select_own ON public.notifications FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: notifications notif_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_update_own ON public.notifications FOR UPDATE USING ((user_id = auth.uid()));


--
-- Name: notification_prefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

--
-- Name: notification_prefs notification_prefs_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_prefs_select_own ON public.notification_prefs FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: notification_prefs notification_prefs_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_prefs_update_own ON public.notification_prefs FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: notification_prefs notification_prefs_upsert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notification_prefs_upsert_own ON public.notification_prefs FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: opportunities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_certificates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_certificates ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_milestones payment_milestones_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_milestones_select ON public.payment_milestones FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: phase_gates pg_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pg_external_read ON public.phase_gates AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((public.current_user_role() = 'client_viewer'::text) AND public.has_external_access(project_id))));


--
-- Name: phase_gates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.phase_gates ENABLE ROW LEVEL SECURITY;

--
-- Name: phase_gates phase_gates_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY phase_gates_insert ON public.phase_gates FOR INSERT WITH CHECK ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.tenant_id = public.get_my_tenant_id()))));


--
-- Name: phase_gates phase_gates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY phase_gates_select ON public.phase_gates FOR SELECT USING ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.tenant_id = public.get_my_tenant_id()))));


--
-- Name: phase_gates phase_gates_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY phase_gates_update ON public.phase_gates FOR UPDATE USING ((project_id IN ( SELECT projects.id
   FROM public.projects
  WHERE (projects.tenant_id = public.get_my_tenant_id()))));


--
-- Name: portal_invoices pi_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pi_external_read ON public.portal_invoices AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR (submitted_by = auth.uid())));


--
-- Name: portal_invoices pi_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pi_write ON public.portal_invoices FOR INSERT TO authenticated WITH CHECK ((submitted_by = auth.uid()));


--
-- Name: payment_milestones pm_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pm_external_read ON public.payment_milestones AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((public.current_user_role() = 'client_viewer'::text) AND (client_visible = true) AND public.has_external_access(project_id))));


--
-- Name: purchase_orders po_external_ack; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY po_external_ack ON public.purchase_orders FOR UPDATE TO authenticated USING ((public.is_external_role() AND (organization_name = public.current_user_org()) AND public.has_external_access(project_id)));


--
-- Name: purchase_orders po_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY po_external_read ON public.purchase_orders AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((organization_name = public.current_user_org()) AND public.has_external_access(project_id))));


--
-- Name: purchase_order_lines pol_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pol_read ON public.purchase_order_lines FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.purchase_orders po
  WHERE ((po.id = purchase_order_lines.po_id) AND ((NOT public.is_external_role()) OR ((po.organization_name = public.current_user_org()) AND public.has_external_access(po.project_id)))))));


--
-- Name: purchase_order_lines pol_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pol_write ON public.purchase_order_lines TO authenticated USING ((NOT public.is_external_role())) WITH CHECK ((NOT public.is_external_role()));


--
-- Name: portal_invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.portal_invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: progress_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.progress_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: project_gate_approvers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_gate_approvers ENABLE ROW LEVEL SECURITY;

--
-- Name: project_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

--
-- Name: project_members project_members_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_members_insert ON public.project_members FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: project_members project_members_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_members_select ON public.project_members FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: project_members project_members_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_members_update ON public.project_members FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: project_team; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_team ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: projects projects_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_delete ON public.projects FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: projects projects_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_external_read ON public.projects AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR public.has_external_access(id)));


--
-- Name: projects projects_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_insert ON public.projects FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: projects projects_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_select ON public.projects FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: projects projects_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_update ON public.projects FOR UPDATE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: purchase_order_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: raci_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.raci_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: raci_deliverables; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.raci_deliverables ENABLE ROW LEVEL SECURITY;

--
-- Name: rate_limit_buckets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: resource_plan; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.resource_plan ENABLE ROW LEVEL SECURITY;

--
-- Name: resource_plan resource_plan_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resource_plan_delete ON public.resource_plan FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: resource_plan resource_plan_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resource_plan_insert ON public.resource_plan FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: resource_plan resource_plan_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resource_plan_select ON public.resource_plan FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: resource_plan resource_plan_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY resource_plan_update ON public.resource_plan FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: retention_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retention_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: retention_entries retention_entries_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY retention_entries_select ON public.retention_entries FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: retention_entries retention_external_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY retention_external_block ON public.retention_entries AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: rfqs rfq_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rfq_external_read ON public.rfqs AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((organization_name = public.current_user_org()) AND public.has_external_access(project_id))));


--
-- Name: rfq_responses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rfq_responses ENABLE ROW LEVEL SECURITY;

--
-- Name: rfq_responses rfqr_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rfqr_admin_update ON public.rfq_responses FOR UPDATE TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: rfq_responses rfqr_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rfqr_insert ON public.rfq_responses FOR INSERT TO authenticated WITH CHECK ((submitted_by = auth.uid()));


--
-- Name: rfqs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;

--
-- Name: risks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

--
-- Name: roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_activities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_activities ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_baselines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_baselines ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_milestones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_milestones ENABLE ROW LEVEL SECURITY;

--
-- Name: securities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.securities ENABLE ROW LEVEL SECURITY;

--
-- Name: securities securities_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY securities_delete ON public.securities FOR DELETE USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: securities securities_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY securities_insert ON public.securities FOR INSERT WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: securities securities_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY securities_select ON public.securities FOR SELECT USING ((tenant_id = public.get_my_tenant_id()));


--
-- Name: securities securities_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY securities_update ON public.securities FOR UPDATE USING ((tenant_id = public.get_my_tenant_id())) WITH CHECK ((tenant_id = public.get_my_tenant_id()));


--
-- Name: signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: signatures signatures_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY signatures_insert_self ON public.signatures FOR INSERT TO authenticated WITH CHECK ((signer_id = auth.uid()));


--
-- Name: schedule_milestones sm_external_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sm_external_block ON public.schedule_milestones AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: schedule_milestones sm_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sm_read ON public.schedule_milestones FOR SELECT TO authenticated USING (true);


--
-- Name: task_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: tasks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

--
-- Name: tenants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

--
-- Name: tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: transmittal_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transmittal_items ENABLE ROW LEVEL SECURITY;

--
-- Name: transmittals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transmittals ENABLE ROW LEVEL SECURITY;

--
-- Name: variation_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.variation_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: variation_orders variation_orders_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY variation_orders_select ON public.variation_orders FOR SELECT USING ((auth.uid() IS NOT NULL));


--
-- Name: variation_orders variation_orders_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY variation_orders_write ON public.variation_orders USING ((auth.uid() IS NOT NULL)) WITH CHECK ((auth.uid() IS NOT NULL));


--
-- Name: variations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.variations ENABLE ROW LEVEL SECURITY;

--
-- Name: variation_orders vo_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY vo_external_read ON public.variation_orders AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((public.current_user_role() = 'client_viewer'::text) AND (client_visible = true) AND public.has_external_access(project_id))));


--
-- Name: work_packages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_packages ENABLE ROW LEVEL SECURITY;

--
-- Name: work_packages work_packages_external_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_packages_external_read ON public.work_packages AS RESTRICTIVE FOR SELECT TO authenticated USING (((NOT public.is_external_role()) OR ((visible_to_client = true) AND public.has_external_access(project_id))));


--
-- Name: work_permits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_permits ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_events ENABLE ROW LEVEL SECURITY;

--
-- Name: workflow_events workflow_events_external_block; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workflow_events_external_block ON public.workflow_events AS RESTRICTIVE FOR SELECT TO authenticated USING ((NOT public.is_external_role()));


--
-- Name: workflow_instances; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict lrbsij4b3k5QjGMncZAdnENguVmPNWfuhknNYJm8c17tA77YqyWejhDkjurknbz

