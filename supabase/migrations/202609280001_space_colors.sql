alter table public.spaces
  add column color text not null default '#F4ECE0'
  constraint spaces_color_palette_check
  check (color in ('#F4ECE0', '#E7F1E9', '#F7E3E1', '#E6EEF4', '#EFE6F4'));

create function public.create_space(p_name text, p_color text)
returns public.spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  created_space public.spaces;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  insert into public.spaces (owner_id, name, color)
  values (auth.uid(), trim(p_name), p_color)
  returning * into created_space;

  insert into public.space_members (space_id, user_id, role)
  values (created_space.id, auth.uid(), 'owner');

  return created_space;
end;
$$;

revoke all on function public.create_space(text, text) from public;
grant execute on function public.create_space(text, text) to authenticated;
