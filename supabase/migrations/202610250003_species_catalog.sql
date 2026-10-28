begin;
create table public.species_catalog (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name))>0),
 category text not null check(category in ('fish','prawn')),
 created_at timestamptz not null default now()
);
create unique index species_catalog_unique_name on public.species_catalog(organization_id,category,lower(regexp_replace(trim(name),'\s+',' ','g')));
alter table public.species_catalog enable row level security;
create policy species_read on public.species_catalog for select to authenticated using(public.is_member(organization_id));
create policy species_insert on public.species_catalog for insert to authenticated with check(public.can_write(organization_id));
create trigger audit_species after insert on public.species_catalog for each row execute function public.audit_record();
commit;
