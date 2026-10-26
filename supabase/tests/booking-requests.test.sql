-- pgTAP: request to book, paid by bank transfer, part A (plan 04-08, Task 1; migration 20261019160000): the owner-only
-- tables and their privileges, the replaced checks, the owner's money settings, the request gate, request_web_booking,
-- booking_withdraw_request (P-19), the baked calendar (A10, P-09) and the guest reads (booking_view, guest_bookings).
-- The seed is written as the postgres owner; privilege checks switch roles. Bank values are documentation examples only
-- (GB82 WEST 1234 5698 7654 32, AE07 0331 2345 6789 0123 456, BIC TESTAEAA / TESTAEAAXXX), never a real account.
-- Own helpers and seed: nothing here depends on bookings-and-ops.test.sql.
-- Run: node tests/helpers/local-supabase.mjs test supabase/tests/booking-requests.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(221);

-- Helpers (temporary, gone with the transaction; the first six are bookings-and-ops.test.sql:9-71) -----------------
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
create function pg_temp.bid(p_key text) returns uuid language sql as $$ select (v ->> 'booking_id')::uuid from t_res where k = p_key $$;

-- This file's own helpers ---------------------------------------------------------------------------------------------
-- The owner and a guest (profiles made by the auth trigger: the owner email gets role owner).
create function pg_temp.owner_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016f1'::uuid $$;
create function pg_temp.guest() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000016f2'::uuid $$;

-- ISO UTC text with milliseconds, as the migration writes times.
create function pg_temp.iso(p timestamptz) returns text language sql as $$ select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- A web hold that must succeed (TEST unless p_test is false); the result is kept under p_key.
create function pg_temp.mk(p_key text, p_slug text, p_off int, p_nights int, p_email text, p_test boolean default true,
  p_plan text default 'deposit', p_lines jsonb default '[]'::jsonb)
returns uuid language plpgsql as $$
declare v jsonb;
begin
  v := public.create_web_booking(pg_temp.web(p_slug, pg_temp.d(p_off), pg_temp.d(p_off + p_nights), p_email, p_plan, p_lines)
    || jsonb_build_object('is_test', p_test));
  if not (v ->> 'ok')::boolean then raise exception 'mk % failed: %', p_key, v; end if;
  insert into t_res values (p_key, v);
  return (v ->> 'booking_id')::uuid;
end $$;

-- request_web_booking on a kept booking; the answer is kept under 'q:<key>' (the last one).
create function pg_temp.rq(p_key text, p_test boolean default true) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  v := public.request_web_booking(pg_temp.bid(p_key), p_test);
  delete from t_res where k = 'q:' || p_key;
  insert into t_res values ('q:' || p_key, v);
  return v;
end $$;

-- A hold made and requested, both of which must succeed.
create function pg_temp.mkq(p_key text, p_slug text, p_off int, p_nights int, p_email text, p_test boolean default true,
  p_plan text default 'deposit', p_lines jsonb default '[]'::jsonb)
returns uuid language plpgsql as $$
declare v jsonb;
begin
  perform pg_temp.mk(p_key, p_slug, p_off, p_nights, p_email, p_test, p_plan, p_lines);
  v := pg_temp.rq(p_key, p_test);
  if not coalesce((v ->> 'first_time')::boolean, false) then raise exception 'mkq % failed: %', p_key, v; end if;
  return pg_temp.bid(p_key);
end $$;

-- The deadline (and the timed nights) moved to p_ago in the past, as if time had passed.
create function pg_temp.past(p_key text, p_ago interval) returns void language sql as $$
  update public.booking_nights set expires_at = now() - p_ago where booking_id = pg_temp.bid(p_key) and expires_at is not null;
  update public.bookings set hold_expires_at = now() - p_ago where id = pg_temp.bid(p_key);
$$;

-- A status set by hand, with the money and nights it implies (Task 2 proves the real record path).
create function pg_temp.settle(p_key text, p_status text) returns void language sql as $$
  update public.booking_nights set expires_at = null where booking_id = pg_temp.bid(p_key);
  update public.bookings
     set status = p_status,
         paid_fils = case when p_status = 'deposit_paid' then deposit_fils else grand_fils end
   where id = pg_temp.bid(p_key);
$$;

create function pg_temp.st(p_key text) returns text language sql as $$ select b.status from public.bookings b where b.id = pg_temp.bid(p_key) $$;
create function pg_temp.nights(p_key text) returns int language sql as $$ select count(*)::int from public.booking_nights n where n.booking_id = pg_temp.bid(p_key) $$;
create function pg_temp.ev(p_key text, p_action text) returns int language sql as $$
  select count(*)::int from public.booking_events e where e.booking_id = pg_temp.bid(p_key) and e.action = p_action
$$;
create function pg_temp.bv(p_key text, p_locale text default null, p_test boolean default true) returns jsonb language sql as $$
  select public.booking_view(pg_temp.bid(p_key), p_locale, p_test)
$$;
create function pg_temp.baked(p_key text) returns int language sql as $$
  select count(*)::int from public.public_booked_nights() pb
  join public.booking_nights n on n.stay_id = pb.stay_id and n.night = pb.day
  where n.booking_id = pg_temp.bid(p_key)
$$;

-- The owner's money Save.
create function pg_temp.save(p jsonb) returns jsonb language sql as $$ select public.ops_save_money_settings(p, pg_temp.owner_id()) $$;

-- A complete bank object (documentation examples), with p_over on top.
create function pg_temp.bank(p_over jsonb default '{}'::jsonb) returns jsonb language sql as $$
  select jsonb_build_object('bank', jsonb_build_object(
    'account_name', 'Almar Test Account', 'bank_name', 'Test Bank', 'iban', 'GB82 WEST 1234 5698 7654 32', 'swift', 'TESTAEAA',
    'bank_address', '1 Test Street, Dubai', 'note_en', 'All fees paid by the sender.') || p_over)
$$;

-- A refusal as 'almar:<code>' or 'almar:<code>:<field>'; 'ok' when the statement ran.
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
declare m text; d text;
begin
  execute p_sql;
  return 'ok';
exception when others then
  get stacked diagnostics m = message_text, d = pg_exception_detail;
  begin
    return m || coalesce(':' || (nullif(d, '')::jsonb ->> 'field'), '');
  exception when others then
    return m;
  end;
end $$;

-- Seed ----------------------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000016f1', 'maria@almarprivatejourney.com', now()),
  ('00000000-0000-4000-8000-0000000016f2', 'guest-requests@example.com', now());
insert into public.media (id, key, width, height, bytes, sha256, source) values
  ('00000000-0000-4000-8000-0000000016a1', 'test/requests-hero.webp', 1600, 1000, 12345, repeat('a', 64), 'import');
insert into public.image_translations (image_id, locale, alt, status) values
  ('00000000-0000-4000-8000-0000000016a1', 'en', 'A hero', 'published'),
  ('00000000-0000-4000-8000-0000000016a1', 'es', 'Una foto', 'published');
insert into public.destinations (id, slug, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000016d1', 'req-dest', '00000000-0000-4000-8000-0000000016a1', true, 1);
insert into public.destination_translations (destination_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000016d1', 'en', 'published', 'Destination one'),
  ('00000000-0000-4000-8000-0000000016d1', 'es', 'published', 'Destino uno');
insert into public.stays (id, slug, destination_id, max_guests, min_nights, infants_count, base_nightly_rate_aed, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000016e1', 'req-stay-one', '00000000-0000-4000-8000-0000000016d1', 6, 1, false, 1000.00, '00000000-0000-4000-8000-0000000016a1', true, 1),
  ('00000000-0000-4000-8000-0000000016e2', 'req-stay-two', '00000000-0000-4000-8000-0000000016d1', 6, 1, false, 1000.00, '00000000-0000-4000-8000-0000000016a1', true, 2);
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000016e1', 'en', 'published', 'Stay one'),
  ('00000000-0000-4000-8000-0000000016e1', 'es', 'published', 'Estancia uno'),
  ('00000000-0000-4000-8000-0000000016e2', 'en', 'published', 'Stay two');
insert into public.stay_access (stay_id, address, wifi_name, wifi_password, door_code, notes) values
  ('00000000-0000-4000-8000-0000000016e1', 'Calle 10 # 5-20, Cartagena', 'almar-guest', 'test-password', '4821', 'Ring the bell.');
insert into public.catalog_items (id, slug, kind, unit, price_aed, is_uae, is_home_pickup, is_published, position) values
  ('00000000-0000-4000-8000-0000000016c1', 'req-boat', 'experience', 'person', 250.00, false, false, true, 1);
insert into public.catalog_translations (item_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000016c1', 'en', 'published', 'Boat trip'),
  ('00000000-0000-4000-8000-0000000016c1', 'es', 'published', 'Paseo en barco');
update public.site_settings set vat_percent = 5.00, deposit_percent = 30.00, balance_due_days = null where id = 1;

-- A. Privileges -----------------------------------------------------------------------------------------------------
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
              and c.relname in ('booking_bank_details', 'booking_money_settings_log', 'booking_notes')),
          3, 'privileges: RLS is on for the three new tables');
select is((select count(*)::int from pg_policies where schemaname = 'public'
            and tablename in ('booking_bank_details', 'booking_money_settings_log', 'booking_notes')),
          0, 'privileges: the three new tables have no policy');
select is((select count(*)::int from information_schema.role_table_grants
            where table_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
              and table_name in ('booking_bank_details', 'booking_money_settings_log', 'booking_notes')),
          0, 'privileges: no table privilege is held by anon, authenticated or public on the three new tables');
select ok(not has_sequence_privilege('anon', 'public.booking_money_settings_log_id_seq', 'usage, select, update')
      and not has_sequence_privilege('authenticated', 'public.booking_money_settings_log_id_seq', 'usage, select, update')
      and not has_sequence_privilege('anon', 'public.booking_notes_id_seq', 'usage, select, update')
      and not has_sequence_privilege('authenticated', 'public.booking_notes_id_seq', 'usage, select, update'),
          'privileges: anon and authenticated hold nothing on the two identity sequences');

set local role anon;
select throws_ok($$select * from public.booking_bank_details$$, '42501', null, 'anon cannot read booking_bank_details');
select throws_ok($$insert into public.booking_bank_details (id) values (1)$$, '42501', null, 'anon cannot insert booking_bank_details');
select throws_ok($$update public.booking_bank_details set note_en = 'x' where id = 1$$, '42501', null, 'anon cannot update booking_bank_details');
select throws_ok($$select * from public.booking_money_settings_log$$, '42501', null, 'anon cannot read booking_money_settings_log');
select throws_ok($$insert into public.booking_money_settings_log (actor, changed) values (gen_random_uuid(), array['x'])$$, '42501', null, 'anon cannot insert booking_money_settings_log');
select throws_ok($$update public.booking_money_settings_log set changed = array['y']$$, '42501', null, 'anon cannot update booking_money_settings_log');
select throws_ok($$select * from public.booking_notes$$, '42501', null, 'anon cannot read booking_notes');
select throws_ok($$insert into public.booking_notes (booking_id, actor, body) values (gen_random_uuid(), 'x', 'y')$$, '42501', null, 'anon cannot insert booking_notes');
select throws_ok($$update public.booking_notes set body = 'z'$$, '42501', null, 'anon cannot update booking_notes');
select throws_ok($$select public.booking_gate()$$, '42501', null, 'anon cannot call booking_gate');
select throws_ok($$select public.ops_get_money_settings()$$, '42501', null, 'anon cannot call ops_get_money_settings');
select throws_ok($$select public.request_web_booking(gen_random_uuid(), true)$$, '42501', null, 'anon cannot call request_web_booking');
select throws_ok($$select public.booking_withdraw_request(gen_random_uuid(), true)$$, '42501', null, 'anon cannot call booking_withdraw_request');
select throws_ok($$select public.booking_view(gen_random_uuid(), 'en', true)$$, '42501', null, 'anon cannot call booking_view');
select throws_ok($$select public.booking_transfer_instructions(gen_random_uuid(), 'en')$$, '42501', null, 'anon cannot call booking_transfer_instructions');
select throws_ok($$select public.guest_bookings('a@example.com', 'en', true)$$, '42501', null, 'anon cannot call guest_bookings');
select lives_ok($$select * from public.public_booked_nights()$$, 'anon may still call public_booked_nights');
set local role authenticated;
select throws_ok($$select * from public.booking_bank_details$$, '42501', null, 'authenticated cannot read booking_bank_details');
select throws_ok($$insert into public.booking_bank_details (id) values (1)$$, '42501', null, 'authenticated cannot insert booking_bank_details');
select throws_ok($$update public.booking_bank_details set note_en = 'x' where id = 1$$, '42501', null, 'authenticated cannot update booking_bank_details');
select throws_ok($$select * from public.booking_money_settings_log$$, '42501', null, 'authenticated cannot read booking_money_settings_log');
select throws_ok($$insert into public.booking_money_settings_log (actor, changed) values (gen_random_uuid(), array['x'])$$, '42501', null, 'authenticated cannot insert booking_money_settings_log');
select throws_ok($$update public.booking_money_settings_log set changed = array['y']$$, '42501', null, 'authenticated cannot update booking_money_settings_log');
select throws_ok($$select * from public.booking_notes$$, '42501', null, 'authenticated cannot read booking_notes');
select throws_ok($$insert into public.booking_notes (booking_id, actor, body) values (gen_random_uuid(), 'x', 'y')$$, '42501', null, 'authenticated cannot insert booking_notes');
select throws_ok($$update public.booking_notes set body = 'z'$$, '42501', null, 'authenticated cannot update booking_notes');
select throws_ok($$select public.ops_save_money_settings('{"transfer_window_minutes": 60}'::jsonb, '00000000-0000-4000-8000-0000000016f1')$$, '42501', null, 'authenticated cannot call ops_save_money_settings');
select throws_ok($$select public.booking_view(gen_random_uuid(), 'en', true)$$, '42501', null, 'authenticated cannot call booking_view');
select throws_ok($$select public.guest_bookings('a@example.com', 'en', true)$$, '42501', null, 'authenticated cannot call guest_bookings');
select lives_ok($$select * from public.public_booked_nights()$$, 'authenticated may still call public_booked_nights');
reset role;

select ok(to_regprocedure('public.booking_assert_owner(uuid)') is not null
      and to_regprocedure('public.booking_iban_ok(text)') is not null
      and to_regprocedure('public.booking_bic_ok(text)') is not null
      and to_regprocedure('public.booking_bank_complete()') is not null
      and to_regprocedure('public.booking_window_minutes(boolean)') is not null
      and to_regprocedure('public.booking_next_status(text, text, bigint, bigint, bigint)') is not null
      and to_regprocedure('public.booking_flags(public.bookings)') is not null
      and to_regprocedure('public.booking_gate()') is not null
      and to_regprocedure('public.ops_get_money_settings()') is not null
      and to_regprocedure('public.ops_save_money_settings(jsonb, uuid)') is not null
      and to_regprocedure('public.request_web_booking(uuid, boolean)') is not null
      and to_regprocedure('public.booking_withdraw_request(uuid, boolean)') is not null
      and to_regprocedure('public.public_booked_nights()') is not null
      and to_regprocedure('public.booking_transfer_instructions(uuid, text)') is not null
      and to_regprocedure('public.booking_view(uuid, text, boolean)') is not null
      and to_regprocedure('public.guest_bookings(text, text, boolean)') is not null,
          'privileges: the sixteen functions of part A exist with their exact signatures');
select is((select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (array[
              'booking_assert_owner', 'booking_iban_ok', 'booking_bic_ok', 'booking_bank_complete', 'booking_window_minutes',
              'booking_next_status', 'booking_flags', 'booking_gate', 'ops_get_money_settings', 'ops_save_money_settings',
              'request_web_booking', 'booking_withdraw_request', 'public_booked_nights', 'booking_transfer_instructions',
              'booking_view', 'guest_bookings'])
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
          array['public_booked_nights'], 'privileges: of the sixteen only public_booked_nights is executable by anon or authenticated');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (array[
              'booking_assert_owner', 'booking_iban_ok', 'booking_bic_ok', 'booking_bank_complete', 'booking_window_minutes',
              'booking_next_status', 'booking_flags', 'booking_gate', 'ops_get_money_settings', 'ops_save_money_settings',
              'request_web_booking', 'booking_withdraw_request', 'public_booked_nights', 'booking_transfer_instructions',
              'booking_view', 'guest_bookings'])
              and p.prosecdef and has_function_privilege('service_role', p.oid, 'execute')
              and exists (select 1 from unnest(p.proconfig) cfg where cfg = 'search_path=""')),
          16, 'privileges: all sixteen are definer functions with search_path empty and executable by service_role');
select is(pg_get_function_result('public.public_booked_nights()'::regprocedure), 'TABLE(stay_id uuid, day date)', 'privileges: public_booked_nights still returns only (stay_id, day)');
select columns_are('public', 'api_site_settings',
  array['maintenance', 'teal', 'charcoal', 'gold', 'ivory', 'white', 'title_face', 'body_face', 'logo_key'],
  'privileges: api_site_settings still has its nine columns');
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'site_settings'
            and column_name in ('account_name', 'bank_name', 'iban', 'swift', 'bank_address', 'note_en', 'note_ar', 'note_es', 'transfer_window_minutes')),
          0, 'privileges: site_settings has none of the bank or window columns');

-- B. Constraints ----------------------------------------------------------------------------------------------------
select ok((select pg_get_constraintdef(c.oid) like '%''transfer''%' and convalidated from pg_constraint c
            where c.conrelid = 'public.booking_payments'::regclass and c.conname = 'booking_payments_kind_check'),
          'constraints: the kind check allows transfer and is validated');
select ok((select pg_get_constraintdef(c.oid) like '%''voided''%' and convalidated from pg_constraint c
            where c.conrelid = 'public.booking_payments'::regclass and c.conname = 'booking_payments_status_check'),
          'constraints: the status check allows voided and is validated');
select ok((select pg_get_constraintdef(c.oid) like '%''bank_transfer''%' and pg_get_constraintdef(c.oid) like '%200%' and convalidated from pg_constraint c
            where c.conrelid = 'public.booking_payments'::regclass and c.conname = 'booking_payments_amount_fils_check'),
          'constraints: the amount check keeps 200 for cards and lets a bank row go lower (P-04)');
select ok((select pg_get_constraintdef(c.oid) like '%''resend_requested''%' and pg_get_constraintdef(c.oid) like '%''request_withdrawn''%'
              and pg_get_constraintdef(c.oid) like '%''request_sent''%' and pg_get_constraintdef(c.oid) like '%''email_pending''%' and convalidated
            from pg_constraint c where c.conrelid = 'public.booking_events'::regclass and c.conname = 'booking_events_action_check'),
          'constraints: the action check still holds resend_requested and now request_sent, email_pending and request_withdrawn');
select is((select (length(d) - length(replace(d, '::text', ''))) / 6
             from (select pg_get_constraintdef(c.oid) as d from pg_constraint c
                    where c.conrelid = 'public.booking_events'::regclass and c.conname = 'booking_events_action_check') x),
          20, 'constraints: the action check lists 20 actions (email_unknown added after the 04-05 review)');
select ok((select pg_get_constraintdef(c.oid) like '%''deadline_passed_part_paid''%' and pg_get_constraintdef(c.oid) not like '%expired_with_payment%'
             from pg_constraint c where c.conrelid = 'public.bookings'::regclass and c.contype = 'c'
              and pg_get_constraintdef(c.oid) like '%paid_after_expiry%'),
          'constraints: the attention check holds deadline_passed_part_paid and not expired_with_payment (P-09)');
select is((select count(*)::int from pg_constraint c
            where c.convalidated and c.conname in ('booking_payments_transfer_fields', 'booking_payments_voided_fields', 'booking_payments_request_id_key', 'bookings_attention_pair')),
          4, 'constraints: the four added constraints exist and are validated');

select pg_temp.mk('cx', 'req-stay-two', 300, 1, 'cx@example.com', true, 'full');
select throws_ok(format($$insert into public.booking_payments (booking_id, kind, amount_fils) values (%L, 'full', 199)$$, pg_temp.bid('cx')),
  '23514', null, 'constraints: a card row of 199 fils is refused');
select lives_ok(format($$insert into public.booking_payments (booking_id, kind, method, status, amount_fils, received_on, bank_reference, recorded_by, request_id)
  values (%L, 'transfer', 'bank_transfer', 'succeeded', 1, current_date, 'TEST-REF-1', %L, '00000000-0000-4000-8000-0000000016b1')$$, pg_temp.bid('cx'), pg_temp.owner_id()),
  'constraints: a bank row of 1 fils is accepted (P-04)');
select throws_ok(format($$insert into public.booking_payments (booking_id, kind, method, status, amount_fils, received_on, bank_reference, recorded_by, request_id)
  values (%L, 'transfer', 'bank_transfer', 'succeeded', 500, current_date, 'TEST-REF-2', %L, '00000000-0000-4000-8000-0000000016b1')$$, pg_temp.bid('cx'), pg_temp.owner_id()),
  '23505', null, 'constraints: the same request_id twice is refused');
select throws_ok(format($$insert into public.booking_payments (booking_id, kind, method, status, amount_fils, received_on, bank_reference, recorded_by, request_id)
  values (%L, 'deposit', 'bank_transfer', 'succeeded', 500, current_date, 'TEST-REF-3', %L, gen_random_uuid())$$, pg_temp.bid('cx'), pg_temp.owner_id()),
  '23514', null, 'constraints: a bank row is of kind transfer');
select throws_ok(format($$insert into public.booking_payments (booking_id, kind, method, status, amount_fils, bank_reference, recorded_by, request_id)
  values (%L, 'transfer', 'bank_transfer', 'succeeded', 500, 'TEST-REF-4', %L, gen_random_uuid())$$, pg_temp.bid('cx'), pg_temp.owner_id()),
  '23514', null, 'constraints: a bank row needs its received date');
select throws_ok(format($$insert into public.booking_payments (booking_id, kind, method, status, amount_fils, received_on, bank_reference, recorded_by, request_id)
  values (%L, 'transfer', 'bank_transfer', 'voided', 500, current_date, 'TEST-REF-5', %L, gen_random_uuid())$$, pg_temp.bid('cx'), pg_temp.owner_id()),
  '23514', null, 'constraints: a voided row without its void fields is refused');
select lives_ok(format($$insert into public.booking_payments (booking_id, kind, method, status, amount_fils, received_on, bank_reference, recorded_by, request_id, void_reason, voided_at, voided_by)
  values (%L, 'transfer', 'bank_transfer', 'voided', 500, current_date, 'TEST-REF-6', %L, gen_random_uuid(), 'Typed twice', now(), %L)$$, pg_temp.bid('cx'), pg_temp.owner_id(), pg_temp.owner_id()),
  'constraints: a voided row with its three void fields is accepted');
select throws_ok(format($$update public.bookings set attention_reason = 'overpaid' where id = %L$$, pg_temp.bid('cx')),
  '23514', null, 'constraints: an attention reason needs needs_attention');
select lives_ok(format($$select public.log_booking_event(%L, 'guest', 'request_withdrawn', '{}')$$, pg_temp.bid('cx')),
  'constraints: request_withdrawn is an allowed history action');

-- C. The owner's money settings ---------------------------------------------------------------------------------------
select ok((select g ->> 'transfer_window_minutes' is null and jsonb_strip_nulls(g -> 'bank') = '{}'::jsonb
              and g ->> 'bank_complete' = 'false' and g ->> 'updated_by' is null
             from (select public.ops_get_money_settings() as g) x),
          'money: a fresh get is all nulls and bank_complete false');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.ops_get_money_settings()) k),
          array['balance_due_days', 'bank', 'bank_complete', 'transfer_window_minutes', 'updated_at', 'updated_by'], 'money: get has exactly its six keys');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.ops_get_money_settings() -> 'bank') k),
          array['account_name', 'bank_address', 'bank_name', 'iban', 'note_ar', 'note_en', 'note_es', 'swift'], 'money: bank has exactly its eight keys');
select is(pg_temp.err($$select public.ops_save_money_settings('{"transfer_window_minutes": 60}', '00000000-0000-4000-8000-0000000016f2')$$),
          'almar:not_owner', 'money: a guest actor is not the owner');
select is(pg_temp.err($$select public.ops_save_money_settings('{"transfer_window_minutes": 60}', gen_random_uuid())$$),
          'almar:not_owner', 'money: an unknown actor is not the owner');
select is(pg_temp.err($$select public.ops_save_money_settings('{"transfer_window_minutes": 60}', null)$$),
          'almar:not_owner', 'money: a null actor is not the owner');
select is(pg_temp.err($$select pg_temp.save('[]')$$), 'almar:invalid:payload', 'money: a payload that is not an object is refused');
select is(pg_temp.err($$select pg_temp.save('{}')$$), 'almar:invalid:payload', 'money: at least one key is needed');
select is(pg_temp.err($$select pg_temp.save('{"transfer_window_minutes": 60, "currency": "AED"}')$$), 'almar:invalid:currency', 'money: an unknown key is refused by name');
select is(pg_temp.err($$select pg_temp.save('{"transfer_window_minutes": 34}')$$), 'almar:invalid:transfer_window_minutes', 'money: a window of 34 minutes is refused');
select is(pg_temp.err($$select pg_temp.save('{"transfer_window_minutes": 43201}')$$), 'almar:invalid:transfer_window_minutes', 'money: a window of 43201 minutes is refused');
select is(pg_temp.err($$select pg_temp.save('{"transfer_window_minutes": "60"}')$$), 'almar:invalid:transfer_window_minutes', 'money: a window as text is refused');
select is(pg_temp.save('{"transfer_window_minutes": 35}') ->> 'transfer_window_minutes', '35', 'money: a window of 35 minutes is accepted');
select is((select transfer_window_minutes from public.booking_bank_details where id = 1), 35, 'money: and stored');
select is(pg_temp.save('{"transfer_window_minutes": 43200}') ->> 'transfer_window_minutes', '43200', 'money: a window of 30 days is accepted');
select is(pg_temp.save('{"transfer_window_minutes": null}') ->> 'transfer_window_minutes', null, 'money: an empty window is accepted (requests closed)');
select is(pg_temp.err($$select pg_temp.save('{"balance_due_days": 366}')$$), 'almar:invalid:balance_due_days', 'money: balance due days of 366 are refused');
select is(pg_temp.save('{"balance_due_days": 30}') ->> 'balance_due_days', '30', 'money: balance due days are saved');
select is((select balance_due_days from public.site_settings where id = 1), 30, 'money: into site_settings row 1');
select lives_ok($$select public.save_site_settings('00000000-0000-4000-8000-0000000016f1', null, null, null, null, null, 'Questa', 'Lato', 5, 30, false, null, 'en', 'AED')$$,
  'money: the 14-parameter save_site_settings is still callable afterwards');
select is((select balance_due_days from public.site_settings where id = 1), 30, 'money: and leaves balance due days as they were');

select is(pg_temp.err($$select pg_temp.save('{"bank": "x"}')$$), 'almar:invalid:bank', 'money: bank must be an object');
select is(pg_temp.err($$select pg_temp.save(pg_temp.bank('{"branch": "Main"}'))$$), 'almar:invalid:branch', 'money: an unknown bank key is refused by name');
select is(pg_temp.err($$select pg_temp.save(pg_temp.bank() #- '{bank,swift}')$$), 'almar:invalid:swift', 'money: each of the six bank keys must be present');
select is(pg_temp.err($$select pg_temp.save(pg_temp.bank('{"iban": "GB82 WEST 1234 5698 7654 33"}'))$$), 'almar:invalid:iban', 'money: an IBAN with a changed last digit is refused (mod 97)');
select is(pg_temp.err($$select pg_temp.save(pg_temp.bank('{"iban": "AE07 0331 2345 6789 0123 457"}'))$$), 'almar:invalid:iban', 'money: a UAE IBAN with a changed last digit is refused');
select is(pg_temp.err($$select pg_temp.save(pg_temp.bank('{"swift": "TESTAEAAX"}'))$$), 'almar:invalid:swift', 'money: a 9-character BIC is refused');
select is((select count(*)::int from public.booking_money_settings_log), 4, 'money: four saves changed something so far, one log row each');
insert into t_res values ('m1', pg_temp.save(pg_temp.bank('{"iban": "gb82 west 1234 5698 7654 32", "swift": "testaeaa", "note_ar": "AR: fees by sender", "note_es": "ES: gastos del remitente"}')));
select is(pg_temp.r('m1', 'bank.iban'), 'GB82WEST12345698765432', 'money: the IBAN is stored without spaces and in upper case');
select is(pg_temp.r('m1', 'bank.swift'), 'TESTAEAA', 'money: an 8-character BIC is accepted and stored in upper case');
select is(pg_temp.r('m1', 'bank_complete'), 'true', 'money: complete with all six');
select is(pg_temp.r('m1', 'updated_by'), '00000000-0000-4000-8000-0000000016f1', 'money: updated_by is the owner');
select is((select count(*)::int from public.booking_money_settings_log), 5, 'money: that save wrote one log row');
select is((select changed from public.booking_money_settings_log order by id desc limit 1),
          array['account_name', 'bank_name', 'iban', 'swift', 'bank_address', 'note_en', 'note_ar', 'note_es'], 'money: the log row lists the changed field names');
select is((select count(*)::int from public.booking_money_settings_log l
            where array_to_string(l.changed, ' ') ~* 'GB82|WEST|TESTAEAA|AE07|Almar Test Account|Test Street'),
          0, 'money: no log row holds a value (P-15)');
select is(pg_temp.save(pg_temp.bank('{"iban": "GB82WEST12345698765432", "note_ar": "AR: fees by sender", "note_es": "ES: gastos del remitente"}')) ->> 'bank_complete',
          'true', 'money: the same values saved again');
select is((select count(*)::int from public.booking_money_settings_log), 5, 'money: a save that changes nothing writes no log row');
select is(pg_temp.save(pg_temp.bank()) #>> '{bank,note_ar}', 'AR: fees by sender', 'money: an unchanged English note with Arabic and Spanish absent keeps them (P-16)');
select is((select note_es from public.booking_bank_details where id = 1), 'ES: gastos del remitente', 'money: the Spanish note is kept too');
insert into t_res values ('m2', pg_temp.save(pg_temp.bank('{"note_en": "Fees are paid by the sender."}')));
select ok(pg_temp.r('m2', 'bank.note_ar') is null and pg_temp.r('m2', 'bank.note_es') is null, 'money: a changed English note without Arabic and Spanish clears them (P-16)');
select is(pg_temp.save(pg_temp.bank('{"swift": "TESTAEAAXXX", "iban": "AE07 0331 2345 6789 0123 456"}')) #>> '{bank,swift}', 'TESTAEAAXXX', 'money: an 11-character BIC is accepted');
select is((select iban from public.booking_bank_details where id = 1), 'AE070331234567890123456', 'money: a UAE IBAN is accepted');
select is(pg_temp.save(pg_temp.bank('{"note_en": ""}')) ->> 'bank_complete', 'false', 'money: incomplete with only the English note missing (P-08)');
select is(pg_temp.save(pg_temp.bank('{"bank_address": null}')) ->> 'bank_complete', 'false', 'money: incomplete without the bank address');
select is(pg_temp.save(pg_temp.bank()) ->> 'bank_complete', 'true', 'money: complete again with all six');

select is((select array_agg(k order by k collate "C") from jsonb_object_keys(public.booking_gate()) k),
          array['bank_complete', 'settings_present', 'window_minutes'], 'gate: exactly three keys, never a bank value');
select is(public.booking_gate(), '{"window_minutes": null, "bank_complete": true, "settings_present": true}'::jsonb, 'gate: window not set, bank complete, settings present');
update public.site_settings set vat_percent = null where id = 1;
select is(public.booking_gate() ->> 'settings_present', 'false', 'gate: settings_present false while VAT is empty');
update public.site_settings set vat_percent = 5.00 where id = 1;

-- D. request_web_booking ----------------------------------------------------------------------------------------------
-- State: bank details complete, the owner's window not set.
select pg_temp.mk('rq1', 'req-stay-one', 10, 2, 'rq1@example.com');
select pg_temp.rq('rq1');
select is(pg_temp.r('q:rq1', 'ok') || '/' || pg_temp.r('q:rq1', 'first_time'), 'true/true', 'request: a live hold becomes a request, first_time true');
select is(pg_temp.st('rq1'), 'awaiting_payment', 'request: status awaiting_payment');
select ok((select requested_at = now() from public.bookings where id = pg_temp.bid('rq1')), 'request: requested_at is set');
select is((select hold_expires_at from public.bookings where id = pg_temp.bid('rq1')), now() + interval '35 minutes', 'request: a TEST booking gets 35 minutes with the owner window null (P-06)');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('rq1') and expires_at = now() + interval '35 minutes'), 2,
          'request: every night is held to the deadline');
select is(pg_temp.r('q:rq1', 'deadline'), pg_temp.iso(now() + interval '35 minutes'), 'request: the answer carries the deadline as ISO UTC');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v from t_res where k = 'q:rq1')) k),
          array['booking_id', 'deadline', 'first_time', 'is_test', 'locale', 'ok', 'ref', 'status', 'window_minutes'], 'request: the answer has exactly its keys');
select is(pg_temp.ev('rq1', 'request_sent'), 1, 'request: one request_sent event');
select ok((select e.actor = 'guest' and e.from_status = 'held' and e.to_status = 'awaiting_payment'
              and e.detail = jsonb_build_object('window_minutes', 35, 'deadline', pg_temp.iso(now() + interval '35 minutes'), 'plan', 'deposit',
                                                'due_now_fils', 63000, 'is_test', true)
             from public.booking_events e where e.booking_id = pg_temp.bid('rq1') and e.action = 'request_sent'),
          'request: the event is the guest''s, held to awaiting_payment, with window, deadline, plan, due now and the TEST flag');
select pg_temp.rq('rq1');
select is(pg_temp.r('q:rq1', 'ok') || '/' || pg_temp.r('q:rq1', 'first_time'), 'true/false', 'request: a second call answers first_time false');
select is(pg_temp.r('q:rq1', 'deadline'), pg_temp.iso(now() + interval '35 minutes'), 'request: with the same deadline');
select is(pg_temp.ev('rq1', 'request_sent'), 1, 'request: and still one request_sent event');

select pg_temp.mk('rl1', 'req-stay-one', 14, 2, 'rl1@example.com', false);
select is(pg_temp.rq('rl1', false) ->> 'reason', 'requests_closed', 'request: a real booking with the window not set is requests_closed');
select is(pg_temp.st('rl1'), 'held', 'request: and stays held');
update public.booking_bank_details set transfer_window_minutes = 120 where id = 1;
select pg_temp.mk('rq2', 'req-stay-one', 18, 2, 'rq2@example.com', true, 'deposit',
  jsonb_build_array(pg_temp.line('00000000-0000-4000-8000-0000000016c1', 'Boat trip', 'person', false, false, 25000, 2)));
select is(pg_temp.rq('rq2') ->> 'window_minutes', '35', 'request: a TEST booking still gets 35 minutes with the owner window set to 120 (P-06)');
select is((select hold_expires_at from public.bookings where id = pg_temp.bid('rq2')), now() + interval '35 minutes', 'request: and its deadline is 35 minutes away');
update public.booking_bank_details set note_en = null where id = 1;
select is(pg_temp.rq('rl1', false) ->> 'reason', 'requests_closed', 'request: a real booking with the bank details incomplete is requests_closed');
update public.booking_bank_details set note_en = 'All fees paid by the sender.' where id = 1;
select is(pg_temp.rq('rl1', false) ->> 'window_minutes', '120', 'request: a real booking gets the owner''s window');
select is((select hold_expires_at from public.bookings where id = pg_temp.bid('rl1')), now() + interval '120 minutes', 'request: and the deadline 120 minutes away');

select pg_temp.mk('rq3', 'req-stay-one', 22, 2, 'rq3@example.com');
select is(pg_temp.rq('rq3', false) ->> 'reason', 'not_found', 'request: a TEST booking asked on the real host is not_found');
insert into t_res values ('op1', public.ops_create_booking(pg_temp.ops('req-stay-two', pg_temp.d(10), pg_temp.d(12), 'op1@example.com', interval '48 hours'), pg_temp.owner_id()));
select is(public.request_web_booking(pg_temp.bid('op1'), true) ->> 'reason', 'not_found', 'request: a hand-made booking is not_found');
select is(public.request_web_booking(gen_random_uuid(), true) ->> 'reason', 'not_found', 'request: an unknown id is not_found');
select throws_ok($$select public.request_web_booking(null, true)$$, 'P0001', 'almar:invalid', 'request: a null id is invalid');
select throws_ok(format($$select public.request_web_booking(%L, null)$$, pg_temp.bid('rq3')), 'P0001', 'almar:invalid', 'request: a null host flag is invalid');

select pg_temp.mk('rq4', 'req-stay-one', 26, 2, 'rq4@example.com');
update public.bookings set hold_expires_at = now() - interval '1 second' where id = pg_temp.bid('rq4');
select is(pg_temp.rq('rq4') ->> 'reason', 'hold_ended', 'request: a hold that has lapsed (no grace) is hold_ended');
select ok(pg_temp.st('rq4') = 'held' and pg_temp.ev('rq4', 'request_sent') = 0
      and (select requested_at is null from public.bookings where id = pg_temp.bid('rq4')),
          'request: and nothing changed');

select pg_temp.mk('rq5', 'req-stay-one', 30, 2, 'rq5@example.com');
insert into public.availability_blocks (scope, destination_id, stay_id, starts_on, ends_on) values
  ('stay', null, '00000000-0000-4000-8000-0000000016e1', pg_temp.d(31), pg_temp.d(31));
select is(pg_temp.rq('rq5') ->> 'reason', 'blocked', 'request: an ops block added after the hold is blocked');
select ok(pg_temp.st('rq5') = 'held' and pg_temp.ev('rq5', 'request_sent') = 0 and pg_temp.nights('rq5') = 2,
          'request: and the booking is still held with its nights');

select pg_temp.mkq('mn1', 'req-stay-two', 20, 2, 'many@example.com');
select pg_temp.mkq('mn2', 'req-stay-two', 24, 2, 'many@example.com');
select pg_temp.mkq('mn3', 'req-stay-two', 28, 2, 'many@example.com');
select pg_temp.mk('mn4', 'req-stay-two', 32, 2, 'many@example.com');
select is(pg_temp.rq('mn4') ->> 'reason', 'too_many_open', 'request: three open requests of one email make the fourth too_many_open (P-05)');
select is(pg_temp.st('mn4'), 'held', 'request: and the fourth stays held');
select pg_temp.past('mn1', interval '5 minutes');
update public.bookings set paid_fils = 1000 where id = pg_temp.bid('mn1');
select is(pg_temp.rq('mn4') ->> 'reason', 'too_many_open', 'request: a part-paid request past its deadline is still counted (P-09)');
update public.bookings set paid_fils = 0 where id = pg_temp.bid('mn1');
select is(pg_temp.rq('mn4') ->> 'first_time', 'true', 'request: a lapsed unpaid request is not counted');
select pg_temp.mk('mn5', 'req-stay-two', 36, 2, 'many@example.com', false);
select is(pg_temp.rq('mn5', false) ->> 'first_time', 'true', 'request: TEST requests of the same email do not count against a real one (P-20)');

select pg_temp.mkq('rq7', 'req-stay-one', 34, 2, 'rq7@example.com');
update public.bookings set status = 'expired' where id = pg_temp.bid('rq7');
select is(pg_temp.rq('rq7') ->> 'reason', 'hold_ended', 'request: a requested booking that expired is hold_ended');

select pg_temp.mkq('rq8', 'req-stay-one', 38, 2, 'rq8@example.com');
select pg_temp.past('rq8', interval '3 minutes');
select is(pg_temp.rq('rq8') ->> 'reason', 'hold_ended', 'request: an unpaid request 3 minutes past its deadline, not swept yet, is hold_ended');
select is(pg_temp.st('rq8'), 'awaiting_payment', 'request: and it is still awaiting_payment (the sweep lapses it)');
select pg_temp.past('rq8', interval '1 minute');
select is(pg_temp.rq('rq8') ->> 'first_time', 'false', 'request: 1 minute past its deadline it answers first_time false');
select pg_temp.past('rq8', interval '3 minutes');
-- As the first recorded payment leaves it (P-09): money in, nights permanent.
update public.booking_nights set expires_at = null where booking_id = pg_temp.bid('rq8');
update public.bookings set paid_fils = 1000 where id = pg_temp.bid('rq8');
select is(pg_temp.rq('rq8') ->> 'first_time', 'false', 'request: a part-paid request 3 minutes past its deadline answers first_time false, not hold_ended (P-09)');
select is(pg_temp.r('q:rq8', 'deadline'), pg_temp.iso(now() - interval '3 minutes'), 'request: with its stored deadline');

-- E. booking_withdraw_request (P-19) ----------------------------------------------------------------------------------
select pg_temp.mkq('w1', 'req-stay-two', 40, 2, 'w1@example.com');
insert into t_res values ('x:w1', public.booking_withdraw_request(pg_temp.bid('w1'), true));
select is((select v from t_res where k = 'x:w1'), jsonb_build_object('ok', true, 'first_time', true, 'ref', pg_temp.r('w1', 'ref'), 'status', 'cancelled'),
          'withdraw: an unpaid request is withdrawn, first_time true');
select is(pg_temp.st('w1'), 'cancelled', 'withdraw: status cancelled');
select is(pg_temp.nights('w1'), 0, 'withdraw: its nights are freed at once');
select is(pg_temp.ev('w1', 'request_withdrawn'), 1, 'withdraw: one request_withdrawn event');
select ok((select e.actor = 'guest' and e.from_status = 'awaiting_payment' and e.to_status = 'cancelled'
              and e.detail = jsonb_build_object('plan', 'deposit', 'deadline', pg_temp.iso(now() + interval '35 minutes'))
             from public.booking_events e where e.booking_id = pg_temp.bid('w1') and e.action = 'request_withdrawn'),
          'withdraw: the event is the guest''s, awaiting_payment to cancelled, with plan and deadline');
select pg_temp.mk('w1b', 'req-stay-two', 62, 1, 'w1b@example.com');
select is(public.place_hold(pg_temp.bid('w1b'), '00000000-0000-4000-8000-0000000016e2', pg_temp.d(40), pg_temp.d(42), now() + interval '30 minutes'),
          'ok', 'withdraw: another booking can hold those nights');
select is(public.booking_withdraw_request(pg_temp.bid('w1'), true), jsonb_build_object('ok', true, 'first_time', false, 'ref', pg_temp.r('w1', 'ref'), 'status', 'cancelled'),
          'withdraw: a second call answers first_time false');
select is(pg_temp.ev('w1', 'request_withdrawn'), 1, 'withdraw: and still one event');

select pg_temp.mkq('w2', 'req-stay-two', 44, 2, 'w2@example.com');
update public.bookings set paid_fils = 1000 where id = pg_temp.bid('w2');
select is(public.booking_withdraw_request(pg_temp.bid('w2'), true) ->> 'reason', 'part_paid', 'withdraw: a request with a payment recorded is part_paid');
select ok(pg_temp.st('w2') = 'awaiting_payment' and pg_temp.nights('w2') = 2 and pg_temp.ev('w2', 'request_withdrawn') = 0,
          'withdraw: and nothing changed');
select is(public.booking_withdraw_request(pg_temp.bid('rq3'), true) ->> 'reason', 'not_withdrawable', 'withdraw: a held booking is not_withdrawable (release is for holds)');
select pg_temp.mkq('w4', 'req-stay-two', 48, 2, 'w4@example.com');
select pg_temp.settle('w4', 'deposit_paid');
select is(public.booking_withdraw_request(pg_temp.bid('w4'), true) ->> 'reason', 'not_withdrawable', 'withdraw: deposit_paid is not_withdrawable');
update public.bookings set status = 'confirmed' where id = pg_temp.bid('w4');
select is(public.booking_withdraw_request(pg_temp.bid('w4'), true) ->> 'reason', 'not_withdrawable', 'withdraw: confirmed is not_withdrawable');
select is(public.booking_withdraw_request(pg_temp.bid('rq7'), true) ->> 'reason', 'not_withdrawable', 'withdraw: expired is not_withdrawable');
select pg_temp.mkq('w7', 'req-stay-two', 52, 2, 'w7@example.com');
select public.ops_set_booking_status(pg_temp.bid('w7'), 'cancelled', 'awaiting_payment', pg_temp.owner_id());
select is(public.booking_withdraw_request(pg_temp.bid('w7'), true) ->> 'reason', 'not_withdrawable', 'withdraw: a request the owner cancelled is not_withdrawable');
select pg_temp.mkq('w8', 'req-stay-two', 56, 2, 'w8@example.com');
select pg_temp.past('w8', interval '3 minutes');
select is(public.booking_withdraw_request(pg_temp.bid('w8'), true) ->> 'reason', 'not_withdrawable', 'withdraw: an unpaid request 3 minutes past its deadline is not_withdrawable');
select is(pg_temp.st('w8'), 'awaiting_payment', 'withdraw: and it is unchanged');
select pg_temp.past('w8', interval '1 minute');
select is(public.booking_withdraw_request(pg_temp.bid('w8'), true) ->> 'first_time', 'true', 'withdraw: 1 minute past its deadline it is withdrawn (the 2-minute grace)');
select is(public.booking_withdraw_request(pg_temp.bid('w2'), false) ->> 'reason', 'not_found', 'withdraw: a TEST booking asked on the real host is not_found');
select is(public.booking_withdraw_request(pg_temp.bid('op1'), true) ->> 'reason', 'not_found', 'withdraw: a hand-made booking is not_found');
select is(public.booking_withdraw_request(gen_random_uuid(), true) ->> 'reason', 'not_found', 'withdraw: an unknown id is not_found');
select throws_ok($$select public.booking_withdraw_request(null, true)$$, 'P0001', 'almar:invalid', 'withdraw: a null id is invalid');

-- F. The baked calendar (public_booked_nights; A10, P-09) ---------------------------------------------------------------
select is(pg_temp.baked('rq1'), 0, 'baked: a web request is not listed');
select is(pg_temp.baked('op1'), 2, 'baked: a hand-made hold still in force is listed');
select pg_temp.mkq('dp1', 'req-stay-two', 74, 2, 'dp1@example.com');
select pg_temp.settle('dp1', 'deposit_paid');
select is(pg_temp.baked('dp1'), 2, 'baked: the permanent nights of a deposit_paid booking are listed');
select pg_temp.mkq('pp1', 'req-stay-two', 66, 2, 'pp1@example.com');
update public.booking_nights set expires_at = null where booking_id = pg_temp.bid('pp1');
update public.bookings set paid_fils = 1000 where id = pg_temp.bid('pp1');
select is(pg_temp.baked('pp1'), 0, 'baked: the permanent nights of a part-paid web request are not listed');
select is(pg_temp.baked('rq5'), 0, 'baked: a 30-minute web hold is not listed');

-- G. booking_view ---------------------------------------------------------------------------------------------------
-- State: bank details complete (IBAN GB82WEST12345698765432, BIC TESTAEAA), English note only, owner window 120.
select is(public.booking_view(gen_random_uuid(), null, true), null, 'view: null for an unknown booking');
select is(pg_temp.bv('rq1', null, false), null, 'view: null for a TEST booking asked on the real host');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(pg_temp.bv('rq1')) k),
          array['access', 'adults', 'airport', 'arrive', 'balance_due_date', 'children', 'deadline', 'email', 'flags', 'guest_name',
                'hold_expires_at', 'infants', 'leave', 'lines', 'locale', 'money', 'nights', 'payments', 'pickup_address', 'plan', 'ref',
                'status', 'stay', 'transfer', 'travellers', 'withdrawable'],
          'view: exactly its top-level keys (no id, phone, notes, events, attention, TEST flag or write-off)');
select is(pg_temp.bv('rq1') #>> '{transfer,amount_fils}', '63000', 'view: an awaiting request shows the transfer for its deposit');
select ok(pg_temp.bv('rq1') #>> '{transfer,reference}' = pg_temp.r('rq1', 'ref') and pg_temp.bv('rq1') #>> '{transfer,currency}' = 'AED'
      and pg_temp.bv('rq1') #>> '{transfer,iban}' = 'GB82WEST12345698765432' and pg_temp.bv('rq1') #>> '{transfer,pay_by}' = pg_temp.iso(now() + interval '35 minutes'),
          'view: the transfer carries the reference, AED, the IBAN and the pay-by deadline');
select is(pg_temp.bv('rq1', 'ar') #>> '{transfer,note}', 'All fees paid by the sender.', 'view: without an Arabic note the English one is shown');
update public.booking_bank_details set note_ar = 'AR: fees by sender' where id = 1;
select is(pg_temp.bv('rq1', 'ar') #>> '{transfer,note}', 'AR: fees by sender', 'view: the note in Arabic when it is set');
select is(pg_temp.bv('rq1') #>> '{status}', 'awaiting_payment', 'view: an awaiting request shows awaiting_payment');
select is(pg_temp.bv('rq1') ->> 'deadline', pg_temp.iso(now() + interval '35 minutes'), 'view: with its deadline');
select is(pg_temp.bv('rq3') ->> 'transfer', null, 'view: no transfer for a held booking');
select is(pg_temp.bv('rq3') ->> 'hold_expires_at', pg_temp.iso(now() + interval '30 minutes'), 'view: a held booking shows its hold end');
select is(pg_temp.bv('rq7') ->> 'transfer', null, 'view: no transfer for an expired booking');
select is(pg_temp.bv('w1') ->> 'transfer', null, 'view: no transfer for a cancelled booking');
select pg_temp.mkq('pf1', 'req-stay-two', 70, 2, 'pf1@example.com');
select pg_temp.settle('pf1', 'paid_in_full');
select is(pg_temp.bv('pf1') ->> 'transfer', null, 'view: no transfer for a booking paid in full');
update public.booking_bank_details set iban = null where id = 1;
select is(pg_temp.bv('rq1') ->> 'transfer', null, 'view: no transfer while the bank details are incomplete');
update public.booking_bank_details set iban = 'GB82WEST12345698765432' where id = 1;
select pg_temp.mkq('bk1', 'req-stay-one', 42, 2, 'bk1@example.com');
select pg_temp.settle('bk1', 'deposit_paid');
select is(pg_temp.bv('bk1') #>> '{transfer,amount_fils}', '147000', 'view: deposit_paid with a balance shows the transfer for the balance');
select is(pg_temp.bv('bk1') #>> '{transfer,due_by}', to_char(pg_temp.d(42) - 30, 'YYYY-MM-DD'), 'view: due by the balance due date');
select is(pg_temp.bv('bk1') ->> 'access', null, 'view: no access before confirmed');
update public.bookings set status = 'confirmed' where id = pg_temp.bid('bk1');
select is(pg_temp.bv('bk1') #>> '{access,address}', 'Calle 10 # 5-20, Cartagena', 'view: access for a confirmed booking (BOOK-08, OPS-10)');
select is(pg_temp.bv('bk1', 'es') #>> '{access,notes}', 'Ring the bell.', 'view: access notes fall back to English');
select is(pg_temp.bv('rq1') ->> 'access', null, 'view: no access for an awaiting request');
select pg_temp.mkq('v1', 'req-stay-one', 46, 2, 'v1@example.com');
select pg_temp.past('v1', interval '3 minutes');
select is(pg_temp.bv('v1') ->> 'status', 'expired', 'view: an unpaid request past deadline + 2 minutes shows expired');
select ok(pg_temp.bv('v1') ->> 'transfer' is null and pg_temp.bv('v1') ->> 'deadline' is null, 'view: with no transfer and no deadline');
select is(pg_temp.bv('rq8') ->> 'status', 'awaiting_payment', 'view: a part-paid request 3 minutes past its deadline shows awaiting_payment (P-09)');
select is(pg_temp.bv('rq8') #>> '{transfer,amount_fils}', '62000', 'view: with the transfer for deposit minus paid');
select is(pg_temp.bv('rq8') #>> '{transfer,pay_by}', pg_temp.iso(now() - interval '3 minutes'), 'view: pay_by is the past deadline');
select is(pg_temp.bv('rq8') #>> '{flags,part_received}', 'true', 'view: part_received is true');
select pg_temp.mkq('v2', 'req-stay-one', 50, 2, 'v2@example.com');
select pg_temp.past('v2', interval '1 minute');
select is(pg_temp.bv('v2') ->> 'withdrawable', 'true', 'view: withdrawable for an unpaid web request 1 minute past its deadline');
select is(pg_temp.bv('op1') ->> 'withdrawable', 'false', 'view: not withdrawable for a hand-made awaiting request');
select is(pg_temp.bv('rq8') ->> 'withdrawable', 'false', 'view: not withdrawable for a part-paid request');
select is(pg_temp.bv('rq3') ->> 'withdrawable', 'false', 'view: not withdrawable for a held booking');
select is(pg_temp.bv('dp1') ->> 'withdrawable', 'false', 'view: not withdrawable for a deposit_paid booking');
select is(pg_temp.bv('v1') ->> 'withdrawable', 'false', 'view: not withdrawable for an unpaid request 3 minutes past its deadline');
select is(pg_temp.bv('rq2', 'es') #>> '{stay,title}', 'Estancia uno', 'view: the stay title in the locale when published');
select is(pg_temp.bv('rq2', 'ar') #>> '{stay,title}', 'Stay one', 'view: else the English title');
select is(pg_temp.bv('rq2', 'es') #>> '{stay,destination_name}', 'Destino uno', 'view: the destination name in the locale');
select is(pg_temp.bv('rq2', 'es') #>> '{lines,0,name}', 'Paseo en barco', 'view: a line name in the locale when published');
select is(pg_temp.bv('rq2', 'ar') #>> '{lines,0,name}', 'Boat trip', 'view: else the stored English name');
select is(pg_temp.bv('rq2') ->> 'locale', 'en', 'view: a null locale is the booking''s');
select is(pg_temp.bv('rq2') -> 'payments', '[]'::jsonb, 'view: no payments yet');

-- H. guest_bookings ---------------------------------------------------------------------------------------------------
select pg_temp.mkq('g1', 'req-stay-one', 80, 2, 'gb@example.com');
select pg_temp.mk('g2', 'req-stay-one', 84, 2, 'gb@example.com');
select pg_temp.mk('g3', 'req-stay-one', 88, 2, 'gb@example.com');
update public.bookings set status = 'expired' where id = pg_temp.bid('g3');
select pg_temp.mkq('g4', 'req-stay-one', 92, 2, 'gb@example.com', false);
insert into t_res values ('g5', public.ops_create_booking(pg_temp.ops('req-stay-two', pg_temp.d(76), pg_temp.d(78), 'gb@example.com', interval '48 hours'), pg_temp.owner_id()));
select pg_temp.mkq('g6', 'req-stay-one', 96, 2, 'gb@example.com');
select pg_temp.past('g6', interval '3 minutes');
update public.booking_nights set expires_at = null where booking_id = pg_temp.bid('g6');
update public.bookings set paid_fils = 1000 where id = pg_temp.bid('g6');
insert into t_res values ('gl', public.guest_bookings('gb@example.com', 'en', true));
select is((select array_agg(i ->> 'ref' order by i ->> 'ref') from jsonb_array_elements((select v -> 'items' from t_res where k = 'gl')) i),
          (select array_agg(r order by r) from unnest(array[pg_temp.r('g1', 'ref'), pg_temp.r('g5', 'ref'), pg_temp.r('g6', 'ref')]) r),
          'guest list: the requested and hand-made bookings of that email and TEST flag, held and abandoned holds left out');
select is((select array_agg(i ->> 'ref' order by ord) from jsonb_array_elements((select v -> 'items' from t_res where k = 'gl')) with ordinality as t(i, ord)),
          array[pg_temp.r('g6', 'ref'), pg_temp.r('g1', 'ref'), pg_temp.r('g5', 'ref')], 'guest list: newest arrival first');
select is(jsonb_array_length(public.guest_bookings('GB@Example.COM', 'en', true) -> 'items'), 3, 'guest list: the case of the email is ignored');
select is((select array_agg(i ->> 'ref') from jsonb_array_elements(public.guest_bookings('gb@example.com', 'en', false) -> 'items') i),
          array[pg_temp.r('g4', 'ref')], 'guest list: a real host sees only real bookings');
select is(jsonb_array_length(public.guest_bookings('nobody@example.com', 'en', true) -> 'items'), 0, 'guest list: another email sees nothing of these');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v #> '{items,0}' from t_res where k = 'gl')) k),
          array['arrive', 'deadline', 'destination_name', 'grand_fils', 'image_alt', 'image_key', 'leave', 'paid_fils', 'plan', 'ref', 'status',
                'stay_title', 'still_due_fils'],
          'guest list: exactly the item keys');
select is((select count(*)::int from jsonb_array_elements((select v -> 'items' from t_res where k = 'gl')) i where i ? 'paid_fils'), 3, 'guest list: every item has paid_fils');
select is((select i ->> 'paid_fils' from jsonb_array_elements((select v -> 'items' from t_res where k = 'gl')) i where i ->> 'ref' = pg_temp.r('g1', 'ref')),
          '0', 'guest list: paid_fils 0 for a booking with no payment');
select is((select (i ->> 'status') || '/' || (i ->> 'paid_fils') from jsonb_array_elements((select v -> 'items' from t_res where k = 'gl')) i where i ->> 'ref' = pg_temp.r('g6', 'ref')),
          'awaiting_payment/1000', 'guest list: a part-paid request past its deadline is listed as awaiting_payment with its paid_fils (P-09)');
select is((select i ->> 'stay_title' from jsonb_array_elements(public.guest_bookings('gb@example.com', 'es', true) -> 'items') i where i ->> 'ref' = pg_temp.r('g1', 'ref')),
          'Estancia uno', 'guest list: the stay title in the locale');
select pg_temp.past('g1', interval '3 minutes');
select is((select i ->> 'status' from jsonb_array_elements(public.guest_bookings('gb@example.com', 'en', true) -> 'items') i where i ->> 'ref' = pg_temp.r('g1', 'ref')),
          'expired', 'guest list: the same display rule as the view (unpaid past deadline + 2 minutes shows expired)');

select * from finish();
rollback;
