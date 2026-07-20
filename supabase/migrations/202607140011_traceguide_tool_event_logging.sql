-- Token-scoped audit logging for deterministic Agent tool events.

create or replace function public.traceguide_record_tool_event(
  p_case_id uuid,
  p_case_token uuid,
  p_tool_name text,
  p_status text,
  p_input jsonb,
  p_output jsonb,
  p_error_code text default null,
  p_error_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.traceguide_service_cases%rowtype;
  v_tool_call public.traceguide_tool_calls%rowtype;
begin
  select * into v_case
  from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token;
  if not found then raise exception 'Case not found'; end if;

  if p_tool_name not in (
    'understand_request', 'get_order_detail', 'get_evidence_status',
    'get_active_policy', 'evaluate_eligibility', 'prepare_buyer_options'
  ) then raise exception 'Unsupported tool event'; end if;
  if p_status not in ('queued', 'running', 'succeeded', 'failed', 'cancelled') then
    raise exception 'Invalid tool status';
  end if;

  insert into public.traceguide_tool_calls (
    case_id, tool_name, status, input, output,
    error_code, error_message, started_at, completed_at
  ) values (
    v_case.id,
    p_tool_name,
    p_status,
    coalesce(p_input, '{}'::jsonb),
    p_output,
    nullif(left(coalesce(p_error_code, ''), 80), ''),
    nullif(left(coalesce(p_error_message, ''), 500), ''),
    now(),
    case when p_status in ('succeeded', 'failed', 'cancelled') then now() else null end
  ) returning * into v_tool_call;

  return v_tool_call.id;
end;
$$;

revoke all on function public.traceguide_record_tool_event(uuid, uuid, text, text, jsonb, jsonb, text, text) from public;
grant execute on function public.traceguide_record_tool_event(uuid, uuid, text, text, jsonb, jsonb, text, text) to anon, authenticated;
