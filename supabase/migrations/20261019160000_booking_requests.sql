-- Phase 4 plan 04-08: request to book, paid by bank transfer (owner signed 2026-10-19 16:18 CET; B-23..B-35 of
-- 04-CONTEXT.md; the owner's plan-gate answers of 2026-10-20 in .planning/decisions/2026-10-20-phase-4-rule-signatures.md).
-- Number 20261019160000 reserved and granted by the controller. One file: part A (schema, the owner's bank details and
-- transfer window, the request gate, the guest's request and withdraw, the baked calendar, the guest's reads), then
-- part B (record and void a transfer, resolve, notes, the owner's list and detail, the lapse and its email claim).
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
-- stays allowed and nothing writes it) plus the seven of this plan: 19 actions.
alter table public.booking_events drop constraint booking_events_action_check;
alter table public.booking_events
  add constraint booking_events_action_check check (action in (
    'created', 'status', 'hold_expired', 'payment', 'refund', 'dispute', 'email_sent', 'email_resent', 'email_failed',
    'needs_attention', 'resend_requested', 'checkout_not_closed',
    'request_sent', 'payment_recorded', 'payment_voided', 'note_added', 'attention_resolved', 'email_pending',
    'request_withdrawn')) not valid;
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

-- The owner's notes on a booking. Append-only; the guest never sees them.
create table public.booking_notes (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  body text not null check (char_length(body) between 1 and 2000 and btrim(body) <> '')
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
create or replace function public.booking_flags(p_b public.bookings)
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
  if p_b.id is null then
    return null;
  end if;
  v_settled := p_b.paid_fils + p_b.written_off_fils;
  v_target := case when p_b.plan = 'deposit' then p_b.deposit_fils else p_b.grand_fils end;
  if p_b.status = 'awaiting_payment' then
    v_due := greatest(0, v_target - v_settled);
  elsif p_b.status in ('deposit_paid', 'confirmed', 'completed') then
    v_due := greatest(0, p_b.grand_fils - v_settled);
  end if;
  if p_b.status in ('awaiting_payment', 'deposit_paid', 'paid_in_full', 'confirmed', 'completed') then
    v_still := greatest(0, p_b.grand_fils - v_settled);
  end if;
  return jsonb_build_object(
    'needs_attention', p_b.needs_attention,
    'attention_reason', p_b.attention_reason,
    'part_received', (p_b.status = 'awaiting_payment' and p_b.paid_fils > 0),
    'overpaid', (p_b.paid_fils > p_b.grand_fils),
    'written_off', (p_b.written_off_fils > 0),
    'settled_fils', v_settled,
    'due_now_fils', v_due,
    'still_due_fils', v_still,
    'balance_overdue', coalesce(
      (now() at time zone 'Asia/Dubai')::date > p_b.balance_due_date
      and v_settled < p_b.grand_fils
      and p_b.status in ('deposit_paid', 'confirmed'), false),
    'deadline_passed', coalesce(p_b.status in ('held', 'awaiting_payment') and p_b.hold_expires_at < now(), false));
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
  v_row_changed boolean := false;
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
  v_row_changed := cardinality(v_changed) > 0;

  if v_row_changed then
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
  end if;

  if p ? 'balance_due_days' then
    select s.balance_due_days into v_days_old from public.site_settings s where s.id = 1 for update;
    if v_days is distinct from v_days_old then
      update public.site_settings set balance_due_days = v_days where id = 1;
      v_changed := array_append(v_changed, 'balance_due_days');
    end if;
  end if;

  if cardinality(v_changed) > 0 then
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

  if v_b.status in ('confirmed', 'completed') then
    select jsonb_build_object(
        'address', a.address,
        'wifi_name', a.wifi_name,
        'wifi_password', a.wifi_password,
        'door_code', a.door_code,
        'notes', case when v_loc in ('ar', 'es')
          then coalesce(to_jsonb(a) ->> ('notes_' || v_loc), a.notes)
          else a.notes end)
      into v_access
      from public.stay_access a
      where a.stay_id = v_b.stay_id;
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
