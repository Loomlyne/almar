-- pgTAP (plan 02-06, PR #14 review): public.save_site_settings saves the settings row and the owner's language and
-- currency in one transaction. Only the service role may call it; a bad input changes nothing; success changes both.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Seed: the owner and a guest through the auth trigger (a confirmed email makes the profile) ------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000002c1', 'maria@almarprivatejourney.com', now()),
  ('00000000-0000-4000-8000-0000000002c2', 'guest-save-settings@example.com', now());
insert into public.media (id, key, width, height, bytes, content_type, sha256, source) values
  ('00000000-0000-4000-8000-0000000002c3', 'brand/save-test.webp', 512, 512, 2048, 'image/webp', repeat('d', 64), 'upload'),
  ('00000000-0000-4000-8000-0000000002c4', 'brand/too-big.png', 512, 512, 1048577, 'image/png', repeat('e', 64), 'upload');
update public.site_settings
   set teal = null, charcoal = null, gold = null, ivory = null, white = null, vat_percent = 5, deposit_percent = 30,
       maintenance = false, logo_media_id = null
 where id = 1;
update public.profiles set locale = 'en', currency = 'AED' where id = '00000000-0000-4000-8000-0000000002c1';

create temp table before_row as
  select s.teal, s.vat_percent, s.deposit_percent, s.maintenance, s.logo_media_id, p.locale, p.currency
    from public.site_settings s, public.profiles p
   where s.id = 1 and p.id = '00000000-0000-4000-8000-0000000002c1';
grant select on before_row to service_role;

-- Who may call it -------------------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.save_site_settings(uuid, text, text, text, text, text, text, text, numeric, numeric, boolean, uuid, text, text)', 'execute'),
  'anon cannot execute save_site_settings');
select ok(not has_function_privilege('authenticated', 'public.save_site_settings(uuid, text, text, text, text, text, text, text, numeric, numeric, boolean, uuid, text, text)', 'execute'),
  'authenticated cannot execute save_site_settings');
select ok(has_function_privilege('service_role', 'public.save_site_settings(uuid, text, text, text, text, text, text, text, numeric, numeric, boolean, uuid, text, text)', 'execute'),
  'the service role can');
select is((select prosecdef from pg_proc where proname = 'save_site_settings'), true, 'it is security definer');
select is((select proconfig from pg_proc where proname = 'save_site_settings'), array['search_path=""'], 'its search_path is fixed to empty');

set local role anon;
select throws_ok($$select public.save_site_settings('00000000-0000-4000-8000-0000000002c1', null, null, null, null, null, 'Questa', 'Lato', 9, 30, true, null, 'ar', 'USD')$$,
  '42501', null, 'an anon call is refused');
reset role;
set local role authenticated;
select throws_ok($$select public.save_site_settings('00000000-0000-4000-8000-0000000002c1', null, null, null, null, null, 'Questa', 'Lato', 9, 30, true, null, 'ar', 'USD')$$,
  '42501', null, 'a signed-in call is refused');
reset role;

-- Bad input changes nothing ---------------------------------------------------------------------------------------------
set local role service_role;
select throws_ok($$select public.save_site_settings('00000000-0000-4000-8000-0000000002c1', '#1F3B40', null, null, null, null, 'Questa', 'Lato', 9, 30, true, null, 'ar', 'USD')$$,
  '22023', null, 'an upper-case colour is refused');
select throws_ok($$select public.save_site_settings('00000000-0000-4000-8000-0000000002c1', null, null, null, null, null, 'Questa', 'Lato', 7.555, 30, true, null, 'ar', 'USD')$$,
  '22023', null, 'a percent with three places is refused');
select throws_ok($$select public.save_site_settings('00000000-0000-4000-8000-0000000002c1', null, null, null, null, null, 'Questa', 'Lato', 9, 30, true, null, 'fr', 'USD')$$,
  '22023', null, 'a language outside en/ar/es is refused');
select throws_ok($$select public.save_site_settings('00000000-0000-4000-8000-0000000002c1', null, null, null, null, null, 'Questa', 'Lato', 9, 30, true, '00000000-0000-4000-8000-0000000002c4', 'ar', 'USD')$$,
  '22023', null, 'a logo over 1 MB is refused');
select throws_ok($$select public.save_site_settings('00000000-0000-4000-8000-0000000002c2', null, null, null, null, null, 'Questa', 'Lato', 9, 30, true, null, 'ar', 'USD')$$,
  '42501', null, 'a guest profile is not the owner');
select results_eq(
  $$select s.teal, s.vat_percent, s.deposit_percent, s.maintenance, s.logo_media_id, p.locale, p.currency
      from public.site_settings s, public.profiles p where s.id = 1 and p.id = '00000000-0000-4000-8000-0000000002c1'$$,
  $$select * from before_row$$,
  'after every refusal the settings row and her profile are as before');

-- Success changes both ------------------------------------------------------------------------------------------------
select lives_ok($$select public.save_site_settings('00000000-0000-4000-8000-0000000002c1', '#7a1f3b', null, null, null, null, 'Questa', 'Lato', 7.50, null, true, '00000000-0000-4000-8000-0000000002c3', 'ar', 'USD')$$,
  'a valid save goes through');
select results_eq(
  $$select s.teal, s.vat_percent, s.deposit_percent, s.maintenance, s.logo_media_id, p.locale, p.currency
      from public.site_settings s, public.profiles p where s.id = 1 and p.id = '00000000-0000-4000-8000-0000000002c1'$$,
  $$values ('#7a1f3b'::text, 7.50::numeric(5,2), null::numeric(5,2), true, '00000000-0000-4000-8000-0000000002c3'::uuid, 'ar'::text, 'USD'::text)$$,
  'the settings row and her language and currency both changed');
reset role;

select * from finish();
rollback;
