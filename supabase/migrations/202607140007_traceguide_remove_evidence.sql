-- Token-scoped evidence replacement/removal for the buyer-facing service case.

drop policy if exists "traceguide case evidence delete" on storage.objects;
create policy "traceguide case evidence delete"
  on storage.objects for delete to anon, authenticated
  using (
    bucket_id = 'traceguide-evidence'
    and public.traceguide_case_token_exists((storage.foldername(name))[1])
  );

create or replace function public.traceguide_mark_evidence_removed(
  p_case_id uuid,
  p_case_token uuid,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.traceguide_service_cases%rowtype;
  v_evidence public.traceguide_evidence_records%rowtype;
begin
  select * into v_case
  from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token
  for update;
  if not found then raise exception 'Case not found'; end if;

  select * into v_evidence
  from public.traceguide_evidence_records
  where order_id = v_case.order_id and storage_path = p_storage_path
  order by created_at desc
  limit 1
  for update;
  if not found then raise exception 'Evidence record not found'; end if;

  update public.traceguide_evidence_records
  set status = 'not_added',
      description = 'Damage was reported, but photo evidence is not currently attached.',
      storage_path = null,
      mime_type = null,
      uploaded_at = null
  where id = v_evidence.id;

  insert into public.traceguide_case_facts (
    case_id, fact_key, fact_value, source_type, source_ref,
    editable_by_customer, confirmed_at, updated_at
  ) values (
    v_case.id,
    'evidence_status',
    to_jsonb('not_added'::text),
    'evidence_record',
    v_evidence.id,
    true,
    now(),
    now()
  )
  on conflict (case_id, fact_key) do update set
    fact_value = excluded.fact_value,
    source_type = excluded.source_type,
    source_ref = excluded.source_ref,
    confirmed_at = now(),
    updated_at = now();

  update public.traceguide_service_cases
  set status = 'waiting_for_customer',
      current_stage = 'collecting_evidence',
      updated_at = now()
  where id = v_case.id;

  return jsonb_build_object(
    'caseId', v_case.id,
    'evidenceId', v_evidence.id,
    'evidenceStatus', 'not_added',
    'currentStage', 'collecting_evidence'
  );
end;
$$;

revoke all on function public.traceguide_mark_evidence_removed(uuid, uuid, text) from public;
grant execute on function public.traceguide_mark_evidence_removed(uuid, uuid, text) to anon, authenticated;
