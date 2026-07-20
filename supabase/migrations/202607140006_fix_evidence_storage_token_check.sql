-- Let Storage validate a case token without exposing private service-case rows.

create or replace function public.traceguide_case_token_exists(p_token_prefix text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.traceguide_service_cases c
    where c.public_token::text = p_token_prefix
  );
$$;

revoke all on function public.traceguide_case_token_exists(text) from public;
grant execute on function public.traceguide_case_token_exists(text) to anon, authenticated;

drop policy if exists "traceguide case evidence upload" on storage.objects;
create policy "traceguide case evidence upload"
  on storage.objects for insert to anon, authenticated
  with check (
    bucket_id = 'traceguide-evidence'
    and public.traceguide_case_token_exists((storage.foldername(name))[1])
  );
