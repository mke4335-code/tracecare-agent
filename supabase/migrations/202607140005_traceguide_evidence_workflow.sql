-- TraceGuide Agent Phase 2: private evidence upload and case resumption.
-- Browser uploads are scoped to the unguessable public case token. Objects remain private.

alter table public.traceguide_evidence_records
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists uploaded_at timestamptz;

drop policy if exists "traceguide case evidence upload" on storage.objects;
create policy "traceguide case evidence upload"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'traceguide-evidence'
    and exists (
      select 1
      from public.traceguide_service_cases c
      where name like c.public_token::text || '/%'
    )
  );

create or replace function public.traceguide_confirm_evidence_upload(
  p_case_id uuid,
  p_case_token uuid,
  p_storage_path text,
  p_mime_type text
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

  if p_storage_path is null
     or p_storage_path not like p_case_token::text || '/%'
     or length(p_storage_path) > 320 then
    raise exception 'Invalid evidence path';
  end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Unsupported evidence type';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'traceguide-evidence' and name = p_storage_path
  ) then
    raise exception 'Evidence object not found';
  end if;

  select * into v_evidence
  from public.traceguide_evidence_records
  where order_id = v_case.order_id
  order by created_at desc
  limit 1
  for update;

  if found then
    update public.traceguide_evidence_records
    set status = 'photos_provided',
        description = 'Buyer supplied photo evidence for damage review.',
        storage_path = p_storage_path,
        mime_type = p_mime_type,
        uploaded_at = now()
    where id = v_evidence.id
    returning * into v_evidence;
  else
    insert into public.traceguide_evidence_records (
      id, order_id, status, description, storage_path, mime_type, uploaded_at
    ) values (
      'ev-upload-' || replace(gen_random_uuid()::text, '-', ''),
      v_case.order_id,
      'photos_provided',
      'Buyer supplied photo evidence for damage review.',
      p_storage_path,
      p_mime_type,
      now()
    ) returning * into v_evidence;
  end if;

  insert into public.traceguide_case_facts (
    case_id, fact_key, fact_value, source_type, source_ref,
    editable_by_customer, confirmed_at, updated_at
  ) values (
    v_case.id,
    'evidence_status',
    to_jsonb('photos_provided'::text),
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
    editable_by_customer = true,
    confirmed_at = now(),
    updated_at = now();

  update public.traceguide_service_cases
  set status = 'open', current_stage = 'checking_policy', updated_at = now()
  where id = v_case.id;

  return jsonb_build_object(
    'caseId', v_case.id,
    'evidenceId', v_evidence.id,
    'evidenceStatus', v_evidence.status,
    'currentStage', 'checking_policy'
  );
end;
$$;

revoke all on function public.traceguide_confirm_evidence_upload(uuid, uuid, text, text) from public;
grant execute on function public.traceguide_confirm_evidence_upload(uuid, uuid, text, text) to anon, authenticated;
