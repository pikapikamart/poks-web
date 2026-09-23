create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null default '' check(length(display_name)<=100),
 preferences jsonb not null default '{"timeZone":"UTC","quietStart":null,"quietEnd":null,"intensity":"normal","snoozeMinutes":10,"repeatMinutes":0,"defaultDateHour":null}'
);
create table public.spaces (id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users, name text not null check(length(trim(name)) between 1 and 100), created_at timestamptz not null default now());
create table public.members (space_id uuid references public.spaces on delete cascade, user_id uuid references auth.users on delete cascade, role text not null check(role in ('owner','editor','viewer')), primary key(space_id,user_id));
create table public.records (
 id uuid primary key, owner_id uuid not null references auth.users, space_id uuid references public.spaces on delete cascade,
 kind text not null check(kind in ('reminder','context','instance')), content jsonb not null,
 version integer not null default 1, deleted boolean not null default false, updated_at timestamptz not null default now()
);
create index records_owner on public.records(owner_id,updated_at);
create index records_space on public.records(space_id,updated_at);
create table public.activity (id uuid primary key default gen_random_uuid(), record_id uuid references public.records on delete cascade, space_id uuid references public.spaces on delete cascade, actor_id uuid references auth.users on delete set null, body text not null check(length(body)<=2000), created_at timestamptz not null default now());
create table public.invitations (id uuid primary key default gen_random_uuid(), space_id uuid not null references public.spaces on delete cascade, token uuid unique not null default gen_random_uuid(), role text not null check(role in ('editor','viewer')), expires_at timestamptz not null default now()+interval '7 days', revoked boolean not null default false, accepted_by uuid references auth.users on delete set null);
create table public.operations (user_id uuid references auth.users on delete cascade, id uuid, result jsonb not null, primary key(user_id,id));
create table public.outbox (id bigint generated always as identity primary key, record_id uuid not null references public.records on delete cascade, revision integer not null, processed boolean not null default false, created_at timestamptz not null default now(), unique(record_id,revision));
create table public.devices (token text primary key, user_id uuid not null references auth.users on delete cascade, updated_at timestamptz not null default now());
create table public.inbox (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, record_id uuid references public.records on delete cascade, body text not null, read boolean not null default false, created_at timestamptz not null default now(), event_key text unique);
create table public.deliveries (id uuid primary key default gen_random_uuid(), record_id uuid not null references public.records on delete cascade, revision integer not null, user_id uuid not null references auth.users on delete cascade, kind text not null, due_at timestamptz not null, status text not null default 'pending', attempts integer not null default 0, lease_until timestamptz, receipt_ids jsonb not null default '[]', last_error text, unique(record_id,revision,user_id,kind));
create index deliveries_due on public.deliveries(status,due_at);
create table public.ai_proposals (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, actions jsonb not null, expires_at timestamptz not null default now()+interval '15 minutes', applied boolean not null default false);
create table public.rate_limits (user_id uuid references auth.users on delete cascade, bucket text, window_start timestamptz, count integer not null, primary key(user_id,bucket,window_start));

create function public.space_role(s uuid) returns text language sql stable security definer set search_path=public as $$ select role from members where space_id=s and user_id=auth.uid() $$;
create function public.can_read_record(r public.records) returns boolean language sql stable security definer set search_path=public as $$ select case when r.space_id is null then r.owner_id=auth.uid() else space_role(r.space_id) is not null end $$;
create function public.can_edit_record(r public.records) returns boolean language sql stable security definer set search_path=public as $$ select coalesce(case when r.space_id is null then r.owner_id=auth.uid() else space_role(r.space_id) in ('owner','editor') end,false) $$;

alter table profiles enable row level security;
alter table spaces enable row level security;
alter table members enable row level security;
alter table records enable row level security;
alter table activity enable row level security;
alter table invitations enable row level security;
alter table operations enable row level security;
alter table outbox enable row level security;
alter table devices enable row level security;
alter table inbox enable row level security;
alter table deliveries enable row level security;
alter table ai_proposals enable row level security;
alter table rate_limits enable row level security;
create policy profile_read on profiles for select to authenticated using(id=auth.uid() or exists(select 1 from members m join members me on m.space_id=me.space_id where m.user_id=profiles.id and me.user_id=auth.uid()));
create policy profile_insert on profiles for insert to authenticated with check(id=auth.uid());
create policy profile_update on profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy space_read on spaces for select to authenticated using(space_role(id) is not null);
create policy member_read on members for select to authenticated using(space_role(space_id) is not null);
create policy record_read on records for select to authenticated using(can_read_record(records));
create policy activity_read on activity for select to authenticated using((record_id is not null and exists(select 1 from records r where r.id=record_id and can_read_record(r))) or space_role(space_id) is not null);
create policy invitation_read on invitations for select to authenticated using(space_role(space_id)='owner');
create policy device_own on devices for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy inbox_read on inbox for select to authenticated using(user_id=auth.uid());
create policy inbox_update on inbox for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select on profiles,spaces,members,records,activity,invitations,inbox to authenticated;
grant insert,update on profiles to authenticated;
grant select,insert,update,delete on devices to authenticated;
grant update(read) on inbox to authenticated;

create function public.save_record(p_operation uuid,p_record jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare old records; result records; c jsonb; item jsonb; saved jsonb; rid uuid; sid uuid; required_count int; done boolean;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
 select o.result into saved from operations o where user_id=auth.uid() and id=p_operation;
 if found then return saved; end if;
 rid := (p_record->>'id')::uuid; sid := (p_record->>'space_id')::uuid; c := p_record->'content';
 if c is null or jsonb_typeof(c)<>'object' or length(trim(coalesce(c->>'title',''))) not between 1 and 200 or length(coalesce(c->>'notes',''))>8000 then raise exception 'INVALID_CONTENT'; end if;
 if not (c ?& array['title','notes','items','dueAt','dueDate','timeZone','priority','recurrence','nudgeMinutes','completed','archived','templateId']) then raise exception 'INVALID_CONTENT'; end if;
 if c->>'priority' not in ('low','normal','high','critical') or c->>'recurrence' not in ('none','daily','weekly','monthly','yearly') then raise exception 'INVALID_CONTENT'; end if;
 if jsonb_typeof(c->'items')<>'array' or jsonb_array_length(c->'items')>100 then raise exception 'INVALID_ITEMS'; end if;
 if jsonb_typeof(c->'completed')<>'boolean' or jsonb_typeof(c->'archived')<>'boolean' or (c->>'nudgeMinutes')::int not between 0 and 10080 then raise exception 'INVALID_CONTENT'; end if;
 if not exists(select 1 from pg_timezone_names where name=c->>'timeZone') then raise exception 'INVALID_TIMEZONE'; end if;
 if c->>'dueAt' is not null then perform (c->>'dueAt')::timestamptz; end if;
 if c->>'dueDate' is not null then perform (c->>'dueDate')::date; end if;
 if c->>'dueAt' is not null and c->>'dueDate' is not null then raise exception 'INVALID_DATE'; end if;
 if c->>'recurrence'<>'none' and c->>'dueAt' is null and c->>'dueDate' is null then raise exception 'INVALID_RECURRENCE'; end if;
 if p_record->>'kind' not in ('reminder','context','instance') then raise exception 'INVALID_KIND'; end if;
 for item in select value from jsonb_array_elements(c->'items') loop
  perform (item->>'id')::uuid;
  if length(trim(coalesce(item->>'title',''))) not between 1 and 200 or length(coalesce(item->>'instructions',''))>4000 or jsonb_typeof(item->'required')<>'boolean' or jsonb_typeof(item->'completed')<>'boolean' then raise exception 'INVALID_ITEM'; end if;
  if item->>'assignee' is not null then
   if sid is null and (item->>'assignee')::uuid<>auth.uid() then raise exception 'INVALID_ASSIGNEE'; end if;
   if sid is not null and not exists(select 1 from members where space_id=sid and user_id=(item->>'assignee')::uuid) then raise exception 'INVALID_ASSIGNEE'; end if;
  end if;
 end loop;
 if (select count(*) from jsonb_array_elements(c->'items'))<>(select count(distinct value->>'id') from jsonb_array_elements(c->'items')) then raise exception 'DUPLICATE_ITEM'; end if;
 if jsonb_array_length(c->'items')>0 and p_record->>'kind'<>'context' then
  select count(*) into required_count from jsonb_array_elements(c->'items') where (value->>'required')::boolean;
  select bool_and((value->>'completed')::boolean) into done from jsonb_array_elements(c->'items') where required_count=0 or (value->>'required')::boolean;
  c:=jsonb_set(c,'{completed}',to_jsonb(done));
 end if;
 perform pg_advisory_xact_lock(hashtextextended(rid::text,0));
 select * into old from records where id=rid for update;
 if found then
  if not can_edit_record(old) then raise exception 'FORBIDDEN'; end if;
  if old.version<>p_expected then raise exception 'CONFLICT'; end if;
  if old.space_id is distinct from sid and (old.owner_id<>auth.uid() or (sid is not null and coalesce(space_role(sid),'')<>'owner')) then raise exception 'FORBIDDEN'; end if;
  if old.space_id is not null and sid is null then raise exception 'CANNOT_UNSHARE'; end if;
  update records set content=c,space_id=sid,deleted=coalesce((p_record->>'deleted')::boolean,false),version=version+1,updated_at=now() where id=rid returning * into result;
 else
  if p_expected<>0 then raise exception 'CONFLICT'; end if;
  if sid is not null and coalesce(space_role(sid),'') not in ('owner','editor') then raise exception 'FORBIDDEN'; end if;
  insert into records(id,owner_id,space_id,kind,content) values(rid,auth.uid(),sid,p_record->>'kind',c) returning * into result;
 end if;
 insert into activity(record_id,space_id,actor_id,body) values(rid,sid,auth.uid(),(case when result.deleted then 'Deleted ' when result.version=1 then 'Created ' when (c->>'completed')::boolean then 'Completed or updated ' else 'Updated ' end)||(c->>'title'));
 insert into outbox(record_id,revision) values(rid,result.version);
 saved:=to_jsonb(result); insert into operations values(auth.uid(),p_operation,saved); return saved;
end $$;

create function public.create_space(p_name text) returns spaces language plpgsql security definer set search_path=public as $$ declare s spaces; begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 insert into spaces(owner_id,name) values(auth.uid(),trim(p_name)) returning * into s;
 insert into members values(s.id,auth.uid(),'owner'); return s; end $$;
create function public.manage_member(p_space uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path=public as $$ begin
 perform 1 from spaces where id=p_space for update;
 if space_role(p_space)<>'owner' or space_role(p_space) is null then raise exception 'FORBIDDEN'; end if;
 if p_user=auth.uid() then raise exception 'TRANSFER_OWNERSHIP_FIRST'; end if;
 if p_role='owner' then
  if not exists(select 1 from members where space_id=p_space and user_id=p_user) then raise exception 'NOT_MEMBER'; end if;
  update spaces set owner_id=p_user where id=p_space;
  update members set role='editor' where space_id=p_space and user_id=auth.uid();
  update members set role='owner' where space_id=p_space and user_id=p_user;
 elsif p_role is null then delete from members where space_id=p_space and user_id=p_user;
 elsif p_role in ('editor','viewer') then update members set role=p_role where space_id=p_space and user_id=p_user;
 else raise exception 'INVALID_ROLE'; end if;
end $$;
create function public.delete_space(p_space uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if coalesce(space_role(p_space),'')<>'owner' then raise exception 'FORBIDDEN'; end if;
 delete from spaces where id=p_space; end $$;
create function public.leave_space(p_space uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 if space_role(p_space)='owner' then raise exception 'TRANSFER_OWNERSHIP_FIRST'; end if;
 delete from members where space_id=p_space and user_id=auth.uid(); end $$;
create function public.invite(p_space uuid,p_role text) returns invitations language plpgsql security definer set search_path=public as $$ declare i invitations; begin
 if coalesce(space_role(p_space),'')<>'owner' then raise exception 'FORBIDDEN'; end if;
 insert into invitations(space_id,role) values(p_space,p_role) returning * into i; return i; end $$;
create function public.revoke_invite(p_id uuid) returns void language plpgsql security definer set search_path=public as $$ begin
 update invitations set revoked=true where id=p_id and space_role(space_id)='owner'; if not found then raise exception 'FORBIDDEN'; end if; end $$;
create function public.inspect_invite(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare i invitations; begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select * into i from invitations where token=p_token and not revoked and expires_at>now() and accepted_by is null;
 if not found then raise exception 'INVITATION_UNAVAILABLE'; end if;
 return jsonb_build_object('name',(select name from spaces where id=i.space_id),'role',i.role,'space_id',i.space_id); end $$;
create function public.accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path=public as $$ declare i invitations; begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select * into i from invitations where token=p_token for update;
 if not found or i.revoked or i.expires_at<=now() or (i.accepted_by is not null and i.accepted_by<>auth.uid()) then raise exception 'INVITATION_UNAVAILABLE'; end if;
 insert into members values(i.space_id,auth.uid(),i.role) on conflict do nothing;
 update invitations set accepted_by=auth.uid() where id=i.id; return i.space_id; end $$;
create function public.post_note(p_record uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$ declare r records; begin
 select * into r from records where id=p_record;
 if not found or not can_edit_record(r) then raise exception 'FORBIDDEN'; end if;
 if length(trim(p_body)) not between 1 and 2000 then raise exception 'INVALID_NOTE'; end if;
 insert into activity(record_id,space_id,actor_id,body) values(r.id,r.space_id,auth.uid(),trim(p_body)); end $$;

create function public.apply_proposal(p_id uuid) returns jsonb language plpgsql security definer set search_path=public as $$ declare p ai_proposals; a jsonb; results jsonb:='[]'; begin
 select * into p from ai_proposals where id=p_id and user_id=auth.uid() for update;
 if not found or p.expires_at<now() then raise exception 'PROPOSAL_EXPIRED'; end if;
 if p.applied then return p.actions; end if;
 for a in select value from jsonb_array_elements(p.actions) loop
  results:=results||jsonb_build_array(save_record((a->>'operationId')::uuid,a->'record',(a->>'expectedVersion')::int));
 end loop;
 update ai_proposals set applied=true where id=p_id; return results; end $$;
create function public.claim_deliveries(p_limit int default 50) returns setof deliveries language sql security definer set search_path=public as $$
 update deliveries set status='sending',lease_until=now()+interval '5 minutes',attempts=attempts+1 where id in
 (select id from deliveries where due_at<=now() and (status='pending' or (status='sending' and lease_until<now())) and attempts<5 order by due_at for update skip locked limit least(p_limit,100)) returning * $$;
create function public.consume_rate(p_user uuid,p_bucket text,p_max int) returns boolean language plpgsql security definer set search_path=public as $$ declare n int; begin
 insert into rate_limits values(p_user,p_bucket,date_trunc('hour',now()),1) on conflict(user_id,bucket,window_start) do update set count=rate_limits.count+1 returning count into n;
 return n<=p_max; end $$;
revoke all on function public.claim_deliveries(int),public.consume_rate(uuid,text,int) from public;
grant execute on function public.claim_deliveries(int),public.consume_rate(uuid,text,int) to service_role;
revoke execute on all functions in schema public from anon;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
-- Supabase Realtime subscriptions respect the SELECT policies above.
alter publication supabase_realtime add table records,members,activity,inbox;
