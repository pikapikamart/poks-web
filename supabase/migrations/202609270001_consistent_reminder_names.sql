-- Align every reminder relationship with the normalized table names and
-- remove the final membership compatibility view.

alter table public.activity rename column record_id to reminder_id;
alter table public.inbox rename column record_id to reminder_id;
alter table public.outbox rename column record_id to reminder_id;
alter table public.deliveries rename column record_id to reminder_id;
alter table public.recurrences rename column parent_id to parent_reminder_id;
alter table public.recurrences rename column next_id to next_reminder_id;

alter table public.activity rename constraint activity_record_id_fkey to activity_reminder_id_fkey;
alter table public.inbox rename constraint inbox_record_id_fkey to inbox_reminder_id_fkey;
alter table public.outbox rename constraint outbox_record_id_fkey to outbox_reminder_id_fkey;
alter table public.outbox rename constraint outbox_record_id_revision_key to outbox_reminder_id_revision_key;
alter table public.deliveries rename constraint deliveries_record_id_fkey to deliveries_reminder_id_fkey;
alter table public.deliveries rename constraint deliveries_record_id_revision_user_id_kind_generation_key to deliveries_reminder_revision_user_kind_generation_key;
alter table public.recurrences rename constraint recurrences_parent_id_fkey to recurrences_parent_reminder_id_fkey;
alter table public.recurrences rename constraint recurrences_next_id_fkey to recurrences_next_reminder_id_fkey;
drop policy if exists profile_read on public.profiles;
create policy profile_read on public.profiles for select to authenticated using (
  id=auth.uid()
  or exists (
    select 1
    from space_members as member
    join space_members as current_member on member.space_id=current_member.space_id
    where member.user_id=profiles.id and current_member.user_id=auth.uid()
  )
);

-- Column and relation names inside PL/pgSQL bodies are stored as source text.
-- Recreate affected functions after the physical renames.
do $$
declare
  definition text;
begin
  for definition in
    select pg_get_functiondef(procedure.oid)
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid=procedure.pronamespace
    where namespace.nspname='public'
      and procedure.prokind in ('f', 'p')
      and pg_get_functiondef(procedure.oid) ~ '\m(record_id|parent_id|next_id|members)\M'
  loop
    definition:=regexp_replace(definition,'\mrecord_id\M','reminder_id','g');
    definition:=regexp_replace(definition,'\mparent_id\M','parent_reminder_id','g');
    definition:=regexp_replace(definition,'\mnext_id\M','next_reminder_id','g');
    definition:=regexp_replace(definition,'\mmembers\M','space_members','g');
    execute definition;
  end loop;
end $$;

drop view public.members;
