-- Reminder priority is not part of the current product. First replace the
-- validator, then remove the obsolete field from existing JSON content.

create or replace function public.validate_record_content() returns trigger language plpgsql set search_path=public as $$
declare c jsonb:=new.content; i jsonb; k text; required_count integer;
begin
 if tg_op='UPDATE' and new.kind<>old.kind then raise exception 'INVALID_KIND_CHANGE'; end if;
 if jsonb_typeof(c) is distinct from 'object' then raise exception 'INVALID_CONTENT'; end if;
 c:=c-'priority';
 foreach k in array array['title','notes','timeZone','recurrence'] loop
  if jsonb_typeof(c->k) is distinct from 'string' then raise exception 'INVALID_CONTENT'; end if;
 end loop;
 if length(trim(c->>'title')) not between 1 and 200 or length(c->>'notes')>8000
 or c->>'recurrence' not in ('none','daily','weekly','monthly','yearly') then raise exception 'INVALID_CONTENT'; end if;
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
   if new.space_id is not null and not exists(select 1 from space_members where space_id=new.space_id and user_id=(i->>'assignee')::uuid)
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

update public.contexts
set content = content - 'priority'
where content ? 'priority';

update public.reminders
set content = content - 'priority'
where content ? 'priority';
