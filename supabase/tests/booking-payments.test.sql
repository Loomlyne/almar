-- pgTAP: request to book, paid by bank transfer, part B (plan 04-08, Task 2; migration 20261019160000): the status rule
-- and the deposit floor, recording a transfer (ops_record_payment), voiding one (ops_void_payment), resolving a flag,
-- the owner's notes, the owner's list and detail reads, the lapse (ops_lapse_holds as replaced, P-09), the guard
-- trigger and the lapse email claim. Symbolic amounts: a 3-night stay at 1000.00 AED a night, VAT 5 %, deposit 30 %:
-- grand 315000 fils, deposit 94500 fils, balance 220500 fils (the pg_temp.pl rule). Bank values are documentation
-- examples only (GB82 WEST 1234 5698 7654 32, BIC TESTAEAA), never a real account.
-- Own helpers and seed: nothing here depends on another test file.
-- Run: node tests/helpers/local-supabase.mjs test supabase/tests/booking-payments.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(242);

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
create function pg_temp.owner_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000017f1'::uuid $$;
create function pg_temp.guest() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000017f2'::uuid $$;

-- ISO UTC text with milliseconds, as the migration writes times.
create function pg_temp.iso(p timestamptz) returns text language sql as $$ select to_char(p at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') $$;

-- Every booking gets its own three nights: arrival offsets 10, 14, 18, ... days from the Dubai today.
create temp sequence t_off start 10 increment 4;

-- A web hold of three nights that must succeed (TEST unless p_test is false); the result is kept under p_key. The
-- email is <key>@pay.example.com unless p_over sets one.
create function pg_temp.mk(p_key text, p_plan text default 'deposit', p_test boolean default true, p_slug text default 'pay-stay-one',
  p_over jsonb default '{}'::jsonb, p_lines jsonb default '[]'::jsonb)
returns uuid language plpgsql as $$
declare v jsonb; o int := nextval('t_off');
begin
  v := public.create_web_booking(pg_temp.web(p_slug, pg_temp.d(o), pg_temp.d(o + 3), lower(p_key) || '@pay.example.com', p_plan, p_lines)
    || jsonb_build_object('is_test', p_test) || p_over);
  if not (v ->> 'ok')::boolean then raise exception 'mk % failed: %', p_key, v; end if;
  insert into t_res values (p_key, v);
  return (v ->> 'booking_id')::uuid;
end $$;

-- A hand-made booking (source ops, awaiting_payment for 48 hours) on stay two.
create function pg_temp.mkops(p_key text) returns uuid language plpgsql as $$
declare v jsonb; o int := nextval('t_off');
begin
  v := public.ops_create_booking(pg_temp.ops('pay-stay-two', pg_temp.d(o), pg_temp.d(o + 3), lower(p_key) || '@pay.example.com', interval '48 hours'),
    pg_temp.owner_id());
  insert into t_res values (p_key, v);
  return (v ->> 'booking_id')::uuid;
end $$;

-- request_web_booking on a kept booking.
create function pg_temp.rq(p_key text, p_test boolean default true) returns jsonb language plpgsql as $$
begin
  return public.request_web_booking(pg_temp.bid(p_key), p_test);
end $$;

-- A hold made and requested, both of which must succeed.
create function pg_temp.mkq(p_key text, p_plan text default 'deposit', p_test boolean default true, p_slug text default 'pay-stay-one',
  p_over jsonb default '{}'::jsonb, p_lines jsonb default '[]'::jsonb)
returns uuid language plpgsql as $$
declare v jsonb;
begin
  perform pg_temp.mk(p_key, p_plan, p_test, p_slug, p_over, p_lines);
  v := pg_temp.rq(p_key, p_test);
  if not coalesce((v ->> 'first_time')::boolean, false) then raise exception 'mkq % failed: %', p_key, v; end if;
  return pg_temp.bid(p_key);
end $$;

-- The deadline (and the timed nights) moved to p_ago in the past, as if time had passed. Permanent nights stay permanent.
create function pg_temp.past(p_key text, p_ago interval) returns void language sql as $$
  update public.booking_nights set expires_at = now() - p_ago where booking_id = pg_temp.bid(p_key) and expires_at is not null;
  update public.bookings set hold_expires_at = now() - p_ago where id = pg_temp.bid(p_key);
$$;

create function pg_temp.b(p_key text) returns public.bookings language sql as $$ select b.* from public.bookings b where b.id = pg_temp.bid(p_key) $$;
create function pg_temp.st(p_key text) returns text language sql as $$ select b.status from public.bookings b where b.id = pg_temp.bid(p_key) $$;
create function pg_temp.nights(p_key text) returns int language sql as $$ select count(*)::int from public.booking_nights n where n.booking_id = pg_temp.bid(p_key) $$;
create function pg_temp.perm(p_key text) returns int language sql as $$
  select count(*)::int from public.booking_nights n where n.booking_id = pg_temp.bid(p_key) and n.expires_at is null
$$;
create function pg_temp.ev(p_key text, p_action text) returns int language sql as $$
  select count(*)::int from public.booking_events e where e.booking_id = pg_temp.bid(p_key) and e.action = p_action
$$;

-- The record payload for a kept booking: a fresh request id, the stored status as expected, received today (Dubai),
-- bank reference TEST-<key>; p_over on top.
create function pg_temp.payload(p_key text, p_amount bigint, p_over jsonb default '{}'::jsonb, p_request uuid default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'booking_id', pg_temp.bid(p_key), 'request_id', coalesce(p_request, gen_random_uuid()), 'expected_status', pg_temp.st(p_key),
    'amount_fils', p_amount, 'received_on', to_char(pg_temp.d(0), 'YYYY-MM-DD'), 'bank_reference', 'TEST-' || p_key) || p_over
$$;

-- The owner records a transfer; the answer is kept under 'p:<key>' (the last one).
create function pg_temp.rec(p_key text, p_amount bigint, p_over jsonb default '{}'::jsonb, p_request uuid default null)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
  v := public.ops_record_payment(pg_temp.payload(p_key, p_amount, p_over, p_request), pg_temp.owner_id());
  delete from t_res where k = 'p:' || p_key;
  insert into t_res values ('p:' || p_key, v);
  return v;
end $$;

create function pg_temp.pid(p_res text) returns uuid language sql as $$ select (v ->> 'payment_id')::uuid from t_res where k = p_res $$;

-- The owner voids a row; every void that ran is logged with the payment row count before and after it.
create temp table t_void (payment_id uuid, rows_before int, rows_after int);
create function pg_temp.vd(p_payment uuid, p_reason text default 'Typed in error') returns jsonb language plpgsql as $$
declare v jsonb; n0 int; n1 int;
begin
  select count(*) into n0 from public.booking_payments;
  v := public.ops_void_payment(p_payment, p_reason, pg_temp.owner_id());
  select count(*) into n1 from public.booking_payments;
  insert into t_void values (p_payment, n0, n1);
  return v;
end $$;

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

-- The detail JSON of a refusal; null when the statement ran.
create function pg_temp.det(p_sql text) returns jsonb language plpgsql as $$
declare d text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return nullif(d, '')::jsonb;
end $$;

-- The refs of a list answer, in order; the refs of kept bookings, in the order given.
create function pg_temp.refs(p jsonb) returns text[] language sql as $$
  select array_agg(i ->> 'ref' order by o) from jsonb_array_elements(p -> 'items') with ordinality as t(i, o)
$$;
create function pg_temp.refs_of(variadic p_keys text[]) returns text[] language sql as $$
  select array_agg(pg_temp.r(k, 'ref') order by o) from unnest(p_keys) with ordinality as t(k, o)
$$;

-- A request made and lapsed by hand (expired, deadline 5 minutes ago, nothing paid).
create function pg_temp.lapsed(p_key text) returns uuid language plpgsql as $$
begin
  perform pg_temp.mkq(p_key);
  update public.bookings set status = 'expired', hold_expires_at = now() - interval '5 minutes' where id = pg_temp.bid(p_key);
  return pg_temp.bid(p_key);
end $$;

-- Seed ----------------------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000017f1', 'maria@almarprivatejourney.com', now()),
  ('00000000-0000-4000-8000-0000000017f2', 'guest-payments@example.com', now());
insert into public.media (id, key, width, height, bytes, sha256, source) values
  ('00000000-0000-4000-8000-0000000017a1', 'test/payments-hero.webp', 1600, 1000, 12345, repeat('b', 64), 'import');
insert into public.image_translations (image_id, locale, alt, status) values
  ('00000000-0000-4000-8000-0000000017a1', 'en', 'A hero', 'published');
insert into public.destinations (id, slug, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000017d1', 'pay-dest', '00000000-0000-4000-8000-0000000017a1', true, 1),
  ('00000000-0000-4000-8000-0000000017d2', 'pay-dest-two', '00000000-0000-4000-8000-0000000017a1', true, 2);
insert into public.destination_translations (destination_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000017d1', 'en', 'published', 'Destination one'),
  ('00000000-0000-4000-8000-0000000017d2', 'en', 'published', 'Destination two');
insert into public.stays (id, slug, destination_id, max_guests, min_nights, infants_count, base_nightly_rate_aed, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000017e1', 'pay-stay-one', '00000000-0000-4000-8000-0000000017d1', 6, 1, false, 1000.00, '00000000-0000-4000-8000-0000000017a1', true, 1),
  ('00000000-0000-4000-8000-0000000017e2', 'pay-stay-two', '00000000-0000-4000-8000-0000000017d2', 6, 1, false, 1000.00, '00000000-0000-4000-8000-0000000017a1', true, 2);
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000017e1', 'en', 'published', 'Stay one'),
  ('00000000-0000-4000-8000-0000000017e1', 'es', 'published', 'Estancia uno'),
  ('00000000-0000-4000-8000-0000000017e2', 'en', 'published', 'Stay two');
insert into public.catalog_items (id, slug, kind, unit, price_aed, is_uae, is_home_pickup, is_published, position) values
  ('00000000-0000-4000-8000-0000000017c1', 'pay-boat', 'experience', 'person', 250.00, false, false, true, 1);
insert into public.catalog_translations (item_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000017c1', 'en', 'published', 'Boat trip');
update public.site_settings set vat_percent = 5.00, deposit_percent = 30.00, balance_due_days = null where id = 1;
-- Bank details complete (P-08), the owner's window not set: TEST bookings get 35 minutes (P-06).
update public.booking_bank_details
   set account_name = 'Almar Test Account', bank_name = 'Test Bank', iban = 'GB82WEST12345698765432', swift = 'TESTAEAA',
       bank_address = '1 Test Street, Dubai', note_en = 'All fees paid by the sender.', note_ar = null, note_es = null,
       transfer_window_minutes = null
 where id = 1;

-- A. Privileges -----------------------------------------------------------------------------------------------------
select ok(to_regprocedure('public.ops_record_payment(jsonb, uuid)') is not null
      and to_regprocedure('public.booking_deposit_floor(text, bigint, bigint, int)') is not null
      and to_regprocedure('public.ops_void_payment(uuid, text, uuid)') is not null
      and to_regprocedure('public.ops_resolve_attention(uuid, text, uuid)') is not null
      and to_regprocedure('public.ops_add_booking_note(uuid, text, uuid, uuid)') is not null
      and to_regprocedure('public.ops_list_booking_notes(uuid)') is not null
      and to_regprocedure('public.ops_list_bookings(text, text, uuid, date, date, text, int)') is not null
      and to_regprocedure('public.ops_get_booking(text)') is not null
      and to_regprocedure('public.ops_lapse_holds()') is not null
      and to_regprocedure('public.bookings_keep_paid_request()') is not null
      and to_regprocedure('public.claim_lapse_emails(int)') is not null
      and to_regprocedure('public.finish_lapse_email(uuid, boolean, text)') is not null,
          'privileges: the twelve functions of part B exist with their exact signatures');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (array[
              'ops_record_payment', 'booking_deposit_floor', 'ops_void_payment', 'ops_resolve_attention', 'ops_add_booking_note',
              'ops_list_booking_notes', 'ops_list_bookings', 'ops_get_booking', 'ops_lapse_holds', 'bookings_keep_paid_request',
              'claim_lapse_emails', 'finish_lapse_email'])
              and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
          0, 'privileges: none of the twelve is executable by anon or authenticated (nor public)');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = any (array[
              'ops_record_payment', 'booking_deposit_floor', 'ops_void_payment', 'ops_resolve_attention', 'ops_add_booking_note',
              'ops_list_booking_notes', 'ops_list_bookings', 'ops_get_booking', 'ops_lapse_holds', 'bookings_keep_paid_request',
              'claim_lapse_emails', 'finish_lapse_email'])
              and p.prosecdef and has_function_privilege('service_role', p.oid, 'execute')
              and exists (select 1 from unnest(p.proconfig) cfg where cfg = 'search_path=""')),
          12, 'privileges: all twelve are definer functions with search_path empty and executable by service_role');
select ok(not has_function_privilege('anon', 'public.ops_lapse_holds()', 'execute')
      and not has_function_privilege('authenticated', 'public.ops_lapse_holds()', 'execute')
      and has_function_privilege('service_role', 'public.ops_lapse_holds()', 'execute')
      and pg_get_function_result('public.ops_lapse_holds()'::regprocedure) = 'integer',
          'privileges: the replaced ops_lapse_holds is still service_role only and returns an integer');
select has_trigger('public', 'bookings', 'bookings_keep_paid_request', 'privileges: the guard trigger is on bookings');
select ok(exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'bookings_lapse_email_idx'
                  and indexdef like '%(hold_expires_at)%' and indexdef like '%lapse_email_sent_at IS NULL%'),
          'privileges: the partial lapse email index exists');

set local role anon;
select throws_ok($$select public.ops_record_payment('{}'::jsonb, null)$$, '42501', null, 'anon cannot call ops_record_payment');
select throws_ok($$select public.booking_deposit_floor('deposit', 1, 1, 1)$$, '42501', null, 'anon cannot call booking_deposit_floor');
select throws_ok($$select public.ops_void_payment(gen_random_uuid(), 'reason', null)$$, '42501', null, 'anon cannot call ops_void_payment');
select throws_ok($$select public.ops_resolve_attention(gen_random_uuid(), 'note', null)$$, '42501', null, 'anon cannot call ops_resolve_attention');
select throws_ok($$select public.ops_add_booking_note(gen_random_uuid(), 'note', null, gen_random_uuid())$$, '42501', null, 'anon cannot call ops_add_booking_note');
select throws_ok($$select public.ops_list_booking_notes(gen_random_uuid())$$, '42501', null, 'anon cannot call ops_list_booking_notes');
select throws_ok($$select public.ops_list_bookings()$$, '42501', null, 'anon cannot call ops_list_bookings');
select throws_ok($$select public.ops_get_booking('ALMAR-AAAAAA')$$, '42501', null, 'anon cannot call ops_get_booking');
select throws_ok($$select public.ops_lapse_holds()$$, '42501', null, 'anon cannot call ops_lapse_holds');
select throws_ok($$select public.claim_lapse_emails(1)$$, '42501', null, 'anon cannot call claim_lapse_emails');
select throws_ok($$select public.finish_lapse_email(gen_random_uuid(), true, null)$$, '42501', null, 'anon cannot call finish_lapse_email');
set local role authenticated;
select throws_ok($$select public.ops_record_payment('{}'::jsonb, null)$$, '42501', null, 'authenticated cannot call ops_record_payment');
select throws_ok($$select public.booking_deposit_floor('deposit', 1, 1, 1)$$, '42501', null, 'authenticated cannot call booking_deposit_floor');
select throws_ok($$select public.ops_void_payment(gen_random_uuid(), 'reason', null)$$, '42501', null, 'authenticated cannot call ops_void_payment');
select throws_ok($$select public.ops_resolve_attention(gen_random_uuid(), 'note', null)$$, '42501', null, 'authenticated cannot call ops_resolve_attention');
select throws_ok($$select public.ops_add_booking_note(gen_random_uuid(), 'note', null, gen_random_uuid())$$, '42501', null, 'authenticated cannot call ops_add_booking_note');
select throws_ok($$select public.ops_list_booking_notes(gen_random_uuid())$$, '42501', null, 'authenticated cannot call ops_list_booking_notes');
select throws_ok($$select public.ops_list_bookings()$$, '42501', null, 'authenticated cannot call ops_list_bookings');
select throws_ok($$select public.ops_get_booking('ALMAR-AAAAAA')$$, '42501', null, 'authenticated cannot call ops_get_booking');
select throws_ok($$select public.ops_lapse_holds()$$, '42501', null, 'authenticated cannot call ops_lapse_holds');
select throws_ok($$select public.claim_lapse_emails(1)$$, '42501', null, 'authenticated cannot call claim_lapse_emails');
select throws_ok($$select public.finish_lapse_email(gen_random_uuid(), true, null)$$, '42501', null, 'authenticated cannot call finish_lapse_email');
reset role;

-- B. The status rule (section C of 04-08, every row) --------------------------------------------------------------------
select is(public.booking_next_status('awaiting_payment', 'deposit', 315000, 94500, 315000), 'paid_in_full', 'status rule: awaiting, settled the total -> paid_in_full');
select is(public.booking_next_status('awaiting_payment', 'deposit', 315000, 94500, 94500), 'deposit_paid', 'status rule: awaiting deposit plan, settled the deposit -> deposit_paid');
select is(public.booking_next_status('awaiting_payment', 'deposit', 315000, 94500, 94499), 'awaiting_payment', 'status rule: awaiting deposit plan, below the deposit -> awaiting_payment');
select is(public.booking_next_status('awaiting_payment', 'full', 315000, 0, 314999), 'awaiting_payment', 'status rule: awaiting full plan, below the total -> awaiting_payment');
select is(public.booking_next_status('awaiting_payment', 'full', 315000, 0, 315000), 'paid_in_full', 'status rule: awaiting full plan, the total -> paid_in_full');
select is(public.booking_next_status('deposit_paid', 'deposit', 315000, 94500, 315000), 'paid_in_full', 'status rule: deposit_paid, the total -> paid_in_full');
select is(public.booking_next_status('deposit_paid', 'deposit', 315000, 94500, 100000), 'deposit_paid', 'status rule: deposit_paid, at or above the deposit -> deposit_paid');
select is(public.booking_next_status('deposit_paid', 'deposit', 315000, 94500, 94499), 'awaiting_payment', 'status rule: deposit_paid, below the deposit -> awaiting_payment');
select is(public.booking_next_status('paid_in_full', 'deposit', 315000, 94500, 315000), 'paid_in_full', 'status rule: paid_in_full, the total -> paid_in_full');
select is(public.booking_next_status('paid_in_full', 'deposit', 315000, 94500, 200000), 'deposit_paid', 'status rule: paid_in_full deposit plan, below the total -> deposit_paid');
select is(public.booking_next_status('paid_in_full', 'deposit', 315000, 94500, 1000), 'awaiting_payment', 'status rule: paid_in_full deposit plan, below the deposit -> awaiting_payment');
select is(public.booking_next_status('paid_in_full', 'full', 315000, 0, 314999), 'awaiting_payment', 'status rule: paid_in_full full plan, below the total -> awaiting_payment');
select is(array[public.booking_next_status('held', 'deposit', 315000, 94500, 315000), public.booking_next_status('confirmed', 'deposit', 315000, 94500, 0),
                public.booking_next_status('completed', 'full', 315000, 0, 0), public.booking_next_status('expired', 'deposit', 315000, 94500, 315000),
                public.booking_next_status('cancelled', 'full', 315000, 0, 315000)],
          array['held', 'confirmed', 'completed', 'expired', 'cancelled'], 'status rule: held, confirmed, completed, expired and cancelled are unchanged');

-- C. The deposit floor (P-21) ---------------------------------------------------------------------------------------
select is(public.booking_deposit_floor('deposit', 315000, 94500, 3000), 94500::bigint, 'floor: a deposit plan is its stored deposit');
select is(public.booking_deposit_floor('full', 315000, 0, 3000), 94500::bigint, 'floor: a full plan is the deposit it would have had');
select is(public.booking_deposit_floor('full', 315005, 0, 3000), 94502::bigint, 'floor: rounded half up like pct()');
select is(public.booking_deposit_floor('full', 315000, 0, 0), 0::bigint, 'floor: a 0 % deposit gives 0');
select is(public.booking_deposit_floor('full', null, 0, 3000), null, 'floor: null in, null out');

-- D. ops_record_payment -----------------------------------------------------------------------------------------------
select pg_temp.mk('h1');
select is(pg_temp.err($$select pg_temp.rec('h1', 1000)$$), 'almar:not_requested', 'record: a hold that was never requested is not_requested');
select is(public.booking_flags(pg_temp.b('h1')) ->> 'part_received', 'false', 'flags: part_received is false on a hold with nothing paid');
select is((select count(*)::int from public.booking_payments where booking_id = pg_temp.bid('h1')), 0, 'record: and no row was written');

-- A part payment on a deposit request (P-09: the first payment makes the nights permanent).
select pg_temp.mkq('a1');
select pg_temp.rec('a1', 50000);
select is(pg_temp.r('p:a1', 'first_time') || '/' || pg_temp.r('p:a1', 'status_before') || '/' || pg_temp.r('p:a1', 'status_after'),
          'true/awaiting_payment/awaiting_payment', 'record: a part payment on a deposit request stays awaiting_payment');
select is(pg_temp.r('p:a1', 'flags.part_received'), 'true', 'record: with part_received');
select is(pg_temp.r('p:a1', 'paid_fils') || '/' || (pg_temp.b('a1')).paid_fils::text, '50000/50000', 'record: paid_fils is the amount, in the answer and on the booking');
select ok(pg_temp.perm('a1') = 3 and pg_temp.nights('a1') = 3, 'record: the first payment makes every night permanent (P-09)');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v from t_res where k = 'p:a1')) k),
          array['amount_fils', 'booking_id', 'first_time', 'flags', 'is_test', 'link_version', 'locale', 'paid_fils', 'payment_id', 'ref',
                'status_after', 'status_before', 'write_off_fils', 'written_off_fils'],
          'record: the answer has exactly its keys');
select ok((select x.kind = 'transfer' and x.method = 'bank_transfer' and x.status = 'succeeded' and x.amount_fils = 50000
              and x.received_on = pg_temp.d(0) and x.bank_reference = 'TEST-a1' and x.recorded_by = pg_temp.owner_id()
              and x.request_id is not null and x.paid_at = now() and x.write_off_fils = 0 and x.write_off_reason is null
             from public.booking_payments x where x.id = pg_temp.pid('p:a1')),
          'record: one bank row, kind transfer, succeeded, with what the owner typed');
select ok((select e.actor = 'owner:' || pg_temp.owner_id()::text and e.from_status = 'awaiting_payment' and e.to_status = 'awaiting_payment'
              and e.detail ->> 'payment_id' = pg_temp.r('p:a1', 'payment_id') and (e.detail ->> 'amount_fils')::bigint = 50000
              and e.detail ->> 'received_on' = to_char(pg_temp.d(0), 'YYYY-MM-DD') and e.detail ->> 'bank_reference' = 'TEST-a1'
              and (e.detail ->> 'paid_fils')::bigint = 50000 and (e.detail ->> 'written_off_fils')::bigint = 0
              and (e.detail ->> 'write_off_fils')::bigint = 0 and e.detail ? 'request_id'
              and e.detail ->> 'status_before' = 'awaiting_payment' and e.detail ->> 'status_after' = 'awaiting_payment'
              and (e.detail ->> 'attention_cleared')::boolean = false
             from public.booking_events e where e.booking_id = pg_temp.bid('a1') and e.action = 'payment_recorded'),
          'record: one payment_recorded event, the owner''s, with its detail');
select pg_temp.mk('a1x');
select is(public.place_hold(pg_temp.bid('a1x'), '00000000-0000-4000-8000-0000000017e1', (pg_temp.b('a1')).arrive, (pg_temp.b('a1')).leave, now() + interval '30 minutes'),
          'sold_out', 'record: another booking cannot take those permanent nights');

select pg_temp.mkq('a2');
select is(pg_temp.rec('a2', 94500) ->> 'status_after', 'deposit_paid', 'record: exactly the deposit is deposit_paid');
select is(pg_temp.perm('a2'), 3, 'record: and every night is permanent');
select is(public.booking_flags(pg_temp.b('a2')) ->> 'part_received', 'false', 'flags: part_received is false on deposit_paid');
select is(pg_temp.rec('a2', 220500) ->> 'status_after', 'paid_in_full', 'record: deposit_paid plus the balance is paid_in_full');

select pg_temp.mkq('a3');
select is(pg_temp.rec('a3', 100000) ->> 'status_after', 'deposit_paid', 'record: between the deposit and the total is deposit_paid');
select public.ops_set_booking_status(pg_temp.bid('a3'), 'confirmed', 'deposit_paid', pg_temp.owner_id());
select is(pg_temp.rec('a3', 215000) ->> 'status_after', 'confirmed', 'record: confirmed plus the balance stays confirmed');
select is((pg_temp.b('a3')).paid_fils, 315000::bigint, 'record: and paid_fils is the total');

select pg_temp.mkq('a4');
select is(pg_temp.rec('a4', 315000) ->> 'status_after', 'paid_in_full', 'record: exactly the total is paid_in_full');
select is((pg_temp.b('a4')).needs_attention, false, 'record: and nothing is flagged');

select pg_temp.mkq('a5');
select pg_temp.rec('a5', 400000);
select is(pg_temp.r('p:a5', 'status_after') || '/' || pg_temp.r('p:a5', 'flags.overpaid'), 'paid_in_full/true', 'record: above the total is paid_in_full and overpaid');
select is((pg_temp.b('a5')).needs_attention::text || '/' || (pg_temp.b('a5')).attention_reason, 'true/overpaid', 'record: and flagged overpaid');
select ok((select e.actor = 'owner:' || pg_temp.owner_id()::text and e.detail = jsonb_build_object('reason', 'overpaid', 'payment_id', pg_temp.pid('p:a5'))
             from public.booking_events e where e.booking_id = pg_temp.bid('a5') and e.action = 'needs_attention'),
          'record: one needs_attention event, the owner''s, with reason and payment id');

select pg_temp.mkq('a6', 'full');
select is(pg_temp.rec('a6', 100000) ->> 'status_after', 'awaiting_payment', 'record: a part payment on a full-payment request stays awaiting_payment');

-- Accept as paid (B-33).
select pg_temp.mkq('a7');
select pg_temp.rec('a7', 90000, '{"accept_short": true, "accept_reason": "  Bank fee taken by the sender bank  "}');
select is(pg_temp.r('p:a7', 'status_after'), 'deposit_paid', 'accept as paid: a deposit short by a bank fee becomes deposit_paid');
select ok((select x.write_off_fils = 4500 and x.write_off_reason = 'Bank fee taken by the sender bank' and x.amount_fils = 90000
             from public.booking_payments x where x.id = pg_temp.pid('p:a7')),
          'accept as paid: the gap and the trimmed reason are on the row, the amount as received');
select is((pg_temp.b('a7')).written_off_fils, 4500::bigint, 'accept as paid: the booking''s written_off_fils is the gap');
select is(pg_temp.r('p:a7', 'flags.written_off') || '/' || pg_temp.r('p:a7', 'write_off_fils') || '/' || pg_temp.r('p:a7', 'paid_fils'),
          'true/4500/90000', 'accept as paid: flags.written_off, the write-off on the answer, paid_fils the money only');
select is(pg_temp.err($$select pg_temp.rec('a6', 1000, '{"accept_short": true}')$$), 'almar:invalid:accept_reason', 'accept as paid: without a reason is invalid');
select is(pg_temp.err($$select pg_temp.rec('a6', 1000, '{"accept_reason": "A reason"}')$$), 'almar:invalid:accept_reason', 'accept as paid: a reason without accept_short is invalid');
select is(pg_temp.err($$select pg_temp.rec('a6', 1000, '{"accept_short": true, "accept_reason": "ab"}')$$), 'almar:invalid:accept_reason', 'accept as paid: a reason of 2 characters is invalid');
select is(pg_temp.err($$select pg_temp.rec('a7', 220500, '{"accept_short": true, "accept_reason": "Nothing left"}')$$), 'almar:nothing_to_write_off', 'accept as paid: no gap left is nothing_to_write_off');

-- Money on an expired request (B-34) and the inline lapse (P-10).
select pg_temp.mkq('e1');
select pg_temp.past('e1', interval '3 minutes');
select is(pg_temp.err($$select pg_temp.rec('e1', 50000, '{"expected_status": "awaiting_payment"}')$$), 'almar:changed',
          'record: an unpaid request 3 minutes past its deadline lapses first, so expected awaiting_payment is changed');
select is(pg_temp.det($$select pg_temp.rec('e1', 50000, '{"expected_status": "awaiting_payment"}')$$) ->> 'status', 'expired', 'record: with detail status expired');
select is(pg_temp.st('e1') || '/' || pg_temp.ev('e1', 'hold_expired')::text, 'awaiting_payment/0', 'record: the refusal rolls the inline lapse back');
select is(pg_temp.err($$select pg_temp.rec('e1', 50000, '{"expected_status": "expired", "accept_short": true, "accept_reason": "Short"}')$$),
          'almar:not_applicable', 'accept as paid: not on an expired booking');
select pg_temp.rec('e1', 50000, '{"expected_status": "expired"}');
select is(pg_temp.r('p:e1', 'first_time') || '/' || pg_temp.r('p:e1', 'status_before') || '/' || pg_temp.r('p:e1', 'status_after'), 'true/expired/expired',
          'record: money on an expired request is recorded and it stays expired (B-34)');
select is((pg_temp.b('e1')).needs_attention::text || '/' || (pg_temp.b('e1')).attention_reason || '/' || (pg_temp.b('e1')).paid_fils::text,
          'true/paid_after_expiry/50000', 'record: flagged paid_after_expiry, the money kept');
select is(pg_temp.nights('e1'), 0, 'record: and no night is claimed again (B-34)');
select is((select e.detail ->> 'swept_by' from public.booking_events e where e.booking_id = pg_temp.bid('e1') and e.action = 'hold_expired'),
          'ops_record_payment', 'record: the inline lapse wrote one hold_expired event');

select pg_temp.mkq('c1');
select public.ops_set_booking_status(pg_temp.bid('c1'), 'cancelled', 'awaiting_payment', pg_temp.owner_id());
select pg_temp.rec('c1', 94500);
select is(pg_temp.r('p:c1', 'status_after') || '/' || (pg_temp.b('c1')).attention_reason, 'cancelled/paid_after_cancel',
          'record: money on a cancelled booking is kept, it stays cancelled, flagged paid_after_cancel');
select is(pg_temp.nights('c1'), 0, 'record: and no night is claimed again');

-- A part-paid request past its deadline is never lapsed (P-09); reaching the deposit clears its flag.
select pg_temp.mkq('pp');
select pg_temp.rec('pp', 10000);
select pg_temp.past('pp', interval '3 minutes');
update public.bookings set needs_attention = true, attention_reason = 'deadline_passed_part_paid' where id = pg_temp.bid('pp');
select is(pg_temp.rec('pp', 10000, '{"expected_status": "awaiting_payment"}') ->> 'status_after', 'awaiting_payment',
          'record: a part-paid request 3 minutes past its deadline records with expected awaiting_payment (no inline lapse)');
select is((pg_temp.b('pp')).attention_reason, 'deadline_passed_part_paid', 'record: still awaiting, its flag stays');
select pg_temp.rec('pp', 74500);
select is(pg_temp.r('p:pp', 'status_after'), 'deposit_paid', 'record: a record that reaches the deposit moves it to deposit_paid');
select ok((pg_temp.b('pp')).needs_attention = false and (pg_temp.b('pp')).attention_reason is null, 'record: and clears deadline_passed_part_paid');
select is((select e.detail ->> 'attention_cleared' from public.booking_events e where e.booking_id = pg_temp.bid('pp') and e.action = 'payment_recorded'
            order by e.id desc limit 1), 'true', 'record: attention_cleared true in that payment_recorded event');

-- Replay on request_id.
select pg_temp.mkq('a8');
insert into t_res values ('r1', pg_temp.rec('a8', 20000, '{}', '00000000-0000-4000-8000-0000000017b1'));
insert into t_res values ('r2', pg_temp.rec('a8', 20000, '{}', '00000000-0000-4000-8000-0000000017b1'));
select is(pg_temp.r('r1', 'first_time') || '/' || pg_temp.r('r2', 'first_time'), 'true/false', 'replay: the same request id answers first_time false');
select is(pg_temp.r('r2', 'payment_id'), pg_temp.r('r1', 'payment_id'), 'replay: with the same payment id');
select is(pg_temp.r('r2', 'status_after') || '/' || pg_temp.r('r2', 'paid_fils'), pg_temp.r('r1', 'status_after') || '/' || pg_temp.r('r1', 'paid_fils'),
          'replay: and the stored outcome');
select is((select count(*)::int from public.booking_payments where request_id = '00000000-0000-4000-8000-0000000017b1'), 1, 'replay: one row');
select is((pg_temp.b('a8')).paid_fils, 20000::bigint, 'replay: the money counted once');
select is(pg_temp.err($$select pg_temp.rec('a8', 30000, '{}', '00000000-0000-4000-8000-0000000017b1')$$), 'almar:changed', 'replay: the same id with another amount is changed');
select is(pg_temp.err($$select pg_temp.rec('a6', 20000, '{}', '00000000-0000-4000-8000-0000000017b1')$$), 'almar:changed', 'replay: the same id on another booking is changed');

-- Refusals.
select is(pg_temp.err(format($$select public.ops_record_payment(%L, %L)$$, pg_temp.payload('a6', 1000), pg_temp.guest())), 'almar:not_owner',
          'record: a guest actor is not the owner');
select is(pg_temp.err(format($$select public.ops_record_payment(%L, null)$$, pg_temp.payload('a6', 1000))), 'almar:not_owner', 'record: a null actor is not the owner');
select is(pg_temp.err($$select pg_temp.rec('a6', 1000, jsonb_build_object('received_on', to_char(pg_temp.d(1), 'YYYY-MM-DD')))$$), 'almar:invalid:received_on',
          'record: received tomorrow (Dubai) is invalid');
select is(pg_temp.err($$select pg_temp.rec('a6', 1000, jsonb_build_object('received_on', to_char(pg_temp.d(-1), 'YYYY-MM-DD')))$$), 'almar:invalid:received_on',
          'record: received before the booking was made is invalid');
select is(pg_temp.err($$select pg_temp.rec('a6', 1000, '{"received_on": "2026-02-30"}')$$), 'almar:invalid:received_on', 'record: a date that does not exist is invalid');
select is(pg_temp.err($$select public.ops_record_payment(pg_temp.payload('a6', 1000) - 'bank_reference', pg_temp.owner_id())$$), 'almar:invalid:bank_reference',
          'record: a missing bank reference is invalid');
select is(pg_temp.err($$select pg_temp.rec('a6', 1000, jsonb_build_object('bank_reference', repeat('R', 101)))$$), 'almar:invalid:bank_reference',
          'record: a bank reference of 101 characters is invalid');
select is(pg_temp.err($$select pg_temp.rec('a6', 1000, '{"bank_reference": "   "}')$$), 'almar:invalid:bank_reference', 'record: a blank bank reference is invalid');
select is(pg_temp.err($$select pg_temp.rec('a6', 0)$$), 'almar:invalid:amount_fils', 'record: an amount of 0 is invalid');
select is(pg_temp.err($$select pg_temp.rec('a6', 1000, '{"note": "x"}')$$), 'almar:invalid:note', 'record: an unknown key is refused by name');
select is(pg_temp.err($$select public.ops_record_payment(pg_temp.payload('a6', 1000) || jsonb_build_object('booking_id', gen_random_uuid()), pg_temp.owner_id())$$),
          'almar:not_found', 'record: an unknown booking is not_found');
select is(pg_temp.rec('a6', 1) ->> 'amount_fils', '1', 'record: 1 fils is accepted (P-04)');

-- E. ops_void_payment -------------------------------------------------------------------------------------------------
-- The only row of a deposit_paid booking: back to awaiting_payment, a fresh deadline, the nights timed to it.
select pg_temp.mkq('v1');
select pg_temp.rec('v1', 94500);
insert into t_res values ('x:v1', pg_temp.vd(pg_temp.pid('p:v1')));
select is(pg_temp.r('x:v1', 'first_time') || '/' || pg_temp.r('x:v1', 'status_before') || '/' || pg_temp.r('x:v1', 'status_after'),
          'true/deposit_paid/awaiting_payment', 'void: the only row of a deposit_paid booking takes it back to awaiting_payment');
select is((pg_temp.b('v1')).hold_expires_at, now() + interval '35 minutes', 'void: with a fresh deadline, now + the window');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('v1') and expires_at = now() + interval '35 minutes'), 3,
          'void: every night timed to that deadline (no payment left)');
select is(pg_temp.r('x:v1', 'deadline'), pg_temp.iso(now() + interval '35 minutes'), 'void: the answer carries the deadline');
select ok((select x.status = 'voided' and x.void_reason = 'Typed in error' and x.voided_by = pg_temp.owner_id() and x.voided_at = now()
             from public.booking_payments x where x.id = pg_temp.pid('p:v1')),
          'void: the row is marked voided with its reason, who and when');
select is((pg_temp.b('v1')).paid_fils, 0::bigint, 'void: paid_fils summed again from the rows');
select ok((select e.actor = 'owner:' || pg_temp.owner_id()::text and e.from_status = 'deposit_paid' and e.to_status = 'awaiting_payment'
              and e.detail = jsonb_build_object('payment_id', pg_temp.pid('p:v1'), 'amount_fils', 94500, 'reason', 'Typed in error', 'paid_fils', 0,
                                                'written_off_fils', 0, 'deadline', pg_temp.iso(now() + interval '35 minutes'), 'attention_cleared', false)
             from public.booking_events e where e.booking_id = pg_temp.bid('v1') and e.action = 'payment_voided'),
          'void: one payment_voided event, the owner''s, with its detail');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v from t_res where k = 'x:v1')) k),
          array['booking_id', 'deadline', 'first_time', 'flags', 'paid_fils', 'payment_id', 'ref', 'status_after', 'status_before', 'written_off_fils'],
          'void: the answer has exactly its keys');
select is(pg_temp.vd(pg_temp.pid('p:v1')) ->> 'first_time', 'false', 'void: a second void answers first_time false');
select is(pg_temp.ev('v1', 'payment_voided'), 1, 'void: and writes nothing more');

-- Two rows, one voided below the deposit: awaiting_payment, a fresh deadline, the nights still permanent (P-09).
select pg_temp.mkq('v2');
select pg_temp.rec('v2', 50000);
select pg_temp.rec('v2', 44500);
update public.bookings set hold_expires_at = now() - interval '1 hour' where id = pg_temp.bid('v2');
select is(pg_temp.vd(pg_temp.pid('p:v2')) ->> 'status_after', 'awaiting_payment', 'void: a row that takes a deposit_paid booking below its deposit makes it awaiting_payment');
select is((pg_temp.b('v2')).hold_expires_at, now() + interval '35 minutes', 'void: with a fresh deadline');
select is(pg_temp.perm('v2'), 3, 'void: and every night still permanent (a payment is left: P-09)');

-- A part-paid request voided to nothing: unpaid again, its nights timed to greatest(deadline, now + window).
select pg_temp.mkq('v3');
select pg_temp.rec('v3', 10000);
select pg_temp.past('v3', interval '3 minutes');
update public.bookings set needs_attention = true, attention_reason = 'deadline_passed_part_paid' where id = pg_temp.bid('v3');
insert into t_res values ('x:v3', pg_temp.vd(pg_temp.pid('p:v3')));
select is(pg_temp.r('x:v3', 'status_after'), 'awaiting_payment', 'void: a part-paid request voided to nothing stays awaiting_payment');
select is((pg_temp.b('v3')).hold_expires_at, now() + interval '35 minutes', 'void: its past deadline becomes now + the window (the greater)');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('v3') and expires_at = now() + interval '35 minutes'), 3,
          'void: its nights are timed to it again');
select ok((pg_temp.b('v3')).needs_attention = false and (pg_temp.b('v3')).attention_reason is null, 'void: and deadline_passed_part_paid is cleared');
select is((select e.detail ->> 'attention_cleared' from public.booking_events e where e.booking_id = pg_temp.bid('v3') and e.action = 'payment_voided'),
          'true', 'void: attention_cleared true in the event');
select pg_temp.mkq('v3b');
select pg_temp.rec('v3b', 10000);
update public.bookings set hold_expires_at = now() + interval '3 hours' where id = pg_temp.bid('v3b');
select pg_temp.vd(pg_temp.pid('p:v3b'));
select is((pg_temp.b('v3b')).hold_expires_at, now() + interval '3 hours', 'void: a later stored deadline is kept (the greater)');
select is((select count(*)::int from public.booking_nights where booking_id = pg_temp.bid('v3b') and expires_at = now() + interval '3 hours'), 3,
          'void: and the nights are timed to it');

-- Two rows on a part-paid request, one voided: deadline and permanent nights unchanged.
select pg_temp.mkq('v4');
select pg_temp.rec('v4', 10000);
insert into t_res values ('v4b', pg_temp.rec('v4', 20000));
update public.bookings set hold_expires_at = now() + interval '20 minutes' where id = pg_temp.bid('v4');
select is(pg_temp.vd(pg_temp.pid('v4b')) ->> 'status_after', 'awaiting_payment', 'void: one of two rows on a part-paid request: still awaiting_payment');
select is((pg_temp.b('v4')).hold_expires_at, now() + interval '20 minutes', 'void: its deadline unchanged');
select ok(pg_temp.perm('v4') = 3 and (pg_temp.b('v4')).paid_fils = 10000, 'void: its nights still permanent, paid_fils the row left');

select pg_temp.mkq('v5');
select pg_temp.rec('v5', 94500);
select pg_temp.rec('v5', 220500);
select is(pg_temp.vd(pg_temp.pid('p:v5')) ->> 'status_after', 'deposit_paid', 'void: the balance row of a paid_in_full booking takes it back to deposit_paid');

-- cancel_first: the deposit floor on every plan (P-21).
select pg_temp.mkq('v6');
select pg_temp.rec('v6', 94500);
select public.ops_set_booking_status(pg_temp.bid('v6'), 'confirmed', 'deposit_paid', pg_temp.owner_id());
select is(pg_temp.err(format($$select pg_temp.vd(%L)$$, pg_temp.pid('p:v6'))), 'almar:cancel_first', 'void: a confirmed deposit booking may not drop below its deposit (cancel_first)');
select ok(pg_temp.st('v6') = 'confirmed' and (pg_temp.b('v6')).paid_fils = 94500
      and (select x.status from public.booking_payments x where x.id = pg_temp.pid('p:v6')) = 'succeeded', 'void: and nothing changed');
select pg_temp.mkq('v7', 'full');
select pg_temp.rec('v7', 50000);
select pg_temp.rec('v7', 265000);
select public.ops_set_booking_status(pg_temp.bid('v7'), 'confirmed', 'paid_in_full', pg_temp.owner_id());
select is(pg_temp.err(format($$select pg_temp.vd(%L)$$, pg_temp.pid('p:v7'))), 'almar:cancel_first', 'void: a confirmed full-payment booking may not drop below its deposit floor either (P-21)');
select pg_temp.mkq('v8', 'full');
select pg_temp.rec('v8', 100000);
select pg_temp.rec('v8', 215000);
select public.ops_set_booking_status(pg_temp.bid('v8'), 'confirmed', 'paid_in_full', pg_temp.owner_id());
select is(pg_temp.vd(pg_temp.pid('p:v8')) ->> 'status_after', 'confirmed',
          'void: a confirmed full-payment booking voided to between its floor and the total stays confirmed (the deposit, not the total: P-21)');
select is((pg_temp.b('v8')).paid_fils, 100000::bigint, 'void: with the row left');
select pg_temp.mkq('v9', 'full');
update public.bookings set deposit_bp = 0 where id = pg_temp.bid('v9');
select pg_temp.rec('v9', 315000);
select public.ops_set_booking_status(pg_temp.bid('v9'), 'confirmed', 'paid_in_full', pg_temp.owner_id());
select is(pg_temp.vd(pg_temp.pid('p:v9')) ->> 'status_after', 'confirmed', 'void: with a 0 % deposit the floor is 0 and any void is allowed');
select is((pg_temp.b('v9')).paid_fils, 0::bigint, 'void: down to nothing paid');
select pg_temp.mkq('v10');
select pg_temp.rec('v10', 94500);
insert into t_res values ('v10b', pg_temp.rec('v10', 50000));
select public.ops_set_booking_status(pg_temp.bid('v10'), 'confirmed', 'deposit_paid', pg_temp.owner_id());
select is(pg_temp.vd(pg_temp.pid('v10b')) ->> 'status_after', 'confirmed', 'void: a confirmed booking that stays at or above its deposit stays confirmed');

-- A written-off row voided: the write-off comes back out.
select pg_temp.vd(pg_temp.pid('p:a7'));
select is((pg_temp.b('a7')).written_off_fils::text || '/' || pg_temp.st('a7'), '0/awaiting_payment', 'void: voiding a written-off row takes the write-off back out');

-- A card row is not voidable.
with c as (
  insert into public.booking_payments (booking_id, kind, amount_fils, status, paid_at)
  values (pg_temp.bid('a6'), 'full', 1000, 'succeeded', now()) returning id
)
insert into t_res select 'card', jsonb_build_object('payment_id', c.id) from c;
select is(pg_temp.err(format($$select pg_temp.vd(%L)$$, pg_temp.pid('card'))), 'almar:not_voidable', 'void: a card row is not_voidable');

-- A real booking going back to awaiting_payment needs the owner's window.
update public.booking_bank_details set transfer_window_minutes = 120 where id = 1;
select pg_temp.mkq('v13', 'deposit', false);
select pg_temp.rec('v13', 94500);
update public.booking_bank_details set transfer_window_minutes = null where id = 1;
select is(pg_temp.err(format($$select pg_temp.vd(%L)$$, pg_temp.pid('p:v13'))), 'almar:window_missing',
          'void: a real booking going back to awaiting_payment with no window set is window_missing');
select ok(pg_temp.st('v13') = 'deposit_paid' and (select x.status from public.booking_payments x where x.id = pg_temp.pid('p:v13')) = 'succeeded',
          'void: and nothing changed');

-- Money on an expired booking, voided to nothing: the flag clears. (Deadline 50 hours back: outside the lapse email
-- claim, so the claim cases below are not changed by it.)
select pg_temp.mkq('e2');
select pg_temp.past('e2', interval '50 hours');
select pg_temp.rec('e2', 20000, '{"expected_status": "expired"}');
select is(pg_temp.vd(pg_temp.pid('p:e2')) ->> 'status_after', 'expired', 'void: an expired booking stays expired');
select ok((pg_temp.b('e2')).needs_attention = false and (pg_temp.b('e2')).attention_reason is null and (pg_temp.b('e2')).paid_fils = 0,
          'void: its paid_after_expiry flag clears once nothing is paid');

select is(pg_temp.err(format($$select pg_temp.vd(%L, 'ab')$$, pg_temp.pid('p:a3'))), 'almar:invalid:reason', 'void: a reason of 2 characters is invalid');
select is(pg_temp.err(format($$select public.ops_void_payment(%L, 'Typed in error', %L)$$, pg_temp.pid('p:a3'), pg_temp.guest())), 'almar:not_owner',
          'void: a guest actor is not the owner');
select is(pg_temp.err($$select pg_temp.vd(gen_random_uuid())$$), 'almar:not_found', 'void: an unknown row is not_found');

-- The guest list's paid_fils: the recorded money, down after a void, never a write-off.
select pg_temp.mkq('gp');
select pg_temp.rec('gp', 30000);
select is((select i ->> 'paid_fils' from jsonb_array_elements(public.guest_bookings('gp@pay.example.com', 'en', true) -> 'items') i), '30000',
          'guest list: paid_fils is the recorded amount');
insert into t_res values ('gp2', pg_temp.rec('gp', 20000, '{"accept_short": true, "accept_reason": "Bank fee taken"}'));
select is((select i ->> 'paid_fils' from jsonb_array_elements(public.guest_bookings('gp@pay.example.com', 'en', true) -> 'items') i), '50000',
          'guest list: a write-off is never in paid_fils');
select pg_temp.vd(pg_temp.pid('gp2'));
select is((select i ->> 'paid_fils' from jsonb_array_elements(public.guest_bookings('gp@pay.example.com', 'en', true) -> 'items') i), '30000',
          'guest list: paid_fils drops by the voided amount');

select is((select count(*)::int from t_void), 13, 'void: the thirteen voids above ran');
select is((select count(*)::int from t_void where rows_before <> rows_after), 0, 'void: the row count is unchanged after every void');
select is((select count(*)::int from t_void v where not exists (select 1 from public.booking_payments x where x.id = v.payment_id and x.status = 'voided')), 0,
          'void: every voided row is still there, marked voided');

-- F. ops_resolve_attention ------------------------------------------------------------------------------------------
select is(pg_temp.err(format($$select public.ops_resolve_attention(%L, 'Refunded by transfer', %L)$$, pg_temp.bid('a5'), pg_temp.guest())), 'almar:not_owner',
          'resolve: a guest actor is not the owner');
select is(pg_temp.err(format($$select public.ops_resolve_attention(%L, 'ok', %L)$$, pg_temp.bid('a5'), pg_temp.owner_id())), 'almar:invalid:note',
          'resolve: a note of 2 characters is invalid');
select is(pg_temp.err(format($$select public.ops_resolve_attention(%L, 'Refunded by transfer', %L)$$, gen_random_uuid(), pg_temp.owner_id())), 'almar:not_found',
          'resolve: an unknown booking is not_found');
insert into t_res values ('rs1', public.ops_resolve_attention(pg_temp.bid('a5'), '  Refunded the extra by transfer  ', pg_temp.owner_id()));
select is(pg_temp.r('rs1', 'first_time'), 'true', 'resolve: first_time true');
select ok((pg_temp.b('a5')).needs_attention = false and (pg_temp.b('a5')).attention_reason is null, 'resolve: the flag and its reason are cleared');
select ok((select n.body = 'Refunded the extra by transfer' and n.actor = 'owner:' || pg_temp.owner_id()::text
             from public.booking_notes n where n.id = (pg_temp.r('rs1', 'note_id'))::bigint),
          'resolve: the note is kept, trimmed, as the owner''s');
select is((select e.detail from public.booking_events e where e.booking_id = pg_temp.bid('a5') and e.action = 'attention_resolved'),
          jsonb_build_object('reason', 'overpaid', 'note_id', (pg_temp.r('rs1', 'note_id'))::bigint), 'resolve: one attention_resolved event with the reason and the note id');
select is(public.ops_resolve_attention(pg_temp.bid('a5'), 'Again', pg_temp.owner_id()),
          jsonb_build_object('first_time', false, 'booking_id', pg_temp.bid('a5'), 'note_id', null), 'resolve: a booking that is not flagged answers first_time false');

-- G. Notes ------------------------------------------------------------------------------------------------------------
select is(pg_temp.err(format($$select public.ops_add_booking_note(%L, 'Called the guest', %L, %L)$$, pg_temp.bid('a1'), pg_temp.guest(), gen_random_uuid())), 'almar:not_owner',
          'notes: a guest actor is not the owner');
select is(pg_temp.err(format($$select public.ops_add_booking_note(%L, '', %L, %L)$$, pg_temp.bid('a1'), pg_temp.owner_id(), gen_random_uuid())), 'almar:invalid:body', 'notes: an empty note is invalid');
select is(pg_temp.err(format($$select public.ops_add_booking_note(%L, '   ', %L, %L)$$, pg_temp.bid('a1'), pg_temp.owner_id(), gen_random_uuid())), 'almar:invalid:body', 'notes: a blank note is invalid');
select is(pg_temp.err(format($$select public.ops_add_booking_note(%L, repeat('n', 2001), %L, %L)$$, pg_temp.bid('a1'), pg_temp.owner_id(), gen_random_uuid())), 'almar:invalid:body',
          'notes: 2001 characters are invalid');
select is(pg_temp.err(format($$select public.ops_add_booking_note(%L, 'Called', %L, %L)$$, gen_random_uuid(), pg_temp.owner_id(), gen_random_uuid())), 'almar:not_found', 'notes: an unknown booking is not_found');
select is(pg_temp.err(format($$select public.ops_add_booking_note(%L, 'Called', %L, null)$$, pg_temp.bid('a1'), pg_temp.owner_id())), 'almar:invalid:request_id',
          'notes: a note without a request_id is invalid');
insert into t_res values ('n1', public.ops_add_booking_note(pg_temp.bid('a1'), 'Called the guest about the transfer', pg_temp.owner_id(),
  '00000000-0000-4000-8000-0000000a0001'));
insert into t_res values ('n2', public.ops_add_booking_note(pg_temp.bid('a1'), repeat('n', 2000), pg_temp.owner_id(),
  '00000000-0000-4000-8000-0000000a0002'));
select ok(pg_temp.r('n1', 'id') is not null and pg_temp.r('n1', 'at') = pg_temp.iso(now()) and pg_temp.r('n2', 'id') is not null
            and pg_temp.r('n1', 'first_time') = 'true' and pg_temp.r('n2', 'first_time') = 'true',
          'notes: a note (2000 characters too) answers first_time true, its id and time');
insert into t_res values ('n1r', public.ops_add_booking_note(pg_temp.bid('a1'), 'Called the guest about the transfer', pg_temp.owner_id(),
  '00000000-0000-4000-8000-0000000a0001'));
select ok(pg_temp.r('n1r', 'first_time') = 'false' and pg_temp.r('n1r', 'id') = pg_temp.r('n1', 'id') and pg_temp.r('n1r', 'at') = pg_temp.r('n1', 'at'),
          'notes: the same request_id again answers the stored note, first_time false');
select is((select count(*)::int from public.booking_notes n where n.request_id = '00000000-0000-4000-8000-0000000a0001'), 1,
          'notes: a replay writes no second row');
select is(pg_temp.err(format($$select public.ops_add_booking_note(%L, 'Another text', %L, '00000000-0000-4000-8000-0000000a0001')$$, pg_temp.bid('a1'), pg_temp.owner_id())),
          'almar:changed', 'notes: the same request_id with another text is changed');
select is(pg_temp.err(format($$select public.ops_add_booking_note(%L, 'Called the guest about the transfer', %L, '00000000-0000-4000-8000-0000000a0001')$$, pg_temp.bid('a2'), pg_temp.owner_id())),
          'almar:changed', 'notes: the same request_id on another booking is changed');
select is((select array_agg(e.detail order by e.id) from public.booking_events e where e.booking_id = pg_temp.bid('a1') and e.action = 'note_added'),
          array[jsonb_build_object('note_id', (pg_temp.r('n1', 'id'))::bigint), jsonb_build_object('note_id', (pg_temp.r('n2', 'id'))::bigint)],
          'notes: each note_added event carries the note id only, never the text');
insert into t_res values ('nl', public.ops_list_booking_notes(pg_temp.bid('a1')));
select is((select array_agg((i ->> 'id')::bigint order by o) from jsonb_array_elements((select v -> 'items' from t_res where k = 'nl')) with ordinality as t(i, o)),
          array[(pg_temp.r('n2', 'id'))::bigint, (pg_temp.r('n1', 'id'))::bigint], 'notes: listed newest first');
select is(pg_temp.r('nl', 'items.0.actor_email'), 'maria@almarprivatejourney.com', 'notes: with the owner''s email');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v #> '{items,0}' from t_res where k = 'nl')) k),
          array['actor', 'actor_email', 'at', 'body', 'id'], 'notes: each item has exactly its keys');

-- H. The owner's list and detail ---------------------------------------------------------------------------------------
-- Seven bookings of one email domain: a hold (l1), three requests with deadlines 35, 10 and 50 minutes away (l2, l3, l7 on
-- stay two), a deposit_paid one (l4), a flagged overpaid one (l5) and an abandoned hold (l6).
select pg_temp.mk('l1', 'deposit', true, 'pay-stay-one', '{"email": "l1@list.example.com", "guest_name": "Zoë Ålmqvist"}');
select pg_temp.mkq('l2', 'deposit', true, 'pay-stay-one', '{"email": "l2@list.example.com"}',
  jsonb_build_array(pg_temp.line('00000000-0000-4000-8000-0000000017c1', 'Boat trip', 'person', false, false, 25000, 2)));
select pg_temp.mkq('l3', 'deposit', true, 'pay-stay-one', '{"email": "l3@list.example.com"}');
update public.bookings set hold_expires_at = now() + interval '10 minutes' where id = pg_temp.bid('l3');
select pg_temp.mkq('l4', 'deposit', true, 'pay-stay-one', '{"email": "l4@list.example.com"}');
select pg_temp.rec('l4', 94500);
select pg_temp.mkq('l5', 'deposit', true, 'pay-stay-one', '{"email": "l5@list.example.com"}');
select pg_temp.rec('l5', 400000);
select pg_temp.mk('l6', 'deposit', true, 'pay-stay-one', '{"email": "l6@list.example.com"}');
update public.bookings set status = 'expired' where id = pg_temp.bid('l6');
select pg_temp.mkq('l7', 'deposit', true, 'pay-stay-two', '{"email": "l7@list.example.com"}');
update public.bookings set hold_expires_at = now() + interval '50 minutes' where id = pg_temp.bid('l7');

insert into t_res values ('L', public.ops_list_bookings('list.example'));
select is(pg_temp.refs((select v from t_res where k = 'L')), pg_temp.refs_of('l5', 'l3', 'l2', 'l7', 'l4', 'l1'),
          'owner list: flagged first, then awaiting by deadline, then paid arriving later, then holds; the abandoned hold hidden');
select is(pg_temp.r('L', 'next'), null, 'owner list: one page, next null');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v #> '{items,0}' from t_res where k = 'L')) k),
          array['arrive', 'balance_due_date', 'created_at', 'deadline', 'destination_id', 'destination_name', 'due_now_fils', 'email', 'flags',
                'grand_fils', 'guest_name', 'guests', 'id', 'is_test', 'leave', 'paid_fils', 'plan', 'ref', 'requested_at', 'source', 'status',
                'stay_slug', 'stay_title', 'written_off_fils'],
          'owner list: an item has exactly its keys');
select is((select i ->> 'stay_title' || '/' || (i ->> 'destination_name') || '/' || (i ->> 'guests') from jsonb_array_elements((select v -> 'items' from t_res where k = 'L')) i
            where i ->> 'ref' = pg_temp.r('l7', 'ref')), 'Stay two/Destination two/2', 'owner list: English titles and the guest count');
select is(pg_temp.refs(public.ops_list_bookings(lower(pg_temp.r('l2', 'ref')))), array[pg_temp.r('l2', 'ref')], 'owner list: a ref in lower case finds that booking');
select is(pg_temp.refs(public.ops_list_bookings('ZOE ALMQ')), array[pg_temp.r('l1', 'ref')], 'owner list: the guest name, case- and accent-folded');
select is(pg_temp.refs(public.ops_list_bookings('L4@LIST.example')), array[pg_temp.r('l4', 'ref')], 'owner list: the email');
select is(pg_temp.refs(public.ops_list_bookings('list.example', 'deposit_paid')), array[pg_temp.r('l4', 'ref')], 'owner list: a status filter');
select is(pg_temp.refs(public.ops_list_bookings('list.example', 'attention')), array[pg_temp.r('l5', 'ref')], 'owner list: attention lists the flagged ones');
select is(pg_temp.refs(public.ops_list_bookings('list.example', 'expired')), array[pg_temp.r('l6', 'ref')], 'owner list: the abandoned hold when its status is asked for');
select is(pg_temp.refs(public.ops_list_bookings('list.example', null, '00000000-0000-4000-8000-0000000017d2')), array[pg_temp.r('l7', 'ref')], 'owner list: a destination filter');
select is(pg_temp.refs(public.ops_list_bookings('list.example', null, null, (pg_temp.b('l2')).arrive, (pg_temp.b('l3')).arrive)), pg_temp.refs_of('l3', 'l2'),
          'owner list: an arrival range');
select is(pg_temp.err($$select public.ops_list_bookings(p_limit => 0)$$), 'almar:invalid:limit', 'owner list: limit 0 is invalid');
select is(pg_temp.err($$select public.ops_list_bookings(p_limit => 61)$$), 'almar:invalid:limit', 'owner list: limit 61 is invalid');
select is(pg_temp.err($$select public.ops_list_bookings(p_status => 'paid')$$), 'almar:invalid:status', 'owner list: an unknown status is invalid');
select is(pg_temp.err($$select public.ops_list_bookings(p_arrive_from => current_date + 2, p_arrive_to => current_date + 1)$$), 'almar:invalid:arrive',
          'owner list: from after to is invalid');
select is(pg_temp.err($$select public.ops_list_bookings(p_after => 'abc')$$), 'almar:invalid:after', 'owner list: a cursor that is not an offset is invalid');
select is(pg_temp.err($$select public.ops_list_bookings(repeat('q', 101))$$), 'almar:invalid:q', 'owner list: a search of 101 characters is invalid');
insert into t_res values ('P1', public.ops_list_bookings('list.example', p_limit => 2));
insert into t_res values ('P2', public.ops_list_bookings('list.example', p_after => pg_temp.r('P1', 'next'), p_limit => 2));
insert into t_res values ('P3', public.ops_list_bookings('list.example', p_after => pg_temp.r('P2', 'next'), p_limit => 2));
select is(pg_temp.r('P1', 'next') || '/' || pg_temp.r('P2', 'next'), '2/4', 'owner list: next is the next offset while more rows follow');
select is(pg_temp.r('P3', 'next'), null, 'owner list: and null on the last page');
select is(pg_temp.refs((select v from t_res where k = 'P1')) || pg_temp.refs((select v from t_res where k = 'P2')) || pg_temp.refs((select v from t_res where k = 'P3')),
          pg_temp.refs((select v from t_res where k = 'L')), 'owner list: the pages together are the whole list, in order, without a repeat');

select is(public.ops_get_booking('ALMAR-ZZZZZZ'), null, 'owner detail: null for an unknown ref');
insert into t_res values ('G', public.ops_get_booking(pg_temp.r('v1', 'ref')));
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v from t_res where k = 'G')) k),
          array['adults', 'airport', 'arrive', 'children', 'created_at', 'deadline', 'destination', 'events', 'flags', 'guest', 'hold_expires_at', 'id',
                'infants', 'is_test', 'lapse_email', 'leave', 'lines', 'link_version', 'money', 'nights', 'notes', 'payments', 'pickup_address', 'plan',
                'ref', 'refunds', 'requested_at', 'source', 'status', 'stay', 'terms_accepted_at', 'terms_version', 'travellers', 'updated_at'],
          'owner detail: exactly its keys');
select ok((select p ->> 'status' = 'voided' and p ->> 'void_reason' = 'Typed in error' and p ->> 'voided_by_email' = 'maria@almarprivatejourney.com'
              and p ->> 'recorded_by_email' = 'maria@almarprivatejourney.com' and p ->> 'bank_reference' = 'TEST-v1' and p ->> 'method' = 'bank_transfer'
             from jsonb_array_elements((select v -> 'payments' from t_res where k = 'G')) p),
          'owner detail: payments include the voided row with its reason and who recorded and voided it');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v #> '{payments,0}' from t_res where k = 'G')) k),
          array['amount_fils', 'bank_reference', 'card_brand', 'card_last4', 'created_at', 'id', 'kind', 'method', 'received_on', 'recorded_by',
                'recorded_by_email', 'status', 'void_reason', 'voided_at', 'voided_by', 'voided_by_email', 'write_off_fils', 'write_off_reason'],
          'owner detail: a payment has exactly its keys');
select ok((select (v #>> '{events,0,id}')::bigint > (v #>> '{events,1,id}')::bigint and v #>> '{events,0,action}' = 'payment_voided' from t_res where k = 'G'),
          'owner detail: events newest first');
select is((select v -> 'flags' from t_res where k = 'G'), public.booking_flags(pg_temp.b('v1')), 'owner detail: flags are booking_flags');
select is((select jsonb_array_length(v -> 'travellers') || '/' || (v ->> 'link_version') || '/' || (v #>> '{lapse_email,attempts}') || '/' || (v #>> '{money,deposit_fils}')
             from t_res where k = 'G'), '2/1/0/94500', 'owner detail: travellers, link_version, the lapse email state and the money');
select is(public.ops_get_booking(pg_temp.r('l2', 'ref')) #>> '{lines,0,name}' || '/' || (public.ops_get_booking(pg_temp.r('l2', 'ref')) #>> '{lines,0,catalog_item_id}'),
          'Boat trip/00000000-0000-4000-8000-0000000017c1', 'owner detail: lines with their catalog item');
select is(public.ops_get_booking(pg_temp.r('a1', 'ref')) -> 'notes', public.ops_list_booking_notes(pg_temp.bid('a1')) -> 'items', 'owner detail: notes as the notes list');
select is(public.ops_get_booking(lower(pg_temp.r('v1', 'ref'))) ->> 'id', pg_temp.bid('v1')::text, 'owner detail: the ref in any case');

-- I. The lapse (P-09) and the guard ----------------------------------------------------------------------------------
select public.ops_lapse_holds(); -- not a case: whatever the sections above left due is swept, so the counts below are this section's
select pg_temp.mkq('lp1');
select pg_temp.past('lp1', interval '3 minutes');
select pg_temp.mkq('lp2');
select pg_temp.rec('lp2', 10000);
select pg_temp.past('lp2', interval '3 minutes');
select pg_temp.mkq('lp3');
select pg_temp.rec('lp3', 10000);
select pg_temp.past('lp3', interval '1 minute');
select is(public.ops_lapse_holds(), 1, 'lapse: one unpaid request past deadline + 2 minutes is lapsed and counted; a flag is not counted');
select is(pg_temp.st('lp1') || '/' || pg_temp.nights('lp1')::text, 'expired/0', 'lapse: the unpaid request is expired and its nights are free');
select ok((pg_temp.b('lp1')).needs_attention = false and pg_temp.ev('lp1', 'needs_attention') = 0, 'lapse: an unpaid lapsed request is not flagged');
select ok((select e.actor = 'system' and e.detail ->> 'swept_by' = 'ops_lapse_holds' and e.from_status = 'awaiting_payment'
             from public.booking_events e where e.booking_id = pg_temp.bid('lp1') and e.action = 'hold_expired'),
          'lapse: one hold_expired event by the system');
select is(pg_temp.st('lp2') || '/' || pg_temp.perm('lp2')::text, 'awaiting_payment/3', 'lapse: a part-paid request 3 minutes past is not lapsed and keeps its permanent nights (P-09)');
select is((pg_temp.b('lp2')).needs_attention::text || '/' || (pg_temp.b('lp2')).attention_reason, 'true/deadline_passed_part_paid', 'lapse: it is flagged deadline_passed_part_paid');
select is((select e.detail from public.booking_events e where e.booking_id = pg_temp.bid('lp2') and e.action = 'needs_attention'),
          jsonb_build_object('reason', 'deadline_passed_part_paid', 'paid_fils', 10000, 'deadline', pg_temp.iso(now() - interval '3 minutes')),
          'lapse: with one needs_attention event { reason, paid_fils, deadline }');
select ok((pg_temp.b('lp3')).needs_attention = false and pg_temp.st('lp3') = 'awaiting_payment', 'lapse: a part-paid request 1 minute past is not flagged yet');
select is(public.ops_lapse_holds(), 0, 'lapse: a second call lapses nothing');
select is(pg_temp.ev('lp2', 'needs_attention'), 1, 'lapse: and writes no second needs_attention event (once per deadline)');
select public.ops_resolve_attention(pg_temp.bid('lp2'), 'Guest is sending the rest', pg_temp.owner_id());
select public.ops_lapse_holds();
select ok((pg_temp.b('lp2')).needs_attention = false and pg_temp.ev('lp2', 'needs_attention') = 1, 'lapse: after Resolve the same deadline is not flagged again');
select pg_temp.mk('lpx');
select is(public.place_hold(pg_temp.bid('lpx'), '00000000-0000-4000-8000-0000000017e1', (pg_temp.b('lp2')).arrive, (pg_temp.b('lp2')).leave, now() + interval '30 minutes'),
          'sold_out', 'lapse: another hold over its nights is sold_out');
select ok(pg_temp.st('lp2') = 'awaiting_payment' and pg_temp.perm('lp2') = 3, 'lapse: and the part-paid request is untouched');
select throws_ok(format($$update public.bookings set status = 'expired' where id = %L$$, pg_temp.bid('lp2')), 'P0001', 'almar:paid_request_kept',
                 'guard: a direct update of a part-paid request to expired raises paid_request_kept');
update public.bookings set hold_expires_at = now() - interval '4 minutes' where id = pg_temp.bid('lp2');
select public.ops_lapse_holds();
select is(pg_temp.ev('lp2', 'needs_attention')::text || '/' || (pg_temp.b('lp2')).attention_reason, '2/deadline_passed_part_paid', 'lapse: a later deadline is flagged again');

-- J. The lapse email claim -----------------------------------------------------------------------------------------
-- Eligible: lp1 (lapsed above, deadline 3 minutes back) and cl2 (deadline 10 minutes back, locale es). Left out: a
-- hand-made one, a hold never requested, a cancelled request, a sent one, e1 (money recorded: paid_after_expiry), one
-- past 48 hours and one with 5 tries.
select pg_temp.mkq('cl2');
update public.bookings set status = 'expired', hold_expires_at = now() - interval '10 minutes', locale = 'es' where id = pg_temp.bid('cl2');
select pg_temp.mkops('kops');
update public.bookings set status = 'expired', requested_at = now(), hold_expires_at = now() - interval '5 minutes' where id = pg_temp.bid('kops');
select pg_temp.mk('knever');
update public.bookings set status = 'expired', hold_expires_at = now() - interval '5 minutes' where id = pg_temp.bid('knever');
select pg_temp.mkq('kcancel');
select public.ops_set_booking_status(pg_temp.bid('kcancel'), 'cancelled', 'awaiting_payment', pg_temp.owner_id());
update public.bookings set hold_expires_at = now() - interval '5 minutes' where id = pg_temp.bid('kcancel');
select pg_temp.mkq('ksent');
update public.bookings set status = 'expired', hold_expires_at = now() - interval '5 minutes', lapse_email_sent_at = now() where id = pg_temp.bid('ksent');
select pg_temp.mkq('kold');
update public.bookings set status = 'expired', hold_expires_at = now() - interval '49 hours' where id = pg_temp.bid('kold');
select pg_temp.mkq('ktries');
update public.bookings set status = 'expired', hold_expires_at = now() - interval '5 minutes', lapse_email_attempts = 5 where id = pg_temp.bid('ktries');

insert into t_res values ('C1', public.claim_lapse_emails(10));
select is((select array_agg((j ->> 'booking_id')::uuid order by o) from jsonb_array_elements((select v from t_res where k = 'C1')) with ordinality as t(j, o)
            where j ->> 'email' like '%@pay.example.com'),
          array[pg_temp.bid('cl2'), pg_temp.bid('lp1')],
          'claim: only expired, requested, unsent, unpaid web requests, oldest deadline first (ops source, never requested, cancelled, sent, paid, older than 48 hours and 5 tries left out)');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v -> 0 from t_res where k = 'C1')) k),
          array['arrive', 'booking_id', 'deadline', 'email', 'guest_name', 'is_test', 'leave', 'locale', 'ref', 'stay_slug', 'stay_title'],
          'claim: a lapse job has exactly its keys');
select is((select j ->> 'stay_title' || '/' || (j ->> 'deadline') from jsonb_array_elements((select v from t_res where k = 'C1')) j
            where (j ->> 'booking_id')::uuid = pg_temp.bid('cl2')),
          'Estancia uno/' || pg_temp.iso(now() - interval '10 minutes'), 'claim: the stay title in the booking''s locale, and the deadline');
select ok((select b.lapse_email_attempts = 1 and b.lapse_email_claimed_at = now() from public.bookings b where b.id = pg_temp.bid('lp1')),
          'claim: the claim takes the lease and counts one try');
select is((select count(*)::int from jsonb_array_elements(public.claim_lapse_emails(10)) j where (j ->> 'booking_id')::uuid in (pg_temp.bid('cl2'), pg_temp.bid('lp1'))),
          0, 'claim: a second claim inside the lease takes neither again');
update public.bookings set lapse_email_claimed_at = now() - interval '11 minutes' where id in (pg_temp.bid('cl2'), pg_temp.bid('lp1'));
select is((select count(*)::int from jsonb_array_elements(public.claim_lapse_emails(10)) j where (j ->> 'booking_id')::uuid in (pg_temp.bid('cl2'), pg_temp.bid('lp1'))),
          2, 'claim: with the lease older than 10 minutes both are claimed again');
select is((pg_temp.b('lp1')).lapse_email_attempts, 2, 'claim: a second try counted');
select pg_temp.lapsed('cz' || g) from generate_series(1, 11) g;
select is(jsonb_array_length(public.claim_lapse_emails(0)), 1, 'claim: p_limit 0 is clamped to 1');
select is(jsonb_array_length(public.claim_lapse_emails(50)), 10, 'claim: p_limit 50 is clamped to 10');

select public.finish_lapse_email(pg_temp.bid('cl2'), true);
select ok((pg_temp.b('cl2')).lapse_email_sent_at = now(), 'finish: a sent email sets lapse_email_sent_at');
select is((select e.detail from public.booking_events e where e.booking_id = pg_temp.bid('cl2') and e.action = 'email_sent'),
          jsonb_build_object('template', 'request_lapsed', 'key', 'lapse/' || pg_temp.bid('cl2')::text), 'finish: and writes email_sent with the key lapse/<booking_id>');
select public.finish_lapse_email(pg_temp.bid('cl2'), true);
select is(pg_temp.ev('cl2', 'email_sent'), 1, 'finish: a second report of the same send writes nothing');
select public.finish_lapse_email(pg_temp.bid('lp1'), false, 'Resend: Rate-Limit Exceeded (429) ' || repeat('x', 80));
select is((select e.detail from public.booking_events e where e.booking_id = pg_temp.bid('lp1') and e.action = 'email_failed'),
          jsonb_build_object('template', 'request_lapsed', 'key', 'lapse/' || pg_temp.bid('lp1')::text, 'error', left('resendratelimitexceeded429' || repeat('x', 80), 60)),
          'finish: a failed send writes email_failed with the error cleaned to a-z 0-9 _ and at most 60 characters');
select ok((pg_temp.b('lp1')).lapse_email_sent_at is null, 'finish: and nothing is marked sent');

select * from finish();
rollback;
