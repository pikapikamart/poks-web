create function public.due_recurrences() returns setof records language sql security definer set search_path=public as $$
 select r.* from records r where not r.deleted and r.kind<>'context' and r.content->>'recurrence'<>'none' and r.content->>'archived'='false'
 and not exists(select 1 from recurrences c where c.parent_id=r.id)
 and coalesce((r.content->>'dueAt')::timestamptz,((r.content->>'dueDate')::date)::timestamp at time zone (r.content->>'timeZone'))<=now()
 order by r.updated_at limit 100
$$;
revoke all on function public.due_recurrences() from public;
grant execute on function public.due_recurrences() to service_role;
