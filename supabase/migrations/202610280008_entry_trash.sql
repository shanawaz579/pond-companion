begin;
create table public.entry_trash (
 entry_id uuid primary key, organization_id uuid not null,
 deleted_at timestamptz not null default now(), deleted_by uuid not null references auth.users(id),
 foreign key(entry_id,organization_id) references public.entries(id,organization_id)
);
alter table public.entry_trash enable row level security;
revoke all on public.entry_trash from public, anon, authenticated;
create function public.check_live_stock(org uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(with events as (
 select s.cycle_id,s.species,s.stocked_on as d,s.quantity::bigint as n from public.stocking s where s.organization_id=org
 union all select ev.cycle_id,ev.species,ev.occurred_on,-coalesce(ev.harvested_count,ev.mortality_count,0)::bigint from public.entries ev where ev.organization_id=org and not exists(select 1 from public.entry_trash t where t.entry_id=ev.id)
 ), daily as (select cycle_id,species,d,sum(n) n from events group by cycle_id,species,d), balances as (select sum(n) over(partition by cycle_id,species order by d) n from daily) select 1 from balances where n<0) then raise exception 'Stock count exceeded'; end if;
end $$;
revoke all on function public.check_live_stock(uuid) from public, anon, authenticated;
create function public.entry_trash_list(org uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.can_manage(org) then raise exception 'Admin required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'date',e.occurred_on,'pond',p.name,'product',e.product,'notes',e.notes,'deleted_at',t.deleted_at) order by t.deleted_at desc) from public.entry_trash t join public.entries e on e.id=t.entry_id join public.ponds p on p.id=e.pond_id where t.organization_id=org),'[]'::jsonb);
end $$;
create function public.set_entry_trashed(org uuid, entry uuid, trashed boolean, expected_revision bigint) returns void language plpgsql security definer set search_path='' as $$
declare revision_now bigint;
begin
 if not public.can_manage(org) then raise exception 'Admin required'; end if;
 select revision into revision_now from public.organizations where id=org for update;
 if expected_revision is null or revision_now<>expected_revision then raise exception 'FARM_CONFLICT'; end if;
 if trashed is null or not exists(select 1 from public.entries where id=entry and organization_id=org) then raise exception 'Entry not found'; end if;
 if trashed then
   insert into public.entry_trash(entry_id,organization_id,deleted_by) values(entry,org,auth.uid()) on conflict do nothing;
 else
   delete from public.entry_trash where entry_id=entry and organization_id=org;
 end if;
 perform public.check_live_stock(org);
 insert into public.audit_events(organization_id,actor_id,table_name,row_id,operation) values(org,auth.uid(),'entries',entry,case when trashed then 'TRASH' else 'RESTORE' end);
 update public.organizations set revision=revision+1 where id=org;
end $$;
revoke all on function public.entry_trash_list(uuid),public.set_entry_trashed(uuid,uuid,boolean,bigint) from public,anon;
grant execute on function public.entry_trash_list(uuid),public.set_entry_trashed(uuid,uuid,boolean,bigint) to authenticated;
create or replace function public.farm_read(org uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; admin boolean:=public.can_manage(org); begin
 if not public.is_member(org) then raise exception 'Access denied'; end if;
 select jsonb_build_object('name',o.name,'revision',o.revision,'role',case when admin then 'admin' else 'worker' end) into result from public.organizations o where id=org;
 return result || jsonb_build_object(
 'ponds',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.ponds p where p.organization_id=org and public.can_access_pond(org,p.id)),
 'cycles',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from public.cycles c where c.organization_id=org and public.can_access_pond(org,c.pond_id)),
 'stocking',(select coalesce(jsonb_agg(case when admin then to_jsonb(s) else to_jsonb(s)-'seed_cost'-'supplier' end order by s.stocked_on,s.id),'[]') from public.stocking s join public.cycles c on c.id=s.cycle_id where s.organization_id=org and public.can_access_pond(org,c.pond_id)),
 'entries',(select coalesce(jsonb_agg(case when admin then to_jsonb(e) else to_jsonb(e)-'cost'-'revenue' end order by e.created_at,e.id),'[]') from public.entries e where e.organization_id=org and not exists(select 1 from public.entry_trash t where t.entry_id=e.id) and public.can_access_pond(org,e.pond_id) and (admin or e.kind<>'expense')),
 'water_readings',(select coalesce(jsonb_agg(to_jsonb(w)),'[]') from public.water_readings w join public.entries e on e.id=w.entry_id where w.organization_id=org and not exists(select 1 from public.entry_trash t where t.entry_id=e.id) and public.can_access_pond(org,e.pond_id)),
 'attachments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.attachments a join public.entries e on e.id=a.entry_id where a.organization_id=org and not exists(select 1 from public.entry_trash t where t.entry_id=e.id) and public.can_access_pond(org,e.pond_id) and (admin or e.kind<>'expense')),
 'farm_expenses',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.farm_expenses e where e.organization_id=org and admin),
 'expense_attachments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.expense_attachments a where a.organization_id=org and admin),
 'species_catalog',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.species_catalog s where s.organization_id=org),
 'feed_products',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.feed_products f where f.organization_id=org));
end $$;
create or replace function public.farm_save(org uuid, expected_revision bigint, changes jsonb) returns bigint language plpgsql security definer set search_path='' as $$
declare current_rev bigint; admin boolean:=public.can_manage(org); row jsonb; tbl text; c public.cycles; e public.entries; target uuid; new_rev bigint;
begin
 if not public.can_write(org) then raise exception 'Access denied'; end if;
 select revision into current_rev from public.organizations where id=org for update;
 if current_rev<>expected_revision then raise exception 'FARM_CONFLICT'; end if;
 if not admin and (changes ? 'name' or jsonb_array_length(coalesce(changes->'ponds','[]'))>0 or jsonb_array_length(coalesce(changes->'cycles','[]'))>0 or jsonb_array_length(coalesce(changes->'stocking','[]'))>0 or jsonb_array_length(coalesce(changes->'farm_expenses','[]'))>0 or jsonb_array_length(coalesce(changes->'expense_attachments','[]'))>0) then raise exception 'Admin required'; end if;
 if changes ? 'name' then update public.organizations set name=changes->>'name' where id=org; end if;
 for row in select value from jsonb_array_elements(coalesce(changes->'ponds','[]')) loop
  insert into public.ponds(id,organization_id,name,location,area_acres,water_type,report_interval_days,created_at)
  values((row->>'id')::uuid,org,row->>'name',row->>'location',(row->>'area_acres')::numeric,row->>'water_type',(row->>'report_interval_days')::int,coalesce((row->>'created_at')::timestamptz,now()))
  on conflict(id) do update set name=excluded.name,location=excluded.location,area_acres=excluded.area_acres,water_type=excluded.water_type,report_interval_days=excluded.report_interval_days where ponds.organization_id=org;
  if not found then raise exception 'Wrong farm'; end if;
 end loop;
 for row in select value from jsonb_array_elements(coalesce(changes->'cycles','[]')) loop
  select * into c from public.cycles where id=(row->>'id')::uuid;
  if found then
   if c.organization_id<>org or c.pond_id<>(row->>'pond_id')::uuid or c.start_date<>(row->>'start_date')::date or c.name<>row->>'name' or c.closed_at is not null then raise exception 'Invalid culture change'; end if;
  else
   insert into public.cycles(id,organization_id,pond_id,name,start_date,closed_at) values((row->>'id')::uuid,org,(row->>'pond_id')::uuid,row->>'name',(row->>'start_date')::date,(row->>'closed_at')::timestamptz);
  end if;
 end loop;
 foreach tbl in array array['stocking','entries','water_readings','attachments','farm_expenses','expense_attachments','species_catalog','feed_products'] loop
  for row in select value from jsonb_array_elements(coalesce(changes->tbl,'[]')) loop
   row := row || jsonb_build_object('organization_id',org);
   if tbl in ('entries','farm_expenses') then row:=row||jsonb_build_object('created_by',auth.uid(),'created_at',case when admin then least(coalesce((row->>'created_at')::timestamptz,now()),now()) else now() end); end if;
   if tbl='entries' then
    if not public.can_access_pond(org,(row->>'pond_id')::uuid) then raise exception 'Pond not assigned'; end if;
    if not admin and (row->>'kind' not in ('feed','treatment','water','observation','growth') or coalesce((row->>'cost')::numeric,0)<>0 or coalesce((row->>'revenue')::numeric,0)<>0) then raise exception 'Admin required'; end if;
   end if;
   if tbl in ('water_readings','attachments') then
    select * into e from public.entries where id=(row->>'entry_id')::uuid and organization_id=org;
    if e.id is null or not public.can_access_pond(org,e.pond_id) or (not admin and (e.created_by<>auth.uid() or e.kind='expense')) then raise exception 'Invalid entry'; end if;
   end if;
   if tbl='attachments' and row->>'object_path' not like org::text||'/entries/'||e.pond_id::text||'/%' then raise exception 'Invalid file path'; end if;
   if tbl='expense_attachments' and row->>'object_path' not like org::text||'/expenses/%' then raise exception 'Invalid receipt path'; end if;
   if tbl='farm_expenses' and ((row->>'occurred_on')::date>current_date or ((row->>'cycle_id') is not null and not exists(select 1 from public.cycles x where x.id=(row->>'cycle_id')::uuid and (row->>'occurred_on')::date>=x.start_date and (x.closed_at is null or (row->>'occurred_on')::date<=x.closed_at::date)))) then raise exception 'Invalid expense date'; end if;
   execute format('insert into public.%I select * from jsonb_populate_record(null::public.%I,$1)',tbl,tbl) using row;
  end loop;
 end loop;
 -- Known removals may never exceed stock available on their date (including backdated writes).
 perform public.check_live_stock(org);
 for row in select value from jsonb_array_elements(coalesce(changes->'cycles','[]')) loop
  if row->>'closed_at' is not null then update public.cycles set closed_at=(row->>'closed_at')::timestamptz where id=(row->>'id')::uuid and organization_id=org; end if;
 end loop;
 update public.organizations set revision=revision+1 where id=org returning revision into new_rev;
 return new_rev;
end $$;
create or replace function public.can_read_pond_file(path text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.attachments a join public.entries e on e.id=a.entry_id where a.object_path=path and public.can_access_pond(a.organization_id,e.pond_id) and (public.can_manage(a.organization_id) or not exists(select 1 from public.entry_trash t where t.entry_id=e.id)) and (e.kind<>'expense' or public.can_manage(a.organization_id))) or exists(select 1 from public.expense_attachments a where a.object_path=path and public.can_manage(a.organization_id));
$$;
commit;
