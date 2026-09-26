-- Scheduled reminders and nudges belong in device notifications, not the in-app activity inbox.
delete from public.inbox
where event_key is null or event_key not like 'activity:%';

-- The inbox records completed reminders and steps. Reopens and other activity stay out.
delete from public.inbox as inbox
using public.activity as activity
where inbox.event_key like 'activity:' || activity.id || ':%'
  and activity.event_type not in ('completed', 'item_completed');

delete from public.inbox as inbox
using public.activity as activity, public.records as record
where inbox.event_key like 'activity:' || activity.id || ':%'
  and activity.record_id = record.id
  and activity.event_type = 'completed'
  and jsonb_array_length(record.content->'items') > 0;

update public.inbox as inbox
set body = case
  when activity.event_type = 'completed'
    then 'Reminder completed: ' || regexp_replace(activity.body, '^[^:]+: ', '')
  else 'Step completed: ' || regexp_replace(activity.body, '^[^:]+: ', '')
end
from public.activity as activity
where inbox.event_key like 'activity:' || activity.id || ':%'
  and activity.event_type in ('completed', 'item_completed');

create or replace function public.collaboration_event() returns trigger language plpgsql security definer set search_path=public as $$
declare recipient uuid; r records; epoch integer; notice text;
begin
  if new.space_id is null
    or new.record_id is null
    or new.event_type not in ('completed', 'item_completed')
  then
    return new;
  end if;

  select * into r from records where id=new.record_id;
  if not found
    or (new.event_type='completed' and jsonb_array_length(r.content->'items')>0)
  then
    return new;
  end if;

  notice := case
    when new.event_type='completed' then 'Reminder completed: '||(r.content->>'title')
    else 'Step completed: '||regexp_replace(new.body, '^[^:]+: ', '')
  end;

  for recipient in select user_id from members where space_id=new.space_id and user_id is distinct from new.actor_id loop
    insert into inbox(user_id,record_id,body,event_key)
    values(recipient,new.record_id,notice,'activity:'||new.id||':'||recipient)
    on conflict(event_key) do nothing;

    select generation into epoch from notification_epochs where user_id=recipient;
    insert into deliveries(record_id,revision,user_id,kind,due_at,generation,body)
    values(r.id,r.version,recipient,'activity:'||new.id,now(),coalesce(epoch,0),notice)
    on conflict do nothing;
  end loop;

  return new;
end $$;
