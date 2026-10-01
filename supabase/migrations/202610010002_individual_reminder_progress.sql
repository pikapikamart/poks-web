-- Space reminders can either share one completion state or track independent
-- progress for every member without duplicating the reminder itself.

alter table public.reminders
add column completion_mode text generated always as (
  coalesce(content->>'completionMode', 'shared')
) stored;

alter table public.reminders
add constraint reminders_completion_mode_check
check (completion_mode in ('shared', 'individual'));

create table public.reminder_participants (
  reminder_id uuid not null references public.reminders on delete cascade,
  space_id uuid not null references public.spaces on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (reminder_id, user_id),
  foreign key (space_id, user_id)
    references public.space_members(space_id, user_id) on delete cascade,
  check ((completed and completed_at is not null) or (not completed and completed_at is null))
);

create table public.reminder_step_completions (
  reminder_id uuid not null,
  user_id uuid not null,
  step_id uuid not null,
  completed_at timestamptz not null default now(),
  primary key (reminder_id, user_id, step_id),
  foreign key (reminder_id, user_id)
    references public.reminder_participants(reminder_id, user_id) on delete cascade
);

create index reminder_participants_space
on public.reminder_participants(space_id, reminder_id);

create index reminder_participants_user
on public.reminder_participants(user_id, completed, reminder_id);

alter table public.reminder_participants enable row level security;
alter table public.reminder_step_completions enable row level security;

create policy reminder_participant_read
on public.reminder_participants
for select to authenticated
using (public.space_role(space_id) is not null);

create policy reminder_step_completion_read
on public.reminder_step_completions
for select to authenticated
using (
  exists (
    select 1
    from public.reminder_participants as participant
    where participant.reminder_id=reminder_step_completions.reminder_id
      and participant.user_id=reminder_step_completions.user_id
      and public.space_role(participant.space_id) is not null
  )
);

grant select on public.reminder_participants,
  public.reminder_step_completions to authenticated;
grant all on public.reminder_participants,
  public.reminder_step_completions to service_role;

create function public.sync_reminder_participants()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.deleted or new.space_id is null or new.completion_mode='shared' then
    delete from reminder_participants where reminder_id=new.id;
    return new;
  end if;

  if tg_op='INSERT'
    or old.space_id is distinct from new.space_id
    or old.completion_mode is distinct from new.completion_mode
    or old.deleted is distinct from new.deleted then
    delete from reminder_participants where reminder_id=new.id;
    insert into reminder_participants(reminder_id,space_id,user_id)
    select new.id,new.space_id,member.user_id
    from space_members as member
    where member.space_id=new.space_id;
  end if;

  return new;
end;
$$;

create trigger reminder_participants_sync
after insert or update of content,space_id,deleted on public.reminders
for each row execute function public.sync_reminder_participants();

-- Existing reminders use shared completion, so the trigger only needs to seed
-- rows for individual reminders created after this migration.

create function public.set_reminder_progress(
  p_reminder uuid,
  p_completed boolean,
  p_step uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  reminder reminders;
  participant reminder_participants;
  required_steps integer;
  completed_steps integer;
begin
  if auth.uid() is null or not account_active() then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into reminder
  from reminders
  where id=p_reminder and not deleted
  for update;

  if not found or reminder.completion_mode<>'individual' then
    raise exception 'REMINDER_NOT_FOUND';
  end if;

  select * into participant
  from reminder_participants
  where reminder_id=p_reminder and user_id=auth.uid()
  for update;

  if not found then
    raise exception 'FORBIDDEN';
  end if;

  if p_step is null then
    update reminder_participants
    set completed=p_completed,
      completed_at=case when p_completed then now() else null end,
      updated_at=now()
    where reminder_id=p_reminder and user_id=auth.uid()
    returning * into participant;
  else
    if not exists (
      select 1
      from jsonb_array_elements(reminder.content->'items') as item
      where (item->>'id')::uuid=p_step
    ) then
      raise exception 'STEP_NOT_FOUND';
    end if;

    if p_completed then
      insert into reminder_step_completions(reminder_id,user_id,step_id)
      values(p_reminder,auth.uid(),p_step)
      on conflict(reminder_id,user_id,step_id)
      do update set completed_at=now();
    else
      delete from reminder_step_completions
      where reminder_id=p_reminder and user_id=auth.uid() and step_id=p_step;
    end if;

    select count(*) into required_steps
    from jsonb_array_elements(reminder.content->'items') as item
    where coalesce((item->>'required')::boolean,true);

    select count(*) into completed_steps
    from reminder_step_completions as completion
    join lateral jsonb_array_elements(reminder.content->'items') as item
      on (item->>'id')::uuid=completion.step_id
    where completion.reminder_id=p_reminder
      and completion.user_id=auth.uid()
      and coalesce((item->>'required')::boolean,true);

    update reminder_participants
    set completed=required_steps>0 and completed_steps=required_steps,
      completed_at=case
        when required_steps>0 and completed_steps=required_steps then now()
        else null
      end,
      updated_at=now()
    where reminder_id=p_reminder and user_id=auth.uid()
    returning * into participant;
  end if;

  return jsonb_build_object(
    'participant',to_jsonb(participant),
    'completedStepIds',coalesce((
      select jsonb_agg(step_id order by step_id)
      from reminder_step_completions
      where reminder_id=p_reminder and user_id=auth.uid()
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.sync_reminder_participants() from public, anon, authenticated;
revoke all on function public.set_reminder_progress(uuid,boolean,uuid) from public, anon;
grant execute on function public.set_reminder_progress(uuid,boolean,uuid) to authenticated;

alter publication supabase_realtime add table public.reminder_participants,
  public.reminder_step_completions;
