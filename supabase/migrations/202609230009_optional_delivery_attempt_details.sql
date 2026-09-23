-- PostgREST exposes nullable RPC inputs as omitted optional arguments. Defaults
-- preserve the delivery outcome while keeping generated client types accurate.
create or replace function public.finish_device_attempt(
 p_job uuid,
 p_claim uuid,
 p_token text,
 p_status text,
 p_ticket text default null,
 p_error text default null
) returns boolean language plpgsql security definer set search_path=public as $$
begin
 perform 1 from deliveries where id=p_job and claim_token=p_claim and status='sending' and lease_until>now() for update;
 if not found then return false; end if;
 update device_deliveries set status=p_status,attempts=attempts+1,ticket_id=p_ticket,
 accepted_at=case when p_status='accepted' then now() else accepted_at end,last_error=p_error
 where delivery_id=p_job and token=p_token and status='pending';
 return found;
end $$;

revoke all on function public.finish_device_attempt(uuid,uuid,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.finish_device_attempt(uuid,uuid,text,text,text,text)
 to service_role;
