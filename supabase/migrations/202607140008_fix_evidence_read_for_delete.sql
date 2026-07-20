-- Supabase Storage object removal requires both SELECT and DELETE policies.
-- Access remains private and scoped to an unguessable service-case token folder.

drop policy if exists "traceguide case evidence read" on storage.objects;
create policy "traceguide case evidence read"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'traceguide-evidence'
    and public.traceguide_case_token_exists((storage.foldername(name))[1])
  );
