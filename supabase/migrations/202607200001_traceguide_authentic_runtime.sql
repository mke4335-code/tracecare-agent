-- TraceGuide authentic damaged-item runtime.
-- Exact commerce records stay in relational tables. Only policy prose is searched.

create extension if not exists vector with schema extensions;

create table if not exists public.traceguide_policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null,
  version integer not null check (version > 0),
  title text not null,
  status text not null check (status in ('draft', 'active', 'retired')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  applies_to text[] not null default '{}',
  source_uri text,
  content_checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_key, version)
);

create table if not exists public.traceguide_policy_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.traceguide_policy_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  heading text not null,
  content text not null,
  fts tsvector generated always as (
    to_tsvector('english', coalesce(heading, '') || ' ' || coalesce(content, ''))
  ) stored,
  embedding extensions.vector(384),
  source_uri text,
  content_checksum text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists traceguide_policy_chunks_fts_idx
  on public.traceguide_policy_chunks using gin (fts);
create index if not exists traceguide_policy_chunks_embedding_idx
  on public.traceguide_policy_chunks using hnsw (embedding vector_ip_ops)
  where embedding is not null;
create index if not exists traceguide_policy_documents_active_idx
  on public.traceguide_policy_documents (policy_key, status, effective_from desc);

alter table public.traceguide_policy_documents enable row level security;
alter table public.traceguide_policy_chunks enable row level security;

drop policy if exists "traceguide active policy documents read" on public.traceguide_policy_documents;
create policy "traceguide active policy documents read"
  on public.traceguide_policy_documents for select to anon, authenticated
  using (
    status = 'active'
    and effective_from <= now()
    and (effective_to is null or effective_to > now())
  );

drop policy if exists "traceguide active policy chunks read" on public.traceguide_policy_chunks;
create policy "traceguide active policy chunks read"
  on public.traceguide_policy_chunks for select to anon, authenticated
  using (exists (
    select 1 from public.traceguide_policy_documents d
    where d.id = document_id
      and d.status = 'active'
      and d.effective_from <= now()
      and (d.effective_to is null or d.effective_to > now())
  ));

create or replace function public.traceguide_hybrid_policy_search(
  p_query_text text,
  p_query_embedding extensions.vector(384) default null,
  p_match_count integer default 3,
  p_full_text_weight double precision default 1,
  p_semantic_weight double precision default 1,
  p_rrf_k integer default 50
)
returns table (
  chunk_id uuid,
  document_id uuid,
  policy_key text,
  policy_version integer,
  title text,
  heading text,
  content text,
  source_uri text,
  retrieval_mode text,
  rank_score double precision
)
language sql
stable
security definer
set search_path = public, extensions
as $$
  with active_chunks as (
    select c.*, d.policy_key, d.version as policy_version, d.title,
           coalesce(c.source_uri, d.source_uri) as resolved_source_uri
    from public.traceguide_policy_chunks c
    join public.traceguide_policy_documents d on d.id = c.document_id
    where d.status = 'active'
      and d.effective_from <= now()
      and (d.effective_to is null or d.effective_to > now())
  ),
  full_text as (
    select id,
      row_number() over (
        order by ts_rank_cd(fts, websearch_to_tsquery('english', p_query_text)) desc, id
      ) as rank_ix
    from active_chunks
    where nullif(trim(p_query_text), '') is not null
      and fts @@ websearch_to_tsquery('english', p_query_text)
    limit least(greatest(p_match_count, 1), 20) * 2
  ),
  semantic as (
    select id,
      row_number() over (order by embedding <#> p_query_embedding, id) as rank_ix
    from active_chunks
    where p_query_embedding is not null and embedding is not null
    limit least(greatest(p_match_count, 1), 20) * 2
  ),
  fused as (
    select coalesce(f.id, s.id) as id,
      coalesce(p_full_text_weight / (p_rrf_k + f.rank_ix), 0.0)
      + coalesce(p_semantic_weight / (p_rrf_k + s.rank_ix), 0.0) as score,
      case
        when f.id is not null and s.id is not null then 'hybrid'
        when s.id is not null then 'semantic'
        else 'full_text'
      end as mode
    from full_text f
    full outer join semantic s on s.id = f.id
  )
  select a.id, a.document_id, a.policy_key, a.policy_version, a.title,
         a.heading, a.content, a.resolved_source_uri, fused.mode, fused.score
  from fused join active_chunks a on a.id = fused.id
  order by fused.score desc, a.id
  limit least(greatest(p_match_count, 1), 20);
$$;

revoke all on function public.traceguide_hybrid_policy_search(
  text, extensions.vector, integer, double precision, double precision, integer
) from public;
grant execute on function public.traceguide_hybrid_policy_search(
  text, extensions.vector, integer, double precision, double precision, integer
) to anon, authenticated;

create table if not exists public.traceguide_case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.traceguide_service_cases(id) on delete cascade,
  status text not null check (status in ('not_added', 'photos_provided', 'removed')),
  description text not null,
  storage_path text,
  mime_type text check (mime_type is null or mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes between 1 and 10485760),
  uploaded_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists traceguide_case_evidence_active_path_idx
  on public.traceguide_case_evidence(case_id, storage_path)
  where storage_path is not null and status <> 'removed';
create index if not exists traceguide_case_evidence_case_idx
  on public.traceguide_case_evidence(case_id, created_at desc);

alter table public.traceguide_case_evidence enable row level security;
-- Browser clients never read case evidence directly. Token-checked RPCs are the access boundary.

create or replace function public.traceguide_case_evidence_status(p_case_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status from public.traceguide_case_evidence
     where case_id = p_case_id and status <> 'removed'
     order by created_at desc limit 1),
    (select trim(both '"' from fact_value::text)
     from public.traceguide_case_facts
     where case_id = p_case_id and fact_key = 'evidence_status'
     limit 1),
    'not_added'
  );
$$;

revoke all on function public.traceguide_case_evidence_status(uuid) from public;

-- Replace shared-order evidence mutation with case-scoped evidence records.
create or replace function public.traceguide_confirm_evidence_upload(
  p_case_id uuid,
  p_case_token uuid,
  p_storage_path text,
  p_mime_type text,
  p_file_size_bytes bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case public.traceguide_service_cases%rowtype;
  v_evidence public.traceguide_case_evidence%rowtype;
begin
  select * into v_case from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token for update;
  if not found then raise exception 'Case not found'; end if;
  if p_storage_path is null or p_storage_path not like p_case_token::text || '/%'
     or length(p_storage_path) > 320 then raise exception 'Invalid evidence path'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
    raise exception 'Unsupported evidence type';
  end if;
  if p_file_size_bytes is not null and (p_file_size_bytes < 1 or p_file_size_bytes > 10485760) then
    raise exception 'Invalid evidence size';
  end if;
  if not exists (select 1 from storage.objects
    where bucket_id = 'traceguide-evidence' and name = p_storage_path) then
    raise exception 'Evidence object not found';
  end if;

  insert into public.traceguide_case_evidence (
    case_id, status, description, storage_path, mime_type, file_size_bytes, uploaded_at
  ) values (
    v_case.id, 'photos_provided', 'Buyer supplied photo evidence for damage review.',
    p_storage_path, p_mime_type, p_file_size_bytes, now()
  ) returning * into v_evidence;

  insert into public.traceguide_case_facts (
    case_id, fact_key, fact_value, source_type, source_ref,
    editable_by_customer, confirmed_at, updated_at
  ) values (
    v_case.id, 'evidence_status', to_jsonb('photos_provided'::text),
    'evidence_record', v_evidence.id::text, true, now(), now()
  ) on conflict (case_id, fact_key) do update set
    fact_value = excluded.fact_value, source_type = excluded.source_type,
    source_ref = excluded.source_ref, editable_by_customer = true,
    confirmed_at = now(), updated_at = now();

  update public.traceguide_action_drafts
  set status = 'cancelled', updated_at = now()
  where case_id = v_case.id and status in ('draft', 'waiting_for_approval');
  update public.traceguide_service_cases
  set eligibility = '{}'::jsonb, status = 'open', current_stage = 'checking_evidence', updated_at = now()
  where id = v_case.id;

  return jsonb_build_object(
    'caseId', v_case.id, 'evidenceId', v_evidence.id,
    'evidenceStatus', v_evidence.status, 'currentStage', 'checking_evidence'
  );
end;
$$;

revoke all on function public.traceguide_confirm_evidence_upload(uuid, uuid, text, text, bigint) from public;
grant execute on function public.traceguide_confirm_evidence_upload(uuid, uuid, text, text, bigint) to anon, authenticated;

-- Backward-compatible signature for the currently deployed UI. It delegates
-- to the case-scoped implementation instead of mutating shared order fixtures.
create or replace function public.traceguide_confirm_evidence_upload(
  p_case_id uuid,
  p_case_token uuid,
  p_storage_path text,
  p_mime_type text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.traceguide_confirm_evidence_upload(
    p_case_id, p_case_token, p_storage_path, p_mime_type, null::bigint
  );
$$;

revoke all on function public.traceguide_confirm_evidence_upload(uuid, uuid, text, text) from public;
grant execute on function public.traceguide_confirm_evidence_upload(uuid, uuid, text, text) to anon, authenticated;

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
  v_evidence public.traceguide_case_evidence%rowtype;
begin
  select * into v_case from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token for update;
  if not found then raise exception 'Case not found'; end if;

  select * into v_evidence from public.traceguide_case_evidence
  where case_id = v_case.id and storage_path = p_storage_path and status <> 'removed'
  order by created_at desc limit 1 for update;
  if not found then raise exception 'Evidence record not found'; end if;

  update public.traceguide_case_evidence
  set status = 'removed', removed_at = now(), updated_at = now()
  where id = v_evidence.id;
  insert into public.traceguide_case_facts (
    case_id, fact_key, fact_value, source_type, source_ref,
    editable_by_customer, confirmed_at, updated_at
  ) values (
    v_case.id, 'evidence_status', to_jsonb('not_added'::text),
    'customer', v_case.id::text, true, now(), now()
  ) on conflict (case_id, fact_key) do update set
    fact_value = excluded.fact_value, source_type = excluded.source_type,
    source_ref = excluded.source_ref, confirmed_at = now(), updated_at = now();

  update public.traceguide_action_drafts set status = 'cancelled', updated_at = now()
  where case_id = v_case.id and status in ('draft', 'waiting_for_approval');
  update public.traceguide_service_cases
  set eligibility = '{}'::jsonb, status = 'waiting_for_customer',
      current_stage = 'collecting_evidence', updated_at = now()
  where id = v_case.id;

  return jsonb_build_object(
    'caseId', v_case.id, 'evidenceId', v_evidence.id,
    'evidenceStatus', 'not_added', 'currentStage', 'collecting_evidence'
  );
end;
$$;

revoke all on function public.traceguide_mark_evidence_removed(uuid, uuid, text) from public;
grant execute on function public.traceguide_mark_evidence_removed(uuid, uuid, text) to anon, authenticated;

-- A buyer may correct only buyer-provided request details. Evidence status is
-- changed exclusively by the upload/remove commands above; order and policy
-- facts remain system-owned. Any material correction invalidates stale drafts.
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
  v_changed boolean := false;
  v_previous jsonb;
begin
  select * into v_case from public.traceguide_service_cases
  where id = p_case_id and public_token = p_case_token for update;
  if not found then raise exception 'Case not found'; end if;

  if p_stage not in (
    'understanding_request', 'reading_context', 'checking_policy', 'collecting_evidence',
    'preparing_answer', 'waiting_for_customer', 'waiting_for_approval', 'handoff_required'
  ) then raise exception 'Invalid case stage'; end if;

  v_status := case
    when p_stage = 'waiting_for_approval' then 'waiting_for_approval'
    when p_stage in ('collecting_evidence', 'waiting_for_customer', 'handoff_required') then 'waiting_for_customer'
    else 'open'
  end;

  for v_fact in
    select * from (values
      ('issue_type', p_variables -> 'issueIdentified'),
      ('requested_resolution', p_variables -> 'request'),
      ('reason', p_variables -> 'reason')
    ) as facts(fact_key, fact_value)
  loop
    if v_fact.fact_value is not null and v_fact.fact_value <> 'null'::jsonb then
      select fact_value into v_previous from public.traceguide_case_facts
      where case_id = v_case.id and fact_key = v_fact.fact_key;
      v_changed := v_changed or v_previous is distinct from v_fact.fact_value;
      insert into public.traceguide_case_facts (
        case_id, fact_key, fact_value, source_type, source_ref,
        editable_by_customer, confirmed_at, updated_at
      ) values (
        v_case.id, v_fact.fact_key, v_fact.fact_value, 'customer', 'buyer-confirmed',
        true, now(), now()
      ) on conflict (case_id, fact_key) do update set
        fact_value = excluded.fact_value, source_type = 'customer',
        source_ref = 'buyer-confirmed', editable_by_customer = true,
        confirmed_at = now(), updated_at = now();
    end if;
  end loop;

  if v_changed then
    update public.traceguide_action_drafts set status = 'cancelled', updated_at = now()
    where case_id = v_case.id and status in ('draft', 'waiting_for_approval');
  end if;

  update public.traceguide_service_cases
  set current_stage = p_stage, status = v_status,
      eligibility = coalesce(p_eligibility, '{}'::jsonb), updated_at = now()
  where id = v_case.id;

  return jsonb_build_object(
    'caseId', v_case.id, 'status', v_status, 'currentStage', p_stage,
    'eligibility', coalesce(p_eligibility, '{}'::jsonb),
    'invalidatedPreviousDraft', v_changed
  );
end;
$$;

revoke all on function public.traceguide_update_case_assessment(uuid, uuid, jsonb, jsonb, text) from public;
grant execute on function public.traceguide_update_case_assessment(uuid, uuid, jsonb, jsonb, text) to anon, authenticated;

-- Controlled policy corpus for the formal English damaged-item study.
insert into public.traceguide_policy_documents (
  policy_key, version, title, status, effective_from, applies_to, source_uri, content_checksum
) values (
  'damaged_item_resolution', 1, 'Damaged item return and refund policy', 'active',
  '2026-07-01T00:00:00Z', array['homeware', 'damaged_item'],
  'traceguide://policy/damaged-item-resolution/v1',
  encode(digest('damaged-item-resolution-v1', 'sha256'), 'hex')
) on conflict (policy_key, version) do update set
  title = excluded.title, status = excluded.status, effective_from = excluded.effective_from,
  applies_to = excluded.applies_to, source_uri = excluded.source_uri,
  content_checksum = excluded.content_checksum, updated_at = now();

with document as (
  select id from public.traceguide_policy_documents
  where policy_key = 'damaged_item_resolution' and version = 1
), chunks(chunk_index, heading, content) as (
  values
    (0, 'Eligibility window', 'A damaged item reported within 30 days of delivery may be considered for a return and refund or a replacement.'),
    (1, 'Supporting evidence', 'A clear photo of the damaged item and its packaging is required before a damaged-item service request can be prepared for review.'),
    (2, 'Buyer approval', 'The service agent may prepare a service request only after the buyer reviews the request details and confirms the proposed resolution. A prepared request is not a completed refund.'),
    (3, 'Human review', 'If the order record, item condition, or supporting evidence is unclear, the case must be paused for more information or transferred to human support.')
)
insert into public.traceguide_policy_chunks (
  document_id, chunk_index, heading, content, source_uri, content_checksum
)
select d.id, c.chunk_index, c.heading, c.content,
  'traceguide://policy/damaged-item-resolution/v1#chunk-' || c.chunk_index,
  encode(digest(c.content, 'sha256'), 'hex')
from document d cross join chunks c
on conflict (document_id, chunk_index) do update set
  heading = excluded.heading, content = excluded.content,
  source_uri = excluded.source_uri, content_checksum = excluded.content_checksum,
  updated_at = now();

-- Matched formal-study fixtures: each set contains one evidence-complete and one
-- evidence-missing damaged-item case. They differ only in product and wording.
insert into public.traceguide_orders (
  id, customer_id, product_id, quantity, status, delivered_days_ago,
  promised_delivery_days_ago, cold_chain_ok, included_items
) values (
  'TC-2170', 'cust-ke-demo', 'prod-coffee-maker', 1, 'delivered', 0,
  null, null, array['coffee maker', 'carafe', 'power cable']
) on conflict (id) do update set
  customer_id = excluded.customer_id, product_id = excluded.product_id,
  quantity = excluded.quantity, status = excluded.status,
  delivered_days_ago = excluded.delivered_days_ago,
  included_items = excluded.included_items;

insert into public.traceguide_evidence_records (id, order_id, status, description)
values (
  'ev-coffee-damaged-no-photo', 'TC-2170', 'not_added',
  'The coffee maker casing was reported cracked, but no damage photo is attached.'
) on conflict (id) do update set
  order_id = excluded.order_id, status = excluded.status, description = excluded.description;

update public.traceguide_evidence_records
set status = 'not_added',
    description = 'One glass container was reported cracked, but no damage photo is attached.'
where id = 'ev-container-set-missing';

insert into public.traceguide_experiment_tasks (
  id, scenario_key, customer_id, order_id, issue_type, request_type,
  reason, default_evidence_status, correct_decision
) values
  ('S1-T1', 'glass_damaged_refund', 'cust-ke-demo', 'TC-2048',
   'Damaged item', 'Refund or replacement', 'Glass lunch box arrived damaged',
   'photos_provided', 'Authorise preparation of a damaged-item service request.'),
  ('S1-T2', 'container_set_damaged_no_photo', 'cust-ke-demo', 'TC-2140',
   'Damaged item', 'Refund or replacement', 'One glass container arrived cracked',
   'not_added', 'Add a clear damage photo or ask human support before authorising a request.'),
  ('S2-T1', 'glass_container_broken', 'cust-ke-demo', 'TC-2118',
   'Damaged item', 'Refund or replacement', 'Locking lid arrived broken',
   'photos_provided', 'Authorise preparation of a damaged-item service request.'),
  ('S2-T2', 'coffee_maker_damaged_no_photo', 'cust-ke-demo', 'TC-2170',
   'Damaged item', 'Refund or replacement', 'Coffee maker casing arrived cracked',
   'not_added', 'Add a clear damage photo or ask human support before authorising a request.')
on conflict (id) do update set
  scenario_key = excluded.scenario_key, customer_id = excluded.customer_id,
  order_id = excluded.order_id, issue_type = excluded.issue_type,
  request_type = excluded.request_type, reason = excluded.reason,
  default_evidence_status = excluded.default_evidence_status,
  correct_decision = excluded.correct_decision;
