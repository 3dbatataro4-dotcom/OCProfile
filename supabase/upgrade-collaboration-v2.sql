-- Verified collaboration, field audit, tombstones and atomic multi-area commits.
-- Run after setup.sql / upgrade-sync-history.sql. Existing saves stay in place.
begin;
-- Keep the metadata backfill and trigger installation consistent with live writes.
lock table public.oc_sync_heads in share row exclusive mode;
create table if not exists public.oc_collab_profiles(user_id uuid primary key references auth.users(id) on delete cascade,display_name text not null check(length(display_name) between 1 and 60));
create table if not exists public.oc_collab_spaces(owner_id uuid primary key references auth.users(id) on delete cascade,label text not null default '我的創作存檔' check(length(label) between 1 and 80));
alter table public.oc_collab_spaces add column if not exists minimum_protocol int not null default 1 check(minimum_protocol in (1,2));
create table if not exists public.oc_collab_inflight(transaction_id bigint not null,owner_id uuid not null,batch_id uuid not null,actor_id uuid not null,restores jsonb not null,primary key(transaction_id,owner_id));
alter table public.oc_collab_inflight enable row level security;
revoke all on public.oc_collab_inflight from public,anon,authenticated;
create table if not exists public.oc_collab_members(owner_id uuid not null references auth.users(id) on delete cascade,member_id uuid not null references auth.users(id) on delete cascade,role text not null check(role in ('editor','viewer')),primary key(owner_id,member_id),check(owner_id<>member_id));
create table if not exists public.oc_collab_invites(token uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,email text not null,role text not null check(role in ('editor','viewer')),expires_at timestamptz not null default now()+interval '7 days',accepted_at timestamptz);
create table if not exists public.oc_collab_items(owner_id uuid not null references auth.users(id) on delete cascade,scope text not null,group_name text not null,item_id text not null,item_revision bigint not null default 1,deleted boolean not null default false,actor_id uuid references auth.users(id) on delete set null,actor_name text not null default '',changed_at timestamptz not null default now(),primary key(owner_id,scope,group_name,item_id));
create table if not exists public.oc_collab_tombstones(owner_id uuid not null references auth.users(id) on delete cascade,scope text not null,group_name text not null,item_id text not null,path jsonb not null,path_key text not null,deleted_revision bigint not null,actor_id uuid references auth.users(id) on delete set null,deleted_at timestamptz not null default now(),primary key(owner_id,scope,group_name,item_id,path_key));
create table if not exists public.oc_collab_events(event_id bigint generated always as identity primary key,batch_id uuid not null,owner_id uuid not null references auth.users(id) on delete cascade,scope text not null,group_name text not null,item_id text not null,item_name text not null default '',item_revision bigint not null,path jsonb not null,operation text not null,before_value jsonb,after_value jsonb,before_exists boolean not null,after_exists boolean not null,actor_id uuid references auth.users(id) on delete set null,actor_name text not null,actor_email text not null,created_at timestamptz not null default now());
create index if not exists oc_collab_events_page on public.oc_collab_events(owner_id,event_id desc);
create table if not exists public.oc_collab_chunks(actor_id uuid not null references auth.users(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,batch_id uuid not null,chunk_index int not null check(chunk_index between 0 and 4095),content text not null,created_at timestamptz not null default now(),primary key(actor_id,batch_id,chunk_index));
create table if not exists public.oc_collab_batches(actor_id uuid not null references auth.users(id) on delete cascade,owner_id uuid not null references auth.users(id) on delete cascade,batch_id uuid not null,request_hash text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,batch_id));
alter table public.oc_collab_batches enable row level security;
revoke all on public.oc_collab_batches from public,anon,authenticated;
-- Internal tables have no direct client write/read privileges. RPCs check permissions.
alter table public.oc_collab_profiles enable row level security;
alter table public.oc_collab_spaces enable row level security;
alter table public.oc_collab_members enable row level security;
alter table public.oc_collab_invites enable row level security;
alter table public.oc_collab_items enable row level security;
alter table public.oc_collab_tombstones enable row level security;
alter table public.oc_collab_events enable row level security;
alter table public.oc_collab_chunks enable row level security;
revoke all on public.oc_collab_profiles,public.oc_collab_spaces,public.oc_collab_members,public.oc_collab_invites,public.oc_collab_items,public.oc_collab_tombstones,public.oc_collab_events,public.oc_collab_chunks from public,anon,authenticated;

create or replace function public.oc_collab_actor() returns jsonb language plpgsql security definer set search_path='' as $$
declare u record;n text;
begin
 select id,email,email_confirmed_at into u from auth.users where id=auth.uid();
 if u.id is null then raise exception 'AUTH_REQUIRED';end if;
 if u.email_confirmed_at is null then raise exception 'EMAIL_NOT_CONFIRMED';end if;
 select display_name into n from public.oc_collab_profiles where user_id=u.id;
 return jsonb_build_object('id',u.id,'email',u.email,'displayName',coalesce(n,u.email),'verified',true);
end;$$;
create or replace function public.oc_collab_allowed(p_owner uuid,p_write boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.uid() is not null and (auth.uid()=p_owner or exists(select 1 from public.oc_collab_members where owner_id=p_owner and member_id=auth.uid() and (not p_write or role='editor'))),false);
$$;
create or replace function public.oc_collab_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb;s jsonb;
begin
 a:=public.oc_collab_actor();insert into public.oc_collab_spaces(owner_id) values(auth.uid()) on conflict do nothing;
 select coalesce(jsonb_agg(jsonb_build_object('ownerId',sp.owner_id,'label',sp.label,'role',case when sp.owner_id=auth.uid() then 'owner' else m.role end,'minimumProtocol',sp.minimum_protocol) order by sp.owner_id=auth.uid() desc,sp.label),'[]') into s from public.oc_collab_spaces sp left join public.oc_collab_members m on m.owner_id=sp.owner_id and m.member_id=auth.uid() where sp.owner_id=auth.uid() or m.member_id is not null;
 return jsonb_build_object('protocol',2,'actor',a,'spaces',s);
end;$$;
create or replace function public.oc_collab_profile(p_name text) returns jsonb language plpgsql security definer set search_path='' as $$
begin perform public.oc_collab_actor();if length(btrim(p_name)) not between 1 and 60 then raise exception 'INVALID_NAME';end if;insert into public.oc_collab_profiles values(auth.uid(),btrim(p_name)) on conflict(user_id) do update set display_name=excluded.display_name;return public.oc_collab_actor();end;$$;
create or replace function public.oc_collab_invite(p_email text,p_role text) returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid;
begin perform public.oc_collab_actor();if p_role not in ('editor','viewer') or coalesce(p_email,'') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'INVALID_INVITE';end if;insert into public.oc_collab_spaces(owner_id) values(auth.uid()) on conflict do nothing;insert into public.oc_collab_invites(owner_id,email,role) values(auth.uid(),lower(btrim(p_email)),p_role) returning token into t;return jsonb_build_object('token',t,'email',lower(btrim(p_email)),'expiresInDays',7);end;$$;
create or replace function public.oc_collab_accept(p_token uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb;i public.oc_collab_invites;
begin a:=public.oc_collab_actor();select * into i from public.oc_collab_invites where token=p_token for update;if i.token is null or i.accepted_at is not null or i.expires_at<=now() or lower(a->>'email')<>i.email or i.owner_id=auth.uid() then raise exception 'INVITE_UNAVAILABLE';end if;insert into public.oc_collab_members values(i.owner_id,auth.uid(),i.role) on conflict(owner_id,member_id) do update set role=excluded.role;update public.oc_collab_invites set accepted_at=now() where token=p_token;return public.oc_collab_status();end;$$;
create or replace function public.oc_collab_members_list(p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin perform public.oc_collab_actor();if auth.uid()<>p_owner then raise exception 'OWNER_REQUIRED';end if;select coalesce(jsonb_agg(jsonb_build_object('id',m.member_id,'email',u.email,'name',coalesce(p.display_name,u.email),'role',m.role)),'[]') into result from public.oc_collab_members m join auth.users u on u.id=m.member_id left join public.oc_collab_profiles p on p.user_id=m.member_id where m.owner_id=p_owner;return result;end;$$;
create or replace function public.oc_collab_revoke(p_member uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform public.oc_collab_actor();delete from public.oc_collab_members where owner_id=auth.uid() and member_id=p_member;update public.oc_collab_invites set accepted_at=coalesce(accepted_at,now()) where owner_id=auth.uid() and email in(select lower(email) from auth.users where id=p_member);end;$$;

-- A path uses object keys or {id:"stable-id"} segments for array entries.
create or replace function public.oc_collab_at(p_value jsonb,p_path jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare value jsonb:=p_value;part jsonb;
begin for part in select x from jsonb_array_elements(p_path) as parts(x) loop
 if jsonb_typeof(part)='object' and part ? 'id' then
  if jsonb_typeof(value)<>'array' then return null;end if;
  select x into value from jsonb_array_elements(value) as items(x) where x->>'id'=part->>'id' limit 1;
 elsif jsonb_typeof(part)='object' then return null;
 else if jsonb_typeof(value)<>'object' then return null;end if;value:=value->(part#>>'{}');end if;
 end loop;return value;end;$$;
create or replace function public.oc_collab_diff(p_before jsonb,p_after jsonb,p_path jsonb default '[]') returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:='[]';k text;ids_before jsonb;ids_after jsonb;one jsonb;two jsonb;keyed boolean;
begin
 if p_before is not distinct from p_after then return result;end if;
 if jsonb_typeof(p_before)='object' and jsonb_typeof(p_after)='object' then
  for k in select key from jsonb_object_keys(p_before||p_after) as keys(key) order by key loop result:=result||public.oc_collab_diff(p_before->k,p_after->k,p_path||jsonb_build_array(k));end loop;
 elsif jsonb_typeof(p_before)='array' and jsonb_typeof(p_after)='array' then
  select not exists(select 1 from jsonb_array_elements(p_before||p_after) as a(v) where jsonb_typeof(v)<>'object' or coalesce(v->>'id','')='') and (select count(*)=count(distinct v->>'id') from jsonb_array_elements(p_before) as a(v)) and (select count(*)=count(distinct v->>'id') from jsonb_array_elements(p_after) as a(v)) into keyed;
  if keyed then
   for k in select distinct v->>'id' from jsonb_array_elements(p_before||p_after) as a(v) loop
    select v into one from jsonb_array_elements(p_before) as a(v) where v->>'id'=k;
    select v into two from jsonb_array_elements(p_after) as a(v) where v->>'id'=k;
    result:=result||public.oc_collab_diff(one,two,p_path||jsonb_build_array(jsonb_build_object('id',k)));
   end loop;
   select coalesce(jsonb_agg(v->>'id'),'[]') into ids_before from jsonb_array_elements(p_before) as a(v);
   select coalesce(jsonb_agg(v->>'id'),'[]') into ids_after from jsonb_array_elements(p_after) as a(v);
   if ids_before<>ids_after then result:=result||jsonb_build_array(jsonb_build_object('path',p_path||jsonb_build_array(jsonb_build_object('order',true)),'operation','reorder','before',ids_before,'after',ids_after,'beforeExists',true,'afterExists',true));end if;
  else result:=jsonb_build_array(jsonb_build_object('path',p_path,'operation','update','before',p_before,'after',p_after,'beforeExists',true,'afterExists',true));end if;
 else result:=jsonb_build_array(jsonb_build_object('path',p_path,'operation',case when p_before is null then 'add' when p_after is null then 'delete' else 'update' end,'before',p_before,'after',p_after,'beforeExists',p_before is not null,'afterExists',p_after is not null));end if;
 return result;
end;$$;

create or replace function public.oc_collab_stamp() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb;source jsonb;
begin
 a:=public.oc_collab_actor();if not public.oc_collab_allowed(new.user_id,true) then raise exception 'EDIT_PERMISSION_REQUIRED';end if;
 if exists(select 1 from public.oc_collab_spaces where owner_id=new.user_id and minimum_protocol>=2) and not exists(select 1 from public.oc_collab_inflight where transaction_id=txid_current() and owner_id=new.user_id and actor_id=auth.uid()) then raise exception 'CLIENT_UPGRADE_REQUIRED';end if;
 source:=coalesce(new.payload->'writer','{}');
 new.payload:=jsonb_set(new.payload,'{writer}',jsonb_build_object('actorId',a->>'id','actorName',a->>'displayName','actorEmail',a->>'email','verified',true,'deviceName',left(coalesce(source->>'deviceName',''),40),'deviceId',left(coalesce(source->>'deviceId',''),80),'mode',left(coalesce(source->>'mode','collaborate'),24),'updatedAt',now()),true);
 new.updated_at:=now();return new;
end;$$;
create or replace function public.oc_collab_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb;batch uuid;g text;k text;prior jsonb;current_value jsonb;record_before jsonb;record_after jsonb;changes jsonb;d jsonb;t record;restores jsonb;iv bigint;source_name text;restored jsonb;
begin
 a:=public.oc_collab_actor();select batch_id,i.restores into batch,restores from public.oc_collab_inflight i where transaction_id=txid_current() and owner_id=new.user_id and actor_id=auth.uid();batch:=coalesce(batch,gen_random_uuid());restores:=coalesce(restores,'[]');
 prior:=case when tg_op='UPDATE' then old.payload->'data' else '{}'::jsonb end;
 for g in select key from jsonb_object_keys(coalesce(prior,'{}')||coalesce(new.payload->'data','{}')) as groups(key) loop
  for k in select distinct v->>'id' from jsonb_array_elements(coalesce(prior->g,'[]')||coalesce(new.payload#>array['data',g],'[]')) as items(v) where v ? 'id' loop
   select v into record_before from jsonb_array_elements(coalesce(prior->g,'[]')) as items(v) where v->>'id'=k;
   select v into record_after from jsonb_array_elements(coalesce(new.payload#>array['data',g],'[]')) as items(v) where v->>'id'=k;
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
  if coalesce(prior->g,'[]')<>coalesce(new.payload#>array['data',g],'[]') and (select coalesce(jsonb_agg(v->>'id'),'[]') from jsonb_array_elements(coalesce(prior->g,'[]')) as r(v))<>(select coalesce(jsonb_agg(v->>'id'),'[]') from jsonb_array_elements(coalesce(new.payload#>array['data',g],'[]')) as r(v)) then
   insert into public.oc_collab_events(batch_id,owner_id,scope,group_name,item_id,item_name,item_revision,path,operation,before_value,after_value,before_exists,after_exists,actor_id,actor_name,actor_email) values(batch,new.user_id,new.scope,g,'__collection_order__','清單順序',new.revision,'[]','reorder',(select coalesce(jsonb_agg(v->>'id'),'[]') from jsonb_array_elements(coalesce(prior->g,'[]')) as r(v)),(select coalesce(jsonb_agg(v->>'id'),'[]') from jsonb_array_elements(coalesce(new.payload#>array['data',g],'[]')) as r(v)),true,true,auth.uid(),a->>'displayName',a->>'email');
  end if;
 end loop;return new;
end;$$;
-- Bootstrap existing items without claiming their historical author.
insert into public.oc_collab_items(owner_id,scope,group_name,item_id,item_revision,deleted,actor_name,changed_at)
 select h.user_id,h.scope,g.key,r.value->>'id',1,false,'升級前版本',h.updated_at from public.oc_sync_heads h cross join lateral jsonb_each(h.payload->'data') g cross join lateral jsonb_array_elements(g.value) r where jsonb_typeof(g.value)='array' and coalesce(r.value->>'id','')<>'' on conflict do nothing;
insert into public.oc_collab_spaces(owner_id) select distinct user_id from public.oc_sync_heads on conflict do nothing;
drop trigger if exists oc_collab_stamp_head on public.oc_sync_heads;
create trigger oc_collab_stamp_head before insert or update on public.oc_sync_heads for each row execute function public.oc_collab_stamp();
drop trigger if exists oc_collab_audit_head on public.oc_sync_heads;
create trigger oc_collab_audit_head after insert or update on public.oc_sync_heads for each row execute function public.oc_collab_audit();

create or replace function public.oc_collab_head(p_owner uuid,p_scope text) returns jsonb language plpgsql security definer set search_path='' as $$
declare h public.oc_sync_heads;items jsonb;tombs jsonb;
begin perform public.oc_collab_actor();if not public.oc_collab_allowed(p_owner) then raise exception 'READ_PERMISSION_REQUIRED';end if;if p_scope not in ('workshop','forum') then raise exception 'INVALID_SCOPE';end if;select * into h from public.oc_sync_heads where user_id=p_owner and scope=p_scope;select coalesce(jsonb_agg(jsonb_build_object('group',group_name,'id',item_id,'revision',item_revision,'deleted',deleted,'actorId',actor_id,'actorName',actor_name,'changedAt',changed_at)),'[]') into items from public.oc_collab_items where owner_id=p_owner and scope=p_scope;select coalesce(jsonb_agg(jsonb_build_object('group',group_name,'id',item_id,'path',path,'revision',deleted_revision,'actorId',actor_id,'deletedAt',deleted_at)),'[]') into tombs from public.oc_collab_tombstones where owner_id=p_owner and scope=p_scope;return jsonb_build_object('revision',coalesce(h.revision,0),'payload',h.payload,'updated_at',h.updated_at,'items',items,'tombstones',tombs);end;$$;
create or replace function public.oc_collab_log(p_owner uuid,p_scope text default null,p_before bigint default null,p_query text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin perform public.oc_collab_actor();if not public.oc_collab_allowed(p_owner) then raise exception 'READ_PERMISSION_REQUIRED';end if;select coalesce(jsonb_agg(to_jsonb(t) order by event_id desc),'[]') into r from(select event_id,batch_id,scope,group_name,item_id,item_name,item_revision,path,operation,case when octet_length(before_value::text)>12000 then to_jsonb(left(before_value::text,4000)||'…') else before_value end as before_value,case when octet_length(after_value::text)>12000 then to_jsonb(left(after_value::text,4000)||'…') else after_value end as after_value,coalesce(octet_length(before_value::text)>12000,false) as before_truncated,coalesce(octet_length(after_value::text)>12000,false) as after_truncated,before_exists,after_exists,actor_id,actor_name,actor_email,created_at from public.oc_collab_events where owner_id=p_owner and (p_scope is null or scope=p_scope) and (p_before is null or event_id<p_before) and (coalesce(p_query,'')='' or strpos(lower(item_name||' '||actor_name),lower(left(p_query,100)))>0) order by event_id desc limit 30) t;return r;end;$$;
create or replace function public.oc_collab_event(p_owner uuid,p_event bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin perform public.oc_collab_actor();if not public.oc_collab_allowed(p_owner) then raise exception 'READ_PERMISSION_REQUIRED';end if;select to_jsonb(e) into result from public.oc_collab_events e where e.owner_id=p_owner and event_id=p_event;return result;end;$$;
create or replace function public.oc_collab_history(p_owner uuid,p_scope text,p_revision bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;
begin perform public.oc_collab_actor();if not public.oc_collab_allowed(p_owner) then raise exception 'READ_PERMISSION_REQUIRED';end if;select coalesce(jsonb_agg(to_jsonb(t) order by revision desc),'[]') into r from(select scope,revision,archived_at,case when p_revision is not null then payload else null end as payload from public.oc_sync_history where user_id=p_owner and scope=p_scope and (p_revision is null or revision=p_revision) order by revision desc limit 20) t;return r;end;$$;

-- A batch checks every area and item before any write. Exceptions roll back all areas.
create or replace function public.oc_collab_push_batch(p_owner uuid,p_batch_id uuid,p_entries jsonb,p_restores jsonb default '[]') returns jsonb language plpgsql security definer set search_path='' as $$
declare a jsonb;entry jsonb;h public.oc_sync_heads;expected bigint;g text;k text;v bigint;record_value jsonb;old_value jsonb;rec record;receipts jsonb:='[]';scopes text[]:='{}';allowed text[];item_expected jsonb;cached public.oc_collab_batches;fingerprint text;
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
  for g in select key from jsonb_object_keys(coalesce(h.payload->'data','{}')||(entry->'payload'->'data')) as names(key) loop
   if not(g=any(allowed)) or jsonb_typeof(coalesce(entry->'payload'->'data'->g,'[]'))<>'array' then raise exception 'INVALID_GROUP';end if;
   if exists(select 1 from jsonb_array_elements(coalesce(entry->'payload'->'data'->g,'[]')) as x(r) where jsonb_typeof(r)<>'object' or coalesce(r->>'id','')='') or (select count(*)<>count(distinct r->>'id') from jsonb_array_elements(coalesce(entry->'payload'->'data'->g,'[]')) as x(r)) then raise exception 'INVALID_ITEM_ID';end if;
   for k in select distinct r->>'id' from jsonb_array_elements(coalesce(h.payload->'data'->g,'[]')||coalesce(entry->'payload'->'data'->g,'[]')) as x(r) loop
    select r into old_value from jsonb_array_elements(coalesce(h.payload->'data'->g,'[]')) as x(r) where r->>'id'=k;
    select r into record_value from jsonb_array_elements(coalesce(entry->'payload'->'data'->g,'[]')) as x(r) where r->>'id'=k;
    if record_value is not distinct from old_value then continue;end if;
    select item_revision into v from public.oc_collab_items where owner_id=p_owner and scope=entry->>'scope' and group_name=g and item_id=k;
    select r into item_expected from jsonb_array_elements(entry->'itemVersions') as x(r) where r->>'group'=g and r->>'id'=k;
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
create or replace function public.oc_collab_stage(p_owner uuid,p_batch_id uuid,p_index int,p_content text) returns void language plpgsql security definer set search_path='' as $$
begin perform public.oc_collab_actor();if not public.oc_collab_allowed(p_owner,true) then raise exception 'EDIT_PERMISSION_REQUIRED';end if;if p_batch_id is null or p_index not between 0 and 4095 or p_content is null or octet_length(p_content)>90000 then raise exception 'INVALID_CHUNK';end if;delete from public.oc_collab_chunks where actor_id=auth.uid() and created_at<now()-interval '1 day';insert into public.oc_collab_chunks(actor_id,owner_id,batch_id,chunk_index,content) values(auth.uid(),p_owner,p_batch_id,p_index,p_content) on conflict(actor_id,batch_id,chunk_index) do update set content=excluded.content,owner_id=excluded.owner_id,created_at=now();end;$$;
create or replace function public.oc_collab_commit_chunks(p_owner uuid,p_batch_id uuid,p_count int) returns jsonb language plpgsql security definer set search_path='' as $$
declare body jsonb;n int;first_index int;last_index int;result jsonb;
begin perform public.oc_collab_actor();if not public.oc_collab_allowed(p_owner,true) then raise exception 'EDIT_PERMISSION_REQUIRED';end if;select b.result into result from public.oc_collab_batches b where b.actor_id=auth.uid() and b.owner_id=p_owner and b.batch_id=p_batch_id;if result is not null then return result;end if;if p_count not between 1 and 4096 then raise exception 'INVALID_CHUNKS';end if;select count(*),min(chunk_index),max(chunk_index) into n,first_index,last_index from public.oc_collab_chunks where actor_id=auth.uid() and owner_id=p_owner and batch_id=p_batch_id;if n<>p_count or first_index<>0 or last_index<>p_count-1 then raise exception 'INCOMPLETE_CHUNKS';end if;select convert_from(decode(string_agg(content,'' order by chunk_index),'base64'),'UTF8')::jsonb into body from public.oc_collab_chunks where actor_id=auth.uid() and owner_id=p_owner and batch_id=p_batch_id;result:=public.oc_collab_push_batch(p_owner,p_batch_id,body->'entries',coalesce(body->'restores','[]'));delete from public.oc_collab_chunks where actor_id=auth.uid() and batch_id=p_batch_id;return result;end;$$;
-- Keep internal helpers inaccessible; only the checked RPC surface is callable.
revoke all on function public.oc_collab_actor(),public.oc_collab_allowed(uuid,boolean),public.oc_collab_at(jsonb,jsonb),public.oc_collab_diff(jsonb,jsonb,jsonb),public.oc_collab_stamp(),public.oc_collab_audit() from public,anon,authenticated;
revoke all on function public.oc_collab_status(),public.oc_collab_profile(text),public.oc_collab_invite(text,text),public.oc_collab_accept(uuid),public.oc_collab_members_list(uuid),public.oc_collab_revoke(uuid),public.oc_collab_head(uuid,text),public.oc_collab_log(uuid,text,bigint,text),public.oc_collab_event(uuid,bigint),public.oc_collab_history(uuid,text,bigint),public.oc_collab_push_batch(uuid,uuid,jsonb,jsonb),public.oc_collab_stage(uuid,uuid,integer,text),public.oc_collab_commit_chunks(uuid,uuid,integer) from public,anon;
grant execute on function public.oc_collab_status(),public.oc_collab_profile(text),public.oc_collab_invite(text,text),public.oc_collab_accept(uuid),public.oc_collab_members_list(uuid),public.oc_collab_revoke(uuid),public.oc_collab_head(uuid,text),public.oc_collab_log(uuid,text,bigint,text),public.oc_collab_event(uuid,bigint),public.oc_collab_history(uuid,text,bigint),public.oc_collab_push_batch(uuid,uuid,jsonb,jsonb),public.oc_collab_stage(uuid,uuid,integer,text),public.oc_collab_commit_chunks(uuid,uuid,integer) to authenticated;
-- Safe rollout: legacy own-account writes remain usable until the first v2 batch.
-- That batch atomically upgrades this space to minimum_protocol=2; old writes
-- then fail in the protected trigger. No global write outage during deployment.
notify pgrst,'reload schema';
commit;
