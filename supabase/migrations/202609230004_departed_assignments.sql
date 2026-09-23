-- Existing assignments remain historical; new assignments still require membership.
create or replace function public.save_record_internal(p_operation uuid,p_record jsonb,p_expected integer) returns jsonb language plpgsql security definer set search_path=public as $$
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
   if sid is not null and not exists(select 1 from members where space_id=sid and user_id=(item->>'assignee')::uuid) and not exists(select 1 from records rr cross join lateral jsonb_array_elements(rr.content->'items') v where rr.id=rid and rr.space_id=sid and v->>'id'=item->>'id' and v->>'assignee'=item->>'assignee') then raise exception 'INVALID_ASSIGNEE'; end if;
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

revoke all on function public.save_record_internal(uuid,jsonb,integer) from public,anon,authenticated;
