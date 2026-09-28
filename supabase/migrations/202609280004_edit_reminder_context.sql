-- A reminder may switch between its own steps and copied Context steps.
-- Context rows still cannot be changed into reminders or vice versa.
do $$
declare
  definition text;
  updated text;
begin
  select pg_get_functiondef('public.validate_record_content()'::regprocedure)
  into definition;
  updated := replace(
    definition,
    'tg_op=''UPDATE'' and new.kind<>old.kind',
    'tg_op=''UPDATE'' and new.kind<>old.kind and (new.kind=''context'' or old.kind=''context'')'
  );
  if updated = definition then
    raise exception 'validate_record_content kind guard was not found';
  end if;
  execute updated;

  select pg_get_functiondef('public.save_record(uuid,jsonb,integer)'::regprocedure)
  into definition;
  updated := replace(
    definition,
    'existing_kind is distinct from p_record->>''kind''',
    '(existing_kind = ''context'' or p_record->>''kind'' = ''context'') and existing_kind is distinct from p_record->>''kind'''
  );
  if updated = definition then
    raise exception 'save_record kind guard was not found';
  end if;
  execute updated;

  select pg_get_functiondef('public.save_record_internal(uuid,jsonb,integer)'::regprocedure)
  into definition;
  updated := regexp_replace(
    definition,
    'update[[:space:]]+reminders[[:space:]]+set[[:space:]]+content[[:space:]]*=',
    'update reminders set kind=record_kind,content=',
    'i'
  );
  if updated = definition then
    raise exception 'save_record_internal update was not found';
  end if;
  execute updated;
end $$;
