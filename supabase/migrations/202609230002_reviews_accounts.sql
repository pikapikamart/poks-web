create table public.account_deletions(user_id uuid primary key references auth.users on delete cascade,created_at timestamptz not null default now(),attempts integer not null default 0,last_error text);
alter table account_deletions enable row level security;
grant all on account_deletions to service_role;
create function public.account_active() returns boolean language sql stable security definer set search_path=public as $$
 select auth.uid() is not null and not exists(select 1 from account_deletions where user_id=auth.uid()) $$;
grant execute on function public.account_active() to authenticated;
create function public.guard_account_write() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null then
  perform pg_advisory_xact_lock(hashtextextended('account:'||auth.uid()::text,0));
  if not account_active() then raise exception 'ACCOUNT_DELETING'; end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
do $$ declare t text; begin
 foreach t in array array['records','spaces','members','profiles','devices','invitations','activity'] loop
  execute format('create trigger account_write_guard before insert or update or delete on public.%I for each row execute function public.guard_account_write()',t);
 end loop;
end $$;

-- Validate operation metadata before the original idempotent writer runs.
alter function public.save_record(uuid,jsonb,integer) rename to save_record_internal;
revoke all on function public.save_record_internal(uuid,jsonb,integer) from public,anon,authenticated;
create function public.save_record(p_operation uuid,p_record jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare r records; tid uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('account:'||auth.uid()::text,0));
 if not account_active() then raise exception 'UNAUTHENTICATED_OR_DELETING'; end if;
 if p_operation is null or p_expected is null or p_expected<0 or jsonb_typeof(p_record) is distinct from 'object'
 or jsonb_typeof(p_record->'deleted') is distinct from 'boolean' then raise exception 'INVALID_OPERATION'; end if;
 select * into r from records where id=(p_record->>'id')::uuid;
 if found and r.kind is distinct from p_record->>'kind' then raise exception 'INVALID_KIND_CHANGE'; end if;
 tid:=(p_record->'content'->>'templateId')::uuid;
 if tid is not null and (r.id is null or r.content->>'templateId' is distinct from tid::text) then
  if not exists(select 1 from records t where t.id=tid and t.kind='context' and not t.deleted and can_read_record(t)) then raise exception 'INVALID_TEMPLATE'; end if;
 end if;
 return save_record_internal(p_operation,p_record,p_expected);
end $$;
grant execute on function public.save_record(uuid,jsonb,integer) to authenticated;

create table public.ai_reviews(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,sources jsonb not null,expires_at timestamptz not null default now()+interval '15 minutes');
alter table ai_reviews enable row level security;
grant all on ai_reviews to service_role;
alter table ai_proposals add column review_id uuid references ai_reviews;
alter table ai_proposals add column request_id uuid;
alter table ai_proposals add column request_body jsonb;
alter table ai_proposals add column result jsonb;
alter table ai_proposals add column dependencies jsonb not null default '{}';
create unique index proposals_request on ai_proposals(user_id,request_id);

create function public.check_review_sources(p_dependencies jsonb) returns void language plpgsql security definer set search_path=public as $$
declare source record; r records;
begin
 for source in select key,value from jsonb_each(p_dependencies) order by key loop
  select * into r from records where id=source.key::uuid for update;
  if not found or r.deleted or not can_read_record(r) then raise exception 'FORBIDDEN'; end if;
  if r.version<>(source.value)::integer then raise exception 'CONFLICT'; end if;
 end loop;
end $$;
create function public.prepare_proposal(p_review uuid,p_request uuid,p_body jsonb,p_actions jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare review ai_reviews; existing ai_proposals; a jsonb; rid text; deps jsonb:='{}'; result_id uuid;
begin
 if not account_active() then raise exception 'UNAUTHENTICATED_OR_DELETING'; end if;
 if p_request is null then raise exception 'INVALID_REQUEST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request::text,0));
 select * into existing from ai_proposals where user_id=auth.uid() and request_id=p_request;
 if found then
  if existing.request_body is distinct from p_body or existing.review_id is distinct from p_review then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return existing.id;
 end if;
 select * into review from ai_reviews where id=p_review and user_id=auth.uid();
 if not found or review.expires_at<=now() then raise exception 'PROPOSAL_EXPIRED'; end if;
 if jsonb_typeof(p_actions) is distinct from 'array' or jsonb_array_length(p_actions) not between 1 and 10 then raise exception 'INVALID_ACTIONS'; end if;
 for a in select value from jsonb_array_elements(p_actions) loop
  if (a->>'expectedVersion')::integer>0 then
   rid:=a->'record'->>'id';
   if not(review.sources ? rid) or (review.sources->rid->>'version')::integer<>(a->>'expectedVersion')::integer then raise exception 'CONFLICT'; end if;
   deps:=deps||jsonb_build_object(rid,(a->>'expectedVersion')::integer);
  elsif exists(select 1 from records where id=(a->'record'->>'id')::uuid) then raise exception 'CONFLICT'; end if;
  rid:=a->'record'->'content'->>'templateId';
  if rid is not null then
   if not(review.sources ? rid) then raise exception 'INVALID_TEMPLATE'; end if;
   deps:=deps||jsonb_build_object(rid,(review.sources->rid->>'version')::integer);
  end if;
 end loop;
 perform check_review_sources(deps);
 insert into ai_proposals(user_id,actions,review_id,request_id,request_body,dependencies) values(auth.uid(),p_actions,p_review,p_request,p_body,deps) returning id into result_id;
 return result_id;
end $$;
grant execute on function public.prepare_proposal(uuid,uuid,jsonb,jsonb) to authenticated;
create or replace function public.apply_proposal(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare p ai_proposals; a jsonb; results jsonb:='[]';
begin
 if not account_active() then raise exception 'UNAUTHENTICATED_OR_DELETING'; end if;
 select * into p from ai_proposals where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'PROPOSAL_EXPIRED'; end if;
 if p.applied then
  if p.result is not null then return p.result; end if;
  -- Compatibility for proposals committed before this migration.
  for a in select value from jsonb_array_elements(p.actions) loop
   results:=results||jsonb_build_array((select result from operations where user_id=auth.uid() and id=(a->>'operationId')::uuid));
  end loop; return results;
 end if;
 if p.expires_at<=now() then raise exception 'PROPOSAL_EXPIRED'; end if;
 perform check_review_sources(p.dependencies);
 for a in select value from jsonb_array_elements(p.actions) loop
  results:=results||jsonb_build_array(save_record((a->>'operationId')::uuid,a->'record',(a->>'expectedVersion')::integer));
 end loop;
 update ai_proposals set applied=true,result=results where id=p_id;
 return results;
end $$;

create or replace function public.prepare_account_deletion() returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('account:'||auth.uid()::text,0));
 if exists(select 1 from spaces where owner_id=auth.uid()) then raise exception 'TRANSFER_OWNERSHIP_FIRST'; end if;
 insert into account_deletions(user_id) values(auth.uid()) on conflict do nothing;
end $$;
create function public.cleanup_account(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('account:'||p_user::text,0));
 if not exists(select 1 from account_deletions where user_id=p_user) then raise exception 'DELETION_NOT_REQUESTED'; end if;
 if exists(select 1 from spaces where owner_id=p_user) then raise exception 'TRANSFER_OWNERSHIP_FIRST'; end if;
 update records r set owner_id=s.owner_id from spaces s where r.space_id=s.id and r.owner_id=p_user;
 delete from records where owner_id=p_user and space_id is null;
 delete from members where user_id=p_user;
 delete from devices where user_id=p_user;
 update deliveries set status='cancelled' where user_id=p_user and status in ('pending','sending');
 update account_deletions set attempts=attempts+1,last_error=null where user_id=p_user;
end $$;
grant execute on function public.cleanup_account(uuid) to service_role;
