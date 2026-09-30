-- Older clients still call revoke_invite. Rotate that permission's link
-- instead, so each Space always retains one active link per role.
create or replace function public.revoke_invite(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare old_link public.invitations;
begin
  select * into old_link from public.invitations
  where id = p_id and not revoked;

  if not found then
    raise exception 'INVITATION_UNAVAILABLE';
  end if;

  perform public.rotate_space_link(old_link.space_id, old_link.role);
end;
$$;
