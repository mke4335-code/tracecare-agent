-- Restore the tutor-required three-task block for each study version.
-- Both sets use the same damaged-item procedure and matched decision states:
-- ready to authorise, evidence required, and outside the standard window.

insert into public.traceguide_orders (
  id, customer_id, product_id, quantity, status, delivered_days_ago,
  promised_delivery_days_ago, cold_chain_ok, included_items
) values
  ('TC-2181', 'cust-ke-demo', 'prod-snack-pack', 1, 'delivered', 45, null, null, '{}'),
  ('TC-2182', 'cust-ke-demo', 'prod-milk-cookies', 1, 'delivered', 45, null, null, '{}')
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
  ('ev-snack-outside-window', 'TC-2181', 'photos_provided',
   'A clear photo shows the crushed snack package, but the order was delivered 45 days ago.'),
  ('ev-cookies-outside-window', 'TC-2182', 'photos_provided',
   'A clear photo shows the crushed cookie package, but the order was delivered 45 days ago.')
on conflict (id) do update set
  order_id = excluded.order_id,
  status = excluded.status,
  description = excluded.description;

insert into public.traceguide_experiment_tasks (
  id, scenario_key, customer_id, order_id, issue_type, request_type,
  reason, default_evidence_status, correct_decision
) values
  ('S1-T3', 'snack_damaged_outside_window', 'cust-ke-demo', 'TC-2181',
   'Damaged item', 'Refund or replacement',
   'Snack package arrived crushed and was reported after 45 days',
   'photos_provided',
   'Do not authorise a standard request; stop or ask human support because the order is outside the 30-day window.'),
  ('S2-T3', 'cookies_damaged_outside_window', 'cust-ke-demo', 'TC-2182',
   'Damaged item', 'Refund or replacement',
   'Milk-cookie package arrived crushed and was reported after 45 days',
   'photos_provided',
   'Do not authorise a standard request; stop or ask human support because the order is outside the 30-day window.')
on conflict (id) do update set
  scenario_key = excluded.scenario_key,
  customer_id = excluded.customer_id,
  order_id = excluded.order_id,
  issue_type = excluded.issue_type,
  request_type = excluded.request_type,
  reason = excluded.reason,
  default_evidence_status = excluded.default_evidence_status,
  correct_decision = excluded.correct_decision;
