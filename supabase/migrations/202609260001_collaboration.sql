-- Group invitations are durable, reusable links. A revoked link is replaced on demand.
update public.invitations
set expires_at = 'infinity', accepted_by = null
where not revoked;

create or replace function public.invite(p_space uuid,p_role text) returns public.invitations language plpgsql security definer set search_path=public as $$
declare i public.invitations;
begin
  if p_role not in ('editor','viewer') or space_role(p_space) <> 'owner' then
    raise exception 'FORBIDDEN';
  end if;

  select * into i
  from invitations
  where space_id = p_space and not revoked
  order by id
  limit 1
  for update;

  if found then
    return i;
  end if;

  insert into invitations(space_id,role,expires_at)
  values(p_space,p_role,'infinity')
  returning * into i;

  return i;
end $$;

create or replace function public.inspect_invite(p_token uuid) returns jsonb language plpgsql security definer set search_path=public as $$
declare i invitations;
begin
  select * into i from invitations where token=p_token and not revoked;
  if not found then raise exception 'INVITATION_UNAVAILABLE'; end if;
  return jsonb_build_object('name',(select name from spaces where id=i.space_id),'role',i.role,'space_id',i.space_id);
end $$;

create or replace function public.accept_invite(p_token uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare i invitations;
begin
  select * into i from invitations where token=p_token for update;
  if not found or i.revoked then raise exception 'INVITATION_UNAVAILABLE'; end if;
  insert into members(space_id,user_id,role)
  values(i.space_id,auth.uid(),i.role)
  on conflict(space_id,user_id) do nothing;
  return i.space_id;
end $$;

-- Checklist progress in a shared responsibility is visible to the other members.
create or replace function public.collaboration_event() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; r records; epoch integer;
begin
  if new.space_id is null then return new; end if;
  for recipient in select user_id from members where space_id=new.space_id and user_id is distinct from new.actor_id loop
    insert into inbox(user_id,record_id,body,event_key)
    values(recipient,new.record_id,new.body,'activity:'||new.id||':'||recipient)
    on conflict(event_key) do nothing;
    if new.record_id is not null and (new.event_type in ('completed','item_completed') or (new.event_type='assignment' and new.metadata->>'assignee'=recipient::text)) then
      select * into r from records where id=new.record_id;
      select generation into epoch from notification_epochs where user_id=recipient;
      insert into deliveries(record_id,revision,user_id,kind,due_at,generation,body)
      values(r.id,r.version,recipient,'activity:'||new.id,now(),coalesce(epoch,0),new.body)
      on conflict do nothing;
    end if;
  end loop;
  return new;
end $$;

grant execute on function public.invite(uuid,text),public.inspect_invite(uuid),public.accept_invite(uuid) to authenticated;
