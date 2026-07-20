-- Align the live task fixtures with the four-task formal study configuration.
-- The previous six-task draft reused S1-T2/S2-T2 for address-change scenarios,
-- causing the API to reject live rows and fall back to local fixtures.

update public.traceguide_experiment_tasks
set scenario_key = 'glass_damaged_refund',
    customer_id = 'cust-ke-demo',
    order_id = 'TC-2048',
    issue_type = 'Damaged item',
    request_type = 'Return & Refund',
    reason = 'Item arrived damaged',
    default_evidence_status = 'photos_provided',
    correct_decision = 'Can prepare a refund request because the item is damaged, in the return window, and photo evidence is available.'
where id = 'S1-T2';

update public.traceguide_experiment_tasks
set scenario_key = 'snack_package_evidence_unclear',
    customer_id = 'cust-ke-demo',
    order_id = 'TC-2136',
    issue_type = 'Damaged package',
    request_type = 'Return & Refund',
    reason = 'Package damage reported',
    default_evidence_status = 'not_added',
    correct_decision = 'Ask for photo evidence or human review before a refund request is prepared.'
where id = 'S2-T2';

delete from public.traceguide_experiment_tasks
where id in ('S1-T3', 'S2-T3');

