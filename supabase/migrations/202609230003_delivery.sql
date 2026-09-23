alter table records add column search_vector tsvector generated always as (to_tsvector('english',coalesce(content->>'title','')||' '||coalesce(content->>'notes',''))) stored;
create index records_search on records using gin(search_vector);
alter table outbox add column generation integer not null default 0;
alter table outbox add column failures integer not null default 0;
alter table outbox add column retry_at timestamptz not null default now();
alter table outbox add column last_error text;
create table public.notification_epochs(user_id uuid primary key references auth.users on delete cascade,generation integer not null default 0);
alter table notification_epochs enable row level security;
grant all on notification_epochs to service_role;
alter table deliveries add column generation integer not null default 0;
alter table deliveries add column claim_token uuid;
alter table deliveries add column body text;
alter table deliveries drop constraint deliveries_record_id_revision_user_id_kind_key;
alter table deliveries add unique(record_id,revision,user_id,kind,generation);
create table public.device_deliveries(
 delivery_id uuid not null references deliveries on delete cascade,token text not null,
 status text not null default 'pending' check(status in ('pending','accepted','failed','cancelled')),
 attempts integer not null default 0,ticket_id text,receipt_status text,accepted_at timestamptz,last_error text,
 primary key(delivery_id,token)
);
alter table device_deliveries enable row level security;
grant all on device_deliveries to service_role;
create index device_receipts on device_deliveries(accepted_at) where ticket_id is not null and receipt_status is null;

create or replace function public.claim_deliveries(p_limit integer default 50) returns setof deliveries language plpgsql security definer set search_path=public as $$
begin
 update deliveries set status='failed',last_error='RETRY_EXHAUSTED' where attempts>=5 and (status='pending' or (status='sending' and lease_until<now()));
 return query update deliveries set status='sending',claim_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 where id in
 (select id from deliveries where due_at<=now() and (status='pending' or (status='sending' and lease_until<now())) and attempts<5 order by due_at,id for update skip locked limit greatest(0,least(p_limit,50))) returning *;
end $$;
create function public.finish_device_attempt(p_job uuid,p_claim uuid,p_token text,p_status text,p_ticket text,p_error text) returns boolean language plpgsql security definer set search_path=public as $$
begin
 perform 1 from deliveries where id=p_job and claim_token=p_claim and status='sending' and lease_until>now() for update;
 if not found then return false; end if;
 update device_deliveries set status=p_status,attempts=attempts+1,ticket_id=p_ticket,
 accepted_at=case when p_status='accepted' then now() else accepted_at end,last_error=p_error
 where delivery_id=p_job and token=p_token and status='pending';
 return found;
end $$;
grant execute on function public.finish_device_attempt(uuid,uuid,text,text,text,text) to service_role;

create function public.reschedule_user(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 insert into notification_epochs values(p_user,1) on conflict(user_id) do update set generation=notification_epochs.generation+1;
 update deliveries set status='cancelled',claim_token=null where user_id=p_user and status in ('pending','sending');
 insert into outbox(record_id,revision) select r.id,r.version from records r where not r.deleted and r.kind<>'context'
 and ((r.space_id is null and r.owner_id=p_user) or exists(select 1 from members m where m.space_id=r.space_id and m.user_id=p_user))
 on conflict(record_id,revision) do update set processed=false,generation=outbox.generation+1,failures=0,retry_at=now(),last_error=null;
end $$;
create or replace function public.preferences_reschedule() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.preferences is distinct from new.preferences then perform reschedule_user(new.id); end if;
 return new;
end $$;
create function public.members_reschedule() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from auth.users where id=old.user_id) then perform reschedule_user(old.user_id); end if;
  delete from inbox where user_id=old.user_id and record_id in(select id from records where space_id=old.space_id);
  return old;
 end if;
 perform reschedule_user(new.user_id); return new;
end $$;
create trigger member_schedule after insert or update or delete on members for each row execute function members_reschedule();

alter table activity add column event_type text not null default 'note';
alter table activity add column metadata jsonb not null default '{}';
-- Capture meaningful changes in the same transaction as the record write.
create function public.record_history() returns trigger language plpgsql security definer set search_path=public as $$
declare i jsonb; previous jsonb; kind text;
begin
 if tg_op='UPDATE' then
  if new.content->'completed' is distinct from old.content->'completed' then
   kind:=case when (new.content->>'completed')::boolean then 'completed' else 'reopened' end;
   insert into activity(record_id,space_id,actor_id,body,event_type) values(new.id,new.space_id,auth.uid(),kind||': '||(new.content->>'title'),kind);
  end if;
 end if;
 for i in select value from jsonb_array_elements(new.content->'items') loop
  previous:=null;
  if tg_op='UPDATE' then select value into previous from jsonb_array_elements(old.content->'items') where value->>'id'=i->>'id'; end if;
  if previous is not null and previous->'completed' is distinct from i->'completed' then
   kind:=case when (i->>'completed')::boolean then 'item_completed' else 'item_reopened' end;
   insert into activity(record_id,space_id,actor_id,body,event_type,metadata) values(new.id,new.space_id,auth.uid(),kind||': '||(i->>'title'),kind,jsonb_build_object('itemId',i->>'id'));
  end if;
  if i->>'assignee' is not null and (previous is null or previous->'assignee' is distinct from i->'assignee') then
   insert into activity(record_id,space_id,actor_id,body,event_type,metadata) values(new.id,new.space_id,auth.uid(),'Assigned: '||(i->>'title'),'assignment',jsonb_build_object('itemId',i->>'id','assignee',i->>'assignee'));
  end if;
 end loop; return new;
end $$;
create trigger record_history after insert or update on records for each row execute function record_history();
create function public.collaboration_event() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; r records; epoch integer;
begin
 if new.space_id is null then return new; end if;
 for recipient in select user_id from members where space_id=new.space_id and user_id is distinct from new.actor_id loop
  insert into inbox(user_id,record_id,body,event_key) values(recipient,new.record_id,new.body,'activity:'||new.id||':'||recipient) on conflict(event_key) do nothing;
  if new.record_id is not null and (new.event_type='completed' or (new.event_type='assignment' and new.metadata->>'assignee'=recipient::text)) then
   select * into r from records where id=new.record_id;
   select generation into epoch from notification_epochs where user_id=recipient;
   insert into deliveries(record_id,revision,user_id,kind,due_at,generation,body) values(r.id,r.version,recipient,'activity:'||new.id,now(),coalesce(epoch,0),new.body) on conflict do nothing;
  end if;
 end loop;return new;
end $$;
create trigger activity_notifications after insert on activity for each row execute function collaboration_event();
create function public.membership_history() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='DELETE' then
  if exists(select 1 from spaces where id=old.space_id) then insert into activity(space_id,actor_id,body,event_type,metadata) values(old.space_id,auth.uid(),'Member left or was removed','member_removed',jsonb_build_object('userId',old.user_id)); end if;
  return old;
 end if;
 insert into activity(space_id,actor_id,body,event_type,metadata) values(new.space_id,auth.uid(),case when tg_op='INSERT' then 'Member joined' else 'Member role changed' end,case when tg_op='INSERT' then 'member_joined' else 'member_role' end,jsonb_build_object('userId',new.user_id,'role',new.role));
 return new;
end $$;
create trigger membership_history after insert or update or delete on members for each row execute function membership_history();
create function public.invitation_history() returns trigger language plpgsql security definer set search_path=public as $$
begin
 insert into activity(space_id,actor_id,body,event_type) values(new.space_id,auth.uid(),case when tg_op='INSERT' then 'Invitation created' when new.revoked then 'Invitation revoked' else 'Invitation accepted' end,'invitation');
 return new;
end $$;
create trigger invitation_history after insert or update on invitations for each row execute function invitation_history();

-- Carry a stable calendar anchor outside user-editable content.
alter table records add column recurrence_anchor text;
update records set recurrence_anchor=coalesce(content->>'dueAt',content->>'dueDate') where content->>'recurrence'<>'none';
create function public.recurrence_anchor_update() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' then new.recurrence_anchor:=coalesce(new.recurrence_anchor,new.content->>'dueAt',new.content->>'dueDate');
 elsif new.content->'dueAt' is distinct from old.content->'dueAt' or new.content->'dueDate' is distinct from old.content->'dueDate' or new.content->'recurrence' is distinct from old.content->'recurrence' then new.recurrence_anchor:=coalesce(new.content->>'dueAt',new.content->>'dueDate'); end if;
 return new;
end $$;
create trigger recurrence_anchor before insert or update on records for each row execute function recurrence_anchor_update();
create or replace function public.spawn_occurrence(p_parent uuid,p_revision integer,p_content jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare r records; nid uuid;
begin
 select * into r from records where id=p_parent for update;
 if not found or r.version<>p_revision or r.deleted or (r.content->>'archived')::boolean or exists(select 1 from account_deletions where user_id=r.owner_id) then return null; end if;
 select next_id into nid from recurrences where parent_id=p_parent;
 if found then return nid; end if;
 nid:=gen_random_uuid();
 insert into records(id,owner_id,space_id,kind,content,recurrence_anchor) values(nid,r.owner_id,r.space_id,r.kind,p_content,r.recurrence_anchor);
 insert into recurrences values(p_parent,nid);
 insert into outbox(record_id,revision) values(nid,1);
 return nid;
end $$;
