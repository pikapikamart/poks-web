-- The applications use the normalized tables directly. Keep the combined
-- read model under an internal name for database workflows, and remove the
-- obsolete public `records` relation name.
alter view public.records rename to record_sources;

-- PL/pgSQL bodies are stored as source text, so relation renames do not
-- rewrite their embedded queries. Recreate only functions that still contain
-- the old relation identifier.
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
      and pg_get_functiondef(procedure.oid) ~ '\mrecords\M'
  loop
    execute regexp_replace(definition, '\mrecords\M', 'record_sources', 'g');
  end loop;
end $$;

revoke all on public.record_sources from authenticated, anon;
grant select on public.record_sources to service_role;
