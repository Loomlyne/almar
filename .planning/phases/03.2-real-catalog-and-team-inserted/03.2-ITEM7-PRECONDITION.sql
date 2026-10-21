-- Follow-ups item 7: live precondition for 20261019130000_ops_save_publish_rules.sql
-- Read-only. For the ALMAR controller to run on live "Almar" jkdkaldgeiowkhlfmsft (job 19 did not run it).
-- Rule (decisions/2026-10-19-item7-destinations-first.md): apply the migration only when all three counts are 0.
-- Run inside a read-only transaction so nothing can write:
--   begin transaction read only; <the queries>; rollback;

begin transaction read only;

-- 1. The three gate counts. Every number must be 0. (2026-10-19 15:00: 24 / 0 / 0, of 45 published items.)
select
  (select count(*) from public.catalog_items c
     where c.is_published
       and not exists (select 1 from public.catalog_item_destinations cd where cd.item_id = c.id))
    as published_items_without_destination,
  (select count(*) from public.catalog_items c
     where c.is_published and c.media_id is null)
    as published_items_without_photo,
  (select count(*) from public.destinations d
     where d.is_published and d.hero_media_id is null)
    as published_destinations_without_hero,
  (select count(*) from public.catalog_items c where c.is_published)
    as published_items_total;

-- 2. If count 1 is above 0: which items, by English name, so the owner knows what to fix in the dashboard.
select c.kind, coalesce(t.name, c.slug) as name_en, c.slug
from public.catalog_items c
left join public.catalog_translations t on t.item_id = c.id and t.locale = 'en'
where c.is_published
  and not exists (select 1 from public.catalog_item_destinations cd where cd.item_id = c.id)
order by c.kind, name_en;

rollback;
