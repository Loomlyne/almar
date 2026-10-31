-- Phase 5 plan 05-01: Ops OS base. Bank refunds recorded and voided (P5-06, P5-07, B-25, B-31), the agreed price with
-- its reason stored in the same transaction as the booking (P5-02), Home numbers (P5-08) and the customer list (P5-09).
-- Number 20261031120000 confirmed by the controller. Additive: no table is created or dropped, no applied migration is
-- edited, `booking_write` and `record_refund` (the Stripe-era function) are not replaced. Applied by the controller only,
-- after a different model's check, and before any Phase 5 deploy.
--
-- Every new function: security definer, search_path empty, execute for service_role only. RLS stays on `booking_refunds`
-- and `bookings` with nothing granted, as they are. Six functions of 20261005110000 and 20261019160000 are replaced
-- below; each is copied line for line and only the stated lines differ (listed above each one).

-- ------------------------------------------------------------------------------------------------------------
-- 1. booking_refunds: a bank refund row beside the Stripe-shaped one.
-- stripe_refund_id stays unique and loses NOT NULL: the unique constraint lets many NULLs through, so the partial rule
-- needs no partial index (which would break `record_refund`'s `on conflict (stripe_refund_id)`, still deployed). A card
-- row (method default 'card') still satisfies every check, so `record_refund` is untouched.
-- ------------------------------------------------------------------------------------------------------------
alter table public.booking_refunds alter column stripe_refund_id drop not null;

alter table public.booking_refunds
  add column if not exists method text not null default 'card' check (method in ('card', 'bank_transfer')),
  add column if not exists refunded_on date,
  add column if not exists bank_reference text check (char_length(bank_reference) between 1 and 100),
  add column if not exists reason text check (char_length(reason) between 3 and 300),
  add column if not exists recorded_by uuid,
  add column if not exists request_id uuid,
  add column if not exists void_reason text check (char_length(void_reason) between 3 and 300),
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid;

-- The owner's dialog makes request_id when it opens: the same id twice is one row. Nulls never collide (card rows).
alter table public.booking_refunds add constraint booking_refunds_request_id_key unique (request_id);

-- A card row has a Stripe id, a bank row has none.
alter table public.booking_refunds
  add constraint booking_refunds_source check ((method = 'card') = (stripe_refund_id is not null)) not valid;
alter table public.booking_refunds validate constraint booking_refunds_source;

-- A bank row carries what the owner typed, and only the two statuses a bank row can have. Card rows keep Stripe's free status text.
alter table public.booking_refunds
  add constraint booking_refunds_bank_fields check (
    method <> 'bank_transfer' or (
      status in ('succeeded', 'voided') and amount_fils >= 1 and refunded_on is not null and recorded_by is not null
      and request_id is not null and bank_reference is not null)
  ) not valid;
alter table public.booking_refunds validate constraint booking_refunds_bank_fields;

-- A voided row says when, by whom and why; no other row does.
alter table public.booking_refunds
  add constraint booking_refunds_voided_fields check (
    (coalesce(status, '') = 'voided') = (voided_at is not null and voided_by is not null and void_reason is not null)
  ) not valid;
alter table public.booking_refunds validate constraint booking_refunds_voided_fields;

-- ------------------------------------------------------------------------------------------------------------
-- 2. bookings.refunded_fils: the bank refunds on a booking, summed from the succeeded rows by the three functions below.
-- Deliberately no check against paid_fils: the rule lives in the functions, and a table check would turn a refusal into a 503.
-- ------------------------------------------------------------------------------------------------------------
alter table public.bookings add column if not exists refunded_fils bigint not null default 0 check (refunded_fils >= 0);

-- ------------------------------------------------------------------------------------------------------------
-- 3. Event actions: the 20 of 20261019160000 plus refund_recorded and refund_voided: 22.
-- ------------------------------------------------------------------------------------------------------------
alter table public.booking_events drop constraint booking_events_action_check;
alter table public.booking_events
  add constraint booking_events_action_check check (action in (
    'created', 'status', 'hold_expired', 'payment', 'refund', 'dispute', 'email_sent', 'email_resent', 'email_failed',
    'needs_attention', 'resend_requested', 'checkout_not_closed',
    'request_sent', 'payment_recorded', 'payment_voided', 'note_added', 'attention_resolved', 'email_pending',
    'request_withdrawn', 'email_unknown',
    'refund_recorded', 'refund_voided')) not valid;
alter table public.booking_events validate constraint booking_events_action_check;

-- ------------------------------------------------------------------------------------------------------------
-- 4. ops_record_refund (P5-06, P5-07, B-31): a refund made from the bank, recorded here and never sent. Keys exactly:
-- booking_id, request_id, amount_fils, refunded_on, bank_reference, reason. Under the booking lock, never above paid
-- minus refunded. It changes no status, no paid_fils, no written_off_fils and no deadline (P-06): what is still due
-- never rises. The same request id twice is one row (a replay with another booking or amount is `changed`).
-- ------------------------------------------------------------------------------------------------------------
create or replace function public.ops_record_refund(p jsonb, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_keys constant text[] := array['booking_id', 'request_id', 'amount_fils', 'refunded_on', 'bank_reference', 'reason'];
  v_key text;
  v_booking uuid;
  v_request uuid;
  v_amount bigint;
  v_old public.booking_refunds;
  v_ev jsonb;
  v_b public.bookings;
  v_locked boolean := false;
  v_retry boolean := false;
  v_constraint text;
  v_today date := (now() at time zone 'Asia/Dubai')::date;
  v_on date;
  v_ref text;
  v_reason text;
  v_id bigint;
  v_refunded bigint;
  v_net bigint;
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
    select x.* into v_old from public.booking_refunds x where x.request_id = v_request;
    if found then
      if v_old.booking_id <> v_booking or v_old.amount_fils <> v_amount then
        perform public.booking_fail('changed');
      end if;
      select e.detail into v_ev from public.booking_events e
        where e.booking_id = v_old.booking_id and e.action = 'refund_recorded' and e.detail ->> 'refund_id' = v_old.id::text
        order by e.id limit 1;
      select b.* into v_b from public.bookings b where b.id = v_old.booking_id;
      return jsonb_build_object(
        'first_time', false,
        'booking_id', v_b.id,
        'ref', v_b.ref,
        'refund_id', v_old.id,
        'amount_fils', v_old.amount_fils,
        'refunded_on', to_char(v_old.refunded_on, 'YYYY-MM-DD'),
        'paid_fils', coalesce((v_ev ->> 'paid_fils')::bigint, v_b.paid_fils),
        'refunded_fils', coalesce((v_ev ->> 'refunded_fils')::bigint, v_b.refunded_fils),
        'refundable_fils', greatest(0, v_b.paid_fils - v_b.refunded_fils),
        'attention_cleared', coalesce((v_ev ->> 'attention_cleared')::boolean, false),
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

    -- The money rule, on the locked row: a refund is never above what was paid minus what was already refunded.
    if v_b.paid_fils - v_b.refunded_fils <= 0 then
      perform public.booking_fail('nothing_to_refund');
    end if;
    if v_amount > v_b.paid_fils - v_b.refunded_fils then
      perform public.booking_fail('above_paid', null, jsonb_build_object(
        'refundable_fils', v_b.paid_fils - v_b.refunded_fils));
    end if;

    v_on := public.booking_date(p, 'refunded_on', true);
    if v_on > v_today or v_on < (v_b.created_at at time zone 'Asia/Dubai')::date then
      perform public.booking_fail('invalid', 'refunded_on');
    end if;
    if jsonb_typeof(p -> 'bank_reference') is distinct from 'string' then
      perform public.booking_fail('invalid', 'bank_reference');
    end if;
    v_ref := btrim(p ->> 'bank_reference');
    if char_length(v_ref) < 1 or char_length(v_ref) > 100 then
      perform public.booking_fail('invalid', 'bank_reference');
    end if;
    if jsonb_typeof(p -> 'reason') is not null and jsonb_typeof(p -> 'reason') <> 'null' then
      if jsonb_typeof(p -> 'reason') <> 'string' then
        perform public.booking_fail('invalid', 'reason');
      end if;
      v_reason := btrim(p ->> 'reason');
      if char_length(v_reason) < 3 or char_length(v_reason) > 300 then
        perform public.booking_fail('invalid', 'reason');
      end if;
    end if;

    begin
      insert into public.booking_refunds (booking_id, method, status, amount_fils, refunded_on, bank_reference, reason,
        recorded_by, request_id)
      values (v_b.id, 'bank_transfer', 'succeeded', v_amount, v_on, v_ref, v_reason, p_actor, v_request)
      returning id into v_id;
    exception when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'booking_refunds_request_id_key' then
        v_retry := true;
        continue attempt;
      end if;
      raise;
    end;
    exit attempt;
  end loop;

  -- The sum, again from the rows (never the old value plus this amount).
  select coalesce(sum(x.amount_fils), 0) into v_refunded
    from public.booking_refunds x where x.booking_id = v_b.id and x.method = 'bank_transfer' and x.status = 'succeeded';
  v_net := v_b.paid_fils - v_refunded;

  -- Flags that were about money no longer owed back: overpaid once paid minus refunded is within the total; money on an
  -- expired or cancelled booking once it is all refunded. deadline_passed_part_paid stays.
  v_need := v_b.needs_attention;
  v_why := v_b.attention_reason;
  if (v_why = 'overpaid' and v_net <= v_b.grand_fils)
     or (v_why in ('paid_after_expiry', 'paid_after_cancel') and v_net <= 0) then
    v_need := false;
    v_why := null;
    v_cleared := true;
  end if;

  update public.bookings
    set refunded_fils = v_refunded, needs_attention = v_need, attention_reason = v_why
    where id = v_b.id;

  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, 'owner:' || p_actor::text, 'refund_recorded', v_b.status, v_b.status, jsonb_build_object(
    'refund_id', v_id,
    'amount_fils', v_amount,
    'refunded_on', to_char(v_on, 'YYYY-MM-DD'),
    'bank_reference', v_ref,
    'reason', v_reason,
    'paid_fils', v_b.paid_fils,
    'refunded_fils', v_refunded,
    'request_id', v_request,
    'attention_cleared', v_cleared));

  select b.* into v_b from public.bookings b where b.id = v_b.id;
  return jsonb_build_object(
    'first_time', true,
    'booking_id', v_b.id,
    'ref', v_b.ref,
    'refund_id', v_id,
    'amount_fils', v_amount,
    'refunded_on', to_char(v_on, 'YYYY-MM-DD'),
    'paid_fils', v_b.paid_fils,
    'refunded_fils', v_b.refunded_fils,
    'refundable_fils', greatest(0, v_b.paid_fils - v_b.refunded_fils),
    'attention_cleared', v_cleared,
    'flags', public.booking_flags(v_b),
    'is_test', v_b.is_test,
    'locale', v_b.locale,
    'link_version', v_b.link_version);
end;
$$;

revoke execute on function public.ops_record_refund(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.ops_record_refund(jsonb, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- 5. ops_void_refund (B-25): a wrong refund record is voided with a reason, never deleted. Status unchanged. The
-- booking's refunded_fils is summed again; if the booking is not flagged and the voided refund leaves money that is
-- owed back (paid minus refunded above zero on an expired or cancelled booking, or above the total), it is flagged.
-- ------------------------------------------------------------------------------------------------------------
create or replace function public.ops_void_refund(p_refund bigint, p_reason text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reason text := btrim(p_reason);
  v_bid uuid;
  v_b public.bookings;
  v_row public.booking_refunds;
  v_ev public.booking_events;
  v_refunded bigint;
  v_net bigint;
  v_flag text;
  v_raised boolean := false;
begin
  perform public.booking_assert_owner(p_actor);
  if v_reason is null or char_length(v_reason) < 3 or char_length(v_reason) > 300 then
    perform public.booking_fail('invalid', 'reason');
  end if;
  select x.booking_id into v_bid from public.booking_refunds x where x.id = p_refund;
  if v_bid is null then
    perform public.booking_fail('not_found');
  end if;
  v_b := public.booking_lock(v_bid);
  select x.* into v_row from public.booking_refunds x where x.id = p_refund for update;

  if v_row.status = 'voided' then
    select e.* into v_ev from public.booking_events e
      where e.booking_id = v_b.id and e.action = 'refund_voided' and e.detail ->> 'refund_id' = v_row.id::text
      order by e.id limit 1;
    return jsonb_build_object(
      'first_time', false,
      'booking_id', v_b.id,
      'ref', v_b.ref,
      'refund_id', v_row.id,
      'amount_fils', v_row.amount_fils,
      'paid_fils', v_b.paid_fils,
      'refunded_fils', coalesce((v_ev.detail ->> 'refunded_fils')::bigint, v_b.refunded_fils),
      'attention_raised', coalesce((v_ev.detail ->> 'attention_raised')::boolean, false),
      'flags', public.booking_flags(v_b));
  end if;
  if v_row.status is distinct from 'succeeded' or v_row.method <> 'bank_transfer' then
    perform public.booking_fail('not_voidable');
  end if;

  update public.booking_refunds
    set status = 'voided', void_reason = v_reason, voided_at = now(), voided_by = p_actor
    where id = v_row.id;
  select coalesce(sum(x.amount_fils), 0) into v_refunded
    from public.booking_refunds x where x.booking_id = v_b.id and x.method = 'bank_transfer' and x.status = 'succeeded';
  v_net := v_b.paid_fils - v_refunded;

  if not v_b.needs_attention then
    v_flag := case
      when v_b.status = 'expired' and v_net > 0 then 'paid_after_expiry'
      when v_b.status = 'cancelled' and v_net > 0 then 'paid_after_cancel'
      when v_net > v_b.grand_fils then 'overpaid' end;
  end if;
  if v_flag is not null then
    v_raised := true;
    update public.bookings set refunded_fils = v_refunded, needs_attention = true, attention_reason = v_flag where id = v_b.id;
    insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
    values (v_b.id, 'owner:' || p_actor::text, 'needs_attention', v_b.status, v_b.status,
      jsonb_build_object('reason', v_flag, 'refund_id', v_row.id));
  else
    update public.bookings set refunded_fils = v_refunded where id = v_b.id;
  end if;

  insert into public.booking_events (booking_id, actor, action, from_status, to_status, detail)
  values (v_b.id, 'owner:' || p_actor::text, 'refund_voided', v_b.status, v_b.status, jsonb_build_object(
    'refund_id', v_row.id,
    'amount_fils', v_row.amount_fils,
    'reason', v_reason,
    'refunded_fils', v_refunded,
    'attention_raised', v_raised));

  select b.* into v_b from public.bookings b where b.id = v_b.id;
  return jsonb_build_object(
    'first_time', true,
    'booking_id', v_b.id,
    'ref', v_b.ref,
    'refund_id', v_row.id,
    'amount_fils', v_row.amount_fils,
    'paid_fils', v_b.paid_fils,
    'refunded_fils', v_b.refunded_fils,
    'attention_raised', v_raised,
    'flags', public.booking_flags(v_b));
end;
$$;

revoke execute on function public.ops_void_refund(bigint, text, uuid) from public, anon, authenticated;
grant execute on function public.ops_void_refund(bigint, text, uuid) to service_role;


-- ------------------------------------------------------------------------------------------------------------
-- 6. booking_flags: one changed line, overpaid reads paid minus refunded above the total (P5-06). settled_fils, due_now_fils and still_due_fils still read paid plus written off, so a refund never raises what is due (P-06).
-- ------------------------------------------------------------------------------------------------------------
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
    'overpaid', ((b.paid_fils - b.refunded_fils) > b.grand_fils),
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
-- 7. booking_view: refunds (date and amount of the succeeded bank rows only) after payments, refunded_fils after paid_fils in money. Never a refund's reason or bank reference.
-- ------------------------------------------------------------------------------------------------------------
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
  v_refunds jsonb;
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

  -- Refunds: the date and the amount of each succeeded bank refund, nothing else (never a reason or a bank reference).
  select coalesce(jsonb_agg(jsonb_build_object(
      'refunded_on', to_char(r.refunded_on, 'YYYY-MM-DD'),
      'amount_fils', r.amount_fils)
      order by r.refunded_on, r.created_at, r.id), '[]'::jsonb)
    into v_refunds
    from public.booking_refunds r
    where r.booking_id = v_b.id and r.method = 'bank_transfer' and r.status = 'succeeded';

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
      'refunded_fils', v_b.refunded_fils,
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
    'refunds', v_refunds,
    'transfer', public.booking_transfer_instructions(v_b.id, v_loc),
    'access', v_access);
end;
$$;

revoke execute on function public.booking_view(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.booking_view(uuid, text, boolean) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- 8. ops_get_booking: every bank refund row (voided included, newest first) after payments, refunded_fils after paid_fils in money.
-- ------------------------------------------------------------------------------------------------------------
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
  v_refunds jsonb;
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

  -- Every bank refund row, voided included, newest first (B-25).
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id,
      'method', x.method,
      'status', x.status,
      'amount_fils', x.amount_fils,
      'refunded_on', to_char(x.refunded_on, 'YYYY-MM-DD'),
      'bank_reference', x.bank_reference,
      'reason', x.reason,
      'recorded_by', x.recorded_by,
      'recorded_by_email', (select pr.email from public.profiles pr where pr.id = x.recorded_by),
      'created_at', to_char(x.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'void_reason', x.void_reason,
      'voided_at', to_char(x.voided_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'voided_by', x.voided_by,
      'voided_by_email', (select pr.email from public.profiles pr where pr.id = x.voided_by)) order by x.created_at desc, x.id), '[]'::jsonb)
    into v_refunds
    from public.booking_refunds x
    where x.booking_id = v_b.id and x.method = 'bank_transfer';

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
      'refunded_fils', v_b.refunded_fils,
      'written_off_fils', v_b.written_off_fils,
      'balance_due_days', v_b.balance_due_days,
      'balance_due_date', to_char(v_b.balance_due_date, 'YYYY-MM-DD')),
    'flags', public.booking_flags(v_b),
    'travellers', v_trav,
    'lines', v_lines,
    'payments', v_pays,
    'refunds', v_refunds,
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
-- 9. ops_create_booking (P5-02): an optional agreed_reason is read here, removed before the one booking_write call, and written into the created event with agreed_nights_fils; atomic with the booking.
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
  v_agreed int := 0;
  v_total int := 0;
  v_agreed_reason text;
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

  -- P5-02: an agreed price. When any night carries source 'agreed' all must, and a reason of 3..300 characters is
  -- required; with none agreed the key is refused. The reason is stored in the created event below, in this transaction.
  if jsonb_typeof(p -> 'nights_snapshot') = 'array' then
    select count(*) filter (where e.value ->> 'source' = 'agreed'), count(*) into v_agreed, v_total
      from jsonb_array_elements(p -> 'nights_snapshot') as e;
  end if;
  if v_agreed > 0 and v_agreed <> v_total then
    perform public.booking_fail('invalid', 'nights_snapshot');
  end if;
  if v_agreed > 0 then
    v_agreed_reason := btrim(public.booking_txt(p, 'agreed_reason', 3, 300, true));
    if char_length(v_agreed_reason) < 3 or char_length(v_agreed_reason) > 300 then
      perform public.booking_fail('invalid', 'agreed_reason');
    end if;
  elsif jsonb_exists(p, 'agreed_reason') then
    perform public.booking_fail('invalid', 'agreed_reason');
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
    v_w := public.booking_write(p - 'agreed_reason', 'ops', 'awaiting_payment', v_hold_until, p_actor);
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
      'hold_until', to_char(v_hold_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      || case when v_agreed > 0
        then jsonb_build_object('agreed_reason', v_agreed_reason, 'agreed_nights_fils', (p ->> 'nights_fils')::bigint)
        else '{}'::jsonb end);
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
-- 10. ops_record_payment: one changed line, a late payment after a refund raises overpaid on paid minus refunded (agrees with booking_flags, P-06).
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
  if v_flag is null and v_paid - v_b.refunded_fils > v_b.grand_fils then
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
-- 11. ops_void_payment (B-31): refund_first guard before any write, and the overpaid and money-flag clears compare paid minus refunded.
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

  -- B-31: voiding this payment must not leave refunds above what was paid. Void the refund first.
  if v_paid_after < v_b.refunded_fils then
    perform public.booking_fail('refund_first');
  end if;

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
  if (v_why = 'overpaid' and v_paid - v_b.refunded_fils <= v_b.grand_fils)
     or (v_why in ('paid_after_expiry', 'paid_after_cancel') and v_paid - v_b.refunded_fils = 0)
     or (v_why = 'deadline_passed_part_paid' and v_paid = 0) then
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
-- 12. ops_home_numbers (P5-08): the Home numbers for a Dubai-day range (inclusive), TEST bookings left out.
-- bookings: requests and hand-made bookings created in the range (a held or abandoned hold is not one; a request later
-- cancelled or lapsed still counts as made). received_fils / refunded_fils: succeeded bank rows by received_on /
-- refunded_on in the range (write-offs never count). recorded_fils: received minus refunded, may be negative.
-- outstanding: what is still due now, independent of the range, leaving out an unpaid awaiting_payment more than
-- 2 minutes past its deadline (the sweep's rule), so the number holds whatever the cron's timing.
-- ------------------------------------------------------------------------------------------------------------
create or replace function public.ops_home_numbers(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bookings bigint;
  v_received bigint;
  v_refunded bigint;
  v_out_fils bigint;
  v_out_count bigint;
begin
  if p_from is null then
    perform public.booking_fail('invalid', 'from');
  end if;
  if p_to is null or p_from > p_to then
    perform public.booking_fail('invalid', 'to');
  end if;
  if p_to - p_from > 3660 then
    perform public.booking_fail('invalid', 'range');
  end if;

  select count(*) into v_bookings
    from public.bookings b
    where not b.is_test
      and (b.source = 'ops' or b.requested_at is not null)
      and (coalesce(b.requested_at, b.created_at) at time zone 'Asia/Dubai')::date between p_from and p_to;

  select coalesce(sum(x.amount_fils), 0) into v_received
    from public.booking_payments x
    join public.bookings b on b.id = x.booking_id
    where not b.is_test and x.method = 'bank_transfer' and x.status = 'succeeded'
      and x.received_on between p_from and p_to;

  select coalesce(sum(x.amount_fils), 0) into v_refunded
    from public.booking_refunds x
    join public.bookings b on b.id = x.booking_id
    where not b.is_test and x.method = 'bank_transfer' and x.status = 'succeeded'
      and x.refunded_on between p_from and p_to;

  select coalesce(sum(d.due), 0), count(*) into v_out_fils, v_out_count
    from (
      select (public.booking_flags(b) ->> 'still_due_fils')::bigint as due
      from public.bookings b
      where not b.is_test
        and not (b.status = 'awaiting_payment' and b.paid_fils = 0 and b.hold_expires_at < now() - interval '2 minutes')
    ) d
    where d.due > 0;

  return jsonb_build_object(
    'from', to_char(p_from, 'YYYY-MM-DD'),
    'to', to_char(p_to, 'YYYY-MM-DD'),
    'bookings', v_bookings,
    'received_fils', v_received,
    'refunded_fils', v_refunded,
    'recorded_fils', v_received - v_refunded,
    'outstanding_fils', v_out_fils,
    'outstanding_count', v_out_count);
end;
$$;

revoke execute on function public.ops_home_numbers(date, date) from public, anon, authenticated;
grant execute on function public.ops_home_numbers(date, date) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- 13. ops_list_customers (P5-09): a read-only list grouped by guest email (stored lower case by a check), no table.
-- Rows: not TEST, and hand-made or requested (an abandoned hold is not a customer). name and phone from the newest
-- booking, bookings the count, last_arrive the latest arrival. p_q (at most 100 characters) is folded and searched in
-- any of the group's names, its email and any of its phones. Order: last_arrive newest first, then email.
-- p_after: the next of the previous page (an offset as text); p_limit 1..60. Returns { items, next }.
-- ------------------------------------------------------------------------------------------------------------
create or replace function public.ops_list_customers(p_q text default null, p_after text default null, p_limit int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_q, '')), '');
  v_needle text;
  v_offset int;
  v_items jsonb;
  v_more boolean;
begin
  if p_q is not null and char_length(p_q) > 100 then
    perform public.booking_fail('invalid', 'q');
  end if;
  if p_after is not null and p_after !~ '^[0-9]{1,6}$' then
    perform public.booking_fail('invalid', 'after');
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 60 then
    perform public.booking_fail('invalid', 'limit');
  end if;
  v_offset := coalesce(p_after::int, 0);
  if v_q is not null then
    v_needle := public.media_fold(v_q);
  end if;

  with grp as (
    select b.email,
      (array_agg(b.guest_name order by b.created_at desc, b.id))[1] as cname,
      (array_agg(b.phone order by b.created_at desc, b.id))[1] as cphone,
      count(*) as n,
      max(b.arrive) as last_arrive,
      bool_or(v_needle is null
        or strpos(public.media_fold(b.guest_name), v_needle) > 0
        or strpos(public.media_fold(b.email), v_needle) > 0
        or strpos(public.media_fold(b.phone), v_needle) > 0) as hit
    from public.bookings b
    where not b.is_test and (b.source = 'ops' or b.requested_at is not null)
    group by b.email
  ),
  ordered as (
    select g.*, row_number() over (order by g.last_arrive desc, g.email) as ord
    from grp g
    where g.hit
  ),
  page as (
    select o.* from ordered o where o.ord > v_offset and o.ord <= v_offset + p_limit + 1
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
        'email', pg.email,
        'name', pg.cname,
        'phone', coalesce(pg.cphone, ''),
        'bookings', pg.n,
        'last_arrive', to_char(pg.last_arrive, 'YYYY-MM-DD')) order by pg.ord) filter (where pg.ord <= v_offset + p_limit), '[]'::jsonb),
    coalesce(bool_or(pg.ord > v_offset + p_limit), false)
  into v_items, v_more
  from page pg;

  return jsonb_build_object('items', v_items, 'next', case when v_more then (v_offset + p_limit)::text end);
end;
$$;

revoke execute on function public.ops_list_customers(text, text, int) from public, anon, authenticated;
grant execute on function public.ops_list_customers(text, text, int) to service_role;
