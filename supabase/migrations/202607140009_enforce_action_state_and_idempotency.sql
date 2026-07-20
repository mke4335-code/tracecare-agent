-- Enforce approval/state boundaries inside the database, not only in the UI.

create unique index if not exists traceguide_handoffs_one_active_reason_idx
  on public.traceguide_handoffs (case_id, reason_code)
  where status in ('queued', 'assigned');

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
  v_request_status text;
  v_result jsonb;
begin
  select * into v_case
  from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token
  for update;
  if not found then raise exception 'Case not found'; end if;

  if p_action_type not in ('refund', 'return_and_refund', 'replacement', 'collect_evidence') then
    raise exception 'Unsupported action';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 160 then
    raise exception 'Invalid idempotency key';
  end if;

  v_can_prepare := coalesce((v_case.eligibility ->> 'canPrepareAction')::boolean, false);
  if p_action_type in ('refund', 'return_and_refund', 'replacement') then
    if not v_can_prepare then raise exception 'Action is not eligible for preparation'; end if;
    if v_case.current_stage <> 'waiting_for_approval' or v_case.status <> 'waiting_for_approval' then
      raise exception 'Buyer approval is not currently available';
    end if;
  end if;
  if p_action_type = 'collect_evidence'
     and v_case.current_stage not in ('collecting_evidence', 'waiting_for_customer') then
    raise exception 'Evidence collection is not currently available';
  end if;

  select * into v_draft
  from public.traceguide_action_drafts
  where idempotency_key = p_idempotency_key;

  if found and (v_draft.case_id <> v_case.id or v_draft.action_type <> p_action_type) then
    raise exception 'Idempotency key belongs to another action';
  end if;

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
      else 'RF'
    end) || '-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(v_draft.id::text, '-', ''), 1, 6));

    if p_action_type = 'collect_evidence' then
      v_request_status := 'prepared';
      v_result := jsonb_build_object(
        'mode', 'evidence_collection',
        'message', 'The evidence step is ready. No refund or replacement request has been submitted.'
      );
    else
      v_request_status := 'submitted';
      v_result := jsonb_build_object(
        'mode', 'simulated_seller_review',
        'message', 'The request has been recorded for the research demo and queued for simulated store review.'
      );
    end if;

    insert into public.traceguide_action_requests (
      case_id, draft_id, external_reference, status, request_payload, result_payload
    ) values (
      v_case.id, v_draft.id, v_reference, v_request_status,
      coalesce(p_preview, '{}'::jsonb), v_result
    ) returning * into v_request;
  end if;

  update public.traceguide_action_drafts
  set status = case when p_action_type = 'collect_evidence' then 'approved' else 'executed' end,
      updated_at = now()
  where id = v_draft.id;

  if p_action_type = 'collect_evidence' then
    update public.traceguide_service_cases
    set status = 'waiting_for_customer', current_stage = 'collecting_evidence', updated_at = now()
    where id = v_case.id;
  else
    update public.traceguide_service_cases
    set status = 'resolved', current_stage = 'request_submitted', updated_at = now(), resolved_at = now()
    where id = v_case.id;
  end if;

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
  if v_case.status = 'cancelled' then raise exception 'Cancelled case cannot be handed off'; end if;

  select * into v_handoff
  from public.traceguide_handoffs
  where case_id = v_case.id
    and reason_code = p_reason_code
    and status in ('queued', 'assigned')
  order by created_at desc
  limit 1;

  if not found then
    insert into public.traceguide_handoffs (case_id, reason_code, summary)
    values (v_case.id, p_reason_code, coalesce(p_summary, '{}'::jsonb))
    returning * into v_handoff;
  end if;

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
