-- Keep the two formal scenario sets matched and require one explicit action.
-- The buyer may change this choice in the shared action preview before approval.

update public.traceguide_experiment_tasks
set request_type = 'Refund',
    correct_decision = case
      when default_evidence_status = 'photos_provided'
        then 'Authorise preparation of a damaged-item refund request.'
      else 'Add a clear damage photo or ask human support before authorising a request.'
    end
where id in ('S1-T1', 'S1-T2', 'S2-T1', 'S2-T2');
