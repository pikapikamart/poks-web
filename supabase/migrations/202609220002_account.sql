create function public.prepare_account_deletion() returns void language plpgsql security definer set search_path=public as $$ begin
 if auth.uid() is null then raise exception 'UNAUTHENTICATED'; end if;
 if exists(select 1 from spaces where owner_id=auth.uid()) then raise exception 'TRANSFER_OWNERSHIP_FIRST'; end if;
 update records r set owner_id=s.owner_id from spaces s where r.space_id=s.id and r.owner_id=auth.uid();
 delete from records where owner_id=auth.uid() and space_id is null;
end $$;
