-- Ownership cannot race into an account after it has requested deletion.
create function public.guard_deleting_member() returns trigger language plpgsql security definer set search_path=public as $$
declare target uuid;
begin
 if tg_table_name='spaces' then target:=new.owner_id; else target:=new.user_id; end if;
 perform pg_advisory_xact_lock(hashtextextended('account:'||target::text,0));
 if exists(select 1 from account_deletions where user_id=target) then raise exception 'ACCOUNT_DELETING'; end if;
 return new;
end $$;
create trigger deleting_owner before insert or update of owner_id on spaces for each row execute function guard_deleting_member();
create trigger deleting_member before insert or update of user_id,role on members for each row execute function guard_deleting_member();
revoke all on function public.guard_deleting_member() from public,anon,authenticated;
