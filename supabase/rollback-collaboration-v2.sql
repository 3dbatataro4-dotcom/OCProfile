-- Emergency interface rollback only. Leaves all saves and audit records intact.
-- Inspect before use: this disables v2 protection and shared-save RPC access.
begin;
drop trigger if exists oc_collab_stamp_head on public.oc_sync_heads;
drop trigger if exists oc_collab_audit_head on public.oc_sync_heads;
revoke all on function public.oc_collab_status(),public.oc_collab_profile(text),public.oc_collab_invite(text,text),public.oc_collab_accept(uuid),public.oc_collab_members_list(uuid),public.oc_collab_revoke(uuid),public.oc_collab_head(uuid,text),public.oc_collab_log(uuid,text,bigint,text),public.oc_collab_event(uuid,bigint),public.oc_collab_history(uuid,text,bigint),public.oc_collab_push_batch(uuid,uuid,jsonb,jsonb),public.oc_collab_stage(uuid,uuid,integer,text),public.oc_collab_commit_chunks(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.oc_push_snapshot(text,bigint,jsonb),public.oc_push_delta(text,bigint,jsonb),public.oc_stage_snapshot_chunk(text,uuid,integer,text),public.oc_commit_snapshot_chunks(text,bigint,uuid,integer) to authenticated;
notify pgrst,'reload schema';
commit;
