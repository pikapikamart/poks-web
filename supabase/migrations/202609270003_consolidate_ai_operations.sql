-- AI commands are interpreted and applied in one request. Keep one operation
-- row for idempotent retries, source-version validation, and the saved result.

create table public.ai_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  request_id uuid not null,
  request_body jsonb not null,
  proposal jsonb not null,
  sources jsonb not null default '{}',
  actions jsonb not null,
  dependencies jsonb not null default '{}',
  status text not null default 'processing' check (status in ('processing', 'completed')),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, request_id)
);

alter table public.ai_operations enable row level security;
grant all on public.ai_operations to service_role;

alter function public.check_review_sources(jsonb) rename to check_ai_sources;

create or replace function public.apply_ai_operation(
  p_request uuid,
  p_request_body jsonb,
  p_proposal jsonb,
  p_sources jsonb,
  p_actions jsonb
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  existing ai_operations;
  action jsonb;
  source_id text;
  dependencies jsonb := '{}';
  results jsonb := '[]';
  operation_id uuid;
begin
  if not account_active() then
    raise exception 'UNAUTHENTICATED_OR_DELETING';
  end if;

  if p_request is null then
    raise exception 'INVALID_REQUEST';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_request::text, 0));

  select * into existing
  from ai_operations
  where user_id=auth.uid() and request_id=p_request;

  if found then
    if existing.request_body is distinct from p_request_body then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;

    if existing.status='completed' and existing.result is not null then
      return existing.result;
    end if;

    raise exception 'OPERATION_INCOMPLETE';
  end if;

  if jsonb_typeof(p_sources) is distinct from 'object'
    or jsonb_typeof(p_actions) is distinct from 'array'
    or jsonb_array_length(p_actions) not between 1 and 10 then
    raise exception 'INVALID_ACTIONS';
  end if;

  for action in select value from jsonb_array_elements(p_actions) loop
    if (action->>'expectedVersion')::integer > 0 then
      source_id := action->'record'->>'id';

      if not (p_sources ? source_id)
        or (p_sources->source_id->>'version')::integer <> (action->>'expectedVersion')::integer then
        raise exception 'CONFLICT';
      end if;

      dependencies := dependencies || jsonb_build_object(source_id, (action->>'expectedVersion')::integer);
    elsif exists(select 1 from reminders where id=(action->'record'->>'id')::uuid)
      or exists(select 1 from contexts where id=(action->'record'->>'id')::uuid) then
      raise exception 'CONFLICT';
    end if;

    source_id := action->'record'->'content'->>'templateId';

    if source_id is not null then
      if not (p_sources ? source_id) then
        raise exception 'INVALID_TEMPLATE';
      end if;

      dependencies := dependencies || jsonb_build_object(source_id, (p_sources->source_id->>'version')::integer);
    end if;
  end loop;

  perform check_ai_sources(dependencies);

  insert into ai_operations(user_id, request_id, request_body, proposal, sources, actions, dependencies)
  values(auth.uid(), p_request, p_request_body, p_proposal, p_sources, p_actions, dependencies)
  returning id into operation_id;

  for action in select value from jsonb_array_elements(p_actions) loop
    results := results || jsonb_build_array(
      save_record(
        (action->>'operationId')::uuid,
        action->'record',
        (action->>'expectedVersion')::integer
      )
    );
  end loop;

  update ai_operations
  set status='completed', result=results, completed_at=now()
  where id=operation_id;

  return results;
end $$;

revoke all on function public.apply_ai_operation(uuid,jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.apply_ai_operation(uuid,jsonb,jsonb,jsonb,jsonb) to authenticated;

drop function if exists public.prepare_proposal(uuid,uuid,jsonb,jsonb);
drop function if exists public.apply_proposal(uuid);
drop table public.ai_proposals;
drop table public.ai_reviews;
