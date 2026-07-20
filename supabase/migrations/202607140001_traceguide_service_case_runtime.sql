-- TraceGuide Agent Phase 1: persistent service-case runtime.
-- Additive migration only. Existing prototype tables and data remain unchanged.
-- All customer/order records in this project are synthetic research fixtures.

create table if not exists public.traceguide_policy_versions (
  id text primary key,
  policy_key text not null,
  title text not null,
  version integer not null check (version > 0),
  status text not null check (status in ('draft', 'active', 'retired')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  rules jsonb not null default '{}'::jsonb,
  content text not null,
  source_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (policy_key, version),
  check (effective_to is null or effective_to > effective_from)
);

create table if not exists public.traceguide_service_cases (
  id uuid primary key default gen_random_uuid(),
  public_token uuid not null default gen_random_uuid() unique,
  participant_code text,
  condition text check (condition is null or condition in ('baseline', 'traceguide')),
  task_id text references public.traceguide_experiment_tasks(id),
  customer_id text not null references public.traceguide_customers(id),
  order_id text not null references public.traceguide_orders(id),
  policy_version_id text references public.traceguide_policy_versions(id),
  channel text not null default 'web' check (channel in ('web', 'mobile_web')),
  status text not null default 'open' check (
    status in ('open', 'waiting_for_customer', 'waiting_for_approval', 'executing', 'resolved', 'handed_off', 'failed', 'cancelled')
  ),
  current_stage text not null default 'understanding_request',
  goal text not null,
  issue_type text not null,
  requested_resolution text,
  eligibility jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.traceguide_case_facts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.traceguide_service_cases(id) on delete cascade,
  fact_key text not null,
  fact_value jsonb not null,
  source_type text not null check (
    source_type in ('customer', 'order_record', 'product_record', 'evidence_record', 'policy', 'agent_inference')
  ),
  source_ref text,
  editable_by_customer boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, fact_key)
);

create table if not exists public.traceguide_tool_calls (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.traceguide_service_cases(id) on delete cascade,
  agent_run_id uuid references public.traceguide_agent_runs(id) on delete set null,
  tool_name text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  requires_approval boolean not null default false,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.traceguide_action_drafts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.traceguide_service_cases(id) on delete cascade,
  action_type text not null check (action_type in ('refund', 'return_and_refund', 'replacement', 'collect_evidence', 'human_handoff')),
  status text not null default 'draft' check (status in ('draft', 'waiting_for_approval', 'approved', 'cancelled', 'executed', 'failed')),
  preview jsonb not null,
  idempotency_key text not null unique,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.traceguide_action_requests (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.traceguide_service_cases(id) on delete cascade,
  draft_id uuid not null references public.traceguide_action_drafts(id) on delete restrict,
  external_reference text not null unique,
  status text not null check (status in ('prepared', 'submitted', 'accepted', 'rejected', 'failed')),
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.traceguide_handoffs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.traceguide_service_cases(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'assigned', 'resolved', 'cancelled')),
  reason_code text not null,
  summary jsonb not null,
  queue_name text not null default 'customer-support',
  assigned_to text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.traceguide_agent_runs
  add column if not exists case_id uuid references public.traceguide_service_cases(id) on delete set null;

create index if not exists traceguide_service_cases_order_idx
  on public.traceguide_service_cases (order_id, created_at desc);
create index if not exists traceguide_service_cases_participant_idx
  on public.traceguide_service_cases (participant_code, created_at desc);
create index if not exists traceguide_case_facts_case_idx
  on public.traceguide_case_facts (case_id);
create index if not exists traceguide_tool_calls_case_idx
  on public.traceguide_tool_calls (case_id, created_at);
create index if not exists traceguide_action_drafts_case_idx
  on public.traceguide_action_drafts (case_id, created_at desc);
create index if not exists traceguide_action_requests_case_idx
  on public.traceguide_action_requests (case_id, created_at desc);
create index if not exists traceguide_handoffs_case_idx
  on public.traceguide_handoffs (case_id, created_at desc);

alter table public.traceguide_policy_versions enable row level security;
alter table public.traceguide_service_cases enable row level security;
alter table public.traceguide_case_facts enable row level security;
alter table public.traceguide_tool_calls enable row level security;
alter table public.traceguide_action_drafts enable row level security;
alter table public.traceguide_action_requests enable row level security;
alter table public.traceguide_handoffs enable row level security;

drop policy if exists "traceguide active policy fixture read" on public.traceguide_policy_versions;
create policy "traceguide active policy fixture read"
  on public.traceguide_policy_versions for select to anon, authenticated
  using (status = 'active');

-- Runtime case tables intentionally have no direct anon read/write policies.
-- Browser requests use narrowly scoped SECURITY DEFINER functions with a case token.

insert into public.traceguide_policy_versions (
  id,
  policy_key,
  title,
  version,
  status,
  effective_from,
  rules,
  content,
  source_uri
)
values (
  'damaged-items-uk-v1',
  'damaged_item_resolution',
  'Damaged item return, refund and replacement policy',
  1,
  'active',
  '2026-01-01T00:00:00Z',
  jsonb_build_object(
    'return_window_days', 30,
    'evidence_required_before_review', true,
    'refund_allowed', true,
    'replacement_allowed', true,
    'eligible_order_statuses', jsonb_build_array('delivered')
  ),
  'Items reported damaged on delivery can be reviewed within 30 days of delivery. A clear photo of the damaged item and packaging is required before the request is submitted for review. Eligible customers may choose a refund or replacement, subject to final store review.',
  'traceguide://policy/damaged-item-resolution/v1'
)
on conflict (id) do update set
  title = excluded.title,
  status = excluded.status,
  effective_from = excluded.effective_from,
  rules = excluded.rules,
  content = excluded.content,
  source_uri = excluded.source_uri,
  updated_at = now();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'traceguide-evidence',
  'traceguide-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.traceguide_start_service_case(
  p_task_id text,
  p_participant_code text default null,
  p_condition text default null,
  p_goal text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.traceguide_experiment_tasks%rowtype;
  v_order public.traceguide_orders%rowtype;
  v_product public.traceguide_products%rowtype;
  v_evidence public.traceguide_evidence_records%rowtype;
  v_policy public.traceguide_policy_versions%rowtype;
  v_case public.traceguide_service_cases%rowtype;
begin
  if p_task_id is null or length(p_task_id) > 40 then
    raise exception 'Invalid task id';
  end if;

  if p_condition is not null and p_condition not in ('baseline', 'traceguide') then
    raise exception 'Invalid condition';
  end if;

  select * into v_task
  from public.traceguide_experiment_tasks
  where id = p_task_id;
  if not found then raise exception 'Task not found'; end if;

  select * into v_order from public.traceguide_orders where id = v_task.order_id;
  select * into v_product from public.traceguide_products where id = v_order.product_id;
  select * into v_evidence
  from public.traceguide_evidence_records
  where order_id = v_order.id
  order by created_at desc
  limit 1;
  select * into v_policy
  from public.traceguide_policy_versions
  where policy_key = 'damaged_item_resolution' and status = 'active'
  order by version desc
  limit 1;

  insert into public.traceguide_service_cases (
    participant_code,
    condition,
    task_id,
    customer_id,
    order_id,
    policy_version_id,
    goal,
    issue_type,
    requested_resolution,
    current_stage
  ) values (
    nullif(left(coalesce(p_participant_code, ''), 80), ''),
    p_condition,
    v_task.id,
    v_task.customer_id,
    v_task.order_id,
    v_policy.id,
    coalesce(nullif(left(coalesce(p_goal, ''), 240), ''), v_task.request_type),
    v_task.issue_type,
    v_task.request_type,
    'understanding_request'
  ) returning * into v_case;

  insert into public.traceguide_case_facts (
    case_id, fact_key, fact_value, source_type, source_ref, editable_by_customer, confirmed_at
  ) values
    (v_case.id, 'issue_type', to_jsonb(v_task.issue_type), 'customer', v_task.id, true, now()),
    (v_case.id, 'requested_resolution', to_jsonb(v_task.request_type), 'customer', v_task.id, true, now()),
    (v_case.id, 'reason', to_jsonb(v_task.reason), 'customer', v_task.id, true, now()),
    (v_case.id, 'order_status', to_jsonb(v_order.status), 'order_record', v_order.id, false, now()),
    (v_case.id, 'delivered_days_ago', to_jsonb(v_order.delivered_days_ago), 'order_record', v_order.id, false, now()),
    (v_case.id, 'product_name', to_jsonb(v_product.name), 'product_record', v_product.id, false, now()),
    (v_case.id, 'evidence_status', to_jsonb(v_evidence.status), 'evidence_record', v_evidence.id, true, now()),
    (v_case.id, 'policy_version', to_jsonb(v_policy.id), 'policy', v_policy.id, false, now());

  return jsonb_build_object(
    'caseId', v_case.id,
    'caseToken', v_case.public_token,
    'status', v_case.status,
    'currentStage', v_case.current_stage,
    'orderId', v_case.order_id,
    'policyVersionId', v_case.policy_version_id
  );
end;
$$;

revoke all on function public.traceguide_start_service_case(text, text, text, text) from public;
grant execute on function public.traceguide_start_service_case(text, text, text, text) to anon, authenticated;

create or replace function public.traceguide_get_service_case(
  p_case_id uuid,
  p_case_token uuid
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'caseId', c.id,
    'status', c.status,
    'currentStage', c.current_stage,
    'goal', c.goal,
    'issueType', c.issue_type,
    'requestedResolution', c.requested_resolution,
    'eligibility', c.eligibility,
    'orderId', c.order_id,
    'policyVersionId', c.policy_version_id,
    'facts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'key', f.fact_key,
        'value', f.fact_value,
        'sourceType', f.source_type,
        'editableByCustomer', f.editable_by_customer,
        'confirmedAt', f.confirmed_at
      ) order by f.created_at)
      from public.traceguide_case_facts f
      where f.case_id = c.id
    ), '[]'::jsonb)
  )
  from public.traceguide_service_cases c
  where c.id = p_case_id and c.public_token = p_case_token;
$$;

revoke all on function public.traceguide_get_service_case(uuid, uuid) from public;
grant execute on function public.traceguide_get_service_case(uuid, uuid) to anon, authenticated;

