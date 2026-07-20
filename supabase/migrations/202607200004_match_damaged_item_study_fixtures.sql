-- Remove unrelated delivery-delay cues and match the timing of paired tasks.
update public.traceguide_orders
set delivered_days_ago = 2,
    promised_delivery_days_ago = null
where id = 'TC-2118';

update public.traceguide_orders
set delivered_days_ago = 0,
    promised_delivery_days_ago = null
where id = 'TC-2140';
