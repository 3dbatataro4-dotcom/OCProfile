-- Diagnostic only: runs the real chunk commit, then deliberately rolls every
-- test write back inside a subtransaction. No snapshot, audit, history, batch,
-- or staged chunk from this probe is retained. Only a session-temp helper exists.
create or replace function pg_temp.oc_large_save_probe() returns jsonb language plpgsql as $$
declare h public.oc_sync_heads; f public.oc_sync_heads; p jsonb; entries jsonb; result jsonb;
 cid text; iv bigint; versions jsonb:='[]'; batch uuid:=gen_random_uuid(); encoded text;
 n int; i int; started timestamptz; elapsed numeric; prior_events bigint; prior_history bigint; prior_chunks bigint;
begin
 select * into h from public.oc_sync_heads where scope='workshop' order by octet_length(payload::text) desc limit 1;
 if not found then raise exception 'NO_WORKSHOP_SAVE';end if;
 perform set_config('request.jwt.claim.sub',h.user_id::text,true);
 p:=h.payload;
 for i in 0..least(19,jsonb_array_length(p#>'{data,characters}')-1) loop
  cid:=p#>>array['data','characters',i::text,'id'];
  select item_revision into iv from public.oc_collab_items where owner_id=h.user_id and scope=h.scope and group_name='characters' and item_id=cid;
  p:=jsonb_set(p,array['data','characters',i::text,'__commit_timeout_probe'],to_jsonb(batch::text));
  versions:=versions||jsonb_build_array(jsonb_build_object('group','characters','id',cid,'revision',coalesce(iv,0)));
 end loop;
 entries:=jsonb_build_array(jsonb_build_object('scope',h.scope,'expectedRevision',h.revision,'payload',p,'itemVersions',versions));
 select * into f from public.oc_sync_heads where user_id=h.user_id and scope='forum';
 if found then entries:=entries||jsonb_build_array(jsonb_build_object('scope',f.scope,'expectedRevision',f.revision,'payload',f.payload,'itemVersions','[]'::jsonb));end if;
 select count(*) into prior_events from public.oc_collab_events where owner_id=h.user_id;
 select count(*) into prior_history from public.oc_sync_history where user_id=h.user_id;
 select count(*) into prior_chunks from public.oc_collab_chunks where owner_id=h.user_id;
 encoded:=replace(encode(convert_to(jsonb_build_object('entries',entries,'restores','[]'::jsonb)::text,'UTF8'),'base64'),E'\n','');
 n:=ceil(length(encoded)::numeric/80000)::int;
 begin
  for i in 0..n-1 loop perform public.oc_collab_stage(h.user_id,batch,i,substr(encoded,i*80000+1,80000));end loop;
  started:=clock_timestamp();
  result:=public.oc_collab_commit_chunks(h.user_id,batch,n);
  elapsed:=extract(epoch from clock_timestamp()-started)*1000;
  raise exception using errcode='P0002',message='ROLLBACK_LARGE_SAVE_PROBE';
 exception when no_data_found then if sqlerrm<>'ROLLBACK_LARGE_SAVE_PROBE' then raise;end if;end;
 return jsonb_build_object('commit_verified',jsonb_array_length(result->'receipts')=jsonb_array_length(entries),'commit_ms',round(elapsed,1),'workshop_bytes',octet_length(h.payload::text),'scopes',jsonb_array_length(entries),'changed_records',jsonb_array_length(versions),'chunks',n,'revision_unchanged',(select revision=h.revision from public.oc_sync_heads where user_id=h.user_id and scope=h.scope),'audit_unchanged',(select count(*)=prior_events from public.oc_collab_events where owner_id=h.user_id),'history_unchanged',(select count(*)=prior_history from public.oc_sync_history where user_id=h.user_id),'chunks_unchanged',(select count(*)=prior_chunks from public.oc_collab_chunks where owner_id=h.user_id));
end;$$;
select pg_temp.oc_large_save_probe() as verified_large_save;
