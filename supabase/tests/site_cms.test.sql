-- pgTAP: the Phase 6 migration 20261025120000_site_cms.sql (plan 06-01 Task 3, threats T-06-01 to T-06-09). Written,
-- not run (owner, 2026-10-21: no test); the controller decides when it runs, on one local stack. Runs as the postgres
-- owner inside one transaction that is rolled back; the role checks switch to anon and authenticated and back. Rows
-- use the zz6 prefix and ids ending in 6xx.
begin;
create extension if not exists pgtap with schema extensions;
select plan(232);

-- Helpers -------------------------------------------------------------------------------------------------------------
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
-- A start on a 30-minute boundary at least p_after from now (now() is fixed for the whole transaction).
create function pg_temp.next_slot(p_after interval) returns timestamptz language sql as $$
  select to_timestamp((ceil(extract(epoch from now() + p_after) / 1800) * 1800)::double precision)
$$;
-- A Dubai wall-clock time as a timestamptz.
create function pg_temp.dubai(p_day date, p_time text) returns timestamptz language sql as $$
  select (p_day + p_time::time) at time zone 'Asia/Dubai'
$$;
create function pg_temp.iso(p timestamptz) returns text language sql as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;
create function pg_temp.iso_ms(p timestamptz) returns text language sql as $$
  select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;
-- A consultation payload for one start.
create function pg_temp.consult(p_slot timestamptz) returns jsonb language sql as $$
  select jsonb_build_object('name', 'Zz6 Guest', 'email', 'Zz6-Guest@Example.com', 'slot_start', pg_temp.iso(p_slot), 'time_zone', 'Asia/Dubai')
$$;
create function pg_temp.legal(p_kind text) returns uuid language sql as $$
  select l.id from public.legal_pages l where l.kind = p_kind
$$;
create temp table t6 (k text primary key, v jsonb);

-- Seed ----------------------------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000651', 'zz6-guest-one@example.com', now()),
  ('00000000-0000-4000-8000-000000000652', 'zz6-guest-two@example.com', now()),
  ('00000000-0000-4000-8000-000000000653', 'maria@almarprivatejourney.com', now());

insert into public.media (id, key, width, height, bytes, sha256, source) values
  ('00000000-0000-4000-8000-0000000006a1', 'zz6/a.webp', 1600, 1000, 100, repeat('6', 64), 'import'),
  ('00000000-0000-4000-8000-0000000006a2', 'zz6/b.webp', 800, 600, 100, repeat('6', 64), 'upload'),
  ('00000000-0000-4000-8000-0000000006a3', 'zz6/c.webp', 800, 600, 100, repeat('6', 64), 'upload'),
  ('00000000-0000-4000-8000-0000000006a4', 'zz6/d.webp', 800, 600, 100, repeat('6', 64), 'upload');
insert into public.image_translations (image_id, locale, alt, status) values
  ('00000000-0000-4000-8000-0000000006a1', 'en', 'Zz6 alt', 'published'),
  ('00000000-0000-4000-8000-0000000006a1', 'ar', 'نص', 'draft');

insert into public.destinations (id, slug, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000006d1', 'zz6-dest-one', '00000000-0000-4000-8000-0000000006a1', true, 9601),
  ('00000000-0000-4000-8000-0000000006d2', 'zz6-dest-two', '00000000-0000-4000-8000-0000000006a1', true, 9602),
  ('00000000-0000-4000-8000-0000000006d3', 'zz6-dest-lock', '00000000-0000-4000-8000-0000000006a1', false, 9603);
insert into public.destination_translations (destination_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000006d1', 'en', 'published', 'Dest one'),
  ('00000000-0000-4000-8000-0000000006d2', 'en', 'published', 'Dest two'),
  ('00000000-0000-4000-8000-0000000006d3', 'en', 'published', 'Dest lock');
insert into public.stays (id, slug, destination_id, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000006e1', 'zz6-stay-live', '00000000-0000-4000-8000-0000000006d1', '00000000-0000-4000-8000-0000000006a1', true, 9601),
  ('00000000-0000-4000-8000-0000000006e2', 'zz6-stay-draft', '00000000-0000-4000-8000-0000000006d1', '00000000-0000-4000-8000-0000000006a1', false, 9602),
  ('00000000-0000-4000-8000-0000000006e3', 'zz6-stay-two', '00000000-0000-4000-8000-0000000006d2', '00000000-0000-4000-8000-0000000006a1', true, 9603);
insert into public.catalog_items (id, slug, kind, unit, media_id, is_home_pickup, is_published, position) values
  ('00000000-0000-4000-8000-0000000006c1', 'zz6-experience', 'experience', 'person', '00000000-0000-4000-8000-0000000006a1', false, true, 9601),
  ('00000000-0000-4000-8000-0000000006c2', 'zz6-pickup', 'service', 'trip', '00000000-0000-4000-8000-0000000006a1', true, true, 9602),
  ('00000000-0000-4000-8000-0000000006c3', 'zz6-draft-service', 'service', 'trip', null, false, false, 9603);
insert into public.journey_tiers (id, slug, media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000006f1', 'zz6-pub-tier', '00000000-0000-4000-8000-0000000006a1', true, 9601),
  ('00000000-0000-4000-8000-0000000006f2', 'zz6-draft-tier', null, false, 9602);
insert into public.journey_tier_translations (tier_id, locale, status, name, price_label) values
  ('00000000-0000-4000-8000-0000000006f1', 'en', 'published', 'Pub tier', 'On request'),
  ('00000000-0000-4000-8000-0000000006f2', 'en', 'draft', 'Draft tier', 'On request');
insert into public.journey_tier_legs (id, tier_id, position, destination_id, stay_id) values
  ('00000000-0000-4000-8000-000000000671', '00000000-0000-4000-8000-0000000006f1', 1, '00000000-0000-4000-8000-0000000006d1', '00000000-0000-4000-8000-0000000006e2'),
  ('00000000-0000-4000-8000-000000000672', '00000000-0000-4000-8000-0000000006f1', 2, '00000000-0000-4000-8000-0000000006d1', '00000000-0000-4000-8000-0000000006e1'),
  ('00000000-0000-4000-8000-000000000673', '00000000-0000-4000-8000-0000000006f2', 1, '00000000-0000-4000-8000-0000000006d1', null);
insert into public.journey_tier_addons (tier_id, item_id, position) values
  ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-0000000006c1', 1),
  ('00000000-0000-4000-8000-0000000006f1', '00000000-0000-4000-8000-0000000006c2', 2);

insert into public.page_sections (id, page, section, is_shown) values
  ('00000000-0000-4000-8000-000000000601', 'home', 'gallery', true),
  ('00000000-0000-4000-8000-000000000602', 'home', 'stays', false),
  ('00000000-0000-4000-8000-000000000603', 'experiences', 'hero', true),
  ('00000000-0000-4000-8000-000000000604', 'about', 'story', true),
  ('00000000-0000-4000-8000-000000000605', 'about', 'values', false);
insert into public.page_section_translations (section_id, locale, status, heading) values
  ('00000000-0000-4000-8000-000000000601', 'en', 'published', 'Zz6 gallery'),
  ('00000000-0000-4000-8000-000000000602', 'en', 'published', 'Zz6 hidden');
insert into public.page_section_media (section_id, slot, position, media_id) values
  ('00000000-0000-4000-8000-000000000601', 'images', 6, '00000000-0000-4000-8000-0000000006a2'),
  ('00000000-0000-4000-8000-000000000602', 'images', 0, '00000000-0000-4000-8000-0000000006a3');
insert into public.page_items (id, section_id, slug, media_id, is_shown, position) values
  ('00000000-0000-4000-8000-000000000611', '00000000-0000-4000-8000-000000000604', 'zz6-card-shown', '00000000-0000-4000-8000-0000000006a1', true, 1),
  ('00000000-0000-4000-8000-000000000612', '00000000-0000-4000-8000-000000000604', 'zz6-card-hidden', null, false, 2),
  ('00000000-0000-4000-8000-000000000613', '00000000-0000-4000-8000-000000000605', 'zz6-card-in-hidden', null, true, 1);
insert into public.page_item_translations (item_id, locale, status, title) values
  ('00000000-0000-4000-8000-000000000611', 'en', 'published', 'Shown card'),
  ('00000000-0000-4000-8000-000000000612', 'en', 'published', 'Hidden card'),
  ('00000000-0000-4000-8000-000000000613', 'en', 'published', 'Card in a hidden section');

insert into public.posts (id, slug, cover_media_id, published_at, is_published) values
  ('00000000-0000-4000-8000-000000000621', 'zz6-pub-post', '00000000-0000-4000-8000-0000000006a1', '2025-06-01T00:00:00+00:00', true),
  ('00000000-0000-4000-8000-000000000622', 'zz6-draft-post', '00000000-0000-4000-8000-0000000006a4', null, false);
insert into public.post_translations (post_id, locale, status, title, excerpt) values
  ('00000000-0000-4000-8000-000000000621', 'en', 'published', 'Pub post', 'An excerpt'),
  ('00000000-0000-4000-8000-000000000621', 'ar', 'published', 'منشور', 'مقتطف'),
  ('00000000-0000-4000-8000-000000000621', 'es', 'published', 'Entrada', 'Extracto'),
  ('00000000-0000-4000-8000-000000000622', 'en', 'draft', 'Draft post', 'Draft excerpt');
insert into public.post_blocks (id, post_id, position, kind, media_id) values
  ('00000000-0000-4000-8000-000000000631', '00000000-0000-4000-8000-000000000621', 1, 'heading', null),
  ('00000000-0000-4000-8000-000000000632', '00000000-0000-4000-8000-000000000621', 2, 'photo', '00000000-0000-4000-8000-0000000006a2'),
  ('00000000-0000-4000-8000-000000000633', '00000000-0000-4000-8000-000000000621', 3, 'paragraph', null);
insert into public.post_block_translations (block_id, locale, status, text) values
  ('00000000-0000-4000-8000-000000000631', 'en', 'published', 'Heading'),
  ('00000000-0000-4000-8000-000000000633', 'en', 'published', 'Para');

insert into public.nav_links (id, area, position, is_shown, link_kind, target) values
  ('00000000-0000-4000-8000-000000000641', 'header', 1, true, 'internal', 'destinations'),
  ('00000000-0000-4000-8000-000000000642', 'header', 2, false, 'internal', 'about');
insert into public.nav_link_translations (link_id, locale, status, label) values
  ('00000000-0000-4000-8000-000000000641', 'en', 'published', 'Destinations'),
  ('00000000-0000-4000-8000-000000000642', 'en', 'published', 'About');

-- Schema ----------------------------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relrowsecurity
     and c.relname = any (array['page_sections', 'page_section_translations', 'page_section_media', 'page_items',
       'page_item_translations', 'nav_links', 'nav_link_translations', 'posts', 'post_translations', 'post_blocks',
       'post_block_translations', 'legal_pages', 'legal_page_translations', 'legal_blocks', 'legal_block_translations',
       'site_requests', 'consult_hours', 'consult_days_off', 'consult_settings', 'consult_bookings', 'saved_stays',
       'journey_tier_legs', 'journey_tier_leg_translations', 'journey_tier_addons'])),
  24, 'RLS is on for all 24 Phase 6 tables');
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public' and column_name = 'locked_fields' and is_nullable = 'NO'
     and table_name = any (array['destination_translations', 'stay_translations', 'catalog_translations',
       'journey_tier_translations', 'team_member_translations', 'inclusion_translations', 'image_translations',
       'page_section_translations', 'page_item_translations', 'nav_link_translations', 'post_translations',
       'post_block_translations', 'legal_page_translations', 'legal_block_translations', 'journey_tier_leg_translations'])),
  15, 'every translation table has locked_fields, not null');
select has_column('public', 'stay_access', 'notes_locked', 'stay_access has notes_locked');
select is((select array_agg(kind order by kind) from public.legal_pages),
  array['booking_terms', 'cookie_banner', 'disclaimer', 'privacy', 'terms', 'waiver'], 'the six legal pages are seeded');
select is((select count(*)::int from public.legal_page_translations), 0, 'no legal text is seeded');
select is((select array[notice_hours, horizon_days, slot_minutes] from public.consult_settings where id = 1), array[null, null, 30]::int[],
  'consultation settings are seeded closed (null notice and horizon, 30-minute slots)');
select throws_ok(
  $$insert into public.destination_translations (destination_id, locale, status, name, locked_fields) values ('00000000-0000-4000-8000-0000000006d1', 'ar', 'draft', 'x', '{}'), ('00000000-0000-4000-8000-0000000006d2', 'en', 'draft', 'x', '{name}')$$,
  '23514', null, 'an English record can never be locked');
select throws_ok(
  $$update public.image_translations set locked_fields = '{name}' where image_id = '00000000-0000-4000-8000-0000000006a1' and locale = 'ar'$$,
  '23514', null, 'an alt text lock is {alt} or {}');
select throws_ok(
  $$insert into public.post_blocks (post_id, position, kind, media_id) values ('00000000-0000-4000-8000-000000000622', 1, 'photo', null)$$,
  '23514', null, 'a photo block needs a picture');
select throws_ok(
  $$insert into public.nav_links (area, link_kind, target) values ('header', 'internal', 'login')$$,
  '23514', null, 'Login is never a link row');
select throws_ok(
  $$insert into public.nav_links (area, link_kind, target) values ('footer', 'external', 'http://example.com')$$,
  '23514', null, 'an external link is https only');
select throws_ok(
  $$update public.page_sections set video_url = 'http://example.com/v.mp4' where id = '00000000-0000-4000-8000-000000000603'$$,
  '23514', null, 'a hero video is https only');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_posts'::regclass and a.attnum > 0 and not a.attisdropped),
  array['id', 'slug', 'created_at', 'updated_at', 'is_sample', 'sample_fields', 'destination_id', 'featured_stay_id', 'featured_experience_id',
        'cover_image', 'published_at', 'is_published'],
  'api_posts columns follow posts.json');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_post_translations'::regclass and a.attnum > 0 and not a.attisdropped),
  array['post_id', 'locale', 'title', 'excerpt', 'body', 'seo_title', 'seo_description', 'status'],
  'api_post_translations columns follow post-translations.json');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_page_items'::regclass and a.attnum > 0 and not a.attisdropped),
  array['id', 'created_at', 'updated_at', 'is_sample', 'sample_fields', 'slug', 'section', 'image', 'is_published', 'position'],
  'api_page_items columns follow about.json cards');
select is(
  (select array_agg(a.attname::text order by a.attnum) from pg_attribute a where a.attrelid = 'public.api_page_section_media'::regclass and a.attnum > 0 and not a.attisdropped),
  array['section_id', 'slot', 'position', 'is_decorative', 'image'],
  'api_page_section_media columns');

-- anon: no private table, no lock, no write function -------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.site_requests$$, '42501', null, 'anon cannot read site_requests');
select throws_ok($$select * from public.consult_hours$$, '42501', null, 'anon cannot read consult_hours');
select throws_ok($$select * from public.consult_days_off$$, '42501', null, 'anon cannot read consult_days_off');
select throws_ok($$select * from public.consult_settings$$, '42501', null, 'anon cannot read consult_settings');
select throws_ok($$select * from public.consult_bookings$$, '42501', null, 'anon cannot read consult_bookings');
select throws_ok($$select * from public.saved_stays$$, '42501', null, 'anon cannot read saved_stays');
select throws_ok($$select * from public.page_sections$$, '42501', null, 'anon reads page_sections only through its granted columns');
select throws_ok($$select locked_fields from public.page_section_translations$$, '42501', null, 'anon cannot read a page lock');
select throws_ok($$select locked_fields from public.post_translations$$, '42501', null, 'anon cannot read a post lock');
select throws_ok($$select locked_fields from public.destination_translations$$, '42501', null, 'anon cannot read a destination lock');
select throws_ok($$select locked_fields from public.image_translations$$, '42501', null, 'anon cannot read an alt lock');
select throws_ok($$insert into public.site_requests (kind, locale, name, email) values ('plan', 'en', 'x', 'x@example.com')$$, '42501', null, 'anon cannot write a request');
select throws_ok($$select public.submit_site_request('plan', 'en', '{}'::jsonb)$$, '42501', null, 'anon cannot call submit_site_request');
select throws_ok($$select public.book_consultation('en', '{}'::jsonb)$$, '42501', null, 'anon cannot call book_consultation');
select throws_ok($$select public.stay_is_published('00000000-0000-4000-8000-0000000006e1')$$, '42501', null, 'anon cannot call stay_is_published');
select lives_ok($$select public.booking_terms_current()$$, 'anon can call booking_terms_current (the build bakes its version with the anon key)');
select throws_ok($$select public.import_site_content('{}'::jsonb)$$, '42501', null, 'anon cannot call import_site_content');
select throws_ok($$select public.ops_save_page_section('{}'::jsonb)$$, '42501', null, 'anon cannot call ops_save_page_section');
select throws_ok($$select public.consult_slots(current_date, current_date)$$, '42501', null, 'anon cannot call consult_slots');

-- anon: every view answers, with shown and published rows only ---------------------------------------------------------
select lives_ok($$select * from public.api_page_sections$$, 'anon reads api_page_sections');
select lives_ok($$select * from public.api_page_section_translations$$, 'anon reads api_page_section_translations');
select lives_ok($$select * from public.api_page_section_media$$, 'anon reads api_page_section_media');
select lives_ok($$select * from public.api_page_items$$, 'anon reads api_page_items');
select lives_ok($$select * from public.api_page_item_translations$$, 'anon reads api_page_item_translations');
select lives_ok($$select * from public.api_posts$$, 'anon reads api_posts');
select lives_ok($$select * from public.api_post_translations$$, 'anon reads api_post_translations');
select lives_ok($$select * from public.api_nav_links$$, 'anon reads api_nav_links');
select lives_ok($$select * from public.api_nav_link_translations$$, 'anon reads api_nav_link_translations');
select lives_ok($$select * from public.api_legal_pages$$, 'anon reads api_legal_pages');
select lives_ok($$select * from public.api_legal_page_translations$$, 'anon reads api_legal_page_translations');
select lives_ok($$select * from public.api_journey_tier_legs$$, 'anon reads api_journey_tier_legs');
select lives_ok($$select * from public.api_journey_tier_leg_translations$$, 'anon reads api_journey_tier_leg_translations');
select lives_ok($$select * from public.api_journey_tier_addons$$, 'anon reads api_journey_tier_addons');

select is((select array_agg(section order by section) from public.api_page_sections where id in (
    '00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000604', '00000000-0000-4000-8000-000000000605')),
  array['gallery', 'hero', 'story'], 'api_page_sections: shown sections only');
select is((select count(*)::int from public.page_sections where id = '00000000-0000-4000-8000-000000000602'), 0, 'a hidden section is not readable directly either');
select is((select array_agg(heading) from public.api_page_section_translations where heading like 'Zz6%'), array['Zz6 gallery'],
  'api_page_section_translations: shown sections only');
select is((select count(*)::int from public.api_page_section_media where section_id = '00000000-0000-4000-8000-000000000602'), 0,
  'api_page_section_media: nothing of a hidden section');
select is((select image::jsonb from public.api_page_section_media where section_id = '00000000-0000-4000-8000-000000000601'),
  '{"id": "00000000-0000-4000-8000-0000000006a2", "media_key": "zz6/b.webp", "width": 800, "height": 600, "position": 6}'::jsonb,
  'api_page_section_media: the image object carries the stored position');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000006a2'), 1, 'an uploaded picture of a shown section is public');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000006a3'), 0, 'an uploaded picture of a hidden section is not');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000006a4'), 0, 'the cover of a draft post is not public');
select is((select array_agg(slug order by slug) from public.api_page_items where slug like 'zz6%'), array['zz6-card-shown'],
  'api_page_items: shown cards of shown sections only');
select is((select array_agg(title) from public.api_page_item_translations where card_id in (
    '00000000-0000-4000-8000-000000000611', '00000000-0000-4000-8000-000000000612', '00000000-0000-4000-8000-000000000613')),
  array['Shown card'], 'api_page_item_translations: card_id of shown cards only');
select is((select array_agg(slug) from public.api_posts where slug like 'zz6%'), array['zz6-pub-post'], 'api_posts: published only');
select is((select count(*)::int from public.api_post_translations where post_id = '00000000-0000-4000-8000-000000000622'), 0,
  'api_post_translations: nothing of a draft post');
select is((select body::jsonb from public.api_post_translations where post_id = '00000000-0000-4000-8000-000000000621' and locale = 'en'),
  '[{"type": "heading", "text": "Heading"},
    {"type": "photo", "image": {"id": "00000000-0000-4000-8000-0000000006a2", "media_key": "zz6/b.webp", "width": 800, "height": 600, "position": 2}},
    {"type": "paragraph", "text": "Para"}]'::jsonb,
  'api_post_translations: body is the blocks in order, the photo with its block position');
select is((select array_agg(id) from public.api_nav_links where id in ('00000000-0000-4000-8000-000000000641', '00000000-0000-4000-8000-000000000642')),
  array['00000000-0000-4000-8000-000000000641']::uuid[], 'api_nav_links: shown links only');
select is((select count(*)::int from public.api_legal_pages), 0, 'api_legal_pages: nothing while no legal page is published');
select is((select array_agg(coalesce(stay_id::text, 'null') order by position) from public.api_journey_tier_legs where tier_id = '00000000-0000-4000-8000-0000000006f1'),
  array['null', '00000000-0000-4000-8000-0000000006e1'], 'api_journey_tier_legs: an unpublished stay reads as null');
select is((select count(*)::int from public.api_journey_tier_legs where tier_id = '00000000-0000-4000-8000-0000000006f2'), 0,
  'api_journey_tier_legs: nothing of a draft tier');
select is((select array_agg(item_id) from public.api_journey_tier_addons where tier_id = '00000000-0000-4000-8000-0000000006f1'),
  array['00000000-0000-4000-8000-0000000006c1']::uuid[], 'api_journey_tier_addons: never the home pickup');
reset role;

-- authenticated: saved stays, own rows only (T-06-05) -------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000651", "role": "authenticated"}', true);
select throws_ok($$select * from public.site_requests$$, '42501', null, 'a signed-in guest cannot read site_requests');
select throws_ok($$select public.submit_site_request('plan', 'en', '{}'::jsonb)$$, '42501', null, 'a signed-in guest cannot call submit_site_request');
select throws_ok($$select public.book_consultation('en', '{}'::jsonb)$$, '42501', null, 'a signed-in guest cannot call book_consultation');
select throws_ok($$select public.booking_terms_current()$$, '42501', null, 'a signed-in guest cannot call booking_terms_current');
select is(public.stay_is_published('00000000-0000-4000-8000-0000000006e1'), true, 'stay_is_published answers a signed-in guest');
select lives_ok($$insert into public.saved_stays (user_id, stay_id) values ('00000000-0000-4000-8000-000000000651', '00000000-0000-4000-8000-0000000006e1')$$,
  'a guest saves a published stay');
select throws_ok($$insert into public.saved_stays (user_id, stay_id) values ('00000000-0000-4000-8000-000000000651', '00000000-0000-4000-8000-0000000006e2')$$,
  '42501', null, 'a guest cannot save an unpublished stay');
select throws_ok($$insert into public.saved_stays (user_id, stay_id) values ('00000000-0000-4000-8000-000000000652', '00000000-0000-4000-8000-0000000006e3')$$,
  '42501', null, 'a guest cannot save a stay for someone else');
select is((select count(*)::int from public.saved_stays), 1, 'guest one sees their one saved stay');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000652", "role": "authenticated"}', true);
select is((select count(*)::int from public.saved_stays), 0, 'guest two sees none of guest one''s rows');
select lives_ok($$insert into public.saved_stays (user_id, stay_id) values ('00000000-0000-4000-8000-000000000652', '00000000-0000-4000-8000-0000000006e1')$$,
  'guest two saves the same stay');
select lives_ok($$delete from public.saved_stays where user_id = '00000000-0000-4000-8000-000000000651'$$, 'guest two''s delete of guest one''s rows runs');
reset role;
select is((select count(*)::int from public.saved_stays where user_id = '00000000-0000-4000-8000-000000000651'), 1,
  'and removed nothing of guest one');
select is((select count(*)::int from public.saved_stays where user_id = '00000000-0000-4000-8000-000000000652'), 1, 'guest two has their own row');

-- The translation lock (I18N-04, T-06-06) --------------------------------------------------------------------------------
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000006d3", "translations": {"ar": {"name": "وجهة", "locked_fields": ["name"]}}}'::jsonb)$$),
  'saved', 'an Arabic name is saved with its lock');
select is((select locked_fields from public.destination_translations where destination_id = '00000000-0000-4000-8000-0000000006d3' and locale = 'ar'),
  array['name'], 'the lock is stored');
select is((public.ops_get('destination', '00000000-0000-4000-8000-0000000006d3') -> 'translations' -> 'ar' -> 'locked_fields'), '["name"]'::jsonb,
  'ops_get returns the lock');
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000006d3", "translations": {"ar": {"name": "وجهة جديدة"}}}'::jsonb)$$),
  'saved', 'a save without locked_fields runs');
select is((select locked_fields from public.destination_translations where destination_id = '00000000-0000-4000-8000-0000000006d3' and locale = 'ar'),
  array['name'], 'and keeps the lock');
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000006d3", "translations": {"en": {"locked_fields": ["name"]}}}'::jsonb)$$),
  'almar:invalid {"field": "translations.en.locked_fields", "locale": "en"}', 'English cannot be locked');
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000006d3", "translations": {"ar": {"locked_fields": ["nope"]}}}'::jsonb)$$),
  'almar:invalid {"field": "translations.ar.locked_fields", "locale": "ar"}', 'a lock on a field the entity does not have is refused');
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000006d3", "translations": {"ar": {"locked_fields": ["name", "name"]}}}'::jsonb)$$),
  'almar:invalid {"field": "translations.ar.locked_fields", "locale": "ar"}', 'a repeated name is refused');
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000006d3", "translations": {"ar": {"locked_fields": "name"}}}'::jsonb)$$),
  'almar:invalid {"field": "translations.ar.locked_fields", "locale": "ar"}', 'a lock that is not a list is refused');
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000006d3", "translations": {"ar": {"locked_fields": []}}}'::jsonb)$$),
  'saved', 'an empty list unlocks');
select is((select cardinality(locked_fields) from public.destination_translations where destination_id = '00000000-0000-4000-8000-0000000006d3' and locale = 'ar'),
  0, 'the Arabic name is unlocked');
select is(pg_temp.outcome($$select public.ops_save_destination('{"id": "00000000-0000-4000-8000-0000000006d3", "translations": {"es": {"name": "Destino", "locked_fields": ["name"]}}}'::jsonb)$$),
  'saved', 'a new Spanish record is created locked');
select is((public.ops_publish('destination', '00000000-0000-4000-8000-0000000006d3', true)) ->> 'ok', 'true',
  'a fully translated row publishes with a lock on it (the publish check ignores the lock list)');
select is(public.catalog_gaps('{"name": "A", "locked_fields": []}'::jsonb, '{"name": "B", "locked_fields": ["name"]}'::jsonb, 'ar', array['name']),
  '[]'::jsonb, 'catalog_gaps skips locked_fields');
select is(pg_temp.outcome($$select public.ops_save_image_alts('{"id": "00000000-0000-4000-8000-0000000006a1", "alt": {"ar": "نص يدوي"}, "locked": {"ar": true}}'::jsonb)$$),
  'saved', 'an Arabic alt is saved locked');
select is((select locked_fields from public.image_translations where image_id = '00000000-0000-4000-8000-0000000006a1' and locale = 'ar'),
  array['alt'], 'the alt lock is {alt}');
select is(pg_temp.outcome($$select public.ops_save_image_alts('{"id": "00000000-0000-4000-8000-0000000006a1", "locked": {"ar": false}}'::jsonb)$$),
  'saved', 'the alt lock can be taken off on its own');
select is((select cardinality(locked_fields) from public.image_translations where image_id = '00000000-0000-4000-8000-0000000006a1' and locale = 'ar'),
  0, 'the alt lock is {}');
select is(pg_temp.outcome($$select public.ops_save_image_alts('{"id": "00000000-0000-4000-8000-0000000006a1", "locked": {"en": true}}'::jsonb)$$),
  'almar:invalid {"field": "locked.en", "locale": "en"}', 'an English alt cannot be locked');
select is(pg_temp.outcome($$select public.ops_save_image_alts('{"id": "00000000-0000-4000-8000-0000000006a1", "locked": {"ar": "yes"}}'::jsonb)$$),
  'almar:invalid {"field": "locked.ar", "locale": "ar"}', 'an alt lock is a boolean');
select is(pg_temp.outcome($$select public.ops_save_stay_access('{"stay_id": "00000000-0000-4000-8000-0000000006e1", "access": {"notes": "Zz6", "notes_ar": "ملاحظة", "notes_locked": ["ar"]}}'::jsonb)$$),
  'saved', 'access notes are saved with the Arabic lock');
select is((select notes_locked from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000006e1'), array['ar'], 'notes_locked is stored');
select is(pg_temp.outcome($$select public.ops_save_stay_access('{"stay_id": "00000000-0000-4000-8000-0000000006e1", "access": {"notes": "Zz6 again"}}'::jsonb)$$),
  'saved', 'a save without notes_locked runs');
select is((select notes_locked from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000006e1'), array['ar'], 'and keeps it');
select is(pg_temp.outcome($$select public.ops_save_stay_access('{"stay_id": "00000000-0000-4000-8000-0000000006e1", "access": {"notes_locked": ["en"]}}'::jsonb)$$),
  'almar:invalid {"field": "notes_locked", "locale": null}', 'English notes cannot be locked');

-- Page sections, About cards, links, media references (06-02, T-06-07) ----------------------------------------------------
select is(pg_temp.outcome($$select public.ops_save_page_section('{"id": "00000000-0000-4000-8000-000000000601", "media": {"poster": ["00000000-0000-4000-8000-0000000006a1"]}}'::jsonb)$$),
  'almar:invalid {"field": "media.poster", "locale": null}', 'a slot the section does not have is refused');
select is(pg_temp.outcome($$select public.ops_save_page_section('{"id": "00000000-0000-4000-8000-000000000601", "video_url": "https://example.com/v.mp4"}'::jsonb)$$),
  'almar:invalid {"field": "video_url", "locale": null}', 'a video on a section that is not a hero is refused');
select is(pg_temp.outcome($$select public.ops_save_page_section('{"id": "00000000-0000-4000-8000-000000000603", "media": {"image": ["00000000-0000-4000-8000-0000000006a1"]}, "video_url": "https://example.com/hero.mp4"}'::jsonb)$$),
  'saved', 'the Experiences hero takes a photo and an https video');
select is((select media_id from public.page_section_media where section_id = '00000000-0000-4000-8000-000000000603' and slot = 'image' and position = 0),
  '00000000-0000-4000-8000-0000000006a1'::uuid, 'the hero photo is stored at position 0');
select is((select video_url from public.page_sections where id = '00000000-0000-4000-8000-000000000603'), 'https://example.com/hero.mp4', 'and the video URL');
select is(pg_temp.outcome($$select public.ops_save_page_section('{"id": "00000000-0000-4000-8000-000000000603", "media": {"image": ["00000000-0000-4000-8000-0000000006a1", "00000000-0000-4000-8000-0000000006a2"]}}'::jsonb)$$),
  'almar:invalid {"field": "media.image", "locale": null}', 'a single slot takes one photo');
select is(pg_temp.outcome($$select public.ops_save_page_section('{"id": "00000000-0000-4000-8000-000000000603", "media": {"image": ["00000000-0000-4000-8000-0000000006ff"]}}'::jsonb)$$),
  'almar:invalid {"field": "media.image", "locale": null}', 'a photo the library does not hold is refused');
select is(pg_temp.outcome($$select public.ops_save_page_section('{"id": "00000000-0000-4000-8000-000000000603", "video_url": "http://example.com/hero.mp4"}'::jsonb)$$),
  'almar:invalid {"field": "video_url", "locale": null}', 'an http video is refused');
select is(pg_temp.outcome($$select public.ops_save_page_section('{"id": "00000000-0000-4000-8000-000000000601", "media": {"images": ["00000000-0000-4000-8000-0000000006a1", "00000000-0000-4000-8000-0000000006a2"]}, "translations": {"en": {"heading": "Zz6 gallery"}, "ar": {"heading": "معرض", "locked_fields": ["heading"]}}}'::jsonb)$$),
  'saved', 'a gallery list and a locked Arabic heading are saved');
select is((select array_agg(position order by position) from public.page_section_media where section_id = '00000000-0000-4000-8000-000000000601' and slot = 'images'),
  array[6, 7], 'the list keeps its first stored position');
select is((select locked_fields from public.page_section_translations where section_id = '00000000-0000-4000-8000-000000000601' and locale = 'ar'),
  array['heading'], 'the section lock is stored');
select is((public.ops_list_page('home') ->> 'page'), 'home', 'ops_list_page answers one page');
select is(pg_temp.outcome($$select public.ops_list_page('blog')$$), 'almar:invalid {"field": "page", "locale": null}', 'ops_list_page refuses an unknown page');
select is(public.catalog_media_uses('00000000-0000-4000-8000-0000000006a2'), 2, 'catalog_media_uses counts a page section and a post photo');
select is(public.catalog_media_live('00000000-0000-4000-8000-0000000006a3'), false, 'a picture of a hidden section is not live');
select is(public.catalog_media_live('00000000-0000-4000-8000-0000000006a2'), true, 'a picture of a shown section is live');
select throws_ok($$delete from public.media where id = '00000000-0000-4000-8000-0000000006a2'$$, '23503', null, 'a picture used by a page cannot be deleted');
select is(pg_temp.outcome($$select public.ops_save_page_item('{"section_id": "00000000-0000-4000-8000-000000000601", "slug": "zz6-new-card", "translations": {"en": {"title": "New"}}}'::jsonb)$$),
  'almar:invalid {"field": "section_id", "locale": null}', 'a card goes only in a section that holds cards');
select is(pg_temp.outcome($$select public.ops_save_page_item('{"section_id": "00000000-0000-4000-8000-000000000604", "slug": "zz6-new-card", "translations": {"en": {"title": "New"}}}'::jsonb)$$),
  'saved', 'a card is created in the story section');
select is((select array[is_shown::text, position::text] from public.page_items where slug = 'zz6-new-card'), array['false', '3'],
  'a new card is hidden and goes last');
select is((public.ops_reorder('page_item', array['00000000-0000-4000-8000-000000000612', '00000000-0000-4000-8000-000000000611']::uuid[])) ->> 'affects_site', 'true',
  'cards reorder; a shown card affects the site');
select is(pg_temp.outcome($$select public.ops_reorder('page_section', array['00000000-0000-4000-8000-000000000601']::uuid[])$$),
  'almar:invalid {"field": "entity", "locale": null}', 'sections do not reorder');
select is(pg_temp.outcome($$select public.ops_delete('page_section', '00000000-0000-4000-8000-000000000601')$$),
  'almar:invalid {"field": "entity", "locale": null}', 'a section is never deleted');
select is((public.ops_delete('page_item', '00000000-0000-4000-8000-000000000612')) ->> 'affects_site', 'false', 'a hidden card is deleted');
select is(pg_temp.outcome($$select public.ops_publish('page_item', '00000000-0000-4000-8000-000000000611', true)$$),
  'almar:invalid {"field": "entity", "locale": null}', 'a card has no publish flag');
select is(pg_temp.outcome($$select public.ops_save_nav('header', '[{"link_kind": "internal", "target": "login", "translations": {"en": {"label": "Login"}}}]'::jsonb)$$),
  'almar:invalid {"field": "links.0.target", "locale": null}', 'Login is never saved as a link');
select is(pg_temp.outcome($$select public.ops_save_nav('header', '[{"link_kind": "external", "target": "http://example.com", "translations": {"en": {"label": "Out"}}}]'::jsonb)$$),
  'almar:invalid {"field": "links.0.target", "locale": null}', 'an http link is refused');
select is(pg_temp.outcome($$select public.ops_save_nav('header', '[{"link_kind": "internal", "target": "plan-with-us"}]'::jsonb)$$),
  'almar:invalid {"field": "translations.en", "locale": "en"}', 'a new link needs its English label');
select is(pg_temp.outcome($$select public.ops_save_nav('header', '[{"id": "00000000-0000-4000-8000-000000000641", "link_kind": "internal", "target": "destinations", "is_shown": true}, {"link_kind": "internal", "target": "journey:zz6-pub-tier", "translations": {"en": {"label": "Zz6 journey"}}}]'::jsonb)$$),
  'saved', 'an area is saved whole');
select is((select array_agg(target order by position) from public.nav_links where area = 'header'), array['destinations', 'journey:zz6-pub-tier'],
  'the area holds exactly the links sent, in order (the hidden one is gone)');

-- Posts (06-03) -------------------------------------------------------------------------------------------------------
select is(pg_temp.outcome($$select public.ops_save_post('{"slug": "zz6-new-post", "blocks": [{"kind": "photo"}], "translations": {"en": {"title": "T", "excerpt": "E"}}}'::jsonb)$$),
  'almar:invalid {"field": "blocks.0.media_id", "locale": null}', 'a photo block needs its picture');
select is(pg_temp.outcome($$select public.ops_save_post('{"slug": "zz6-new-post", "blocks": [{"kind": "paragraph", "translations": {"en": {"text": " "}}}], "translations": {"en": {"title": "T", "excerpt": "E"}}}'::jsonb)$$),
  'almar:invalid {"field": "blocks.0.translations.en.text", "locale": "en"}', 'a text block needs its English text');
insert into t6 select 'post', public.ops_save_post('{"slug": "zz6-new-post", "cover_media_id": "00000000-0000-4000-8000-0000000006a4", "blocks": [{"kind": "paragraph", "translations": {"en": {"text": "Body"}, "es": {"text": "Cuerpo"}}}], "translations": {"en": {"title": "T", "excerpt": "E"}, "ar": {"title": "ت", "excerpt": "م"}, "es": {"title": "T", "excerpt": "E"}}}'::jsonb);
select is((select count(*)::int from public.post_blocks where post_id = (select (v ->> 'id')::uuid from t6 where k = 'post')), 1, 'a post is created with its blocks');
select ok((public.ops_publish('post', (select (v ->> 'id')::uuid from t6 where k = 'post'), true)) -> 'missing' @> '[{"locale": "ar", "field": "blocks.0.text"}]'::jsonb,
  'publish names a block with no Arabic text');
select is((public.ops_publish('post', '00000000-0000-4000-8000-000000000622', true)) ->> 'code', 'publish_incomplete', 'a post with English only does not publish');
select is(pg_temp.outcome($$select public.ops_delete('post', '00000000-0000-4000-8000-000000000621')$$), 'almar:published {}', 'a published post is not deleted');
select is(pg_temp.outcome($$select public.ops_save_post('{"id": "00000000-0000-4000-8000-000000000621", "slug": "zz6-renamed"}'::jsonb)$$),
  'almar:invalid {"field": "slug", "locale": null}', 'a published post keeps its slug');
select is(pg_temp.outcome($$select public.ops_save_post('{"id": "00000000-0000-4000-8000-000000000621", "cover_media_id": null}'::jsonb)$$),
  'almar:invalid {"field": "cover_media_id", "locale": null}', 'a published post keeps its cover');
-- Fable review 2026-10-28: a bad published_at is almar:invalid, never a raw cast error.
select is(pg_temp.outcome($$select public.ops_save_post('{"id": "00000000-0000-4000-8000-000000000621", "published_at": "soon"}'::jsonb)$$),
  'almar:invalid {"field": "published_at", "locale": null}', 'published_at that is not a date is refused');
select is(pg_temp.outcome($$select public.ops_save_post('{"id": "00000000-0000-4000-8000-000000000621", "published_at": "2026-02-30"}'::jsonb)$$),
  'almar:invalid {"field": "published_at", "locale": null}', 'published_at that is not a real day is refused');
select is((public.ops_get('post', '00000000-0000-4000-8000-000000000621') -> 'blocks' -> 1 ->> 'media_id'), '00000000-0000-4000-8000-0000000006a2',
  'ops_get returns the blocks with their pictures');

-- Legal pages and booking terms (06-04) ---------------------------------------------------------------------------------
select is(public.booking_terms_current(), '{"published": false}'::jsonb, 'booking terms: unpublished');
select is(pg_temp.outcome($$select public.ops_save_legal_page('{"kind": "privacy", "translations": {"en": {"title": "Privacy", "necessary_label": "Necessary"}}}'::jsonb)$$),
  'almar:invalid {"field": "translations.en.necessary_label", "locale": "en"}', 'banner columns are refused on another kind');
select lives_ok($$select public.ops_save_legal_page('{"kind": "cookie_banner", "blocks": []}'::jsonb)$$,
  'the cookie banner takes blocks (its text, signed picture 2026-10-30)');
select is((public.ops_publish('legal_page', pg_temp.legal('privacy'), true)) ->> 'code', 'publish_incomplete', 'a legal page with no text does not publish');
select is(pg_temp.outcome($$select public.ops_save_legal_page('{"kind": "booking_terms", "translations": {"en": {"title": "Terms", "status": "published"}, "ar": {"title": "الشروط", "status": "draft"}, "es": {"title": "Términos", "status": "published"}}, "blocks": [{"kind": "paragraph", "translations": {"en": {"text": "One"}, "ar": {"text": "واحد"}, "es": {"text": "Uno"}}}]}'::jsonb)$$),
  'saved', 'the booking terms are written');
select is((public.ops_publish('legal_page', pg_temp.legal('booking_terms'), true)) ->> 'ok', 'true', 'and published');
select is(public.booking_terms_current(), '{"published": false}'::jsonb, 'booking terms: published with Arabic still a draft -> false');
select is(pg_temp.outcome($$select public.ops_save_legal_page('{"kind": "booking_terms", "translations": {"ar": {"status": "published"}}}'::jsonb)$$),
  'saved', 'the Arabic is published');
select ok((public.booking_terms_current() ->> 'version') ~ '^cms-[0-9a-f]{16}$', 'booking terms: all three published -> a cms- version of 16 hex');
select is((public.booking_terms_current() ->> 'published'), 'true', 'booking terms: published true');
insert into t6 select 'terms1', public.booking_terms_current();
select is(pg_temp.outcome($$select public.ops_save_legal_page('{"kind": "booking_terms", "blocks": [{"kind": "paragraph", "translations": {"en": {"text": "One"}, "ar": {"text": "واحد"}, "es": {"text": "Uno, cambiado"}}}]}'::jsonb)$$),
  'saved', 'one block text changes');
select isnt((public.booking_terms_current() ->> 'version'), (select v ->> 'version' from t6 where k = 'terms1'), 'booking terms: a new version');
insert into t6 select 'terms2', public.booking_terms_current();
select is(pg_temp.outcome($$select public.ops_save_legal_page('{"kind": "booking_terms", "blocks": [{"kind": "paragraph", "translations": {"en": {"text": "One"}, "ar": {"text": "واحد"}, "es": {"text": "Uno, cambiado"}}}]}'::jsonb)$$),
  'saved', 'the same text is saved again');
select is((public.booking_terms_current() ->> 'version'), (select v ->> 'version' from t6 where k = 'terms2'), 'booking terms: the same text keeps its version');
select is(pg_temp.outcome($$select public.ops_save_legal_page('{"kind": "booking_terms", "translations": {"es": {"status": "draft"}}}'::jsonb)$$),
  'saved', 'the Spanish goes back to draft');
select is(public.booking_terms_current(), '{"published": false}'::jsonb, 'booking terms: Spanish draft -> false');
select is(pg_temp.outcome($$select public.ops_save_legal_page('{"kind": "booking_terms", "blocks": []}'::jsonb)$$),
  'almar:invalid {"field": "blocks", "locale": null}', 'a published legal page keeps at least one block');

-- Requests (06-05, 06-06, T-06-02, T-06-08) -------------------------------------------------------------------------------
select is(pg_temp.outcome($$select public.submit_site_request('package', 'en', '{"name": "Zz6", "email": "zz6@example.com", "tier_slug": "zz6-unknown"}'::jsonb)$$),
  'almar:invalid {"field": "tier_slug", "locale": null}', 'a package request for an unknown package is refused');
select is(pg_temp.outcome($$select public.submit_site_request('package', 'en', '{"name": "Zz6", "email": "zz6@example.com", "tier_slug": "zz6-draft-tier"}'::jsonb)$$),
  'almar:invalid {"field": "tier_slug", "locale": null}', 'a package request for an unpublished package is refused');
select is((select count(*)::int from public.site_requests where kind = 'package'), 0, 'and nothing was saved');
select is(pg_temp.outcome($$select public.submit_site_request('package', 'en', '{"name": "Zz6", "email": "zz6@example.com", "tier_slug": "zz6-pub-tier", "guests": 2, "cities": ["Cartagena"]}'::jsonb)$$),
  'saved', 'a package request for a published package is saved');
select is(pg_temp.outcome($$select public.submit_site_request('consultation', 'en', '{"name": "Zz6", "email": "zz6@example.com"}'::jsonb)$$),
  'almar:invalid {"field": "kind", "locale": null}', 'a consultation goes through book_consultation only');
select is(pg_temp.outcome($$select public.submit_site_request('plan', 'en', '{"name": "Zz6", "email": "zz6@example.com", "price": "1"}'::jsonb)$$),
  'almar:invalid {"field": "payload", "locale": null}', 'a key the kind does not have is refused');
select is(pg_temp.outcome($$select public.submit_site_request('list', 'en', '{"name": "Zz6", "email": "zz6@example.com", "property_type": "Villa", "city": "Cartagena"}'::jsonb)$$),
  'almar:invalid {"field": "payload", "locale": null}', 'List with us needs its message');
select is(pg_temp.outcome($$select public.submit_site_request('plan', 'en', '{"name": "Zz6", "email": "zz6@example.com", "from": "2026-12-10", "to": "2026-12-01"}'::jsonb)$$),
  'almar:invalid {"field": "payload", "locale": null}', 'from must be before to');
select is(public.site_request_payload_ok('consultation', '{"name": "Zz6", "email": "zz6@example.com", "slot_start": "2026-12-01T10:00:00", "time_zone": "Asia/Dubai"}'::jsonb),
  false, 'a slot start without an offset is refused');
select throws_ok($$insert into public.site_requests (kind, locale, name, email, payload) values ('plan', 'en', 'Zz6', 'zz6@example.com', '{"name": "Zz6"}')$$,
  '23514', null, 'the table check refuses a payload without its email');
insert into t6 select 'plan', public.submit_site_request('plan', 'ar', '{"name": " Zz6 Mixed ", "email": "Zz6-Mixed@Example.com", "guests": 4, "budget": "around 20k"}'::jsonb);
select is((select array[name, email] from public.site_requests where id = (select (v ->> 'id')::uuid from t6 where k = 'plan')),
  array['Zz6 Mixed', 'zz6-mixed@example.com'], 'name is trimmed and email lower-cased into their columns');
select throws_ok($$select public.ops_set_request_handled((select (v ->> 'id')::uuid from t6 where k = 'plan'), true, '00000000-0000-4000-8000-000000000651')$$,
  'P0001', 'almar:not_owner', 'only the owner marks a request handled');
select is((public.ops_set_request_handled((select (v ->> 'id')::uuid from t6 where k = 'plan'), true, '00000000-0000-4000-8000-000000000653')) ->> 'handled_by',
  '00000000-0000-4000-8000-000000000653', 'the owner marks it handled, with her id');
select is(jsonb_array_length(public.ops_list_requests('plan', true)), 1, 'the handled filter finds it');
select is((public.ops_set_request_handled((select (v ->> 'id')::uuid from t6 where k = 'plan'), false, '00000000-0000-4000-8000-000000000653')) ->> 'handled_at',
  null, 'and back to not handled');

-- Consultation (06-05, T-06-03) -----------------------------------------------------------------------------------------
select is(pg_temp.outcome($$select public.book_consultation('en', pg_temp.consult(pg_temp.next_slot('3 days')))$$),
  'almar:consult_closed {}', 'closed while notice and horizon are unset');
select is((select count(*)::int from public.consult_slots(current_date, current_date + 7)), 0, 'consult_slots is empty while closed');
select is(pg_temp.outcome($$select public.ops_save_consult('{"hours": [{"weekday": 1, "starts": "09:00", "ends": "12:00"}, {"weekday": 1, "starts": "11:00", "ends": "13:00"}]}'::jsonb)$$),
  'almar:invalid {"field": "hours", "locale": null}', 'overlapping hours on one weekday are refused');
select is(pg_temp.outcome($$select public.ops_save_consult('{"hours": [{"weekday": 1, "starts": "09:15", "ends": "10:00"}]}'::jsonb)$$),
  'almar:invalid {"field": "hours.0", "locale": null}', 'hours are on :00 or :30');
select lives_ok($$select public.ops_save_consult(jsonb_build_object(
    'hours', (select jsonb_agg(jsonb_build_object('weekday', d, 'starts', '09:00', 'ends', '17:00')) from generate_series(1, 7) as d),
    'days_off', jsonb_build_array(to_char(current_date + 10, 'YYYY-MM-DD')),
    'notice_hours', 24, 'horizon_days', 30))$$,
  'hours 09:00-17:00 every day, one day off, 24 h notice, 30 days ahead');
-- Fable review 2026-10-28: JSON 24.0 is a whole number and is stored, not a raw 22P02.
select lives_ok($$select public.ops_save_consult('{"notice_hours": 24.0, "horizon_days": 30.0}'::jsonb)$$, 'notice and horizon written as 24.0 and 30.0 are taken');
select is((select array[notice_hours, horizon_days] from public.consult_settings where id = 1), array[24, 30]::int[], '24.0 and 30.0 are stored as 24 and 30');
select is(pg_temp.outcome($$select public.book_consultation('en', pg_temp.consult(pg_temp.dubai(current_date + 3, '20:00')))$$),
  'almar:slot_outside_hours {}', 'a slot outside the hours is refused');
select is(pg_temp.outcome($$select public.book_consultation('en', pg_temp.consult(pg_temp.dubai(current_date + 3, '10:15')))$$),
  'almar:slot_outside_hours {}', 'a slot off the 30-minute grid is refused');
select is(pg_temp.outcome($$select public.book_consultation('en', pg_temp.consult(pg_temp.dubai(current_date + 10, '10:00')))$$),
  'almar:slot_outside_hours {}', 'a slot on a day off is refused');
select is((select count(*)::int from public.consult_slots(current_date + 10, current_date + 10)), 0, 'consult_slots offers nothing on a day off');
select is((select count(*)::int from public.consult_slots(current_date + 3, current_date + 3)), 16, 'consult_slots offers the 16 half hours of 09:00-17:00');
select is((select count(*)::int from public.consult_slots(current_date, current_date + 40) s where public.consult_slot_refusal(s.slot_start, now()) is not null), 0,
  'every start consult_slots offers is one consult_slot_refusal accepts (the two stay in step)');
select is((select count(*)::int from public.consult_slots(current_date - 5, current_date) s where s.slot_start < now() + interval '24 hours'), 0,
  'consult_slots offers nothing inside the notice');
select is(pg_temp.outcome($$select public.consult_slots(current_date, current_date + 63)$$), 'almar:invalid {"field": "range", "locale": null}',
  'consult_slots reads at most 62 days ahead');
select lives_ok($$select public.ops_save_consult(jsonb_build_object(
    'hours', (select jsonb_agg(jsonb_build_object('weekday', d, 'starts', '00:00', 'ends', '24:00')) from generate_series(1, 7) as d)))$$,
  'hours all day every day (the day off and the settings stay)');
select is(pg_temp.outcome($$select public.book_consultation('en', pg_temp.consult(pg_temp.next_slot('1 hour')))$$),
  'almar:slot_too_soon {}', 'a slot inside the notice is refused');
select is(pg_temp.outcome($$select public.book_consultation('en', pg_temp.consult(pg_temp.next_slot('31 days')))$$),
  'almar:slot_too_far {}', 'a slot past the horizon is refused');
insert into t6 select 'b1', public.book_consultation('ar', pg_temp.consult(pg_temp.next_slot('2 days')));
select is((select v ->> 'slot_start' from t6 where k = 'b1'), pg_temp.iso_ms(pg_temp.next_slot('2 days')), 'a free slot is booked');
select is((select array[r.kind, r.locale, r.email, b.status] from public.consult_bookings b join public.site_requests r on r.id = b.request_id
           where b.id = (select (v ->> 'booking_id')::uuid from t6 where k = 'b1')),
  array['consultation', 'ar', 'zz6-guest@example.com', 'booked'], 'with its request in the same transaction');
select is(pg_temp.outcome($$select public.book_consultation('en', pg_temp.consult(pg_temp.next_slot('2 days')))$$),
  'almar:slot_taken {}', 'the same slot cannot be booked twice');
select ok(not exists (select 1 from public.consult_slots(current_date, current_date + 5) s where s.slot_start = pg_temp.next_slot('2 days')),
  'consult_slots no longer offers the booked slot');
select ok(exists (select 1 from public.consult_slots(current_date, current_date + 5) s where s.slot_start = pg_temp.next_slot('2 days') + interval '30 minutes'),
  'consult_slots offers the next half hour');
select throws_ok($$select public.ops_cancel_consultation((select (v ->> 'booking_id')::uuid from t6 where k = 'b1'), '00000000-0000-4000-8000-000000000651')$$,
  'P0001', 'almar:not_owner', 'only the owner cancels');
select is((public.ops_cancel_consultation((select (v ->> 'booking_id')::uuid from t6 where k = 'b1'), '00000000-0000-4000-8000-000000000653')) ->> 'status',
  'cancelled', 'the owner cancels the booking');
select ok(exists (select 1 from public.consult_slots(current_date, current_date + 5) s where s.slot_start = pg_temp.next_slot('2 days')),
  'consult_slots offers the cancelled slot again');
select is(pg_temp.outcome($$select public.book_consultation('en', pg_temp.consult(pg_temp.next_slot('2 days')))$$),
  'saved', 'a cancelled slot can be booked again');
select is((select count(*)::int from public.consult_bookings where slot_start = pg_temp.next_slot('2 days')), 2, 'one cancelled and one booked row on that start');
select throws_ok($$insert into public.consult_bookings (slot_start, request_id) values (pg_temp.next_slot('2 days'), (select request_id from public.consult_bookings limit 1))$$,
  '23505', null, 'the database itself refuses a second booked row on one start');
select is(pg_temp.outcome($$select public.book_consultation('en', jsonb_build_object('name', 'Zz6', 'email', 'zz6@example.com', 'slot_start', 'tomorrow', 'time_zone', 'Asia/Dubai'))$$),
  'almar:invalid {"field": "payload", "locale": null}', 'a malformed slot start is refused');

-- Packages (06-06) ------------------------------------------------------------------------------------------------------
insert into t6 select 'tier', public.ops_save_journey_tier('{"slug": "zz6-new-tier", "media_id": "00000000-0000-4000-8000-0000000006a1", "translations": {"en": {"name": "New", "price_label": "On request"}, "ar": {"name": "جديد", "price_label": "عند الطلب"}, "es": {"name": "Nuevo", "price_label": "A consultar"}}}'::jsonb);
select is((select array[slug, is_published::text] from public.journey_tiers where id = (select (v ->> 'id')::uuid from t6 where k = 'tier')),
  array['zz6-new-tier', 'false'], 'a package is created, unpublished');
select is(pg_temp.outcome($$select public.ops_save_journey_tier('{"translations": {"en": {"name": "No slug", "price_label": "x"}}}'::jsonb)$$),
  'almar:invalid {"field": "slug", "locale": null}', 'a new package needs its slug');
select is(pg_temp.outcome(format($$select public.ops_save_journey_tier('{"id": "%s", "slug": "zz6-new-tier-two"}'::jsonb)$$, (select v ->> 'id' from t6 where k = 'tier'))),
  'saved', 'an unpublished package may change its slug');
select is((public.ops_publish('journey_tier', (select (v ->> 'id')::uuid from t6 where k = 'tier'), true)) ->> 'ok', 'true', 'the package publishes');
select is(pg_temp.outcome(format($$select public.ops_save_journey_tier('{"id": "%s", "slug": "zz6-other"}'::jsonb)$$, (select v ->> 'id' from t6 where k = 'tier'))),
  'almar:invalid {"field": "slug", "locale": null}', 'a published package keeps its slug');
select is(pg_temp.outcome(format($$select public.ops_save_journey_tier('{"id": "%s", "legs": [{"destination_id": "00000000-0000-4000-8000-0000000006d1", "stay_id": "00000000-0000-4000-8000-0000000006e1", "translations": {"en": {"nights_label": "3 nights"}}}, {"destination_id": "00000000-0000-4000-8000-0000000006d2"}]}'::jsonb)$$, (select v ->> 'id' from t6 where k = 'tier'))),
  'saved', 'two legs are saved');
select is((select count(*)::int from public.journey_tier_legs where tier_id = (select (v ->> 'id')::uuid from t6 where k = 'tier')), 2, 'the package has two legs');
select is(pg_temp.outcome(format($$select public.ops_save_journey_tier('{"id": "%s", "legs": [{"destination_id": "00000000-0000-4000-8000-0000000006d2", "stay_id": "00000000-0000-4000-8000-0000000006e3"}]}'::jsonb)$$, (select v ->> 'id' from t6 where k = 'tier'))),
  'saved', 'the legs are replaced whole');
select is((select array_agg(destination_id) from public.journey_tier_legs where tier_id = (select (v ->> 'id')::uuid from t6 where k = 'tier')),
  array['00000000-0000-4000-8000-0000000006d2']::uuid[], 'one leg left');
select is(pg_temp.outcome(format($$select public.ops_save_journey_tier('{"id": "%s", "legs": [{"destination_id": "00000000-0000-4000-8000-0000000006d2", "stay_id": "00000000-0000-4000-8000-0000000006e1"}]}'::jsonb)$$, (select v ->> 'id' from t6 where k = 'tier'))),
  'almar:invalid {"field": "legs.0.stay_id", "locale": null}', 'a leg''s stay belongs to its destination');
select is(pg_temp.outcome(format($$select public.ops_save_journey_tier('{"id": "%s", "addon_ids": ["00000000-0000-4000-8000-0000000006c2"]}'::jsonb)$$, (select v ->> 'id' from t6 where k = 'tier'))),
  'almar:invalid {"field": "addon_ids", "locale": null}', 'the home pickup is never an included add-on');
select is(pg_temp.outcome(format($$select public.ops_save_journey_tier('{"id": "%s", "addon_ids": ["00000000-0000-4000-8000-0000000006c1", "00000000-0000-4000-8000-0000000006c3"]}'::jsonb)$$, (select v ->> 'id' from t6 where k = 'tier'))),
  'saved', 'add-ons are saved');
select is((public.ops_get('journey_tier', (select (v ->> 'id')::uuid from t6 where k = 'tier')) -> 'addon_ids'),
  '["00000000-0000-4000-8000-0000000006c1", "00000000-0000-4000-8000-0000000006c3"]'::jsonb, 'ops_get returns the add-ons in order');
select is(jsonb_array_length(public.ops_get('journey_tier', (select (v ->> 'id')::uuid from t6 where k = 'tier')) -> 'legs'), 1, 'ops_get returns the legs');
select is(pg_temp.outcome(format($$select public.ops_delete('journey_tier', '%s')$$, (select v ->> 'id' from t6 where k = 'tier'))),
  'almar:published {}', 'a published package is not deleted');
select is(pg_temp.outcome($$select public.ops_delete('journey_tier', '00000000-0000-4000-8000-0000000006f2')$$), 'saved', 'an unpublished package is deleted');
select is((select count(*)::int from public.journey_tier_legs where id = '00000000-0000-4000-8000-000000000673'), 0, 'with its legs');

-- Import (06-01 Task 4, T-06-09) ---------------------------------------------------------------------------------------
insert into t6 select 'import1', public.import_site_content('{
  "page_sections": [{"id": "00000000-0000-4000-8000-000000000606", "page": "contact", "section": "confidence"}],
  "page_section_translations": [{"section_id": "00000000-0000-4000-8000-000000000606", "locale": "en", "status": "published", "heading": "Zz6 confidence"}],
  "nav_links": [{"id": "00000000-0000-4000-8000-000000000643", "area": "footer", "position": 1, "link_kind": "internal", "target": "plan-with-us"}],
  "nav_link_translations": [{"link_id": "00000000-0000-4000-8000-000000000643", "locale": "en", "status": "published", "label": "Plan with us"}]
}'::jsonb);
select is((select v from t6 where k = 'import1') - 'page_section_media' - 'page_items' - 'page_item_translations' - 'posts' - 'post_translations'
    - 'post_blocks' - 'post_block_translations',
  '{"page_sections": 1, "page_section_translations": 1, "nav_links": 1, "nav_link_translations": 1}'::jsonb, 'the import writes each row once');
select is((select sum(e.value::int)::int from jsonb_each_text(public.import_site_content('{
  "page_sections": [{"id": "00000000-0000-4000-8000-000000000606", "page": "contact", "section": "confidence"}],
  "page_section_translations": [{"section_id": "00000000-0000-4000-8000-000000000606", "locale": "en", "status": "published", "heading": "Zz6 confidence"}],
  "nav_links": [{"id": "00000000-0000-4000-8000-000000000643", "area": "footer", "position": 1, "link_kind": "internal", "target": "plan-with-us"}],
  "nav_link_translations": [{"link_id": "00000000-0000-4000-8000-000000000643", "locale": "en", "status": "published", "label": "Plan with us"}]
}'::jsonb)) as e), 0, 'a second import writes nothing');
select is(pg_temp.outcome($$select public.import_site_content('{"page_items": [{"section_id": "00000000-0000-4000-8000-000000000604", "slug": "zz6-sample", "is_sample": true, "sample_fields": ["title"]}]}'::jsonb)$$),
  'almar:invalid {"field": "page_items.is_sample", "locale": null}', 'a sample row is refused');
select is(pg_temp.outcome($$select public.import_site_content('{"page_section_media": [{"section_id": "00000000-0000-4000-8000-000000000606", "slot": "images", "position": 0, "media_id": "00000000-0000-4000-8000-0000000006ff"}]}'::jsonb)$$),
  'almar:invalid {"field": "page_section_media.media_id", "locale": null}', 'a picture the library does not hold is refused');
select is(pg_temp.outcome($$select public.import_site_content('{"stays": []}'::jsonb)$$),
  'almar:invalid {"field": "payload.stays", "locale": null}', 'an unknown key is refused');

select is((select array_agg(p.provolatile::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('site_request_date_ok', 'site_request_payload_ok')), array['s', 's'],
  'the request payload checks are stable (they cast to date and timestamptz)');

select * from finish();
rollback;
