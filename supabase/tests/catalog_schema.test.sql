-- pgTAP: constraints, the rates rule, the owner functions (plan 03.2-01). Runs as the postgres owner inside one
-- transaction that is rolled back: nothing it creates stays in the database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(96);

-- Fixture rows -----------------------------------------------------------------------------------------------
insert into public.media (id, key, width, height, source) values
  ('00000000-0000-4000-8000-0000000000a1', 'test/hero.webp', 1600, 1000, 'import'),
  ('00000000-0000-4000-8000-0000000000a2', 'test/gallery-1.webp', 1600, 1000, 'import'),
  ('00000000-0000-4000-8000-0000000000a3', 'test/gallery-2.webp', 1600, 1000, 'import'),
  ('00000000-0000-4000-8000-0000000000a4', 'uploads/unused.webp', 800, 600, 'upload');
insert into public.image_translations (image_id, locale, alt, status) values
  ('00000000-0000-4000-8000-0000000000a1', 'en', 'A hero', 'published'),
  ('00000000-0000-4000-8000-0000000000a4', 'en', 'Unused', 'published');

insert into public.destinations (id, slug, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000000d1', 'test-destination', '00000000-0000-4000-8000-0000000000a1', true, 1),
  ('00000000-0000-4000-8000-0000000000d2', 'test-draft-destination', '00000000-0000-4000-8000-0000000000a1', false, 2);
insert into public.destination_translations (destination_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000000d1', 'en', 'published', 'Test destination'),
  ('00000000-0000-4000-8000-0000000000d2', 'en', 'published', 'Draft destination');

insert into public.stays (id, slug, destination_id, base_nightly_rate_aed, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000000e1', 'test-stay-one', '00000000-0000-4000-8000-0000000000d1', 1000, '00000000-0000-4000-8000-0000000000a1', true, 1),
  ('00000000-0000-4000-8000-0000000000e2', 'test-stay-two', '00000000-0000-4000-8000-0000000000d1', null, '00000000-0000-4000-8000-0000000000a1', false, 2);
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000000e1', 'en', 'published', 'Stay one'),
  ('00000000-0000-4000-8000-0000000000e2', 'en', 'published', 'Stay two');

-- Constraints -------------------------------------------------------------------------------------------------
select is((select min_nights from public.stays where id = '00000000-0000-4000-8000-0000000000e1'), 1, 'min_nights defaults to 1');
select throws_ok($$update public.stays set min_nights = 0 where id = '00000000-0000-4000-8000-0000000000e1'$$, '23514', null, 'min_nights 0 is refused');
select is((select base_nightly_rate_aed from public.stays where id = '00000000-0000-4000-8000-0000000000e2'), null, 'a stay with no base rate exists');
select throws_ok($$update public.stays set base_nightly_rate_aed = 0 where id = '00000000-0000-4000-8000-0000000000e1'$$, '23514', null, 'a zero base rate is refused');
select throws_ok($$update public.stays set pets_rule = 'fee' where id = '00000000-0000-4000-8000-0000000000e1'$$, '23514', null, 'pets_rule fee without a fee is refused');
select throws_ok($$update public.stays set pets_rule = 'allowed', pets_fee_aed = 50 where id = '00000000-0000-4000-8000-0000000000e1'$$, '23514', null, 'pets_rule allowed with a fee is refused');
select throws_ok($$update public.stays set pets_fee_aed = 50 where id = '00000000-0000-4000-8000-0000000000e1'$$, '23514', null, 'a fee without any pets_rule is refused');
select lives_ok($$update public.stays set pets_rule = 'fee', pets_fee_aed = 50 where id = '00000000-0000-4000-8000-0000000000e1'$$, 'pets_rule fee with a fee is accepted');
select throws_ok($$insert into public.stays (slug, destination_id) values ('Bad Slug', '00000000-0000-4000-8000-0000000000d1')$$, '23514', null, 'a slug with a capital and a space is refused');
select throws_ok($$insert into public.stays (slug, destination_id, is_sample) values ('sample-without-fields', '00000000-0000-4000-8000-0000000000d1', true)$$, '23514', null, 'is_sample true with no sample_fields is refused');
select throws_ok($$insert into public.availability_blocks (scope, destination_id, stay_id, starts_on, ends_on) values ('stay', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000e1', '2027-01-01', '2027-01-02')$$, '23514', null, 'scope stay with a destination is refused');
select throws_ok($$insert into public.availability_blocks (scope, stay_id, starts_on, ends_on) values ('stay', '00000000-0000-4000-8000-0000000000e1', '2027-01-05', '2027-01-04')$$, '23514', null, 'a block that ends before it starts is refused');
select lives_ok($$insert into public.availability_blocks (scope, stay_id, starts_on, ends_on) values ('stay', '00000000-0000-4000-8000-0000000000e1', '2027-01-04', '2027-01-04')$$, 'a one-day block (same date twice) is accepted');
select throws_ok($$insert into public.media (key) values ('Bad Key.gif')$$, '23514', null, 'a media key outside the allowed shape is refused');
select throws_ok($$insert into public.catalog_items (slug, kind, unit, is_home_pickup) values ('pickup-a', 'service', 'trip', true), ('pickup-b', 'service', 'trip', true)$$, '23505', null, 'two home-pickup items are refused');

-- Seven inclusions --------------------------------------------------------------------------------------------
select is((select count(*)::int from public.inclusions), 7, 'seven inclusions are seeded');
select is((select array_agg(position order by position) from public.inclusions), array[1, 2, 3, 4, 5, 6, 7], 'positions 1 to 7');
select is((select count(*)::int from public.inclusion_translations where locale = 'en' and status = 'published'), 7, 'English labels are published');
select is((select count(*)::int from public.inclusion_translations where locale in ('ar', 'es') and status = 'draft'), 14, 'Arabic and Spanish labels are draft');
select is((select label from public.inclusion_translations t join public.inclusions i on i.id = t.inclusion_id where i.slug = 'airport-meet' and t.locale = 'ar'), 'استقبال المطار', 'the Arabic airport label is the owner-approved text');

-- Rates: same length never overlaps, shortest covering range wins ----------------------------------------------
select lives_ok($$insert into public.stay_rates (stay_id, nights, nightly_rate_aed) values ('00000000-0000-4000-8000-0000000000e1', daterange('2027-03-01', '2027-03-08'), 800)$$, 'a seven-night range is accepted');
select throws_ok($$insert into public.stay_rates (stay_id, nights, nightly_rate_aed) values ('00000000-0000-4000-8000-0000000000e1', daterange('2027-03-05', '2027-03-12'), 900)$$, '23P01', null, 'two seven-night ranges that share a night are refused');
select lives_ok($$insert into public.stay_rates (stay_id, nights, nightly_rate_aed) values ('00000000-0000-4000-8000-0000000000e1', daterange('2027-03-07', '2027-03-08'), 500)$$, 'a one-night range inside the longer one is accepted');
select lives_ok($$insert into public.stay_rates (stay_id, nights, nightly_rate_aed) values ('00000000-0000-4000-8000-0000000000e2', daterange('2027-03-01', '2027-03-08'), 700)$$, 'the same range on another stay is accepted');
select throws_ok($$insert into public.stay_rates (stay_id, nights, nightly_rate_aed) values ('00000000-0000-4000-8000-0000000000e1', 'empty'::daterange, 800)$$, '23514', null, 'an empty range is refused');
select results_eq(
  $$select night::text, nightly_rate_aed::text, source from public.stay_night_rates('00000000-0000-4000-8000-0000000000e1', '2027-03-06', '2027-03-09')$$,
  $$values ('2027-03-06', '800.00', 'range'), ('2027-03-07', '500.00', 'range'), ('2027-03-08', '1000.00', 'base')$$,
  'three nights: the long range, the one-night range, the base rate'
);
select results_eq(
  $$select nightly_rate_aed is null, source is null from public.stay_night_rates('00000000-0000-4000-8000-0000000000e2', '2027-04-01', '2027-04-02')$$,
  $$values (true, true)$$,
  'no base rate and no range: the rate is null'
);
select is((select count(*)::int from public.stay_night_rates('00000000-0000-4000-8000-0000000000e1', '2027-03-06', '2027-03-06')), 0, 'an empty window returns no nights');
select throws_ok(
  $$select public.ops_save_stay_rate('{"stay_id": "00000000-0000-4000-8000-0000000000e1", "first_night": "2027-03-04", "last_night": "2027-03-10", "nightly_rate_aed": "950"}'::jsonb)$$,
  '23P01', 'almar:rate_overlap', 'ops_save_stay_rate maps an overlap to almar:rate_overlap');
select is(
  (select (public.ops_get('stay', '00000000-0000-4000-8000-0000000000e1') ->> 'min_nights')::int), 1, 'ops_get returns the stay detail');
select is(
  (select count(*)::int from public.stay_rates where stay_id = '00000000-0000-4000-8000-0000000000e1'), 2, 'the refused range was not stored');
select is(
  (select (public.ops_save_stay_rate('{"stay_id": "00000000-0000-4000-8000-0000000000e1", "first_night": "2027-04-01", "last_night": "2027-04-30", "nightly_rate_aed": "650"}'::jsonb) ->> 'id') is not null),
  true, 'ops_save_stay_rate stores a range (last night inclusive)');
select is((select upper(nights) from public.stay_rates where nightly_rate_aed = 650), '2027-05-01'::date, 'the stored range ends the day after the last night');
select throws_ok($$select public.ops_save_stay_rate('{"stay_id": "00000000-0000-4000-8000-0000000000e1", "first_night": "2027-06-10", "last_night": "2027-06-01", "nightly_rate_aed": "650"}'::jsonb)$$, 'P0001', 'almar:invalid', 'a range that ends before it starts is refused');

-- ops_publish -------------------------------------------------------------------------------------------------
insert into public.stays (id, slug, destination_id, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000000e3', 'test-stay-publish', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000a1', false, 3);
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000000e3', 'en', 'published', 'Publish me'),
  ('00000000-0000-4000-8000-0000000000e3', 'es', 'draft', 'Publicame');
select is(
  (public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e3', true)) -> 'missing',
  '[{"locale": "ar", "field": "title"}]'::jsonb, 'publish names the missing Arabic title');
select is((public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e3', true)) ->> 'ok', 'false', 'publish is refused without raising');
select is((public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e3', true)) ->> 'code', 'publish_incomplete', 'the refusal code is publish_incomplete');
select is((select is_published from public.stays where id = '00000000-0000-4000-8000-0000000000e3'), false, 'a refused publish changes nothing');
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000000e3', 'ar', 'draft', 'انشرني');
select is((public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e3', true)) ->> 'ok', 'true', 'publish works once all three languages exist');
select is((public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e3', true)) -> 'warnings', '[{"code": "no_base_rate"}]'::jsonb, 'a stay with no base rate publishes with the no_base_rate warning');
select is((select is_published from public.stays where id = '00000000-0000-4000-8000-0000000000e3'), true, 'the stay is published');
select is((public.ops_publish('destination', '00000000-0000-4000-8000-0000000000d1', false)) ->> 'code', 'has_published_stays', 'a destination with published stays cannot be unpublished');
select is((select is_published from public.destinations where id = '00000000-0000-4000-8000-0000000000d1'), true, 'the destination stays published');
select is((public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e3', false)) ->> 'ok', 'true', 'unpublishing a stay is always allowed');

-- Per-field language rules
update public.stay_translations set tagline = 'A tagline', description = array['p1', 'p2', 'p3'] where stay_id = '00000000-0000-4000-8000-0000000000e3' and locale = 'en';
update public.stay_translations set tagline = 'Una frase', description = array['p1', 'p2', 'p3'] where stay_id = '00000000-0000-4000-8000-0000000000e3' and locale = 'es';
update public.stay_translations set tagline = null, description = array['p1', 'p2'] where stay_id = '00000000-0000-4000-8000-0000000000e3' and locale = 'ar';
select is(
  (public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e3', true)) -> 'missing',
  '[{"locale": "ar", "field": "tagline"}, {"locale": "ar", "field": "description"}]'::jsonb, 'a missing Arabic tagline and a shorter Arabic description are both named');
update public.stay_translations set tagline = 'x', description = array['p1', 'p2', 'p3'] where stay_id = '00000000-0000-4000-8000-0000000000e3' and locale = 'ar';
update public.stay_translations set tagline = null where stay_id = '00000000-0000-4000-8000-0000000000e3' and locale = 'es';
select is(
  (public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e3', true)) -> 'missing',
  '[{"locale": "es", "field": "tagline"}]'::jsonb, 'English tagline set and Spanish tagline null: Spanish tagline is named');

-- A stay cannot publish under a draft destination
insert into public.stays (id, slug, destination_id, hero_media_id, position) values
  ('00000000-0000-4000-8000-0000000000e4', 'test-stay-under-draft', '00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000a1', 4);
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000000e4', 'en', 'published', 'Under draft'),
  ('00000000-0000-4000-8000-0000000000e4', 'ar', 'draft', 'تحت المسودة'),
  ('00000000-0000-4000-8000-0000000000e4', 'es', 'draft', 'Bajo borrador');
select is((public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e4', true)) ->> 'code', 'parent_unpublished', 'a stay under an unpublished destination cannot publish');

-- ops_save_stay: absent keys untouched, join sets replaced only when present ----------------------------------
select lives_ok($$select public.ops_save_stay('{
  "id": "00000000-0000-4000-8000-0000000000e2",
  "gallery_media_ids": ["00000000-0000-4000-8000-0000000000a2", "00000000-0000-4000-8000-0000000000a3"],
  "translations": {"en": {"title": "Stay two renamed", "tagline": "Kept", "status": "published"}}
}'::jsonb)$$, 'ops_save_stay sets a title, a tagline and a two-photo gallery');
select lives_ok($$select public.ops_save_stay('{"id": "00000000-0000-4000-8000-0000000000e2", "min_nights": 3}'::jsonb)$$, 'ops_save_stay with only {id, min_nights}');
select is((select min_nights from public.stays where id = '00000000-0000-4000-8000-0000000000e2'), 3, 'min_nights was set');
select is((select title from public.stay_translations where stay_id = '00000000-0000-4000-8000-0000000000e2' and locale = 'en'), 'Stay two renamed', 'the title was left alone');
select is((select tagline from public.stay_translations where stay_id = '00000000-0000-4000-8000-0000000000e2' and locale = 'en'), 'Kept', 'the tagline was left alone');
select is((select count(*)::int from public.stay_gallery where stay_id = '00000000-0000-4000-8000-0000000000e2'), 2, 'the gallery was left alone');
select lives_ok($$select public.ops_save_stay('{"id": "00000000-0000-4000-8000-0000000000e2", "gallery_media_ids": []}'::jsonb)$$, 'ops_save_stay with an empty gallery');
select is((select count(*)::int from public.stay_gallery where stay_id = '00000000-0000-4000-8000-0000000000e2'), 0, 'an empty list empties the gallery');
select lives_ok($$select public.ops_save_stay('{"id": "00000000-0000-4000-8000-0000000000e2", "pets_rule": "fee", "pets_fee_aed": "75.50"}'::jsonb)$$, 'pets rule and fee in one save');
select is((select pets_fee_aed::text from public.stays where id = '00000000-0000-4000-8000-0000000000e2'), '75.50', 'the fee was stored');
select throws_ok($$select public.ops_save_stay('{
  "id": "00000000-0000-4000-8000-0000000000e2",
  "translations": {
    "en": {"title": "Stay two renamed", "amenities": ["Pool", "Wifi", "Kitchen"]},
    "ar": {"title": "إقامة", "amenities": ["مسبح", "واي فاي"]}
  }
}'::jsonb)$$, 'P0001', 'almar:amenities_mismatch', 'AR amenities shorter than EN are refused');
update public.stays set is_published = true where id = '00000000-0000-4000-8000-0000000000e3';
select throws_ok($$select public.ops_save_stay('{"id": "00000000-0000-4000-8000-0000000000e3", "destination_id": "00000000-0000-4000-8000-0000000000d2"}'::jsonb)$$, 'P0001', 'almar:parent_unpublished', 'a published stay cannot move to an unpublished destination');
select throws_ok($$select public.ops_save_stay('{"id": "00000000-0000-4000-8000-0000000000e3", "slug": "another-slug"}'::jsonb)$$, 'P0001', 'almar:invalid', 'the slug of a published stay cannot change');
select throws_ok($$select public.ops_save_stay('{"slug": "new-stay-without-english", "destination_id": "00000000-0000-4000-8000-0000000000d1"}'::jsonb)$$, 'P0001', 'almar:invalid', 'a new stay needs an English record');
select throws_ok($$select public.ops_save_stay('{"id": "00000000-0000-4000-8000-0000000000ff", "min_nights": 2}'::jsonb)$$, 'P0001', 'almar:not_found', 'an unknown id is not_found');

-- Catalog items: connections, the one home-pickup item --------------------------------------------------------
select lives_ok($$select public.ops_save_catalog_item('{
  "slug": "pickup-service", "kind": "service", "unit": "trip", "is_home_pickup": true,
  "media_id": "00000000-0000-4000-8000-0000000000a1",
  "destination_ids": ["00000000-0000-4000-8000-0000000000d1"],
  "stay_ids": ["00000000-0000-4000-8000-0000000000e1"],
  "translations": {"en": {"name": "Home pickup", "status": "published"}}
}'::jsonb)$$, 'a catalog item is created');
select is((select is_home_pickup from public.catalog_items where slug = 'pickup-service'), true, 'is_home_pickup was set on create');
select lives_ok($$select public.ops_save_catalog_item(jsonb_build_object('id', (select id from public.catalog_items where slug = 'pickup-service'), 'price_aed', '120.00'))$$, 'a save without is_home_pickup');
select is((select is_home_pickup from public.catalog_items where slug = 'pickup-service'), true, 'is_home_pickup was left alone');
select throws_ok($$select public.ops_save_catalog_item('{"slug": "pickup-two", "kind": "service", "unit": "trip", "is_home_pickup": true, "translations": {"en": {"name": "Second pickup"}}}'::jsonb)$$, '23505', null, 'a second home-pickup item is refused');
select lives_ok($$select public.ops_save_catalog_item(jsonb_build_object('id', (select id from public.catalog_items where slug = 'pickup-service'), 'is_home_pickup', false))$$, 'is_home_pickup present as false');
select is((select is_home_pickup from public.catalog_items where slug = 'pickup-service'), false, 'is_home_pickup was set to false');
select is((select cs.position from public.catalog_item_stays cs where cs.stay_id = '00000000-0000-4000-8000-0000000000e1'), 0, 'the first link on a stay gets position 0');
select lives_ok($$select public.ops_save_catalog_item('{"slug": "second-service", "kind": "service", "unit": "person", "stay_ids": ["00000000-0000-4000-8000-0000000000e1"], "translations": {"en": {"name": "Second"}}}'::jsonb)$$, 'a second service on the same stay');
select is((select cs.position from public.catalog_item_stays cs join public.catalog_items c on c.id = cs.item_id where c.slug = 'second-service'), 1, 'a new link goes to the end of that stay''s service list');
select lives_ok($$select public.ops_save_stay('{"id": "00000000-0000-4000-8000-0000000000e1", "connections": {"service_ids": []}}'::jsonb)$$, 'a stay connection list can be emptied');
select is((select count(*)::int from public.catalog_item_stays where stay_id = '00000000-0000-4000-8000-0000000000e1'), 0, 'its links are gone');

-- Delete, reorder, media ---------------------------------------------------------------------------------------
select throws_ok($$select public.ops_delete('stay', '00000000-0000-4000-8000-0000000000e3')$$, 'P0001', 'almar:published', 'a published row is not deleted');
select throws_ok($$select public.ops_delete('destination', '00000000-0000-4000-8000-0000000000d2')$$, '23503', null, 'a destination with stays is not deleted');
select is((public.ops_reorder('stay', array['00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000e1']::uuid[])) ->> 'affects_site', 'true', 'reorder reports a published row');
select is((select position from public.stays where id = '00000000-0000-4000-8000-0000000000e2'), 1, 'reorder set position 1');
select is((select (e ->> 'used_by')::int >= 1 from jsonb_array_elements(public.ops_list('media')) e where e ->> 'key' = 'test/hero.webp'), true, 'an imported hero is used by at least one row');
select is((select (e ->> 'used_by')::int from jsonb_array_elements(public.ops_list('media')) e where e ->> 'key' = 'uploads/unused.webp'), 0, 'an unused upload is used by none');
select is((public.ops_save_image_alts('{"id": "00000000-0000-4000-8000-0000000000a1", "alt": {"ar": "صورة"}}'::jsonb)) ->> 'affects_site', 'true', 'alt text of a photo used by a published stay affects the site');
select is((public.ops_save_image_alts('{"id": "00000000-0000-4000-8000-0000000000a4", "alt": {"es": "Sin uso"}, "status": {"es": "published"}}'::jsonb)) ->> 'affects_site', 'false', 'alt text of an unused photo does not');
select is((select status from public.image_translations where image_id = '00000000-0000-4000-8000-0000000000a1' and locale = 'ar'), 'draft', 'a typed Arabic alt defaults to draft');
select throws_ok($$select public.ops_delete_media('00000000-0000-4000-8000-0000000000a1')$$, '23503', 'almar:in_use', 'an imported photo is not deleted');
select is((public.ops_save_media('{"key": "uploads/abc123.webp", "width": 100, "height": 80, "bytes": 5000, "content_type": "image/webp", "sha256": "0000000000000000000000000000000000000000000000000000000000000000", "alt_en": "New"}'::jsonb)) ->> 'created', 'true', 'an upload is recorded');
select is((public.ops_save_media('{"key": "uploads/abc123.webp", "alt_en": "Again"}'::jsonb)) ->> 'created', 'false', 'the same upload key returns the same row');

-- Blocks, access, import -----------------------------------------------------------------------------------------
select is((public.ops_add_block('{"scope": "all", "starts_on": "2027-12-24", "ends_on": "2027-12-26", "reason": "Closed"}'::jsonb)) ->> 'overlapping_bookings', '0', 'a block reports no overlapping bookings in 3.2');
select is((select count(*)::int from public.stay_ops_blocked_days('00000000-0000-4000-8000-0000000000e1', '2027-12-20', '2027-12-30')), 3, 'an all-scope block reaches every stay');
select lives_ok($$select public.ops_save_stay_access('{"stay_id": "00000000-0000-4000-8000-0000000000e1", "access": {"address": "Calle 1", "door_code": "1234"}}'::jsonb)$$, 'stay access is saved');
select lives_ok($$select public.ops_save_stay_access('{"stay_id": "00000000-0000-4000-8000-0000000000e1", "access": {"notes": "Ring twice"}}'::jsonb)$$, 'a second save with other fields');
select is((select address from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000000e1'), 'Calle 1', 'the address was left alone');

select is(
  (public.import_catalog('{
    "media": [{"id": "00000000-0000-4000-8000-0000000000b1", "key": "imp/one.webp", "width": 10, "height": 10}],
    "image_translations": [{"image_id": "00000000-0000-4000-8000-0000000000b1", "locale": "en", "alt": "One", "status": "published"}],
    "destinations": [{"id": "00000000-0000-4000-8000-0000000000b2", "slug": "imp-destination", "hero_media_id": "00000000-0000-4000-8000-0000000000b1", "is_published": true, "position": 9}],
    "destination_translations": [{"destination_id": "00000000-0000-4000-8000-0000000000b2", "locale": "en", "name": "Imported", "status": "published"}]
  }'::jsonb)) -> 'destinations',
  '1'::jsonb, 'import_catalog inserts a destination');
select is(
  (public.import_catalog('{
    "media": [{"id": "00000000-0000-4000-8000-0000000000b1", "key": "imp/one.webp", "width": 10, "height": 10}],
    "destinations": [{"id": "00000000-0000-4000-8000-0000000000b2", "slug": "imp-destination", "hero_media_id": "00000000-0000-4000-8000-0000000000b1", "is_published": true, "position": 9}],
    "destination_translations": [{"destination_id": "00000000-0000-4000-8000-0000000000b2", "locale": "en", "name": "Imported", "status": "published"}]
  }'::jsonb)),
  '{"media": 0, "stays": 0, "destinations": 0, "stay_gallery": 0, "team_members": 0, "journey_tiers": 0, "catalog_items": 0, "image_translations": 0, "stay_translations": 0, "catalog_translations": 0, "destination_translations": 0, "catalog_item_stays": 0, "team_member_translations": 0, "catalog_item_destinations": 0, "journey_tier_translations": 0}'::jsonb,
  'the second import writes nothing');
select is((select count(*)::int from public.destinations where slug = 'imp-destination'), 1, 'and no duplicate row exists');

-- Site publish helpers --------------------------------------------------------------------------------------------
select is((public.site_request_update()) ->> 'requested_seq', '1', 'site_request_update bumps the sequence');
select is((select requested_seq from public.api_site_version), 1::bigint, 'api_site_version shows it');

select * from finish();
rollback;
