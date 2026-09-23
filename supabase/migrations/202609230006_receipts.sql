create function public.record_push_receipt(p_job uuid,p_token text,p_ticket text,p_outcome text) returns void language plpgsql security definer set search_path=public as $$
declare job deliveries; attempt device_deliveries; retry boolean;
begin
 select * into job from deliveries where id=p_job for update;
 if not found then return; end if;
 select * into attempt from device_deliveries where delivery_id=p_job and token=p_token for update;
 if not found or attempt.ticket_id is distinct from p_ticket or attempt.receipt_status is not null then return; end if;
 retry:=p_outcome in ('MessageRateExceeded','ServiceUnavailable','InternalServerError') and job.attempts<5 and job.status<>'cancelled';
 update device_deliveries set receipt_status=p_outcome,
 status=case when retry then 'pending' when p_outcome in ('delivered','expired') then status else 'failed' end,
 last_error=case when p_outcome='delivered' then null else p_outcome end,
 ticket_id=case when retry then null else ticket_id end
 where delivery_id=p_job and token=p_token;
 if retry then
  update device_deliveries set receipt_status=null where delivery_id=p_job and token=p_token;
  update deliveries set status='pending',claim_token=null,due_at=now()+interval '1 minute',last_error=p_outcome where id=p_job and status in ('sent','failed');
 elsif p_outcome not in ('delivered','expired') then
  update deliveries set last_error=p_outcome,status=case when status='sent' then 'failed' else status end where id=p_job;
 end if;
 if p_outcome='DeviceNotRegistered' then delete from devices where token=p_token and user_id=job.user_id; end if;
end $$;
revoke all on function public.record_push_receipt(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_push_receipt(uuid,text,text,text) to service_role;
