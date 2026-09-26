create function public.prevent_completed_record_edits() returns trigger language plpgsql set search_path=public as $$
begin
  if old.kind <> 'context'
    and not old.deleted
    and coalesce((old.content->>'completed')::boolean, false)
  then
    if not new.deleted
      or new.content is distinct from old.content
      or new.space_id is distinct from old.space_id
    then
      raise exception 'CANNOT_EDIT_COMPLETED';
    end if;
  end if;

  return new;
end $$;

create trigger completed_records_read_only
before update on public.records
for each row execute function public.prevent_completed_record_edits();
