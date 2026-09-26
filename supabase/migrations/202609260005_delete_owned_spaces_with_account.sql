create or replace function public.prepare_account_deletion() returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('account:'||auth.uid()::text,0));
  insert into account_deletions(user_id) values(auth.uid()) on conflict do nothing;
end $$;

-- Authenticated clients cannot change completed reminders. Server-owned cleanup
-- may still reassign a surviving shared record before its creator is removed.
create or replace function public.prevent_completed_record_edits() returns trigger language plpgsql set search_path=public as $$
begin
  if auth.uid() is not null
    and old.kind <> 'context'
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

create or replace function public.cleanup_account(p_user uuid) returns void language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('account:'||p_user::text,0));

  if not exists(select 1 from account_deletions where user_id=p_user) then
    raise exception 'DELETION_NOT_REQUESTED';
  end if;

  -- Deleting an owned Space cascades its records, memberships, invitations,
  -- activity, inbox entries, deliveries, and pending notification work.
  delete from spaces where owner_id=p_user;

  -- Keep records the departing user created in Spaces owned by someone else.
  update records as record
  set owner_id=space.owner_id
  from spaces as space
  where record.space_id=space.id and record.owner_id=p_user;

  delete from records where owner_id=p_user and space_id is null;
  delete from members where user_id=p_user;
  delete from devices where user_id=p_user;
  update deliveries
  set status='cancelled',claim_token=null
  where user_id=p_user and status in ('pending','sending');
  update account_deletions
  set attempts=attempts+1,last_error=null
  where user_id=p_user;
end $$;
