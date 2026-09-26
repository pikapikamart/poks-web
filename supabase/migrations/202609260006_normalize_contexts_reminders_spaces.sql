-- Split the former polymorphic records table into domain tables and make
-- many-to-many relationships explicit. The records and members views remain
-- as a read contract while clients migrate to the new table names.

alter publication supabase_realtime drop table public.records, public.members;

alter table public.members rename to space_members;
alter table public.records rename to reminders;

alter index public.records_owner rename to reminders_owner;
alter index public.records_space rename to reminders_space;
alter index public.records_search rename to reminders_search;

alter table public.reminders rename constraint records_pkey to reminders_pkey;
alter table public.space_members rename constraint members_pkey to space_members_pkey;

create table public.contexts (
  id uuid primary key,
  owner_id uuid not null references auth.users,
  space_id uuid check (space_id is null),
  kind text not null default 'context' check (kind = 'context'),
  content jsonb not null,
  version integer not null default 1,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(content->>'title', '') || ' ' || coalesce(content->>'notes', ''))
  ) stored,
  recurrence_anchor text
);

insert into public.contexts (
  id,
  owner_id,
  space_id,
  kind,
  content,
  version,
  deleted,
  updated_at,
  recurrence_anchor
)
select
  id,
  owner_id,
  null,
  'context',
  content,
  version,
  deleted,
  updated_at,
  recurrence_anchor
from public.reminders
where kind = 'context';

create table public.context_reminders (
  context_id uuid not null references public.contexts on delete cascade,
  reminder_id uuid not null references public.reminders on delete cascade,
  created_at timestamptz not null default now(),
  primary key (context_id, reminder_id),
  unique (reminder_id)
);

insert into public.context_reminders (context_id, reminder_id)
select (content->>'templateId')::uuid, id
from public.reminders
where kind <> 'context'
  and content->>'templateId' is not null
  and exists (
    select 1
    from public.contexts
    where contexts.id = (reminders.content->>'templateId')::uuid
  );

create table public.space_reminders (
  space_id uuid not null references public.spaces on delete cascade,
  reminder_id uuid not null references public.reminders on delete cascade,
  created_at timestamptz not null default now(),
  primary key (space_id, reminder_id),
  unique (reminder_id)
);

insert into public.space_reminders (space_id, reminder_id)
select space_id, id
from public.reminders
where kind <> 'context' and space_id is not null;

delete from public.reminders where kind = 'context';

alter table public.reminders drop constraint records_kind_check;
alter table public.reminders add constraint reminders_kind_check check (kind in ('reminder', 'instance'));

create index contexts_owner on public.contexts (owner_id, updated_at);
create index contexts_search on public.contexts using gin (search_vector);
create index context_reminders_reminder on public.context_reminders (reminder_id);
create index space_reminders_reminder on public.space_reminders (reminder_id);
create index space_members_user on public.space_members (user_id, space_id);

alter table public.contexts enable row level security;
alter table public.context_reminders enable row level security;
alter table public.space_reminders enable row level security;

create view public.members with (security_invoker = true) as
select space_id, user_id, role
from public.space_members;

create view public.records with (security_invoker = true) as
select
  id,
  owner_id,
  space_id,
  kind,
  content,
  version,
  deleted,
  updated_at,
  search_vector,
  recurrence_anchor
from public.reminders
union all
select
  id,
  owner_id,
  null::uuid as space_id,
  'context'::text as kind,
  content,
  version,
  deleted,
  updated_at,
  search_vector,
  recurrence_anchor
from public.contexts;

create or replace function public.space_role(s uuid) returns text language sql stable security definer set search_path=public as $$
  select role from space_members where space_id=s and user_id=auth.uid()
$$;

create function public.can_read_reminder(r public.reminders) returns boolean language sql stable security definer set search_path=public as $$
  select case
    when r.space_id is null then r.owner_id=auth.uid()
    else space_role(r.space_id) is not null
  end
$$;

create function public.can_edit_reminder(r public.reminders) returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(case
    when r.space_id is null then r.owner_id=auth.uid()
    else space_role(r.space_id) in ('owner','editor')
  end,false)
$$;

create function public.can_read_context(c public.contexts) returns boolean language sql stable security definer set search_path=public as $$
  select c.owner_id=auth.uid()
$$;

create function public.can_edit_context(c public.contexts) returns boolean language sql stable security definer set search_path=public as $$
  select c.owner_id=auth.uid()
$$;

create or replace function public.can_read_record(r public.records) returns boolean language sql stable security definer set search_path=public as $$
  select case
    when r.kind='context' then r.owner_id=auth.uid()
    when r.space_id is null then r.owner_id=auth.uid()
    else space_role(r.space_id) is not null
  end
$$;

create or replace function public.can_edit_record(r public.records) returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(case
    when r.kind='context' then r.owner_id=auth.uid()
    when r.space_id is null then r.owner_id=auth.uid()
    else space_role(r.space_id) in ('owner','editor')
  end,false)
$$;

drop policy if exists member_read on public.space_members;
drop policy if exists record_read on public.reminders;

create policy space_member_read on public.space_members
for select to authenticated using (space_role(space_id) is not null);

create policy reminder_read on public.reminders
for select to authenticated using (can_read_reminder(reminders));

create policy context_read on public.contexts
for select to authenticated using (can_read_context(contexts));

create policy context_reminder_read on public.context_reminders
for select to authenticated using (
  exists (select 1 from contexts where id=context_id and can_read_context(contexts))
  or exists (select 1 from reminders where id=reminder_id and can_read_reminder(reminders))
);

create policy space_reminder_read on public.space_reminders
for select to authenticated using (space_role(space_id) is not null);

grant select on public.records, public.members, public.contexts, public.reminders,
  public.context_reminders, public.space_reminders, public.space_members to authenticated;
grant all on public.contexts, public.reminders, public.context_reminders,
  public.space_reminders, public.space_members to service_role;

drop trigger if exists record_content_validate on public.reminders;
create trigger reminder_content_validate before insert or update on public.reminders
for each row execute function public.validate_record_content();
create trigger context_content_validate before insert or update on public.contexts
for each row execute function public.validate_record_content();

drop trigger if exists record_history on public.reminders;
create trigger reminder_history after insert or update on public.reminders
for each row execute function public.record_history();

drop trigger if exists recurrence_anchor on public.reminders;
create trigger reminder_recurrence_anchor before insert or update on public.reminders
for each row execute function public.recurrence_anchor_update();

drop trigger if exists completed_records_read_only on public.reminders;
create trigger completed_reminders_read_only before update on public.reminders
for each row execute function public.prevent_completed_record_edits();

drop trigger if exists account_write_guard on public.reminders;
drop trigger if exists account_write_guard on public.space_members;
create trigger account_write_guard before insert or update or delete on public.reminders
for each row execute function public.guard_account_write();
create trigger account_write_guard before insert or update or delete on public.contexts
for each row execute function public.guard_account_write();
create trigger account_write_guard before insert or update or delete on public.space_members
for each row execute function public.guard_account_write();

drop trigger if exists member_schedule on public.space_members;
create trigger space_member_schedule after insert or update or delete on public.space_members
for each row execute function public.members_reschedule();

drop trigger if exists membership_history on public.space_members;
create trigger space_membership_history after insert or update or delete on public.space_members
for each row execute function public.membership_history();

create or replace function public.save_record_internal(p_operation uuid,p_record jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  existing records;
  result records;
  saved jsonb;
  rid uuid;
  sid uuid;
  tid uuid;
  record_kind text;
  record_content jsonb;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_operation::text,0));
  select operations.result into saved from operations where user_id=auth.uid() and id=p_operation;
  if found then return saved; end if;

  rid := (p_record->>'id')::uuid;
  sid := (p_record->>'space_id')::uuid;
  tid := (p_record->'content'->>'templateId')::uuid;
  record_kind := p_record->>'kind';
  record_content := p_record->'content';
  perform pg_advisory_xact_lock(hashtextextended(rid::text,0));

  select * into existing from records where id=rid;
  if found and not can_edit_record(existing) then raise exception 'FORBIDDEN'; end if;
  if found and existing.version<>p_expected then raise exception 'CONFLICT'; end if;
  if not found and p_expected<>0 then raise exception 'CONFLICT'; end if;

  if record_kind='context' then
    if sid is not null then raise exception 'CONTEXT_CANNOT_BE_SHARED'; end if;
    if found and existing.kind<>'context' then raise exception 'INVALID_KIND_CHANGE'; end if;
    if found then
      update contexts set
        content=record_content,
        deleted=coalesce((p_record->>'deleted')::boolean,false),
        version=version+1,
        updated_at=now()
      where id=rid;
    else
      insert into contexts(id,owner_id,content)
      values(rid,auth.uid(),record_content);
    end if;
  else
    if record_kind not in ('reminder','instance') then raise exception 'INVALID_KIND'; end if;
    if found and existing.kind='context' then raise exception 'INVALID_KIND_CHANGE'; end if;
    if sid is not null and coalesce(space_role(sid),'') not in ('owner','editor') then raise exception 'FORBIDDEN'; end if;
    if found and existing.space_id is not null and sid is null then raise exception 'CANNOT_UNSHARE'; end if;
    if found then
      update reminders set
        content=record_content,
        space_id=sid,
        deleted=coalesce((p_record->>'deleted')::boolean,false),
        version=version+1,
        updated_at=now()
      where id=rid;
    else
      insert into reminders(id,owner_id,space_id,kind,content)
      values(rid,auth.uid(),sid,record_kind,record_content);
    end if;

    delete from context_reminders where reminder_id=rid;
    if tid is not null then
      insert into context_reminders(context_id,reminder_id) values(tid,rid);
    end if;
    delete from space_reminders where reminder_id=rid;
    if sid is not null then
      insert into space_reminders(space_id,reminder_id) values(sid,rid);
    end if;

    select * into result from records where id=rid;
    insert into activity(record_id,space_id,actor_id,body)
    values(rid,sid,auth.uid(),(case when result.deleted then 'Deleted ' when result.version=1 then 'Created ' when (record_content->>'completed')::boolean then 'Completed or updated ' else 'Updated ' end)||(record_content->>'title'));
    insert into outbox(record_id,revision) values(rid,result.version);
  end if;

  select * into result from records where id=rid;
  saved:=to_jsonb(result);
  insert into operations values(auth.uid(),p_operation,saved);
  return saved;
end $$;

create or replace function public.save_record(p_operation uuid,p_record jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare existing records; tid uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('account:'||auth.uid()::text,0));
  if not account_active() then raise exception 'UNAUTHENTICATED_OR_DELETING'; end if;
  if p_operation is null or p_expected is null or p_expected<0 or jsonb_typeof(p_record) is distinct from 'object'
    or jsonb_typeof(p_record->'deleted') is distinct from 'boolean' then raise exception 'INVALID_OPERATION'; end if;
  select * into existing from records where id=(p_record->>'id')::uuid;
  if found and existing.kind is distinct from p_record->>'kind' then raise exception 'INVALID_KIND_CHANGE'; end if;
  tid:=(p_record->'content'->>'templateId')::uuid;
  if tid is not null and (existing.id is null or existing.content->>'templateId' is distinct from tid::text) then
    if not exists(select 1 from contexts where id=tid and not deleted and can_read_context(contexts)) then raise exception 'INVALID_TEMPLATE'; end if;
  end if;
  return save_record_internal(p_operation,p_record,p_expected);
end $$;

create or replace function public.check_review_sources(p_dependencies jsonb) returns void language plpgsql security definer set search_path=public as $$
declare source record; source_record records;
begin
  for source in select key,value from jsonb_each(p_dependencies) order by key loop
    select * into source_record from records where id=source.key::uuid;
    if not found or source_record.deleted or not can_read_record(source_record) then raise exception 'FORBIDDEN'; end if;
    if source_record.version<>(source.value)::integer then raise exception 'CONFLICT'; end if;
  end loop;
end $$;

create or replace function public.spawn_occurrence(p_parent uuid,p_revision integer,p_content jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare parent reminders; new_id uuid; linked_context uuid; linked_space uuid;
begin
  select * into parent from reminders where id=p_parent for update;
  if not found or parent.version<>p_revision or parent.deleted or (parent.content->>'archived')::boolean
    or exists(select 1 from account_deletions where user_id=parent.owner_id) then return null; end if;
  select next_id into new_id from recurrences where parent_id=p_parent;
  if found then return new_id; end if;
  new_id:=gen_random_uuid();
  insert into reminders(id,owner_id,space_id,kind,content,recurrence_anchor)
  values(new_id,parent.owner_id,parent.space_id,parent.kind,p_content,parent.recurrence_anchor);
  select context_id into linked_context from context_reminders where reminder_id=p_parent;
  if linked_context is not null then insert into context_reminders values(linked_context,new_id,now()); end if;
  select space_id into linked_space from space_reminders where reminder_id=p_parent;
  if linked_space is not null then insert into space_reminders values(linked_space,new_id,now()); end if;
  insert into recurrences values(p_parent,new_id);
  insert into outbox(record_id,revision) values(new_id,1);
  return new_id;
end $$;

create or replace function public.due_recurrences() returns setof reminders language sql security definer set search_path=public as $$
  select reminder.* from reminders as reminder
  where not reminder.deleted
    and reminder.content->>'recurrence'<>'none'
    and reminder.content->>'archived'='false'
    and not exists(select 1 from recurrences where parent_id=reminder.id)
    and coalesce((reminder.content->>'dueAt')::timestamptz,((reminder.content->>'dueDate')::date)::timestamp at time zone (reminder.content->>'timeZone'))<=now()
  order by reminder.updated_at limit 100
$$;

create or replace function public.cleanup_account(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('account:'||p_user::text,0));
  if not exists(select 1 from account_deletions where user_id=p_user) then raise exception 'DELETION_NOT_REQUESTED'; end if;
  delete from spaces where owner_id=p_user;
  update reminders set owner_id=spaces.owner_id from spaces where reminders.space_id=spaces.id and reminders.owner_id=p_user;
  delete from reminders where owner_id=p_user and space_id is null;
  delete from contexts where owner_id=p_user;
  delete from space_members where user_id=p_user;
  delete from devices where user_id=p_user;
  update deliveries set status='cancelled',claim_token=null where user_id=p_user and status in ('pending','sending');
  update account_deletions set attempts=attempts+1,last_error=null where user_id=p_user;
end $$;

alter publication supabase_realtime add table public.reminders, public.contexts,
  public.context_reminders, public.space_reminders, public.space_members;

revoke execute on function public.can_read_reminder(public.reminders),
  public.can_edit_reminder(public.reminders), public.can_read_context(public.contexts),
  public.can_edit_context(public.contexts) from public, anon;
grant execute on function public.can_read_reminder(public.reminders),
  public.can_edit_reminder(public.reminders), public.can_read_context(public.contexts),
  public.can_edit_context(public.contexts) to authenticated;
grant execute on function public.due_recurrences() to service_role;
