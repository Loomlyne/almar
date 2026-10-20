-- pgTAP: follow-up 7 (PR #18 review), migration 20261019130000_ops_save_publish_rules.sql. A Save of a published
-- destination or catalog item that would leave it without what ops_publish requires (the hero photo; the photo and at
-- least one destination) is refused as almar:invalid with that field, and the whole save rolls back. A draft row is
-- saved as before, and so is a published row that keeps its photo and a destination. Rows use the zz7 prefix.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into public.media (id, key, width, height, bytes, sha256, source) values
  ('00000000-0000-4000-8000-0000000007a1', 'zz7/hero.webp', 1600, 1000, 100, repeat('7', 64), 'import');
insert into public.destinations (id, slug, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000007d1', 'zz7-live-destination', '00000000-0000-4000-8000-0000000007a1', true, 9701),
  ('00000000-0000-4000-8000-0000000007d2', 'zz7-draft-destination', null, false, 9702),
  ('00000000-0000-4000-8000-0000000007d3', 'zz7-other-destination', '00000000-0000-4000-8000-0000000007a1', true, 9703);
insert into public.destination_translations (destination_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000007d1', 'en', 'published', 'Live destination'),
  ('00000000-0000-4000-8000-0000000007d2', 'en', 'draft', 'Draft destination'),
  ('00000000-0000-4000-8000-0000000007d3', 'en', 'published', 'Other destination');
insert into public.catalog_items (id, slug, kind, unit, price_aed, media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000007c1', 'zz7-live-item', 'experience', 'person', 250.00, '00000000-0000-4000-8000-0000000007a1', true, 9701),
  ('00000000-0000-4000-8000-0000000007c2', 'zz7-draft-item', 'experience', 'person', null, null, false, 9702);
insert into public.catalog_translations (item_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000007c1', 'en', 'published', 'Live item'),
  ('00000000-0000-4000-8000-0000000007c2', 'en', 'draft', 'Draft item');
insert into public.catalog_item_destinations (item_id, destination_id) values
  ('00000000-0000-4000-8000-0000000007c1', '00000000-0000-4000-8000-0000000007d1');

-- The refusal's message and detail, or 'saved' when the call returns.
create function pg_temp.outcome(p_sql text) returns text language plpgsql as $$
declare
  v_message text;
  v_detail text;
begin
  execute p_sql;
  return 'saved';
exception when others then
  get stacked diagnostics v_message = message_text, v_detail = pg_exception_detail;
  return v_message || ' ' || coalesce(v_detail, '');
end;
$$;

-- Destinations ----------------------------------------------------------------------------------------------------------
select is(
  pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000007d1", "hero_media_id": null}'::jsonb)$$),
  'almar:invalid {"field": "hero_media_id", "locale": null}',
  'a published destination cannot be saved without its hero photo');
select is((select hero_media_id from public.destinations where id = '00000000-0000-4000-8000-0000000007d1'), '00000000-0000-4000-8000-0000000007a1'::uuid,
  'the refused save changed nothing');
select is(
  pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000007d1", "hero_media_id": null, "translations": {"en": {"name": "Renamed"}}}'::jsonb)$$),
  'almar:invalid {"field": "hero_media_id", "locale": null}',
  'refused with a text change in the same save');
select is((select name from public.destination_translations where destination_id = '00000000-0000-4000-8000-0000000007d1' and locale = 'en'), 'Live destination',
  'and the text change in it is rolled back too');
select is((public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000007d1", "translations": {"en": {"name": "Live, renamed"}}}'::jsonb)) ->> 'affects_site', 'true',
  'a published destination that keeps its photo is saved as before');
select is((select name from public.destination_translations where destination_id = '00000000-0000-4000-8000-0000000007d1' and locale = 'en'), 'Live, renamed',
  'and its text changed');
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000007d2", "translations": {"en": {"name": "Still a draft"}}}'::jsonb)$$),
  'saved', 'a draft destination without a photo is saved as before');
select is(pg_temp.outcome($$select public.ops_save_destination('{"slug": "zz7-new-destination", "translations": {"en": {"name": "New"}}}'::jsonb)$$),
  'saved', 'a new destination without a photo is created as before (a draft)');
select is((public.ops_publish('destination', '00000000-0000-4000-8000-0000000007d1', false)) ->> 'ok', 'true', 'unpublished');
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000007d1", "hero_media_id": null}'::jsonb)$$),
  'saved', 'once a draft again, its photo can be taken away');
select is((select hero_media_id from public.destinations where id = '00000000-0000-4000-8000-0000000007d1'), null::uuid, 'and it is');

-- Catalog items -----------------------------------------------------------------------------------------------------------
select is(
  pg_temp.outcome($$select public.ops_save_catalog_item('{"id": "00000000-0000-4000-8000-0000000007c1", "media_id": null}'::jsonb)$$),
  'almar:invalid {"field": "media_id", "locale": null}',
  'a published item cannot be saved without its photo');
select is((select media_id from public.catalog_items where id = '00000000-0000-4000-8000-0000000007c1'), '00000000-0000-4000-8000-0000000007a1'::uuid,
  'the refused save changed nothing');
select is(
  pg_temp.outcome($$select public.ops_save_catalog_item('{"id": "00000000-0000-4000-8000-0000000007c1", "destination_ids": []}'::jsonb)$$),
  'almar:invalid {"field": "destination_ids", "locale": null}',
  'a published item cannot lose its last destination');
select is((select count(*)::int from public.catalog_item_destinations where item_id = '00000000-0000-4000-8000-0000000007c1'), 1,
  'its destination link is still there');
select is(
  pg_temp.outcome($$select public.ops_save_catalog_item('{"id": "00000000-0000-4000-8000-0000000007c1", "media_id": null, "destination_ids": [], "price_aed": "300.00"}'::jsonb)$$),
  'almar:invalid {"field": "media_id", "locale": null}',
  'both missing: the photo is named first');
select is((select price_aed from public.catalog_items where id = '00000000-0000-4000-8000-0000000007c1'), 250.00, 'and the price change in it is rolled back');
select is((public.ops_save_catalog_item('{"id": "00000000-0000-4000-8000-0000000007c1", "destination_ids": ["00000000-0000-4000-8000-0000000007d3"]}'::jsonb)) ->> 'affects_site', 'true',
  'a published item may move to another destination');
select is((select array_agg(destination_id) from public.catalog_item_destinations where item_id = '00000000-0000-4000-8000-0000000007c1'),
  array['00000000-0000-4000-8000-0000000007d3'::uuid], 'and it has exactly that one');
select is(pg_temp.outcome($$select public.ops_save_catalog_item('{"id": "00000000-0000-4000-8000-0000000007c1", "price_aed": "275.00"}'::jsonb)$$),
  'saved', 'a published item that keeps its photo and a destination is saved as before');
select is(pg_temp.outcome($$select public.ops_save_catalog_item('{"id": "00000000-0000-4000-8000-0000000007c2", "price_aed": "90.00", "destination_ids": []}'::jsonb)$$),
  'saved', 'a draft item without a photo or a destination is saved as before');
select is(pg_temp.outcome($$select public.ops_save_catalog_item('{"slug": "zz7-new-item", "kind": "service", "unit": "person", "translations": {"en": {"name": "New"}}}'::jsonb)$$),
  'saved', 'a new item without a photo or a destination is created as before (a draft)');
select is((public.ops_publish('catalog_item', '00000000-0000-4000-8000-0000000007c1', false)) ->> 'ok', 'true', 'unpublished');
select is(pg_temp.outcome($$select public.ops_save_catalog_item('{"id": "00000000-0000-4000-8000-0000000007c1", "media_id": null, "destination_ids": []}'::jsonb)$$),
  'saved', 'once a draft again, its photo and destinations can be taken away');

select * from finish();
rollback;
