-- Large collaborative saves need longer than Supabase's authenticated default (8s).
-- Apply after upgrade-collaboration-v2.sql and its performance migration.
-- Only the two atomic commit RPCs receive the exception; no role, grant, RLS,
-- conflict, audit, tombstone, or rollback policy is changed.
begin;
alter function public.oc_collab_push_batch(uuid,uuid,jsonb,jsonb)
  set statement_timeout = '55s';
alter function public.oc_collab_commit_chunks(uuid,uuid,integer)
  set statement_timeout = '55s';
notify pgrst, 'reload schema';
commit;
