-- Keep evidence collection open instead of marking the service case resolved.

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
      v_case.id,
      v_draft.id,
      v_reference,
      v_request_status,
      coalesce(p_preview, '{}'::jsonb),
      v_result
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

