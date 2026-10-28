-- NEW Pond Companion project only. Do not run in the trading app project.
-- Local pilot does not yet sync; this schema prepares the authenticated backend.
begin;
create table public.organizations (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0), created_at timestamptz not null default now()
);
create table public.memberships (
 organization_id uuid not null references public.organizations(id), user_id uuid not null references auth.users(id), role text not null check(role in ('owner','manager','worker','consultant')), primary key(organization_id,user_id)
);
create function public.is_member(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid());
$$;
create function public.can_write(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid() and m.role in ('owner','manager','worker'));
$$;
create function public.can_manage(org uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.organization_id=org and m.user_id=auth.uid() and m.role in ('owner','manager'));
$$;
create function public.create_organization(org_name text) returns uuid language plpgsql security definer set search_path='' as $$
 declare org uuid;
 begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 insert into public.organizations(name) values(org_name) returning id into org;
 insert into public.memberships values(org,auth.uid(),'owner');
 return org;
 end;
$$;
revoke all on function public.is_member(uuid),public.can_write(uuid),public.can_manage(uuid),public.create_organization(text) from public;
grant execute on function public.is_member(uuid),public.can_write(uuid),public.can_manage(uuid),public.create_organization(text) to authenticated;
create table public.ponds (
 id uuid primary key, organization_id uuid not null references public.organizations(id), name text not null, location text not null, area_acres numeric not null check(area_acres>0), water_type text not null check(water_type in ('fresh','brackish')), report_interval_days integer check(report_interval_days between 1 and 365), created_at timestamptz not null default now(), unique(id,organization_id)
);
create table public.cycles (
 id uuid primary key, organization_id uuid not null references public.organizations(id), pond_id uuid not null, name text not null, start_date date not null, closed_at timestamptz,
 unique(id,organization_id,pond_id), unique(id,organization_id), foreign key(pond_id,organization_id) references public.ponds(id,organization_id)
);
create unique index one_active_cycle_per_pond on public.cycles(pond_id) where closed_at is null;
create table public.stocking (
 id uuid primary key, organization_id uuid not null references public.organizations(id), cycle_id uuid not null, species text not null check(length(trim(species))>0), category text not null check(category in ('fish','prawn')), stocked_on date not null, quantity integer not null check(quantity>0), average_grams numeric not null default 0 check(average_grams>=0), seed_cost numeric not null default 0 check(seed_cost>=0), supplier text not null default '', foreign key(cycle_id,organization_id) references public.cycles(id,organization_id)
);
create table public.entries (
 id uuid primary key, organization_id uuid not null references public.organizations(id), pond_id uuid not null, cycle_id uuid not null, kind text not null check(kind in ('feed','treatment','water','observation','expense','harvest','growth')), occurred_on date not null, created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id), product text not null default '', quantity numeric check(quantity>0), unit text not null default 'kg', cost numeric not null default 0 check(cost>=0), revenue numeric not null default 0 check(revenue>=0), species text not null default '', notes text not null default '', is_lab_report boolean not null default false,
 check(kind not in ('feed','treatment','harvest','growth') or quantity is not null), check(kind<>'treatment' or length(trim(product))>0), check(not is_lab_report or kind='water'),
 foreign key(cycle_id,organization_id,pond_id) references public.cycles(id,organization_id,pond_id), unique(id,organization_id)
);
create table public.water_readings (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id), entry_id uuid not null, parameter text not null check(parameter in ('ph','oxygen','temperature','ammonia','nitrite','alkalinity','salinity')), value numeric not null check(value>=0), unit text not null, source text not null check(source in ('manual','lab','device')), measured_at timestamptz not null,
 check(parameter<>'ph' or value<=14), foreign key(entry_id,organization_id) references public.entries(id,organization_id)
);
create table public.attachments (
 id uuid primary key, organization_id uuid not null references public.organizations(id), entry_id uuid not null, object_path text not null unique, filename text not null, mime_type text not null, created_at timestamptz not null default now(), foreign key(entry_id,organization_id) references public.entries(id,organization_id), check(split_part(object_path,'/',1)=organization_id::text)
);
create table public.audit_events (
 id bigint generated always as identity primary key, organization_id uuid not null, actor_id uuid, table_name text not null, row_id uuid not null, operation text not null, previous_data jsonb, new_data jsonb, happened_at timestamptz not null default now()
);
create function public.audit_record() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.audit_events(organization_id,actor_id,table_name,row_id,operation,previous_data,new_data)
 values(new.organization_id,auth.uid(),tg_table_name,new.id,tg_op,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
 end;
$$;
create function public.validate_crop_record() returns trigger language plpgsql set search_path='' as $$
 declare c public.cycles; d date;
 begin
 select * into c from public.cycles where id=new.cycle_id and organization_id=new.organization_id;
 if c.id is null or c.closed_at is not null then raise exception 'Active crop required'; end if;
 if tg_table_name='stocking' then d=new.stocked_on; else d=new.occurred_on; end if;
 if d<c.start_date or d>current_date then raise exception 'Invalid crop record date'; end if;
 return new;
 end;
$$;
create trigger validate_entry before insert on public.entries for each row execute function public.validate_crop_record();
create trigger validate_stocking before insert on public.stocking for each row execute function public.validate_crop_record();
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_events enable row level security;
create policy org_read on public.organizations for select to authenticated using(public.is_member(id));
create policy org_update on public.organizations for update to authenticated using(public.can_manage(id)) with check(public.can_manage(id));
create policy member_read on public.memberships for select to authenticated using(public.is_member(organization_id));
-- Membership writes are intentionally reserved for a future privileged invitation API.
create policy audit_read on public.audit_events for select to authenticated using(public.can_manage(organization_id));
do $$ declare tbl text; begin
 foreach tbl in array array['ponds','cycles','stocking','entries','water_readings','attachments'] loop
 execute format('alter table public.%I enable row level security',tbl);
 execute format('create policy member_read on public.%I for select to authenticated using(public.is_member(organization_id))',tbl);
 if tbl in ('ponds','cycles','stocking') then
 execute format('create policy manager_insert on public.%I for insert to authenticated with check(public.can_manage(organization_id))',tbl);
 else
 execute format('create policy worker_insert on public.%I for insert to authenticated with check(public.can_write(organization_id))',tbl);
 end if;
 if tbl in ('ponds','cycles') then
 execute format('create policy manager_update on public.%I for update to authenticated using(public.can_manage(organization_id)) with check(public.can_manage(organization_id))',tbl);
 end if;
 execute format('create trigger audit_changes after insert or update on public.%I for each row execute function public.audit_record()',tbl);
 execute format('create index on public.%I(organization_id)',tbl);
 end loop;
end $$;
create policy entry_actor on public.entries as restrictive for insert to authenticated with check(created_by=auth.uid());
-- Entries/stocking/readings are append-only in this first schema. No delete permissions.
create index entries_crop_date on public.entries(cycle_id,occurred_on desc);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('pond-documents','pond-documents',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf']);
create policy pond_file_read on storage.objects for select to authenticated using(bucket_id='pond-documents' and exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.organization_id::text=split_part(name,'/',1)));
create policy pond_file_insert on storage.objects for insert to authenticated with check(bucket_id='pond-documents' and exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.role in ('owner','manager','worker') and m.organization_id::text=split_part(name,'/',1)));
-- Unique object IDs, no overwrites. Later cleanup must check attachment references.
commit;
