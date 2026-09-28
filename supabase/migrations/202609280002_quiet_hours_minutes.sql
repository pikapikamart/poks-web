alter table public.profiles
  alter column preferences set default '{"timeZone":"UTC","quietStart":null,"quietStartMinute":0,"quietEnd":null,"quietEndMinute":0,"intensity":"normal","snoozeMinutes":10,"repeatMinutes":0,"defaultDateHour":null}'::jsonb;

create or replace function public.validate_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  p jsonb := new.preferences;
  k text;
  n numeric;
begin
  if jsonb_typeof(p) is distinct from 'object'
    or jsonb_typeof(p->'timeZone') is distinct from 'string'
    or not exists(select 1 from pg_timezone_names where name = p->>'timeZone') then
    raise exception 'INVALID_TIMEZONE';
  end if;

  if jsonb_typeof(p->'intensity') is distinct from 'string'
    or p->>'intensity' not in ('subtle', 'normal') then
    raise exception 'INVALID_PREFERENCES';
  end if;

  foreach k in array array[
    'snoozeMinutes', 'repeatMinutes', 'quietStart', 'quietEnd', 'defaultDateHour',
    'quietStartMinute', 'quietEndMinute'
  ] loop
    if not (p ? k) then
      if k in ('quietStartMinute', 'quietEndMinute') then
        continue;
      end if;

      raise exception 'INVALID_PREFERENCES';
    end if;

    if k in ('quietStart', 'quietEnd', 'defaultDateHour') and p->k = 'null'::jsonb then
      continue;
    end if;

    if jsonb_typeof(p->k) is distinct from 'number' then
      raise exception 'INVALID_PREFERENCES';
    end if;

    n := (p->>k)::numeric;

    if n <> trunc(n)
      or n < (case when k = 'snoozeMinutes' then 1 else 0 end)
      or n > (case
        when k in ('snoozeMinutes', 'repeatMinutes') then 1440
        when k in ('quietStartMinute', 'quietEndMinute') then 59
        else 23
      end) then
      raise exception 'INVALID_PREFERENCES';
    end if;
  end loop;

  if (p->>'quietStart' is null) <> (p->>'quietEnd' is null) then
    raise exception 'INVALID_QUIET_HOURS';
  end if;

  return new;
end;
$$;
