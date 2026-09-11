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

alter table public.oc_sync_heads enable row level security;

revoke all on table public.oc_sync_heads from anon;
grant select on table public.oc_sync_heads to authenticated;

drop policy if exists "read own sync heads" on public.oc_sync_heads;
create policy "read own sync heads"
  on public.oc_sync_heads
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- PostgreSQL cannot change an existing function's return type with
-- CREATE OR REPLACE. Dropping this function does not remove saved rows.
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

notify pgrst, 'reload schema';

commit;
