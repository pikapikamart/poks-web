-- Space removal is an account event rather than a reminder event. Generic
-- notification deliveries therefore do not require a reminder foreign key.

alter table public.notification_deliveries
drop constraint notification_deliveries_reminder_user_kind_key;

alter table public.notification_deliveries
alter column reminder_id drop not null;

alter table public.notification_deliveries
add constraint notification_deliveries_reminder_user_kind_key
unique nulls not distinct (reminder_id, revision, user_id, kind, generation);

create or replace function public.manage_member(p_space uuid,p_user uuid,p_role text) returns void language plpgsql security definer set search_path=public as $$
declare space_name text; recipient_generation integer;
begin
 if space_role(p_space)<>'owner' or space_role(p_space) is null then raise exception 'FORBIDDEN'; end if;
 if p_user=auth.uid() then raise exception 'CANNOT_MANAGE_OWNER'; end if;

 if p_role is null then
  select name into space_name from spaces where id=p_space for update;
  if space_name is null then raise exception 'SPACE_NOT_FOUND'; end if;
  delete from space_members where space_id=p_space and user_id=p_user;
  if not found then raise exception 'NOT_MEMBER'; end if;

  insert into notification_inbox(user_id,body,event_key)
  values(p_user,'You were removed from '||space_name,'space-removal:'||p_space||':'||p_user)
  on conflict(event_key) do nothing;

  select generation into recipient_generation from notification_epochs where user_id=p_user;
  insert into notification_deliveries(reminder_id,revision,user_id,kind,due_at,generation,body)
  values(null,0,p_user,'space-removal:'||p_space||':'||p_user,now(),coalesce(recipient_generation,0),'You were removed from '||space_name)
  on conflict(reminder_id,revision,user_id,kind,generation) do update set due_at=excluded.due_at,status='pending',claim_token=null,attempts=0,last_error=null;
 elsif p_role in ('editor','viewer') then
  update space_members set role=p_role where space_id=p_space and user_id=p_user;
  if not found then raise exception 'NOT_MEMBER'; end if;
 else
  raise exception 'INVALID_ROLE';
 end if;
end $$;
