-- Keep direct SDK/RPC writes subject to the same domain constraints as HTTP.
create function public.validate_record_content() returns trigger language plpgsql set search_path=public as $$
declare c jsonb:=new.content; i jsonb; k text; required_count integer;
begin
 if tg_op='UPDATE' and new.kind<>old.kind then raise exception 'INVALID_KIND_CHANGE'; end if;
 if jsonb_typeof(c) is distinct from 'object' then raise exception 'INVALID_CONTENT'; end if;
 foreach k in array array['title','notes','timeZone','priority','recurrence'] loop
  if jsonb_typeof(c->k) is distinct from 'string' then raise exception 'INVALID_CONTENT'; end if;
 end loop;
 if length(trim(c->>'title')) not between 1 and 200 or length(c->>'notes')>8000
 or c->>'priority' not in ('low','normal','high','critical') or c->>'recurrence' not in ('none','daily','weekly','monthly','yearly') then raise exception 'INVALID_CONTENT'; end if;
 if jsonb_typeof(c->'nudgeMinutes') is distinct from 'number' or (c->>'nudgeMinutes')::numeric not between 0 and 10080
 or (c->>'nudgeMinutes')::numeric<>trunc((c->>'nudgeMinutes')::numeric) then raise exception 'INVALID_NUDGE'; end if;
 foreach k in array array['completed','archived'] loop
  if jsonb_typeof(c->k) is distinct from 'boolean' then raise exception 'INVALID_CONTENT'; end if;
 end loop;
 foreach k in array array['dueAt','dueDate','templateId'] loop
  if not(c ? k) or jsonb_typeof(c->k) not in ('string','null') then raise exception 'INVALID_CONTENT'; end if;
 end loop;
 if not exists(select 1 from pg_timezone_names where name=c->>'timeZone') then raise exception 'INVALID_TIMEZONE'; end if;
 if c->>'dueAt' is not null then
  if c->>'dueAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then raise exception 'INVALID_DATE'; end if;
  perform (c->>'dueAt')::timestamptz;
 end if;
 if c->>'dueDate' is not null then
  if c->>'dueDate' !~ '^\d{4}-\d{2}-\d{2}$' or to_char((c->>'dueDate')::date,'YYYY-MM-DD')<>c->>'dueDate' then raise exception 'INVALID_DATE'; end if;
 end if;
 if c->>'dueAt' is not null and c->>'dueDate' is not null then raise exception 'INVALID_DATE'; end if;
 if c->>'recurrence'<>'none' and c->>'dueAt' is null and c->>'dueDate' is null then raise exception 'INVALID_RECURRENCE'; end if;
 if c->>'templateId' is not null then perform (c->>'templateId')::uuid; end if;
 if jsonb_typeof(c->'items') is distinct from 'array' or jsonb_array_length(c->'items')>100 then raise exception 'INVALID_ITEMS'; end if;
 for i in select value from jsonb_array_elements(c->'items') loop
  if jsonb_typeof(i) is distinct from 'object' then raise exception 'INVALID_ITEM'; end if;
  foreach k in array array['id','title','instructions'] loop
   if jsonb_typeof(i->k) is distinct from 'string' then raise exception 'INVALID_ITEM'; end if;
  end loop;
  perform (i->>'id')::uuid;
  if length(trim(i->>'title')) not between 1 and 200 or length(i->>'instructions')>4000 then raise exception 'INVALID_ITEM'; end if;
  if jsonb_typeof(i->'required') is distinct from 'boolean' or jsonb_typeof(i->'completed') is distinct from 'boolean'
   or not(i ? 'assignee') or jsonb_typeof(i->'assignee') not in ('string','null') then raise exception 'INVALID_ITEM'; end if;
  if i->>'assignee' is not null then
   if new.space_id is null and (i->>'assignee')::uuid<>new.owner_id then raise exception 'INVALID_ASSIGNEE'; end if;
   -- Existing assignments survive member departure for historical accountability.
   if new.space_id is not null and not exists(select 1 from members where space_id=new.space_id and user_id=(i->>'assignee')::uuid)
    and (tg_op='INSERT' or not exists(select 1 from jsonb_array_elements(old.content->'items') v where v->>'id'=i->>'id' and v->>'assignee'=i->>'assignee')) then raise exception 'INVALID_ASSIGNEE'; end if;
  end if;
 end loop;
 if jsonb_array_length(c->'items')<>(select count(distinct value->>'id') from jsonb_array_elements(c->'items')) then raise exception 'DUPLICATE_ITEM'; end if;
 if new.kind='context' then c:=jsonb_set(c,'{completed}','false');
 elsif jsonb_array_length(c->'items')>0 then
  select count(*) into required_count from jsonb_array_elements(c->'items') where (value->>'required')::boolean;
  c:=jsonb_set(c,'{completed}',(select to_jsonb(bool_and((value->>'completed')::boolean)) from jsonb_array_elements(c->'items') where required_count=0 or (value->>'required')::boolean));
 end if;
 new.content:=c; return new;
end $$;
create trigger record_content_validate before insert or update on public.records for each row execute function public.validate_record_content();

create or replace function public.validate_profile() returns trigger language plpgsql set search_path=public as $$
declare p jsonb:=new.preferences; k text; n numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'timeZone') is distinct from 'string'
 or not exists(select 1 from pg_timezone_names where name=p->>'timeZone') then raise exception 'INVALID_TIMEZONE'; end if;
 if jsonb_typeof(p->'intensity') is distinct from 'string' or p->>'intensity' not in ('subtle','normal') then raise exception 'INVALID_PREFERENCES'; end if;
 foreach k in array array['snoozeMinutes','repeatMinutes','quietStart','quietEnd','defaultDateHour'] loop
  if not(p ? k) then raise exception 'INVALID_PREFERENCES'; end if;
  if k in ('quietStart','quietEnd','defaultDateHour') and p->k='null'::jsonb then continue; end if;
  if jsonb_typeof(p->k) is distinct from 'number' then raise exception 'INVALID_PREFERENCES'; end if;
  n:=(p->>k)::numeric;
  if n<>trunc(n) or n<(case when k='snoozeMinutes' then 1 else 0 end) or n>(case when k in ('snoozeMinutes','repeatMinutes') then 1440 else 23 end) then raise exception 'INVALID_PREFERENCES'; end if;
 end loop;
 if (p->>'quietStart' is null)<>(p->>'quietEnd' is null) then raise exception 'INVALID_QUIET_HOURS'; end if;
 return new;
end $$;

-- An accepted invitation cannot be reused to undo subsequent removal.
create or replace function public.accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare i invitations;
begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 select * into i from invitations where token=p_token for update;
 if not found or i.revoked then raise exception 'INVITATION_UNAVAILABLE'; end if;
 if i.accepted_by is not null then
  if i.accepted_by=auth.uid() and exists(select 1 from members where space_id=i.space_id and user_id=auth.uid()) then return i.space_id; end if;
  raise exception 'INVITATION_UNAVAILABLE';
 end if;
 if i.expires_at<=now() then raise exception 'INVITATION_UNAVAILABLE'; end if;
 insert into members values(i.space_id,auth.uid(),i.role) on conflict do nothing;
 update invitations set accepted_by=auth.uid() where id=i.id;
 return i.space_id;
end $$;

-- Revoke PUBLIC too: revoking anon alone leaves inherited EXECUTE privileges.
revoke execute on all functions in schema public from public,anon,authenticated;
alter default privileges in schema public revoke execute on functions from public;
grant execute on function public.space_role(uuid),public.can_read_record(public.records),public.can_edit_record(public.records),
 public.save_record(uuid,jsonb,integer),public.create_space(text),public.manage_member(uuid,uuid,text),public.delete_space(uuid),public.leave_space(uuid),
 public.invite(uuid,text),public.revoke_invite(uuid),public.inspect_invite(uuid),public.accept_invite(uuid),public.post_note(uuid,text),
 public.apply_proposal(uuid),public.prepare_account_deletion() to authenticated;
grant execute on function public.claim_deliveries(integer),public.consume_rate(uuid,text,integer),public.spawn_occurrence(uuid,integer,jsonb),public.due_recurrences() to service_role;
