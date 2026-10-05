-- pgTAP: bookings, the 30-minute hold, payments, refunds, disputes, the owner-side booking functions and the two 3.2
-- hand-overs (plan 04-02, Task 1). The seed is written as the postgres owner; privilege checks switch roles.
-- Run: node tests/helpers/local-supabase.mjs test supabase/tests/bookings-and-ops.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(348);

-- Helpers (temporary, gone with the transaction) -----------------------------------------------------------------
create function pg_temp.d(n int) returns date language sql as $$ select ((now() at time zone 'Asia/Dubai')::date + n) $$;

create function pg_temp.line(p_item uuid, p_name text, p_unit text, p_uae boolean, p_home boolean, p_price bigint, p_qty int)
returns jsonb language sql as $$
  select jsonb_build_object('catalog_item_id', p_item, 'name', p_name, 'unit', p_unit, 'is_uae', p_uae, 'is_home_pickup', p_home,
    'unit_price_fils', p_price, 'quantity', p_qty, 'line_fils', p_price * p_qty)
$$;

-- The common payload of both create functions, as lib/booking/server.ts snapshotRow() builds it (symbolic numbers:
-- 1000.00 AED a night, VAT 5 %, deposit 30 %, due 30 days before arrival).
create function pg_temp.pl(p_slug text, p_arrive date, p_leave date, p_email text, p_plan text default 'deposit',
  p_lines jsonb default '[]'::jsonb, p_rate bigint default 100000)
returns jsonb language plpgsql as $$
declare
  n int := p_leave - p_arrive;
  nf bigint := n * p_rate;
  af bigint := coalesce((select sum((l ->> 'line_fils')::bigint) from jsonb_array_elements(p_lines) as l), 0);
  sub bigint := nf + af;
  vat bigint := sub * 5 / 100;
  grand bigint := sub + vat;
  dep bigint := grand * 30 / 100;
  snap jsonb;
begin
  select jsonb_agg(jsonb_build_object('night', to_char(p_arrive + g, 'YYYY-MM-DD'), 'rate_fils', p_rate, 'source', 'base', 'rate_id', null) order by g)
    into snap from generate_series(0, n - 1) as g;
  return jsonb_build_object(
    'stay_slug', p_slug, 'arrive', to_char(p_arrive, 'YYYY-MM-DD'), 'leave', to_char(p_leave, 'YYYY-MM-DD'),
    'adults', 2, 'children', 0, 'infants', 0, 'guest_name', 'Test Guest', 'email', p_email, 'phone', '+971501234567', 'locale', 'en',
    'plan', p_plan, 'is_test', true,
    'nights_fils', nf, 'addons_fils', af, 'subtotal_fils', sub, 'vat_bp', 500, 'vat_fils', vat, 'grand_fils', grand,
    'deposit_bp', 3000,
    'deposit_fils', case when p_plan = 'deposit' then dep else 0 end,
    'balance_fils', case when p_plan = 'deposit' then grand - dep else 0 end,
    'due_now_fils', case when p_plan = 'deposit' then dep else grand end,
    'nights_snapshot', snap,
    'balance_due_date', case when p_plan = 'deposit' then to_char(p_arrive - 30, 'YYYY-MM-DD') end,
    'lines', p_lines);
end $$;

create function pg_temp.trav(a int, c int, i int) returns jsonb language sql as $$
  select coalesce(jsonb_agg(t.j order by t.o), '[]'::jsonb) from (
    select g as o, case when g = 0 then jsonb_build_object('kind', 'adult', 'full_name', 'Booker One', 'is_booker', true, 'not_staying', false)
                        else jsonb_build_object('kind', 'adult', 'full_name', 'Adult ' || g) end as j
      from generate_series(0, a - 1) g
    union all select 100 + g, jsonb_build_object('kind', 'child', 'full_name', 'Child ' || g, 'age', 7) from generate_series(1, c) g
    union all select 200 + g, jsonb_build_object('kind', 'infant', 'full_name', 'Infant ' || g, 'age', 1) from generate_series(1, i) g
  ) t
$$;

create function pg_temp.web(p_slug text, p_arrive date, p_leave date, p_email text, p_plan text default 'deposit',
  p_lines jsonb default '[]'::jsonb)
returns jsonb language sql as $$
  select pg_temp.pl(p_slug, p_arrive, p_leave, p_email, p_plan, p_lines)
    || jsonb_build_object('airport', 'DXB', 'terms_version', 'test-terms', 'travellers', pg_temp.trav(2, 0, 0))
$$;

create function pg_temp.ops(p_slug text, p_arrive date, p_leave date, p_email text, p_hold interval, p_plan text default 'deposit',
  p_lines jsonb default '[]'::jsonb, p_request uuid default gen_random_uuid())
returns jsonb language sql as $$
  select pg_temp.pl(p_slug, p_arrive, p_leave, p_email, p_plan, p_lines)
    || jsonb_build_object('ops_request_id', p_request,
         'hold_until', to_char((now() + p_hold) at time zone 'Asia/Dubai', 'YYYY-MM-DD"T"HH24:MI') || '+04:00')
$$;

create temp table t_res (k text primary key, v jsonb);
create function pg_temp.r(p_key text, p_path text) returns text language sql as $$ select v #>> string_to_array(p_path, '.') from t_res where k = p_key $$;

-- Seed ----------------------------------------------------------------------------------------------------------
insert into public.media (id, key, width, height, bytes, sha256, source) values
  ('00000000-0000-4000-8000-0000000000a1', 'test/hero.webp', 1600, 1000, 12345, repeat('a', 64), 'import');
insert into public.image_translations (image_id, locale, alt, status) values
  ('00000000-0000-4000-8000-0000000000a1', 'en', 'A hero', 'published'),
  ('00000000-0000-4000-8000-0000000000a1', 'ar', 'Arabic draft alt', 'draft');
insert into public.destinations (id, slug, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000000d1', 'dest-one', '00000000-0000-4000-8000-0000000000a1', true, 1),
  ('00000000-0000-4000-8000-0000000000d2', 'dest-two', '00000000-0000-4000-8000-0000000000a1', true, 2);
insert into public.destination_translations (destination_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000000d1', 'en', 'published', 'Destination one'),
  ('00000000-0000-4000-8000-0000000000d2', 'en', 'published', 'Destination two');
insert into public.stays (id, slug, destination_id, max_guests, min_nights, infants_count, base_nightly_rate_aed, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000000e1', 'stay-one', '00000000-0000-4000-8000-0000000000d1', 4, 2, true, 1000.00, '00000000-0000-4000-8000-0000000000a1', true, 1),
  ('00000000-0000-4000-8000-0000000000e2', 'stay-no-rate', '00000000-0000-4000-8000-0000000000d1', null, 1, null, null, '00000000-0000-4000-8000-0000000000a1', true, 2),
  ('00000000-0000-4000-8000-0000000000e3', 'stay-draft', '00000000-0000-4000-8000-0000000000d1', 2, 1, false, 500.00, '00000000-0000-4000-8000-0000000000a1', false, 3),
  ('00000000-0000-4000-8000-0000000000e4', 'stay-two', '00000000-0000-4000-8000-0000000000d2', 6, 1, false, 1000.00, '00000000-0000-4000-8000-0000000000a1', true, 4),
  ('00000000-0000-4000-8000-0000000000e5', 'stay-three', '00000000-0000-4000-8000-0000000000d1', 6, 1, false, 1000.00, '00000000-0000-4000-8000-0000000000a1', true, 5);
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000000e1', 'en', 'published', 'Stay one'),
  ('00000000-0000-4000-8000-0000000000e1', 'ar', 'draft', 'AR draft title'),
  ('00000000-0000-4000-8000-0000000000e1', 'es', 'published', 'Estancia uno'),
  ('00000000-0000-4000-8000-0000000000e3', 'en', 'published', 'Draft stay secret title');
insert into public.stay_rates (stay_id, nights, nightly_rate_aed) values
  ('00000000-0000-4000-8000-0000000000e1', daterange(pg_temp.d(10), pg_temp.d(17)), 900.00);
insert into public.availability_blocks (scope, destination_id, stay_id, starts_on, ends_on) values
  ('stay', null, '00000000-0000-4000-8000-0000000000e1', pg_temp.d(40), pg_temp.d(41)),
  ('destination', '00000000-0000-4000-8000-0000000000d1', null, pg_temp.d(50), pg_temp.d(50)),
  ('all', null, null, pg_temp.d(60), pg_temp.d(60));
insert into public.catalog_items (id, slug, kind, unit, price_aed, is_uae, is_home_pickup, is_published, position) values
  ('00000000-0000-4000-8000-0000000000c1', 'exp-linked', 'experience', 'person', 250.00, false, false, true, 5),
  ('00000000-0000-4000-8000-0000000000c2', 'svc-uae', 'service', 'trip', 100.00, true, false, true, 2),
  ('00000000-0000-4000-8000-0000000000c3', 'svc-home-pickup', 'service', 'trip', 150.00, true, true, true, 1),
  ('00000000-0000-4000-8000-0000000000c4', 'exp-draft', 'experience', 'person', 90.00, false, false, false, 1),
  ('00000000-0000-4000-8000-0000000000c5', 'exp-no-price', 'experience', 'person', null, true, false, true, 1),
  ('00000000-0000-4000-8000-0000000000c6', 'exp-other-destination', 'experience', 'person', 70.00, false, false, true, 1),
  ('00000000-0000-4000-8000-0000000000c7', 'exp-dest-linked', 'experience', 'night', 40.00, false, false, true, 3);
insert into public.catalog_translations (item_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000000c1', 'en', 'published', 'Linked experience'),
  ('00000000-0000-4000-8000-0000000000c1', 'ar', 'draft', 'AR draft name'),
  ('00000000-0000-4000-8000-0000000000c2', 'en', 'published', 'UAE service'),
  ('00000000-0000-4000-8000-0000000000c2', 'ar', 'published', 'AR published name'),
  ('00000000-0000-4000-8000-0000000000c3', 'en', 'published', 'Home pickup'),
  ('00000000-0000-4000-8000-0000000000c7', 'en', 'published', 'Destination experience');
insert into public.catalog_item_stays (item_id, stay_id, position) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000e1', 0);
insert into public.catalog_item_destinations (item_id, destination_id) values
  ('00000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-0000000000d2'),
  ('00000000-0000-4000-8000-0000000000c7', '00000000-0000-4000-8000-0000000000d1');

-- A. Privileges ---------------------------------------------------------------------------------------------------
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
              and c.relname in ('bookings', 'booking_travellers', 'booking_lines', 'booking_nights', 'booking_payments', 'booking_refunds',
                                'booking_disputes', 'booking_events', 'stripe_events', 'booking_hold_requests')),
          10, 'RLS is on for all ten booking tables');

select is((select count(*)::int from information_schema.role_table_grants
            where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
              and table_name in ('bookings', 'booking_travellers', 'booking_lines', 'booking_nights', 'booking_payments', 'booking_refunds',
                                 'booking_disputes', 'booking_events', 'stripe_events', 'booking_hold_requests')),
          0, 'no table privilege is held by anon, authenticated or public on any booking table');

set local role anon;
select throws_ok($$select * from public.bookings$$, '42501', null, 'anon cannot read bookings');
select throws_ok($$select * from public.booking_nights$$, '42501', null, 'anon cannot read booking_nights');
select throws_ok($$select * from public.booking_payments$$, '42501', null, 'anon cannot read booking_payments');
select throws_ok($$select * from public.booking_events$$, '42501', null, 'anon cannot read booking_events');
select throws_ok($$select * from public.stripe_events$$, '42501', null, 'anon cannot read stripe_events');
select throws_ok($$insert into public.booking_hold_requests (email_hash, ip_hash) values ('x', 'y')$$, '42501', null, 'anon cannot write the hold limiter');
select throws_ok($$select public.new_booking_ref()$$, '42501', null, 'anon cannot call new_booking_ref');
select throws_ok($$select public.place_hold(gen_random_uuid(), gen_random_uuid(), current_date, current_date + 1, null)$$, '42501', null, 'anon cannot call place_hold');
select throws_ok($$select public.booking_context('stay-one', current_date, current_date + 1, 'en')$$, '42501', null, 'anon cannot call booking_context');
select lives_ok($$select * from public.public_booked_nights()$$, 'anon may call public_booked_nights');
select lives_ok($$select * from public.api_stay_blocked_days$$, 'anon still reads api_stay_blocked_days');
set local role authenticated;
select throws_ok($$select * from public.bookings$$, '42501', null, 'authenticated cannot read bookings');
select throws_ok($$select public.create_web_booking('{}'::jsonb)$$, '42501', null, 'authenticated cannot call create_web_booking');
select lives_ok($$select * from public.public_booked_nights()$$, 'authenticated may call public_booked_nights');
reset role;

select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (array[
              'booking_set_updated_at', 'booking_fail', 'new_booking_ref', 'booking_lock', 'booking_int', 'booking_txt', 'booking_date',
              'booking_uuid', 'booking_context', 'claim_hold_slot', 'place_hold', 'booking_write', 'create_web_booking',
              'ops_create_booking', 'ops_set_booking_status', 'ops_lapse_holds', 'booking_drop_hold', 'open_payment',
              'attach_checkout_session', 'mark_session_expired', 'record_payment', 'set_payment_card', 'record_refund',
              'record_dispute', 'claim_stripe_event', 'finish_stripe_event', 'drop_stripe_event', 'log_booking_event',
              'public_booked_nights', 'ops_add_block'])
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
          array['public_booked_nights'], 'of the 30 functions of this migration only public_booked_nights is executable by anon or authenticated');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (array[
              'booking_set_updated_at', 'booking_fail', 'new_booking_ref', 'booking_lock', 'booking_int', 'booking_txt', 'booking_date',
              'booking_uuid', 'booking_context', 'claim_hold_slot', 'place_hold', 'booking_write', 'create_web_booking',
              'ops_create_booking', 'ops_set_booking_status', 'ops_lapse_holds', 'booking_drop_hold', 'open_payment',
              'attach_checkout_session', 'mark_session_expired', 'record_payment', 'set_payment_card', 'record_refund',
              'record_dispute', 'claim_stripe_event', 'finish_stripe_event', 'drop_stripe_event', 'log_booking_event',
              'public_booked_nights', 'ops_add_block'])
              and p.prosecdef and has_function_privilege('service_role', p.oid, 'execute')
              and exists (select 1 from unnest(p.proconfig) cfg where cfg = 'search_path=""')),
          30, 'all 30 are definer functions with search_path empty and executable by service_role');

-- B. Names the plan takes from 3.2, and the table shapes -----------------------------------------------------------
select is((select array_agg(a.attname::text order by a.attnum) from pg_attribute a
            where a.attrelid = 'public.api_stay_blocked_days'::regclass and a.attnum > 0 and not a.attisdropped),
          array['stay_id', 'day'], 'api_stay_blocked_days keeps its two columns');
select ok((select 'security_invoker=on' = any (c.reloptions) from pg_class c where c.oid = 'public.api_stay_blocked_days'::regclass),
          'api_stay_blocked_days is still security_invoker');
select ok(has_table_privilege('anon', 'public.api_stay_blocked_days', 'select'), 'anon still has select on api_stay_blocked_days');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'site_settings' and column_name = 'balance_due_days'),
          1, 'site_settings.balance_due_days exists');
select is((select vat_percent from public.site_settings where id = 1), 5.00::numeric, 'B-04: VAT seeded 5.00 where it was empty');
select is((select deposit_percent from public.site_settings where id = 1), 30.00::numeric, 'B-04: deposit seeded 30.00 where it was empty');
select is((select balance_due_days from public.site_settings where id = 1), null, 'balance_due_days stays null (the owner''s N)');

-- C. booking_context ----------------------------------------------------------------------------------------------
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{stay,title}', 'Stay one', 'context: English title');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'ar') #>> '{stay,title}', 'Stay one', 'context: an Arabic draft title is not used, the English one is');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'es') #>> '{stay,title}', 'Estancia uno', 'context: a published Spanish title is used');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{stay,base_rate_fils}', '100000', 'context: base rate in fils');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{stay,destination_name}', 'Destination one', 'context: destination name');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{stay,image_key}', 'test/hero.webp', 'context: image key');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'ar') #>> '{stay,image_alt}', 'A hero', 'context: an Arabic draft alt text is not used');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{stay,min_nights}', '2', 'context: min nights');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{stay,max_guests}', '4', 'context: max guests');
select is(jsonb_array_length(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'night_rates'), 3, 'context: one rate row per night');
select is((public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'night_rates' -> 0) ->> 'rate_fils', '100000', 'context: night before the range uses the base rate');
select is((public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'night_rates' -> 1) ->> 'rate_fils', '90000', 'context: night inside the range uses the range rate (3.2''s stay_night_rates)');
select is((public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'night_rates' -> 1) ->> 'source', 'range', 'context: the source is range');
select is(public.booking_context('stay-one', pg_temp.d(39), pg_temp.d(43), 'en') -> 'blocked', to_jsonb(array[pg_temp.d(40), pg_temp.d(41)]), 'context: ops-blocked days of the stay');
select is(public.booking_context('stay-one', pg_temp.d(49), pg_temp.d(52), 'en') -> 'blocked', to_jsonb(array[pg_temp.d(50)]), 'context: a destination block shows on its stays');
select is(public.booking_context('stay-two', pg_temp.d(49), pg_temp.d(52), 'en') -> 'blocked', '[]'::jsonb, 'context: a destination block does not show on another destination''s stay');
select is(public.booking_context('stay-two', pg_temp.d(59), pg_temp.d(62), 'en') -> 'blocked', to_jsonb(array[pg_temp.d(60)]), 'context: an everything block shows on every stay');
select is((select array_agg(o ->> 'slug' order by ord) from jsonb_array_elements(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'offers') with ordinality as t(o, ord)),
          array['exp-linked', 'exp-dest-linked', 'svc-home-pickup', 'svc-uae'],
          'context: offers = published, priced, linked to the stay or its destination or UAE-side; stay-linked first, then by kind and position');
select is((select o ->> 'is_home_pickup' from jsonb_array_elements(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'offers') o where o ->> 'slug' = 'svc-home-pickup'),
          'true', 'context: the home-pickup flag comes through on offers');
select is((select o ->> 'is_home_pickup' from jsonb_array_elements(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'offers') o where o ->> 'slug' = 'exp-linked'),
          'false', 'context: other offers are not home pickup');
select is((select o ->> 'price_fils' from jsonb_array_elements(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'offers') o where o ->> 'slug' = 'exp-linked'),
          '25000', 'context: add-on price in fils');
select is((select o ->> 'name' from jsonb_array_elements(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'ar') -> 'offers') o where o ->> 'slug' = 'exp-linked'),
          'Linked experience', 'context: an Arabic draft name returns the English text');
select is((select o ->> 'name' from jsonb_array_elements(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'ar') -> 'offers') o where o ->> 'slug' = 'svc-uae'),
          'AR published name', 'context: a published Arabic name returns the Arabic text');
select is(jsonb_array_length(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'inclusions'), 7, 'context: the seven inclusions');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{inclusions,0,label}', 'Airport meet', 'context: inclusions by position');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{settings,vat_bp}', '500', 'context: VAT in basis points');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{settings,deposit_bp}', '3000', 'context: deposit in basis points');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') -> 'settings' -> 'balance_due_days', 'null'::jsonb, 'context: balance due days is null until the owner sets it');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') ->> 'today', pg_temp.d(0)::text, 'context: today is the UAE date');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{stay,base_rate_fils}', '100000', 'context: base rate again (stable)');
select is(public.booking_context('stay-no-rate', pg_temp.d(9), pg_temp.d(12), 'en') #>> '{stay,base_rate_fils}', null, 'context: a stay without a base rate has no base rate');
select is((public.booking_context('stay-no-rate', pg_temp.d(9), pg_temp.d(12), 'en') -> 'night_rates' -> 0) -> 'rate_fils', 'null'::jsonb, 'context: a night with no rate has a null rate');
select is(public.booking_context('nope', pg_temp.d(9), pg_temp.d(12), 'en') -> 'stay', 'null'::jsonb, 'context: an unknown stay is null');
select is(public.booking_context('stay-draft', pg_temp.d(9), pg_temp.d(12), 'en') -> 'stay', jsonb_build_object('id', '00000000-0000-4000-8000-0000000000e3', 'slug', 'stay-draft', 'is_published', false),
          'context: a draft stay is id, slug and is_published false, nothing else (no title leak)');
select is(public.booking_context('stay-one', pg_temp.d(9), pg_temp.d(9) + 367, 'en') -> 'night_rates', '[]'::jsonb, 'context: a range over 366 nights returns no rates');
select is(public.booking_context('stay-one', pg_temp.d(12), pg_temp.d(9), 'en') -> 'night_rates', '[]'::jsonb, 'context: leave before arrive returns no rates');

-- D. create_web_booking -------------------------------------------------------------------------------------------
create function pg_temp.bid(p_key text) returns uuid language sql as $$ select (v ->> 'booking_id')::uuid from t_res where k = p_key $$;

-- A web hold that must succeed; the result is kept under p_key.
create function pg_temp.mk(p_key text, p_slug text, p_off int, p_nights int, p_email text, p_plan text default 'deposit', p_lines jsonb default '[]'::jsonb)
returns uuid language plpgsql as $$
declare v jsonb;
begin
  v := public.create_web_booking(pg_temp.web(p_slug, pg_temp.d(p_off), pg_temp.d(p_off + p_nights), p_email, p_plan, p_lines));
  if not (v ->> 'ok')::boolean then raise exception 'mk % failed: %', p_key, v; end if;
  insert into t_res values (p_key, v);
  return (v ->> 'booking_id')::uuid;
end $$;

-- Opens a payment for a booking (terms given) and attaches a session id; the result is kept under 'op:<key>'.
create function pg_temp.op(p_key text, p_kind text, p_session text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  v := public.open_payment(pg_temp.bid(p_key), p_kind, 'test-terms');
  if (v ->> 'ok')::boolean and p_session is not null then
    perform public.attach_checkout_session((v ->> 'payment_id')::uuid, p_session);
  end if;
  delete from t_res where k = 'op:' || p_key;
  insert into t_res values ('op:' || p_key, v);
  return v;
end $$;

-- Without the owner's N a deposit cannot be stored; a full payment can.
select is(public.create_web_booking(pg_temp.web('stay-one', pg_temp.d(20), pg_temp.d(23), 'a@example.com', 'deposit')) ->> 'reason', 'settings_missing',
          'create: a deposit booking is refused while balance_due_days is null');
select is((select count(*)::int from public.bookings), 0, 'create: the refusal left no booking behind');
update public.site_settings set balance_due_days = 30 where id = 1;

insert into t_res values ('b1', public.create_web_booking(pg_temp.web('stay-one', pg_temp.d(20), pg_temp.d(23), 'a@example.com')));
select is(pg_temp.r('b1', 'ok'), 'true', 'create: the first guest holds three nights');
select matches(pg_temp.r('b1', 'ref'), '^ALMAR-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$', 'create: the ref has the ALMAR- format of B-17');
select is((select status from public.bookings where id = pg_temp.bid('b1')), 'held', 'create: status held');
select is((select source from public.bookings where id = pg_temp.bid('b1')), 'web', 'create: source web');
select ok((select hold_expires_at between now() + interval '29 minutes' and now() + interval '31 minutes' from public.bookings where id = pg_temp.bid('b1')),
          'create: the hold lasts 30 minutes');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('b1')), 3, 'create: one night row per night');
select ok((select bool_and(n.expires_at = b.hold_expires_at + interval '1 minute') from public.booking_nights n join public.bookings b on b.id = n.booking_id where b.id = pg_temp.bid('b1')),
          'create: the nights outlast the hold by the one-minute session margin');
select is((select count(*)::int from public.booking_travellers where booking_id = pg_temp.bid('b1')), 2, 'create: travellers stored');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('b1') and action = 'created' and actor = 'guest' and to_status = 'held'), 1,
          'create: a created event with actor guest');
select ok((select terms_accepted_at is not null and terms_version = 'test-terms' from public.bookings where id = pg_temp.bid('b1')), 'create: terms accepted with their version');
select is((select vat_bp::text || '/' || deposit_bp::text || '/' || coalesce(balance_due_days::text, '-') from public.bookings where id = pg_temp.bid('b1')), '500/3000/30',
          'create: the VAT %, deposit % and balance days in force are stored (O-08)');
select ok((select is_test from public.bookings where id = pg_temp.bid('b1')), 'create: the booking is marked TEST');
select ok(pg_temp.r('b1', 'hold_expires_at') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$', 'create: hold_expires_at is an ISO UTC string');
select is((select balance_due_date from public.bookings where id = pg_temp.bid('b1')), pg_temp.d(20) - 30, 'create: balance due date = arrival minus the due days');

-- The race outcome in SQL: the same nights, another guest, and the same guest, both sold out.
select is(public.create_web_booking(pg_temp.web('stay-one', pg_temp.d(20), pg_temp.d(23), 'other@example.com')) ->> 'reason', 'sold_out', 'create: a second guest for the same nights is sold_out');
select is((select count(*)::int from public.bookings where email = 'other@example.com'), 0, 'create: the refused hold left no booking row');
select is(public.create_web_booking(pg_temp.web('stay-one', pg_temp.d(22), pg_temp.d(24), 'other@example.com')) ->> 'reason', 'sold_out', 'create: overlapping on one night is sold_out too');
select is(public.create_web_booking(pg_temp.web('stay-one', pg_temp.d(20), pg_temp.d(23), 'a@example.com')) ->> 'reason', 'sold_out', 'create: the same email gets sold_out and ends nobody''s hold');
select is((select status from public.bookings where id = pg_temp.bid('b1')), 'held', 'create: the first booking is still held');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('b1')), 3, 'create: and still holds its three nights');

-- Ops blocks of all three scopes.
select is(public.create_web_booking(pg_temp.web('stay-one', pg_temp.d(40), pg_temp.d(42), 'blk@example.com')) ->> 'reason', 'blocked', 'create: a stay block gives blocked');
select is(public.create_web_booking(pg_temp.web('stay-one', pg_temp.d(50), pg_temp.d(51), 'blk@example.com')) ->> 'reason', 'blocked', 'create: a destination block gives blocked');
select is(public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(59), pg_temp.d(61), 'blk@example.com')) ->> 'reason', 'blocked', 'create: an everything block gives blocked');
select is(pg_temp.mk('b_e4', 'stay-two', 50, 1, 'blk@example.com') is not null, true, 'create: another destination''s stay is not hit by the destination block');
select is((select count(*)::int from public.bookings where email = 'blk@example.com'), 1, 'create: blocked holds left no rows');

-- Expected refusals.
select is(public.create_web_booking(pg_temp.web('stay-draft', pg_temp.d(70), pg_temp.d(72), 'x@example.com')) ->> 'reason', 'stay_unavailable', 'create: an unpublished stay is stay_unavailable');
select is(public.create_web_booking(pg_temp.web('nope', pg_temp.d(70), pg_temp.d(72), 'x@example.com')) ->> 'reason', 'stay_unavailable', 'create: an unknown stay is stay_unavailable');
select is(public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') || '{"vat_bp": 600}') ->> 'reason', 'settings_changed', 'create: a changed VAT % since the quote is settings_changed');
select is(public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') || '{"deposit_bp": 2000}') ->> 'reason', 'settings_changed', 'create: a changed deposit % is settings_changed');
select is(public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') || jsonb_build_object('balance_due_date', to_char(pg_temp.d(70) - 29, 'YYYY-MM-DD'))) ->> 'reason', 'settings_changed',
          'create: a changed due-days setting is settings_changed');
select is(public.create_web_booking(pg_temp.pl('stay-three', pg_temp.d(70), pg_temp.d(71), 'x@example.com', 'full', '[]', 100)
            || jsonb_build_object('airport', 'DXB', 'terms_version', 't', 'travellers', pg_temp.trav(2, 0, 0))) ->> 'reason', 'below_minimum_charge',
          'create: less than the 2.00 AED minimum due now is below_minimum_charge');
update public.site_settings set deposit_percent = null where id = 1;
select is(public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com')) ->> 'reason', 'settings_missing', 'create: a null deposit % is settings_missing, never 0');
update public.site_settings set deposit_percent = 30.00 where id = 1;
select is((select count(*)::int from public.bookings where email = 'x@example.com'), 0, 'create: none of those left a row');

-- A malformed payload is refused as almar:invalid (a programming error, not a reason).
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') || '{"surprise": 1}')$$, 'P0001', 'almar:invalid', 'create: an unknown key is refused');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') || '{"grand_fils": 1}')$$, 'P0001', 'almar:invalid', 'create: money that does not add up is refused');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') || jsonb_build_object('travellers', pg_temp.trav(1, 0, 0)))$$, 'P0001', 'almar:invalid', 'create: travellers that do not match the guests are refused');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') - 'airport')$$, 'P0001', 'almar:invalid', 'create: a web booking needs its airport');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'X@Example.com'))$$, 'P0001', 'almar:invalid', 'create: the email must be lower case');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(-1), pg_temp.d(1), 'x@example.com'))$$, 'P0001', 'almar:invalid', 'create: a past arrival is refused');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') || '{"hold_until": "x"}')$$, 'P0001', 'almar:invalid', 'create: an ops-only key is refused on a web booking');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com', 'deposit', jsonb_build_array(pg_temp.line(gen_random_uuid(), 'Ghost', 'trip', false, false, 1000, 1))))$$, 'P0001', 'almar:invalid', 'create: an add-on that is not in the catalogue is refused');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') || jsonb_build_object('travellers', jsonb_build_array(
    jsonb_build_object('kind', 'adult', 'full_name', 'A', 'is_booker', true), jsonb_build_object('kind', 'adult', 'full_name', 'B', 'is_booker', true))))$$, 'P0001', 'almar:invalid', 'create: two bookers are refused');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(70), pg_temp.d(72), 'x@example.com') || jsonb_build_object('travellers', jsonb_build_array(
    jsonb_build_object('kind', 'adult', 'full_name', 'A', 'is_booker', true), jsonb_build_object('kind', 'adult', 'full_name', 'B', 'not_staying', true))))$$, 'P0001', 'almar:invalid', 'create: "not staying" only on the booker');

-- Add-ons and the home-pickup rule (read from the database, not from the payload).
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(80), pg_temp.d(82), 'hp@example.com', 'deposit',
    jsonb_build_array(pg_temp.line('00000000-0000-4000-8000-0000000000c3', 'Home pickup', 'trip', true, true, 15000, 1))))$$, 'P0001', 'almar:invalid', 'create: a home-pickup line without a pickup address is refused');
select throws_ok($$select public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(80), pg_temp.d(82), 'hp@example.com', 'deposit',
    jsonb_build_array(pg_temp.line('00000000-0000-4000-8000-0000000000c3', 'Home pickup', 'trip', true, false, 15000, 1))))$$, 'P0001', 'almar:invalid', 'create: the home-pickup rule follows the catalogue flag, not the payload flag');
insert into t_res values ('hp', public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(80), pg_temp.d(82), 'hp@example.com', 'deposit',
    jsonb_build_array(pg_temp.line('00000000-0000-4000-8000-0000000000c3', 'Home pickup', 'trip', true, true, 15000, 1),
                      pg_temp.line('00000000-0000-4000-8000-0000000000c1', 'Linked experience', 'person', false, false, 25000, 2))) || '{"pickup_address": "Villa 1, Dubai"}'));
select is(pg_temp.r('hp', 'ok'), 'true', 'create: add-on lines with a pickup address are accepted');
select is((select count(*)::int from public.booking_lines where booking_id = pg_temp.bid('hp')), 2, 'create: both add-on lines are stored');
select is((select sum(line_fils)::int from public.booking_lines where booking_id = pg_temp.bid('hp')), 65000, 'create: line totals stored');
select is((select pickup_address from public.bookings where id = pg_temp.bid('hp')), 'Villa 1, Dubai', 'create: the pickup address is stored');
select is((select addons_fils::int from public.bookings where id = pg_temp.bid('hp')), 65000, 'create: addons_fils equals the lines');

-- O-08: the booking keeps the percentages it was made with.
update public.site_settings set vat_percent = 7.00, deposit_percent = 40.00 where id = 1;
select is((select vat_bp::text || '/' || deposit_bp::text from public.bookings where id = pg_temp.bid('b1')), '500/3000', 'O-08: later settings do not change an existing booking');
select is(public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(90), pg_temp.d(92), 'new@example.com')) ->> 'reason', 'settings_changed', 'O-08: a new booking at the old percentages is refused');
update public.site_settings set vat_percent = 5.00, deposit_percent = 30.00 where id = 1;

-- Refs are unique and well formed.
select is((select count(distinct r)::int from (select public.new_booking_ref() as r from generate_series(1, 200)) x), 200, 'new_booking_ref: 200 refs, all different');
select is((select count(*)::int from (select public.new_booking_ref() as r from generate_series(1, 200)) x where r !~ '^ALMAR-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'), 0, 'new_booking_ref: all in the alphabet');

-- The sweep: a hold that ended three minutes ago is cleared by the next hold; one that ended a minute ago is not (grace).
select pg_temp.mk('sw', 'stay-one', 30, 2, 'sw@example.com');
update public.booking_nights set expires_at = now() - interval '1 minute' where booking_id = pg_temp.bid('sw');
update public.bookings set hold_expires_at = now() - interval '2 minutes' where id = pg_temp.bid('sw');
select is(public.booking_context('stay-one', pg_temp.d(29), pg_temp.d(33), 'en') -> 'taken', to_jsonb(array[pg_temp.d(30), pg_temp.d(31)]), 'sweep: a night ended a minute ago still counts as taken in the quote (same grace as the hold)');
select is(public.create_web_booking(pg_temp.web('stay-one', pg_temp.d(30), pg_temp.d(32), 'sw2@example.com')) ->> 'reason', 'sold_out', 'sweep: and the hold agrees: sold_out inside the two-minute grace');
update public.booking_nights set expires_at = now() - interval '3 minutes' where booking_id = pg_temp.bid('sw');
select is(public.booking_context('stay-one', pg_temp.d(29), pg_temp.d(33), 'en') -> 'taken', '[]'::jsonb, 'sweep: three minutes after it ended the quote shows the nights free');
select pg_temp.mk('sw2', 'stay-one', 30, 2, 'sw2@example.com');
select is((select status from public.bookings where id = pg_temp.bid('sw')), 'expired', 'sweep: the next hold expired the lapsed booking');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('sw') and action = 'hold_expired' and actor = 'system' and from_status = 'held' and to_status = 'expired'), 1,
          'sweep: with a hold_expired history row (O-06)');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('sw')), 0, 'sweep: the lapsed booking holds no nights');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('sw2')), 2, 'sweep: the new guest holds them');

-- A guest's own hold never counts against their own quote, but only with the booking id the caller proved.
select is(public.booking_context('stay-one', pg_temp.d(19), pg_temp.d(24), 'en') -> 'taken', to_jsonb(array[pg_temp.d(20), pg_temp.d(21), pg_temp.d(22)]), 'own hold: another guest''s quote sees the nights taken');
select is(public.booking_context('stay-one', pg_temp.d(19), pg_temp.d(24), 'en', pg_temp.bid('b1')) -> 'taken', '[]'::jsonb, 'own hold: the holder''s quote (own booking id passed) does not count its own nights');
select is(public.booking_context('stay-one', pg_temp.d(19), pg_temp.d(24), 'en', gen_random_uuid()) -> 'taken', to_jsonb(array[pg_temp.d(20), pg_temp.d(21), pg_temp.d(22)]), 'own hold: a booking id that is not the holder skips nothing');
select is(public.booking_context('stay-one', pg_temp.d(19), pg_temp.d(24), 'en', pg_temp.bid('sw2')) -> 'taken', to_jsonb(array[pg_temp.d(20), pg_temp.d(21), pg_temp.d(22)]), 'own hold: another booking''s id skips only that booking''s nights');
update public.bookings set status = 'deposit_paid' where id = pg_temp.bid('b1');
select is(public.booking_context('stay-one', pg_temp.d(19), pg_temp.d(24), 'en', pg_temp.bid('b1')) -> 'taken', to_jsonb(array[pg_temp.d(20), pg_temp.d(21), pg_temp.d(22)]), 'own hold: once paid, a booking''s nights count against everyone');
update public.bookings set status = 'held' where id = pg_temp.bid('b1');

-- The hold limiter.
select is((select array_agg(public.claim_hold_slot('email-hash-1', 'ip-hash-' || g) order by g) from generate_series(1, 6) g), array[true, true, true, true, true, false],
          'claim_hold_slot: five holds per email per hour, the sixth is refused');
select is((select array_agg(public.claim_hold_slot('email-hash-ip-' || g, 'ip-hash-big') order by g) from generate_series(1, 21) g), array_fill(true, array[20]) || array[false],
          'claim_hold_slot: twenty holds per IP per hour, the twenty-first is refused');
select is(public.claim_hold_slot('', 'ip'), false, 'claim_hold_slot: an empty key is refused');

-- E. ops_create_booking (O-02, O-03) ---------------------------------------------------------------------------------
insert into t_res values ('o1', public.ops_create_booking(
  pg_temp.ops('stay-one', pg_temp.d(100), pg_temp.d(103), 'guest@example.com', interval '48 hours', 'deposit', '[]', '11111111-1111-4111-8111-111111111111'),
  '00000000-0000-4000-8000-00000000f001'));
select matches(pg_temp.r('o1', 'ref'), '^ALMAR-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$', 'ops create: a ref');
select is((select status || '/' || source from public.bookings where id = pg_temp.bid('o1')), 'awaiting_payment/ops', 'ops create: awaiting_payment, source ops');
select is((select created_by::text from public.bookings where id = pg_temp.bid('o1')), '00000000-0000-4000-8000-00000000f001', 'ops create: created_by is the owner');
select ok((select hold_expires_at between now() + interval '47 hours 58 minutes' and now() + interval '48 hours' from public.bookings where id = pg_temp.bid('o1')), 'ops create: held until the owner''s time (UAE +04:00, minute precision)');
select ok((select bool_and(n.expires_at = b.hold_expires_at) and count(*) = 3 from public.booking_nights n join public.bookings b on b.id = n.booking_id where b.id = pg_temp.bid('o1')), 'ops create: three nights held until exactly the hold-until time');
select is((select balance_due_date from public.bookings where id = pg_temp.bid('o1')), pg_temp.d(100) - 30, 'ops create: balance due date = arrival minus due days');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('o1') and action = 'created' and actor = 'owner:00000000-0000-4000-8000-00000000f001'), 1, 'ops create: a created event with the owner as actor');
select is((select terms_accepted_at from public.bookings where id = pg_temp.bid('o1')), null, 'ops create: no terms yet (the guest accepts when paying)');
select is((public.ops_create_booking(pg_temp.ops('stay-one', pg_temp.d(100), pg_temp.d(103), 'guest@example.com', interval '48 hours', 'deposit', '[]', '11111111-1111-4111-8111-111111111111'),
                                     '00000000-0000-4000-8000-00000000f001') ->> 'ref'), pg_temp.r('o1', 'ref'), 'ops create: the same request id returns the same booking');
select is((select count(*)::int from public.bookings where ops_request_id = '11111111-1111-4111-8111-111111111111'), 1, 'ops create: and creates no second row');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(110), pg_temp.d(112), 'g2@example.com', interval '30 minutes'), '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:hold_too_soon', 'ops create: a hold ending within 35 minutes is hold_too_soon');
select lives_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(110), pg_temp.d(112), 'g2@example.com', interval '37 minutes'), '00000000-0000-4000-8000-00000000f001')$$,
                'ops create: a hold ending in 37 minutes is accepted');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(115), pg_temp.d(117), 'g3@example.com', interval '48 hours') || '{"vat_bp": 700}', '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:settings_changed', 'ops create: changed settings are refused');
update public.site_settings set vat_percent = null where id = 1;
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(115), pg_temp.d(117), 'g3@example.com', interval '48 hours'), '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:settings_missing', 'ops create: a null VAT % is settings_missing');
update public.site_settings set vat_percent = 5.00 where id = 1;
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-one', pg_temp.d(40), pg_temp.d(42), 'g3@example.com', interval '48 hours'), '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:blocked', 'ops create: an ops-blocked night is blocked');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-one', pg_temp.d(101), pg_temp.d(104), 'g3@example.com', interval '48 hours'), '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:sold_out', 'ops create: a night the first hand-made booking holds is sold_out');
select is((select count(*)::int from public.bookings where email = 'g3@example.com'), 0, 'ops create: refusals leave no booking behind');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-draft', pg_temp.d(115), pg_temp.d(117), 'g3@example.com', interval '48 hours'), '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:stay_unavailable', 'ops create: a draft stay is stay_unavailable');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(115), pg_temp.d(117), 'g3@example.com', interval '48 hours') || jsonb_build_object('travellers', pg_temp.trav(2, 0, 0)), '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:invalid', 'ops create: travellers are not part of the ops payload');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(115), pg_temp.d(117), 'g3@example.com', interval '48 hours') || '{"stay_id": "00000000-0000-4000-8000-0000000000e5"}', '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:invalid', 'ops create: no stay_id is accepted, only the slug');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(115), pg_temp.d(117), 'g3@example.com', interval '48 hours') || '{"hold_until": "tomorrow"}', '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:invalid', 'ops create: a hold-until without a clock time and offset is refused');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(115), pg_temp.d(117), 'g3@example.com', interval '48 hours') - 'ops_request_id', '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:invalid', 'ops create: a request id is required');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(115), pg_temp.d(117), 'g3@example.com', interval '48 hours', 'deposit',
    jsonb_build_array(pg_temp.line('00000000-0000-4000-8000-0000000000c3', 'Home pickup', 'trip', true, true, 15000, 1))), '00000000-0000-4000-8000-00000000f001')$$,
                 'P0001', 'almar:invalid', 'ops create: a home-pickup line needs the pickup address here too');
select throws_ok($$select public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(115), pg_temp.d(117), 'g3@example.com', interval '48 hours'), null)$$, 'P0001', 'almar:invalid', 'ops create: an actor is required');
insert into t_res values ('o_full', public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(120), pg_temp.d(122), 'g4@example.com', interval '48 hours', 'full'), '00000000-0000-4000-8000-00000000f001'));
select is((select plan || '/' || coalesce(balance_due_date::text, '-') || '/' || deposit_fils::text from public.bookings where id = pg_temp.bid('o_full')), 'full/-/0', 'ops create: a full-payment booking has no balance date and no deposit');

-- F. ops_lapse_holds ---------------------------------------------------------------------------------------------------
select pg_temp.mk('l1', 'stay-three', 130, 2, 'l1@example.com');
select pg_temp.mk('l2', 'stay-two', 130, 2, 'l2@example.com');
select pg_temp.mk('l3', 'stay-three', 140, 2, 'l3@example.com');
update public.bookings set hold_expires_at = now() - interval '3 minutes' where id in (pg_temp.bid('l1'), pg_temp.bid('l2'));
update public.bookings set hold_expires_at = now() - interval '1 minute' where id = pg_temp.bid('l3');
select is(public.ops_lapse_holds(), 2, 'lapse: two holds ended more than two minutes ago');
select is(public.ops_lapse_holds(), 0, 'lapse: a second call finds none');
select is((select array_agg(status order by ref) from public.bookings where id in (pg_temp.bid('l1'), pg_temp.bid('l2'))), array['expired', 'expired'], 'lapse: both are expired');
select is((select status from public.bookings where id = pg_temp.bid('l3')), 'held', 'lapse: a hold that ended a minute ago is inside the grace and untouched');
select is((select count(*)::int from public.booking_nights where booking_id in (pg_temp.bid('l1'), pg_temp.bid('l2'))), 0, 'lapse: their nights are free');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('l3')), 2, 'lapse: the grace booking keeps its nights');
select is((select count(*)::int from public.booking_events where booking_id in (pg_temp.bid('l1'), pg_temp.bid('l2')) and action = 'hold_expired' and actor = 'system'), 2, 'lapse: one hold_expired event each');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('o1')), 3, 'lapse: a hand-made hold still in force is untouched');

-- G. ops_set_booking_status (O-01, O-05) ------------------------------------------------------------------------------
select pg_temp.mk('s1', 'stay-three', 150, 2, 's1@example.com');
select throws_ok(format($$select public.ops_set_booking_status(%L, 'confirmed', 'held', '00000000-0000-4000-8000-00000000f001')$$, pg_temp.bid('s1')), 'P0001', 'almar:not_allowed', 'status: an unpaid booking cannot be confirmed');
update public.bookings set status = 'deposit_paid', paid_fils = deposit_fils where id = pg_temp.bid('s1');
select throws_ok(format($$select public.ops_set_booking_status(%L, 'confirmed', 'held', '00000000-0000-4000-8000-00000000f001')$$, pg_temp.bid('s1')), 'P0001', 'almar:changed', 'status: a stale expected status is almar:changed');
select is(public.ops_set_booking_status(pg_temp.bid('s1'), 'confirmed', 'deposit_paid', '00000000-0000-4000-8000-00000000f001') ->> 'to', 'confirmed', 'status: deposit_paid -> confirmed');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('s1') and action = 'status' and from_status = 'deposit_paid' and to_status = 'confirmed' and actor = 'owner:00000000-0000-4000-8000-00000000f001'), 1, 'status: with an owner history row');
select throws_ok(format($$select public.ops_set_booking_status(%L, 'completed', 'deposit_paid', '00000000-0000-4000-8000-00000000f001')$$, pg_temp.bid('s1')), 'P0001', 'almar:changed', 'status: a second click on Confirm is almar:changed');
select is(public.ops_set_booking_status(pg_temp.bid('s1'), 'completed', 'confirmed', '00000000-0000-4000-8000-00000000f001') ->> 'to', 'completed', 'status: confirmed -> completed');
select throws_ok(format($$select public.ops_set_booking_status(%L, 'cancelled', 'completed', '00000000-0000-4000-8000-00000000f001')$$, pg_temp.bid('s1')), 'P0001', 'almar:not_allowed', 'status: a completed booking cannot be cancelled');
select throws_ok(format($$select public.ops_set_booking_status(%L, 'confirmed', 'completed', '00000000-0000-4000-8000-00000000f001')$$, pg_temp.bid('s1')), 'P0001', 'almar:not_allowed', 'status: nothing goes back from completed');

select pg_temp.mk('s2', 'stay-three', 160, 2, 's2@example.com');
select pg_temp.op('s2', 'deposit', 'cs_test_s2');
update public.bookings set paid_fils = 5000 where id = pg_temp.bid('s2');
select is(public.ops_set_booking_status(pg_temp.bid('s2'), 'cancelled', 'held', '00000000-0000-4000-8000-00000000f001') -> 'closed_sessions', '["cs_test_s2"]'::jsonb, 'status: Cancel returns the open Stripe sessions it closed');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('s2')), 0, 'status: Cancel frees the nights');
select is((select paid_fils::int from public.bookings where id = pg_temp.bid('s2')), 5000, 'status: Cancel does not touch paid_fils and refunds nothing (O-01)');
select is((select status from public.booking_payments where booking_id = pg_temp.bid('s2')), 'expired', 'status: Cancel closes the open payment');
select is((select count(*)::int from public.booking_refunds where booking_id = pg_temp.bid('s2')), 0, 'status: Cancel makes no refund row');
select is(public.create_web_booking(pg_temp.web('stay-three', pg_temp.d(160), pg_temp.d(162), 'free@example.com')) ->> 'ok', 'true', 'status: the cancelled nights can be booked at once');

select pg_temp.mk('s3', 'stay-three', 170, 2, 's3@example.com');
update public.bookings set status = 'paid_in_full' where id = pg_temp.bid('s3');
select is(public.ops_set_booking_status(pg_temp.bid('s3'), 'confirmed', 'paid_in_full', '00000000-0000-4000-8000-00000000f001') ->> 'to', 'confirmed', 'status: paid_in_full -> confirmed');
select is(public.ops_set_booking_status(pg_temp.bid('s3'), 'cancelled', 'confirmed', '00000000-0000-4000-8000-00000000f001') ->> 'to', 'cancelled', 'status: confirmed -> cancelled');
select throws_ok(format($$select public.ops_set_booking_status(%L, 'cancelled', 'cancelled', '00000000-0000-4000-8000-00000000f001')$$, pg_temp.bid('s3')), 'P0001', 'almar:not_allowed', 'status: a cancelled booking cannot change');

select pg_temp.mk('s4', 'stay-three', 180, 2, 's4@example.com');
select throws_ok(format($$select public.ops_set_booking_status(%L, 'expired', 'held', '00000000-0000-4000-8000-00000000f001')$$, pg_temp.bid('s4')), 'P0001', 'almar:not_allowed', 'status: the owner cannot set expired');
update public.bookings set status = 'deposit_paid' where id = pg_temp.bid('s4');
select throws_ok(format($$select public.ops_set_booking_status(%L, 'completed', 'deposit_paid', '00000000-0000-4000-8000-00000000f001')$$, pg_temp.bid('s4')), 'P0001', 'almar:not_allowed', 'status: completed needs confirmed first');
select is(public.ops_set_booking_status(pg_temp.bid('s4'), 'cancelled', 'deposit_paid', '00000000-0000-4000-8000-00000000f001') ->> 'to', 'cancelled', 'status: a deposit-paid booking can be cancelled');
select throws_ok($$select public.ops_set_booking_status(gen_random_uuid(), 'cancelled', 'held', '00000000-0000-4000-8000-00000000f001')$$, 'P0001', 'almar:not_found', 'status: an unknown booking is almar:not_found');
select throws_ok(format($$select public.ops_set_booking_status(%L, 'cancelled', null, '00000000-0000-4000-8000-00000000f001')$$, pg_temp.bid('s4')), 'P0001', 'almar:invalid', 'status: the expected status is required');

-- H. open_payment (PAY-08, PAY-10, IDEN-01) ---------------------------------------------------------------------------
select pg_temp.mk('pa', 'stay-three', 190, 2, 'pa@example.com');
select is(pg_temp.op('pa', 'deposit', null) ->> 'amount_fils', (select deposit_fils::text from public.bookings where id = pg_temp.bid('pa')), 'open_payment: the first payment of a deposit plan is the stored deposit');
select is((select count(*)::int from public.booking_payments where booking_id = pg_temp.bid('pa') and status = 'open'), 1, 'open_payment: one open payment');
select is(pg_temp.op('pa', 'deposit', 'cs_test_pa1') ->> 'previous_session_id', null, 'open_payment: a second call replaces the open one (no session was attached, so no previous session)');
select is((select count(*)::int from public.booking_payments where booking_id = pg_temp.bid('pa')), 2, 'open_payment: two rows now');
select is((select count(*)::int from public.booking_payments where booking_id = pg_temp.bid('pa') and status = 'open'), 1, 'open_payment: still only one open payment per booking');
select is(pg_temp.op('pa', 'deposit', 'cs_test_pa2') ->> 'previous_session_id', 'cs_test_pa1', 'open_payment: the previous open session id comes back so it can be closed at Stripe');
select is(public.open_payment(pg_temp.bid('pa'), 'full', 'test-terms') ->> 'reason', 'not_payable', 'open_payment: the kind must be the booking''s plan');
select is(public.open_payment(pg_temp.bid('pa'), 'balance', 'test-terms') ->> 'reason', 'not_payable', 'open_payment: no balance before the deposit is paid');
select is(public.open_payment(pg_temp.bid('pa'), 'refund', 'test-terms') ->> 'reason', 'not_payable', 'open_payment: an unknown kind is refused');
select is(public.open_payment(gen_random_uuid(), 'deposit', 'test-terms') ->> 'reason', 'not_payable', 'open_payment: an unknown booking is refused');
select is((select pg_temp.op('pa', 'deposit', null) -> 'booking' ->> 'email'), 'pa@example.com', 'open_payment: the booking block carries the email');
select is((select pg_temp.op('pa', 'deposit', null) -> 'booking' ->> 'locale'), 'en', 'open_payment: and the language');
select is((select count(*)::int from public.booking_payments where booking_id = pg_temp.bid('pa') and status = 'open'), 1, 'open_payment: and still one open row after each call');
update public.bookings set hold_expires_at = now() - interval '1 minute' where id = pg_temp.bid('pa');
select is(public.open_payment(pg_temp.bid('pa'), 'deposit', 'test-terms') ->> 'reason', 'hold_ended', 'open_payment: after the hold ended no payment opens');
update public.bookings set hold_expires_at = now() + interval '20 minutes' where id = pg_temp.bid('pa');

select pg_temp.mk('pf', 'stay-three', 200, 2, 'pf@example.com', 'full');
select is(pg_temp.op('pf', 'full', null) ->> 'amount_fils', (select grand_fils::text from public.bookings where id = pg_temp.bid('pf')), 'open_payment: a full plan charges the grand total');
select is(public.open_payment(pg_temp.bid('pf'), 'deposit', 'test-terms') ->> 'reason', 'not_payable', 'open_payment: a full plan has no deposit payment');
select is(public.open_payment(pg_temp.bid('pf'), 'full') ->> 'ok', 'true', 'open_payment: a web booking already carries its terms, no version is needed again');

-- Balance (PAY-10).
update public.bookings set status = 'deposit_paid', paid_fils = deposit_fils where id = pg_temp.bid('pa');
select is(pg_temp.op('pa', 'balance', null) ->> 'amount_fils', (select balance_fils::text from public.bookings where id = pg_temp.bid('pa')), 'open_payment: the balance is grand minus paid');
update public.bookings set paid_fils = grand_fils where id = pg_temp.bid('pa');
select is(public.open_payment(pg_temp.bid('pa'), 'balance', 'test-terms') ->> 'reason', 'nothing_due', 'open_payment: nothing due once paid in full');
update public.bookings set status = 'paid_in_full' where id = pg_temp.bid('pa');
select is(public.open_payment(pg_temp.bid('pa'), 'balance', 'test-terms') ->> 'reason', 'nothing_due', 'open_payment: nothing due on a paid_in_full booking');
update public.bookings set status = 'deposit_paid', paid_fils = grand_fils - 100 where id = pg_temp.bid('pa');
select is(public.open_payment(pg_temp.bid('pa'), 'balance', 'test-terms') ->> 'reason', 'below_minimum_charge', 'open_payment: a balance under 2.00 AED is below_minimum_charge');
update public.bookings set status = 'confirmed', paid_fils = deposit_fils where id = pg_temp.bid('pa');
select is(public.open_payment(pg_temp.bid('pa'), 'balance', 'test-terms') ->> 'ok', 'true', 'open_payment: a confirmed booking with money due can pay the balance');
update public.bookings set status = 'cancelled' where id = pg_temp.bid('pa');
select is(public.open_payment(pg_temp.bid('pa'), 'balance', 'test-terms') ->> 'reason', 'not_payable', 'open_payment: a cancelled booking is not payable');
update public.bookings set status = 'completed' where id = pg_temp.bid('pa');
select is(public.open_payment(pg_temp.bid('pa'), 'balance', 'test-terms') ->> 'reason', 'not_payable', 'open_payment: a completed booking is not payable');

-- Terms for a hand-made booking (IDEN-01).
select is(public.open_payment(pg_temp.bid('o1'), 'deposit') ->> 'reason', 'terms_required', 'open_payment: a hand-made booking needs the terms version');
select is((select terms_accepted_at from public.bookings where id = pg_temp.bid('o1')), null, 'open_payment: a refusal stamps no terms');
select is(public.open_payment(pg_temp.bid('o1'), 'deposit', '   ') ->> 'reason', 'terms_required', 'open_payment: a blank terms version is refused');
select is(public.open_payment(pg_temp.bid('o1'), 'deposit', 'v1') ->> 'ok', 'true', 'open_payment: with the terms version a hand-made booking can pay');
select is((select terms_version from public.bookings where id = pg_temp.bid('o1')), 'v1', 'open_payment: and the terms version is stamped');
select ok((select terms_accepted_at is not null from public.bookings where id = pg_temp.bid('o1')), 'open_payment: with the time');
select is(public.open_payment(pg_temp.bid('o1'), 'full', 'v1') ->> 'reason', 'not_payable', 'open_payment: a hand-made deposit booking cannot be paid in full');

-- I. attach_checkout_session -------------------------------------------------------------------------------------------
select lives_ok(format($$select public.attach_checkout_session(%L, 'cs_test_pf')$$, pg_temp.r('op:pf', 'payment_id')), 'attach: a session id is attached');
select lives_ok(format($$select public.attach_checkout_session(%L, 'cs_test_pf')$$, pg_temp.r('op:pf', 'payment_id')), 'attach: the same session again is fine');
select throws_ok(format($$select public.attach_checkout_session(%L, 'cs_test_other')$$, pg_temp.r('op:pf', 'payment_id')), 'P0001', 'almar:invalid', 'attach: another session on the same payment is refused');
select throws_ok($$select public.attach_checkout_session(gen_random_uuid(), 'cs_test_x')$$, 'P0001', 'almar:not_found', 'attach: an unknown payment is not_found');

-- J. record_payment (PAY-09) ------------------------------------------------------------------------------------------
select pg_temp.mk('p1', 'stay-three', 210, 2, 'p1@example.com');
select pg_temp.op('p1', 'deposit', 'cs_p1');
insert into t_res values ('rp1', public.record_payment('cs_p1', 'pi_p1', 'stripe:evt_p1'));
select is(pg_temp.r('rp1', 'first_time'), 'true', 'record_payment: the first call is the first time');
select is(pg_temp.r('rp1', 'status'), 'deposit_paid', 'record_payment: a paid deposit moves the booking to deposit_paid');
select is((select paid_fils from public.bookings where id = pg_temp.bid('p1')), (select deposit_fils from public.bookings where id = pg_temp.bid('p1')), 'record_payment: paid_fils is the deposit');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('p1') and expires_at is null), 2, 'record_payment: the nights become permanent');
select is((select status || '/' || payment_intent_id || '/' || (paid_at is not null)::text from public.booking_payments where checkout_session_id = 'cs_p1'), 'succeeded/pi_p1/true', 'record_payment: the payment is succeeded with its intent and time');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('p1') and action = 'payment' and actor = 'stripe:evt_p1' and from_status = 'held' and to_status = 'deposit_paid'), 1, 'record_payment: with a payment history row');
select is(pg_temp.r('rp1', 'needs_attention'), 'false', 'record_payment: nothing to attend to');
select is(public.record_payment('cs_p1', 'pi_p1', 'stripe:evt_p1_again') ->> 'first_time', 'false', 'record_payment: the same session again is not the first time');
select is((select paid_fils from public.bookings where id = pg_temp.bid('p1')), (select deposit_fils from public.bookings where id = pg_temp.bid('p1')), 'record_payment: and the money is counted once');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('p1') and action = 'payment'), 1, 'record_payment: and the history is written once');
select pg_temp.op('p1', 'balance', 'cs_p1b');
select is(public.record_payment('cs_p1b', 'pi_p1b', 'stripe:evt_p1b') ->> 'status', 'paid_in_full', 'record_payment: the balance moves deposit_paid to paid_in_full');
select is((select paid_fils from public.bookings where id = pg_temp.bid('p1')), (select grand_fils from public.bookings where id = pg_temp.bid('p1')), 'record_payment: paid equals the grand total');

select pg_temp.mk('p2', 'stay-three', 220, 2, 'p2@example.com', 'full');
select pg_temp.op('p2', 'full', 'cs_p2');
select is(public.record_payment('cs_p2', 'pi_p2', 'stripe:evt_p2') ->> 'status', 'paid_in_full', 'record_payment: a full payment moves held to paid_in_full');

select pg_temp.mk('p3', 'stay-three', 230, 2, 'p3@example.com');
select pg_temp.op('p3', 'deposit', 'cs_p3a');
select public.record_payment('cs_p3a', 'pi_p3a', 'stripe:evt_p3a');
select public.ops_set_booking_status(pg_temp.bid('p3'), 'confirmed', 'deposit_paid', '00000000-0000-4000-8000-00000000f001');
select pg_temp.op('p3', 'balance', 'cs_p3b');
select is(public.record_payment('cs_p3b', 'pi_p3b', 'stripe:evt_p3b') ->> 'status', 'confirmed', 'record_payment: a confirmed booking stays confirmed when its balance arrives');
select is((select paid_fils from public.bookings where id = pg_temp.bid('p3')), (select grand_fils from public.bookings where id = pg_temp.bid('p3')), 'record_payment: and its paid money is up to the grand total');

-- A payment after the nights went to someone else: the money is recorded and the booking is flagged, never dropped.
select pg_temp.mk('p4', 'stay-three', 240, 2, 'p4@example.com');
select pg_temp.op('p4', 'deposit', 'cs_p4');
update public.booking_nights set expires_at = now() - interval '3 minutes' where booking_id = pg_temp.bid('p4');
update public.bookings set hold_expires_at = now() - interval '4 minutes' where id = pg_temp.bid('p4');
select pg_temp.mk('p4b', 'stay-three', 240, 2, 'p4b@example.com');
select is((select status from public.bookings where id = pg_temp.bid('p4')), 'expired', 'late payment: the other guest''s hold swept the lapsed booking');
insert into t_res values ('rp4', public.record_payment('cs_p4', 'pi_p4', 'stripe:evt_p4'));
select is(pg_temp.r('rp4', 'needs_attention'), 'true', 'late payment: needs_attention is set when the nights are gone');
select is((select paid_fils from public.bookings where id = pg_temp.bid('p4')), (select deposit_fils from public.bookings where id = pg_temp.bid('p4')), 'late payment: the money is recorded');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('p4')), 0, 'late payment: it takes no night from the new guest');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('p4b') and expires_at is not null), 2, 'late payment: the new guest''s hold is untouched');
select is((select detail ->> 'reason' from public.booking_events where booking_id = pg_temp.bid('p4') and action = 'needs_attention'), 'nights_lost', 'late payment: a needs_attention event says why');
select is((select status from public.bookings where id = pg_temp.bid('p4')), 'deposit_paid', 'late payment: the booking shows its paid status so the owner sees it in the list and refunds in Stripe');

-- Late, but the nights are still free: they are claimed again.
select pg_temp.mk('p5', 'stay-three', 250, 2, 'p5@example.com');
select pg_temp.op('p5', 'deposit', 'cs_p5');
delete from public.booking_nights where booking_id = pg_temp.bid('p5');
update public.bookings set status = 'expired' where id = pg_temp.bid('p5');
insert into t_res values ('rp5', public.record_payment('cs_p5', 'pi_p5', 'stripe:evt_p5'));
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('p5') and expires_at is null), 2, 'late payment: free nights are re-claimed, permanently');
select is((select status from public.bookings where id = pg_temp.bid('p5')), 'deposit_paid', 'late payment: the booking is paid again');
select is(pg_temp.r('rp5', 'needs_attention'), 'true', 'late payment: and flagged because it had expired');
select is((select detail ->> 'reason' from public.booking_events where booking_id = pg_temp.bid('p5') and action = 'needs_attention'), 'paid_after_expiry', 'late payment: with its reason');

-- After the owner cancelled: recorded, flagged, status unchanged.
select pg_temp.mk('p6', 'stay-three', 260, 2, 'p6@example.com');
select pg_temp.op('p6', 'deposit', 'cs_p6');
select public.ops_set_booking_status(pg_temp.bid('p6'), 'cancelled', 'held', '00000000-0000-4000-8000-00000000f001');
insert into t_res values ('rp6', public.record_payment('cs_p6', 'pi_p6', 'stripe:evt_p6'));
select is(pg_temp.r('rp6', 'status'), 'cancelled', 'paid after cancel: a cancelled booking stays cancelled');
select is(pg_temp.r('rp6', 'needs_attention'), 'true', 'paid after cancel: and is flagged');
select is((select paid_fils from public.bookings where id = pg_temp.bid('p6')), (select amount_fils from public.booking_payments where checkout_session_id = 'cs_p6'), 'paid after cancel: the money is recorded for the refund');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('p6')), 0, 'paid after cancel: the nights stay free');

-- Two sessions for one booking: the one that was paid wins and the other is closed.
select pg_temp.mk('p7', 'stay-three', 270, 2, 'p7@example.com');
select pg_temp.op('p7', 'deposit', 'cs_p7a');
select pg_temp.op('p7', 'deposit', 'cs_p7b');
select is(public.record_payment('cs_p7a', 'pi_p7a', 'stripe:evt_p7a') -> 'closed_sessions', '["cs_p7b"]'::jsonb, 'record_payment: the other open session is closed and returned');
select is((select status from public.booking_payments where checkout_session_id = 'cs_p7b'), 'expired', 'record_payment: its payment row is expired, so no second charge can be recorded for it');

-- More money than the booking is worth is flagged.
select pg_temp.mk('p8', 'stay-three', 280, 2, 'p8@example.com', 'full');
select pg_temp.op('p8', 'full', 'cs_p8');
select public.record_payment('cs_p8', 'pi_p8', 'stripe:evt_p8');
insert into public.booking_payments (booking_id, kind, amount_fils, checkout_session_id) values (pg_temp.bid('p8'), 'balance', 5000, 'cs_p8x');
select is(public.record_payment('cs_p8x', 'pi_p8x', 'stripe:evt_p8x') ->> 'needs_attention', 'true', 'record_payment: an overpayment is flagged');
select is((select detail ->> 'reason' from public.booking_events where booking_id = pg_temp.bid('p8') and action = 'needs_attention'), 'overpaid', 'record_payment: with the reason overpaid');
select is(public.record_payment('cs_nope', 'pi_nope', 'stripe:evt_nope') ->> 'found', 'false', 'record_payment: a session that is not ours is found = false');
select is(public.record_payment('cs_nope', 'pi_nope', 'stripe:evt_nope') ->> 'first_time', 'false', 'record_payment: and is not a first time');

-- K. set_payment_card (PAY-06) -----------------------------------------------------------------------------------------
select lives_ok($$select public.set_payment_card((select id from public.booking_payments where checkout_session_id = 'cs_p1'), 'ch_p1', 'visa', '4242', 'apple_pay', 12345, 'usd')$$, 'card: brand, last 4, wallet and presentment are set');
select is((select card_brand || '/' || card_last4 || '/' || wallet || '/' || presentment_amount::text || '/' || presentment_currency || '/' || charge_id from public.booking_payments where checkout_session_id = 'cs_p1'),
          'visa/4242/apple_pay/12345/usd/ch_p1', 'card: stored as given');
select throws_ok($$select public.set_payment_card((select id from public.booking_payments where checkout_session_id = 'cs_p1'), 'ch_p1', 'visa', '42424242', null, null, null)$$, '23514', null, 'card: more than the last four digits are refused');
select throws_ok($$select public.set_payment_card(gen_random_uuid(), 'c', 'visa', '4242', null, null, null)$$, 'P0001', 'almar:not_found', 'card: an unknown payment is not_found');

-- L. refunds and disputes recorded from Stripe (O-01) ---------------------------------------------------------------
select is(public.record_refund('rf_x', 'ch_unknown', 'pi_unknown', 1000, 'succeeded', 'stripe:evt_rx'), 'payment_unknown', 'refund: a charge we do not know is payment_unknown (the webhook retries)');
select is((select count(*)::int from public.booking_refunds), 0, 'refund: and nothing is written');
select is(public.record_refund('rf_1', 'ch_p1', null, 1000, 'pending', 'stripe:evt_r1'), 'ok', 'refund: found by charge');
select is((select count(*)::int from public.booking_refunds where booking_id = pg_temp.bid('p1')), 1, 'refund: one row');
select is(public.record_refund('rf_1', 'ch_p1', null, 1000, 'succeeded', 'stripe:evt_r1b'), 'ok', 'refund: the same refund again updates it');
select is((select count(*)::int || '/' || min(status) from public.booking_refunds where stripe_refund_id = 'rf_1'), '1/succeeded', 'refund: still one row, now succeeded');
select is(public.record_refund('rf_1', 'ch_p1', null, 1000, 'succeeded', 'stripe:evt_r1c'), 'ok', 'refund: the same status again');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('p1') and action = 'refund'), 2, 'refund: history rows on first sight and on a change of status only');
select is(public.record_refund('rf_2', null, 'pi_p1', 500, 'succeeded', 'stripe:evt_r2'), 'ok', 'refund: found by payment intent when there is no charge');
select is((select paid_fils || '/' || status from public.bookings where id = pg_temp.bid('p1')), (select grand_fils || '/paid_in_full' from public.bookings where id = pg_temp.bid('p1')), 'refund: nothing about the booking changes (refunds are made in Stripe)');
select is(public.record_dispute('dp_1', 'ch_p1', null, 3000, 'fraudulent', 'needs_response', 'stripe:evt_d1'), 'ok', 'dispute: recorded');
select is(public.record_dispute('dp_1', 'ch_p1', null, 3000, null, 'won', 'stripe:evt_d1b'), 'ok', 'dispute: the same dispute updated');
select is((select count(*)::int || '/' || min(status) || '/' || min(reason) from public.booking_disputes where stripe_dispute_id = 'dp_1'), '1/won/fraudulent', 'dispute: one row, the new status, the reason kept');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('p1') and action = 'dispute'), 2, 'dispute: two history rows');
select is(public.record_dispute('dp_x', 'ch_unknown', null, 1, 'x', 'y', 'stripe:evt_dx'), 'payment_unknown', 'dispute: an unknown charge is payment_unknown');

-- M. Stripe event claims -----------------------------------------------------------------------------------------------
select is(public.claim_stripe_event('evt_1', 'checkout.session.completed'), true, 'claim: the first claim is ours');
select is(public.claim_stripe_event('evt_1', 'checkout.session.completed'), false, 'claim: a second claim while it runs is refused');
update public.stripe_events set claimed_at = now() - interval '3 minutes' where id = 'evt_1';
select is(public.claim_stripe_event('evt_1', 'checkout.session.completed'), true, 'claim: a stale unprocessed claim is taken over after two minutes');
select public.finish_stripe_event('evt_1');
select is(public.claim_stripe_event('evt_1', 'checkout.session.completed'), false, 'claim: a processed event is never claimed again');
update public.stripe_events set claimed_at = now() - interval '3 minutes' where id = 'evt_1';
select is(public.claim_stripe_event('evt_1', 'checkout.session.completed'), false, 'claim: not even when its claim is old');
select is(public.claim_stripe_event('evt_2', 'charge.refunded'), true, 'claim: another event is its own claim');
select public.drop_stripe_event('evt_2');
select is(public.claim_stripe_event('evt_2', 'charge.refunded'), true, 'claim: a dropped claim can be taken again at once (Stripe''s retry)');
select public.finish_stripe_event('evt_2');
select public.drop_stripe_event('evt_2');
select is((select count(*)::int from public.stripe_events where id = 'evt_2'), 1, 'claim: a processed event is never dropped');
select is(public.claim_stripe_event('', 'x'), false, 'claim: an empty id is refused');

-- N. booking_drop_hold -------------------------------------------------------------------------------------------------
select pg_temp.mk('d1', 'stay-three', 290, 2, 'd1@example.com');
select pg_temp.op('d1', 'deposit', 'cs_d1');
select is(public.booking_drop_hold(pg_temp.bid('d1'), 'guest') -> 'closed_sessions', '["cs_d1"]'::jsonb, 'drop: the open Stripe session comes back');
select is((select status from public.bookings where id = pg_temp.bid('d1')), 'expired', 'drop: held -> expired');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('d1')), 0, 'drop: the nights are free at once');
select is((select status from public.booking_payments where checkout_session_id = 'cs_d1'), 'expired', 'drop: the open payment is closed');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('d1') and action = 'status' and actor = 'guest' and to_status = 'expired'), 1, 'drop: a history row with the guest as actor');
select is(pg_temp.mk('d1b', 'stay-three', 290, 2, 'd1b@example.com') is not null, true, 'drop: the same nights can be held right away');
select is(public.booking_drop_hold(pg_temp.bid('d1'), 'guest') ->> 'dropped', 'false', 'drop: a second drop does nothing');
select is(public.booking_drop_hold(pg_temp.bid('p1'), 'guest') ->> 'dropped', 'false', 'drop: a paid booking is never dropped');
select is((select status from public.bookings where id = pg_temp.bid('p1')), 'paid_in_full', 'drop: and its status is untouched');
select is(public.booking_drop_hold(gen_random_uuid(), 'guest') ->> 'dropped', 'false', 'drop: an unknown booking does nothing');

-- O. mark_session_expired ---------------------------------------------------------------------------------------------
select pg_temp.mk('m1', 'stay-three', 300, 2, 'm1@example.com');
select pg_temp.op('m1', 'deposit', 'cs_m1');
select is(public.mark_session_expired('cs_m1', 'stripe:evt_m1') ->> 'booking_expired', 'true', 'expired: an ended session frees a held booking early');
select is((select status from public.bookings where id = pg_temp.bid('m1')) || '/' || (select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('m1')), 'expired/0', 'expired: the booking is expired and holds no nights');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('m1') and action = 'hold_expired' and actor = 'stripe:evt_m1'), 1, 'expired: with a history row naming Stripe''s event');
select is(public.mark_session_expired('cs_m1', 'stripe:evt_m1b') ->> 'payment_expired', 'false', 'expired: a second call changes nothing (idempotent)');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('m1') and action = 'hold_expired'), 1, 'expired: and writes no second history row');
select pg_temp.mk('m2', 'stay-three', 310, 2, 'm2@example.com');
select pg_temp.op('m2', 'deposit', 'cs_m2a');
select pg_temp.op('m2', 'deposit', 'cs_m2b');
select is(public.mark_session_expired('cs_m2a', 'stripe:evt_m2a') ->> 'booking_expired', 'false', 'expired: a session that was replaced does not expire the booking');
select is((select status from public.bookings where id = pg_temp.bid('m2')) || '/' || (select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('m2')), 'held/2', 'expired: it stays held with its nights while a newer session is open');
select is(public.mark_session_expired('cs_m2b', 'stripe:evt_m2b') ->> 'booking_expired', 'true', 'expired: the newest session ending does expire it');
select is(public.mark_session_expired('cs_unknown', 'stripe:evt_u') ->> 'found', 'false', 'expired: a session that is not ours is found = false');
insert into t_res values ('o2', public.ops_create_booking(pg_temp.ops('stay-three', pg_temp.d(320), pg_temp.d(322), 'o2@example.com', interval '48 hours'), '00000000-0000-4000-8000-00000000f001'));
select is(public.open_payment(pg_temp.bid('o2'), 'deposit', 'v1') ->> 'ok', 'true', 'expired: a hand-made booking opens a payment');
select public.attach_checkout_session((select id from public.booking_payments where booking_id = pg_temp.bid('o2') and status = 'open'), 'cs_o2');
select is(public.mark_session_expired('cs_o2', 'stripe:evt_o2') ->> 'booking_expired', 'false', 'expired: a hand-made hold is the owner''s, a session ending does not end it');
select is((select status from public.bookings where id = pg_temp.bid('o2')) || '/' || (select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('o2')), 'awaiting_payment/2', 'expired: it stays awaiting_payment with its nights');

-- P. The anonymous view and function (3.2 hand-over) --------------------------------------------------------------------
set local role anon;
select is((select count(*)::int from public.api_stay_blocked_days where stay_id = '00000000-0000-4000-8000-0000000000e5' and day in ((now() at time zone 'Asia/Dubai')::date + 210, (now() at time zone 'Asia/Dubai')::date + 211)), 2,
          'view: the nights of a paid booking are blocked');
select is((select count(*)::int from public.api_stay_blocked_days where stay_id = '00000000-0000-4000-8000-0000000000e1' and day = (now() at time zone 'Asia/Dubai')::date + 20), 0,
          'view: a 30-minute web hold is NOT baked in as blocked');
select is((select count(*)::int from public.api_stay_blocked_days where stay_id = '00000000-0000-4000-8000-0000000000e1' and day in ((now() at time zone 'Asia/Dubai')::date + 100, (now() at time zone 'Asia/Dubai')::date + 102)), 2,
          'view: a hand-made hold still in force is blocked');
select is((select count(*)::int from public.api_stay_blocked_days where stay_id = '00000000-0000-4000-8000-0000000000e1' and day = (now() at time zone 'Asia/Dubai')::date + 40), 1,
          'view: 3.2''s ops blocks are still in it');
select is((select count(*)::int from public.api_stay_blocked_days where stay_id = '00000000-0000-4000-8000-0000000000e5' and day = (now() at time zone 'Asia/Dubai')::date + 320), 1,
          'view: a hand-made hold of another stay is blocked while it runs');
select ok((select blocked_dates @> array[(now() at time zone 'Asia/Dubai')::date + 210] from public.api_stays where slug = 'stay-three'), 'view: api_stays.blocked_dates carries the booked nights too');
select is((select count(*)::int from public.api_stay_blocked_days), (select count(*)::int from (select distinct stay_id, day from public.api_stay_blocked_days) x), 'view: no night is listed twice');
reset role;
update public.booking_nights set expires_at = now() - interval '1 minute' where booking_id = pg_temp.bid('o2');
set local role anon;
select is((select count(*)::int from public.api_stay_blocked_days where stay_id = '00000000-0000-4000-8000-0000000000e5' and day = (now() at time zone 'Asia/Dubai')::date + 320), 0,
          'view: a hand-made hold that has ended is not blocked any more');
reset role;
select is(pg_get_function_result('public.public_booked_nights()'::regprocedure), 'TABLE(stay_id uuid, day date)', 'public_booked_nights returns only (stay_id, day)');

-- Q. ops_add_block (3.2 hand-over) --------------------------------------------------------------------------------------
select is(public.ops_add_block(jsonb_build_object('scope', 'stay', 'stay_id', '00000000-0000-4000-8000-0000000000e1', 'starts_on', pg_temp.d(100), 'ends_on', pg_temp.d(100))) ->> 'overlapping_bookings', '1',
          'block: a hand-made hold on the blocked night is counted');
select is((select count(*)::int from public.availability_blocks where stay_id = '00000000-0000-4000-8000-0000000000e1' and starts_on = pg_temp.d(100)), 1, 'block: and the block is written');
select is(public.ops_add_block(jsonb_build_object('scope', 'destination', 'destination_id', '00000000-0000-4000-8000-0000000000d1', 'starts_on', pg_temp.d(20), 'ends_on', pg_temp.d(22))) ->> 'overlapping_bookings', '1',
          'block: a destination block counts the held booking of one of its stays');
select is(public.ops_add_block(jsonb_build_object('scope', 'all', 'starts_on', pg_temp.d(30), 'ends_on', pg_temp.d(31))) ->> 'overlapping_bookings', '1', 'block: an everything block counts every stay''s bookings');
select is(public.ops_add_block(jsonb_build_object('scope', 'stay', 'stay_id', '00000000-0000-4000-8000-0000000000e5', 'starts_on', pg_temp.d(210), 'ends_on', pg_temp.d(210))) ->> 'overlapping_bookings', '1',
          'block: a paid booking''s night is counted');
select is(public.ops_add_block(jsonb_build_object('scope', 'stay', 'stay_id', '00000000-0000-4000-8000-0000000000e1', 'starts_on', pg_temp.d(300), 'ends_on', pg_temp.d(300))) ->> 'overlapping_bookings', '0', 'block: no booking, no count');
select is((select array_agg(k order by k) from jsonb_object_keys(public.ops_add_block(jsonb_build_object('scope', 'all', 'starts_on', pg_temp.d(301), 'ends_on', pg_temp.d(301)))) k), array['id', 'overlapping_bookings'], 'block: the result keeps 3.2''s two keys');
select throws_ok($$select public.ops_add_block('{"scope": "x", "starts_on": "2030-01-01", "ends_on": "2030-01-01"}')$$, 'P0001', 'almar:invalid', 'block: 3.2''s validation is unchanged');
select ok((select prosrc like '%pg_advisory_xact_lock(hashtextextended(v_stay::text, 0))%' from pg_proc where proname = 'ops_add_block' and pronamespace = 'public'::regnamespace), 'block: a stay block takes the same per-stay advisory lock as place_hold');
select is(pg_temp.mk('after_block', 'stay-three', 330, 1, 'ab@example.com') is not null, true, 'block: other stays are not affected by a stay block');
select is(public.create_web_booking(pg_temp.web('stay-one', pg_temp.d(300), pg_temp.d(302), 'ab2@example.com')) ->> 'reason', 'blocked', 'block: a block added through the new function stops holds at once');

-- R. Table rules ------------------------------------------------------------------------------------------------------
select throws_ok(format($$update public.bookings set grand_fils = grand_fils + 1 where id = %L$$, pg_temp.bid('b1')), '23514', null, 'rules: grand = subtotal + VAT is a table check');
select throws_ok(format($$update public.bookings set deposit_fils = deposit_fils + 1 where id = %L$$, pg_temp.bid('b1')), '23514', null, 'rules: deposit + balance = grand is a table check');
select throws_ok(format($$update public.bookings set ref = 'ALMAR-0OOOOO' where id = %L$$, pg_temp.bid('b1')), '23514', null, 'rules: the ref alphabet is a table check');
select throws_ok(format($$update public.bookings set email = 'UP@EXAMPLE.COM' where id = %L$$, pg_temp.bid('b1')), '23514', null, 'rules: the email is stored lower case');
select throws_ok(format($$update public.bookings set status = 'weird' where id = %L$$, pg_temp.bid('b1')), '23514', null, 'rules: the status list is a table check');
select throws_ok(format($$update public.bookings set leave = arrive where id = %L$$, pg_temp.bid('b1')), '23514', null, 'rules: leave is after arrive');
select throws_ok(format($$update public.bookings set airport = null where id = %L$$, pg_temp.bid('b1')), '23514', null, 'rules: a web booking has an airport');
select throws_ok(format($$update public.bookings set currency = 'usd' where id = %L$$, pg_temp.bid('b1')), '23514', null, 'rules: currency is AED');
select throws_ok(format($$update public.booking_payments set amount_fils = 100 where id = %L$$, (select id from public.booking_payments where checkout_session_id = 'cs_p1')), '23514', null, 'rules: a payment under 2.00 AED is refused');
select throws_ok(format($$insert into public.booking_payments (booking_id, kind, amount_fils) values (%L, 'full', 5000)$$, pg_temp.bid('pf')), '23505', null, 'rules: a second open payment for one booking is refused');
select throws_ok(format($$update public.booking_travellers set age = 5 where booking_id = %L and position = 0$$, pg_temp.bid('b1')), '23514', null, 'rules: an adult has no age');
select throws_ok(format($$update public.booking_travellers set kind = 'child', age = 20 where booking_id = %L and position = 1$$, pg_temp.bid('b1')), '23514', null, 'rules: a child is 3 to 12');
select throws_ok(format($$update public.booking_travellers set is_booker = true where booking_id = %L and position = 1$$, pg_temp.bid('b1')), '23505', null, 'rules: one booker per booking');
select throws_ok(format($$update public.booking_lines set line_fils = 1 where booking_id = %L$$, pg_temp.bid('hp')), '23514', null, 'rules: a line total is unit price times quantity');
select throws_ok(format($$insert into public.booking_nights (stay_id, night, booking_id) select stay_id, night, booking_id from public.booking_nights where booking_id = %L limit 1$$, pg_temp.bid('b1')), '23505', null, 'rules: a night can be held once (primary key)');
select throws_ok(format($$select public.log_booking_event(%L, 'owner', 'bogus', '{}')$$, pg_temp.bid('b1')), '23514', null, 'rules: history actions come from a fixed list');
select lives_ok(format($$select public.log_booking_event(%L, 'owner:x', 'email_failed', '{"to":"guest"}')$$, pg_temp.bid('b1')), 'rules: log_booking_event writes a history row');
select is((select count(*)::int from public.booking_events where booking_id = pg_temp.bid('b1') and action = 'email_failed' and actor = 'owner:x'), 1, 'rules: and it is there');
select throws_ok(format($$delete from public.stays where id = %L$$, '00000000-0000-4000-8000-0000000000e1'), '23503', null, 'rules: a stay with bookings cannot be deleted');
update public.bookings set updated_at = now() - interval '1 day', needs_attention = needs_attention where id = pg_temp.bid('b1');
select ok((select updated_at = now() from public.bookings where id = pg_temp.bid('b1')), 'rules: updated_at follows every update');

select * from finish();
rollback;
