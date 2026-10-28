begin;
create table public.worker_invites (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 worker_name text not null check(length(worker_name) between 1 and 100),
 code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),
 pond_ids uuid[] not null, expires_at timestamptz not null default now()+interval '7 days',
 accepted_by uuid references auth.users(id), revoked boolean not null default false
);
alter table public.worker_invites enable row level security;
revoke all on public.worker_invites from anon, authenticated;
create function public.team_read(org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.can_manage(org) then raise exception 'Admin required'; end if;
 return jsonb_build_object('workers',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce((select i.worker_name from public.worker_invites i where i.organization_id=org and i.accepted_by=m.user_id order by i.expires_at desc limit 1),'Worker'),'ponds',coalesce((select jsonb_agg(a.pond_id) from public.pond_assignments a where a.organization_id=org and a.user_id=m.user_id),'[]'::jsonb))) from public.memberships m where m.organization_id=org and m.role='worker'),'[]'::jsonb),
 'invites',coalesce((select jsonb_agg(to_jsonb(i)) from public.worker_invites i where i.organization_id=org and i.accepted_by is null and not i.revoked and i.expires_at>now()),'[]'::jsonb));
end $$;
create function public.create_worker_invite(org uuid, worker_name text, ponds uuid[]) returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if not public.can_manage(org) then raise exception 'Admin required'; end if;
 if length(trim(worker_name)) not between 1 and 100 or coalesce(cardinality(ponds),0)=0 then raise exception 'Name and ponds required'; end if;
 if exists(select 1 from unnest(ponds) p where not exists(select 1 from public.ponds where id=p and organization_id=org)) then raise exception 'Wrong pond'; end if;
 insert into public.worker_invites(organization_id,worker_name,pond_ids) values(org,trim(worker_name),ponds) returning code into result;
 return result;
end $$;
create function public.join_worker_farm(invite_code text) returns uuid language plpgsql security definer set search_path='' as $$
declare invitation public.worker_invites;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into invitation from public.worker_invites where code=upper(regexp_replace(invite_code,'[^a-zA-Z0-9]','','g')) for update;
 if not found or invitation.revoked or invitation.expires_at<=now() or invitation.accepted_by is not null then raise exception 'Invitation unavailable'; end if;
 perform 1 from public.organizations where id=invitation.organization_id for update;
 if exists(select 1 from public.memberships where organization_id=invitation.organization_id and user_id=auth.uid()) then raise exception 'Already a member'; end if;
 insert into public.memberships values(invitation.organization_id,auth.uid(),'worker');
 insert into public.pond_assignments select invitation.organization_id,p,auth.uid() from (select distinct unnest(invitation.pond_ids) p) x;
 update public.worker_invites set accepted_by=auth.uid() where id=invitation.id;
 update public.organizations set revision=revision+1 where id=invitation.organization_id;
 return invitation.organization_id;
end $$;
create function public.revoke_worker_invite(org uuid, invitation uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_manage(org) then raise exception 'Admin required'; end if;
 update public.worker_invites set revoked=true where id=invitation and organization_id=org and accepted_by is null;
end $$;
create function public.remove_worker(org uuid, worker uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_manage(org) then raise exception 'Admin required'; end if;
 perform 1 from public.organizations where id=org for update;
 if not exists(select 1 from public.memberships where organization_id=org and user_id=worker and role='worker') then raise exception 'Worker required'; end if;
 delete from public.pond_assignments where organization_id=org and user_id=worker;
 delete from public.memberships where organization_id=org and user_id=worker and role='worker';
 update public.organizations set revision=revision+1 where id=org;
end $$;
revoke all on function public.team_read(uuid),public.create_worker_invite(uuid,text,uuid[]),public.join_worker_farm(text),public.revoke_worker_invite(uuid,uuid),public.remove_worker(uuid,uuid) from public,anon;
grant execute on function public.team_read(uuid),public.create_worker_invite(uuid,text,uuid[]),public.join_worker_farm(text),public.revoke_worker_invite(uuid,uuid),public.remove_worker(uuid,uuid) to authenticated;
commit;
