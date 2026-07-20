-- Return an already-created request before re-evaluating the now-resolved case state.

alter function public.traceguide_prepare_and_approve_action(uuid, uuid, text, jsonb, text)
  rename to traceguide_prepare_and_approve_action_once;

revoke all on function public.traceguide_prepare_and_approve_action_once(uuid, uuid, text, jsonb, text) from public;

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
begin
  select * into v_case
  from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token;
  if not found then raise exception 'Case not found'; end if;

  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 160 then
    raise exception 'Invalid idempotency key';
  end if;

  select * into v_draft
  from public.traceguide_action_drafts
  where idempotency_key = p_idempotency_key;

  if found then
    if v_draft.case_id <> v_case.id or v_draft.action_type <> p_action_type then
      raise exception 'Idempotency key belongs to another action';
    end if;

    select * into v_request
    from public.traceguide_action_requests
    where draft_id = v_draft.id;

    if found then
      return jsonb_build_object(
        'caseId', v_case.id,
        'draftId', v_draft.id,
        'requestId', v_request.external_reference,
        'status', v_request.status,
        'result', v_request.result_payload
      );
    end if;
  end if;

  return public.traceguide_prepare_and_approve_action_once(
    p_case_id,
    p_case_token,
    p_action_type,
    p_preview,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.traceguide_prepare_and_approve_action(uuid, uuid, text, jsonb, text) from public;
grant execute on function public.traceguide_prepare_and_approve_action(uuid, uuid, text, jsonb, text) to anon, authenticated;
