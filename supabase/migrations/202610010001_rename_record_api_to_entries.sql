-- The persistence API carries both reminders and Contexts, so name that
-- shared boundary an entry. Reminder-owned tables and relationships already
-- use reminder_id.

alter function public.save_record_internal(uuid,jsonb,integer)
  rename to save_entry_internal;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.save_record(uuid,jsonb,integer)'::regprocedure)
  into definition;

  drop function public.save_record(uuid,jsonb,integer);

  definition := replace(definition, 'save_record', 'save_entry');
  definition := replace(definition, 'p_record', 'p_entry');
  definition := replace(definition, 'record_kind', 'entry_kind');
  definition := replace(definition, 'record_content', 'entry_content');
  execute definition;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.post_note(uuid,text)'::regprocedure)
  into definition;

  drop function public.post_note(uuid,text);
  definition := replace(definition, 'p_record', 'p_reminder');
  execute definition;
end $$;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('public.apply_ai_operation(uuid,jsonb,jsonb,jsonb,jsonb)'::regprocedure)
  into definition;

  definition := replace(definition, 'save_record(', 'save_entry(');
  definition := replace(definition, 'action->''record''', 'action->''entry''');
  execute definition;
end $$;

revoke all on function public.save_entry(uuid,jsonb,integer) from public, anon;
grant execute on function public.save_entry(uuid,jsonb,integer) to authenticated;
revoke all on function public.save_entry_internal(uuid,jsonb,integer) from public, anon, authenticated;
revoke all on function public.post_note(uuid,text) from public, anon;
grant execute on function public.post_note(uuid,text) to authenticated;
