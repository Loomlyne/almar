-- pgTAP: the Arabic and Spanish access notes (plan 03.2-15, migration 20261019140000_stay_access_notes_i18n.sql). Runs
-- as the postgres owner inside one transaction that is rolled back: nothing it creates stays in the database.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

-- Fixture rows -----------------------------------------------------------------------------------------------
insert into public.media (id, key, width, height, source) values
  ('00000000-0000-4000-8000-0000000015a1', 'test/notes-hero.webp', 1600, 1000, 'import');
insert into public.destinations (id, slug, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000015d1', 'test-notes-destination', '00000000-0000-4000-8000-0000000015a1', false, 1);
insert into public.stays (id, slug, destination_id, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000015e1', 'test-notes-stay', '00000000-0000-4000-8000-0000000015d1', '00000000-0000-4000-8000-0000000015a1', false, 1);

-- The columns ------------------------------------------------------------------------------------------------
select has_column('public', 'stay_access', 'notes_ar', 'stay_access has notes_ar');
select has_column('public', 'stay_access', 'notes_es', 'stay_access has notes_es');
select col_type_is('public', 'stay_access', 'notes_ar', 'text', 'notes_ar is text');
select col_type_is('public', 'stay_access', 'notes_es', 'text', 'notes_es is text');
select col_is_null('public', 'stay_access', 'notes_ar', 'notes_ar may be null');
select col_is_null('public', 'stay_access', 'notes_es', 'notes_es may be null');
select col_hasnt_default('public', 'stay_access', 'notes_ar', 'notes_ar has no default');
select col_hasnt_default('public', 'stay_access', 'notes_es', 'notes_es has no default');

-- The checks: at most 2,000 characters, like notes -----------------------------------------------------------------
select throws_ok(
  $$insert into public.stay_access (stay_id, notes_ar) values ('00000000-0000-4000-8000-0000000015e1', repeat('ن', 2001))$$,
  '23514', null, 'notes_ar over 2,000 characters is refused'
);
select throws_ok(
  $$insert into public.stay_access (stay_id, notes_es) values ('00000000-0000-4000-8000-0000000015e1', repeat('n', 2001))$$,
  '23514', null, 'notes_es over 2,000 characters is refused'
);
select lives_ok(
  $$insert into public.stay_access (stay_id, notes_ar, notes_es) values ('00000000-0000-4000-8000-0000000015e1', repeat('ن', 2000), repeat('n', 2000))$$,
  'exactly 2,000 characters is taken'
);
delete from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000015e1';

-- ops_save_stay_access: present is set, absent is untouched, empty is null -------------------------------------
select lives_ok(
  $$select public.ops_save_stay_access('{"stay_id": "00000000-0000-4000-8000-0000000015e1", "access": {"notes": " [en] ", "notes_ar": " [ar] ", "notes_es": "[es]", "door_code": " 12 "}}'::jsonb)$$,
  'a save with the three notes runs'
);
select is((select notes from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000015e1'), '[en]', 'notes saved, trimmed');
select is((select notes_ar from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000015e1'), '[ar]', 'notes_ar saved, trimmed');
select is((select notes_es from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000015e1'), '[es]', 'notes_es saved');

select lives_ok(
  $$select public.ops_save_stay_access('{"stay_id": "00000000-0000-4000-8000-0000000015e1", "access": {"notes": "[en 2]"}}'::jsonb)$$,
  'a save with the English only runs'
);
select is((select notes_ar from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000015e1'), '[ar]', 'notes_ar absent: untouched');
select is((select notes_es from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000015e1'), '[es]', 'notes_es absent: untouched');
select is((select door_code from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000015e1'), ' 12 ', 'the door code is untouched and still exact');

select lives_ok(
  $$select public.ops_save_stay_access('{"stay_id": "00000000-0000-4000-8000-0000000015e1", "access": {"notes_ar": "", "notes_es": "  "}}'::jsonb)$$,
  'a save with empty translations runs'
);
select is((select notes_ar from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000015e1'), null, 'notes_ar empty: null');
select is((select notes_es from public.stay_access where stay_id = '00000000-0000-4000-8000-0000000015e1'), null, 'notes_es blank: null');

-- The wall: anon and authenticated read nothing of stay_access and cannot call the save ---------------------------
set local role anon;
select throws_ok($$select notes_ar, notes_es from public.stay_access$$, '42501', null, 'anon cannot read the translated notes');
select throws_ok($$select public.ops_save_stay_access('{}'::jsonb)$$, '42501', null, 'anon cannot call ops_save_stay_access');
reset role;
set local role authenticated;
select throws_ok($$select notes_ar, notes_es from public.stay_access$$, '42501', null, 'a signed-in guest cannot read the translated notes');
select throws_ok($$select public.ops_save_stay_access('{}'::jsonb)$$, '42501', null, 'a signed-in guest cannot call ops_save_stay_access');
reset role;

select * from finish();
rollback;
