begin;
alter table public.entries
 add column harvested_count bigint check(harvested_count>0),
 add column count_approximate boolean not null default false,
 add column mortality_count bigint check(mortality_count>0),
 add constraint harvest_count_kind check(harvested_count is null or kind='harvest'),
 add constraint mortality_count_kind check(mortality_count is null or (kind='observation' and length(trim(species))>0)),
 add constraint harvest_weight_unit check(kind<>'harvest' or unit in ('kg','tonnes'));
-- Existing rows retain NULL counts: an unknown count is never migrated to zero.
commit;
