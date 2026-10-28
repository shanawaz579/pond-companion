begin;
alter table public.entries add column bag_weight_kg numeric check(bag_weight_kg>0),
 add constraint feed_weight_unit check(kind<>'feed' or unit in ('kg','bag')),
 add constraint feed_bag_weight check(kind<>'feed' or unit<>'bag' or bag_weight_kg is not null);
create table public.feed_products (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 name text not null check(length(trim(name))>0), created_at timestamptz not null default now()
);
create unique index feed_products_unique_name on public.feed_products(organization_id,lower(regexp_replace(trim(name),'\s+',' ','g')));
alter table public.feed_products enable row level security;
create policy feed_products_read on public.feed_products for select to authenticated using(public.is_member(organization_id));
create policy feed_products_insert on public.feed_products for insert to authenticated with check(public.can_write(organization_id));
create trigger audit_feed_products after insert on public.feed_products for each row execute function public.audit_record();
commit;
