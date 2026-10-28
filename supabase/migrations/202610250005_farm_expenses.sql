begin;
create table public.farm_expenses (
 id uuid primary key, organization_id uuid not null references public.organizations(id),
 pond_id uuid, cycle_id uuid, category text not null, occurred_on date not null,
 amount numeric not null check(amount>0), notes text not null default '',
 created_at timestamptz not null default now(), created_by uuid not null default auth.uid() references auth.users(id),
 unique(id,organization_id), check(cycle_id is null or pond_id is not null),
 foreign key(pond_id,organization_id) references public.ponds(id,organization_id),
 foreign key(cycle_id,organization_id,pond_id) references public.cycles(id,organization_id,pond_id)
);
alter table public.farm_expenses enable row level security;
create policy expenses_read on public.farm_expenses for select to authenticated using(public.is_member(organization_id));
create policy expenses_insert on public.farm_expenses for insert to authenticated with check(public.can_write(organization_id) and created_by=auth.uid());
create trigger audit_expenses after insert on public.farm_expenses for each row execute function public.audit_record();
create table public.expense_attachments (
 id uuid primary key, organization_id uuid not null references public.organizations(id), expense_id uuid not null,
 object_path text not null unique, filename text not null, mime_type text not null,
 foreign key(expense_id,organization_id) references public.farm_expenses(id,organization_id),
 check(split_part(object_path,'/',1)=organization_id::text)
);
alter table public.expense_attachments enable row level security;
create policy expense_files_read on public.expense_attachments for select to authenticated using(public.is_member(organization_id));
create policy expense_files_insert on public.expense_attachments for insert to authenticated with check(public.can_write(organization_id));
commit;
