create table public.recurrences (parent_id uuid primary key references public.records on delete cascade,next_id uuid unique references public.records on delete set null);
alter table recurrences enable row level security;
grant all on recurrences to service_role;
create function public.spawn_occurrence(p_parent uuid,p_revision int,p_content jsonb) returns uuid language plpgsql security definer set search_path=public as $$ declare r records; nid uuid; begin
 select * into r from records where id=p_parent for update;
 if not found or r.version<>p_revision or r.deleted or (r.content->>'archived')::boolean then return null; end if;
 select next_id into nid from recurrences where parent_id=p_parent;
 if found then return nid; end if;
 nid:=gen_random_uuid();
 insert into records(id,owner_id,space_id,kind,content) values(nid,r.owner_id,r.space_id,r.kind,p_content);
 insert into recurrences values(p_parent,nid);
 insert into outbox(record_id,revision) values(nid,1);return nid; end $$;
revoke all on function public.spawn_occurrence(uuid,int,jsonb) from public;
grant execute on function public.spawn_occurrence(uuid,int,jsonb) to service_role;
