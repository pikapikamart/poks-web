-- Changing completion behavior after members have started would discard or
-- reinterpret their work. Require managers to keep the established mode.

create function public.protect_reminder_completion_mode()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if coalesce(old.content->>'completionMode','shared')
    is distinct from coalesce(new.content->>'completionMode','shared')
    and (
      exists (
        select 1 from reminder_participants
        where reminder_id=old.id and completed
      )
      or exists (
        select 1 from reminder_step_completions
        where reminder_id=old.id
      )
    ) then
    raise exception 'COMPLETION_MODE_HAS_PROGRESS';
  end if;

  return new;
end;
$$;

create trigger reminder_completion_mode_guard
before update of content on public.reminders
for each row execute function public.protect_reminder_completion_mode();

revoke all on function public.protect_reminder_completion_mode()
from public, anon, authenticated;
