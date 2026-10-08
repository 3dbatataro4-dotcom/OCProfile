-- Safe RPC-only upgrade; preserves existing tables, saves, and permissions.
create or replace function public.oc_push_delta(
  p_scope text,
  p_expected_revision bigint,
  p_delta jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_payload jsonb;
  next_payload jsonb;
  item jsonb;
  group_name text;
  item_id text;
  rows jsonb;
  ordered_rows jsonb;
  next_revision bigint;
  allowed_groups text[];
  order_entry record;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_scope not in ('workshop', 'forum') then raise exception 'INVALID_SCOPE'; end if;
  if p_expected_revision < 1
     or p_delta is null
     or coalesce(p_delta->>'format', '') <> 'oc-cloud-delta'
     or coalesce(p_delta->>'version', '') <> '1'
     or coalesce(p_delta->>'scope', '') <> p_scope
     or coalesce(jsonb_typeof(p_delta->'changes'), '') <> 'array'
     or coalesce(jsonb_typeof(p_delta->'orders'), '') <> 'object'
     or jsonb_array_length(p_delta->'changes') > 20000 then
    raise exception 'INVALID_DELTA';
  end if;

  allowed_groups := case when p_scope = 'workshop' then
    array['characters','paros','factions','rankings','cps','books','documents','timelines','mediaLibrary','visualNovelTemplates','visualNovelPreferences','collapsedBooks','perspectiveTargets']
  else
    array['boards','characters','worlds','factions','relationships','loreEntries','accounts','users','posts','comments','tagCatalog','favoriteFolders','chatContacts','chats','chatMessages']
  end;

  select payload into current_payload
    from public.oc_sync_heads
   where user_id = auth.uid() and scope = p_scope and revision = p_expected_revision
   for update;
  if current_payload is null then raise exception 'SYNC_CONFLICT'; end if;
  next_payload := current_payload;

  for item in select value from jsonb_array_elements(p_delta->'changes') loop
    group_name := item->>'group'; item_id := item->>'id';
    if group_name is null or not (group_name = any(allowed_groups)) or coalesce(item_id, '') = '' then raise exception 'INVALID_DELTA_ITEM'; end if;
    rows := coalesce(next_payload #> array['data', group_name], '[]'::jsonb);
    if jsonb_typeof(rows) <> 'array' then raise exception 'INVALID_DELTA_GROUP'; end if;
    select coalesce(jsonb_agg(value order by ordinal), '[]'::jsonb) into rows from jsonb_array_elements(rows) with ordinality as existing(value, ordinal) where value->>'id' <> item_id;
    if item ? 'value' and jsonb_typeof(item->'value') <> 'null' then
      if jsonb_typeof(item->'value') <> 'object' or item->'value'->>'id' <> item_id then raise exception 'INVALID_DELTA_VALUE'; end if;
      rows := rows || jsonb_build_array(item->'value');
    end if;
    -- Older snapshots may not contain groups introduced by a newer client.
    -- Create the missing group while applying the first delta instead of
    -- silently discarding the update.
    next_payload := jsonb_set(next_payload, array['data', group_name], rows, true);
  end loop;

  for order_entry in select key, value from jsonb_each(p_delta->'orders') loop
    group_name := order_entry.key;
    if not (group_name = any(allowed_groups)) or jsonb_typeof(order_entry.value) <> 'array' then raise exception 'INVALID_DELTA_ORDER'; end if;
    rows := coalesce(next_payload #> array['data', group_name], '[]'::jsonb);
    select coalesce(jsonb_agg(existing.value order by wanted.ordinality), '[]'::jsonb)
      into ordered_rows
      from jsonb_array_elements_text(order_entry.value) with ordinality as wanted(id, ordinality)
      join jsonb_array_elements(rows) as existing(value) on existing.value->>'id' = wanted.id;
    if jsonb_array_length(ordered_rows) <> jsonb_array_length(rows) then raise exception 'INVALID_DELTA_ORDER'; end if;
    next_payload := jsonb_set(next_payload, array['data', group_name], ordered_rows, true);
  end loop;

  next_payload := jsonb_set(next_payload, '{note}', to_jsonb(left(coalesce(p_delta->>'note',''),16)), true);
  update public.oc_sync_heads set payload=next_payload,revision=revision+1,updated_at=now()
   where user_id=auth.uid() and scope=p_scope and revision=p_expected_revision returning revision into next_revision;
  if next_revision is null then raise exception 'SYNC_CONFLICT'; end if;
  return next_revision;
end;
$$;

revoke all on function public.oc_push_delta(text, bigint, jsonb) from public, anon;
grant execute on function public.oc_push_delta(text, bigint, jsonb) to authenticated;

