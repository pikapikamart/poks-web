-- Rate limits are enforced through a server-only RPC so all API instances share
-- one atomic counter. Subjects support the same user and client key patterns as
-- the API layer without storing credentials.
create table public.api_rate_limits (
 subject text not null check (subject ~ '^[a-z][a-z0-9_-]{0,31}:.{1,200}$'),
 bucket text not null check (bucket ~ '^[a-z][a-z0-9_-]{0,63}$'),
 window_start timestamptz not null,
 count integer not null check (count > 0),
 primary key (subject,bucket,window_start)
);

create index api_rate_limits_window_start on public.api_rate_limits(window_start);

alter table public.api_rate_limits enable row level security;
grant all on public.api_rate_limits to service_role;

create function public.consume_api_rate(
 p_subject text,
 p_bucket text,
 p_limit integer,
 p_window_seconds integer
) returns table(
 allowed boolean,
 request_limit integer,
 remaining integer,
 reset_at timestamptz
) language plpgsql security definer set search_path=public as $$
declare
 current_window timestamptz;
 current_count integer;
begin
 if p_subject !~ '^[a-z][a-z0-9_-]{0,31}:.{1,200}$'
  or p_bucket !~ '^[a-z][a-z0-9_-]{0,63}$'
  or p_limit not between 1 and 1000
  or p_window_seconds not between 1 and 86400 then
  raise exception 'INVALID_RATE_LIMIT';
 end if;

 current_window := to_timestamp(
  floor(extract(epoch from clock_timestamp()) / p_window_seconds)
  * p_window_seconds
 );

 delete from public.api_rate_limits
 where window_start < current_window - interval '2 days';

 insert into public.api_rate_limits(subject,bucket,window_start,count)
 values(p_subject,p_bucket,current_window,1)
 on conflict(subject,bucket,window_start)
 do update set count=api_rate_limits.count+1
 returning count into current_count;

 return query select
  current_count <= p_limit,
  p_limit,
  greatest(p_limit-current_count,0),
  current_window + make_interval(secs => p_window_seconds);
end $$;

revoke all on function public.consume_api_rate(text,text,integer,integer)
 from public,anon,authenticated;
grant execute on function public.consume_api_rate(text,text,integer,integer)
 to service_role;

drop function public.consume_rate(uuid,text,integer);
drop table public.rate_limits;
