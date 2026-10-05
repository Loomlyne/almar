-- pgTAP: what the anonymous (public) key can and cannot read or call (plan 03.2-01, threats T-3.2-01 to T-3.2-03).
-- The seed is written as the postgres owner; the assertions run as anon, then authenticated, then service_role.
begin;
create extension if not exists pgtap with schema extensions;
select plan(120);

-- Seed ----------------------------------------------------------------------------------------------------------
insert into public.media (id, key, width, height, bytes, sha256, source) values
  ('00000000-0000-4000-8000-0000000000a1', 'test/hero.webp', 1600, 1000, 12345, repeat('a', 64), 'import');
insert into public.image_translations (image_id, locale, alt, status) values
  ('00000000-0000-4000-8000-0000000000a1', 'en', 'A hero', 'published');
insert into public.destinations (id, slug, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000000d1', 'pub-destination', '00000000-0000-4000-8000-0000000000a1', true, 1),
  ('00000000-0000-4000-8000-0000000000d2', 'draft-destination', '00000000-0000-4000-8000-0000000000a1', false, 2);
insert into public.destination_translations (destination_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000000d1', 'en', 'published', 'Published destination'),
  ('00000000-0000-4000-8000-0000000000d2', 'en', 'published', 'Draft destination');
insert into public.stays (id, slug, destination_id, base_nightly_rate_aed, pets_rule, pets_fee_aed, infants_count, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000000e1', 'pub-stay', '00000000-0000-4000-8000-0000000000d1', 1234.00, 'fee', 99.00, true, '00000000-0000-4000-8000-0000000000a1', true, 1),
  ('00000000-0000-4000-8000-0000000000e2', 'draft-stay', '00000000-0000-4000-8000-0000000000d1', 777.00, null, null, null, '00000000-0000-4000-8000-0000000000a1', false, 2);
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000000e1', 'en', 'published', 'Published stay'),
  ('00000000-0000-4000-8000-0000000000e2', 'en', 'published', 'Draft stay');
insert into public.stay_gallery (stay_id, media_id, position) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', 1);
insert into public.stay_rates (stay_id, nights, nightly_rate_aed) values
  ('00000000-0000-4000-8000-0000000000e1', daterange(current_date + 10, current_date + 17), 900);
insert into public.stay_access (stay_id, address, wifi_password, door_code) values
  ('00000000-0000-4000-8000-0000000000e1', 'Secret street 1', 'secret-wifi', '4321');
insert into public.availability_blocks (scope, destination_id, stay_id, starts_on, ends_on, reason) values
  ('stay', null, '00000000-0000-4000-8000-0000000000e1', current_date + 3, current_date + 4, 'Secret reason'),
  ('destination', '00000000-0000-4000-8000-0000000000d1', null, current_date + 5, current_date + 5, null),
  ('all', null, null, current_date + 7, current_date + 7, null);
insert into public.catalog_items (id, slug, kind, unit, price_aed, media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000000c1', 'pub-experience', 'experience', 'person', 250.00, '00000000-0000-4000-8000-0000000000a1', true, 1),
  ('00000000-0000-4000-8000-0000000000c2', 'draft-experience', 'experience', 'person', null, '00000000-0000-4000-8000-0000000000a1', false, 2);
insert into public.catalog_translations (item_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000000c1', 'en', 'published', 'Published experience'),
  ('00000000-0000-4000-8000-0000000000c2', 'en', 'published', 'Draft experience');
insert into public.catalog_item_destinations (item_id, destination_id) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000d1'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000d1');
insert into public.catalog_item_stays (item_id, stay_id, position) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000e1', 0),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000e1', 1);
insert into public.journey_tiers (id, slug, media_id, price_from_amount, price_from_currency, est_low, est_high, est_open_ended, is_published, position) values
  ('00000000-0000-4000-8000-0000000000f1', 'pub-journey', '00000000-0000-4000-8000-0000000000a1', 3000, 'USD', 80000, 90000, false, true, 1),
  ('00000000-0000-4000-8000-0000000000f2', 'draft-journey', null, null, null, null, null, null, false, 2);
insert into public.journey_tier_translations (tier_id, locale, status, name, price_label) values
  ('00000000-0000-4000-8000-0000000000f1', 'en', 'published', 'Published journey', 'From USD $3,000'),
  ('00000000-0000-4000-8000-0000000000f2', 'en', 'published', 'Draft journey', 'x');
insert into public.team_members (id, slug, email, links, is_published, position) values
  ('00000000-0000-4000-8000-000000000071', 'pub-member', 'private@example.com', '[{"label": "Site", "url": "https://example.com"}]', true, 1),
  ('00000000-0000-4000-8000-000000000072', 'draft-member', 'draft@example.com', '[]', false, 2);
insert into public.team_member_translations (member_id, locale, status, name) values
  ('00000000-0000-4000-8000-000000000071', 'en', 'published', 'Published member'),
  ('00000000-0000-4000-8000-000000000072', 'en', 'published', 'Draft member');

-- anon: every view answers ---------------------------------------------------------------------------------------
set local role anon;
select lives_ok($$select * from public.api_destinations$$, 'anon reads api_destinations');
select lives_ok($$select * from public.api_destination_translations$$, 'anon reads api_destination_translations');
select lives_ok($$select * from public.api_stay_blocked_days$$, 'anon reads api_stay_blocked_days');
select lives_ok($$select * from public.api_stays$$, 'anon reads api_stays');
select lives_ok($$select * from public.api_stay_translations$$, 'anon reads api_stay_translations');
select lives_ok($$select * from public.api_catalog$$, 'anon reads api_catalog');
select lives_ok($$select * from public.api_catalog_translations$$, 'anon reads api_catalog_translations');
select lives_ok($$select * from public.api_journey_tiers$$, 'anon reads api_journey_tiers');
select lives_ok($$select * from public.api_journey_tier_translations$$, 'anon reads api_journey_tier_translations');
select lives_ok($$select * from public.api_team$$, 'anon reads api_team');
select lives_ok($$select * from public.api_team_translations$$, 'anon reads api_team_translations');
select lives_ok($$select * from public.api_image_translations$$, 'anon reads api_image_translations');
select lives_ok($$select * from public.api_inclusions$$, 'anon reads api_inclusions');
select lives_ok($$select * from public.api_site_version$$, 'anon reads api_site_version');

-- Published rows only --------------------------------------------------------------------------------------------
select is((select array_agg(slug) from public.api_destinations), array['pub-destination'], 'api_destinations: published only');
select is((select array_agg(slug) from public.api_stays), array['pub-stay'], 'api_stays: published only');
select is((select array_agg(title) from public.api_stay_translations), array['Published stay'], 'api_stay_translations: published stays only');
select is((select array_agg(slug) from public.api_catalog), array['pub-experience'], 'api_catalog: published only');
select is((select array_agg(name) from public.api_catalog_translations), array['Published experience'], 'api_catalog_translations: published only');
select is((select array_agg(slug) from public.api_journey_tiers), array['pub-journey'], 'api_journey_tiers: published only');
select is((select array_agg(name) from public.api_journey_tier_translations), array['Published journey'], 'api_journey_tier_translations: published only');
select is((select array_agg(slug) from public.api_team), array['pub-member'], 'api_team: published only');
select is((select array_agg(name) from public.api_team_translations), array['Published member'], 'api_team_translations: published only');
select is((select count(*)::int from public.api_destination_translations), 1, 'api_destination_translations: published only');
select is((select count(*)::int from public.api_inclusions), 21, 'api_inclusions: seven inclusions in three languages');
select is((select count(*)::int from public.api_image_translations), 1, 'api_image_translations: all media');
select is((select requested_seq from public.api_site_version), 0::bigint, 'api_site_version: the sequence');

-- Shapes the build depends on ------------------------------------------------------------------------------------
select is((select nightly_rate_aed from public.api_stays), null, 'api_stays never carries a rate');
select is((select min_nights from public.api_stays), 1, 'api_stays carries min_nights');
select is((select experience_ids from public.api_stays), array['00000000-0000-4000-8000-0000000000c1']::uuid[], 'api_stays lists published experiences only');
select is((select service_ids from public.api_stays), '{}'::uuid[], 'api_stays: no services is the empty array, never null');
select is((select cardinality(blocked_dates) from public.api_stays), 4, 'api_stays: blocked days of the stay, its destination and all');
select is((select gallery::jsonb -> 0 ->> 'media_key' from public.api_stays), 'test/hero.webp', 'api_stays: gallery image objects carry media_key');
select is((select hero_image::jsonb ->> 'position' from public.api_stays), '0', 'api_stays: hero position 0');
select is((select array_agg(day order by day) from public.api_stay_blocked_days where stay_id = '00000000-0000-4000-8000-0000000000e1'), array[current_date + 3, current_date + 4, current_date + 5, current_date + 7], 'blocked days: expanded, distinct');
select is((select stay_ids from public.api_catalog), array['00000000-0000-4000-8000-0000000000e1']::uuid[], 'api_catalog: stay_ids of published stays');
select is((select price_aed from public.api_catalog), 250.00, 'api_catalog returns the display price');
select is((select price_from::jsonb from public.api_journey_tiers where slug = 'pub-journey'), '{"amount": 3000, "currency": "USD"}'::jsonb, 'api_journey_tiers rebuilds price_from');
select is((select price_estimate::jsonb from public.api_journey_tiers where slug = 'pub-journey'), '{"low": 80000, "high": 90000, "currency": "AED", "open_ended": false}'::jsonb, 'api_journey_tiers rebuilds price_estimate');
select is((select links::jsonb -> 0 ->> 'url' from public.api_team), 'https://example.com', 'api_team returns the links');

-- Column order is the fixture's key order (the build serialises it into the HTML) --------------------------------
reset role;
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_stays'::regclass and a.attnum > 0 and not a.attisdropped),
  array['id', 'created_at', 'updated_at', 'is_sample', 'sample_fields', 'slug', 'destination_id', 'max_guests', 'min_guests', 'bedrooms', 'bathrooms',
        'nightly_rate_aed', 'min_nights', 'blocked_dates', 'experience_ids', 'service_ids', 'hero_image', 'gallery', 'is_published', 'position'],
  'api_stays columns follow stays.json');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_destinations'::regclass and a.attnum > 0 and not a.attisdropped),
  array['id', 'created_at', 'updated_at', 'is_sample', 'sample_fields', 'slug', 'hero_image', 'inset_image', 'is_published', 'position'],
  'api_destinations columns follow destinations.json');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_catalog'::regclass and a.attnum > 0 and not a.attisdropped),
  array['id', 'created_at', 'updated_at', 'is_sample', 'sample_fields', 'slug', 'kind', 'unit', 'price_aed', 'is_uae', 'image', 'destination_ids', 'stay_ids', 'is_published', 'position'],
  'api_catalog columns follow catalog.json');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_journey_tiers'::regclass and a.attnum > 0 and not a.attisdropped),
  array['id', 'created_at', 'updated_at', 'is_sample', 'sample_fields', 'slug', 'price_from', 'price_estimate', 'is_featured', 'image', 'is_published', 'position'],
  'api_journey_tiers columns follow home.json tiers');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_stay_translations'::regclass and a.attnum > 0 and not a.attisdropped),
  array['stay_id', 'locale', 'title', 'tagline', 'neighborhood', 'guests_label', 'bathrooms_label', 'beds_label', 'price_label', 'price_note', 'description', 'amenities', 'inclusions', 'policy_headings', 'status'],
  'api_stay_translations columns follow stay-translations.json');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_team'::regclass and a.attnum > 0 and not a.attisdropped),
  array['id', 'created_at', 'updated_at', 'is_sample', 'sample_fields', 'slug', 'photo', 'links', 'is_published', 'position'],
  'api_team has no email');

-- anon: what it cannot read ---------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.stay_access$$, '42501', null, 'anon cannot read stay_access');
select throws_ok($$select door_code from public.stay_access$$, '42501', null, 'anon cannot read a door code');
select throws_ok($$select * from public.stay_rates$$, '42501', null, 'anon cannot read stay_rates');
select throws_ok($$select email from public.team_members$$, '42501', null, 'anon cannot read team_members.email');
select throws_ok($$select reason from public.availability_blocks$$, '42501', null, 'anon cannot read availability_blocks.reason');
select throws_ok($$select created_by from public.availability_blocks$$, '42501', null, 'anon cannot read availability_blocks.created_by');
select throws_ok($$select base_nightly_rate_aed from public.stays$$, '42501', null, 'anon cannot read stays.base_nightly_rate_aed');
select throws_ok($$select pets_fee_aed from public.stays$$, '42501', null, 'anon cannot read stays.pets_fee_aed');
select throws_ok($$select pets_rule from public.stays$$, '42501', null, 'anon cannot read stays.pets_rule');
select throws_ok($$select infants_count from public.stays$$, '42501', null, 'anon cannot read stays.infants_count');
select throws_ok($$select * from public.stays$$, '42501', null, 'anon cannot select every column of stays');
select throws_ok($$select last_hook_result from public.site_publish$$, '42501', null, 'anon cannot read the publish internals');
select throws_ok($$select sha256 from public.media$$, '42501', null, 'anon cannot read media.sha256');
select lives_ok($$select slug, is_published from public.stays$$, 'anon can read the granted stay columns');
select is((select count(*)::int from public.stays), 1, 'and sees only the published stay');
select is((select count(*)::int from public.stay_translations), 1, 'a draft stay''s translations are invisible');
select is((select count(*)::int from public.availability_blocks), 3, 'availability dates are readable (without the reason)');
select throws_ok($$select email from public.api_team$$, '42703', null, 'api_team has no email column');

-- anon: it cannot write or call anything --------------------------------------------------------------------------
select throws_ok($$insert into public.stays (slug, destination_id) values ('hack', '00000000-0000-4000-8000-0000000000d1')$$, '42501', null, 'anon cannot insert into stays');
select throws_ok($$update public.stays set min_nights = 9$$, '42501', null, 'anon cannot update stays');
select throws_ok($$delete from public.stays$$, '42501', null, 'anon cannot delete from stays');
select throws_ok($$insert into public.media (key) values ('x/y.webp')$$, '42501', null, 'anon cannot insert into media');
select is(has_table_privilege('anon', 'public.api_stays', 'INSERT') or has_table_privilege('anon', 'public.api_stays', 'UPDATE') or has_table_privilege('anon', 'public.api_stays', 'DELETE'), false, 'anon holds no write privilege on a view');
select throws_ok($$select public.ops_list('stay')$$, '42501', null, 'anon cannot call ops_list');
select throws_ok($$select public.ops_get('stay', '00000000-0000-4000-8000-0000000000e1')$$, '42501', null, 'anon cannot call ops_get');
select throws_ok($$select public.ops_publish('stay', '00000000-0000-4000-8000-0000000000e1', false)$$, '42501', null, 'anon cannot call ops_publish');
select throws_ok($$select public.ops_save_stay('{}'::jsonb)$$, '42501', null, 'anon cannot call ops_save_stay');
select throws_ok($$select public.ops_save_stay_access('{}'::jsonb)$$, '42501', null, 'anon cannot call ops_save_stay_access');
select throws_ok($$select public.import_catalog('{}'::jsonb)$$, '42501', null, 'anon cannot call import_catalog');
select throws_ok($$select public.site_request_update()$$, '42501', null, 'anon cannot call site_request_update');
select throws_ok($$select * from public.stay_night_rates('00000000-0000-4000-8000-0000000000e1', current_date, current_date + 2)$$, '42501', null, 'anon cannot call stay_night_rates');
select throws_ok($$select public.catalog_fail('x')$$, '42501', null, 'anon cannot call the helper functions');

-- authenticated: the same wall --------------------------------------------------------------------------------------
reset role;
set local role authenticated;
select throws_ok($$select * from public.stays$$, '42501', null, 'a signed-in guest cannot read the stays table');
select throws_ok($$select * from public.stay_access$$, '42501', null, 'a signed-in guest cannot read stay_access');
select throws_ok($$select * from public.api_stays$$, '42501', null, 'the views are for the public key only');
select throws_ok($$select public.ops_list('stay')$$, '42501', null, 'a signed-in guest cannot call ops_list');
select throws_ok($$insert into public.stays (slug, destination_id) values ('hack', '00000000-0000-4000-8000-0000000000d1')$$, '42501', null, 'a signed-in guest cannot insert into stays');

-- service_role: it can ---------------------------------------------------------------------------------------------
reset role;
set local role service_role;
select lives_ok($$select public.ops_list('stay')$$, 'service_role can call ops_list');
select is((select count(*)::int from public.stay_access), 1, 'service_role can read stay_access');
select is((select jsonb_array_length(public.ops_list('stay'))), 2, 'ops_list returns draft and published stays');
select is((select (public.ops_get('stay', '00000000-0000-4000-8000-0000000000e1') ->> 'has_access')), 'true', 'ops_get knows the stay has access details');
select is((select (public.ops_get('stay', '00000000-0000-4000-8000-0000000000e1') ->> 'base_nightly_rate_aed')), '1234.00', 'ops_get returns money as a decimal string');
select is((select (public.ops_get('team_member', '00000000-0000-4000-8000-000000000071') ->> 'email')), 'private@example.com', 'ops_get returns the team email to the owner');
select is((select count(*)::int from public.stay_night_rates('00000000-0000-4000-8000-0000000000e1', current_date + 10, current_date + 12) where source = 'range'), 2, 'service_role can read the rate preview');
reset role;

-- Review fixes (Fable, plan 03.2-01): the home-pickup add-on is not in the public catalogue, and a draft row's
-- pictures, alt text and blocked days are not public. Seeded as the owner, asserted as anon. ----------------------------
reset role;
insert into public.media (id, key, width, height, source) values
  ('00000000-0000-4000-8000-0000000000b1', 'test/up-stay-hero.webp', 1600, 1000, 'upload'),
  ('00000000-0000-4000-8000-0000000000b2', 'test/up-stay-gallery.webp', 1600, 1000, 'upload'),
  ('00000000-0000-4000-8000-0000000000b3', 'test/up-member.webp', 800, 800, 'upload'),
  ('00000000-0000-4000-8000-0000000000b4', 'test/up-destination.webp', 1600, 1000, 'upload'),
  ('00000000-0000-4000-8000-0000000000b5', 'test/up-experience.webp', 1600, 1000, 'upload'),
  ('00000000-0000-4000-8000-0000000000b6', 'test/up-journey.webp', 1600, 1000, 'upload');
insert into public.image_translations (image_id, locale, alt, status) values
  ('00000000-0000-4000-8000-0000000000b1', 'en', 'Alt of a draft stay picture', 'published'),
  ('00000000-0000-4000-8000-0000000000b3', 'en', 'Alt of a draft member picture', 'published');
insert into public.stays (id, slug, destination_id, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000000e3', 'upload-stay', '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000b1', false, 3);
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000000e3', 'en', 'published', 'Upload stay');
insert into public.stay_gallery (stay_id, media_id, position) values
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000b2', 1);
update public.destinations set inset_media_id = '00000000-0000-4000-8000-0000000000b4' where id = '00000000-0000-4000-8000-0000000000d2';
update public.catalog_items set media_id = '00000000-0000-4000-8000-0000000000b5' where id = '00000000-0000-4000-8000-0000000000c2';
update public.journey_tiers set media_id = '00000000-0000-4000-8000-0000000000b6' where id = '00000000-0000-4000-8000-0000000000f2';
update public.team_members set photo_media_id = '00000000-0000-4000-8000-0000000000b3' where id = '00000000-0000-4000-8000-000000000072';
insert into public.availability_blocks (scope, destination_id, stay_id, starts_on, ends_on) values
  ('stay', null, '00000000-0000-4000-8000-0000000000e3', current_date + 20, current_date + 21),
  ('destination', '00000000-0000-4000-8000-0000000000d2', null, current_date + 22, current_date + 22);
insert into public.catalog_items (id, slug, kind, unit, price_aed, is_uae, is_home_pickup, is_published, position) values
  ('00000000-0000-4000-8000-0000000000c3', 'home-pickup', 'service', 'trip', 100.00, true, true, true, 3);
insert into public.catalog_translations (item_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000000c3', 'en', 'published', 'Home pickup');
insert into public.catalog_item_stays (item_id, stay_id, position) values
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000e1', 2);

set local role anon;
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b1'), 0, 'media: an upload used only by a draft stay (hero) is invisible');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b2'), 0, 'media: an upload used only by a draft stay (gallery) is invisible');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b3'), 0, 'media: an upload used only by a draft team member is invisible');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b4'), 0, 'media: an upload used only by a draft destination is invisible');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b5'), 0, 'media: an upload used only by a draft experience is invisible');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b6'), 0, 'media: an upload used only by a draft journey is invisible');
select is((select count(*)::int from public.image_translations where image_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'image_translations: the alt text of a draft stay picture is invisible');
select is((select count(*)::int from public.api_image_translations where image_id = '00000000-0000-4000-8000-0000000000b1'), 0, 'api_image_translations: the alt text of a draft stay picture is invisible');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000a1'), 1, 'media: an imported row stays visible (fixture-only pages read its alt by id)');
select is((select count(*)::int from public.image_translations where image_id = '00000000-0000-4000-8000-0000000000a1'), 1, 'image_translations: the alt text of an imported row stays visible');
select is((select count(*)::int from public.api_image_translations where image_id = '00000000-0000-4000-8000-0000000000a1'), 1, 'api_image_translations: an imported row stays visible');
select is((select count(*)::int from public.api_catalog where slug = 'home-pickup'), 0, 'api_catalog does not return the published home-pickup add-on');
select is((select count(*)::int from public.api_catalog_translations where name = 'Home pickup'), 0, 'api_catalog_translations does not return the home-pickup add-on');
select is((select service_ids from public.api_stays where slug = 'pub-stay'), '{}'::uuid[], 'api_stays does not list the home-pickup add-on as a service');
select is((select count(*)::int from public.availability_blocks where stay_id = '00000000-0000-4000-8000-0000000000e3'), 0, 'availability_blocks: a block of a draft stay is invisible');
select is((select count(*)::int from public.availability_blocks where destination_id = '00000000-0000-4000-8000-0000000000d2'), 0, 'availability_blocks: a block of a draft destination is invisible');
select is((select count(*)::int from public.availability_blocks), 3, 'availability_blocks: only the blocks of published rows and of scope all remain');

reset role;
update public.stays set is_published = true where id = '00000000-0000-4000-8000-0000000000e3';
set local role anon;
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b1'), 1, 'media: the hero upload becomes visible once the stay is published');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b2'), 1, 'media: the gallery upload becomes visible once the stay is published');
select is((select count(*)::int from public.image_translations where image_id = '00000000-0000-4000-8000-0000000000b1'), 1, 'image_translations: the alt text becomes visible once the stay is published');
select is((select count(*)::int from public.api_image_translations where image_id = '00000000-0000-4000-8000-0000000000b1'), 1, 'api_image_translations: the alt text becomes visible once the stay is published');
select is((select gallery::jsonb -> 0 ->> 'media_key' from public.api_stays where slug = 'upload-stay'), 'test/up-stay-gallery.webp', 'api_stays: the published stay carries its uploaded gallery picture');
select is((select count(*)::int from public.availability_blocks where stay_id = '00000000-0000-4000-8000-0000000000e3'), 1, 'availability_blocks: the block becomes visible once the stay is published');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b3'), 0, 'media: the draft team member picture is still invisible');

reset role;
update public.destinations set is_published = true where id = '00000000-0000-4000-8000-0000000000d2';
update public.catalog_items set is_published = true where id = '00000000-0000-4000-8000-0000000000c2';
update public.journey_tiers set is_published = true where id = '00000000-0000-4000-8000-0000000000f2';
update public.team_members set is_published = true where id = '00000000-0000-4000-8000-000000000072';
set local role anon;
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b3'), 1, 'media: the team member picture becomes visible once the member is published');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b4'), 1, 'media: the destination picture becomes visible once the destination is published');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b5'), 1, 'media: the experience picture becomes visible once the experience is published');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b6'), 1, 'media: the journey picture becomes visible once the journey is published');
select is((select count(*)::int from public.availability_blocks where destination_id = '00000000-0000-4000-8000-0000000000d2'), 1, 'availability_blocks: the destination block becomes visible once the destination is published');

reset role;
update public.stays set is_published = false where id = '00000000-0000-4000-8000-0000000000e3';
set local role anon;
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000000b1'), 0, 'media: unpublishing the stay hides its upload again');
reset role;

select * from finish();
rollback;
