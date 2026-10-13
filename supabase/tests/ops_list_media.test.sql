-- pgTAP: ops_list_media, one page of the photo library searched and paged in SQL (job 03.2-09b, review of PR #4,
-- finding 3). Same semantics as the Worker's old mediaPage(): byte key order then id, q folded (case and accents) over
-- the key and the English alt only, a page never ends between two rows of one imported key, next = the page's last key.
-- Rows use the prefix zz9b/ and every call starts after zz9a.webp, so other rows in the table never count.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into public.media (id, key, width, height, bytes, sha256, source) values
  ('00000000-0000-4000-8000-0000000009b1', 'zz9b/a01.webp', 1600, 1000, 100, repeat('a', 64), 'import'),
  ('00000000-0000-4000-8000-0000000009b2', 'zz9b/a02.webp', 1600, 1000, 100, repeat('b', 64), 'import'),
  ('00000000-0000-4000-8000-0000000009b4', 'zz9b/a03.webp', 1600, 1000, 100, repeat('c', 64), 'import'),
  ('00000000-0000-4000-8000-0000000009b3', 'zz9b/a03.webp', 1200, 800, 100, repeat('c', 64), 'import'),
  ('00000000-0000-4000-8000-0000000009b5', 'zz9b/a-1.webp', 1600, 1000, 100, repeat('d', 64), 'upload'),
  ('00000000-0000-4000-8000-0000000009b6', 'zz9b/a_1.webp', 1600, 1000, 100, repeat('e', 64), 'upload');
insert into public.image_translations (image_id, locale, alt, status) values
  ('00000000-0000-4000-8000-0000000009b1', 'en', 'Plaza in Bogotá', 'published'),
  ('00000000-0000-4000-8000-0000000009b2', 'en', 'Pool at dusk', 'published'),
  ('00000000-0000-4000-8000-0000000009b2', 'es', 'Piscina', 'draft'),
  ('00000000-0000-4000-8000-0000000009b4', 'en', 'Courtyard', 'published'),
  ('00000000-0000-4000-8000-0000000009b3', 'en', 'Courtyard, second id', 'published'),
  ('00000000-0000-4000-8000-0000000009b5', 'en', 'Upload one', 'published'),
  ('00000000-0000-4000-8000-0000000009b6', 'en', 'Upload two 100% real', 'published');

-- Grants ----------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.ops_list_media(text, text, int)', 'execute'), 'anon cannot call ops_list_media');
select ok(not has_function_privilege('authenticated', 'public.ops_list_media(text, text, int)', 'execute'), 'authenticated cannot call ops_list_media');
select ok(has_function_privilege('service_role', 'public.ops_list_media(text, text, int)', 'execute'), 'service_role can call ops_list_media');
select ok(not has_function_privilege('anon', 'public.media_fold(text)', 'execute'), 'anon cannot call media_fold');

-- Order and paging --------------------------------------------------------------------------------------------------
-- Byte order: '-' (2d) < '0' (30) < '_' (5f), the order the Worker's cursor compares in.
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media(null, 'zz9a.webp', 60) -> 'items') i),
  '["zz9b/a-1.webp", "zz9b/a01.webp", "zz9b/a02.webp", "zz9b/a03.webp", "zz9b/a03.webp", "zz9b/a_1.webp"]'::jsonb,
  'every row after the cursor, in byte key order');
select is(public.ops_list_media(null, 'zz9a.webp', 60) -> 'next', 'null'::jsonb, 'next is null when nothing follows');
select is(
  (select jsonb_agg(i ->> 'id') from jsonb_array_elements(public.ops_list_media(null, 'zz9b/a02.webp', 1) -> 'items') i),
  '["00000000-0000-4000-8000-0000000009b3", "00000000-0000-4000-8000-0000000009b4"]'::jsonb,
  'two rows of one key come together, ordered by id, even past the limit');
select is(public.ops_list_media(null, 'zz9b/a02.webp', 1) ->> 'next', 'zz9b/a03.webp', 'next is that key');
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media(null, 'zz9a.webp', 2) -> 'items') i),
  '["zz9b/a-1.webp", "zz9b/a01.webp"]'::jsonb, 'limit 2 is two rows');
select is(public.ops_list_media(null, 'zz9a.webp', 2) ->> 'next', 'zz9b/a01.webp', 'next is the last key of the page');
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media(null, 'zz9b/a01.webp', 2) -> 'items') i),
  '["zz9b/a02.webp", "zz9b/a03.webp", "zz9b/a03.webp"]'::jsonb, 'the next page starts after the cursor and keeps a key whole');
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media(null, 'zz9b/a03.webp', 60) -> 'items') i),
  '["zz9b/a_1.webp"]'::jsonb, 'after the shared key: no row of it again');
select is(public.ops_list_media(null, 'zz9b/zzz.webp', 60), '{"items": [], "next": null}'::jsonb, 'past the end: an empty page');

-- Search ----------------------------------------------------------------------------------------------------------------
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media('BOGOTA', 'zz9a.webp', 60) -> 'items') i),
  '["zz9b/a01.webp"]'::jsonb, 'q folds case');
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media('  bogotá ', 'zz9a.webp', 60) -> 'items') i),
  '["zz9b/a01.webp"]'::jsonb, 'q folds accents and is trimmed');
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media('dusk', 'zz9a.webp', 60) -> 'items') i),
  '["zz9b/a02.webp"]'::jsonb, 'q searches the English alt');
select is(public.ops_list_media('piscina', 'zz9a.webp', 60) -> 'items', '[]'::jsonb, 'only the English alt is searched');
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media('A_1', 'zz9a.webp', 60) -> 'items') i),
  '["zz9b/a_1.webp"]'::jsonb, 'q searches the key; _ is a plain character, not a LIKE wildcard');
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media('100%', 'zz9a.webp', 60) -> 'items') i),
  '["zz9b/a_1.webp"]'::jsonb, '% is a plain character');
select is(
  (select jsonb_array_length(public.ops_list_media('', 'zz9a.webp', 60) -> 'items')), 6, 'an empty q is no filter');
select is(
  (select jsonb_agg(i ->> 'key') from jsonb_array_elements(public.ops_list_media('courtyard', 'zz9a.webp', 1) -> 'items') i),
  '["zz9b/a03.webp", "zz9b/a03.webp"]'::jsonb, 'search and paging together keep a key whole');

-- Shape -----------------------------------------------------------------------------------------------------------------
select is(
  (select i from jsonb_array_elements(public.ops_list_media('dusk', 'zz9a.webp', 60) -> 'items') i),
  jsonb_build_object(
    'id', '00000000-0000-4000-8000-0000000009b2', 'key', 'zz9b/a02.webp', 'width', 1600, 'height', 1000,
    'content_type', null, 'source', 'import',
    'alt', jsonb_build_object('en', 'Pool at dusk', 'ar', null, 'es', 'Piscina'),
    'alt_status', jsonb_build_object('en', 'published', 'ar', 'missing', 'es', 'draft'),
    'used_by', 0),
  'an item has the fields of an ops_list(''media'') row');
select is(public.media_fold('Árbol ÇA Ñandú'), 'arbol ca nandu', 'media_fold: NFD, marks removed, lower case');

-- Refusals --------------------------------------------------------------------------------------------------------------
select throws_ok($$select public.ops_list_media(null, null, 0)$$, 'P0001', 'almar:invalid', 'limit 0 is refused');
select throws_ok($$select public.ops_list_media(null, null, 61)$$, 'P0001', 'almar:invalid', 'limit 61 is refused');
select throws_ok($$select public.ops_list_media(repeat('x', 101), null, 60)$$, 'P0001', 'almar:invalid', 'a q over 100 characters is refused');
select throws_ok($$select public.ops_list_media(null, '../x.webp', 60)$$, 'P0001', 'almar:invalid', 'an after that is not a media key is refused');

select * from finish();
rollback;
