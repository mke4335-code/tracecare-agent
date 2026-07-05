-- TraceGuide Agent research prototype commerce data model.
-- Purpose: provide realistic ecommerce context for the Baseline and TraceGuide UX study.
-- Safe boundary: demo orders and demo action records only; no payment, fulfilment, or real refund execution.

create table if not exists public.traceguide_customers (
  id text primary key,
  display_name text not null,
  segment text not null check (segment in ('standard', 'plus')),
  saved_allergens text[] not null default '{}',
  preferred_resolution text not null check (preferred_resolution in ('refund', 'replacement', 'human_review')),
  created_at timestamptz not null default now()
);

create table if not exists public.traceguide_products (
  id text primary key,
  name text not null,
  image_key text not null,
  detail text not null,
  category text not null,
  return_class text not null,
  price_gbp numeric(8,2) not null,
  allergens text[] not null default '{}',
  policy_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.traceguide_orders (
  id text primary key,
  customer_id text not null references public.traceguide_customers(id),
  product_id text not null references public.traceguide_products(id),
  quantity integer not null default 1,
  status text not null check (status in ('processing', 'out_for_delivery', 'delivered', 'in_transit')),
  delivered_days_ago integer not null,
  promised_delivery_days_ago integer,
  cold_chain_ok boolean,
  included_items text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.traceguide_orders
  drop constraint if exists traceguide_orders_status_check;

alter table public.traceguide_orders
  add constraint traceguide_orders_status_check
  check (status in ('processing', 'out_for_delivery', 'delivered', 'in_transit'));

create table if not exists public.traceguide_evidence_records (
  id text primary key,
  order_id text not null references public.traceguide_orders(id),
  status text not null check (status in ('not_added', 'photos_provided', 'not_required', 'unclear')),
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.traceguide_experiment_tasks (
  id text primary key,
  scenario_key text not null,
  customer_id text not null references public.traceguide_customers(id),
  order_id text not null references public.traceguide_orders(id),
  issue_type text not null,
  request_type text not null,
  reason text not null,
  default_evidence_status text not null,
  correct_decision text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.traceguide_agent_runs (
  id uuid primary key default gen_random_uuid(),
  participant_code text,
  condition text,
  task_id text,
  question text not null,
  detected_scenario text,
  variables jsonb not null default '{}',
  sources jsonb not null default '[]',
  confidence integer,
  confidence_reason text,
  answer text,
  next_action text,
  created_at timestamptz not null default now()
);

alter table public.traceguide_customers enable row level security;
alter table public.traceguide_products enable row level security;
alter table public.traceguide_orders enable row level security;
alter table public.traceguide_evidence_records enable row level security;
alter table public.traceguide_experiment_tasks enable row level security;
alter table public.traceguide_agent_runs enable row level security;

-- Public read policies are appropriate for synthetic research-fixture data only.
-- Do not reuse this policy for real customer data.
drop policy if exists "traceguide fixture read" on public.traceguide_customers;
create policy "traceguide fixture read" on public.traceguide_customers for select to anon, authenticated using (true);

drop policy if exists "traceguide product fixture read" on public.traceguide_products;
create policy "traceguide product fixture read" on public.traceguide_products for select to anon, authenticated using (true);

drop policy if exists "traceguide order fixture read" on public.traceguide_orders;
create policy "traceguide order fixture read" on public.traceguide_orders for select to anon, authenticated using (true);

drop policy if exists "traceguide evidence fixture read" on public.traceguide_evidence_records;
create policy "traceguide evidence fixture read" on public.traceguide_evidence_records for select to anon, authenticated using (true);

drop policy if exists "traceguide task fixture read" on public.traceguide_experiment_tasks;
create policy "traceguide task fixture read" on public.traceguide_experiment_tasks for select to anon, authenticated using (true);

drop policy if exists "traceguide run insert" on public.traceguide_agent_runs;
create policy "traceguide run insert" on public.traceguide_agent_runs for insert to anon, authenticated with check (true);

insert into public.traceguide_customers (id, display_name, segment, saved_allergens, preferred_resolution)
values
  ('cust-ke-demo', 'Ke Ma', 'standard', array['peanut'], 'refund')
on conflict (id) do update set
  display_name = excluded.display_name,
  segment = excluded.segment,
  saved_allergens = excluded.saved_allergens,
  preferred_resolution = excluded.preferred_resolution;

insert into public.traceguide_products (id, name, image_key, detail, category, return_class, price_gbp, allergens, policy_tags)
values
  ('prod-glass-lunch-box', 'Glass Lunch Box', 'glass-box', '1 item', 'homeware', 'standard', 18, '{}', array['damaged_item', 'standard_return']),
  ('prod-glass-food-container', 'Glass Food Container', 'container-set', '1 item', 'homeware', 'standard', 16, '{}', array['broken_item', 'replacement_or_refund']),
  ('prod-container-set', 'Glass Food Containers Set', 'container-set', '4-piece set', 'homeware', 'standard', 32, '{}', array['missing_accessory', 'late_delivery']),
  ('prod-milk-cookies', 'Milk Cookies', 'cookies', '100g / pack', 'packaged_food', 'food_quality_review', 4, array['peanut','sesame','egg','milk'], array['food_quality', 'allergen']),
  ('prod-coffee-maker', 'Coffee Maker', 'coffee-maker', '1 item', 'homeware', 'standard', 49, '{}', array['address_change', 'pre_dispatch']),
  ('prod-protein-bar', 'Protein Bar', 'protein-bar', '60g / bar', 'packaged_food', 'food_quality_review', 3, array['peanut','milk','soy'], array['allergen', 'product_safety']),
  ('prod-chilled-yoghurt', 'Chilled Yoghurt', 'yoghurt', '4 x 125g', 'chilled_food', 'perishable_exception', 5, array['milk'], array['perishable_exception', 'cold_chain']),
  ('prod-fresh-sandwich', 'Fresh Sandwich', 'sandwich', '1 pack', 'fresh_food', 'perishable_exception', 4, array['wheat','egg'], array['perishable_exception', 'fresh_food']),
  ('prod-snack-pack', 'Snack Pack', 'snack', '6-pack', 'snacks', 'food_quality_review', 7, '{}', array['damaged_package', 'evidence_required'])
on conflict (id) do update set
  name = excluded.name,
  image_key = excluded.image_key,
  detail = excluded.detail,
  category = excluded.category,
  return_class = excluded.return_class,
  price_gbp = excluded.price_gbp,
  allergens = excluded.allergens,
  policy_tags = excluded.policy_tags;

insert into public.traceguide_orders (id, customer_id, product_id, quantity, status, delivered_days_ago, promised_delivery_days_ago, cold_chain_ok, included_items)
values
  ('TC-2048', 'cust-ke-demo', 'prod-glass-lunch-box', 1, 'delivered', 2, null, null, '{}'),
  ('TC-2091', 'cust-ke-demo', 'prod-chilled-yoghurt', 1, 'delivered', 0, null, true, '{}'),
  ('TC-2104', 'cust-ke-demo', 'prod-milk-cookies', 1, 'delivered', 2, null, null, '{}'),
  ('TC-2152', 'cust-ke-demo', 'prod-coffee-maker', 1, 'processing', 0, null, null, '{}'),
  ('TC-2166', 'cust-ke-demo', 'prod-protein-bar', 1, 'delivered', 1, null, null, '{}'),
  ('TC-2118', 'cust-ke-demo', 'prod-glass-food-container', 1, 'delivered', 1, null, null, array['glass base','locking lid']),
  ('TC-2122', 'cust-ke-demo', 'prod-fresh-sandwich', 1, 'out_for_delivery', 0, null, true, '{}'),
  ('TC-2136', 'cust-ke-demo', 'prod-snack-pack', 1, 'delivered', 1, null, null, '{}'),
  ('TC-2140', 'cust-ke-demo', 'prod-container-set', 1, 'delivered', 0, 2, null, array['4 containers','4 matching lids'])
on conflict (id) do update set
  customer_id = excluded.customer_id,
  product_id = excluded.product_id,
  quantity = excluded.quantity,
  status = excluded.status,
  delivered_days_ago = excluded.delivered_days_ago,
  promised_delivery_days_ago = excluded.promised_delivery_days_ago,
  cold_chain_ok = excluded.cold_chain_ok,
  included_items = excluded.included_items;

insert into public.traceguide_evidence_records (id, order_id, status, description)
values
  ('ev-glass-damaged', 'TC-2048', 'photos_provided', 'Customer can provide photos of the damaged glass lunch box and packaging.'),
  ('ev-yoghurt-change-mind', 'TC-2091', 'not_required', 'No quality issue has been reported for the chilled yoghurt.'),
  ('ev-cookies-no-photo', 'TC-2104', 'not_added', 'Customer reported damage, but no photo evidence has been added yet.'),
  ('ev-coffee-address', 'TC-2152', 'not_required', 'Address change can be prepared because the order has not been dispatched.'),
  ('ev-protein-allergen', 'TC-2166', 'not_required', 'Product ingredient and allergen records are available for safety advice.'),
  ('ev-container-lid', 'TC-2118', 'photos_provided', 'Customer can provide photos showing the broken lid on arrival.'),
  ('ev-sandwich-change-mind', 'TC-2122', 'not_required', 'No quality, temperature, or incorrect-delivery issue has been reported.'),
  ('ev-snack-unclear', 'TC-2136', 'not_added', 'Package damage has been reported, but photo evidence is not yet attached.'),
  ('ev-container-set-missing', 'TC-2140', 'unclear', 'Accessory/package contents need confirmation before support action.')
on conflict (id) do update set
  order_id = excluded.order_id,
  status = excluded.status,
  description = excluded.description;

insert into public.traceguide_experiment_tasks (id, scenario_key, customer_id, order_id, issue_type, request_type, reason, default_evidence_status, correct_decision)
values
  ('S1-T1', 'allergen_safety', 'cust-ke-demo', 'TC-2104', 'Allergen concern', 'Product safety advice', 'Customer is allergic to peanuts', 'not_required', 'Do not eat the product; use ingredient and allergen evidence, or contact human support if unsure.'),
  ('S1-T2', 'coffee_maker_address_change', 'cust-ke-demo', 'TC-2152', 'Delivery address change', 'Change delivery address', 'Order has not been dispatched', 'not_required', 'Can prepare an address change request because the order has not been dispatched; user confirmation is required before submission.'),
  ('S1-T3', 'glass_damaged_refund', 'cust-ke-demo', 'TC-2048', 'Damaged item', 'Return & Refund', 'Item arrived damaged', 'photos_provided', 'Can prepare refund request after confirmation.'),
  ('S2-T1', 'protein_bar_allergen_safety', 'cust-ke-demo', 'TC-2166', 'Allergen concern', 'Product safety advice', 'Customer is allergic to peanuts', 'not_required', 'Do not eat the product; the product allergen record includes peanut risk, so user should not rely on a generic reassurance.'),
  ('S2-T2', 'fresh_sandwich_address_change', 'cust-ke-demo', 'TC-2122', 'Delivery address change', 'Change delivery address', 'Order is already out for delivery', 'not_required', 'Do not authorise a normal address change because the order is already out for delivery; send to human support if needed.'),
  ('S2-T3', 'snack_package_evidence_unclear', 'cust-ke-demo', 'TC-2136', 'Damaged package', 'Return & Refund', 'Package damage reported', 'not_added', 'Ask for photo evidence or human review before refund request.')
on conflict (id) do update set
  scenario_key = excluded.scenario_key,
  customer_id = excluded.customer_id,
  order_id = excluded.order_id,
  issue_type = excluded.issue_type,
  request_type = excluded.request_type,
  reason = excluded.reason,
  default_evidence_status = excluded.default_evidence_status,
  correct_decision = excluded.correct_decision;
