-- pgTAP: Phase 5 plan 05-01 (migration 20261031120000_ops_os.sql): bank refunds (columns, checks, ops_record_refund,
-- ops_void_refund), booking_flags / booking_view / ops_get_booking / ops_record_payment / ops_void_payment as replaced,
-- the agreed reason of ops_create_booking (P5-02), ops_home_numbers (P5-08) and ops_list_customers (P5-09).
-- WRITTEN, NOT RUN: the owner's no-test rule (2026-10-21) applies to this plan; the controller decides when it runs.
-- Symbolic amounts, not real prices: a 3-night stay at 1000.00 AED a night, VAT 5 %, deposit 30 %: grand 315000 fils,
-- deposit 94500 fils, balance 220500 fils (the pg_temp.pl rule). Bank values are documentation examples only.
-- Own helpers and seed: nothing here depends on another test file.
-- Run: node tests/helpers/local-supabase.mjs test supabase/tests/ops-os.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(146);

-- Helpers (temporary, gone with the transaction; the first group is booking-payments.test.sql's) ------------------------
create function pg_temp.d(n int) returns date language sql as $$ select ((now() at time zone 'Asia/Dubai')::date + n) $$;

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
create function pg_temp.owner_id() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000018f1'::uuid $$;
create function pg_temp.guest() returns uuid language sql as $$ select '00000000-0000-4000-8000-0000000018f2'::uuid $$;

-- Every booking gets its own three nights: arrival offsets 10, 14, 18, ... days from the Dubai today.
create temp sequence t_off start 10 increment 4;

-- A web hold of three nights that must succeed (TEST unless p_test is false); kept under p_key; email <key>@os.example.com.
create function pg_temp.mk(p_key text, p_plan text default 'deposit', p_test boolean default true, p_slug text default 'os-stay-one',
  p_over jsonb default '{}'::jsonb)
returns uuid language plpgsql as $$
declare v jsonb; o int := nextval('t_off');
begin
  v := public.create_web_booking(pg_temp.web(p_slug, pg_temp.d(o), pg_temp.d(o + 3), lower(p_key) || '@os.example.com', p_plan)
    || jsonb_build_object('is_test', p_test) || p_over);
  if not (v ->> 'ok')::boolean then raise exception 'mk % failed: %', p_key, v; end if;
  insert into t_res values (p_key, v);
  return (v ->> 'booking_id')::uuid;
end $$;

-- A hand-made booking (source ops, awaiting_payment for 48 hours) on stay two; kept under p_key.
create function pg_temp.mkh(p_key text, p_test boolean default true, p_plan text default 'deposit', p_extra jsonb default '{}'::jsonb,
  p_email text default null)
returns uuid language plpgsql as $$
declare v jsonb; o int := nextval('t_off');
begin
  v := public.ops_create_booking(
    pg_temp.ops('os-stay-two', pg_temp.d(o), pg_temp.d(o + 3), coalesce(p_email, lower(p_key) || '@os.example.com'), interval '48 hours', p_plan)
      || jsonb_build_object('is_test', p_test) || p_extra,
    pg_temp.owner_id());
  insert into t_res values (p_key, v);
  return (v ->> 'booking_id')::uuid;
end $$;

create function pg_temp.rq(p_key text, p_test boolean default true) returns jsonb language plpgsql as $$
begin
  return public.request_web_booking(pg_temp.bid(p_key), p_test);
end $$;

-- A hold made and requested, both of which must succeed.
create function pg_temp.mkq(p_key text, p_plan text default 'deposit', p_test boolean default true, p_slug text default 'os-stay-one',
  p_over jsonb default '{}'::jsonb)
returns uuid language plpgsql as $$
declare v jsonb;
begin
  perform pg_temp.mk(p_key, p_plan, p_test, p_slug, p_over);
  v := pg_temp.rq(p_key, p_test);
  if not coalesce((v ->> 'first_time')::boolean, false) then raise exception 'mkq % failed: %', p_key, v; end if;
  return pg_temp.bid(p_key);
end $$;

create function pg_temp.past(p_key text, p_ago interval) returns void language sql as $$
  update public.booking_nights set expires_at = now() - p_ago where booking_id = pg_temp.bid(p_key) and expires_at is not null;
  update public.bookings set hold_expires_at = now() - p_ago where id = pg_temp.bid(p_key);
$$;

create function pg_temp.b(p_key text) returns public.bookings language sql as $$ select b.* from public.bookings b where b.id = pg_temp.bid(p_key) $$;
create function pg_temp.st(p_key text) returns text language sql as $$ select b.status from public.bookings b where b.id = pg_temp.bid(p_key) $$;
create function pg_temp.ev(p_key text, p_action text) returns int language sql as $$
  select count(*)::int from public.booking_events e where e.booking_id = pg_temp.bid(p_key) and e.action = p_action
$$;
create function pg_temp.bv(p_key text) returns jsonb language sql as $$ select public.booking_view(pg_temp.bid(p_key), null, true) $$;
create function pg_temp.fl(p_key text) returns jsonb language sql as $$ select public.booking_flags(pg_temp.b(p_key)) $$;

-- The payment payload and the owner's record of a transfer (answer kept under 'p:<key>').
create function pg_temp.payload(p_key text, p_amount bigint, p_over jsonb default '{}'::jsonb, p_request uuid default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'booking_id', pg_temp.bid(p_key), 'request_id', coalesce(p_request, gen_random_uuid()), 'expected_status', pg_temp.st(p_key),
    'amount_fils', p_amount, 'received_on', to_char(pg_temp.d(0), 'YYYY-MM-DD'), 'bank_reference', 'TEST-' || p_key) || p_over
$$;
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

-- The refund payload and the owner's record of a refund (answer kept under 'f:<key>', the last one).
create function pg_temp.rpayload(p_key text, p_amount bigint, p_over jsonb default '{}'::jsonb, p_request uuid default null)
returns jsonb language sql as $$
  select jsonb_build_object(
    'booking_id', pg_temp.bid(p_key), 'request_id', coalesce(p_request, gen_random_uuid()), 'amount_fils', p_amount,
    'refunded_on', to_char(pg_temp.d(0), 'YYYY-MM-DD'), 'bank_reference', 'REF-' || p_key, 'reason', 'Guest asked') || p_over
$$;
create function pg_temp.rfd(p_key text, p_amount bigint, p_over jsonb default '{}'::jsonb, p_request uuid default null)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
  v := public.ops_record_refund(pg_temp.rpayload(p_key, p_amount, p_over, p_request), pg_temp.owner_id());
  delete from t_res where k = 'f:' || p_key;
  insert into t_res values ('f:' || p_key, v);
  return v;
end $$;
create function pg_temp.rid(p_res text) returns bigint language sql as $$ select (v ->> 'refund_id')::bigint from t_res where k = p_res $$;

-- The owner voids a refund; the answer is kept under 'x:<p_key>'.
create function pg_temp.rvd(p_key text, p_refund bigint, p_reason text default 'Typed in error') returns jsonb language plpgsql as $$
declare v jsonb;
begin
  v := public.ops_void_refund(p_refund, p_reason, pg_temp.owner_id());
  delete from t_res where k = 'x:' || p_key;
  insert into t_res values ('x:' || p_key, v);
  return v;
end $$;

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

-- Payloads kept for the replay cases of ops_create_booking; the agreed variant (every night source 'agreed').
create temp table t_pl (k text primary key, v jsonb);
create function pg_temp.agr(p jsonb, p_reason text default null) returns jsonb language sql as $$
  select (p || jsonb_build_object('nights_snapshot', (select jsonb_agg(t.e || '{"source": "agreed", "rate_id": null}'::jsonb order by t.o)
                                                      from jsonb_array_elements(p -> 'nights_snapshot') with ordinality as t(e, o))))
    || case when p_reason is null then '{}'::jsonb else jsonb_build_object('agreed_reason', p_reason) end
$$;
create function pg_temp.stash(p_key text, p jsonb) returns void language sql as $$ insert into t_pl values (p_key, p) $$;
create function pg_temp.opsn(p_key text) returns jsonb language plpgsql as $$
declare o int := nextval('t_off');
begin
  return pg_temp.ops('os-stay-two', pg_temp.d(o), pg_temp.d(o + 3), lower(p_key) || '@os.example.com', interval '48 hours');
end $$;
create function pg_temp.go(p_key text) returns jsonb language plpgsql as $$
declare v jsonb;
begin
  v := public.ops_create_booking((select t.v from t_pl t where t.k = p_key), pg_temp.owner_id());
  delete from t_res where k = 'o:' || p_key;
  insert into t_res values ('o:' || p_key, v);
  return v;
end $$;

-- Seed ----------------------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-0000000018f1', 'maria@almarprivatejourney.com', now()),
  ('00000000-0000-4000-8000-0000000018f2', 'guest-ops-os@example.com', now());
insert into public.media (id, key, width, height, bytes, sha256, source) values
  ('00000000-0000-4000-8000-0000000018a1', 'test/ops-os-hero.webp', 1600, 1000, 12345, repeat('c', 64), 'import');
insert into public.image_translations (image_id, locale, alt, status) values
  ('00000000-0000-4000-8000-0000000018a1', 'en', 'A hero', 'published');
insert into public.destinations (id, slug, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000018d1', 'os-dest', '00000000-0000-4000-8000-0000000018a1', true, 1),
  ('00000000-0000-4000-8000-0000000018d2', 'os-dest-two', '00000000-0000-4000-8000-0000000018a1', true, 2);
insert into public.destination_translations (destination_id, locale, status, name) values
  ('00000000-0000-4000-8000-0000000018d1', 'en', 'published', 'Destination one'),
  ('00000000-0000-4000-8000-0000000018d2', 'en', 'published', 'Destination two');
insert into public.stays (id, slug, destination_id, max_guests, min_nights, infants_count, base_nightly_rate_aed, hero_media_id, is_published, position) values
  ('00000000-0000-4000-8000-0000000018e1', 'os-stay-one', '00000000-0000-4000-8000-0000000018d1', 6, 1, false, 1000.00, '00000000-0000-4000-8000-0000000018a1', true, 1),
  ('00000000-0000-4000-8000-0000000018e2', 'os-stay-two', '00000000-0000-4000-8000-0000000018d2', 6, 1, false, 1000.00, '00000000-0000-4000-8000-0000000018a1', true, 2);
insert into public.stay_translations (stay_id, locale, status, title) values
  ('00000000-0000-4000-8000-0000000018e1', 'en', 'published', 'Stay one'),
  ('00000000-0000-4000-8000-0000000018e2', 'en', 'published', 'Stay two');
update public.site_settings set vat_percent = 5.00, deposit_percent = 30.00, balance_due_days = 30 where id = 1;
-- Bank details complete, the owner's window not set: TEST bookings get 35 minutes (P-06).
update public.booking_bank_details
   set account_name = 'Almar Test Account', bank_name = 'Test Bank', iban = 'GB82WEST12345698765432', swift = 'TESTAEAA',
       bank_address = '1 Test Street, Dubai', note_en = 'All fees paid by the sender.', note_ar = null, note_es = null,
       transfer_window_minutes = null
 where id = 1;

-- A. Schema -----------------------------------------------------------------------------------------------------------
select is((select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'booking_refunds'
            and column_name in ('method', 'refunded_on', 'bank_reference', 'reason', 'recorded_by', 'request_id', 'void_reason', 'voided_at', 'voided_by')),
          9, 'schema: booking_refunds has the nine new columns');
select is((select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'booking_refunds' and column_name = 'stripe_refund_id'),
          'YES', 'schema: stripe_refund_id is nullable');
select is((select count(*)::int from pg_constraint where conrelid = 'public.booking_refunds'::regclass
            and conname in ('booking_refunds_request_id_key', 'booking_refunds_source', 'booking_refunds_bank_fields', 'booking_refunds_voided_fields')),
          4, 'schema: the request id key and the three new checks exist');
select ok((select c.convalidated from pg_constraint c where c.conrelid = 'public.booking_refunds'::regclass and c.conname = 'booking_refunds_bank_fields')
      and (select c.convalidated from pg_constraint c where c.conrelid = 'public.booking_refunds'::regclass and c.conname = 'booking_refunds_source')
      and (select c.convalidated from pg_constraint c where c.conrelid = 'public.booking_refunds'::regclass and c.conname = 'booking_refunds_voided_fields'),
          'schema: and the three checks are validated');
select ok((select count(*) = 1 from pg_constraint where conrelid = 'public.booking_refunds'::regclass and contype = 'u'
              and pg_get_constraintdef(oid) like '%stripe_refund_id%'),
          'schema: the Stripe id keeps its one unique constraint (no partial index)');
select is((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'bookings' and column_name = 'refunded_fils'),
          '0', 'schema: bookings.refunded_fils exists, default 0');
select is((select (length(d) - length(replace(d, '::text', ''))) / 6
             from (select pg_get_constraintdef(c.oid) as d from pg_constraint c
                    where c.conrelid = 'public.booking_events'::regclass and c.conname = 'booking_events_action_check') x),
          22, 'schema: the action check lists 22 actions');
select ok((select pg_get_constraintdef(c.oid) like '%''refund_recorded''%' and pg_get_constraintdef(c.oid) like '%''refund_voided''%'
             from pg_constraint c where c.conrelid = 'public.booking_events'::regclass and c.conname = 'booking_events_action_check'),
          'schema: and they are refund_recorded and refund_voided');
select ok(to_regprocedure('public.ops_record_refund(jsonb, uuid)') is not null
      and to_regprocedure('public.ops_void_refund(bigint, text, uuid)') is not null
      and to_regprocedure('public.ops_home_numbers(date, date)') is not null
      and to_regprocedure('public.ops_list_customers(text, text, int)') is not null,
          'schema: the four new functions exist with their exact signatures');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in ('ops_record_refund', 'ops_void_refund', 'ops_home_numbers', 'ops_list_customers')
              and p.prosecdef and p.proconfig @> array['search_path=""']),
          4, 'schema: all four are security definer with an empty search_path');
select ok((select count(*) = 0 from information_schema.role_table_grants
            where table_schema = 'public' and table_name = 'booking_refunds' and grantee in ('anon', 'authenticated', 'PUBLIC'))
      and (select c.relrowsecurity from pg_class c where c.oid = 'public.booking_refunds'::regclass),
          'schema: booking_refunds keeps RLS on and nothing granted to anon, authenticated or public');

-- B. Privileges ------------------------------------------------------------------------------------------------------
set local role anon;
select throws_ok($$select public.ops_record_refund('{}'::jsonb, gen_random_uuid())$$, '42501', null, 'anon cannot call ops_record_refund');
select throws_ok($$select public.ops_void_refund(1, 'abc', gen_random_uuid())$$, '42501', null, 'anon cannot call ops_void_refund');
select throws_ok($$select public.ops_home_numbers(current_date, current_date)$$, '42501', null, 'anon cannot call ops_home_numbers');
select throws_ok($$select public.ops_list_customers(null, null, 30)$$, '42501', null, 'anon cannot call ops_list_customers');
set local role authenticated;
select throws_ok($$select public.ops_record_refund('{}'::jsonb, gen_random_uuid())$$, '42501', null, 'authenticated cannot call ops_record_refund');
select throws_ok($$select public.ops_void_refund(1, 'abc', gen_random_uuid())$$, '42501', null, 'authenticated cannot call ops_void_refund');
select throws_ok($$select public.ops_home_numbers(current_date, current_date)$$, '42501', null, 'authenticated cannot call ops_home_numbers');
select throws_ok($$select public.ops_list_customers(null, null, 30)$$, '42501', null, 'authenticated cannot call ops_list_customers');
reset role;
select ok(has_function_privilege('service_role', 'public.ops_record_refund(jsonb, uuid)', 'execute')
      and has_function_privilege('service_role', 'public.ops_void_refund(bigint, text, uuid)', 'execute')
      and has_function_privilege('service_role', 'public.ops_home_numbers(date, date)', 'execute')
      and has_function_privilege('service_role', 'public.ops_list_customers(text, text, int)', 'execute'),
          'privileges: service_role may call all four');

-- C. The Stripe-era record_refund still works beside the bank rows ----------------------------------------------------
select pg_temp.mkq('st1');
insert into public.booking_payments (booking_id, kind, amount_fils, status, paid_at, charge_id)
  values (pg_temp.bid('st1'), 'full', 1000, 'succeeded', now(), 'ch_os1');
select is(public.record_refund('stripe-ref-os1', 'ch_os1', null, 1000, 'succeeded', 'stripe:evt_os1'), 'ok',
          'stripe: record_refund still files a card refund');
select is(public.record_refund('stripe-ref-os1', 'ch_os1', null, 1000, 'pending', 'stripe:evt_os1b'), 'ok',
          'stripe: and the same id again is accepted');
select is((select count(*)::int || '/' || min(r.status) || '/' || min(r.method) from public.booking_refunds r where r.stripe_refund_id = 'stripe-ref-os1'),
          '1/pending/card', 'stripe: one row, updated, method card');
select throws_ok(format($$insert into public.booking_refunds (booking_id, method, stripe_refund_id) values (%L, 'card', null)$$, pg_temp.bid('st1')),
          '23514', null, 'checks: a card row without a Stripe id is refused (booking_refunds_source)');
select throws_ok(format($$insert into public.booking_refunds (booking_id, method, status, amount_fils, refunded_on, bank_reference, request_id)
                          values (%L, 'bank_transfer', 'succeeded', 100, current_date, 'X', gen_random_uuid())$$, pg_temp.bid('st1')),
          '23514', null, 'checks: a bank row without recorded_by is refused (booking_refunds_bank_fields)');
select throws_ok(format($$update public.booking_refunds set status = 'voided' where stripe_refund_id = 'stripe-ref-os1' and booking_id = %L$$, pg_temp.bid('st1')),
          '23514', null, 'checks: a voided status without when, who and why is refused (booking_refunds_voided_fields)');

-- D. ops_record_refund ------------------------------------------------------------------------------------------------
-- rf1: a deposit_paid request with 94500 paid.
select pg_temp.mkq('rf1');
select pg_temp.rec('rf1', 94500);
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 20000), pg_temp.guest())),
          'almar:not_owner', 'refund: not the owner');
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 20000, '{"extra": 1}'), pg_temp.owner_id())),
          'almar:invalid:extra', 'refund: a key outside the list is invalid');
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 0), pg_temp.owner_id())),
          'almar:invalid:amount_fils', 'refund: an amount of 0 is invalid');
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 20000, '{"bank_reference": ""}'), pg_temp.owner_id())),
          'almar:invalid:bank_reference', 'refund: an empty bank reference is invalid');
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 20000, '{"reason": "ab"}'), pg_temp.owner_id())),
          'almar:invalid:reason', 'refund: a reason of 2 characters is invalid');
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 20000, jsonb_build_object('refunded_on', to_char(pg_temp.d(1), 'YYYY-MM-DD'))), pg_temp.owner_id())),
          'almar:invalid:refunded_on', 'refund: a day in the future (Dubai) is invalid');
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 20000, jsonb_build_object('refunded_on', to_char(pg_temp.d(-1), 'YYYY-MM-DD'))), pg_temp.owner_id())),
          'almar:invalid:refunded_on', 'refund: a day before the booking was made is invalid');
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 94501), pg_temp.owner_id())),
          'almar:above_paid', 'refund: above paid minus refunded is above_paid');
select is((select count(*)::int from public.booking_refunds where booking_id = pg_temp.bid('rf1')), 0, 'refund: and every refusal left no row');

select pg_temp.rfd('rf1', 20000);
select is(pg_temp.r('f:rf1', 'first_time') || '/' || pg_temp.r('f:rf1', 'paid_fils') || '/' || pg_temp.r('f:rf1', 'refunded_fils') || '/' || pg_temp.r('f:rf1', 'refundable_fils'),
          'true/94500/20000/74500', 'refund: recorded; paid stays, refunded rises, refundable is the rest');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v from t_res where k = 'f:rf1')) k),
          array['amount_fils', 'attention_cleared', 'booking_id', 'first_time', 'flags', 'is_test', 'link_version', 'locale', 'paid_fils',
                'ref', 'refund_id', 'refundable_fils', 'refunded_fils', 'refunded_on'],
          'refund: the answer has exactly its keys');
select is(pg_temp.st('rf1') || '/' || (pg_temp.b('rf1')).paid_fils::text || '/' || (pg_temp.b('rf1')).written_off_fils::text || '/' || (pg_temp.b('rf1')).refunded_fils::text,
          'deposit_paid/94500/0/20000', 'refund: the status, paid_fils and written_off_fils are unchanged (P-06)');
select is(pg_temp.fl('rf1') ->> 'still_due_fils', '220500', 'refund: and what is still due did not rise (P-06)');
select ok((select x.method = 'bank_transfer' and x.status = 'succeeded' and x.stripe_refund_id is null and x.amount_fils = 20000
              and x.refunded_on = pg_temp.d(0) and x.bank_reference = 'REF-rf1' and x.reason = 'Guest asked' and x.recorded_by = pg_temp.owner_id()
              and x.request_id is not null
             from public.booking_refunds x where x.id = pg_temp.rid('f:rf1')),
          'refund: one bank row with what the owner typed and no Stripe id');
select ok((select e.actor = 'owner:' || pg_temp.owner_id()::text and e.from_status = 'deposit_paid' and e.to_status = 'deposit_paid'
              and e.detail ->> 'refund_id' = pg_temp.rid('f:rf1')::text and e.detail ->> 'amount_fils' = '20000' and e.detail ->> 'refunded_fils' = '20000'
              and e.detail ->> 'paid_fils' = '94500' and e.detail ->> 'bank_reference' = 'REF-rf1' and e.detail ->> 'reason' = 'Guest asked'
              and e.detail ->> 'attention_cleared' = 'false' and jsonb_exists(e.detail, 'request_id') and jsonb_exists(e.detail, 'refunded_on')
             from public.booking_events e where e.booking_id = pg_temp.bid('rf1') and e.action = 'refund_recorded'),
          'refund: one refund_recorded event by the owner with the whole detail');

-- The boundary: exactly the rest is allowed, one fils more is not, then nothing is left.
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 74501), pg_temp.owner_id())),
          'almar:above_paid', 'refund: one fils above what is left is above_paid');
select pg_temp.rfd('rf1', 74500);
select is((pg_temp.b('rf1')).refunded_fils, 94500::bigint, 'refund: exactly the rest is allowed, and refunded_fils is the sum of the rows');
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf1', 1), pg_temp.owner_id())),
          'almar:nothing_to_refund', 'refund: nothing left is nothing_to_refund');
select is((select count(*)::int from public.booking_refunds where booking_id = pg_temp.bid('rf1') and stripe_refund_id is null), 2,
          'refund: two bank rows with no Stripe id coexist');

-- Replay: the same request id is one row (T-05-03).
select pg_temp.mkq('rf3');
select pg_temp.rec('rf3', 94500);
insert into t_res values ('rq3', jsonb_build_object('id', gen_random_uuid()));
select pg_temp.rfd('rf3', 30000, '{}', (select (v ->> 'id')::uuid from t_res where k = 'rq3'));
select is(pg_temp.r('f:rf3', 'first_time'), 'true', 'replay: the first call is first_time true');
select pg_temp.rfd('rf3', 30000, '{}', (select (v ->> 'id')::uuid from t_res where k = 'rq3'));
select is(pg_temp.r('f:rf3', 'first_time') || '/' || pg_temp.r('f:rf3', 'refunded_fils') || '/' || pg_temp.r('f:rf3', 'refundable_fils'),
          'false/30000/64500', 'replay: the second is first_time false with the same figures');
select is((select count(*)::int from public.booking_refunds where booking_id = pg_temp.bid('rf3')) || '/' || pg_temp.ev('rf3', 'refund_recorded')::text,
          '1/1', 'replay: one row and one event');
select is(pg_temp.err(format($$select pg_temp.rfd('rf3', 30001, '{}', %L)$$, (select (v ->> 'id')::uuid from t_res where k = 'rq3'))),
          'almar:changed', 'replay: the same request id with another amount is changed');
select is(pg_temp.err(format($$select pg_temp.rfd('rf1', 30000, '{}', %L)$$, (select (v ->> 'id')::uuid from t_res where k = 'rq3'))),
          'almar:changed', 'replay: the same request id on another booking is changed');
select is((pg_temp.b('rf3')).refunded_fils, 30000::bigint, 'replay: and nothing was added');

-- Day edges: today (Dubai) is allowed; the creation day is the earliest.
select pg_temp.mkq('rf2');
select pg_temp.rec('rf2', 94500);
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf2', 1000), pg_temp.owner_id())), 'ok',
          'refund: the booking''s creation day (today, Dubai) is accepted');
select is(pg_temp.err(format($$select public.ops_record_refund(%L::jsonb, %L)$$, pg_temp.rpayload('rf2', 1000, '{"refunded_on": "2026-02-30"}'), pg_temp.owner_id())),
          'almar:invalid:refunded_on', 'refund: a day that does not exist is invalid');

-- Flags: overpaid clears only once paid minus refunded is within the total.
select pg_temp.mkq('rf4');
select pg_temp.rec('rf4', 400000);
select is(((pg_temp.b('rf4')).needs_attention)::text || '/' || (pg_temp.b('rf4')).attention_reason, 'true/overpaid', 'flags: 400000 paid on a 315000 total is flagged overpaid');
select pg_temp.rfd('rf4', 10000);
select is(pg_temp.r('f:rf4', 'attention_cleared') || '/' || (pg_temp.b('rf4')).attention_reason, 'false/overpaid',
          'flags: a refund that leaves paid minus refunded above the total keeps overpaid');
select is(pg_temp.fl('rf4') ->> 'overpaid', 'true', 'flags: and booking_flags still says overpaid');
select pg_temp.rfd('rf4', 75000);
select is(pg_temp.r('f:rf4', 'attention_cleared') || '/' || (pg_temp.b('rf4')).needs_attention::text || '/' || coalesce((pg_temp.b('rf4')).attention_reason, 'none'),
          'true/false/none', 'flags: a refund that brings paid minus refunded to the total clears overpaid');
select is(pg_temp.fl('rf4') ->> 'overpaid', 'false', 'flags: and booking_flags says not overpaid (net of refunds)');
select is(pg_temp.st('rf4'), 'paid_in_full', 'flags: the status is still paid_in_full');

-- Flags: money on a cancelled or expired booking clears only at paid minus refunded of 0.
select pg_temp.mkq('rf6');
select public.ops_set_booking_status(pg_temp.bid('rf6'), 'cancelled', 'awaiting_payment', pg_temp.owner_id());
select pg_temp.rec('rf6', 94500);
select is((pg_temp.b('rf6')).attention_reason, 'paid_after_cancel', 'flags: money on a cancelled booking is flagged paid_after_cancel');
select pg_temp.rfd('rf6', 50000);
select is(pg_temp.r('f:rf6', 'attention_cleared') || '/' || (pg_temp.b('rf6')).attention_reason || '/' || pg_temp.st('rf6'), 'false/paid_after_cancel/cancelled',
          'flags: a refund of part keeps paid_after_cancel (a refund is allowed on a cancelled booking)');
select pg_temp.rvd('rf6', pg_temp.rid('f:rf6'));
select is(pg_temp.r('x:rf6', 'attention_raised') || '/' || (pg_temp.b('rf6')).attention_reason, 'false/paid_after_cancel',
          'void refund: a booking that is already flagged is not flagged again');
select pg_temp.rfd('rf6', 94500);
select is(pg_temp.r('f:rf6', 'attention_cleared') || '/' || (pg_temp.b('rf6')).needs_attention::text, 'true/false', 'flags: refunding all of it clears the flag');
select pg_temp.rvd('rf6', pg_temp.rid('f:rf6'));
select is(pg_temp.r('x:rf6', 'attention_raised') || '/' || (pg_temp.b('rf6')).attention_reason, 'true/paid_after_cancel',
          'void refund: voiding that refund raises paid_after_cancel again');
select pg_temp.mkq('rf7');
select pg_temp.past('rf7', interval '3 minutes');
select pg_temp.rec('rf7', 50000, '{"expected_status": "expired"}');
select is((pg_temp.b('rf7')).attention_reason, 'paid_after_expiry', 'flags: money on an expired request is flagged paid_after_expiry');
select pg_temp.rfd('rf7', 50000);
select is(pg_temp.r('f:rf7', 'attention_cleared') || '/' || pg_temp.st('rf7'), 'true/expired', 'flags: refunding all of it clears it, and the booking stays expired');

-- Flags: deadline_passed_part_paid stays.
select pg_temp.mkq('rf8');
select pg_temp.rec('rf8', 50000);
update public.bookings set needs_attention = true, attention_reason = 'deadline_passed_part_paid' where id = pg_temp.bid('rf8');
select pg_temp.rfd('rf8', 10000);
select is(pg_temp.r('f:rf8', 'attention_cleared') || '/' || (pg_temp.b('rf8')).attention_reason, 'false/deadline_passed_part_paid',
          'flags: deadline_passed_part_paid is kept by a refund');
-- Paid above 0 with net 0: the deadline flag still needs nothing paid, the money flags would have cleared (symbolic amounts).
select pg_temp.mkq('rf8b');
select pg_temp.rec('rf8b', 50000);
select pg_temp.rec('rf8b', 20000);
select pg_temp.rfd('rf8b', 20000);
update public.bookings set needs_attention = true, attention_reason = 'deadline_passed_part_paid' where id = pg_temp.bid('rf8b');
select public.ops_void_payment((select id from public.booking_payments where booking_id = pg_temp.bid('rf8b') and amount_fils = 50000), 'Typed in error', pg_temp.owner_id());
select is((pg_temp.b('rf8b')).attention_reason, 'deadline_passed_part_paid',
          'void payment: paid above 0 with net 0 keeps deadline_passed_part_paid');

-- E. ops_void_refund --------------------------------------------------------------------------------------------------
select pg_temp.mkq('rf9');
select pg_temp.rec('rf9', 94500);
select pg_temp.rfd('rf9', 30000);
select is(pg_temp.err(format($$select public.ops_void_refund(%L, 'Typed in error', %L)$$, pg_temp.rid('f:rf9'), pg_temp.guest())), 'almar:not_owner', 'void refund: not the owner');
select is(pg_temp.err(format($$select public.ops_void_refund(%L, 'ab', %L)$$, pg_temp.rid('f:rf9'), pg_temp.owner_id())), 'almar:invalid:reason', 'void refund: a reason of 2 characters is invalid');
select is(pg_temp.err(format($$select public.ops_void_refund(%L, 'Typed in error', %L)$$, 987654321, pg_temp.owner_id())), 'almar:not_found', 'void refund: an unknown id is not_found');
select pg_temp.rvd('rf9', pg_temp.rid('f:rf9'));
select is(pg_temp.r('x:rf9', 'first_time') || '/' || pg_temp.r('x:rf9', 'refunded_fils') || '/' || pg_temp.r('x:rf9', 'attention_raised'), 'true/0/false',
          'void refund: voided, refunded_fils back to 0, nothing flagged');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v from t_res where k = 'x:rf9')) k),
          array['amount_fils', 'attention_raised', 'booking_id', 'first_time', 'flags', 'paid_fils', 'ref', 'refund_id', 'refunded_fils'],
          'void refund: the answer has exactly its keys');
select ok((select x.status = 'voided' and x.void_reason = 'Typed in error' and x.voided_by = pg_temp.owner_id() and x.voided_at is not null
              and x.amount_fils = 30000 and x.method = 'bank_transfer'
             from public.booking_refunds x where x.id = pg_temp.rid('f:rf9')),
          'void refund: the row is kept, voided, with who, when and why (B-25)');
select is(pg_temp.st('rf9') || '/' || (pg_temp.b('rf9')).paid_fils::text, 'deposit_paid/94500', 'void refund: status and paid_fils unchanged');
select is(pg_temp.ev('rf9', 'refund_voided'), 1, 'void refund: one refund_voided event');
select pg_temp.rvd('rf9', pg_temp.rid('f:rf9'), 'Another words');
select is(pg_temp.r('x:rf9', 'first_time') || '/' || pg_temp.ev('rf9', 'refund_voided')::text, 'false/1', 'void refund: a second void is first_time false and writes no second event');
select is(pg_temp.err(format($$select public.ops_void_refund(%L, 'Typed in error', %L)$$, (select id from public.booking_refunds where stripe_refund_id = 'stripe-ref-os1'), pg_temp.owner_id())),
          'almar:not_voidable', 'void refund: a card row is not_voidable');
select pg_temp.rfd('rf9', 94500);
select is((pg_temp.b('rf9')).refunded_fils, 94500::bigint, 'void refund: and a voided amount can be refunded again (refundable is back)');

-- Attention raised again on a void.
select pg_temp.rvd('rf4', pg_temp.rid('f:rf4'));
select is(pg_temp.r('x:rf4', 'attention_raised') || '/' || (pg_temp.b('rf4')).attention_reason || '/' || (pg_temp.fl('rf4') ->> 'overpaid'), 'true/overpaid/true',
          'void refund: voiding the refund that cleared overpaid raises it again');
select ok((select e.detail ->> 'reason' = 'overpaid' and e.detail ->> 'refund_id' = pg_temp.rid('f:rf4')::text
             from public.booking_events e where e.booking_id = pg_temp.bid('rf4') and e.action = 'needs_attention' order by e.id desc limit 1),
          'void refund: with a needs_attention event naming the reason and the refund');

-- F. booking_view and ops_get_booking ---------------------------------------------------------------------------------
select is(pg_temp.bv('rf1') -> 'refunds' -> 0 ->> 'amount_fils', '20000', 'view: the first refund shows its amount');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys(pg_temp.bv('rf1') -> 'refunds' -> 0) k), array['amount_fils', 'refunded_on'],
          'view: a refund has exactly the keys refunded_on and amount_fils');
select is(jsonb_array_length(pg_temp.bv('rf1') -> 'refunds'), 2, 'view: both succeeded refunds are listed');
select is(jsonb_array_length(pg_temp.bv('rf9') -> 'refunds'), 1, 'view: a voided refund is left out (rf9 has one succeeded after the re-refund)');
select ok(pg_temp.bv('rf1')::text not like '%REF-rf1%' and pg_temp.bv('rf1')::text not like '%Guest asked%' and pg_temp.bv('rf9')::text not like '%Typed in error%',
          'view: the whole answer holds no bank reference, no reason and no void reason (T-05-04)');
select is(pg_temp.bv('rf1') #>> '{money,refunded_fils}' || '/' || (pg_temp.bv('rf1') #>> '{money,paid_fils}'), '94500/94500', 'view: money.refunded_fils beside paid_fils');
insert into t_res values ('G9', jsonb_build_object('d', public.ops_get_booking(pg_temp.r('rf9', 'ref'))));
select is(jsonb_array_length((select v -> 'd' -> 'refunds' from t_res where k = 'G9')), 2, 'owner detail: refunds list every row, voided included');
select ok((select r ->> 'status' = 'voided' and r ->> 'void_reason' = 'Typed in error' and r ->> 'voided_by_email' = 'maria@almarprivatejourney.com'
              and r ->> 'recorded_by_email' = 'maria@almarprivatejourney.com' and r ->> 'bank_reference' = 'REF-rf9' and r ->> 'reason' = 'Guest asked'
              and r ->> 'method' = 'bank_transfer'
             from jsonb_array_elements((select v -> 'd' -> 'refunds' from t_res where k = 'G9')) r where r ->> 'status' = 'voided'),
          'owner detail: a voided row carries both emails, the reason and the bank reference');
select is((select v #>> '{d,refunds,0,status}' from t_res where k = 'G9'), 'succeeded', 'owner detail: newest first');
select is((select v #>> '{d,money,refunded_fils}' from t_res where k = 'G9'), '94500', 'owner detail: money.refunded_fils');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v -> 'd' -> 'refunds' -> 0 from t_res where k = 'G9')) k),
          array['amount_fils', 'bank_reference', 'created_at', 'id', 'method', 'reason', 'recorded_by', 'recorded_by_email', 'refunded_on', 'status',
                'void_reason', 'voided_at', 'voided_by', 'voided_by_email'],
          'owner detail: a refund row has exactly the OwnerRefund keys');

-- G. ops_record_payment and ops_void_payment as replaced -------------------------------------------------------------
select pg_temp.mkq('rp1');
select pg_temp.rec('rp1', 94500);
select pg_temp.rec('rp1', 220500);
select pg_temp.rfd('rp1', 100000);
select pg_temp.rec('rp1', 100000);
select is((pg_temp.b('rp1')).needs_attention::text || '/' || (pg_temp.b('rp1')).paid_fils::text, 'false/415000',
          'record payment: a late payment after a refund raises no false overpaid (net 315000 is not above the total)');
select is(pg_temp.fl('rp1') ->> 'overpaid', 'false', 'record payment: and booking_flags agrees');
select pg_temp.rec('rp1', 1);
select is((pg_temp.b('rp1')).attention_reason, 'overpaid', 'record payment: one fils more is overpaid on the net');

select pg_temp.mkq('vp1');
select pg_temp.rec('vp1', 94500);
select pg_temp.rfd('vp1', 50000);
select is(pg_temp.err(format($$select public.ops_void_payment(%L, 'Typed in error', %L)$$, pg_temp.pid('p:vp1'), pg_temp.owner_id())), 'almar:refund_first',
          'void payment: leaving refunds above what was paid is refund_first (B-31)');
select is((select status from public.booking_payments where id = pg_temp.pid('p:vp1')) || '/' || (pg_temp.b('vp1')).paid_fils::text, 'succeeded/94500',
          'void payment: and nothing changed');
select pg_temp.rvd('vp1', pg_temp.rid('f:vp1'));
select is(pg_temp.err(format($$select public.ops_void_payment(%L, 'Typed in error', %L)$$, pg_temp.pid('p:vp1'), pg_temp.owner_id())), 'ok',
          'void payment: once the refund is voided the payment can be voided');

-- Voiding a payment on a cancelled booking compares paid minus refunded (the money flag).
select pg_temp.mkq('vp2');
select public.ops_set_booking_status(pg_temp.bid('vp2'), 'cancelled', 'awaiting_payment', pg_temp.owner_id());
select pg_temp.rec('vp2', 94500);
select pg_temp.rec('vp2', 10000);
select pg_temp.rfd('vp2', 10000);
select public.ops_void_payment(pg_temp.pid('p:vp2'), 'Typed in error', pg_temp.owner_id());
select is((pg_temp.b('vp2')).paid_fils::text || '/' || (pg_temp.b('vp2')).refunded_fils::text || '/' || (pg_temp.b('vp2')).attention_reason,
          '94500/10000/paid_after_cancel', 'void payment: net of refunds above 0 keeps paid_after_cancel');

-- Late payment on a cancelled booking that already has a refund: paid_after_cancel stays over overpaid.
select pg_temp.mkq('lc1');
select public.ops_set_booking_status(pg_temp.bid('lc1'), 'cancelled', 'awaiting_payment', pg_temp.owner_id());
select pg_temp.rec('lc1', 94500);
select pg_temp.rfd('lc1', 94500);
select pg_temp.rec('lc1', 400000, '{"expected_status": "cancelled"}');
select is((pg_temp.b('lc1')).needs_attention::text || '/' || (pg_temp.b('lc1')).attention_reason, 'true/paid_after_cancel',
          'record payment: a late payment on a cancelled booking with a refund is paid_after_cancel, not overpaid');

-- H. ops_create_booking, the agreed reason (P5-02) ------------------------------------------------------------------
select pg_temp.stash('ag1', pg_temp.agr(pg_temp.opsn('ag1'), 'Negotiated with the guest'));
select pg_temp.go('ag1');
select ok((select e.detail ->> 'agreed_reason' = 'Negotiated with the guest' and e.detail ->> 'agreed_nights_fils' = '300000'
              and e.detail ->> 'source' = 'ops' and e.actor = 'owner:' || pg_temp.owner_id()::text
             from public.booking_events e where e.booking_id = pg_temp.bid('o:ag1') and e.action = 'created'),
          'agreed: the reason and the agreed nights total are in the created event');
select is((select b.nights_snapshot -> 0 ->> 'source' from public.bookings b where b.id = pg_temp.bid('o:ag1')), 'agreed', 'agreed: the nights are stored with source agreed');
select is((select b.nights_fils from public.bookings b where b.id = pg_temp.bid('o:ag1')), 300000::bigint, 'agreed: and the sums were still checked by booking_write');
select is(pg_temp.go('ag1') ->> 'booking_id', pg_temp.r('o:ag1', 'booking_id'), 'agreed: a replay of the same request id answers the same booking');
select is(pg_temp.ev('o:ag1', 'created'), 1, 'agreed: and writes no second event');
select pg_temp.stash('ag2', pg_temp.agr(pg_temp.opsn('ag2')));
select is(pg_temp.err($$select pg_temp.go('ag2')$$), 'almar:invalid:agreed_reason', 'agreed: agreed nights without a reason are invalid');
select pg_temp.stash('ag3', pg_temp.agr(pg_temp.opsn('ag3'), 'ab'));
select is(pg_temp.err($$select pg_temp.go('ag3')$$), 'almar:invalid:agreed_reason', 'agreed: a reason of 2 characters is invalid');
select pg_temp.stash('ag4', jsonb_set(pg_temp.agr(pg_temp.opsn('ag4'), 'Mixed sources'), '{nights_snapshot,0,source}', '"base"'));
select is(pg_temp.err($$select pg_temp.go('ag4')$$), 'almar:invalid:nights_snapshot', 'agreed: some nights agreed and some not is invalid');
select pg_temp.stash('ag5', pg_temp.opsn('ag5') || '{"agreed_reason": "No agreed price here"}');
select is(pg_temp.err($$select pg_temp.go('ag5')$$), 'almar:invalid:agreed_reason', 'agreed: a reason on a booking at the stay''s rates is invalid');
select is((select count(*)::int from public.bookings where email in ('ag2@os.example.com', 'ag3@os.example.com', 'ag4@os.example.com', 'ag5@os.example.com')), 0,
          'agreed: and the four refusals left no booking');
select pg_temp.stash('ag6', pg_temp.opsn('ag6'));
select pg_temp.go('ag6');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select e.detail from public.booking_events e
             where e.booking_id = pg_temp.bid('o:ag6') and e.action = 'created')) k),
          array['due_now_fils', 'hold_until', 'is_test', 'plan', 'source'], 'agreed: a booking at the stay''s rates has the same created detail as before');

-- I. ops_home_numbers (P5-08) ---------------------------------------------------------------------------------------
-- The owner's window set, so a real booking going back to awaiting_payment can be voided.
update public.booking_bank_details set transfer_window_minutes = 120 where id = 1;
select pg_temp.mkh('h1', false);                -- real hand-made, deposit plan
select pg_temp.mkh('h2', true);                 -- TEST hand-made: left out everywhere
select pg_temp.mk('h3', 'deposit', false);      -- a real web hold never requested: left out
select pg_temp.mkq('h4', 'deposit', false);     -- a real request that lapses unpaid: counted, not outstanding
select pg_temp.past('h4', interval '5 minutes');
select pg_temp.mkh('h5', false);                -- real hand-made, a payment that is voided
select pg_temp.rec('h1', 94500);
select pg_temp.rfd('h1', 10000);
select pg_temp.rfd('h1', 5000);
select pg_temp.rvd('h1x', pg_temp.rid('f:h1'));
select pg_temp.rec('h2', 94500);
select pg_temp.rec('h5', 50000);
select public.ops_void_payment(pg_temp.pid('p:h5'), 'Typed in error', pg_temp.owner_id());
insert into t_res values ('hn', public.ops_home_numbers(pg_temp.d(0), pg_temp.d(0)));
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v from t_res where k = 'hn')) k),
          array['bookings', 'from', 'outstanding_count', 'outstanding_fils', 'received_fils', 'recorded_fils', 'refunded_fils', 'to'],
          'home: the answer has exactly its keys');
select is(pg_temp.r('hn', 'bookings'), '3', 'home: bookings are the real hand-made and requested ones (h1, h4, h5), TEST and an unrequested hold left out');
select is(pg_temp.r('hn', 'received_fils'), '94500', 'home: received counts the succeeded bank payment of h1, not the voided one or the TEST one');
select is(pg_temp.r('hn', 'refunded_fils'), '10000', 'home: refunded counts the refund that stands, not the voided one');
select is(pg_temp.r('hn', 'recorded_fils'), '84500', 'home: recorded is received minus refunded');
select is(pg_temp.r('hn', 'outstanding_fils') || '/' || pg_temp.r('hn', 'outstanding_count'), '535500/2',
          'home: outstanding is h1 (220500, a refund never raises it) and h5 (315000), not the lapsed h4 or the TEST one');
select is(pg_temp.r('hn', 'from') || '/' || pg_temp.r('hn', 'to'), to_char(pg_temp.d(0), 'YYYY-MM-DD') || '/' || to_char(pg_temp.d(0), 'YYYY-MM-DD'), 'home: from and to echo the range');
select is(public.ops_home_numbers(pg_temp.d(10), pg_temp.d(20)) ->> 'outstanding_fils', '535500', 'home: outstanding does not depend on the range');
select is(public.ops_home_numbers(pg_temp.d(10), pg_temp.d(20)) ->> 'bookings', '0', 'home: and a range with no booking counts none');

-- Range edges are Dubai days: a payment received yesterday, a booking made one second before midnight yesterday.
update public.booking_payments set received_on = pg_temp.d(-1) where id = pg_temp.pid('p:h1');
select is(public.ops_home_numbers(pg_temp.d(0), pg_temp.d(0)) ->> 'received_fils' || '/' || (public.ops_home_numbers(pg_temp.d(0), pg_temp.d(0)) ->> 'recorded_fils'),
          '0/-10000', 'home: recorded may go negative (a refund in a range with no payment)');
select is(public.ops_home_numbers(pg_temp.d(-1), pg_temp.d(-1)) ->> 'received_fils', '94500', 'home: the payment is in yesterday''s range by its received_on');
update public.bookings set created_at = ((pg_temp.d(-1)::timestamp + time '23:59:59') at time zone 'Asia/Dubai') where id = pg_temp.bid('h5');
select is(public.ops_home_numbers(pg_temp.d(0), pg_temp.d(0)) ->> 'bookings', '2', 'home: a booking made at 23:59:59 yesterday (Dubai) is not in today''s range');
select is(public.ops_home_numbers(pg_temp.d(-1), pg_temp.d(-1)) ->> 'bookings', '1', 'home: it is in yesterday''s');
select is(public.ops_home_numbers(pg_temp.d(-1), pg_temp.d(0)) ->> 'bookings', '3', 'home: and a range of both days holds all three');
select is(pg_temp.err($$select public.ops_home_numbers(null, current_date)$$), 'almar:invalid:from', 'home: a null from is invalid');
select is(pg_temp.err($$select public.ops_home_numbers(current_date, null)$$), 'almar:invalid:to', 'home: a null to is invalid');
select is(pg_temp.err($$select public.ops_home_numbers(current_date + 1, current_date)$$), 'almar:invalid:to', 'home: a reversed range is invalid');
select is(pg_temp.err($$select public.ops_home_numbers(current_date - 3661, current_date)$$), 'almar:invalid:range', 'home: over 3660 days is invalid');
select is(pg_temp.err($$select public.ops_home_numbers(current_date - 3660, current_date)$$), 'ok', 'home: exactly 3660 days is allowed');

-- J. ops_list_customers (P5-09) -------------------------------------------------------------------------------------
-- Customers so far: h1, h4, h5 (real). New: c1 twice (same email), c2; left out: a TEST one and an unrequested hold.
select pg_temp.mkh('c1a', false, 'deposit', '{"guest_name": "Old Name", "phone": "+971500000001"}', 'c1@os.example.com');
update public.bookings set created_at = now() - interval '2 days' where id = pg_temp.bid('c1a');
select pg_temp.mkh('c1b', false, 'deposit', '{"guest_name": "Ana Nombre", "phone": "+971500000002"}', 'c1@os.example.com');
select pg_temp.mkh('c2', false, 'deposit', '{"guest_name": "José Pérez", "phone": "+971509990000"}');
select pg_temp.mkh('ct', true, 'deposit', '{"guest_name": "Only Test"}');
select pg_temp.mk('cab', 'deposit', false, 'os-stay-one', '{"guest_name": "Only Hold"}');
insert into t_res values ('cl', public.ops_list_customers());
select is((select array_agg(i ->> 'email' order by o) from jsonb_array_elements((select v -> 'items' from t_res where k = 'cl')) with ordinality as t(i, o)),
          array['c2@os.example.com', 'c1@os.example.com', 'h5@os.example.com', 'h4@os.example.com', 'h1@os.example.com'],
          'customers: one row per email, newest arrival first; TEST and an unrequested hold are not customers');
select is((select array_agg(k order by k collate "C") from jsonb_object_keys((select v #> '{items,0}' from t_res where k = 'cl')) k),
          array['bookings', 'email', 'last_arrive', 'name', 'phone'], 'customers: a row has exactly its keys');
select is((select v -> 'next' from t_res where k = 'cl'), 'null'::jsonb, 'customers: the last page has next null');
select ok((select i ->> 'name' = 'Ana Nombre' and i ->> 'phone' = '+971500000002' and (i ->> 'bookings')::int = 2
              and i ->> 'last_arrive' = to_char((select max(b.arrive) from public.bookings b where b.email = 'c1@os.example.com'), 'YYYY-MM-DD')
             from jsonb_array_elements((select v -> 'items' from t_res where k = 'cl')) i where i ->> 'email' = 'c1@os.example.com'),
          'customers: name and phone from the newest booking, two bookings, the latest arrival');
select is(jsonb_array_length(public.ops_list_customers('jose perez') -> 'items'), 1, 'customers: search is folded (accents and case)');
select is(public.ops_list_customers('old name') #>> '{items,0,email}', 'c1@os.example.com', 'customers: search finds any name of the group, not only the newest');
select is(public.ops_list_customers('9990000') #>> '{items,0,email}', 'c2@os.example.com', 'customers: search finds a phone');
select is(public.ops_list_customers('C1@OS.example') #>> '{items,0,email}', 'c1@os.example.com', 'customers: search finds the email');
select is(jsonb_array_length(public.ops_list_customers('no such guest') -> 'items'), 0, 'customers: no match is an empty list');
select is(public.ops_list_customers(null, null, 2) ->> 'next', '2', 'customers: a page of 2 has next 2');
select is((select array_agg(i ->> 'email' order by o) from jsonb_array_elements(public.ops_list_customers(null, '2', 2) -> 'items') with ordinality as t(i, o)),
          array['h5@os.example.com', 'h4@os.example.com'], 'customers: the second page continues without a repeat');
select is(public.ops_list_customers(null, '4', 2) ->> 'next' is null and jsonb_array_length(public.ops_list_customers(null, '4', 2) -> 'items') = 1, true,
          'customers: the last page holds the rest and has no next');
select is(pg_temp.err($$select public.ops_list_customers(repeat('a', 101))$$), 'almar:invalid:q', 'customers: a search over 100 characters is invalid');
select is(pg_temp.err($$select public.ops_list_customers(null, 'x')$$), 'almar:invalid:after', 'customers: a bad after is invalid');
select is(pg_temp.err($$select public.ops_list_customers(null, null, 0)$$), 'almar:invalid:limit', 'customers: a limit of 0 is invalid');
select is(pg_temp.err($$select public.ops_list_customers(null, null, 61)$$), 'almar:invalid:limit', 'customers: a limit of 61 is invalid');

select * from finish();
rollback;
