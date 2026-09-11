-- OC Master private cloud saves (safe to re-run; existing rows are preserved).

begin;

create table if not exists public.oc_sync_heads (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('workshop', 'forum')),
  revision bigint not null default 1 check (revision > 0),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, scope)
);

create table if not exists public.oc_sync_upload_chunks (
  user_id uuid not null references auth.users(id) on delete cascade,
  upload_id uuid not null,
  scope text not null check (scope in ('workshop', 'forum')),
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, upload_id, scope, chunk_index)
);

alter table public.oc_sync_heads enable row level security;
alter table public.oc_sync_upload_chunks enable row level security;

revoke all on table public.oc_sync_heads from anon;
grant select on table public.oc_sync_heads to authenticated;
revoke all on table public.oc_sync_upload_chunks from public, anon, authenticated;

drop policy if exists "read own sync heads" on public.oc_sync_heads;
create policy "read own sync heads"
  on public.oc_sync_heads
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- PostgreSQL cannot change an existing function's return type with
-- CREATE OR REPLACE. Dropping this function does not remove saved rows.
drop function if exists public.oc_commit_snapshot_chunks(text, bigint, uuid, integer);
drop function if exists public.oc_stage_snapshot_chunk(text, uuid, integer, text);
drop function if exists public.oc_push_snapshot(text, bigint, jsonb);

create function public.oc_push_snapshot(
  p_scope text,
  p_expected_revision bigint,
  p_payload jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_scope not in ('workshop', 'forum') then
    raise exception 'INVALID_SCOPE';
  end if;
  if p_payload is null
     or coalesce(p_payload->>'format', '') <> 'oc-cloud-save'
     or coalesce(p_payload->>'version', '') <> '1'
     or coalesce(p_payload->>'scope', '') <> p_scope
     or coalesce(jsonb_typeof(p_payload->'data'), '') <> 'object' then
    raise exception 'INVALID_PAYLOAD';
  end if;

  if p_expected_revision = 0 then
    insert into public.oc_sync_heads(user_id, scope, revision, payload, updated_at)
    values (auth.uid(), p_scope, 1, p_payload, now())
    on conflict (user_id, scope) do nothing
    returning revision into next_revision;
  else
    update public.oc_sync_heads
       set revision = revision + 1,
           payload = p_payload,
           updated_at = now()
     where user_id = auth.uid()
       and scope = p_scope
       and revision = p_expected_revision
    returning revision into next_revision;
  end if;

  if next_revision is null then
    raise exception 'SYNC_CONFLICT';
  end if;
  return next_revision;
end;
$$;

revoke all on function public.oc_push_snapshot(text, bigint, jsonb) from public, anon;
grant execute on function public.oc_push_snapshot(text, bigint, jsonb) to authenticated;

create function public.oc_stage_snapshot_chunk(
  p_scope text,
  p_upload_id uuid,
  p_chunk_index integer,
  p_chunk text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_scope not in ('workshop', 'forum')
     or p_upload_id is null
     or p_chunk_index < 0
     or p_chunk_index > 4095
     or p_chunk is null
     or length(p_chunk) > 90000 then
    raise exception 'INVALID_CHUNK';
  end if;

  delete from public.oc_sync_upload_chunks
   where user_id = auth.uid()
     and created_at < now() - interval '1 day';

  insert into public.oc_sync_upload_chunks(user_id, upload_id, scope, chunk_index, content, created_at)
  values (auth.uid(), p_upload_id, p_scope, p_chunk_index, p_chunk, now())
  on conflict (user_id, upload_id, scope, chunk_index)
  do update set content = excluded.content, created_at = excluded.created_at;
end;
$$;

revoke all on function public.oc_stage_snapshot_chunk(text, uuid, integer, text) from public, anon;
grant execute on function public.oc_stage_snapshot_chunk(text, uuid, integer, text) to authenticated;

create function public.oc_commit_snapshot_chunks(
  p_scope text,
  p_expected_revision bigint,
  p_upload_id uuid,
  p_chunk_count integer
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  assembled_payload jsonb;
  next_revision bigint;
  actual_count integer;
  first_index integer;
  last_index integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_scope not in ('workshop', 'forum')
     or p_upload_id is null
     or p_chunk_count < 1
     or p_chunk_count > 4096 then
    raise exception 'INVALID_UPLOAD';
  end if;

  select count(*), min(chunk_index), max(chunk_index)
    into actual_count, first_index, last_index
    from public.oc_sync_upload_chunks
   where user_id = auth.uid()
     and upload_id = p_upload_id
     and scope = p_scope;

  if actual_count <> p_chunk_count or first_index <> 0 or last_index <> p_chunk_count - 1 then
    raise exception 'INCOMPLETE_UPLOAD';
  end if;

  select convert_from(decode(string_agg(content, '' order by chunk_index), 'base64'), 'UTF8')::jsonb
    into assembled_payload
    from public.oc_sync_upload_chunks
   where user_id = auth.uid()
     and upload_id = p_upload_id
     and scope = p_scope;

  select public.oc_push_snapshot(p_scope, p_expected_revision, assembled_payload)
    into next_revision;

  delete from public.oc_sync_upload_chunks
   where user_id = auth.uid()
     and upload_id = p_upload_id
     and scope = p_scope;

  return next_revision;
end;
$$;

revoke all on function public.oc_commit_snapshot_chunks(text, bigint, uuid, integer) from public, anon;
grant execute on function public.oc_commit_snapshot_chunks(text, bigint, uuid, integer) to authenticated;

notify pgrst, 'reload schema';

commit;
