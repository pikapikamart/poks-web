create function public.validate_profile() returns trigger language plpgsql set search_path=public as $$ declare p jsonb; begin
 p:=new.preferences;
 if not(p ?& array['timeZone','quietStart','quietEnd','intensity','snoozeMinutes','repeatMinutes','defaultDateHour']) then raise exception 'INVALID_PREFERENCES'; end if;
 if not exists(select 1 from pg_timezone_names where name=p->>'timeZone') then raise exception 'INVALID_TIMEZONE'; end if;
 if coalesce(p->>'intensity','') not in ('subtle','normal') or (p->>'snoozeMinutes')::int not between 1 and 1440 or (p->>'repeatMinutes')::int not between 0 and 1440 then raise exception 'INVALID_PREFERENCES'; end if;
 if (p->>'quietStart')::int not between 0 and 23 or (p->>'quietEnd')::int not between 0 and 23 or (p->>'defaultDateHour')::int not between 0 and 23 then raise exception 'INVALID_PREFERENCES'; end if;
 if (p->>'quietStart' is null)<>(p->>'quietEnd' is null) then raise exception 'INVALID_QUIET_HOURS'; end if;
 return new;end $$;
create trigger profiles_validate before insert or update on profiles for each row execute function validate_profile();
create function public.preferences_reschedule() returns trigger language plpgsql security definer set search_path=public as $$ begin
 if old.preferences is distinct from new.preferences then
  update records set version=version+1,updated_at=now() where not deleted and kind<>'context' and (owner_id=new.id or space_id in(select space_id from members where user_id=new.id));
  insert into outbox(record_id,revision) select id,version from records where not deleted and kind<>'context' and (owner_id=new.id or space_id in(select space_id from members where user_id=new.id)) on conflict do nothing;
 end if;return new;end $$;
create trigger profiles_reschedule after update on profiles for each row execute function preferences_reschedule();
