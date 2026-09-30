-- Space editors may change display details. Destructive actions remain owner-only.
create or replace function public.update_space(
  p_space uuid,
  p_name text,
  p_color text
)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_space public.spaces;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if p_name is null or length(trim(p_name)) not between 1 and 100
    or p_color is null then
    raise exception 'INVALID_SPACE';
  end if;

  if coalesce(public.space_role(p_space), '') not in ('owner', 'editor') then
    raise exception 'SPACE_NOT_FOUND';
  end if;

  update public.spaces
  set name = trim(p_name), color = p_color
  where id = p_space
  returning * into updated_space;

  if updated_space.id is null then
    raise exception 'SPACE_NOT_FOUND';
  end if;

  return updated_space;
end;
$$;

revoke all on function public.update_space(uuid, text, text) from public;
grant execute on function public.update_space(uuid, text, text) to authenticated;
