-- Collaboration v2 performance fix (2026-10-21).
-- Saves were failing with "canceling statement due to statement timeout".
-- oc_collab_push_batch and the oc_collab_audit trigger looked up every record by re-scanning the whole
-- JSON array for each id, so every save cost O(n²) per group (mediaLibrary alone has 500+ rows),
-- even when only one field changed. These versions build an id→record map once per group and skip
-- groups that did not change. Checks, journal entries, tombstones and errors are unchanged.
-- Safe to run more than once. Run after upgrade-collaboration-v2.sql.
begin;

create or replace function public.oc_collab_diff(p_before jsonb,p_after jsonb,p_path jsonb default '[]') returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]';k text;ids_before jsonb;ids_after jsonb;keyed boolean;map_before jsonb;map_after jsonb;
begin
 if p_before is not distinct from p_after then return result;end if;
 if jsonb_typeof(p_before)='object' and jsonb_typeof(p_after)='object' then
  for k in select key from jsonb_object_keys(p_before||p_after) as keys(key) order by key loop result:=result||public.oc_collab_diff(p_before->k,p_after->k,p_path||jsonb_build_array(k));end loop;
 elsif jsonb_typeof(p_before)='array' and jsonb_typeof(p_after)='array' then
  select not exists(select 1 from jsonb_array_elements(p_before||p_after) as a(v) where jsonb_typeof(v)<>'object' or coalesce(v->>'id','')='') and (select count(*)=count(distinct v->>'id') from jsonb_array_elements(p_before) as a(v)) and (select count(*)=count(distinct v->>'id') from jsonb_array_elements(p_after) as a(v)) into keyed;
  if keyed then
   select coalesce(jsonb_object_agg(v->>'id',v),'{}') into map_before from jsonb_array_elements(p_before) as a(v);
   select coalesce(jsonb_object_agg(v->>'id',v),'{}') into map_after from jsonb_array_elements(p_after) as a(v);
   for k in select distinct v->>'id' from jsonb_array_elements(p_before||p_after) as a(v) loop
    result:=result||public.oc_collab_diff(map_before->k,map_after->k,p_path||jsonb_build_array(jsonb_build_object('id',k)));
   end loop;
   select coalesce(jsonb_agg(v->>'id'),'[]') into ids_before from jsonb_array_elements(p_before) as a(v);
   select coalesce(jsonb_agg(v->>'id'),'[]') into ids_after from jsonb_array_elements(p_after) as a(v);
   if ids_before<>ids_after then result:=result||jsonb_build_array(jsonb_build_object('path',p_path||jsonb_build_array(jsonb_build_object('order',true)),'operation','reorder','before',ids_before,'after',ids_after,'beforeExists',true,'afterExists',true));end if;
  else result:=jsonb_build_array(jsonb_build_object('path',p_path,'operation','update','before',p_before,'after',p_after,'beforeExists',true,'afterExists',true));end if;
 else result:=jsonb_build_array(jsonb_build_object('path',p_path,'operation',case when p_before is null then 'add' when p_after is null then 'delete' else 'update' end,'before',p_before,'after',p_after,'beforeExists',p_before is not null,'afterExists',p_after is not null));end if;
 return result;
end;$$;

create or replace function public.oc_collab_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb;batch uuid;g text;k text;prior jsonb;current_value jsonb;record_before jsonb;record_after jsonb;changes jsonb;d jsonb;t record;restores jsonb;iv bigint;source_name text;restored jsonb;before_map jsonb;after_map jsonb;
begin
 a:=public.oc_collab_actor();select batch_id,i.restores into batch,restores from public.oc_collab_inflight i where transaction_id=txid_current() and owner_id=new.user_id and actor_id=auth.uid();batch:=coalesce(batch,gen_random_uuid());restores:=coalesce(restores,'[]');
 prior:=case when tg_op='UPDATE' then old.payload->'data' else '{}'::jsonb end;
 for g in select key from jsonb_object_keys(coalesce(prior,'{}')||coalesce(new.payload->'data','{}')) as groups(key) loop
  select coalesce(jsonb_object_agg(v->>'id',v),'{}') into before_map from jsonb_array_elements(coalesce(prior->g,'[]')) as items(v) where coalesce(v->>'id','')<>'';
  select coalesce(jsonb_object_agg(v->>'id',v),'{}') into after_map from jsonb_array_elements(coalesce(new.payload#>array['data',g],'[]')) as items(v) where coalesce(v->>'id','')<>'';
  if before_map is distinct from after_map then
  for k in select key from jsonb_object_keys(before_map||after_map) as ids(key) loop
   record_before:=before_map->k;record_after:=after_map->k;
   if record_before is not distinct from record_after then continue;end if;
   restored:='[]';
   for t in select * from public.oc_collab_tombstones where owner_id=new.user_id and scope=new.scope and group_name=g and item_id=k loop
    current_value:=public.oc_collab_at(record_after,t.path);
    if current_value is not null then
     if not exists(select 1 from jsonb_array_elements(restores) as tokens(v) where v->>'scope'=new.scope and v->>'group'=g and v->>'id'=k and v->'path'=t.path and (v->>'revision')::bigint=t.deleted_revision) then raise exception 'TOMBSTONE_RESTORE_REQUIRED';end if;
     restored:=restored||jsonb_build_array(t.path);
     delete from public.oc_collab_tombstones where owner_id=new.user_id and scope=new.scope and group_name=g and item_id=k and path_key=t.path_key;
    end if;
   end loop;
   insert into public.oc_collab_items(owner_id,scope,group_name,item_id,item_revision,deleted,actor_id,actor_name,changed_at) values(new.user_id,new.scope,g,k,1,record_after is null,auth.uid(),a->>'displayName',now()) on conflict(owner_id,scope,group_name,item_id) do update set item_revision=oc_collab_items.item_revision+1,deleted=excluded.deleted,actor_id=excluded.actor_id,actor_name=excluded.actor_name,changed_at=excluded.changed_at returning item_revision into iv;
   source_name:=coalesce(record_after->>'name',record_after->>'title',record_after->>'subject',record_before->>'name',record_before->>'title',record_before->>'subject',k);
   changes:=public.oc_collab_diff(record_before,record_after);
   for d in select v from jsonb_array_elements(changes) as entries(v) loop
    if d->>'operation'='add' and exists(select 1 from jsonb_array_elements(restored) as paths(p) where p=d->'path') then d:=jsonb_set(d,'{operation}','"restore"');end if;
    insert into public.oc_collab_events(batch_id,owner_id,scope,group_name,item_id,item_name,item_revision,path,operation,before_value,after_value,before_exists,after_exists,actor_id,actor_name,actor_email) values(batch,new.user_id,new.scope,g,k,source_name,iv,d->'path',d->>'operation',d->'before',d->'after',(d->>'beforeExists')::boolean,(d->>'afterExists')::boolean,auth.uid(),a->>'displayName',a->>'email');
    if d->>'operation'='delete' then insert into public.oc_collab_tombstones(owner_id,scope,group_name,item_id,path,path_key,deleted_revision,actor_id) values(new.user_id,new.scope,g,k,d->'path',(d->'path')::text,iv,auth.uid()) on conflict(owner_id,scope,group_name,item_id,path_key) do update set deleted_revision=excluded.deleted_revision,actor_id=excluded.actor_id,deleted_at=now();end if;
   end loop;
  end loop;
  end if;
  if coalesce(prior->g,'[]')<>coalesce(new.payload#>array['data',g],'[]') and (select coalesce(jsonb_agg(v->>'id'),'[]') from jsonb_array_elements(coalesce(prior->g,'[]')) as r(v))<>(select coalesce(jsonb_agg(v->>'id'),'[]') from jsonb_array_elements(coalesce(new.payload#>array['data',g],'[]')) as r(v)) then
   insert into public.oc_collab_events(batch_id,owner_id,scope,group_name,item_id,item_name,item_revision,path,operation,before_value,after_value,before_exists,after_exists,actor_id,actor_name,actor_email) values(batch,new.user_id,new.scope,g,'__collection_order__','清單順序',new.revision,'[]','reorder',(select coalesce(jsonb_agg(v->>'id'),'[]') from jsonb_array_elements(coalesce(prior->g,'[]')) as r(v)),(select coalesce(jsonb_agg(v->>'id'),'[]') from jsonb_array_elements(coalesce(new.payload#>array['data',g],'[]')) as r(v)),true,true,auth.uid(),a->>'displayName',a->>'email');
  end if;
 end loop;return new;
end;$$;

create or replace function public.oc_collab_push_batch(p_owner uuid,p_batch_id uuid,p_entries jsonb,p_restores jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' set statement_timeout='55s' as $$
declare a jsonb;entry jsonb;h public.oc_sync_heads;expected bigint;g text;k text;v bigint;record_value jsonb;old_value jsonb;rec record;receipts jsonb:='[]';scopes text[]:='{}';allowed text[];item_expected jsonb;cached public.oc_collab_batches;fingerprint text;old_map jsonb;new_map jsonb;versions jsonb;
begin
 a:=public.oc_collab_actor();if not public.oc_collab_allowed(p_owner,true) then raise exception 'EDIT_PERMISSION_REQUIRED';end if;
 if p_batch_id is null or jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) not between 1 and 2 or jsonb_typeof(p_restores) is distinct from 'array' then raise exception 'INVALID_BATCH';end if;
 fingerprint:=md5(p_owner::text||p_entries::text||p_restores::text);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_batch_id::text,0));
 select * into cached from public.oc_collab_batches where actor_id=auth.uid() and batch_id=p_batch_id;
 if cached.batch_id is not null then if cached.request_hash<>fingerprint or cached.owner_id<>p_owner then raise exception 'BATCH_ID_REUSED';end if;return cached.result;end if;
 -- Lock both scopes in the same order, including currently empty areas.
 for entry in select value from jsonb_array_elements(p_entries) order by value->>'scope' loop
  if coalesce(entry->>'scope','') not in ('workshop','forum') or (entry->>'scope')=any(scopes) then raise exception 'INVALID_SCOPE';end if;scopes:=array_append(scopes,entry->>'scope');
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||(entry->>'scope'),0));
  select * into h from public.oc_sync_heads where user_id=p_owner and scope=entry->>'scope' for update;
  if (entry->>'expectedRevision')::bigint is null or (entry->>'expectedRevision')::bigint<0 or coalesce(h.revision,0)<>(entry->>'expectedRevision')::bigint then raise exception 'SYNC_CONFLICT';end if;
  if (entry->'payload'->>'format') is distinct from 'oc-cloud-save' or (entry->'payload'->>'version') is distinct from '1' or (entry->'payload'->>'scope') is distinct from (entry->>'scope') or jsonb_typeof(entry->'payload'->'data') is distinct from 'object' or jsonb_typeof(entry->'itemVersions') is distinct from 'array' then raise exception 'INVALID_PAYLOAD';end if;
  allowed:=case when entry->>'scope'='workshop' then array['characters','paros','factions','rankings','cps','books','documents','timelines','mediaLibrary','visualNovelTemplates','visualNovelPreferences','customPresetAvatars','collapsedBooks','perspectiveTargets'] else array['boards','characters','worlds','factions','relationships','loreEntries','accounts','users','posts','comments','tagCatalog','favoriteFolders','chatContacts','chats','chatMessages'] end;
  select coalesce(jsonb_object_agg((r->>'group')||chr(31)||(r->>'id'),r),'{}') into versions from jsonb_array_elements(entry->'itemVersions') as x(r) where r->>'group' is not null and r->>'id' is not null;
  for g in select key from jsonb_object_keys(coalesce(h.payload->'data','{}')||(entry->'payload'->'data')) as names(key) loop
   if not(g=any(allowed)) or jsonb_typeof(coalesce(entry->'payload'->'data'->g,'[]'))<>'array' then raise exception 'INVALID_GROUP';end if;
   if exists(select 1 from jsonb_array_elements(coalesce(entry->'payload'->'data'->g,'[]')) as x(r) where jsonb_typeof(r)<>'object' or coalesce(r->>'id','')='') or (select count(*)<>count(distinct r->>'id') from jsonb_array_elements(coalesce(entry->'payload'->'data'->g,'[]')) as x(r)) then raise exception 'INVALID_ITEM_ID';end if;
   select coalesce(jsonb_object_agg(r->>'id',r),'{}') into old_map from jsonb_array_elements(coalesce(h.payload->'data'->g,'[]')) as x(r) where coalesce(r->>'id','')<>'';
   select coalesce(jsonb_object_agg(r->>'id',r),'{}') into new_map from jsonb_array_elements(coalesce(entry->'payload'->'data'->g,'[]')) as x(r);
   if old_map=new_map then continue;end if;
   for k in select key from jsonb_object_keys(old_map||new_map) as ids(key) loop
    old_value:=old_map->k;record_value:=new_map->k;
    if record_value is not distinct from old_value then continue;end if;
    select item_revision into v from public.oc_collab_items where owner_id=p_owner and scope=entry->>'scope' and group_name=g and item_id=k;
    item_expected:=versions->(g||chr(31)||k);
    if item_expected is null or (item_expected->>'revision')::bigint is distinct from coalesce(v,0) then raise exception 'ITEM_VERSION_CONFLICT';end if;
   end loop;
  end loop;
 end loop;
 insert into public.oc_collab_inflight values(txid_current(),p_owner,p_batch_id,auth.uid(),p_restores);
 insert into public.oc_collab_spaces(owner_id,minimum_protocol) values(p_owner,2) on conflict(owner_id) do update set minimum_protocol=2;
 for entry in select value from jsonb_array_elements(p_entries) order by value->>'scope' loop
  select * into h from public.oc_sync_heads where user_id=p_owner and scope=entry->>'scope' for update;expected:=coalesce(h.revision,0);
  if expected>0 then insert into public.oc_sync_history(user_id,scope,revision,payload) values(p_owner,entry->>'scope',expected,h.payload) on conflict do nothing;end if;
  insert into public.oc_sync_heads(user_id,scope,revision,payload) values(p_owner,entry->>'scope',expected+1,entry->'payload') on conflict(user_id,scope) do update set revision=excluded.revision,payload=excluded.payload,updated_at=now() returning * into h;
  delete from public.oc_sync_history where user_id=p_owner and scope=h.scope and revision not in(select revision from public.oc_sync_history where user_id=p_owner and scope=h.scope order by revision desc limit 20);
  receipts:=receipts||jsonb_build_array(jsonb_build_object('scope',h.scope,'revision',h.revision,'writer',h.payload->'writer','updated_at',h.updated_at));
 end loop;
 delete from public.oc_collab_inflight where transaction_id=txid_current() and owner_id=p_owner;
 insert into public.oc_collab_batches values(auth.uid(),p_owner,p_batch_id,fingerprint,jsonb_build_object('batchId',p_batch_id,'receipts',receipts),now());
 return jsonb_build_object('batchId',p_batch_id,'receipts',receipts);
end;$$;

-- Internal helpers stay private; only the RPC surface is callable (same grants as v2).
revoke all on function public.oc_collab_diff(jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.oc_collab_audit() from public,anon,authenticated;
revoke all on function public.oc_collab_push_batch(uuid,uuid,jsonb,jsonb) from public,anon;
grant execute on function public.oc_collab_push_batch(uuid,uuid,jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
