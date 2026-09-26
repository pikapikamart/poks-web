-- Remove the final polymorphic read model. Every workflow now addresses the
-- normalized contexts and reminders tables explicitly.

drop policy if exists activity_read on public.activity;
create policy activity_read on public.activity for select to authenticated using (
  (
    record_id is not null
    and exists (
      select 1 from reminders
      where reminders.id=activity.record_id
        and can_read_reminder(reminders)
    )
  )
  or space_role(space_id) is not null
);

create or replace function public.save_record_internal(p_operation uuid,p_record jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  existing jsonb;
  result jsonb;
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

  select to_jsonb(source) into existing
  from (
    select id,owner_id,space_id,kind,content,version,deleted,updated_at from reminders where id=rid
    union all
    select id,owner_id,null::uuid,kind,content,version,deleted,updated_at from contexts where id=rid
  ) as source;

  if existing is not null and (
    case
      when existing->>'kind'='context' then existing->>'owner_id'=auth.uid()::text
      when existing->>'space_id' is null then existing->>'owner_id'=auth.uid()::text
      else space_role((existing->>'space_id')::uuid) in ('owner','editor')
    end
  ) is not true then raise exception 'FORBIDDEN'; end if;
  if existing is not null and (existing->>'version')::integer<>p_expected then raise exception 'CONFLICT'; end if;
  if existing is null and p_expected<>0 then raise exception 'CONFLICT'; end if;

  if record_kind='context' then
    if sid is not null then raise exception 'CONTEXT_CANNOT_BE_SHARED'; end if;
    if existing is not null and existing->>'kind'<>'context' then raise exception 'INVALID_KIND_CHANGE'; end if;
    if existing is not null then
      update contexts set content=record_content,deleted=coalesce((p_record->>'deleted')::boolean,false),version=version+1,updated_at=now() where id=rid;
    else
      insert into contexts(id,owner_id,content) values(rid,auth.uid(),record_content);
    end if;
    select to_jsonb(contexts) into result from contexts where id=rid;
  else
    if record_kind not in ('reminder','instance') then raise exception 'INVALID_KIND'; end if;
    if existing is not null and existing->>'kind'='context' then raise exception 'INVALID_KIND_CHANGE'; end if;
    if sid is not null and coalesce(space_role(sid),'') not in ('owner','editor') then raise exception 'FORBIDDEN'; end if;
    if existing is not null and existing->>'space_id' is not null and sid is null then raise exception 'CANNOT_UNSHARE'; end if;
    if existing is not null then
      update reminders set content=record_content,space_id=sid,deleted=coalesce((p_record->>'deleted')::boolean,false),version=version+1,updated_at=now() where id=rid;
    else
      insert into reminders(id,owner_id,space_id,kind,content) values(rid,auth.uid(),sid,record_kind,record_content);
    end if;

    delete from context_reminders where reminder_id=rid;
    if tid is not null then insert into context_reminders(context_id,reminder_id) values(tid,rid); end if;
    delete from space_reminders where reminder_id=rid;
    if sid is not null then insert into space_reminders(space_id,reminder_id) values(sid,rid); end if;

    select to_jsonb(reminders) into result from reminders where id=rid;
    insert into activity(record_id,space_id,actor_id,body)
    values(rid,sid,auth.uid(),(case when (result->>'deleted')::boolean then 'Deleted ' when (result->>'version')::integer=1 then 'Created ' when (record_content->>'completed')::boolean then 'Completed or updated ' else 'Updated ' end)||(record_content->>'title'));
    insert into outbox(record_id,revision) values(rid,(result->>'version')::integer);
  end if;

  saved:=result;
  insert into operations values(auth.uid(),p_operation,saved);
  return saved;
end $$;

create or replace function public.save_record(p_operation uuid,p_record jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
declare existing_kind text; existing_template uuid; tid uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('account:'||auth.uid()::text,0));
  if not account_active() then raise exception 'UNAUTHENTICATED_OR_DELETING'; end if;
  if p_operation is null or p_expected is null or p_expected<0 or jsonb_typeof(p_record) is distinct from 'object'
    or jsonb_typeof(p_record->'deleted') is distinct from 'boolean' then raise exception 'INVALID_OPERATION'; end if;

  select kind, (content->>'templateId')::uuid into existing_kind,existing_template
  from reminders where id=(p_record->>'id')::uuid;
  if not found then
    select kind,null::uuid into existing_kind,existing_template from contexts where id=(p_record->>'id')::uuid;
  end if;
  if found and existing_kind is distinct from p_record->>'kind' then raise exception 'INVALID_KIND_CHANGE'; end if;

  tid:=(p_record->'content'->>'templateId')::uuid;
  if tid is not null and (existing_kind is null or existing_template is distinct from tid) then
    if not exists(select 1 from contexts where id=tid and not deleted and can_read_context(contexts)) then raise exception 'INVALID_TEMPLATE'; end if;
  end if;
  return save_record_internal(p_operation,p_record,p_expected);
end $$;

create or replace function public.check_review_sources(p_dependencies jsonb) returns void language plpgsql security definer set search_path=public as $$
declare source record; source_version integer;
begin
  for source in select key,value from jsonb_each(p_dependencies) order by key loop
    select version into source_version from reminders
    where id=source.key::uuid and not deleted and can_read_reminder(reminders)
    for update;
    if not found then
      select version into source_version from contexts
      where id=source.key::uuid and not deleted and can_read_context(contexts)
      for update;
    end if;
    if not found then raise exception 'FORBIDDEN'; end if;
    if source_version<>(source.value)::integer then raise exception 'CONFLICT'; end if;
  end loop;
end $$;

create or replace function public.post_note(p_record uuid,p_body text) returns void language plpgsql security definer set search_path=public as $$
declare reminder reminders;
begin
  select * into reminder from reminders where id=p_record;
  if not found or not can_edit_reminder(reminder) then raise exception 'FORBIDDEN'; end if;
  if length(trim(p_body)) not between 1 and 2000 then raise exception 'INVALID_NOTE'; end if;
  insert into activity(record_id,space_id,actor_id,body) values(reminder.id,reminder.space_id,auth.uid(),trim(p_body));
end $$;

create or replace function public.reschedule_user(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  insert into notification_epochs values(p_user,1) on conflict(user_id) do update set generation=notification_epochs.generation+1;
  update deliveries set status='cancelled',claim_token=null where user_id=p_user and status in ('pending','sending');
  insert into outbox(record_id,revision)
  select reminder.id,reminder.version from reminders as reminder
  where not reminder.deleted
    and ((reminder.space_id is null and reminder.owner_id=p_user)
      or exists(select 1 from space_members where space_id=reminder.space_id and user_id=p_user))
  on conflict(record_id,revision) do update set processed=false,generation=outbox.generation+1,failures=0,retry_at=now(),last_error=null;
end $$;

create or replace function public.members_reschedule() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then
    if exists(select 1 from auth.users where id=old.user_id) then perform reschedule_user(old.user_id); end if;
    delete from inbox where user_id=old.user_id and record_id in(
      select reminder_id from space_reminders where space_id=old.space_id
    );
    return old;
  end if;
  perform reschedule_user(new.user_id);
  return new;
end $$;

create or replace function public.collaboration_event() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; reminder reminders; epoch integer; notice text;
begin
  if new.space_id is null or new.record_id is null or new.event_type not in ('completed','item_completed') then return new; end if;
  select * into reminder from reminders where id=new.record_id;
  if not found or (new.event_type='completed' and jsonb_array_length(reminder.content->'items')>0) then return new; end if;
  notice := case when new.event_type='completed' then 'Reminder completed: '||(reminder.content->>'title') else 'Step completed: '||regexp_replace(new.body, '^[^:]+: ', '') end;
  for recipient in select user_id from space_members where space_id=new.space_id and user_id is distinct from new.actor_id loop
    insert into inbox(user_id,record_id,body,event_key) values(recipient,new.record_id,notice,'activity:'||new.id||':'||recipient) on conflict(event_key) do nothing;
    select generation into epoch from notification_epochs where user_id=recipient;
    insert into deliveries(record_id,revision,user_id,kind,due_at,generation,body) values(reminder.id,reminder.version,recipient,'activity:'||new.id,now(),coalesce(epoch,0),notice) on conflict do nothing;
  end loop;
  return new;
end $$;

create or replace function public.prepare_proposal(p_review uuid,p_request uuid,p_body jsonb,p_actions jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare review ai_reviews; existing ai_proposals; action jsonb; source_id text; dependencies jsonb:='{}'; result_id uuid;
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
  for action in select value from jsonb_array_elements(p_actions) loop
    if (action->>'expectedVersion')::integer>0 then
      source_id:=action->'record'->>'id';
      if not(review.sources ? source_id) or (review.sources->source_id->>'version')::integer<>(action->>'expectedVersion')::integer then raise exception 'CONFLICT'; end if;
      dependencies:=dependencies||jsonb_build_object(source_id,(action->>'expectedVersion')::integer);
    elsif exists(select 1 from reminders where id=(action->'record'->>'id')::uuid)
      or exists(select 1 from contexts where id=(action->'record'->>'id')::uuid) then raise exception 'CONFLICT';
    end if;
    source_id:=action->'record'->'content'->>'templateId';
    if source_id is not null then
      if not(review.sources ? source_id) then raise exception 'INVALID_TEMPLATE'; end if;
      dependencies:=dependencies||jsonb_build_object(source_id,(review.sources->source_id->>'version')::integer);
    end if;
  end loop;
  perform check_review_sources(dependencies);
  insert into ai_proposals(user_id,actions,review_id,request_id,request_body,dependencies) values(auth.uid(),p_actions,p_review,p_request,p_body,dependencies) returning id into result_id;
  return result_id;
end $$;

drop function if exists public.can_read_record(public.record_sources);
drop function if exists public.can_edit_record(public.record_sources);
drop view public.record_sources;
