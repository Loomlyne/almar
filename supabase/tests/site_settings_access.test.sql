-- pgTAP (plan 02-06): what the anonymous key may read of site_settings for the public build. Exactly maintenance and
-- brand (colours, faces, the logo's media key) through api_site_settings; never VAT, deposit, balance days; never a write.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Seed as the owner of the tables ---------------------------------------------------------------------------------
insert into public.media (id, key, width, height, bytes, content_type, sha256, source) values
  ('00000000-0000-4000-8000-0000000002a1', 'brand/logo-test.webp', 512, 512, 2048, 'image/webp', repeat('b', 64), 'upload'),
  ('00000000-0000-4000-8000-0000000002a2', 'brand/not-the-logo.webp', 512, 512, 2048, 'image/webp', repeat('c', 64), 'upload');
update public.site_settings
   set maintenance = true, teal = '#1f3b40', gold = '#d4ba8a', vat_percent = 5.00, deposit_percent = 30.00,
       balance_due_days = 14, logo_media_id = '00000000-0000-4000-8000-0000000002a1'
 where id = 1;

-- Shape -------------------------------------------------------------------------------------------------------------
select columns_are('public', 'api_site_settings',
  array['maintenance', 'teal', 'charcoal', 'gold', 'ivory', 'white', 'title_face', 'body_face', 'logo_key'],
  'api_site_settings has exactly maintenance, the five colours, the two faces and the logo key');
select hasnt_column('public', 'site_settings', 'logo_bytes', 'no logo bytes in the table (the logo is an R2 media row)');
select hasnt_column('public', 'site_settings', 'logo_type', 'no logo type column either');
select hasnt_view('public', 'site_settings_public', 'job 02''s security-definer view is gone');

-- Checks --------------------------------------------------------------------------------------------------------------
select throws_ok($$update public.site_settings set teal = 'teal' where id = 1$$, '23514', null, 'a colour must be #rrggbb');
select throws_ok($$update public.site_settings set teal = '#1F3B40' where id = 1$$, '23514', null, 'a colour is stored in lower case');
select throws_ok($$update public.site_settings set title_face = 'Arial' where id = 1$$, '23514', null, 'the title face is Questa');
select throws_ok($$update public.site_settings set body_face = 'Arial' where id = 1$$, '23514', null, 'the body face is Lato');
select throws_ok($$update public.site_settings set vat_percent = 100.01 where id = 1$$, '23514', null, 'VAT is at most 100');
select throws_ok($$update public.site_settings set deposit_percent = -1 where id = 1$$, '23514', null, 'a deposit is not negative');
select lives_ok($$update public.site_settings set vat_percent = null, deposit_percent = 0 where id = 1$$, 'VAT may be empty and a deposit 0');
select throws_ok($$delete from public.media where id = '00000000-0000-4000-8000-0000000002a1'$$, '23503', null,
  'the saved logo cannot be deleted from the library');

-- anon ----------------------------------------------------------------------------------------------------------------
set local role anon;
select results_eq(
  $$select maintenance, teal, gold, title_face, body_face, logo_key from public.api_site_settings$$,
  $$values (true, '#1f3b40'::text, '#d4ba8a'::text, 'Questa'::text, 'Lato'::text, 'brand/logo-test.webp'::text)$$,
  'anon reads maintenance, brand and the logo key');
select is((select count(*)::int from public.api_site_settings), 1, 'one row');
select throws_ok($$select vat_percent from public.site_settings$$, '42501', null, 'anon cannot read VAT');
select throws_ok($$select deposit_percent from public.site_settings$$, '42501', null, 'anon cannot read the deposit');
select throws_ok($$select balance_due_days from public.site_settings$$, '42501', null, 'anon cannot read balance days');
select throws_ok($$select * from public.site_settings$$, '42501', null, 'anon cannot select every column');
select throws_ok($$update public.site_settings set maintenance = false where id = 1$$, '42501', null, 'anon cannot update settings');
select throws_ok($$insert into public.site_settings (id) values (1)$$, '42501', null, 'anon cannot insert settings');
select throws_ok($$delete from public.site_settings$$, '42501', null, 'anon cannot delete settings');
select ok(not has_table_privilege('anon', 'public.api_site_settings', 'INSERT, UPDATE, DELETE'), 'anon has no write privilege on the view');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000002a1'), 1, 'anon sees the logo''s media row');
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000002a2'), 0, 'not another upload');
reset role;

-- authenticated reads nothing of it (the build uses anon; a signed-in guest has no reason to) ----------------------------
set local role authenticated;
select throws_ok($$select * from public.api_site_settings$$, '42501', null, 'authenticated cannot read the view');
select throws_ok($$select maintenance from public.site_settings$$, '42501', null, 'authenticated cannot read the table');
reset role;

-- Clearing the logo hides the media row again ---------------------------------------------------------------------------
update public.site_settings set logo_media_id = null where id = 1;
set local role anon;
select is((select count(*)::int from public.media where id = '00000000-0000-4000-8000-0000000002a1'), 0, 'a cleared logo is private again');
reset role;

select * from finish();
rollback;
