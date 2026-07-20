-- One-time, checksum-guarded backfill command. This is removed immediately by
-- the following migration after the controlled policy corpus is indexed.
create or replace function public.traceguide_set_policy_chunk_embedding(
  p_chunk_id uuid,
  p_content_checksum text,
  p_embedding extensions.vector(384)
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.traceguide_policy_chunks c
  set embedding = p_embedding, updated_at = now()
  from public.traceguide_policy_documents d
  where c.id = p_chunk_id
    and c.document_id = d.id
    and d.policy_key = 'damaged_item_resolution'
    and d.status = 'active'
    and c.content_checksum = p_content_checksum
    and c.embedding is null;
  return found;
end;
$$;

revoke all on function public.traceguide_set_policy_chunk_embedding(uuid, text, extensions.vector) from public;
grant execute on function public.traceguide_set_policy_chunk_embedding(uuid, text, extensions.vector) to anon, authenticated;
