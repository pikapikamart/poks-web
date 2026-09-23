-- Schema-specific defaults cannot subtract the global PUBLIC EXECUTE default.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function public.space_role(uuid),public.can_read_record(public.records),public.can_edit_record(public.records),public.account_active(),
 public.save_record(uuid,jsonb,integer),public.create_space(text),public.manage_member(uuid,uuid,text),public.delete_space(uuid),public.leave_space(uuid),
 public.invite(uuid,text),public.revoke_invite(uuid),public.inspect_invite(uuid),public.accept_invite(uuid),public.post_note(uuid,text),
 public.apply_proposal(uuid),public.prepare_proposal(uuid,uuid,jsonb,jsonb),public.prepare_account_deletion() to authenticated;
grant execute on function public.claim_deliveries(integer),public.consume_rate(uuid,text,integer),public.spawn_occurrence(uuid,integer,jsonb),public.due_recurrences(),
 public.cleanup_account(uuid),public.finish_device_attempt(uuid,uuid,text,text,text,text) to service_role;
