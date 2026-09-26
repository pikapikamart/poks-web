-- Shared reminder activity only surfaces checklist progress.
delete from public.inbox as inbox
using public.activity as activity
where inbox.event_key like 'activity:' || activity.id || ':%'
  and activity.event_type not in ('item_completed', 'item_reopened');

create or replace function public.collaboration_event() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; r records; epoch integer;
begin
  if new.space_id is null or new.event_type not in ('item_completed', 'item_reopened') then
    return new;
  end if;

  for recipient in select user_id from members where space_id=new.space_id and user_id is distinct from new.actor_id loop
    insert into inbox(user_id,record_id,body,event_key)
    values(recipient,new.record_id,new.body,'activity:'||new.id||':'||recipient)
    on conflict(event_key) do nothing;

    if new.record_id is not null and new.event_type='item_completed' then
      select * into r from records where id=new.record_id;
      select generation into epoch from notification_epochs where user_id=recipient;
      insert into deliveries(record_id,revision,user_id,kind,due_at,generation,body)
      values(r.id,r.version,recipient,'activity:'||new.id,now(),coalesce(epoch,0),new.body)
      on conflict do nothing;
    end if;
  end loop;

  return new;
end $$;
