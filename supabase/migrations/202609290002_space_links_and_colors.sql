alter table public.spaces drop constraint spaces_color_palette_check;
alter table public.spaces add constraint spaces_color_palette_check
  check (color in ('#F4ECE0', '#E7F1E9', '#F7E3E1', '#E6EEF4', '#EFE6F4', '#FBE9DB', '#DFF2EF', '#F9F0D4'));

-- Keep the newest usable link for each permission level on existing Spaces.
with ranked as (
  select id, row_number() over (partition by space_id, role order by id desc) as position
  from public.invitations
  where not revoked
)
update public.invitations as invitation
set revoked = true
from ranked
where invitation.id = ranked.id and ranked.position > 1;

insert into public.invitations (space_id, role, expires_at)
select space.id, role.name, 'infinity'::timestamptz
from public.spaces as space
cross join (values ('editor'), ('viewer')) as role(name)
where not exists (
  select 1 from public.invitations as invitation
  where invitation.space_id = space.id and invitation.role = role.name and not invitation.revoked
);

create unique index invitations_one_active_role_per_space
  on public.invitations (space_id, role) where not revoked;

create function public.create_space_links() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.invitations (space_id, role, expires_at)
  values (new.id, 'editor', 'infinity'), (new.id, 'viewer', 'infinity');
  return new;
end;
$$;

create trigger create_space_links after insert on public.spaces
for each row execute function public.create_space_links();

create or replace function public.invite(p_space uuid, p_role text)
returns public.invitations language plpgsql security definer set search_path = public as $$
declare result public.invitations;
begin
  if p_role not in ('editor', 'viewer') or public.space_role(p_space) <> 'owner' then
    raise exception 'FORBIDDEN';
  end if;
  select * into result from public.invitations
  where space_id = p_space and role = p_role and not revoked;
  if not found then
    raise exception 'INVITATION_UNAVAILABLE';
  end if;
  return result;
end;
$$;

create function public.rotate_space_link(p_space uuid, p_role text)
returns public.invitations language plpgsql security definer set search_path = public as $$
declare result public.invitations;
begin
  if p_role not in ('editor', 'viewer') or public.space_role(p_space) <> 'owner' then
    raise exception 'FORBIDDEN';
  end if;
  perform 1 from public.spaces where id = p_space for update;
  update public.invitations set revoked = true
  where space_id = p_space and role = p_role and not revoked;
  insert into public.invitations (space_id, role, expires_at)
  values (p_space, p_role, 'infinity') returning * into result;
  return result;
end;
$$;

revoke all on function public.rotate_space_link(uuid, text) from public;
grant execute on function public.rotate_space_link(uuid, text) to authenticated;
