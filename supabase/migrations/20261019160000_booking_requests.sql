-- Phase 4 plan 04-08: request to book, paid by bank transfer (owner signed 2026-10-19 16:18 CET; B-23..B-35 of
-- 04-CONTEXT.md; the owner's plan-gate answers of 2026-10-20 in .planning/decisions/2026-10-20-phase-4-rule-signatures.md).
-- Number 20261019160000 reserved and granted by the controller. One file: part A (schema, the owner's bank details and
-- transfer window, the request gate, the guest's request and withdraw, the baked calendar, the guest's reads), then
-- part B (record and void a transfer, resolve, notes, the owner's list and detail, the lapse and its email claim).
-- Part A is 04-08 Task 1; Task 2 appends part B (the trigger and the ops_lapse_holds replacement named below are in it).
--
-- A work session never applies this file: only the controller applies it to the live project, after
-- 20261019120000_owner_emails.sql, on the owner's word. It depends only on objects that are live (20260925120000 ...
-- 20261019120000). Local apply is `node tests/helpers/local-supabase.mjs reset`.
--
-- Safe on live data: it adds nullable or defaulted columns (no table rewrite); it replaces four inline checks by a plain
-- drop, then the new check added `not valid` and validated in its own statement (a different live name stops the apply
-- instead of leaving the old rule in place); it creates three empty owner-only tables and one singleton row of nulls;
-- it adds functions and one trigger; it replaces public_booked_nights and ops_lapse_holds with the same signatures and
-- the same grants. Nothing is deleted, nothing existing is rewritten.
--
-- Rules the whole file follows (those of 20261005110000):
--   * Every new table: RLS on, every privilege revoked from public, anon and authenticated, no policy. Only the service
--     role (a Worker, after its own token / session / owner check) reads or writes them.
--   * Every new function: definer rights, search_path '', schema-qualified names, execute revoked from public, anon and
--     authenticated and granted to the service role with its exact signature. public_booked_nights keeps the public
--     grant it had (the anonymous build reads it); nothing else here is callable without the service role.
--   * Owner-side refusals are raised as SQLSTATE P0001, message 'almar:<code>' (public.booking_fail); guest-side
--     functions answer { ok: false, reason } for an expected refusal and raise almar:invalid for a malformed call.
--   * Lock order, everywhere: the per-stay advisory lock, then the booking row (public.booking_lock), then its nights
--     and payments.
--   * Money is bigint fils (AED has 2 decimals); percentages are basis points. No name a TypeScript file will type
--     contains the letters r, e, underscore in a row (tests/phase-02-gates.test.mjs).
--   * Times in answers are ISO UTC text with milliseconds, like create_web_booking.

-- ============================================================================================================
-- PART A
-- ============================================================================================================

-- ------------------------------------------------------------------------------------------------------------
-- Columns on bookings
-- ------------------------------------------------------------------------------------------------------------

-- requested_at: when the guest sent the request (held -> awaiting_payment). After it, hold_expires_at is the pay-by
-- deadline. written_off_fils: the sum of the write-offs of the booking's succeeded rows (Accept as paid, B-33).
-- attention_reason: why needs_attention is set. A request with a recorded payment never lapses (P-09): past its
-- deadline it is flagged deadline_passed_part_paid. The lapse_email_* columns are the cron's claim on the lapse email.
alter table public.bookings
  add column if not exists requested_at timestamptz,
  add column if not exists written_off_fils bigint not null default 0 check (written_off_fils >= 0),
  add column if not exists attention_reason text check (attention_reason in ('paid_after_expiry', 'paid_after_cancel', 'overpaid', 'deadline_passed_part_paid')),
  add column if not exists lapse_email_claimed_at timestamptz,
  add column if not exists lapse_email_sent_at timestamptz,
  add column if not exists lapse_email_attempts int not null default 0 check (lapse_email_attempts >= 0);

alter table public.bookings
  add constraint bookings_attention_pair check (needs_attention or attention_reason is null) not valid;
alter table public.bookings validate constraint bookings_attention_pair;

-- ------------------------------------------------------------------------------------------------------------
-- booking_payments: bank rows (P-03). kind 'transfer', method 'bank_transfer', written succeeded at once. method
-- defaults to 'card', the truthful value for every older row.
-- ------------------------------------------------------------------------------------------------------------

alter table public.booking_payments
  add column if not exists method text not null default 'card' check (method in ('card', 'bank_transfer')),
  add column if not exists bank_reference text check (char_length(bank_reference) between 1 and 100),
  add column if not exists received_on date,
  add column if not exists recorded_by uuid,
  add column if not exists request_id uuid,
  add column if not exists write_off_fils bigint not null default 0 check (write_off_fils >= 0),
  add column if not exists write_off_reason text check (char_length(write_off_reason) between 3 and 300),
  add column if not exists void_reason text check (char_length(void_reason) between 3 and 300),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid;

-- The owner's dialog makes request_id when it opens: the same id twice is one row. Nulls never collide (card rows).
alter table public.booking_payments add constraint booking_payments_request_id_key unique (request_id);

-- The four inline checks of 20261005110000, replaced (Postgres' default names of those checks).
alter table public.booking_payments drop constraint booking_payments_kind_check;
alter table public.booking_payments
  add constraint booking_payments_kind_check check (kind in ('deposit', 'full', 'balance', 'transfer')) not valid;
alter table public.booking_payments validate constraint booking_payments_kind_check;

alter table public.booking_payments drop constraint booking_payments_status_check;
alter table public.booking_payments
  add constraint booking_payments_status_check check (status in ('open', 'succeeded', 'expired', 'failed', 'voided')) not valid;
alter table public.booking_payments validate constraint booking_payments_status_check;

-- P-04: a bank row may be any amount from 1 fils; the 2.00 AED floor stays for card rows only.
alter table public.booking_payments drop constraint booking_payments_amount_fils_check;
alter table public.booking_payments
  add constraint booking_payments_amount_fils_check check (amount_fils >= 200 or (method = 'bank_transfer' and amount_fils >= 1)) not valid;
alter table public.booking_payments validate constraint booking_payments_amount_fils_check;

-- A bank row carries what the owner typed, and only the two statuses a bank row can have.
alter table public.booking_payments
  add constraint booking_payments_transfer_fields check (
    method <> 'bank_transfer' or (
      kind = 'transfer' and status in ('succeeded', 'voided') and received_on is not null and recorded_by is not null
      and request_id is not null and bank_reference is not null)
  ) not valid;
alter table public.booking_payments validate constraint booking_payments_transfer_fields;

-- A voided row says when, by whom and why; no other row does.
alter table public.booking_payments
  add constraint booking_payments_voided_fields check (
    (status = 'voided') = (voided_at is not null and voided_by is not null and void_reason is not null)
  ) not valid;
alter table public.booking_payments validate constraint booking_payments_voided_fields;

-- The twelve live actions of 20261005110000 (resend_requested is the one the dashboard's resend writes; email_resent
-- stays allowed and nothing writes it) plus the eight of this plan: 20 actions (email_unknown: a send that timed out,
-- which may still have been delivered).
alter table public.booking_events drop constraint booking_events_action_check;
alter table public.booking_events
  add constraint booking_events_action_check check (action in (
    'created', 'status', 'hold_expired', 'payment', 'refund', 'dispute', 'email_sent', 'email_resent', 'email_failed',
    'needs_attention', 'resend_requested', 'checkout_not_closed',
    'request_sent', 'payment_recorded', 'payment_voided', 'note_added', 'attention_resolved', 'email_pending',
    'request_withdrawn', 'email_unknown')) not valid;
alter table public.booking_events validate constraint booking_events_action_check;

-- ------------------------------------------------------------------------------------------------------------
-- Owner-only tables. Outside site_settings on purpose: site_settings has a public row policy and column grants for
-- the build (20261013120000), and these values never reach the public site.
-- ------------------------------------------------------------------------------------------------------------

-- The owner's bank details and transfer window (P-02, P-07, B-30). One row; every value null until the owner saves it.
-- No currency column: AED is fixed (B-30).
create table public.booking_bank_details (
  id int primary key default 1 check (id = 1),
  account_name text check (char_length(account_name) between 1 and 120),
  bank_name text check (char_length(bank_name) between 1 and 120),
  iban text check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  swift text check (swift ~ '^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$'),
  bank_address text check (char_length(bank_address) between 1 and 300),
  note_en text check (char_length(note_en) between 1 and 300),
  note_ar text check (char_length(note_ar) between 1 and 300),
  note_es text check (char_length(note_es) between 1 and 300),
  transfer_window_minutes int check (transfer_window_minutes between 35 and 43200),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

insert into public.booking_bank_details (id) values (1) on conflict (id) do nothing;

-- Who changed which money setting, when (P-15): field names only, never a value.
create table public.booking_money_settings_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid not null,
  changed text[] not null
);

-- The owner's notes on a booking. Append-only; the guest never sees them. request_id is the id the note composer makes
-- (ops_add_booking_note): the same id twice is one row. The attention note (ops_resolve_attention) has none; nulls never
-- collide.
create table public.booking_notes (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  body text not null check (char_length(body) between 1 and 2000 and btrim(body) <> ''),
  request_id uuid,
  constraint booking_notes_request_id_key unique (request_id)
);

create index booking_notes_booking_idx on public.booking_notes (booking_id, at);

-- The open-request cap counts these rows per email.
create index bookings_requested_email_idx on public.bookings (email) where status = 'awaiting_payment' and source = 'web';

alter table public.booking_bank_details enable row level security;
alter table public.booking_money_settings_log enable row level security;
alter table public.booking_notes enable row level security;

revoke all on public.booking_bank_details from public, anon, authenticated;
revoke all on public.booking_money_settings_log from public, anon, authenticated;
revoke all on public.booking_notes from public, anon, authenticated;
revoke all on sequence public.booking_money_settings_log_id_seq from public, anon, authenticated;
revoke all on sequence public.booking_notes_id_seq from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------------------
-- Helpers
-- ------------------------------------------------------------------------------------------------------------

-- The owner check every owner write repeats in SQL: a profile with role 'owner' (the check save_site_settings makes).
create or replace function public.booking_assert_owner(p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_actor is null or not exists (select 1 from public.profiles pr where pr.id = p_actor and pr.role = 'owner') then
    perform public.booking_fail('not_owner');
  end if;
end;
$$;

revoke execute on function public.booking_assert_owner(uuid) from public, anon, authenticated;
grant execute on function public.booking_assert_owner(uuid) to service_role;

-- IBAN (ISO 13616) on a normalized value (no spaces, upper case): the shape, then mod 97 = 1 after moving the first
-- four characters to the end and writing each letter as two digits (A = 10 .. Z = 35). numeric is exact here.
create or replace function public.booking_iban_ok(p text)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_moved text;
  v_digits text := '';
  v_ch text;
  v_i int;
begin
  if p is null or p !~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' then
    return false;
  end if;
  v_moved := substr(p, 5) || substr(p, 1, 4);
  for v_i in 1..char_length(v_moved) loop
    v_ch := substr(v_moved, v_i, 1);
    if ascii(v_ch) >= 65 then
      v_digits := v_digits || (ascii(v_ch) - 55)::text;
    else
      v_digits := v_digits || v_ch;
    end if;
  end loop;
  return mod(v_digits::numeric, 97) = 1;
end;
$$;

revoke execute on function public.booking_iban_ok(text) from public, anon, authenticated;
grant execute on function public.booking_iban_ok(text) to service_role;

-- BIC (ISO 9362) on a normalized value: 8 or 11 characters, bank, country, location, optional branch.
create or replace function public.booking_bic_ok(p text)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select coalesce(p ~ '^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$', false)
$$;

revoke execute on function public.booking_bic_ok(text) from public, anon, authenticated;
grant execute on function public.booking_bic_ok(text) to service_role;

-- P-08: complete = account name, bank, IBAN, SWIFT, bank address AND the English note line.
create or replace function public.booking_bank_complete()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select d.account_name is not null and d.bank_name is not null and d.iban is not null and d.swift is not null
       and d.bank_address is not null and d.note_en is not null
    from public.booking_bank_details d
    where d.id = 1), false)
$$;

revoke execute on function public.booking_bank_complete() from public, anon, authenticated;
grant execute on function public.booking_bank_complete() to service_role;

-- The transfer window in minutes: 35 for a TEST booking (P-06: the floor, whatever the owner set), else the owner's
-- window, null while it is not set (requests closed).
create or replace function public.booking_window_minutes(p_is_test boolean)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_is_test then 35
    else (select d.transfer_window_minutes from public.booking_bank_details d where d.id = 1)
  end
$$;

revoke execute on function public.booking_window_minutes(boolean) from public, anon, authenticated;
grant execute on function public.booking_window_minutes(boolean) to service_role;

-- The status rule (section C of 04-08): record and void both use it, and 04-09's preview mirrors it. settled = paid +
-- written off. Only awaiting_payment, deposit_paid and paid_in_full move; every other status is returned unchanged.
create or replace function public.booking_next_status(p_status text, p_plan text, p_grand bigint, p_deposit bigint, p_settled bigint)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when p_status in ('awaiting_payment', 'deposit_paid', 'paid_in_full') then
      case
        when p_settled >= p_grand then 'paid_in_full'
        when p_plan = 'deposit' and p_settled >= p_deposit then 'deposit_paid'
        else 'awaiting_payment'
      end
    else p_status
  end
$$;

revoke execute on function public.booking_next_status(text, text, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.booking_next_status(text, text, bigint, bigint, bigint) to service_role;

-- The flags of one booking (section B "flags"). booking_view takes part_received, overpaid and written_off from here,
-- so the guest and the owner never disagree. balance_overdue uses the Dubai date.
create or replace function public.booking_flags(b public.bookings)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_settled bigint;
  v_target bigint;
  v_due bigint := 0;
  v_still bigint := 0;
begin
  if b.id is null then
    return null;
  end if;
  v_settled := b.paid_fils + b.written_off_fils;
  v_target := case when b.plan = 'deposit' then b.deposit_fils else b.grand_fils end;
  if b.status = 'awaiting_payment' then
    v_due := greatest(0, v_target - v_settled);
  elsif b.status in ('deposit_paid', 'confirmed', 'completed') then
    v_due := greatest(0, b.grand_fils - v_settled);
  end if;
  if b.status in ('awaiting_payment', 'deposit_paid', 'paid_in_full', 'confirmed', 'completed') then
    v_still := greatest(0, b.grand_fils - v_settled);
  end if;
  return jsonb_build_object(
    'needs_attention', b.needs_attention,
    'attention_reason', b.attention_reason,
    'part_received', (b.status = 'awaiting_payment' and b.paid_fils > 0),
    'overpaid', (b.paid_fils > b.grand_fils),
    'written_off', (b.written_off_fils > 0),
    'settled_fils', v_settled,
    'due_now_fils', v_due,
    'still_due_fils', v_still,
    'balance_overdue', coalesce(
      (now() at time zone 'Asia/Dubai')::date > b.balance_due_date
      and v_settled < b.grand_fils
      and b.status in ('deposit_paid', 'confirmed'), false),
    'deadline_passed', coalesce(b.status in ('held', 'awaiting_payment') and b.hold_expires_at < now(), false));
end;
$$;

revoke execute on function public.booking_flags(public.bookings) from public, anon, authenticated;
grant execute on function public.booking_flags(public.bookings) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- The gate's database half and the owner's money settings
-- ------------------------------------------------------------------------------------------------------------

-- What the request gate reads from the database (the route adds the terms, the link secret and the email sender).
-- Never a bank value.
create or replace function public.booking_gate()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'window_minutes', public.booking_window_minutes(false),
    'bank_complete', public.booking_bank_complete(),
    'settings_present', exists (
      select 1 from public.site_settings s
      where s.id = 1 and s.vat_percent is not null and s.deposit_percent is not null))
$$;

revoke execute on function public.booking_gate() from public, anon, authenticated;
grant execute on function public.booking_gate() to service_role;

-- The owner's money settings as the dashboard shows them (owner route only, after requireOwner).
create or replace function public.ops_get_money_settings()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'transfer_window_minutes', d.transfer_window_minutes,
    'balance_due_days', (select s.balance_due_days from public.site_settings s where s.id = 1),
    'bank', jsonb_build_object(
      'account_name', d.account_name,
      'bank_name', d.bank_name,
      'iban', d.iban,
      'swift', d.swift,
      'bank_address', d.bank_address,
      'note_en', d.note_en,
      'note_ar', d.note_ar,
      'note_es', d.note_es),
    'bank_complete', public.booking_bank_complete(),
    'updated_at', to_char(d.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updated_by', d.updated_by)
  from public.booking_bank_details d
  where d.id = 1
$$;

revoke execute on function public.ops_get_money_settings() from public, anon, authenticated;
grant execute on function public.ops_get_money_settings() to service_role;

-- One money Save is one transaction: the bank details and window (booking_bank_details), balance due days
-- (site_settings row 1, its first writer) and one log row of the changed field names. p = any of
-- transfer_window_minutes (35..43200 or null), balance_due_days (0..365 or null), bank (the six required keys present,
-- each a string or null / '' to clear; note_ar and note_es optional). Unknown keys are refused by name. IBAN and SWIFT
-- are stored normalized (no spaces, upper case) and checked again here. P-16: a changed English note without new
-- Arabic / Spanish clears them, so readers fall back to English instead of a stale translation; an unchanged note with
-- the two absent keeps them. Returns what ops_get_money_settings returns.
create or replace function public.ops_save_money_settings(p jsonb, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_top constant text[] := array['transfer_window_minutes', 'balance_due_days', 'bank'];
  c_bank constant text[] := array['account_name', 'bank_name', 'iban', 'swift', 'bank_address', 'note_en', 'note_ar', 'note_es'];
  c_bank_required constant text[] := array['account_name', 'bank_name', 'iban', 'swift', 'bank_address', 'note_en'];
  v_key text;
  v_bank jsonb;
  v_cur public.booking_bank_details;
  v_new public.booking_bank_details;
  v_days int;
  v_days_old int;
  v_changed text[] := array[]::text[];
begin
  perform public.booking_assert_owner(p_actor);
  if jsonb_typeof(p) is distinct from 'object' then
    perform public.booking_fail('invalid', 'payload');
  end if;
  for v_key in select jsonb_object_keys(p) loop
    if not (v_key = any (c_top)) then
      perform public.booking_fail('invalid', v_key);
    end if;
  end loop;
  if not (p ?| c_top) then
    perform public.booking_fail('invalid', 'payload');
  end if;

  insert into public.booking_bank_details (id) values (1) on conflict (id) do nothing;
  select d.* into v_cur from public.booking_bank_details d where d.id = 1 for update;
  v_new := v_cur;

  if p ? 'transfer_window_minutes' then
    if jsonb_typeof(p -> 'transfer_window_minutes') = 'null' then
      v_new.transfer_window_minutes := null;
    else
      v_new.transfer_window_minutes := public.booking_int(p, 'transfer_window_minutes', 35, 43200);
    end if;
  end if;

  if p ? 'balance_due_days' then
    if jsonb_typeof(p -> 'balance_due_days') = 'null' then
      v_days := null;
    else
      v_days := public.booking_int(p, 'balance_due_days', 0, 365);
    end if;
  end if;

  if p ? 'bank' then
    v_bank := p -> 'bank';
    if jsonb_typeof(v_bank) is distinct from 'object' then
      perform public.booking_fail('invalid', 'bank');
    end if;
    for v_key in select jsonb_object_keys(v_bank) loop
      if not (v_key = any (c_bank)) then
        perform public.booking_fail('invalid', v_key);
      end if;
    end loop;
    foreach v_key in array c_bank_required loop
      if not (v_bank ? v_key) then
        perform public.booking_fail('invalid', v_key);
      end if;
    end loop;

    v_new.account_name := public.booking_txt(v_bank, 'account_name', 1, 120, false);
    v_new.bank_name := public.booking_txt(v_bank, 'bank_name', 1, 120, false);
    v_new.iban := public.booking_txt(v_bank, 'iban', 1, 64, false);
    if v_new.iban is not null then
      v_new.iban := upper(regexp_replace(v_new.iban, '\s', '', 'g'));
      if not public.booking_iban_ok(v_new.iban) then
        perform public.booking_fail('invalid', 'iban');
      end if;
    end if;
    v_new.swift := public.booking_txt(v_bank, 'swift', 1, 32, false);
    if v_new.swift is not null then
      v_new.swift := upper(regexp_replace(v_new.swift, '\s', '', 'g'));
      if not public.booking_bic_ok(v_new.swift) then
        perform public.booking_fail('invalid', 'swift');
      end if;
    end if;
    v_new.bank_address := public.booking_txt(v_bank, 'bank_address', 1, 300, false);
    v_new.note_en := public.booking_txt(v_bank, 'note_en', 1, 300, false);
    if v_bank ? 'note_ar' then
      v_new.note_ar := public.booking_txt(v_bank, 'note_ar', 1, 300, false);
    elsif v_new.note_en is distinct from v_cur.note_en then
      v_new.note_ar := null;
    end if;
    if v_bank ? 'note_es' then
      v_new.note_es := public.booking_txt(v_bank, 'note_es', 1, 300, false);
    elsif v_new.note_en is distinct from v_cur.note_en then
      v_new.note_es := null;
    end if;
  end if;

  if v_new.transfer_window_minutes is distinct from v_cur.transfer_window_minutes then
    v_changed := array_append(v_changed, 'transfer_window_minutes');
  end if;
  if v_new.account_name is distinct from v_cur.account_name then
    v_changed := array_append(v_changed, 'account_name');
  end if;
  if v_new.bank_name is distinct from v_cur.bank_name then
    v_changed := array_append(v_changed, 'bank_name');
  end if;
  if v_new.iban is distinct from v_cur.iban then
    v_changed := array_append(v_changed, 'iban');
  end if;
  if v_new.swift is distinct from v_cur.swift then
    v_changed := array_append(v_changed, 'swift');
  end if;
  if v_new.bank_address is distinct from v_cur.bank_address then
    v_changed := array_append(v_changed, 'bank_address');
  end if;
  if v_new.note_en is distinct from v_cur.note_en then
    v_changed := array_append(v_changed, 'note_en');
  end if;
  if v_new.note_ar is distinct from v_cur.note_ar then
    v_changed := array_append(v_changed, 'note_ar');
  end if;
  if v_new.note_es is distinct from v_cur.note_es then
    v_changed := array_append(v_changed, 'note_es');
  end if;

  if p ? 'balance_due_days' then
    -- Row 1 exists (20261005110000 inserts it).
    select s.balance_due_days into v_days_old from public.site_settings s where s.id = 1 for update;
    if v_days is distinct from v_days_old then
      update public.site_settings set balance_due_days = v_days where id = 1;
      v_changed := array_append(v_changed, 'balance_due_days');
    end if;
  end if;

  -- Nothing changed: nothing written, no log row. Otherwise the row carries who saved the money settings last and when
  -- (a change of balance due days alone included), and one log row lists the changed field names.
  if cardinality(v_changed) > 0 then
    update public.booking_bank_details
      set account_name = v_new.account_name,
          bank_name = v_new.bank_name,
          iban = v_new.iban,
          swift = v_new.swift,
          bank_address = v_new.bank_address,
          note_en = v_new.note_en,
          note_ar = v_new.note_ar,
          note_es = v_new.note_es,
          transfer_window_minutes = v_new.transfer_window_minutes,
          updated_at = now(),
          updated_by = p_actor
      where id = 1;
    insert into public.booking_money_settings_log (actor, changed) values (p_actor, v_changed);
  end if;

  return public.ops_get_money_settings();
end;
$$;

revoke execute on function public.ops_save_money_settings(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.ops_save_money_settings(jsonb, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- request_web_booking (B-23, B-27; BOOK-03): the guest's live 30-minute hold becomes a timed request, exactly once.
-- Called by POST /api/booking/request after the signed-link check; p_expect_test comes from the Host, never the body.
-- Under the stay lock: a hold still running (no grace), the window set (35 minutes on a TEST booking) and the bank
-- details complete (else requests_closed), fewer than three other open requests of that email and test flag (P-05,
-- P-20; a part-paid request past its deadline is still open: P-09), then the nights re-held through place_hold to the
-- deadline, status awaiting_payment, one request_sent event. A second call changes nothing and answers first_time
-- false with the stored deadline, so the route sends one email.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.request_web_booking(p_booking uuid, p_expect_test boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_open_per_email constant int := 3;
  v_b public.bookings;
  v_window int;
  v_until timestamptz;
  v_open int;
  v_hold text;
  v_msg text;
  v_due bigint;
begin
  if p_booking is null or p_expect_test is null then
    perform public.booking_fail('invalid');
  end if;
  v_b := public.booking_lock(p_booking);
  if v_b.id is null or v_b.source <> 'web' or v_b.is_test is distinct from p_expect_test then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  -- Already requested: the same answer again, nothing written.
  if v_b.requested_at is not null then
    if v_b.status = 'awaiting_payment' and v_b.paid_fils = 0 and v_b.hold_expires_at < now() - interval '2 minutes' then
      -- Lapsed and not swept yet: the same rule that shows it expired on the booking page.
      return jsonb_build_object('ok', false, 'reason', 'hold_ended');
    elsif v_b.status in ('awaiting_payment', 'deposit_paid', 'paid_in_full', 'confirmed', 'completed') then
      return jsonb_build_object(
        'ok', true,
        'first_time', false,
        'booking_id', v_b.id,
        'ref', v_b.ref,
        'status', v_b.status,
        'deadline', case when v_b.status = 'awaiting_payment'
          then to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
        'window_minutes', (
          select (e.detail ->> 'window_minutes')::int from public.booking_events e
          where e.booking_id = v_b.id and e.action = 'request_sent'
          order by e.id desc limit 1),
        'locale', v_b.locale,
        'is_test', v_b.is_test);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'hold_ended');
  end if;

  if v_b.status <> 'held' or v_b.hold_expires_at is null or v_b.hold_expires_at <= now() then
    return jsonb_build_object('ok', false, 'reason', 'hold_ended');
  end if;

  v_window := public.booking_window_minutes(v_b.is_test);
  if v_window is null or not public.booking_bank_complete() then
    return jsonb_build_object('ok', false, 'reason', 'requests_closed');
  end if;

  -- One email at a time past this point: booking_lock serializes one stay only, so two requests of one email on
  -- two stays could both pass the count. Taken only here, after the one stay lock, so it cannot deadlock.
  perform pg_advisory_xact_lock(hashtextextended('almar-request-email:' || lower(v_b.email), 0));
  select count(*) into v_open
  from public.bookings o
  where o.email = v_b.email
    and o.id <> v_b.id
    and o.source = 'web'
    and o.status = 'awaiting_payment'
    and o.is_test = v_b.is_test
    and (o.paid_fils > 0 or o.hold_expires_at > now());
  if v_open >= c_open_per_email then
    return jsonb_build_object('ok', false, 'reason', 'too_many_open');
  end if;

  v_until := now() + make_interval(mins => v_window);
  begin
    v_hold := public.place_hold(v_b.id, v_b.stay_id, v_b.arrive, v_b.leave, v_until);
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    if v_msg = 'almar:sold_out' then
      return jsonb_build_object('ok', false, 'reason', 'sold_out');
    end if;
    raise;
  end;
  if v_hold <> 'ok' then
    return jsonb_build_object('ok', false, 'reason', v_hold);
  end if;

  update public.bookings
    set status = 'awaiting_payment', requested_at = now(), hold_expires_at = v_until
    where id = v_b.id;

  v_due := case when v_b.plan = 'deposit' then v_b.deposit_fils else v_b.grand_fils end;
  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, 'guest', 'request_sent', 'held', 'awaiting_payment', jsonb_build_object(
    'window_minutes', v_window,
    'deadline', to_char(v_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'plan', v_b.plan,
    'due_now_fils', v_due,
    'is_test', v_b.is_test));

  return jsonb_build_object(
    'ok', true,
    'first_time', true,
    'booking_id', v_b.id,
    'ref', v_b.ref,
    'status', 'awaiting_payment',
    'deadline', to_char(v_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'window_minutes', v_window,
    'locale', v_b.locale,
    'is_test', v_b.is_test);
end;
$$;

revoke execute on function public.request_web_booking(uuid, boolean) from public, anon, authenticated;
grant execute on function public.request_web_booking(uuid, boolean) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- booking_withdraw_request (P-19 as the owner changed it 2026-10-20): the guest withdraws an unpaid request on the
-- booking page, after the route's token or session check. Only a web request in awaiting_payment with nothing paid
-- and its deadline + 2 minutes not passed: cancelled, its nights freed at once, one request_withdrawn event. A
-- request with a payment answers part_paid; every other state not_withdrawable (held is the release route's; an
-- owner-cancelled booking has no request_withdrawn event). A record racing a withdraw serializes on booking_lock.
-- Never place_hold, never a payment row.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.booking_withdraw_request(p_booking uuid, p_expect_test boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
begin
  if p_booking is null or p_expect_test is null then
    perform public.booking_fail('invalid');
  end if;
  v_b := public.booking_lock(p_booking);
  if v_b.id is null or v_b.source <> 'web' or v_b.is_test is distinct from p_expect_test then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_b.status = 'cancelled' and exists (
    select 1 from public.booking_events e where e.booking_id = v_b.id and e.action = 'request_withdrawn'
  ) then
    return jsonb_build_object('ok', true, 'first_time', false, 'ref', v_b.ref, 'status', 'cancelled');
  end if;
  if v_b.status = 'awaiting_payment' and v_b.paid_fils > 0 then
    return jsonb_build_object('ok', false, 'reason', 'part_paid');
  end if;
  if v_b.status <> 'awaiting_payment'
     or coalesce(v_b.hold_expires_at < now() - interval '2 minutes', true) then
    return jsonb_build_object('ok', false, 'reason', 'not_withdrawable');
  end if;

  update public.bookings set status = 'cancelled' where id = v_b.id;
  delete from public.booking_nights where booking_id = v_b.id;
  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, 'guest', 'request_withdrawn', 'awaiting_payment', 'cancelled', jsonb_build_object(
    'plan', v_b.plan,
    'deadline', to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));

  return jsonb_build_object('ok', true, 'first_time', true, 'ref', v_b.ref, 'status', 'cancelled');
end;
$$;

revoke execute on function public.booking_withdraw_request(uuid, boolean) from public, anon, authenticated;
grant execute on function public.booking_withdraw_request(uuid, boolean) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- public_booked_nights, replaced (same signature and grants as 20261005110000; F-06, A10 signed 2026-10-20). The
-- anonymous build bakes this list once per publish, so a web request (hours or days long) is never listed: it would
-- stay baked as booked long after it lapsed or was withdrawn, and a part-paid web request's permanent nights are still
-- a request's (P-09). The live quote reports those nights as sold_out. Listed: permanent nights of every other booking
-- (deposit paid, paid in full, confirmed, completed, an owner-made request with a payment) and the owner's hand-made
-- holds still in force.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.public_booked_nights()
returns table (stay_id uuid, day date)
language sql
stable
security definer
set search_path = ''
as $$
  select n.stay_id, n.night
  from public.booking_nights n
  join public.bookings b on b.id = n.booking_id
  where n.night >= current_date and n.night < current_date + 540
    and (
      (n.expires_at is null and not (b.status = 'awaiting_payment' and b.source = 'web'))
      or (b.status = 'awaiting_payment' and b.source = 'ops' and n.expires_at > now())
    )
$$;

revoke execute on function public.public_booked_nights() from public, anon, authenticated;
grant execute on function public.public_booked_nights() to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Guest reads. Called only by server code on almar after its own signed-link or session check.
-- ------------------------------------------------------------------------------------------------------------

-- The transfer instructions for the amount due now (section B "transfer"; PAY-10, PAY-18), or null. Only while the
-- bank details are complete and money is due: an awaiting request until its deadline + 2 minutes, a part-paid
-- request whatever its deadline (it keeps its nights; pay_by is then the past deadline: P-09), and a balance due on
-- deposit_paid / confirmed / completed. Never for held, expired, cancelled or paid_in_full. The note in the locale,
-- English when that one is empty; locale null = the booking's.
create or replace function public.booking_transfer_instructions(p_booking uuid, p_locale text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
  v_d public.booking_bank_details;
  v_due bigint;
  v_loc text;
begin
  if p_booking is null then
    return null;
  end if;
  select b.* into v_b from public.bookings b where b.id = p_booking;
  if v_b.id is null or not public.booking_bank_complete() then
    return null;
  end if;
  if not coalesce(
    (v_b.status = 'awaiting_payment'
      and (v_b.paid_fils > 0 or v_b.hold_expires_at >= now() - interval '2 minutes'))
    or v_b.status in ('deposit_paid', 'confirmed', 'completed'), false) then
    return null;
  end if;
  v_due := (public.booking_flags(v_b) ->> 'due_now_fils')::bigint;
  if v_due is null or v_due <= 0 then
    return null;
  end if;
  select d.* into v_d from public.booking_bank_details d where d.id = 1;
  v_loc := case when p_locale in ('en', 'ar', 'es') then p_locale else v_b.locale end;
  return jsonb_build_object(
    'account_name', v_d.account_name,
    'bank_name', v_d.bank_name,
    'iban', v_d.iban,
    'swift', v_d.swift,
    'bank_address', v_d.bank_address,
    'note', case v_loc
      when 'ar' then coalesce(v_d.note_ar, v_d.note_en)
      when 'es' then coalesce(v_d.note_es, v_d.note_en)
      else v_d.note_en end,
    'currency', 'AED',
    'amount_fils', v_due,
    'reference', v_b.ref,
    'pay_by', case when v_b.status = 'awaiting_payment'
      then to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'due_by', case when v_b.status in ('deposit_paid', 'confirmed', 'completed')
      then to_char(v_b.balance_due_date, 'YYYY-MM-DD') end);
end;
$$;

revoke execute on function public.booking_transfer_instructions(uuid, text) from public, anon, authenticated;
grant execute on function public.booking_transfer_instructions(uuid, text) to service_role;

-- The guest's booking page (section B "booking_view"), or null when the booking is unknown or its TEST flag is not the
-- host's. Display status: expired when stored held / awaiting_payment, nothing paid and the deadline + 2 minutes passed
-- (a part-paid request stays awaiting_payment: P-09). Titles and names in the locale when published, else English,
-- else the slug (booking_context's rule). Access (address, wifi, door code, notes) only for confirmed and completed
-- (BOOK-08, OPS-10); the Arabic and Spanish notes are read through to_jsonb so this file does not depend on the
-- migration that adds them. Never the booking id, phone, notes, events, needs_attention, attention_reason, is_test,
-- a write-off amount or reason, or a payment's bank reference.
create or replace function public.booking_view(p_booking uuid, p_locale text, p_expect_test boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
  v_loc text;
  v_status text;
  v_flags jsonb;
  v_stay jsonb;
  v_trav jsonb;
  v_lines jsonb;
  v_pays jsonb;
  v_access jsonb;
begin
  if p_booking is null then
    return null;
  end if;
  select b.* into v_b from public.bookings b where b.id = p_booking;
  if v_b.id is null or v_b.is_test is distinct from p_expect_test then
    return null;
  end if;

  v_loc := case when p_locale in ('en', 'ar', 'es') then p_locale else v_b.locale end;
  v_status := case
    when v_b.status in ('held', 'awaiting_payment') and v_b.paid_fils = 0
      and v_b.hold_expires_at < now() - interval '2 minutes' then 'expired'
    else v_b.status end;
  v_flags := public.booking_flags(v_b);

  select jsonb_build_object(
      'slug', s.slug,
      'title', coalesce(
        (select t.title from public.stay_translations t where t.stay_id = s.id and t.locale = v_loc and t.status = 'published'),
        (select t.title from public.stay_translations t where t.stay_id = s.id and t.locale = 'en'),
        s.slug),
      'destination_name', coalesce(
        (select t.name from public.destination_translations t where t.destination_id = v_b.destination_id and t.locale = v_loc and t.status = 'published'),
        (select t.name from public.destination_translations t where t.destination_id = v_b.destination_id and t.locale = 'en'),
        (select d.slug from public.destinations d where d.id = v_b.destination_id)),
      'image_key', (select m.key from public.media m where m.id = s.hero_media_id),
      'image_alt', coalesce(
        (select i.alt from public.image_translations i where i.image_id = s.hero_media_id and i.locale = v_loc and i.status = 'published'),
        (select i.alt from public.image_translations i where i.image_id = s.hero_media_id and i.locale = 'en')))
    into v_stay
    from public.stays s
    where s.id = v_b.stay_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', t.kind,
      'full_name', t.full_name,
      'age', t.age,
      'is_booker', t.is_booker,
      'not_staying', t.not_staying) order by t.position), '[]'::jsonb)
    into v_trav
    from public.booking_travellers t
    where t.booking_id = v_b.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'name', coalesce(
        (select ct.name from public.catalog_translations ct where ct.item_id = l.catalog_item_id and ct.locale = v_loc and ct.status = 'published'),
        l.name),
      'unit', l.unit,
      'quantity', l.quantity,
      'unit_price_fils', l.unit_price_fils,
      'line_fils', l.line_fils) order by l.name, l.id), '[]'::jsonb)
    into v_lines
    from public.booking_lines l
    where l.booking_id = v_b.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'received_on', to_char(coalesce(p.received_on, (p.paid_at at time zone 'Asia/Dubai')::date), 'YYYY-MM-DD'),
      'method', p.method,
      'amount_fils', p.amount_fils)
      order by coalesce(p.received_on, (p.paid_at at time zone 'Asia/Dubai')::date), p.created_at, p.id), '[]'::jsonb)
    into v_pays
    from public.booking_payments p
    where p.booking_id = v_b.id and p.status = 'succeeded';

  -- The address and access only while the booking is confirmed and its stay has not ended (leave day included, Dubai
  -- date): a booking link opened after the stay shows no door code or wifi (PR #34 review).
  if v_b.status = 'confirmed' and (now() at time zone 'Asia/Dubai')::date <= v_b.leave then
    select jsonb_build_object(
        'address', x.j ->> 'address',
        'wifi_name', x.j ->> 'wifi_name',
        'wifi_password', x.j ->> 'wifi_password',
        'door_code', x.j ->> 'door_code',
        'notes', case when v_loc in ('ar', 'es')
          then coalesce(x.j ->> ('notes_' || v_loc), x.j ->> 'notes')
          else x.j ->> 'notes' end)
      into v_access
      from (select to_jsonb(a) as j from public.stay_access a where a.stay_id = v_b.stay_id) x;
  end if;

  return jsonb_build_object(
    'ref', v_b.ref,
    'status', v_status,
    'locale', v_loc,
    'guest_name', v_b.guest_name,
    'email', v_b.email,
    'stay', v_stay,
    'arrive', to_char(v_b.arrive, 'YYYY-MM-DD'),
    'leave', to_char(v_b.leave, 'YYYY-MM-DD'),
    'nights', v_b.leave - v_b.arrive,
    'adults', v_b.adults,
    'children', v_b.children,
    'infants', v_b.infants,
    'travellers', v_trav,
    'lines', v_lines,
    'airport', v_b.airport,
    'pickup_address', v_b.pickup_address,
    'plan', v_b.plan,
    'money', jsonb_build_object(
      'nights_fils', v_b.nights_fils,
      'addons_fils', v_b.addons_fils,
      'subtotal_fils', v_b.subtotal_fils,
      'vat_bp', v_b.vat_bp,
      'vat_fils', v_b.vat_fils,
      'grand_fils', v_b.grand_fils,
      'deposit_fils', v_b.deposit_fils,
      'balance_fils', v_b.balance_fils,
      'paid_fils', v_b.paid_fils,
      'due_now_fils', v_flags -> 'due_now_fils',
      'still_due_fils', v_flags -> 'still_due_fils'),
    'hold_expires_at', case when v_status = 'held'
      then to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'deadline', case when v_status = 'awaiting_payment'
      then to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'balance_due_date', to_char(v_b.balance_due_date, 'YYYY-MM-DD'),
    'flags', jsonb_build_object(
      'part_received', v_flags -> 'part_received',
      'overpaid', v_flags -> 'overpaid',
      'written_off', v_flags -> 'written_off'),
    'withdrawable', coalesce(
      v_b.status = 'awaiting_payment' and v_b.source = 'web' and v_b.paid_fils = 0
      and v_b.hold_expires_at >= now() - interval '2 minutes', false),
    'payments', v_pays,
    'transfer', public.booking_transfer_instructions(v_b.id, v_loc),
    'access', v_access);
end;
$$;

revoke execute on function public.booking_view(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.booking_view(uuid, text, boolean) to service_role;

-- The signed-in guest's list (section B "guest list item"; AUTH-01). The caller passes the session's email (lower
-- case) and the host's TEST flag. Held bookings and abandoned holds (a web hold never requested) are left out; the
-- display status is booking_view's; newest arrival first, at most 100. paid_fils is the booking's paid_fils: the sum
-- of its succeeded rows (a voided row is not in it, a write-off never is).
create or replace function public.guest_bookings(p_email text, p_locale text, p_is_test boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('items', coalesce(jsonb_agg(x.j order by x.arrive desc, x.created_at desc, x.id), '[]'::jsonb))
  from (
    select b.arrive, b.created_at, b.id,
      jsonb_build_object(
        'ref', b.ref,
        'status', ds.status,
        'stay_title', coalesce(
          (select t.title from public.stay_translations t where t.stay_id = b.stay_id and t.locale = lc.loc and t.status = 'published'),
          (select t.title from public.stay_translations t where t.stay_id = b.stay_id and t.locale = 'en'),
          s.slug),
        'destination_name', coalesce(
          (select t.name from public.destination_translations t where t.destination_id = b.destination_id and t.locale = lc.loc and t.status = 'published'),
          (select t.name from public.destination_translations t where t.destination_id = b.destination_id and t.locale = 'en'),
          (select d.slug from public.destinations d where d.id = b.destination_id)),
        'image_key', (select m.key from public.media m where m.id = s.hero_media_id),
        'image_alt', coalesce(
          (select i.alt from public.image_translations i where i.image_id = s.hero_media_id and i.locale = lc.loc and i.status = 'published'),
          (select i.alt from public.image_translations i where i.image_id = s.hero_media_id and i.locale = 'en')),
        'arrive', to_char(b.arrive, 'YYYY-MM-DD'),
        'leave', to_char(b.leave, 'YYYY-MM-DD'),
        'plan', b.plan,
        'grand_fils', b.grand_fils,
        'paid_fils', b.paid_fils,
        'still_due_fils', (public.booking_flags(b) -> 'still_due_fils'),
        'deadline', case when ds.status = 'awaiting_payment'
          then to_char(b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end) as j
    from public.bookings b
    join public.stays s on s.id = b.stay_id
    cross join lateral (
      select case when p_locale in ('en', 'ar', 'es') then p_locale else b.locale end as loc
    ) lc
    cross join lateral (
      select case
        when b.status in ('held', 'awaiting_payment') and b.paid_fils = 0
          and b.hold_expires_at < now() - interval '2 minutes' then 'expired'
        else b.status end as status
    ) ds
    where p_email is not null
      and lower(b.email) = lower(p_email)
      and b.is_test = p_is_test
      and b.status <> 'held'
      and not (b.source = 'web' and b.requested_at is null)
    order by b.arrive desc, b.created_at desc, b.id
    limit 100
  ) x
$$;

revoke execute on function public.guest_bookings(text, text, boolean) from public, anon, authenticated;
grant execute on function public.guest_bookings(text, text, boolean) to service_role;

-- ============================================================================================================
-- PART B (Task 2 of 04-08 appends below this line)
-- ============================================================================================================

-- ------------------------------------------------------------------------------------------------------------
-- ops_record_payment (B-32, B-33, B-34, PAY-19): the owner records one bank transfer as received, amount as received.
-- Owner only (re-checked here), idempotent on request_id (the dialog makes it when it opens): the same id answers the
-- stored outcome with first_time false; the same id with another booking or amount is almar:changed. Under the stay
-- lock: an unpaid hold or request whose deadline + 2 minutes passed lapses first (P-10, the sweep's rule; a part-paid
-- request never lapses: P-09); expected_status must be the status (almar:changed, detail status); a hold is
-- almar:not_requested. paid_fils and written_off_fils are summed again from the succeeded rows, never added to the old
-- value. Status: booking_next_status for awaiting_payment and deposit_paid; expired and cancelled keep their status and
-- are flagged paid_after_expiry / paid_after_cancel, with no night touched (B-34: never place_hold here); paid_in_full,
-- confirmed and completed are unchanged. Accept as paid (B-33) writes the gap off on this row. The first payment on a
-- request makes its nights permanent (P-09). Above the grand total: flagged overpaid.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.ops_record_payment(p jsonb, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_keys constant text[] := array['booking_id', 'request_id', 'expected_status', 'amount_fils', 'received_on',
    'bank_reference', 'accept_short', 'accept_reason'];
  v_key text;
  v_booking uuid;
  v_request uuid;
  v_amount bigint;
  v_expected text;
  v_received date;
  v_ref text;
  v_accept boolean := false;
  v_reason text;
  v_old public.booking_payments;
  v_ev jsonb;
  v_b public.bookings;
  v_locked boolean := false;
  v_retry boolean := false;
  v_constraint text;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_before text;
  v_after text;
  v_pay uuid;
  v_paid bigint;
  v_off bigint;
  v_settled bigint;
  v_target bigint;
  v_gap bigint := 0;
  v_have int;
  v_flag text;
  v_need boolean;
  v_why text;
  v_cleared boolean := false;
begin
  perform public.booking_assert_owner(p_actor);
  if jsonb_typeof(p) is distinct from 'object' then
    perform public.booking_fail('invalid', 'payload');
  end if;
  for v_key in select jsonb_object_keys(p) loop
    if not (v_key = any (c_keys)) then
      perform public.booking_fail('invalid', v_key);
    end if;
  end loop;
  v_booking := public.booking_uuid(p, 'booking_id', true);
  v_request := public.booking_uuid(p, 'request_id', true);
  v_amount := public.booking_int(p, 'amount_fils', 1, 1000000000000);

  <<attempt>>
  loop
    -- Replay: first without the lock (the common double click), again under it (two calls at once: the second waits
    -- on the lock and then finds the first one's row), and once more after a unique_violation on request_id.
    select x.* into v_old from public.booking_payments x where x.request_id = v_request;
    if found then
      if v_old.booking_id <> v_booking or v_old.amount_fils <> v_amount then
        perform public.booking_fail('changed');
      end if;
      select e.detail into v_ev from public.booking_events e
        where e.booking_id = v_old.booking_id and e.action = 'payment_recorded' and e.detail ->> 'payment_id' = v_old.id::text
        order by e.id limit 1;
      select b.* into v_b from public.bookings b where b.id = v_old.booking_id;
      return jsonb_build_object(
        'first_time', false,
        'booking_id', v_b.id,
        'ref', v_b.ref,
        'payment_id', v_old.id,
        'status_before', coalesce(v_ev ->> 'status_before', v_b.status),
        'status_after', coalesce(v_ev ->> 'status_after', v_b.status),
        'amount_fils', v_old.amount_fils,
        'paid_fils', coalesce((v_ev ->> 'paid_fils')::bigint, v_b.paid_fils),
        'written_off_fils', coalesce((v_ev ->> 'written_off_fils')::bigint, v_b.written_off_fils),
        'write_off_fils', v_old.write_off_fils,
        'flags', public.booking_flags(v_b),
        'is_test', v_b.is_test,
        'locale', v_b.locale,
        'link_version', v_b.link_version);
    end if;
    if v_retry then
      -- A unique_violation on request_id, yet no row to answer with: never expected; refused, nothing kept.
      perform public.booking_fail('changed');
    end if;
    if not v_locked then
      v_b := public.booking_lock(v_booking);
      if v_b.id is null then
        perform public.booking_fail('not_found');
      end if;
      v_locked := true;
      continue attempt;
    end if;

    -- P-10: lapse first, on the sweep's rule, so B-34 holds whatever the cron's timing. Rolled back with any refusal below.
    if (v_b.status = 'held' or (v_b.status = 'awaiting_payment' and v_b.paid_fils = 0))
       and v_b.hold_expires_at < now() - interval '2 minutes' then
      update public.bookings set status = 'expired' where id = v_b.id;
      delete from public.booking_nights where booking_id = v_b.id and expires_at is not null;
      insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
      values (v_b.id, 'system', 'hold_expired', v_b.status, 'expired', jsonb_build_object('swept_by', 'ops_record_payment'));
      select b.* into v_b from public.bookings b where b.id = v_b.id;
    end if;

    v_expected := public.booking_txt(p, 'expected_status', 1, 40, true);
    if v_expected is distinct from v_b.status then
      perform public.booking_fail('changed', null, jsonb_build_object('status', v_b.status));
    end if;
    if v_b.status = 'held' then
      perform public.booking_fail('not_requested');
    end if;

    v_received := public.booking_date(p, 'received_on', true);
    if v_received > v_today or v_received < (v_b.created_at at time zone 'Asia/Dubai')::date then
      perform public.booking_fail('invalid', 'received_on');
    end if;
    if jsonb_typeof(p -> 'bank_reference') is distinct from 'string' then
      perform public.booking_fail('invalid', 'bank_reference');
    end if;
    v_ref := btrim(p ->> 'bank_reference');
    if char_length(v_ref) < 1 or char_length(v_ref) > 100 then
      perform public.booking_fail('invalid', 'bank_reference');
    end if;
    if jsonb_typeof(p -> 'accept_short') is not null and jsonb_typeof(p -> 'accept_short') <> 'null' then
      if jsonb_typeof(p -> 'accept_short') <> 'boolean' then
        perform public.booking_fail('invalid', 'accept_short');
      end if;
      v_accept := (p ->> 'accept_short')::boolean;
    end if;
    if v_accept then
      if jsonb_typeof(p -> 'accept_reason') is distinct from 'string' then
        perform public.booking_fail('invalid', 'accept_reason');
      end if;
      v_reason := btrim(p ->> 'accept_reason');
      if char_length(v_reason) < 3 or char_length(v_reason) > 300 then
        perform public.booking_fail('invalid', 'accept_reason');
      end if;
    elsif jsonb_typeof(p -> 'accept_reason') is not null and jsonb_typeof(p -> 'accept_reason') <> 'null' then
      perform public.booking_fail('invalid', 'accept_reason');
    end if;

    -- Accept as paid (B-33): the gap to the target after this row is written off on this row.
    if v_accept then
      if v_b.status not in ('awaiting_payment', 'deposit_paid', 'confirmed', 'completed') then
        perform public.booking_fail('not_applicable');
      end if;
      select coalesce(sum(x.amount_fils + x.write_off_fils), 0) into v_settled
        from public.booking_payments x where x.booking_id = v_b.id and x.status = 'succeeded';
      v_target := case when v_b.status = 'awaiting_payment' and v_b.plan = 'deposit' then v_b.deposit_fils else v_b.grand_fils end;
      v_gap := v_target - (v_settled + v_amount);
      if v_gap <= 0 then
        perform public.booking_fail('nothing_to_write_off');
      end if;
    end if;

    begin
      insert into public.booking_payments (booking_id, kind, method, status, amount_fils, paid_at, received_on,
        bank_reference, recorded_by, request_id, write_off_fils, write_off_reason)
      values (v_b.id, 'transfer', 'bank_transfer', 'succeeded', v_amount, now(), v_received,
        v_ref, p_actor, v_request, v_gap, case when v_gap > 0 then v_reason end)
      returning id into v_pay;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'booking_payments_request_id_key' then
        v_retry := true;
        continue attempt;
      end if;
      raise;
    end;
    exit attempt;
  end loop;

  -- The sums, again from the rows.
  select coalesce(sum(x.amount_fils), 0), coalesce(sum(x.write_off_fils), 0) into v_paid, v_off
    from public.booking_payments x where x.booking_id = v_b.id and x.status = 'succeeded';

  v_before := v_b.status;
  v_after := case
    when v_b.status in ('awaiting_payment', 'deposit_paid')
      then public.booking_next_status(v_b.status, v_b.plan, v_b.grand_fils, v_b.deposit_fils, v_paid + v_off)
    else v_b.status end;

  -- The nights: permanent from the first payment on a request (P-09), and for deposit_paid / paid_in_full. A missing
  -- night is a refusal, never a re-claim (unreachable under the lock).
  if v_after in ('awaiting_payment', 'deposit_paid', 'paid_in_full') then
    update public.booking_nights set expires_at = null where booking_id = v_b.id and expires_at is not null;
    select count(*) into v_have from public.booking_nights n where n.booking_id = v_b.id;
    if v_have < v_b.leave - v_b.arrive then
      perform public.booking_fail('nights_lost');
    end if;
  end if;

  -- The flag: money on an expired or cancelled booking first, else overpaid. A deadline_passed_part_paid flag ends once
  -- the request is no longer awaiting_payment. A new overpaid never replaces a money-on-a-dead-booking reason.
  v_flag := case v_b.status when 'expired' then 'paid_after_expiry' when 'cancelled' then 'paid_after_cancel' end;
  if v_flag is null and v_paid > v_b.grand_fils then
    v_flag := 'overpaid';
  end if;
  v_need := v_b.needs_attention;
  v_why := v_b.attention_reason;
  if v_why = 'deadline_passed_part_paid' and v_after <> 'awaiting_payment' then
    v_need := false;
    v_why := null;
    v_cleared := true;
  end if;
  if v_flag is not null then
    v_need := true;
    if not coalesce(v_why in ('paid_after_expiry', 'paid_after_cancel') and v_flag = 'overpaid', false) then
      v_why := v_flag;
    end if;
  end if;

  update public.bookings
    set paid_fils = v_paid, written_off_fils = v_off, status = v_after, needs_attention = v_need, attention_reason = v_why
    where id = v_b.id;

  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, 'owner:' || p_actor::text, 'payment_recorded', v_before, v_after, jsonb_build_object(
    'payment_id', v_pay,
    'amount_fils', v_amount,
    'received_on', to_char(v_received, 'YYYY-MM-DD'),
    'bank_reference', v_ref,
    'paid_fils', v_paid,
    'written_off_fils', v_off,
    'write_off_fils', v_gap,
    'request_id', v_request,
    'status_before', v_before,
    'status_after', v_after,
    'attention_cleared', v_cleared));
  if v_flag is not null then
    insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
    values (v_b.id, 'owner:' || p_actor::text, 'needs_attention', v_before, v_after,
      jsonb_build_object('reason', v_flag, 'payment_id', v_pay));
  end if;

  select b.* into v_b from public.bookings b where b.id = v_b.id;
  return jsonb_build_object(
    'first_time', true,
    'booking_id', v_b.id,
    'ref', v_b.ref,
    'payment_id', v_pay,
    'status_before', v_before,
    'status_after', v_after,
    'amount_fils', v_amount,
    'paid_fils', v_paid,
    'written_off_fils', v_off,
    'write_off_fils', v_gap,
    'flags', public.booking_flags(v_b),
    'is_test', v_b.is_test,
    'locale', v_b.locale,
    'link_version', v_b.link_version);
end;
$$;

revoke execute on function public.ops_record_payment(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.ops_record_payment(jsonb, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- The cancel_first floor (P-21 as the owner changed it 2026-10-20: the deposit on every plan). A deposit plan: its
-- stored deposit_fils. Any other plan (the table keeps deposit_fils 0 there): the deposit it would have had,
-- (grand x deposit_bp + 5000) / 10000, the half-up pct() of lib/money/fils.ts. A 0 % deposit gives 0. Null in, null
-- out. 04-09's void preview mirrors it.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.booking_deposit_floor(p_plan text, p_grand bigint, p_deposit bigint, p_deposit_bp int)
returns bigint
language sql
immutable
security definer
set search_path = ''
as $$
  select case
    when p_plan is null or p_grand is null or p_deposit is null or p_deposit_bp is null then null
    when p_plan = 'deposit' then p_deposit
    else (p_grand * p_deposit_bp + 5000) / 10000
  end
$$;

revoke execute on function public.booking_deposit_floor(text, bigint, bigint, int) from public, anon, authenticated;
grant execute on function public.booking_deposit_floor(text, bigint, bigint, int) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- ops_void_payment (PAY-19): the owner voids one bank row with a reason. The row is marked voided, never removed. Under
-- the stay lock, then the row. Before any write: a confirmed or completed booking may not drop below its deposit floor
-- (almar:cancel_first, P-21); a void that leaves the booking awaiting payment needs the transfer window
-- (almar:window_missing). Then the sums are taken again from the rows and the status rule runs: deposit_paid /
-- paid_in_full may go back to awaiting_payment with a fresh deadline (its nights timed to it only when no payment is
-- left; with a payment left they stay permanent: P-09); an unpaid-again request gets greatest(deadline, now + window)
-- and its nights timed to it; everything else keeps its status. Only the booking's own nights are touched, never
-- through place_hold. No email (P-11).
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.ops_void_payment(p_payment uuid, p_reason text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(p_reason);
  v_bid uuid;
  v_b public.bookings;
  v_pay public.booking_payments;
  v_ev public.booking_events;
  v_settled_after bigint;
  v_paid_after bigint;
  v_after text;
  v_window int;
  v_deadline timestamptz;
  v_retime timestamptz;
  v_paid bigint;
  v_off bigint;
  v_have int;
  v_need boolean;
  v_why text;
  v_cleared boolean := false;
  v_iso text;
  v_before text;
begin
  perform public.booking_assert_owner(p_actor);
  if v_reason is null or char_length(v_reason) < 3 or char_length(v_reason) > 300 then
    perform public.booking_fail('invalid', 'reason');
  end if;
  select x.booking_id into v_bid from public.booking_payments x where x.id = p_payment;
  if v_bid is null then
    perform public.booking_fail('not_found');
  end if;
  v_b := public.booking_lock(v_bid);
  select x.* into v_pay from public.booking_payments x where x.id = p_payment for update;

  if v_pay.status = 'voided' then
    select e.* into v_ev from public.booking_events e
      where e.booking_id = v_b.id and e.action = 'payment_voided' and e.detail ->> 'payment_id' = v_pay.id::text
      order by e.id limit 1;
    return jsonb_build_object(
      'first_time', false,
      'booking_id', v_b.id,
      'ref', v_b.ref,
      'payment_id', v_pay.id,
      'status_before', coalesce(v_ev.from_status, v_b.status),
      'status_after', coalesce(v_ev.to_status, v_b.status),
      'paid_fils', coalesce((v_ev.detail ->> 'paid_fils')::bigint, v_b.paid_fils),
      'written_off_fils', coalesce((v_ev.detail ->> 'written_off_fils')::bigint, v_b.written_off_fils),
      'deadline', v_ev.detail ->> 'deadline',
      'flags', public.booking_flags(v_b));
  end if;
  if v_pay.status <> 'succeeded' or v_pay.method <> 'bank_transfer' then
    perform public.booking_fail('not_voidable');
  end if;

  select coalesce(sum(x.amount_fils + x.write_off_fils), 0), coalesce(sum(x.amount_fils), 0)
    into v_settled_after, v_paid_after
    from public.booking_payments x where x.booking_id = v_b.id and x.status = 'succeeded' and x.id <> v_pay.id;

  -- Before any write.
  if v_b.status in ('confirmed', 'completed')
     and v_settled_after < public.booking_deposit_floor(v_b.plan, v_b.grand_fils, v_b.deposit_fils, v_b.deposit_bp) then
    perform public.booking_fail('cancel_first', null, jsonb_build_object(
      'floor_fils', public.booking_deposit_floor(v_b.plan, v_b.grand_fils, v_b.deposit_fils, v_b.deposit_bp),
      'settled_after_fils', v_settled_after));
  end if;
  v_after := v_b.status;
  if v_b.status in ('deposit_paid', 'paid_in_full') then
    v_after := public.booking_next_status(v_b.status, v_b.plan, v_b.grand_fils, v_b.deposit_fils, v_settled_after);
  end if;
  if (v_b.status in ('deposit_paid', 'paid_in_full') and v_after = 'awaiting_payment')
     or (v_b.status = 'awaiting_payment' and v_paid_after = 0) then
    v_window := public.booking_window_minutes(v_b.is_test);
    if v_window is null then
      perform public.booking_fail('window_missing');
    end if;
  end if;

  v_before := v_b.status;
  update public.booking_payments
    set status = 'voided', void_reason = v_reason, voided_at = now(), voided_by = p_actor
    where id = v_pay.id;
  select coalesce(sum(x.amount_fils), 0), coalesce(sum(x.write_off_fils), 0) into v_paid, v_off
    from public.booking_payments x where x.booking_id = v_b.id and x.status = 'succeeded';

  v_deadline := v_b.hold_expires_at;
  if v_b.status in ('deposit_paid', 'paid_in_full') and v_after = 'awaiting_payment' then
    v_deadline := now() + make_interval(mins => v_window);
    if v_paid = 0 then
      v_retime := v_deadline;
    end if;
  elsif v_b.status = 'awaiting_payment' and v_paid = 0 then
    v_deadline := greatest(v_b.hold_expires_at, now() + make_interval(mins => v_window));
    v_retime := v_deadline;
  end if;
  if v_retime is not null then
    update public.booking_nights set expires_at = v_retime where booking_id = v_b.id;
    select count(*) into v_have from public.booking_nights n where n.booking_id = v_b.id;
    if v_have < v_b.leave - v_b.arrive then
      perform public.booking_fail('nights_lost');
    end if;
  end if;

  v_need := v_b.needs_attention;
  v_why := v_b.attention_reason;
  if (v_why = 'overpaid' and v_paid <= v_b.grand_fils)
     or (v_why in ('paid_after_expiry', 'paid_after_cancel', 'deadline_passed_part_paid') and v_paid = 0) then
    v_need := false;
    v_why := null;
    v_cleared := true;
  end if;

  update public.bookings
    set paid_fils = v_paid, written_off_fils = v_off, status = v_after, hold_expires_at = v_deadline,
        needs_attention = v_need, attention_reason = v_why
    where id = v_b.id;

  v_iso := case when v_after = 'awaiting_payment'
    then to_char(v_deadline at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end;
  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, 'owner:' || p_actor::text, 'payment_voided', v_b.status, v_after, jsonb_build_object(
    'payment_id', v_pay.id,
    'amount_fils', v_pay.amount_fils,
    'reason', v_reason,
    'paid_fils', v_paid,
    'written_off_fils', v_off,
    'deadline', v_iso,
    'attention_cleared', v_cleared));

  select b.* into v_b from public.bookings b where b.id = v_b.id;
  return jsonb_build_object(
    'first_time', true,
    'booking_id', v_b.id,
    'ref', v_b.ref,
    'payment_id', v_pay.id,
    'status_before', v_before,
    'status_after', v_after,
    'paid_fils', v_paid,
    'written_off_fils', v_off,
    'deadline', v_iso,
    'flags', public.booking_flags(v_b));
end;
$$;

revoke execute on function public.ops_void_payment(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.ops_void_payment(uuid, text, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Attention and notes (owner only)
-- ------------------------------------------------------------------------------------------------------------

-- Resolve: the owner's note (3..500 characters) is kept as a booking note, the flag and its reason are cleared, one
-- attention_resolved event. A booking that is not flagged answers first_time false and writes nothing.
create or replace function public.ops_resolve_attention(p_booking uuid, p_note text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_note text := btrim(p_note);
  v_b public.bookings;
  v_id bigint;
begin
  perform public.booking_assert_owner(p_actor);
  if v_note is null or char_length(v_note) < 3 or char_length(v_note) > 500 then
    perform public.booking_fail('invalid', 'note');
  end if;
  v_b := public.booking_lock(p_booking);
  if v_b.id is null then
    perform public.booking_fail('not_found');
  end if;
  if not v_b.needs_attention then
    return jsonb_build_object('first_time', false, 'booking_id', v_b.id, 'note_id', null);
  end if;
  insert into public.booking_notes (booking_id, actor, body)
  values (v_b.id, 'owner:' || p_actor::text, v_note)
  returning id into v_id;
  update public.bookings set needs_attention = false, attention_reason = null where id = v_b.id;
  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, 'owner:' || p_actor::text, 'attention_resolved', null, null,
    jsonb_build_object('reason', v_b.attention_reason, 'note_id', v_id));
  return jsonb_build_object('first_time', true, 'booking_id', v_b.id, 'note_id', v_id);
end;
$$;

revoke execute on function public.ops_resolve_attention(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.ops_resolve_attention(uuid, text, uuid) to service_role;

-- One owner note (1..2000 characters, not blank). The note_added event carries the note id only, never the text.
-- Idempotent on p_request_id (the composer makes it, and keeps it for a retry): the same id answers the stored note with
-- first_time false and writes nothing; the same id with another booking or another text is almar:changed. The insert
-- is `on conflict do nothing`, so two calls at once with one id still make one row.
create or replace function public.ops_add_booking_note(p_booking uuid, p_body text, p_actor uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_at timestamptz;
  v_old public.booking_notes;
begin
  perform public.booking_assert_owner(p_actor);
  if p_booking is null or not exists (select 1 from public.bookings b where b.id = p_booking) then
    perform public.booking_fail('not_found');
  end if;
  if p_body is null or char_length(p_body) < 1 or char_length(p_body) > 2000 or btrim(p_body) = '' then
    perform public.booking_fail('invalid', 'body');
  end if;
  if p_request_id is null then
    perform public.booking_fail('invalid', 'request_id');
  end if;
  insert into public.booking_notes (booking_id, actor, body, request_id)
  values (p_booking, 'owner:' || p_actor::text, p_body, p_request_id)
  on conflict (request_id) do nothing
  returning id, at into v_id, v_at;
  if v_id is null then
    select n.* into v_old from public.booking_notes n where n.request_id = p_request_id;
    if v_old.id is null or v_old.booking_id <> p_booking or v_old.body <> p_body then
      perform public.booking_fail('changed');
    end if;
    return jsonb_build_object('first_time', false, 'id', v_old.id,
      'at', to_char(v_old.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  end if;
  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (p_booking, 'owner:' || p_actor::text, 'note_added', null, null, jsonb_build_object('note_id', v_id));
  return jsonb_build_object('first_time', true, 'id', v_id, 'at', to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end;
$$;

revoke execute on function public.ops_add_booking_note(uuid, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.ops_add_booking_note(uuid, text, uuid, uuid) to service_role;

-- A booking's notes, newest first, with the owner's email when the actor is 'owner:<uuid>'.
create or replace function public.ops_list_booking_notes(p_booking uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('items', coalesce(jsonb_agg(jsonb_build_object(
      'id', n.id,
      'at', to_char(n.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'actor', n.actor,
      'actor_email', (
        select pr.email from public.profiles pr
        where pr.id = case when n.actor ~ '^owner:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          then (substr(n.actor, 7))::uuid end),
      'body', n.body) order by n.at desc, n.id desc), '[]'::jsonb))
  from public.booking_notes n
  where n.booking_id = p_booking
$$;

revoke execute on function public.ops_list_booking_notes(uuid) from public, anon, authenticated;
grant execute on function public.ops_list_booking_notes(uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- The owner's reads (OPS-04 server side). English titles: the dashboard is English. Neither runs ops_lapse_holds:
-- 04-09's handler calls it first.
-- ------------------------------------------------------------------------------------------------------------

-- One page of bookings. p_q (at most 100 characters): starting with 'almar-' in any case it matches the start of the
-- ref, otherwise it is searched, case- and accent-folded, in the guest name, the email and the ref. p_status: one of
-- the eight statuses or 'attention' (flagged); null hides abandoned holds (a web hold never requested that expired).
-- p_arrive_from / p_arrive_to: an arrival range. p_after: the next of the previous page (an offset as text). p_limit
-- 1..60. Order: flagged first, then awaiting payment by deadline, then deposit_paid / paid_in_full / confirmed
-- arriving today or later by arrival, then holds newest first, then the rest by arrival newest first; then id.
-- Returns { items, next } with next null on the last page.
create or replace function public.ops_list_bookings(p_q text default null, p_status text default null, p_destination uuid default null,
  p_arrive_from date default null, p_arrive_to date default null, p_after text default null, p_limit int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_prefix text;
  v_needle text;
  v_offset int;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_items jsonb;
  v_more boolean;
begin
  if p_q is not null and char_length(p_q) > 100 then
    perform public.booking_fail('invalid', 'q');
  end if;
  if p_status is not null and p_status not in ('held', 'awaiting_payment', 'deposit_paid', 'paid_in_full', 'confirmed',
      'completed', 'cancelled', 'expired', 'attention') then
    perform public.booking_fail('invalid', 'status');
  end if;
  if p_arrive_from is not null and p_arrive_to is not null and p_arrive_from > p_arrive_to then
    perform public.booking_fail('invalid', 'arrive');
  end if;
  if p_after is not null and p_after !~ '^[0-9]{1,6}$' then
    perform public.booking_fail('invalid', 'after');
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 60 then
    perform public.booking_fail('invalid', 'limit');
  end if;
  v_offset := coalesce(p_after::int, 0);
  if v_q is not null and lower(v_q) like 'almar-%' then
    v_prefix := upper(v_q);
  elsif v_q is not null then
    v_needle := public.media_fold(v_q);
  end if;

  with hits as (
    select b as bk,
      case
        when b.needs_attention then 1
        when b.status = 'awaiting_payment' then 2
        when b.status in ('deposit_paid', 'paid_in_full', 'confirmed') and b.arrive >= v_today then 3
        when b.status = 'held' then 4
        else 5
      end as rnk
    from public.bookings b
    where (v_prefix is null or left(b.ref, char_length(v_prefix)) = v_prefix)
      and (v_needle is null
        or strpos(public.media_fold(b.guest_name), v_needle) > 0
        or strpos(public.media_fold(b.email), v_needle) > 0
        or strpos(public.media_fold(b.ref), v_needle) > 0)
      and (case
        when p_status is null then not (b.source = 'web' and b.requested_at is null and b.status = 'expired')
        when p_status = 'attention' then b.needs_attention
        else b.status = p_status end)
      and (p_destination is null or b.destination_id = p_destination)
      and (p_arrive_from is null or b.arrive >= p_arrive_from)
      and (p_arrive_to is null or b.arrive <= p_arrive_to)
  ),
  ordered as (
    select h.bk, row_number() over (order by
        h.rnk,
        case when h.rnk = 1 then (h.bk).arrive end,
        case when h.rnk = 2 then (h.bk).hold_expires_at end,
        case when h.rnk = 3 then (h.bk).arrive end,
        case when h.rnk = 4 then (h.bk).created_at end desc,
        case when h.rnk = 5 then (h.bk).arrive end desc,
        (h.bk).id) as ord
    from hits h
  ),
  page as (
    select o.bk, o.ord from ordered o where o.ord > v_offset and o.ord <= v_offset + p_limit + 1
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
        'id', (pg.bk).id,
        'ref', (pg.bk).ref,
        'status', (pg.bk).status,
        'source', (pg.bk).source,
        'is_test', (pg.bk).is_test,
        'guest_name', (pg.bk).guest_name,
        'email', (pg.bk).email,
        'stay_slug', s.slug,
        'stay_title', coalesce((select t.title from public.stay_translations t where t.stay_id = s.id and t.locale = 'en'), s.slug),
        'destination_id', (pg.bk).destination_id,
        'destination_name', coalesce(
          (select t.name from public.destination_translations t where t.destination_id = (pg.bk).destination_id and t.locale = 'en'),
          (select d.slug from public.destinations d where d.id = (pg.bk).destination_id)),
        'arrive', to_char((pg.bk).arrive, 'YYYY-MM-DD'),
        'leave', to_char((pg.bk).leave, 'YYYY-MM-DD'),
        'guests', (pg.bk).adults + (pg.bk).children + (pg.bk).infants,
        'plan', (pg.bk).plan,
        'grand_fils', (pg.bk).grand_fils,
        'paid_fils', (pg.bk).paid_fils,
        'written_off_fils', (pg.bk).written_off_fils,
        'due_now_fils', public.booking_flags(pg.bk) -> 'due_now_fils',
        'deadline', case when (pg.bk).status = 'awaiting_payment'
          then to_char((pg.bk).hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
        'balance_due_date', to_char((pg.bk).balance_due_date, 'YYYY-MM-DD'),
        'created_at', to_char((pg.bk).created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'requested_at', to_char((pg.bk).requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'flags', public.booking_flags(pg.bk)) order by pg.ord) filter (where pg.ord <= v_offset + p_limit), '[]'::jsonb),
    coalesce(bool_or(pg.ord > v_offset + p_limit), false)
  into v_items, v_more
  from page pg
  join public.stays s on s.id = (pg.bk).stay_id;

  return jsonb_build_object('items', v_items, 'next', case when v_more then (v_offset + p_limit)::text end);
end;
$$;

revoke execute on function public.ops_list_bookings(text, text, uuid, date, date, text, int) from public, anon, authenticated;
grant execute on function public.ops_list_bookings(text, text, uuid, date, date, text, int) to service_role;

-- One booking for the owner by its ref (section B "owner detail"), or null. Payments include voided rows with their
-- reason; events newest first, at most 200.
create or replace function public.ops_get_booking(p_ref text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
  v_trav jsonb;
  v_lines jsonb;
  v_pays jsonb;
  v_events jsonb;
begin
  if p_ref is null then
    return null;
  end if;
  select b.* into v_b from public.bookings b where b.ref = upper(btrim(p_ref));
  if v_b.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', t.kind,
      'full_name', t.full_name,
      'age', t.age,
      'is_booker', t.is_booker,
      'not_staying', t.not_staying) order by t.position), '[]'::jsonb)
    into v_trav
    from public.booking_travellers t
    where t.booking_id = v_b.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'catalog_item_id', l.catalog_item_id,
      'name', l.name,
      'unit', l.unit,
      'is_uae', l.is_uae,
      'unit_price_fils', l.unit_price_fils,
      'quantity', l.quantity,
      'line_fils', l.line_fils) order by l.name, l.id), '[]'::jsonb)
    into v_lines
    from public.booking_lines l
    where l.booking_id = v_b.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'kind', x.kind,
      'method', x.method,
      'status', x.status,
      'amount_fils', x.amount_fils,
      'received_on', to_char(x.received_on, 'YYYY-MM-DD'),
      'bank_reference', x.bank_reference,
      'recorded_by', x.recorded_by,
      'recorded_by_email', (select pr.email from public.profiles pr where pr.id = x.recorded_by),
      'created_at', to_char(x.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'write_off_fils', x.write_off_fils,
      'write_off_reason', x.write_off_reason,
      'void_reason', x.void_reason,
      'voided_at', to_char(x.voided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'voided_by', x.voided_by,
      'voided_by_email', (select pr.email from public.profiles pr where pr.id = x.voided_by),
      'card_brand', x.card_brand,
      'card_last4', x.card_last4) order by x.created_at desc, x.id), '[]'::jsonb)
    into v_pays
    from public.booking_payments x
    where x.booking_id = v_b.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id,
      'at', to_char(e.at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'actor', e.actor,
      'action', e.action,
      'from_status', e.from_status,
      'to_status', e.to_status,
      'detail', e.detail) order by e.id desc), '[]'::jsonb)
    into v_events
    from (
      select * from public.booking_events ev where ev.booking_id = v_b.id order by ev.id desc limit 200
    ) e;

  return jsonb_build_object(
    'id', v_b.id,
    'ref', v_b.ref,
    'status', v_b.status,
    'source', v_b.source,
    'is_test', v_b.is_test,
    'link_version', v_b.link_version,
    'created_at', to_char(v_b.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'updated_at', to_char(v_b.updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'requested_at', to_char(v_b.requested_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'hold_expires_at', to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'deadline', case when v_b.status = 'awaiting_payment'
      then to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
    'guest', jsonb_build_object(
      'name', v_b.guest_name,
      'email', v_b.email,
      'phone', v_b.phone,
      'nationality', v_b.nationality,
      'special_requests', v_b.special_requests,
      'emergency_name', v_b.emergency_name,
      'emergency_phone', v_b.emergency_phone,
      'locale', v_b.locale),
    'stay', (select jsonb_build_object(
        'id', s.id,
        'slug', s.slug,
        'title', coalesce((select t.title from public.stay_translations t where t.stay_id = s.id and t.locale = 'en'), s.slug))
      from public.stays s where s.id = v_b.stay_id),
    'destination', (select jsonb_build_object(
        'id', d.id,
        'name', coalesce((select t.name from public.destination_translations t where t.destination_id = d.id and t.locale = 'en'), d.slug))
      from public.destinations d where d.id = v_b.destination_id),
    'arrive', to_char(v_b.arrive, 'YYYY-MM-DD'),
    'leave', to_char(v_b.leave, 'YYYY-MM-DD'),
    'nights', v_b.leave - v_b.arrive,
    'adults', v_b.adults,
    'children', v_b.children,
    'infants', v_b.infants,
    'airport', v_b.airport,
    'pickup_address', v_b.pickup_address,
    'terms_version', v_b.terms_version,
    'terms_accepted_at', to_char(v_b.terms_accepted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'plan', v_b.plan,
    'money', jsonb_build_object(
      'nights_fils', v_b.nights_fils,
      'addons_fils', v_b.addons_fils,
      'subtotal_fils', v_b.subtotal_fils,
      'vat_bp', v_b.vat_bp,
      'vat_fils', v_b.vat_fils,
      'grand_fils', v_b.grand_fils,
      'deposit_bp', v_b.deposit_bp,
      'deposit_fils', v_b.deposit_fils,
      'balance_fils', v_b.balance_fils,
      'paid_fils', v_b.paid_fils,
      'written_off_fils', v_b.written_off_fils,
      'balance_due_days', v_b.balance_due_days,
      'balance_due_date', to_char(v_b.balance_due_date, 'YYYY-MM-DD')),
    'flags', public.booking_flags(v_b),
    'travellers', v_trav,
    'lines', v_lines,
    'payments', v_pays,
    'notes', public.ops_list_booking_notes(v_b.id) -> 'items',
    'events', v_events,
    'lapse_email', jsonb_build_object(
      'sent_at', to_char(v_b.lapse_email_sent_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'attempts', v_b.lapse_email_attempts,
      'claimed_at', to_char(v_b.lapse_email_claimed_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
end;
$$;

revoke execute on function public.ops_get_booking(text) from public, anon, authenticated;
grant execute on function public.ops_get_booking(text) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- The lapse (PAY-20; P-09 as the owner changed it 2026-10-20: a request with a recorded payment never lapses; it keeps
-- its nights and is flagged for the owner).
-- ------------------------------------------------------------------------------------------------------------

-- ops_lapse_holds, replaced (same signature and grants as 20261005110000). Lapsed: a hold, or a request with nothing
-- paid, more than two minutes past its end: expired, its timed nights freed, one hold_expired event, counted. Flagged,
-- in the same pass: a request with a payment more than two minutes past its deadline stays awaiting_payment with its
-- nights and gets needs_attention deadline_passed_part_paid and one needs_attention event, once per deadline (a
-- resolved flag stays resolved; a later deadline after a void flags again); flags are not counted. One pass in stay
-- order, so two calls at once take the stay locks in the same order. Called by the almar-ops cron every 5 minutes and
-- by 04-09's handler before every owner read.
create or replace function public.ops_lapse_holds()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_b public.bookings;
  v_n int := 0;
  v_deadline text;
begin
  for v_row in
    select b.id from public.bookings b
    where b.status in ('held', 'awaiting_payment') and b.hold_expires_at < now() - interval '2 minutes'
    order by b.stay_id, b.id
  loop
    v_b := public.booking_lock(v_row.id);
    if v_b.id is null or not coalesce(v_b.hold_expires_at < now() - interval '2 minutes', false) then
      continue;
    end if;
    if v_b.status = 'held' or (v_b.status = 'awaiting_payment' and v_b.paid_fils = 0) then
      update public.bookings set status = 'expired' where id = v_b.id;
      delete from public.booking_nights where booking_id = v_b.id and expires_at is not null;
      insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
      values (v_b.id, 'system', 'hold_expired', v_b.status, 'expired', jsonb_build_object('swept_by', 'ops_lapse_holds'));
      v_n := v_n + 1;
    end if;
    if v_b.status = 'awaiting_payment' and v_b.paid_fils > 0 then
      v_deadline := to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
      if not exists (
        select 1 from public.booking_events e
        where e.booking_id = v_b.id and e.action = 'needs_attention'
          and e.detail ->> 'reason' = 'deadline_passed_part_paid' and e.detail ->> 'deadline' = v_deadline
      ) then
        update public.bookings
          set needs_attention = true, attention_reason = coalesce(attention_reason, 'deadline_passed_part_paid')
          where id = v_b.id;
        insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
        values (v_b.id, 'system', 'needs_attention', null, null, jsonb_build_object(
          'reason', 'deadline_passed_part_paid', 'paid_fils', v_b.paid_fils, 'deadline', v_deadline));
      end if;
    end if;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.ops_lapse_holds() from public, anon, authenticated;
grant execute on function public.ops_lapse_holds() to service_role;

-- The guard: a request with a recorded payment is never expired. No path reaches it (ops_lapse_holds skips these rows,
-- place_hold's sweep takes timed nights only and a part-paid request's nights are permanent, booking_drop_hold and
-- mark_session_expired touch held only, the inline lapse in ops_record_payment runs on paid 0 only); it is the last
-- line if one ever does.
create or replace function public.bookings_keep_paid_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.booking_fail('paid_request_kept', null, jsonb_build_object('booking_id', new.id, 'paid_fils', old.paid_fils));
  return new;
end;
$$;

revoke execute on function public.bookings_keep_paid_request() from public, anon, authenticated;
grant execute on function public.bookings_keep_paid_request() to service_role;

create trigger bookings_keep_paid_request
  before update of status on public.bookings
  for each row
  when (old.status = 'awaiting_payment' and new.status = 'expired' and old.paid_fils > 0)
  execute function public.bookings_keep_paid_request();

-- The lapse email claim (cron only). Unpaid web requests that lapsed (expired, requested, nothing paid), not sent yet,
-- fewer than 5 tries, deadline within the last 48 hours (P-12: never a stale email), lease free or older than 10
-- minutes. Each row is claimed by one caller only (skip locked); the claim takes the lease and counts a try. The
-- notifier sends with the idempotency key lapse/<booking_id>; finish_lapse_email records the outcome.
create index bookings_lapse_email_idx on public.bookings (hold_expires_at)
  where status = 'expired' and source = 'web' and requested_at is not null and lapse_email_sent_at is null;

create or replace function public.claim_lapse_emails(p_limit int default 5)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_lease constant interval := interval '10 minutes';
  c_max_attempts constant int := 5;
  c_max_age constant interval := interval '48 hours';
  v_out jsonb;
begin
  with picked as (
    select b.id from public.bookings b
    where b.status = 'expired' and b.source = 'web' and b.requested_at is not null and b.paid_fils = 0
      and b.lapse_email_sent_at is null and b.lapse_email_attempts < c_max_attempts
      and b.hold_expires_at > now() - c_max_age
      and (b.lapse_email_claimed_at is null or b.lapse_email_claimed_at < now() - c_lease)
    order by b.hold_expires_at, b.id
    limit least(greatest(coalesce(p_limit, 5), 1), 10)
    for no key update skip locked
  ),
  claimed as (
    update public.bookings b
      set lapse_email_claimed_at = now(), lapse_email_attempts = b.lapse_email_attempts + 1
      from picked
      where b.id = picked.id
      returning b.id, b.ref, b.email, b.guest_name, b.locale, b.is_test, b.stay_id, b.arrive, b.leave, b.hold_expires_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'booking_id', c.id,
      'ref', c.ref,
      'email', c.email,
      'guest_name', c.guest_name,
      'locale', c.locale,
      'is_test', c.is_test,
      'stay_slug', s.slug,
      'stay_title', coalesce(
        (select t.title from public.stay_translations t where t.stay_id = s.id and t.locale = c.locale and t.status = 'published'),
        (select t.title from public.stay_translations t where t.stay_id = s.id and t.locale = 'en'),
        s.slug),
      'arrive', to_char(c.arrive, 'YYYY-MM-DD'),
      'leave', to_char(c.leave, 'YYYY-MM-DD'),
      'deadline', to_char(c.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      order by c.hold_expires_at, c.id), '[]'::jsonb)
    into v_out
    from claimed c
    join public.stays s on s.id = c.stay_id;
  return v_out;
end;
$$;

revoke execute on function public.claim_lapse_emails(int) from public, anon, authenticated;
grant execute on function public.claim_lapse_emails(int) to service_role;

-- The outcome of one lapse email. Sent: lapse_email_sent_at and one email_sent event (a second report of the same
-- send writes nothing). Not sent: one email_failed event with the error name only (lower case, a-z 0-9 and _, at most
-- 60 characters), or email_unknown (no error) when the send timed out (p_error 'delivery_unknown': it may still have
-- been delivered; the retry reuses the idempotency key, so it never arrives twice); the lease runs out by itself, so the next try comes after 10 minutes, at most 5 in all. Both events
-- carry the key lapse/<booking_id>.
create or replace function public.finish_lapse_email(p_booking uuid, p_ok boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_done int;
begin
  if p_booking is null or p_ok is null then
    perform public.booking_fail('invalid');
  end if;
  if not exists (select 1 from public.bookings b where b.id = p_booking) then
    perform public.booking_fail('not_found');
  end if;
  v_key := 'lapse/' || p_booking::text;
  if p_ok then
    update public.bookings set lapse_email_sent_at = now() where id = p_booking and lapse_email_sent_at is null;
    get diagnostics v_done = row_count;
    if v_done = 1 then
      insert into public.booking_events (booking_id, actor, action, detail)
      values (p_booking, 'system', 'email_sent', jsonb_build_object('template', 'request_lapsed', 'key', v_key));
    end if;
  elsif p_error = 'delivery_unknown' then
    insert into public.booking_events (booking_id, actor, action, detail)
    values (p_booking, 'system', 'email_unknown', jsonb_build_object('template', 'request_lapsed', 'key', v_key));
  else
    insert into public.booking_events (booking_id, actor, action, detail)
    values (p_booking, 'system', 'email_failed', jsonb_build_object(
      'template', 'request_lapsed',
      'key', v_key,
      'error', left(regexp_replace(lower(coalesce(p_error, 'unknown')), '[^a-z0-9_]', '', 'g'), 60)));
  end if;
end;
$$;

revoke execute on function public.finish_lapse_email(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_lapse_email(uuid, boolean, text) to service_role;
