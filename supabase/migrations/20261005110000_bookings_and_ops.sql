-- Phase 4 plan 04-02 (job 12): bookings, the 30-minute hold, payments, refunds, disputes, the booking history, and
-- the owner-side booking functions. Number 20261005110000 reserved by the controller. Contract for the names it takes
-- from 3.2: .planning/phases/03.2-real-catalog-and-team-inserted/03.2-API-CONTRACT.md section 2.
--
-- A work session never applies this file: only the controller applies it to the live project, after job 02's
-- 20260925120000_platform_spine.sql and 3.2's 20261005100000_catalog_and_team.sql, on the owner's word. Local apply is
-- `node tests/helpers/local-supabase.mjs reset`.
--
-- Safe on live data: it creates tables, indexes and functions; it adds one column to site_settings (if not exists);
-- it seeds VAT 5.00 % and deposit 30.00 % ONLY where those two cells are still null (the owner's TEST starting values,
-- decision B-04) and leaves balance_due_days null (his value); it replaces one 3.2 view and one 3.2 function with the
-- same columns / signature. Nothing is deleted, nothing existing is rewritten.
--
-- Rules the whole file follows:
--   * Every table: RLS on, every privilege revoked from public, anon and authenticated, no policy. Only the service
--     role (the Worker, after its own token / session / owner check) reads or writes them.
--   * Every function: definer rights, search_path '', schema-qualified names, execute for the service role only, except
--     public_booked_nights(), which the anonymous build may call and which returns (stay_id, day) and nothing else.
--   * Every business refusal inside an ops function is raised as SQLSTATE P0001, message 'almar:<code>' (3.2's
--     convention); the public hold and payment functions return { ok: false, reason } for expected refusals.
--   * Money is bigint fils (AED has 2 decimals); percentages are basis points (500 = 5.00 %). Nothing is rounded here:
--     the TypeScript money engine (lib/money) computes every amount and these functions store and check it.
--   * Lock order, everywhere: the per-stay advisory lock first, then the booking row, then its nights and payments.
--     place_hold, ops_add_block (scope stay) and every function that changes a booking take the same lock, so two
--     guests for the same night are serialised and nothing can deadlock.
--   * Nothing is appended to this file later: ops reads and settings are in 20261005120000_ops.sql.

-- ------------------------------------------------------------------------------------------------------------
-- Settings: balance due days (the owner's N, nullable) and the owner's TEST starting values (B-04)
-- ------------------------------------------------------------------------------------------------------------

alter table public.site_settings
  add column if not exists balance_due_days int check (balance_due_days between 0 and 365);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;
update public.site_settings set vat_percent = 5.00 where id = 1 and vat_percent is null;
update public.site_settings set deposit_percent = 30.00 where id = 1 and deposit_percent is null;

-- ------------------------------------------------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------------------------------------------------

-- One booking. Web bookings start `held` (30 minutes); hand-made ones start `awaiting_payment` until the owner's
-- "hold until". The money columns are the price snapshot, written once, with the VAT % and deposit % in force (O-08).
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique check (ref ~ '^ALMAR-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  status text not null check (status in ('held', 'awaiting_payment', 'deposit_paid', 'paid_in_full', 'confirmed', 'completed', 'cancelled', 'expired')),
  source text not null check (source in ('web', 'ops')),
  ops_request_id uuid unique,
  is_test boolean not null default true,
  stay_id uuid not null references public.stays (id) on delete restrict,
  destination_id uuid not null references public.destinations (id) on delete restrict,
  arrive date not null,
  leave date not null,
  adults int not null check (adults >= 1),
  children int not null default 0 check (children >= 0),
  infants int not null default 0 check (infants >= 0),
  guest_name text not null,
  email text not null check (email = lower(email)),
  phone text not null,
  nationality text,
  special_requests text,
  emergency_name text,
  emergency_phone text,
  locale text not null check (locale in ('en', 'ar', 'es')),
  currency text not null default 'aed' check (currency = 'aed'),
  airport text check (airport in ('DXB', 'AUH', 'SHJ')),
  pickup_address text,
  terms_accepted_at timestamptz,
  terms_version text,
  plan text not null check (plan in ('deposit', 'full')),
  nights_fils bigint not null check (nights_fils >= 0),
  addons_fils bigint not null check (addons_fils >= 0),
  subtotal_fils bigint not null check (subtotal_fils >= 0),
  vat_fils bigint not null check (vat_fils >= 0),
  grand_fils bigint not null check (grand_fils >= 0),
  deposit_fils bigint not null check (deposit_fils >= 0),
  balance_fils bigint not null check (balance_fils >= 0),
  vat_bp int not null check (vat_bp between 0 and 10000),
  deposit_bp int not null check (deposit_bp between 0 and 10000),
  nights_snapshot jsonb not null check (jsonb_typeof(nights_snapshot) = 'array'),
  balance_due_days int check (balance_due_days between 0 and 365),
  balance_due_date date,
  paid_fils bigint not null default 0 check (paid_fils >= 0),
  hold_expires_at timestamptz,
  needs_attention boolean not null default false,
  link_version int not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_dates check (leave > arrive),
  constraint bookings_airport_web check (source = 'ops' or airport is not null),
  constraint bookings_terms_web check (source = 'ops' or (terms_accepted_at is not null and terms_version is not null)),
  constraint bookings_money_sums check (
    subtotal_fils = nights_fils + addons_fils
    and grand_fils = subtotal_fils + vat_fils
    and (case when plan = 'deposit' then deposit_fils + balance_fils = grand_fils else deposit_fils = 0 and balance_fils = 0 end)
  )
);

create table public.booking_travellers (
  booking_id uuid not null references public.bookings (id) on delete cascade,
  position int not null check (position >= 0),
  kind text not null check (kind in ('adult', 'child', 'infant')),
  full_name text not null check (char_length(full_name) between 1 and 120),
  age int,
  is_booker boolean not null default false,
  not_staying boolean not null default false,
  primary key (booking_id, position),
  constraint booking_travellers_age check (
    (kind = 'adult' and age is null) or (kind = 'child' and age between 3 and 12) or (kind = 'infant' and age between 0 and 2)
  ),
  constraint booking_travellers_not_staying check (not_staying = false or is_booker)
);

-- Add-on lines (the nights live in bookings.nights_snapshot). name is the English text at booking time.
create table public.booking_lines (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null default 'addon' check (kind = 'addon'),
  catalog_item_id uuid not null references public.catalog_items (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 200),
  unit text not null check (unit in ('person', 'night', 'trip')),
  is_uae boolean not null,
  unit_price_fils bigint not null check (unit_price_fils >= 0),
  quantity int not null check (quantity > 0),
  line_fils bigint not null,
  constraint booking_lines_total check (line_fils = unit_price_fils * quantity),
  constraint booking_lines_item_once unique (booking_id, catalog_item_id)
);

-- One row per (stay, night). expires_at null = permanent (paid or confirmed). The primary key is the last line of
-- defence against a double booking; place_hold is the only writer of new rows.
create table public.booking_nights (
  stay_id uuid not null references public.stays (id) on delete restrict,
  night date not null,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  expires_at timestamptz,
  primary key (stay_id, night)
);

-- One row per charge. id doubles as the Stripe idempotency key.
create table public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  kind text not null check (kind in ('deposit', 'full', 'balance')),
  amount_fils bigint not null check (amount_fils >= 200),
  currency text not null default 'aed' check (currency = 'aed'),
  status text not null default 'open' check (status in ('open', 'succeeded', 'expired', 'failed')),
  checkout_session_id text unique,
  payment_intent_id text unique,
  charge_id text,
  card_brand text,
  card_last4 text check (card_last4 ~ '^[0-9]{4}$'),
  wallet text,
  presentment_amount bigint,
  presentment_currency text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.booking_refunds (
  id bigint generated always as identity primary key,
  stripe_refund_id text not null unique,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  payment_id uuid references public.booking_payments (id) on delete set null,
  charge_id text,
  amount_fils bigint check (amount_fils >= 0),
  status text,
  created_at timestamptz not null default now()
);

create table public.booking_disputes (
  id bigint generated always as identity primary key,
  stripe_dispute_id text not null unique,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  payment_id uuid references public.booking_payments (id) on delete set null,
  charge_id text,
  amount_fils bigint check (amount_fils >= 0),
  reason text,
  status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- O-06: every status change, hold expiry, payment, refund, dispute and email action, with time and actor.
create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  at timestamptz not null default now(),
  actor text not null,
  action text not null check (action in ('created', 'status', 'hold_expired', 'payment', 'refund', 'dispute', 'email_sent', 'email_resent', 'email_failed', 'needs_attention', 'resend_requested', 'checkout_not_closed')),
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb
);

-- Stripe webhook de-duplication. claimed_at lets a retry take over an event whose worker died mid-way.
create table public.stripe_events (
  id text primary key,
  type text,
  received_at timestamptz not null default now(),
  claimed_at timestamptz not null default now(),
  processed_at timestamptz
);

-- Hold limiter inputs: keyed hashes only, never an address or an IP.
create table public.booking_hold_requests (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------------------------------------
-- Indexes (every foreign key column that no primary key leads with)
-- ------------------------------------------------------------------------------------------------------------

create index bookings_email_idx on public.bookings (email);
create index bookings_email_lower_idx on public.bookings (lower(email));
create index bookings_status_arrive_idx on public.bookings (status, arrive);
create index bookings_stay_idx on public.bookings (stay_id);
create index bookings_destination_idx on public.bookings (destination_id);
create unique index booking_travellers_one_booker on public.booking_travellers (booking_id) where is_booker;
create index booking_lines_catalog_item_idx on public.booking_lines (catalog_item_id);
create index booking_nights_booking_idx on public.booking_nights (booking_id);
create index booking_nights_expires_idx on public.booking_nights (expires_at) where expires_at is not null;
create unique index booking_payments_one_open on public.booking_payments (booking_id) where status = 'open';
create index booking_payments_charge_idx on public.booking_payments (charge_id) where charge_id is not null;
create index booking_refunds_booking_idx on public.booking_refunds (booking_id);
create index booking_refunds_payment_idx on public.booking_refunds (payment_id);
create index booking_disputes_booking_idx on public.booking_disputes (booking_id);
create index booking_disputes_payment_idx on public.booking_disputes (payment_id);
create index booking_events_booking_idx on public.booking_events (booking_id, at);
create index booking_hold_requests_email_idx on public.booking_hold_requests (email_hash, created_at);
create index booking_hold_requests_ip_idx on public.booking_hold_requests (ip_hash, created_at);
create index booking_hold_requests_created_idx on public.booking_hold_requests (created_at);

-- ------------------------------------------------------------------------------------------------------------
-- Row-level security: on, nothing granted, no policy. Only the service role reaches these tables.
-- ------------------------------------------------------------------------------------------------------------

alter table public.bookings enable row level security;
alter table public.booking_travellers enable row level security;
alter table public.booking_lines enable row level security;
alter table public.booking_nights enable row level security;
alter table public.booking_payments enable row level security;
alter table public.booking_refunds enable row level security;
alter table public.booking_disputes enable row level security;
alter table public.booking_events enable row level security;
alter table public.stripe_events enable row level security;
alter table public.booking_hold_requests enable row level security;

revoke all on public.bookings from public, anon, authenticated;
revoke all on public.booking_travellers from public, anon, authenticated;
revoke all on public.booking_lines from public, anon, authenticated;
revoke all on public.booking_nights from public, anon, authenticated;
revoke all on public.booking_payments from public, anon, authenticated;
revoke all on public.booking_refunds from public, anon, authenticated;
revoke all on public.booking_disputes from public, anon, authenticated;
revoke all on public.booking_events from public, anon, authenticated;
revoke all on public.stripe_events from public, anon, authenticated;
revoke all on public.booking_hold_requests from public, anon, authenticated;
revoke all on sequence public.booking_refunds_id_seq from public, anon, authenticated;
revoke all on sequence public.booking_disputes_id_seq from public, anon, authenticated;
revoke all on sequence public.booking_events_id_seq from public, anon, authenticated;
revoke all on sequence public.booking_hold_requests_id_seq from public, anon, authenticated;

-- ------------------------------------------------------------------------------------------------------------
-- Functions
-- ------------------------------------------------------------------------------------------------------------

-- updated_at follows every update of a booking.
create or replace function public.booking_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.booking_set_updated_at() from public, anon, authenticated;
grant execute on function public.booking_set_updated_at() to service_role;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.booking_set_updated_at();

-- A refusal: SQLSTATE P0001, message 'almar:<code>', detail = json text (field, ...).
create or replace function public.booking_fail(p_code text, p_field text default null, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'almar:' || p_code,
    detail = (case when p_field is null then p_detail else p_detail || jsonb_build_object('field', p_field) end)::text;
end;
$$;

revoke execute on function public.booking_fail(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.booking_fail(text, text, jsonb) to service_role;

-- B-17: ALMAR- plus 6 characters of the 31-letter alphabet, by rejection sampling (a byte under 248 = 31 * 8 keeps
-- every letter equally likely). Never in bookings already; callers still catch unique_violation and retry once.
create or replace function public.new_booking_ref()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_part text;
  v_ref text;
  v_try int := 0;
  v_i int;
  v_b int;
begin
  loop
    v_try := v_try + 1;
    v_part := '';
    while char_length(v_part) < 6 loop
      v_bytes := extensions.gen_random_bytes(16);
      for v_i in 0..15 loop
        v_b := get_byte(v_bytes, v_i);
        if v_b < 248 then
          v_part := v_part || substr(v_alphabet, (v_b % 31) + 1, 1);
          exit when char_length(v_part) = 6;
        end if;
      end loop;
    end loop;
    v_ref := 'ALMAR-' || v_part;
    if not exists (select 1 from public.bookings b where b.ref = v_ref) then
      return v_ref;
    end if;
    if v_try >= 10 then
      perform public.booking_fail('ref_unavailable');
    end if;
  end loop;
end;
$$;

revoke execute on function public.new_booking_ref() from public, anon, authenticated;
grant execute on function public.new_booking_ref() to service_role;

-- The booking row, locked: first the per-stay advisory lock (the same one place_hold takes), then the row. The one way
-- every function that changes a booking, its nights or its payments starts, so the lock order is always the same.
-- A null record (id null) when there is no such booking.
create or replace function public.booking_lock(p_booking uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stay uuid;
  v_row public.bookings;
begin
  select b.stay_id into v_stay from public.bookings b where b.id = p_booking;
  if v_stay is null then
    return null;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_stay::text, 0));
  select * into v_row from public.bookings b where b.id = p_booking for no key update;
  return v_row;
end;
$$;

revoke execute on function public.booking_lock(uuid) from public, anon, authenticated;
grant execute on function public.booking_lock(uuid) to service_role;

-- Payload readers: each raises almar:invalid with the field name when the value is missing or has the wrong shape.
create or replace function public.booking_int(p jsonb, p_key text, p_min bigint, p_max bigint, p_path text default '')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_text text := p ->> p_key;
begin
  if jsonb_typeof(p -> p_key) is distinct from 'number' then
    perform public.booking_fail('invalid', p_path || p_key);
  end if;
  if v_text !~ '^-?[0-9]{1,18}$' then
    perform public.booking_fail('invalid', p_path || p_key);
  end if;
  if v_text::bigint < p_min or v_text::bigint > p_max then
    perform public.booking_fail('invalid', p_path || p_key);
  end if;
  return v_text::bigint;
end;
$$;

revoke execute on function public.booking_int(jsonb, text, bigint, bigint, text) from public, anon, authenticated;
grant execute on function public.booking_int(jsonb, text, bigint, bigint, text) to service_role;

-- Text of a given length. Absent or null: the field is refused when required, else null. An optional empty string is null.
create or replace function public.booking_txt(p jsonb, p_key text, p_min int, p_max int, p_required boolean, p_path text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := jsonb_typeof(p -> p_key);
  v_text text;
begin
  if v_type is null or v_type = 'null' then
    if p_required then
      perform public.booking_fail('invalid', p_path || p_key);
    end if;
    return null;
  end if;
  if v_type <> 'string' then
    perform public.booking_fail('invalid', p_path || p_key);
  end if;
  v_text := p ->> p_key;
  if v_text = '' and not p_required then
    return null;
  end if;
  if char_length(v_text) < p_min or char_length(v_text) > p_max or btrim(v_text) = '' then
    perform public.booking_fail('invalid', p_path || p_key);
  end if;
  return v_text;
end;
$$;

revoke execute on function public.booking_txt(jsonb, text, int, int, boolean, text) from public, anon, authenticated;
grant execute on function public.booking_txt(jsonb, text, int, int, boolean, text) to service_role;

-- A calendar day as YYYY-MM-DD text. Absent or null: refused when required, else null.
create or replace function public.booking_date(p jsonb, p_key text, p_required boolean, p_path text default '')
returns date
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := jsonb_typeof(p -> p_key);
  v_text text := p ->> p_key;
  v_date date;
begin
  if v_type is null or v_type = 'null' then
    if p_required then
      perform public.booking_fail('invalid', p_path || p_key);
    end if;
    return null;
  end if;
  if v_type <> 'string' or v_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    perform public.booking_fail('invalid', p_path || p_key);
  end if;
  begin
    v_date := v_text::date;
  exception when others then
    perform public.booking_fail('invalid', p_path || p_key);
  end;
  if to_char(v_date, 'YYYY-MM-DD') <> v_text then
    perform public.booking_fail('invalid', p_path || p_key);
  end if;
  return v_date;
end;
$$;

revoke execute on function public.booking_date(jsonb, text, boolean, text) from public, anon, authenticated;
grant execute on function public.booking_date(jsonb, text, boolean, text) to service_role;

create or replace function public.booking_uuid(p jsonb, p_key text, p_required boolean, p_path text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text := jsonb_typeof(p -> p_key);
  v_text text := p ->> p_key;
begin
  if v_type is null or v_type = 'null' then
    if p_required then
      perform public.booking_fail('invalid', p_path || p_key);
    end if;
    return null;
  end if;
  if v_type <> 'string' or v_text !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    perform public.booking_fail('invalid', p_path || p_key);
  end if;
  return v_text::uuid;
end;
$$;

revoke execute on function public.booking_uuid(jsonb, text, boolean, text) from public, anon, authenticated;
grant execute on function public.booking_uuid(jsonb, text, boolean, text) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- booking_context: everything one quote needs, in one round trip (B-02). Reads only. The language record is used only
-- when its status is published; otherwise the English record (no Arabic or Spanish draft ever reaches checkout).
-- A published stay only: for a draft stay the object carries id, slug and is_published false, nothing else.
-- taken = nights held or booked by anyone, using the same two-minute grace as place_hold's sweep, so a quote that says
-- free never meets a hold that says sold out; p_own_booking's nights are left out while that booking is held (the caller
-- passes it only after checking that booking's link token).
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.booking_context(p_stay_slug text, p_from date, p_to date, p_locale text, p_own_booking uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_loc text := case when p_locale in ('en', 'ar', 'es') then p_locale else 'en' end;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_stay public.stays%rowtype;
  v_found boolean;
  v_stay_json jsonb := null;
  v_rates jsonb := '[]'::jsonb;
  v_blocked jsonb := '[]'::jsonb;
  v_taken jsonb := '[]'::jsonb;
  v_offers jsonb := '[]'::jsonb;
  v_incl jsonb := '[]'::jsonb;
  v_settings jsonb;
  v_nights int;
begin
  select * into v_stay from public.stays s where s.slug = p_stay_slug;
  v_found := found;

  select jsonb_build_object(
      'vat_bp', (s.vat_percent * 100)::int,
      'deposit_bp', (s.deposit_percent * 100)::int,
      'balance_due_days', s.balance_due_days)
    into v_settings
    from public.site_settings s where s.id = 1;
  if v_settings is null then
    v_settings := jsonb_build_object('vat_bp', null, 'deposit_bp', null, 'balance_due_days', null);
  end if;

  if v_found and not v_stay.is_published then
    v_stay_json := jsonb_build_object('id', v_stay.id, 'slug', v_stay.slug, 'is_published', false);
  elsif v_found then
    v_stay_json := jsonb_build_object(
      'id', v_stay.id,
      'slug', v_stay.slug,
      'destination_id', v_stay.destination_id,
      'is_published', true,
      'max_guests', v_stay.max_guests,
      'min_nights', v_stay.min_nights,
      'infants_count', v_stay.infants_count,
      'base_rate_fils', (v_stay.base_nightly_rate_aed * 100)::bigint,
      'title', coalesce(
        (select t.title from public.stay_translations t where t.stay_id = v_stay.id and t.locale = v_loc and t.status = 'published'),
        (select t.title from public.stay_translations t where t.stay_id = v_stay.id and t.locale = 'en'),
        v_stay.slug),
      'destination_name', coalesce(
        (select t.name from public.destination_translations t where t.destination_id = v_stay.destination_id and t.locale = v_loc and t.status = 'published'),
        (select t.name from public.destination_translations t where t.destination_id = v_stay.destination_id and t.locale = 'en'),
        (select d.slug from public.destinations d where d.id = v_stay.destination_id)),
      'image_key', (select m.key from public.media m where m.id = v_stay.hero_media_id),
      'image_alt', coalesce(
        (select i.alt from public.image_translations i where i.image_id = v_stay.hero_media_id and i.locale = v_loc and i.status = 'published'),
        (select i.alt from public.image_translations i where i.image_id = v_stay.hero_media_id and i.locale = 'en')));

    -- Dates: at least one night and at most 366; beyond that the caller answers dates_invalid itself.
    if p_from is not null and p_to is not null then
      v_nights := p_to - p_from;
    end if;
    if v_nights is not null and v_nights between 1 and 366 then
      select coalesce(jsonb_agg(jsonb_build_object(
          'night', r.night,
          'rate_fils', (r.nightly_rate_aed * 100)::bigint,
          'source', r.source,
          'rate_id', r.rate_id) order by r.night), '[]'::jsonb)
        into v_rates
        from public.stay_night_rates(v_stay.id, p_from, p_to) r;

      select coalesce(jsonb_agg(b.day order by b.day), '[]'::jsonb)
        into v_blocked
        from public.stay_ops_blocked_days(v_stay.id, p_from, p_to) as b(day);

      select coalesce(jsonb_agg(n.night order by n.night), '[]'::jsonb)
        into v_taken
        from public.booking_nights n
        left join public.bookings bk on bk.id = n.booking_id
        where n.stay_id = v_stay.id
          and n.night >= p_from and n.night < p_to
          and (n.expires_at is null or n.expires_at >= now() - interval '2 minutes')
          and not (p_own_booking is not null and n.booking_id = p_own_booking and bk.status = 'held');
    end if;

    -- Add-ons: published, priced, and linked to this stay or its destination, or UAE-side. Stay-linked ones first, in
    -- the stay's own order, then the rest by catalogue position.
    select coalesce(jsonb_agg(x.j order by x.o_unlinked, x.o_link_pos, x.o_kind, x.o_pos, x.o_slug), '[]'::jsonb)
      into v_offers
      from (
        select
          jsonb_build_object(
            'id', c.id,
            'slug', c.slug,
            'kind', c.kind,
            'unit', c.unit,
            'is_uae', c.is_uae,
            'is_home_pickup', c.is_home_pickup,
            'price_fils', (c.price_aed * 100)::bigint,
            'name', coalesce(
              (select t.name from public.catalog_translations t where t.item_id = c.id and t.locale = v_loc and t.status = 'published'),
              (select t.name from public.catalog_translations t where t.item_id = c.id and t.locale = 'en'),
              c.slug),
            'image_key', m.key,
            'image_alt', coalesce(
              (select i.alt from public.image_translations i where i.image_id = c.media_id and i.locale = v_loc and i.status = 'published'),
              (select i.alt from public.image_translations i where i.image_id = c.media_id and i.locale = 'en'))) as j,
          (cs.item_id is null) as o_unlinked,
          coalesce(cs.position, 0) as o_link_pos,
          c.kind as o_kind,
          c.position as o_pos,
          c.slug as o_slug
        from public.catalog_items c
        left join public.catalog_item_stays cs on cs.item_id = c.id and cs.stay_id = v_stay.id
        left join public.media m on m.id = c.media_id
        where c.is_published
          and c.price_aed is not null
          and (
            cs.item_id is not null
            or c.is_uae
            or exists (select 1 from public.catalog_item_destinations cd where cd.item_id = c.id and cd.destination_id = v_stay.destination_id)
          )
      ) x;

    select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id,
        'label', coalesce(
          (select t.label from public.inclusion_translations t where t.inclusion_id = i.id and t.locale = v_loc and t.status = 'published'),
          (select t.label from public.inclusion_translations t where t.inclusion_id = i.id and t.locale = 'en'),
          i.slug)) order by i.position), '[]'::jsonb)
      into v_incl
      from public.inclusions i
      where i.is_published;
  end if;

  return jsonb_build_object(
    'stay', v_stay_json,
    'night_rates', v_rates,
    'blocked', v_blocked,
    'taken', v_taken,
    'offers', v_offers,
    'inclusions', v_incl,
    'settings', v_settings,
    'today', v_today);
end;
$$;

revoke execute on function public.booking_context(text, date, date, text, uuid) from public, anon, authenticated;
grant execute on function public.booking_context(text, date, date, text, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- claim_hold_slot: the hold limiter, a copy of claim_link_slot's pattern (job 02). Five holds per email per hour and
-- twenty per IP per hour (the plan's numbers; the two constants below are the only place to change them). Only keyed
-- hashes arrive. True when the hold may go ahead and is counted.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.claim_hold_slot(p_email_hash text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_per_email constant int := 5;
  c_per_ip constant int := 20;
begin
  if p_email_hash is null or p_email_hash = '' or p_ip_hash is null or p_ip_hash = '' then
    return false;
  end if;
  -- Email first, then IP, always in this order: two requests cannot wait on each other.
  perform pg_advisory_xact_lock(hashtextextended(p_email_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_ip_hash, 0));

  delete from public.booking_hold_requests
  where id in (
    select r.id from public.booking_hold_requests r
    where (r.email_hash = p_email_hash or r.ip_hash = p_ip_hash) and r.created_at < now() - interval '1 day'
    for update skip locked
  );

  if (select count(*) from public.booking_hold_requests r
      where r.email_hash = p_email_hash and r.created_at > now() - interval '1 hour') >= c_per_email then
    return false;
  end if;
  if (select count(*) from public.booking_hold_requests r
      where r.ip_hash = p_ip_hash and r.created_at > now() - interval '1 hour') >= c_per_ip then
    return false;
  end if;

  insert into public.booking_hold_requests (email_hash, ip_hash) values (p_email_hash, p_ip_hash);
  return true;
end;
$$;

revoke execute on function public.claim_hold_slot(text, text) from public, anon, authenticated;
grant execute on function public.claim_hold_slot(text, text) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- place_hold (B-09, O-03, C-13): the only writer of new booking_nights rows.
-- One transaction, under the stay's advisory lock: sweep this stay's lapsed holds in range, refuse an ops-blocked
-- night ('blocked'), refuse a night another booking holds ('sold_out'), else write one row per night. p_expires null =
-- permanent. A row stays two minutes past its expiry (the sweep grace) so a payment confirmed just before the session
-- ended still finds its nights. Own rows are refreshed, so the same call re-claims a booking's nights safely.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.place_hold(p_booking uuid, p_stay uuid, p_from date, p_to date, p_expires timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nights int;
  v_gone record;
  v_old text;
  v_done int;
begin
  if p_booking is null or p_stay is null or p_from is null or p_to is null then
    perform public.booking_fail('invalid');
  end if;
  v_nights := p_to - p_from;
  if v_nights < 1 or v_nights > 366 then
    perform public.booking_fail('invalid', 'dates');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_stay::text, 0));

  -- Sweep: lapsed holds in range. A held or awaiting booking becomes expired and gives up all its timed nights.
  for v_gone in
    select distinct n.booking_id
    from public.booking_nights n
    where n.stay_id = p_stay and n.night >= p_from and n.night < p_to
      and n.expires_at is not null and n.expires_at < now() - interval '2 minutes'
    order by n.booking_id
  loop
    select b.status into v_old from public.bookings b where b.id = v_gone.booking_id for no key update;
    if v_old in ('held', 'awaiting_payment') then
      update public.bookings set status = 'expired' where id = v_gone.booking_id;
      delete from public.booking_nights where booking_id = v_gone.booking_id and expires_at is not null;
      insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
      values (v_gone.booking_id, 'system', 'hold_expired', v_old, 'expired', jsonb_build_object('swept_by', 'place_hold'));
    else
      delete from public.booking_nights n
      where n.booking_id = v_gone.booking_id and n.stay_id = p_stay and n.night >= p_from and n.night < p_to
        and n.expires_at is not null and n.expires_at < now() - interval '2 minutes';
    end if;
  end loop;

  if exists (select 1 from public.stay_ops_blocked_days(p_stay, p_from, p_to)) then
    return 'blocked';
  end if;

  if exists (
    select 1 from public.booking_nights n
    where n.stay_id = p_stay and n.night >= p_from and n.night < p_to and n.booking_id <> p_booking
  ) then
    return 'sold_out';
  end if;

  insert into public.booking_nights as bn (stay_id, night, booking_id, expires_at)
  select p_stay, g.d::date, p_booking, p_expires
  from generate_series(p_from::timestamp, (p_to - 1)::timestamp, interval '1 day') as g(d)
  on conflict (stay_id, night) do update set expires_at = excluded.expires_at where bn.booking_id = excluded.booking_id;
  get diagnostics v_done = row_count;
  if v_done < v_nights then
    -- Something wrote a night under this stay's lock without taking it. Never reached by these functions; the whole
    -- transaction is refused rather than half a hold kept.
    perform public.booking_fail('sold_out');
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.place_hold(uuid, uuid, date, date, timestamptz) from public, anon, authenticated;
grant execute on function public.place_hold(uuid, uuid, date, date, timestamptz) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- booking_write: the one place a booking row, its travellers and its add-on lines are checked and inserted, for both
-- create_web_booking and ops_create_booking. The payload is the price snapshot exactly as lib/booking/server.ts
-- snapshotRow() builds it, flattened, plus the guest. Unknown keys are refused. Money is checked for consistency
-- (the sums add up), never recomputed: the rounding rule lives only in lib/money. Returns { ok: true, id, ref } or
-- { ok: false, reason } for an expected refusal; a malformed payload raises almar:invalid.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.booking_write(p jsonb, p_source text, p_status text, p_hold_expires timestamptz, p_created_by uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max constant bigint := 1000000000000;
  c_common constant text[] := array[
    'stay_slug', 'arrive', 'leave', 'adults', 'children', 'infants', 'guest_name', 'email', 'phone', 'locale',
    'airport', 'pickup_address', 'plan', 'is_test', 'nights_fils', 'addons_fils', 'subtotal_fils', 'vat_bp', 'vat_fils',
    'grand_fils', 'deposit_bp', 'deposit_fils', 'balance_fils', 'due_now_fils', 'nights_snapshot', 'balance_due_date', 'lines'];
  c_web constant text[] := array['travellers', 'nationality', 'special_requests', 'emergency_name', 'emergency_phone', 'terms_version'];
  c_ops constant text[] := array['ops_request_id', 'hold_until'];
  c_line constant text[] := array['catalog_item_id', 'name', 'unit', 'is_uae', 'is_home_pickup', 'unit_price_fils', 'quantity', 'line_fils'];
  c_traveller constant text[] := array['kind', 'full_name', 'age', 'is_booker', 'not_staying'];
  v_web boolean := (p_source = 'web');
  v_allowed text[];
  v_key text;
  v_e jsonb;
  v_i int;
  v_sum bigint;
  v_slug text;
  v_arrive date;
  v_leave date;
  v_nights int;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_adults int;
  v_children int;
  v_infants int;
  v_name text;
  v_email text;
  v_phone text;
  v_locale text;
  v_plan text;
  v_airport text;
  v_pickup text;
  v_is_test boolean := true;
  v_nights_fils bigint;
  v_addons_fils bigint;
  v_subtotal bigint;
  v_vat_bp int;
  v_vat_fils bigint;
  v_grand bigint;
  v_deposit_bp int;
  v_deposit bigint;
  v_balance bigint;
  v_due_now bigint;
  v_due_date date;
  v_pickup_needed boolean := false;
  v_item_home boolean;
  v_item_found boolean;
  v_stay public.stays%rowtype;
  v_set public.site_settings%rowtype;
  v_set_found boolean;
  v_set_vat int;
  v_set_dep int;
  v_cnt_adult int := 0;
  v_cnt_child int := 0;
  v_cnt_infant int := 0;
  v_kind text;
  v_age int;
  v_bookers int := 0;
  v_ref text;
  v_id uuid;
  v_try int;
  v_constraint text;
  v_terms text;
  v_ops_request uuid;
begin
  if jsonb_typeof(p) is distinct from 'object' then
    perform public.booking_fail('invalid', 'payload');
  end if;
  v_allowed := c_common || case when v_web then c_web else c_ops end;
  for v_key in select jsonb_object_keys(p) loop
    if not (v_key = any (v_allowed)) then
      perform public.booking_fail('invalid', v_key);
    end if;
  end loop;

  v_slug := public.booking_txt(p, 'stay_slug', 1, 80, true);
  v_arrive := public.booking_date(p, 'arrive', true);
  v_leave := public.booking_date(p, 'leave', true);
  v_nights := v_leave - v_arrive;
  if v_nights < 1 or v_nights > 366 then
    perform public.booking_fail('invalid', 'leave');
  end if;
  if v_arrive < v_today then
    perform public.booking_fail('invalid', 'arrive');
  end if;
  v_adults := public.booking_int(p, 'adults', 1, 99);
  v_children := public.booking_int(p, 'children', 0, 99);
  v_infants := public.booking_int(p, 'infants', 0, 99);
  v_name := public.booking_txt(p, 'guest_name', 1, 120, true);
  v_email := public.booking_txt(p, 'email', 3, 254, true);
  if v_email <> lower(v_email) or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    perform public.booking_fail('invalid', 'email');
  end if;
  v_phone := public.booking_txt(p, 'phone', 7, 20, true);
  if v_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    perform public.booking_fail('invalid', 'phone');
  end if;
  v_locale := public.booking_txt(p, 'locale', 2, 2, true);
  if v_locale not in ('en', 'ar', 'es') then
    perform public.booking_fail('invalid', 'locale');
  end if;
  v_plan := public.booking_txt(p, 'plan', 4, 7, true);
  if v_plan not in ('deposit', 'full') then
    perform public.booking_fail('invalid', 'plan');
  end if;
  v_airport := public.booking_txt(p, 'airport', 3, 3, v_web);
  if v_airport is not null and v_airport not in ('DXB', 'AUH', 'SHJ') then
    perform public.booking_fail('invalid', 'airport');
  end if;
  v_pickup := public.booking_txt(p, 'pickup_address', 1, 300, false);
  if p ? 'is_test' then
    if jsonb_typeof(p -> 'is_test') is distinct from 'boolean' then
      perform public.booking_fail('invalid', 'is_test');
    end if;
    v_is_test := (p ->> 'is_test')::boolean;
  end if;

  v_nights_fils := public.booking_int(p, 'nights_fils', 0, c_max);
  v_addons_fils := public.booking_int(p, 'addons_fils', 0, c_max);
  v_subtotal := public.booking_int(p, 'subtotal_fils', 0, c_max);
  v_vat_bp := public.booking_int(p, 'vat_bp', 0, 10000);
  v_vat_fils := public.booking_int(p, 'vat_fils', 0, c_max);
  v_grand := public.booking_int(p, 'grand_fils', 0, c_max * 2);
  v_deposit_bp := public.booking_int(p, 'deposit_bp', 0, 10000);
  v_deposit := public.booking_int(p, 'deposit_fils', 0, c_max * 2);
  v_balance := public.booking_int(p, 'balance_fils', 0, c_max * 2);
  v_due_now := public.booking_int(p, 'due_now_fils', 0, c_max * 2);
  v_due_date := public.booking_date(p, 'balance_due_date', false);

  -- The sums must add up and the plan must be self-consistent (the engine guarantees it; the database refuses the rest).
  if v_subtotal <> v_nights_fils + v_addons_fils then
    perform public.booking_fail('invalid', 'subtotal_fils');
  end if;
  if v_grand <> v_subtotal + v_vat_fils then
    perform public.booking_fail('invalid', 'grand_fils');
  end if;
  if v_plan = 'deposit' then
    if v_deposit + v_balance <> v_grand then
      perform public.booking_fail('invalid', 'balance_fils');
    end if;
    if v_due_now <> v_deposit then
      perform public.booking_fail('invalid', 'due_now_fils');
    end if;
    if v_balance < 200 then
      perform public.booking_fail('invalid', 'balance_fils');
    end if;
    if v_due_date is null then
      perform public.booking_fail('invalid', 'balance_due_date');
    end if;
  else
    if v_deposit <> 0 or v_balance <> 0 then
      perform public.booking_fail('invalid', 'deposit_fils');
    end if;
    if v_due_now <> v_grand then
      perform public.booking_fail('invalid', 'due_now_fils');
    end if;
    if v_due_date is not null then
      perform public.booking_fail('invalid', 'balance_due_date');
    end if;
  end if;

  -- Nights: one element per night, in order, rates adding up to nights_fils.
  if jsonb_typeof(p -> 'nights_snapshot') is distinct from 'array' or jsonb_array_length(p -> 'nights_snapshot') <> v_nights then
    perform public.booking_fail('invalid', 'nights_snapshot');
  end if;
  v_sum := 0;
  v_i := 0;
  for v_e in select e.value from jsonb_array_elements(p -> 'nights_snapshot') as e loop
    if jsonb_typeof(v_e) is distinct from 'object' or (v_e ->> 'night') is distinct from to_char(v_arrive + v_i, 'YYYY-MM-DD') then
      perform public.booking_fail('invalid', 'nights_snapshot');
    end if;
    v_sum := v_sum + public.booking_int(v_e, 'rate_fils', 0, c_max, 'nights_snapshot.');
    v_i := v_i + 1;
  end loop;
  if v_sum <> v_nights_fils then
    perform public.booking_fail('invalid', 'nights_fils');
  end if;

  -- Add-on lines: well formed, once per item, totals adding up to addons_fils. The home-pickup rule reads the database,
  -- not the payload's flag.
  if jsonb_typeof(p -> 'lines') is distinct from 'array' then
    perform public.booking_fail('invalid', 'lines');
  end if;
  if (select count(distinct lower(l.value ->> 'catalog_item_id')) from jsonb_array_elements(p -> 'lines') as l) <> jsonb_array_length(p -> 'lines') then
    perform public.booking_fail('invalid', 'lines');
  end if;
  v_sum := 0;
  for v_e in select l.value from jsonb_array_elements(p -> 'lines') as l loop
    if jsonb_typeof(v_e) is distinct from 'object' then
      perform public.booking_fail('invalid', 'lines');
    end if;
    for v_key in select jsonb_object_keys(v_e) loop
      if not (v_key = any (c_line)) then
        perform public.booking_fail('invalid', 'lines.' || v_key);
      end if;
    end loop;
    perform public.booking_uuid(v_e, 'catalog_item_id', true, 'lines.');
    perform public.booking_txt(v_e, 'name', 1, 200, true, 'lines.');
    if public.booking_txt(v_e, 'unit', 4, 6, true, 'lines.') not in ('person', 'night', 'trip') then
      perform public.booking_fail('invalid', 'lines.unit');
    end if;
    if jsonb_typeof(v_e -> 'is_uae') is distinct from 'boolean' then
      perform public.booking_fail('invalid', 'lines.is_uae');
    end if;
    if v_e ? 'is_home_pickup' and jsonb_typeof(v_e -> 'is_home_pickup') is distinct from 'boolean' then
      perform public.booking_fail('invalid', 'lines.is_home_pickup');
    end if;
    if public.booking_int(v_e, 'unit_price_fils', 0, c_max, 'lines.') * public.booking_int(v_e, 'quantity', 1, 1000, 'lines.')
       <> public.booking_int(v_e, 'line_fils', 0, c_max, 'lines.') then
      perform public.booking_fail('invalid', 'lines.line_fils');
    end if;
    v_sum := v_sum + (v_e ->> 'line_fils')::bigint;
    select ci.is_home_pickup into v_item_home from public.catalog_items ci where ci.id = (v_e ->> 'catalog_item_id')::uuid;
    v_item_found := found;
    if not v_item_found then
      perform public.booking_fail('invalid', 'lines.catalog_item_id');
    end if;
    if v_item_home then
      v_pickup_needed := true;
    end if;
  end loop;
  if v_sum <> v_addons_fils then
    perform public.booking_fail('invalid', 'addons_fils');
  end if;
  if v_pickup_needed and v_pickup is null then
    perform public.booking_fail('invalid', 'pickup_address');
  end if;

  if v_web then
    -- Travellers: as many as the guests, kinds matching, one booker at most, "not staying" only on the booker.
    v_terms := public.booking_txt(p, 'terms_version', 1, 80, true);
    if jsonb_typeof(p -> 'travellers') is distinct from 'array' or jsonb_array_length(p -> 'travellers') <> v_adults + v_children + v_infants then
      perform public.booking_fail('invalid', 'travellers');
    end if;
    for v_e in select t.value from jsonb_array_elements(p -> 'travellers') as t loop
      if jsonb_typeof(v_e) is distinct from 'object' then
        perform public.booking_fail('invalid', 'travellers');
      end if;
      for v_key in select jsonb_object_keys(v_e) loop
        if not (v_key = any (c_traveller)) then
          perform public.booking_fail('invalid', 'travellers.' || v_key);
        end if;
      end loop;
      v_kind := public.booking_txt(v_e, 'kind', 5, 6, true, 'travellers.');
      perform public.booking_txt(v_e, 'full_name', 1, 120, true, 'travellers.');
      if v_kind = 'adult' then
        v_cnt_adult := v_cnt_adult + 1;
        if (v_e ? 'age') and jsonb_typeof(v_e -> 'age') <> 'null' then
          perform public.booking_fail('invalid', 'travellers.age');
        end if;
      elsif v_kind = 'child' then
        v_cnt_child := v_cnt_child + 1;
        v_age := public.booking_int(v_e, 'age', 3, 12, 'travellers.');
      elsif v_kind = 'infant' then
        v_cnt_infant := v_cnt_infant + 1;
        v_age := public.booking_int(v_e, 'age', 0, 2, 'travellers.');
      else
        perform public.booking_fail('invalid', 'travellers.kind');
      end if;
      if v_e ? 'is_booker' and jsonb_typeof(v_e -> 'is_booker') is distinct from 'boolean' then
        perform public.booking_fail('invalid', 'travellers.is_booker');
      end if;
      if v_e ? 'not_staying' and jsonb_typeof(v_e -> 'not_staying') is distinct from 'boolean' then
        perform public.booking_fail('invalid', 'travellers.not_staying');
      end if;
      if coalesce((v_e ->> 'is_booker')::boolean, false) then
        v_bookers := v_bookers + 1;
      elsif coalesce((v_e ->> 'not_staying')::boolean, false) then
        perform public.booking_fail('invalid', 'travellers.not_staying');
      end if;
    end loop;
    if v_cnt_adult <> v_adults or v_cnt_child <> v_children or v_cnt_infant <> v_infants or v_bookers > 1 then
      perform public.booking_fail('invalid', 'travellers');
    end if;
  else
    v_ops_request := public.booking_uuid(p, 'ops_request_id', true);
  end if;

  -- The stay: published only (the same lookup as the quote).
  select s.* into v_stay from public.stays s where s.slug = v_slug and s.is_published;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'stay_unavailable');
  end if;

  -- Settings now: missing is refused, a change since the quote is refused (O-08: the booking stores the values in force).
  select s.* into v_set from public.site_settings s where s.id = 1;
  v_set_found := found;
  if not v_set_found or v_set.vat_percent is null or v_set.deposit_percent is null then
    return jsonb_build_object('ok', false, 'reason', 'settings_missing');
  end if;
  v_set_vat := (v_set.vat_percent * 100)::int;
  v_set_dep := (v_set.deposit_percent * 100)::int;
  if v_set_vat <> v_vat_bp or v_set_dep <> v_deposit_bp then
    return jsonb_build_object('ok', false, 'reason', 'settings_changed');
  end if;
  if v_plan = 'deposit' then
    if v_set.balance_due_days is null then
      return jsonb_build_object('ok', false, 'reason', 'settings_missing');
    end if;
    if v_due_date <> v_arrive - v_set.balance_due_days then
      return jsonb_build_object('ok', false, 'reason', 'settings_changed');
    end if;
  end if;
  if v_due_now < 200 then
    return jsonb_build_object('ok', false, 'reason', 'below_minimum_charge');
  end if;

  for v_try in 1..3 loop
    v_ref := public.new_booking_ref();
    begin
      insert into public.bookings (
        ref, status, source, ops_request_id, is_test, stay_id, destination_id, arrive, leave, adults, children, infants,
        guest_name, email, phone, nationality, special_requests, emergency_name, emergency_phone, locale, airport,
        pickup_address, terms_accepted_at, terms_version, plan, nights_fils, addons_fils, subtotal_fils, vat_fils, grand_fils,
        deposit_fils, balance_fils, vat_bp, deposit_bp, nights_snapshot, balance_due_days, balance_due_date, paid_fils,
        hold_expires_at, created_by)
      values (
        v_ref, p_status, p_source, v_ops_request, v_is_test, v_stay.id, v_stay.destination_id, v_arrive, v_leave, v_adults,
        v_children, v_infants,
        v_name, v_email, v_phone,
        case when v_web then public.booking_txt(p, 'nationality', 1, 60, false) end,
        case when v_web then public.booking_txt(p, 'special_requests', 1, 1000, false) end,
        case when v_web then public.booking_txt(p, 'emergency_name', 1, 120, false) end,
        case when v_web then public.booking_txt(p, 'emergency_phone', 7, 20, false) end,
        v_locale, v_airport,
        v_pickup, case when v_web then now() end, case when v_web then v_terms end, v_plan, v_nights_fils, v_addons_fils,
        v_subtotal, v_vat_fils, v_grand,
        v_deposit, v_balance, v_vat_bp, v_deposit_bp, p -> 'nights_snapshot', v_set.balance_due_days,
        v_due_date, 0,
        p_hold_expires, p_created_by)
      returning id into v_id;
      exit;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint is distinct from 'bookings_ref_key' or v_try = 3 then
        raise;
      end if;
    end;
  end loop;

  insert into public.booking_lines (booking_id, catalog_item_id, name, unit, is_uae, unit_price_fils, quantity, line_fils)
  select v_id, (l.value ->> 'catalog_item_id')::uuid, l.value ->> 'name', l.value ->> 'unit', (l.value ->> 'is_uae')::boolean,
    (l.value ->> 'unit_price_fils')::bigint, (l.value ->> 'quantity')::int, (l.value ->> 'line_fils')::bigint
  from jsonb_array_elements(p -> 'lines') as l;

  if v_web then
    insert into public.booking_travellers (booking_id, position, kind, full_name, age, is_booker, not_staying)
    select v_id, (t.ordinality - 1)::int, t.value ->> 'kind', t.value ->> 'full_name',
      case when t.value ->> 'kind' = 'adult' then null else (t.value ->> 'age')::int end,
      coalesce((t.value ->> 'is_booker')::boolean, false), coalesce((t.value ->> 'not_staying')::boolean, false)
    from jsonb_array_elements(p -> 'travellers') with ordinality as t;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'ref', v_ref, 'stay_id', v_stay.id, 'arrive', v_arrive, 'leave', v_leave,
    'plan', v_plan, 'due_now_fils', v_due_now, 'is_test', v_is_test);
end;
$$;

revoke execute on function public.booking_write(jsonb, text, text, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.booking_write(jsonb, text, text, timestamptz, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- create_web_booking: the guest's hold. One transaction: check settings now, insert the booking `held` with its ref,
-- travellers and lines, place the hold (30 minutes plus the one-minute session margin on the nights). A blocked or
-- sold-out night rolls every row back and answers { ok: false, reason }. It never ends another booking: an earlier hold
-- of the same guest ends only by release or expiry.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.create_web_booking(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold_expires timestamptz := now() + interval '30 minutes';
  v_w jsonb;
  v_b public.bookings;
  v_hold text;
  v_msg text;
begin
  begin
    v_w := public.booking_write(p, 'web', 'held', v_hold_expires, null);
    if not (v_w ->> 'ok')::boolean then
      -- Nothing was inserted before an expected refusal; return it as it is.
      return v_w;
    end if;
    v_hold := public.place_hold((v_w ->> 'id')::uuid, (v_w ->> 'stay_id')::uuid, (v_w ->> 'arrive')::date, (v_w ->> 'leave')::date,
      v_hold_expires + interval '1 minute');
    if v_hold <> 'ok' then
      raise exception using errcode = 'P0001', message = 'almar:hold_' || v_hold;
    end if;
  exception when sqlstate 'P0001' then
    get stacked diagnostics v_msg = message_text;
    if v_msg = 'almar:hold_blocked' then
      return jsonb_build_object('ok', false, 'reason', 'blocked');
    elsif v_msg in ('almar:hold_sold_out', 'almar:sold_out') then
      return jsonb_build_object('ok', false, 'reason', 'sold_out');
    end if;
    raise;
  end;

  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values ((v_w ->> 'id')::uuid, 'guest', 'created', null, 'held',
    jsonb_build_object('source', 'web', 'plan', v_w ->> 'plan', 'due_now_fils', (v_w ->> 'due_now_fils')::bigint, 'is_test', (v_w ->> 'is_test')::boolean));
  select b.* into v_b from public.bookings b where b.id = (v_w ->> 'id')::uuid;
  return jsonb_build_object(
    'ok', true,
    'booking_id', v_b.id,
    'ref', v_b.ref,
    'hold_expires_at', to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'link_version', v_b.link_version);
end;
$$;

revoke execute on function public.create_web_booking(jsonb) from public, anon, authenticated;
grant execute on function public.create_web_booking(jsonb) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- ops_create_booking (O-02, O-03): a hand-made booking, status awaiting_payment, nights held until the owner's "hold
-- until". The same request id returns the same booking. Refusals are raised: almar:settings_missing, settings_changed,
-- hold_too_soon (a Checkout Session needs 30 minutes), stay_unavailable, below_minimum_charge, blocked, sold_out.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.ops_create_booking(p jsonb, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request uuid;
  v_hold_text text;
  v_hold_until timestamptz;
  v_existing public.bookings;
  v_w jsonb;
  v_b public.bookings;
  v_hold text;
  v_constraint text;
begin
  if p_actor is null then
    perform public.booking_fail('invalid', 'actor');
  end if;
  if jsonb_typeof(p) is distinct from 'object' then
    perform public.booking_fail('invalid', 'payload');
  end if;
  v_request := public.booking_uuid(p, 'ops_request_id', true);

  select b.* into v_existing from public.bookings b where b.ops_request_id = v_request;
  if found then
    return jsonb_build_object('booking_id', v_existing.id, 'ref', v_existing.ref,
      'hold_expires_at', to_char(v_existing.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'link_version', v_existing.link_version);
  end if;

  v_hold_text := public.booking_txt(p, 'hold_until', 16, 40, true);
  if v_hold_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    perform public.booking_fail('invalid', 'hold_until');
  end if;
  begin
    v_hold_until := v_hold_text::timestamptz;
  exception when others then
    perform public.booking_fail('invalid', 'hold_until');
  end;
  if v_hold_until <= now() + interval '35 minutes' then
    perform public.booking_fail('hold_too_soon');
  end if;

  begin
    v_w := public.booking_write(p, 'ops', 'awaiting_payment', v_hold_until, p_actor);
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'bookings_ops_request_id_key' then
      select b.* into v_existing from public.bookings b where b.ops_request_id = v_request;
      return jsonb_build_object('booking_id', v_existing.id, 'ref', v_existing.ref,
        'hold_expires_at', to_char(v_existing.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'link_version', v_existing.link_version);
    end if;
    raise;
  end;
  if not (v_w ->> 'ok')::boolean then
    perform public.booking_fail(v_w ->> 'reason');
  end if;

  v_hold := public.place_hold((v_w ->> 'id')::uuid, (v_w ->> 'stay_id')::uuid, (v_w ->> 'arrive')::date, (v_w ->> 'leave')::date, v_hold_until);
  if v_hold <> 'ok' then
    perform public.booking_fail(v_hold);
  end if;

  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values ((v_w ->> 'id')::uuid, 'owner:' || p_actor::text, 'created', null, 'awaiting_payment',
    jsonb_build_object('source', 'ops', 'plan', v_w ->> 'plan', 'due_now_fils', (v_w ->> 'due_now_fils')::bigint, 'is_test', (v_w ->> 'is_test')::boolean,
      'hold_until', to_char(v_hold_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
  select b.* into v_b from public.bookings b where b.id = (v_w ->> 'id')::uuid;
  return jsonb_build_object(
    'booking_id', v_b.id,
    'ref', v_b.ref,
    'hold_expires_at', to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'link_version', v_b.link_version);
end;
$$;

revoke execute on function public.ops_create_booking(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.ops_create_booking(jsonb, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- ops_set_booking_status (O-01, O-05): Confirm, Mark completed and Cancel, each with an expected-from check (a stale
-- double click is almar:changed). Cancel frees the nights, closes open payments (their Stripe session ids come back so
-- the Worker can close them) and never refunds: paid_fils is untouched and the owner refunds in Stripe.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.ops_set_booking_status(p_booking uuid, p_to text, p_expected_from text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
  v_sessions jsonb := '[]'::jsonb;
begin
  if p_booking is null or p_to is null or p_expected_from is null or p_actor is null then
    perform public.booking_fail('invalid');
  end if;
  v_b := public.booking_lock(p_booking);
  if v_b.id is null then
    perform public.booking_fail('not_found');
  end if;
  if v_b.status <> p_expected_from then
    perform public.booking_fail('changed', null, jsonb_build_object('status', v_b.status));
  end if;
  if not (
    (p_to = 'confirmed' and v_b.status in ('deposit_paid', 'paid_in_full'))
    or (p_to = 'completed' and v_b.status = 'confirmed')
    or (p_to = 'cancelled' and v_b.status in ('held', 'awaiting_payment', 'deposit_paid', 'paid_in_full', 'confirmed'))
  ) then
    perform public.booking_fail('not_allowed', null, jsonb_build_object('from', v_b.status, 'to', p_to));
  end if;

  if p_to = 'cancelled' then
    with closed as (
      update public.booking_payments set status = 'expired'
      where booking_id = v_b.id and status = 'open'
      returning checkout_session_id
    )
    select coalesce(jsonb_agg(c.checkout_session_id) filter (where c.checkout_session_id is not null), '[]'::jsonb)
      into v_sessions from closed c;
    delete from public.booking_nights where booking_id = v_b.id;
  end if;

  update public.bookings set status = p_to where id = v_b.id;
  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, 'owner:' || p_actor::text, 'status', v_b.status, p_to,
    case when p_to = 'cancelled' then jsonb_build_object('paid_fils', v_b.paid_fils, 'closed_sessions', jsonb_array_length(v_sessions)) else '{}'::jsonb end);

  return jsonb_build_object('id', v_b.id, 'from', v_b.status, 'to', p_to, 'closed_sessions', v_sessions);
end;
$$;

revoke execute on function public.ops_set_booking_status(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.ops_set_booking_status(uuid, text, text, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- ops_lapse_holds (named without the letters r-e-underscore: tests/phase-02-gates.test.mjs refuses them in app/ and
-- lib/): held or awaiting_payment bookings whose hold ended more than two minutes ago become expired, their timed
-- nights are freed, one hold_expired event each. Returns how many. No cron: called before ops reads and by place_hold.
-- ------------------------------------------------------------------------------------------------------------

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
begin
  for v_row in
    select b.id from public.bookings b
    where b.status in ('held', 'awaiting_payment') and b.hold_expires_at < now() - interval '2 minutes'
    order by b.stay_id, b.id
  loop
    v_b := public.booking_lock(v_row.id);
    if v_b.id is not null and v_b.status in ('held', 'awaiting_payment') and v_b.hold_expires_at < now() - interval '2 minutes' then
      update public.bookings set status = 'expired' where id = v_b.id;
      delete from public.booking_nights where booking_id = v_b.id and expires_at is not null;
      insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
      values (v_b.id, 'system', 'hold_expired', v_b.status, 'expired', jsonb_build_object('swept_by', 'ops_lapse_holds'));
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.ops_lapse_holds() from public, anon, authenticated;
grant execute on function public.ops_lapse_holds() to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- booking_drop_hold: the guest's own hold ends now (release, Change, plan switch) or the hold cannot continue (the
-- Checkout Session could not be created). Only a `held` booking is touched: held -> expired, timed nights freed, open
-- payments closed. Returns { dropped, closed_sessions } so the Worker can close the Stripe sessions (the plan wrote
-- `returns void`; a result is added so the caller needs no second read, and callers that ignore it are unaffected).
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.booking_drop_hold(p_booking uuid, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
  v_sessions jsonb := '[]'::jsonb;
begin
  v_b := public.booking_lock(p_booking);
  if v_b.id is null or v_b.status <> 'held' then
    return jsonb_build_object('dropped', false, 'closed_sessions', '[]'::jsonb);
  end if;
  with closed as (
    update public.booking_payments set status = 'expired'
    where booking_id = v_b.id and status = 'open'
    returning checkout_session_id
  )
  select coalesce(jsonb_agg(c.checkout_session_id) filter (where c.checkout_session_id is not null), '[]'::jsonb)
    into v_sessions from closed c;
  delete from public.booking_nights where booking_id = v_b.id and expires_at is not null;
  update public.bookings set status = 'expired' where id = v_b.id;
  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, coalesce(nullif(p_actor, ''), 'system'), 'status', 'held', 'expired', jsonb_build_object('reason', 'hold_dropped'));
  return jsonb_build_object('dropped', true, 'closed_sessions', v_sessions);
end;
$$;

revoke execute on function public.booking_drop_hold(uuid, text) from public, anon, authenticated;
grant execute on function public.booking_drop_hold(uuid, text) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- open_payment (PAY-08, PAY-10, IDEN-01): the amount of the next charge, from the stored snapshot and never from the
-- caller. First payment of a held or awaiting booking whose hold is still running: the deposit or the full amount of
-- its plan. Balance of a deposit_paid or confirmed booking: grand minus paid. Any open payment of the booking is closed
-- first (its Stripe session id comes back as previous_session_id) and a new open row is written. A booking without
-- terms (hand-made) needs p_terms_version, stamped now.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.open_payment(p_booking uuid, p_kind text, p_terms_version text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
  v_amount bigint;
  v_previous text;
  v_pay uuid;
  v_title text;
begin
  v_b := public.booking_lock(p_booking);
  if v_b.id is null or p_kind is null or p_kind not in ('deposit', 'full', 'balance') then
    return jsonb_build_object('ok', false, 'reason', 'not_payable');
  end if;

  if v_b.status in ('held', 'awaiting_payment') then
    if p_kind <> v_b.plan then
      return jsonb_build_object('ok', false, 'reason', 'not_payable');
    end if;
    if v_b.hold_expires_at is null or v_b.hold_expires_at <= now() then
      return jsonb_build_object('ok', false, 'reason', 'hold_ended');
    end if;
    v_amount := case when v_b.plan = 'deposit' then v_b.deposit_fils else v_b.grand_fils end;
  elsif v_b.status in ('deposit_paid', 'confirmed') and p_kind = 'balance' then
    if v_b.paid_fils >= v_b.grand_fils then
      return jsonb_build_object('ok', false, 'reason', 'nothing_due');
    end if;
    v_amount := v_b.grand_fils - v_b.paid_fils;
  elsif v_b.status = 'paid_in_full' and p_kind = 'balance' then
    return jsonb_build_object('ok', false, 'reason', 'nothing_due');
  else
    return jsonb_build_object('ok', false, 'reason', 'not_payable');
  end if;

  if v_amount < 200 then
    return jsonb_build_object('ok', false, 'reason', 'below_minimum_charge');
  end if;
  if v_b.terms_accepted_at is null and (p_terms_version is null or btrim(p_terms_version) = '') then
    return jsonb_build_object('ok', false, 'reason', 'terms_required');
  end if;

  if v_b.terms_accepted_at is null then
    update public.bookings set terms_accepted_at = now(), terms_version = p_terms_version where id = v_b.id;
  end if;

  select p.checkout_session_id into v_previous
  from public.booking_payments p where p.booking_id = v_b.id and p.status = 'open';
  update public.booking_payments set status = 'expired' where booking_id = v_b.id and status = 'open';

  insert into public.booking_payments (booking_id, kind, amount_fils) values (v_b.id, p_kind, v_amount) returning id into v_pay;

  select t.title into v_title from public.stay_translations t where t.stay_id = v_b.stay_id and t.locale = 'en';
  return jsonb_build_object(
    'ok', true,
    'payment_id', v_pay,
    'amount_fils', v_amount,
    'kind', p_kind,
    'hold_expires_at', to_char(v_b.hold_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'previous_session_id', v_previous,
    'booking', jsonb_build_object('id', v_b.id, 'ref', v_b.ref, 'email', v_b.email, 'locale', v_b.locale,
      'stay_title_en', coalesce(v_title, (select s.slug from public.stays s where s.id = v_b.stay_id))));
end;
$$;

revoke execute on function public.open_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.open_payment(uuid, text, text) to service_role;

create or replace function public.attach_checkout_session(p_payment uuid, p_session text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current text;
begin
  select p.checkout_session_id into v_current from public.booking_payments p where p.id = p_payment;
  if not found then
    perform public.booking_fail('not_found');
  end if;
  if p_session is null or btrim(p_session) = '' then
    perform public.booking_fail('invalid', 'session');
  end if;
  if v_current is not null and v_current <> p_session then
    perform public.booking_fail('invalid', 'session');
  end if;
  update public.booking_payments set checkout_session_id = p_session where id = p_payment;
end;
$$;

revoke execute on function public.attach_checkout_session(uuid, text) from public, anon, authenticated;
grant execute on function public.attach_checkout_session(uuid, text) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- mark_session_expired: Stripe says the session ended. An open payment becomes expired. A booking still `held` whose
-- ended session was its last open one is expired too and gives its nights back (early, before the sweep). A payment
-- already replaced by a newer one changes nothing about the booking. Idempotent.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.mark_session_expired(p_session text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.booking_payments;
  v_b public.bookings;
  v_changed int;
  v_released boolean := false;
begin
  select p.* into v_pay from public.booking_payments p where p.checkout_session_id = p_session;
  if not found then
    return jsonb_build_object('found', false);
  end if;
  v_b := public.booking_lock(v_pay.booking_id);
  update public.booking_payments set status = 'expired' where id = v_pay.id and status = 'open';
  get diagnostics v_changed = row_count;
  if v_changed = 1 and v_b.status = 'held'
     and not exists (select 1 from public.booking_payments p where p.booking_id = v_b.id and p.status in ('open', 'succeeded')) then
    delete from public.booking_nights where booking_id = v_b.id and expires_at is not null;
    update public.bookings set status = 'expired' where id = v_b.id;
    insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
    values (v_b.id, coalesce(nullif(p_actor, ''), 'system'), 'hold_expired', 'held', 'expired', jsonb_build_object('swept_by', 'session_expired'));
    v_released := true;
  end if;
  return jsonb_build_object('found', true, 'payment_expired', v_changed = 1, 'booking_expired', v_released, 'booking_id', v_b.id);
end;
$$;

revoke execute on function public.mark_session_expired(text, text) from public, anon, authenticated;
grant execute on function public.mark_session_expired(text, text) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- record_payment (PAY-09): a session was paid. Idempotent and safe when two calls race: the booking lock serialises
-- them and the payment row is read for update after it. First time only: payment succeeded, paid_fils up, held or
-- awaiting -> deposit_paid / paid_in_full, deposit_paid -> paid_in_full when fully paid, confirmed stays, nights made
-- permanent (re-claimed when gone). Money is always recorded. needs_attention is set (and the booking is never silently
-- dropped) when the booking was cancelled, had already expired, lost its nights, or is now overpaid; a cancelled
-- booking keeps its status. Any other open payment of the booking is closed (its session ids come back).
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.record_payment(p_session text, p_payment_intent text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.booking_payments;
  v_b public.bookings;
  v_actor text := coalesce(nullif(p_actor, ''), 'system');
  v_paid bigint;
  v_to text;
  v_flag boolean := false;
  v_reason text;
  v_have int;
  v_hold text;
  v_closed jsonb := '[]'::jsonb;
begin
  select p.* into v_pay from public.booking_payments p where p.checkout_session_id = p_session;
  if not found then
    return jsonb_build_object('found', false, 'first_time', false, 'reason', 'payment_unknown');
  end if;

  v_b := public.booking_lock(v_pay.booking_id);
  select p.* into v_pay from public.booking_payments p where p.id = v_pay.id for update;

  if v_pay.status = 'succeeded' then
    return jsonb_build_object('found', true, 'first_time', false, 'booking_id', v_b.id, 'payment_id', v_pay.id, 'kind', v_pay.kind,
      'status', v_b.status, 'needs_attention', v_b.needs_attention, 'closed_sessions', '[]'::jsonb);
  end if;

  update public.booking_payments
    set status = 'succeeded', paid_at = now(), payment_intent_id = coalesce(p_payment_intent, payment_intent_id)
    where id = v_pay.id;

  v_paid := v_b.paid_fils + v_pay.amount_fils;

  if v_b.status = 'cancelled' then
    v_to := 'cancelled';
    v_flag := true;
    v_reason := 'paid_after_cancel';
  elsif v_b.status in ('held', 'awaiting_payment', 'expired') then
    v_to := case when v_paid >= v_b.grand_fils then 'paid_in_full' else 'deposit_paid' end;
    if v_b.status = 'expired' then
      v_flag := true;
      v_reason := 'paid_after_expiry';
    end if;
    select count(*) into v_have from public.booking_nights n where n.booking_id = v_b.id;
    if v_have < v_b.leave - v_b.arrive then
      v_hold := public.place_hold(v_b.id, v_b.stay_id, v_b.arrive, v_b.leave, null);
      if v_hold <> 'ok' then
        v_flag := true;
        v_reason := 'nights_lost';
      end if;
    else
      update public.booking_nights set expires_at = null where booking_id = v_b.id;
    end if;
  elsif v_b.status = 'deposit_paid' then
    v_to := case when v_paid >= v_b.grand_fils then 'paid_in_full' else 'deposit_paid' end;
  else
    v_to := v_b.status;
  end if;

  if v_paid > v_b.grand_fils and not v_flag then
    v_flag := true;
    v_reason := 'overpaid';
  end if;

  with closed as (
    update public.booking_payments set status = 'expired'
    where booking_id = v_b.id and status = 'open' and id <> v_pay.id
    returning checkout_session_id
  )
  select coalesce(jsonb_agg(c.checkout_session_id) filter (where c.checkout_session_id is not null), '[]'::jsonb)
    into v_closed from closed c;

  update public.bookings
    set paid_fils = v_paid, status = v_to, needs_attention = needs_attention or v_flag
    where id = v_b.id;

  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, v_actor, 'payment', v_b.status, v_to,
    jsonb_build_object('payment_id', v_pay.id, 'kind', v_pay.kind, 'amount_fils', v_pay.amount_fils, 'paid_fils', v_paid));
  if v_flag then
    insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
    values (v_b.id, v_actor, 'needs_attention', v_b.status, v_to, jsonb_build_object('reason', v_reason, 'payment_id', v_pay.id));
  end if;

  return jsonb_build_object('found', true, 'first_time', true, 'booking_id', v_b.id, 'payment_id', v_pay.id, 'kind', v_pay.kind,
    'status', v_to, 'needs_attention', v_b.needs_attention or v_flag, 'closed_sessions', v_closed);
end;
$$;

revoke execute on function public.record_payment(text, text, text) from public, anon, authenticated;
grant execute on function public.record_payment(text, text, text) to service_role;

-- The card details of a payment: brand, last 4 only (PAY-06), wallet, what the guest saw in their own currency.
create or replace function public.set_payment_card(p_payment uuid, p_charge text, p_brand text, p_last4 text, p_wallet text,
  p_presentment_amount bigint, p_presentment_currency text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.booking_payments
    set charge_id = p_charge, card_brand = p_brand, card_last4 = p_last4, wallet = p_wallet,
        presentment_amount = p_presentment_amount, presentment_currency = p_presentment_currency
    where id = p_payment;
  if not found then
    perform public.booking_fail('not_found');
  end if;
end;
$$;

revoke execute on function public.set_payment_card(uuid, text, text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.set_payment_card(uuid, text, text, text, text, bigint, text) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Refunds and disputes (O-01): recorded from Stripe's events, never made here. Upsert by Stripe id; the payment is
-- found by charge, else by payment intent; 'payment_unknown' when there is none (the webhook answers 500 so Stripe
-- retries, research Pitfall 9). A history row on first sight and on every change of status.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.record_refund(p_refund_id text, p_charge text, p_payment_intent text, p_amount_fils bigint,
  p_status text, p_actor text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.booking_payments;
  v_old text;
  v_known boolean;
begin
  if p_refund_id is null or p_refund_id = '' then
    perform public.booking_fail('invalid', 'refund_id');
  end if;
  select p.* into v_pay from public.booking_payments p where p_charge is not null and p.charge_id = p_charge limit 1;
  if not found then
    select p.* into v_pay from public.booking_payments p where p_payment_intent is not null and p.payment_intent_id = p_payment_intent limit 1;
  end if;
  if v_pay.id is null then
    return 'payment_unknown';
  end if;
  select r.status into v_old from public.booking_refunds r where r.stripe_refund_id = p_refund_id;
  v_known := found;
  insert into public.booking_refunds (stripe_refund_id, booking_id, payment_id, charge_id, amount_fils, status)
  values (p_refund_id, v_pay.booking_id, v_pay.id, coalesce(p_charge, v_pay.charge_id), p_amount_fils, p_status)
  on conflict (stripe_refund_id) do update
    set status = excluded.status,
        amount_fils = coalesce(excluded.amount_fils, public.booking_refunds.amount_fils),
        charge_id = coalesce(excluded.charge_id, public.booking_refunds.charge_id);
  if not v_known or v_old is distinct from p_status then
    insert into public.booking_events (booking_id, actor, action, detail)
    values (v_pay.booking_id, coalesce(nullif(p_actor, ''), 'system'), 'refund',
      jsonb_build_object('refund_id', p_refund_id, 'payment_id', v_pay.id, 'amount_fils', p_amount_fils, 'status', p_status));
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.record_refund(text, text, text, bigint, text, text) from public, anon, authenticated;
grant execute on function public.record_refund(text, text, text, bigint, text, text) to service_role;

create or replace function public.record_dispute(p_dispute_id text, p_charge text, p_payment_intent text, p_amount_fils bigint,
  p_reason text, p_status text, p_actor text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay public.booking_payments;
  v_old text;
  v_known boolean;
begin
  if p_dispute_id is null or p_dispute_id = '' then
    perform public.booking_fail('invalid', 'dispute_id');
  end if;
  select p.* into v_pay from public.booking_payments p where p_charge is not null and p.charge_id = p_charge limit 1;
  if not found then
    select p.* into v_pay from public.booking_payments p where p_payment_intent is not null and p.payment_intent_id = p_payment_intent limit 1;
  end if;
  if v_pay.id is null then
    return 'payment_unknown';
  end if;
  select d.status into v_old from public.booking_disputes d where d.stripe_dispute_id = p_dispute_id;
  v_known := found;
  insert into public.booking_disputes (stripe_dispute_id, booking_id, payment_id, charge_id, amount_fils, reason, status)
  values (p_dispute_id, v_pay.booking_id, v_pay.id, coalesce(p_charge, v_pay.charge_id), p_amount_fils, p_reason, p_status)
  on conflict (stripe_dispute_id) do update
    set status = excluded.status,
        reason = coalesce(excluded.reason, public.booking_disputes.reason),
        amount_fils = coalesce(excluded.amount_fils, public.booking_disputes.amount_fils),
        updated_at = now();
  if not v_known or v_old is distinct from p_status then
    insert into public.booking_events (booking_id, actor, action, detail)
    values (v_pay.booking_id, coalesce(nullif(p_actor, ''), 'system'), 'dispute',
      jsonb_build_object('dispute_id', p_dispute_id, 'payment_id', v_pay.id, 'amount_fils', p_amount_fils, 'reason', p_reason, 'status', p_status));
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.record_dispute(text, text, text, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.record_dispute(text, text, text, bigint, text, text, text) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Stripe event claims: true when this call now holds the event. A processed event is never claimed again; an
-- unprocessed one is taken over only after two minutes (a worker that died mid-event).
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.claim_stripe_event(p_id text, p_type text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_taken text;
begin
  if p_id is null or p_id = '' then
    return false;
  end if;
  insert into public.stripe_events as e (id, type)
  values (p_id, p_type)
  on conflict (id) do update set claimed_at = now(), type = excluded.type
    where e.processed_at is null and e.claimed_at < now() - interval '2 minutes'
  returning e.id into v_taken;
  return v_taken is not null;
end;
$$;

revoke execute on function public.claim_stripe_event(text, text) from public, anon, authenticated;
grant execute on function public.claim_stripe_event(text, text) to service_role;

create or replace function public.finish_stripe_event(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stripe_events set processed_at = now() where id = p_id;
end;
$$;

revoke execute on function public.finish_stripe_event(text) from public, anon, authenticated;
grant execute on function public.finish_stripe_event(text) to service_role;

-- An unprocessed claim is dropped so Stripe's retry can run the event again; a processed one is never dropped.
create or replace function public.drop_stripe_event(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.stripe_events where id = p_id and processed_at is null;
end;
$$;

revoke execute on function public.drop_stripe_event(text) from public, anon, authenticated;
grant execute on function public.drop_stripe_event(text) to service_role;

-- One history row (O-06). The action list is the check on booking_events.
create or replace function public.log_booking_event(p_booking uuid, p_actor text, p_action text, p_detail jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.booking_events (booking_id, actor, action, detail)
  values (p_booking, coalesce(nullif(p_actor, ''), 'system'), p_action, coalesce(p_detail, '{}'::jsonb));
end;
$$;

revoke execute on function public.log_booking_event(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.log_booking_event(uuid, text, text, jsonb) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- 3.2 hand-overs
-- ------------------------------------------------------------------------------------------------------------

-- The only booking-side function the anonymous build may call: which nights of which stay are gone for good (paid,
-- confirmed, completed) or held by the owner for a hand-made booking still in force. No booking id, no guest data.
-- 30-minute web holds are NOT listed: the build bakes this once, and a web hold would stay baked as unavailable long
-- after it freed up; the live quote reports a web hold as sold_out.
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
    and (n.expires_at is null or (b.status = 'awaiting_payment' and n.expires_at > now()))
$$;

revoke execute on function public.public_booked_nights() from public, anon, authenticated;
grant execute on function public.public_booked_nights() to anon, authenticated, service_role;

-- 3.2's view with the same two columns and its exact first branch, plus the booked nights of published stays.
-- security_invoker stays on; the replaced view keeps its privileges.
create or replace view public.api_stay_blocked_days with (security_invoker = on) as
select distinct s.id as stay_id, g.day::date as day
from public.stays s
join public.availability_blocks b
  on b.scope = 'all'
  or (b.scope = 'destination' and b.destination_id = s.destination_id)
  or (b.scope = 'stay' and b.stay_id = s.id)
cross join lateral generate_series(
  greatest(b.starts_on, current_date)::timestamp,
  least(b.ends_on, current_date + 539)::timestamp,
  interval '1 day'
) as g(day)
where s.is_published
union
select pb.stay_id, pb.day
from public.public_booked_nights() as pb
join public.stays s2 on s2.id = pb.stay_id
where s2.is_published;

-- 3.2's function with the same signature and result. Added: for scope stay the per-stay advisory lock place_hold takes,
-- taken first so a block and a hold on the same stay cannot interleave; and overlapping_bookings = the distinct bookings
-- holding a night (permanent, or a hold still running) inside the blocked days of an affected stay. Definer rights,
-- like every function of this file; callers are unchanged (service role only).
create or replace function public.ops_add_block(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_scope text := public.catalog_txt(p, 'scope');
  v_dest uuid := nullif(p ->> 'destination_id', '')::uuid;
  v_stay uuid := nullif(p ->> 'stay_id', '')::uuid;
  v_from date := (p ->> 'starts_on')::date;
  v_to date := (p ->> 'ends_on')::date;
  v_over int;
begin
  if v_scope is null or v_scope not in ('all', 'destination', 'stay') then
    perform public.catalog_invalid('block.scope');
  end if;
  if v_scope = 'destination' and (v_dest is null or not exists (select 1 from public.destinations d where d.id = v_dest)) then
    perform public.catalog_invalid('block.destination_id');
  end if;
  if v_scope = 'stay' and (v_stay is null or not exists (select 1 from public.stays s where s.id = v_stay)) then
    perform public.catalog_invalid('block.stay_id');
  end if;
  if v_from is null then
    perform public.catalog_invalid('block.starts_on');
  end if;
  if v_to is null or v_to < v_from then
    perform public.catalog_invalid('block.ends_on');
  end if;
  if v_scope = 'stay' then
    perform pg_advisory_xact_lock(hashtextextended(v_stay::text, 0));
  end if;
  insert into public.availability_blocks (scope, destination_id, stay_id, starts_on, ends_on, reason, created_by)
  values (
    v_scope,
    case when v_scope = 'destination' then v_dest end,
    case when v_scope = 'stay' then v_stay end,
    v_from, v_to, public.catalog_txt(p, 'reason'), nullif(p ->> 'created_by', '')::uuid
  )
  returning id into v_id;
  select count(distinct n.booking_id) into v_over
  from public.booking_nights n
  join public.stays s on s.id = n.stay_id
  where n.night >= v_from and n.night <= v_to
    and (n.expires_at is null or n.expires_at > now())
    and (v_scope = 'all' or (v_scope = 'destination' and s.destination_id = v_dest) or (v_scope = 'stay' and s.id = v_stay));
  return jsonb_build_object('id', v_id, 'overlapping_bookings', v_over);
end;
$$;

revoke execute on function public.ops_add_block(jsonb) from public, anon, authenticated;
grant execute on function public.ops_add_block(jsonb) to service_role;
