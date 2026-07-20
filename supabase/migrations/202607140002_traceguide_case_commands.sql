-- TraceGuide Agent Phase 1: token-scoped commands for the public research demo.
-- These functions expose only synthetic case data and validate every state transition.

create index if not exists traceguide_action_requests_draft_idx
  on public.traceguide_action_requests (draft_id);
create index if not exists traceguide_agent_runs_case_idx
  on public.traceguide_agent_runs (case_id);
create index if not exists traceguide_tool_calls_agent_run_idx
  on public.traceguide_tool_calls (agent_run_id);
create index if not exists traceguide_service_cases_customer_idx
  on public.traceguide_service_cases (customer_id);
create index if not exists traceguide_service_cases_policy_idx
  on public.traceguide_service_cases (policy_version_id);
create index if not exists traceguide_service_cases_task_idx
  on public.traceguide_service_cases (task_id);

create or replace function public.traceguide_update_case_assessment(
  p_case_id uuid,
  p_case_token uuid,
  p_variables jsonb,
  p_eligibility jsonb,
  p_stage text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.traceguide_service_cases%rowtype;
  v_status text;
  v_fact record;
begin
  select * into v_case
  from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token
  for update;
  if not found then raise exception 'Case not found'; end if;

  if p_stage not in (
    'understanding_request', 'reading_context', 'checking_policy', 'collecting_evidence',
    'preparing_answer', 'waiting_for_customer', 'waiting_for_approval', 'handoff_required'
  ) then
    raise exception 'Invalid case stage';
  end if;

  v_status := case
    when p_stage = 'waiting_for_approval' then 'waiting_for_approval'
    when p_stage in ('collecting_evidence', 'waiting_for_customer') then 'waiting_for_customer'
    when p_stage = 'handoff_required' then 'waiting_for_customer'
    else 'open'
  end;

  update public.traceguide_service_cases
  set current_stage = p_stage,
      status = v_status,
      eligibility = coalesce(p_eligibility, '{}'::jsonb),
      updated_at = now()
  where id = v_case.id;

  for v_fact in
    select * from (values
      ('issue_type', p_variables -> 'issueIdentified'),
      ('requested_resolution', p_variables -> 'request'),
      ('reason', p_variables -> 'reason'),
      ('evidence_status', p_variables -> 'evidence')
    ) as facts(fact_key, fact_value)
  loop
    if v_fact.fact_value is not null and v_fact.fact_value <> 'null'::jsonb then
      insert into public.traceguide_case_facts (
        case_id, fact_key, fact_value, source_type, source_ref,
        editable_by_customer, confirmed_at, updated_at
      ) values (
        v_case.id, v_fact.fact_key, v_fact.fact_value, 'customer', 'buyer-confirmed',
        true, now(), now()
      )
      on conflict (case_id, fact_key) do update set
        fact_value = excluded.fact_value,
        source_type = 'customer',
        source_ref = 'buyer-confirmed',
        editable_by_customer = true,
        confirmed_at = now(),
        updated_at = now();
    end if;
  end loop;

  return jsonb_build_object(
    'caseId', v_case.id,
    'status', v_status,
    'currentStage', p_stage,
    'eligibility', coalesce(p_eligibility, '{}'::jsonb)
  );
end;
$$;

revoke all on function public.traceguide_update_case_assessment(uuid, uuid, jsonb, jsonb, text) from public;
grant execute on function public.traceguide_update_case_assessment(uuid, uuid, jsonb, jsonb, text) to anon, authenticated;

create or replace function public.traceguide_prepare_and_approve_action(
  p_case_id uuid,
  p_case_token uuid,
  p_action_type text,
  p_preview jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.traceguide_service_cases%rowtype;
  v_draft public.traceguide_action_drafts%rowtype;
  v_request public.traceguide_action_requests%rowtype;
  v_reference text;
  v_can_prepare boolean;
begin
  select * into v_case
  from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token
  for update;
  if not found then raise exception 'Case not found'; end if;

  if p_action_type not in ('refund', 'return_and_refund', 'replacement', 'collect_evidence', 'human_handoff') then
    raise exception 'Unsupported action';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 160 then
    raise exception 'Invalid idempotency key';
  end if;

  v_can_prepare := coalesce((v_case.eligibility ->> 'canPrepareAction')::boolean, false);
  if p_action_type in ('refund', 'return_and_refund', 'replacement') and not v_can_prepare then
    raise exception 'Action is not eligible for preparation';
  end if;

  select * into v_draft
  from public.traceguide_action_drafts
  where idempotency_key = p_idempotency_key;

  if not found then
    insert into public.traceguide_action_drafts (
      case_id, action_type, status, preview, idempotency_key, approved_at, approved_by
    ) values (
      v_case.id, p_action_type, 'approved', coalesce(p_preview, '{}'::jsonb),
      p_idempotency_key, now(), 'buyer'
    ) returning * into v_draft;
  end if;

  select * into v_request
  from public.traceguide_action_requests
  where draft_id = v_draft.id;

  if not found then
    v_reference := upper(case
      when p_action_type = 'replacement' then 'RP'
      when p_action_type = 'collect_evidence' then 'EV'
      when p_action_type = 'human_handoff' then 'HS'
      else 'RF'
    end) || '-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(v_draft.id::text, '-', ''), 1, 6));

    insert into public.traceguide_action_requests (
      case_id, draft_id, external_reference, status, request_payload, result_payload
    ) values (
      v_case.id,
      v_draft.id,
      v_reference,
      'submitted',
      coalesce(p_preview, '{}'::jsonb),
      jsonb_build_object(
        'mode', 'simulated_seller_review',
        'message', 'The request has been recorded for the research demo and queued for simulated store review.'
      )
    ) returning * into v_request;
  end if;

  update public.traceguide_action_drafts
  set status = 'executed', updated_at = now()
  where id = v_draft.id;

  update public.traceguide_service_cases
  set status = 'resolved', current_stage = 'request_submitted', updated_at = now(), resolved_at = now()
  where id = v_case.id;

  return jsonb_build_object(
    'caseId', v_case.id,
    'draftId', v_draft.id,
    'requestId', v_request.external_reference,
    'status', v_request.status,
    'result', v_request.result_payload
  );
end;
$$;

revoke all on function public.traceguide_prepare_and_approve_action(uuid, uuid, text, jsonb, text) from public;
grant execute on function public.traceguide_prepare_and_approve_action(uuid, uuid, text, jsonb, text) to anon, authenticated;

create or replace function public.traceguide_create_handoff(
  p_case_id uuid,
  p_case_token uuid,
  p_reason_code text,
  p_summary jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.traceguide_service_cases%rowtype;
  v_handoff public.traceguide_handoffs%rowtype;
begin
  select * into v_case
  from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token
  for update;
  if not found then raise exception 'Case not found'; end if;
  if p_reason_code is null or length(p_reason_code) > 80 then raise exception 'Invalid reason'; end if;

  insert into public.traceguide_handoffs (case_id, reason_code, summary)
  values (v_case.id, p_reason_code, coalesce(p_summary, '{}'::jsonb))
  returning * into v_handoff;

  update public.traceguide_service_cases
  set status = 'handed_off', current_stage = 'human_handoff', updated_at = now()
  where id = v_case.id;

  return jsonb_build_object(
    'caseId', v_case.id,
    'handoffId', v_handoff.id,
    'status', v_handoff.status,
    'queue', v_handoff.queue_name
  );
end;
$$;

revoke all on function public.traceguide_create_handoff(uuid, uuid, text, jsonb) from public;
grant execute on function public.traceguide_create_handoff(uuid, uuid, text, jsonb) to anon, authenticated;

