-- Phase 2 platform spine (plans 02-02 and 02-04). Number confirmed from the repo on 2026-10-01:
-- no migration exists yet and this name is the one reserved in plans 02-02 and 02-04. The Mac
-- control session confirms it again before applying. Cloud threads never apply SQL.
--
-- The owner email is maria@almarprivatejourney.com. Her auth user was created in the Supabase
-- dashboard (plan 02-01), not by this file. No storage schema, no bucket, no password column.
--
-- Review fixes (plan 02-23, still never applied): a profile exists only for a confirmed email (the
-- insert trigger checks email_confirmed_at, a second trigger covers the later confirmation, and the
-- owner role is given only on that path); length and phone checks on profiles; a per-email and
-- per-IP limit on sign-in emails (auth_link_requests, claim_link_slot); the trigger functions are
-- not callable through the API.

-- Profiles: one row per auth user, created by the trigger below.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  first_name text,
  last_name text,
  phone text,
  locale text not null default 'en' check (locale in ('en', 'ar', 'es')),
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'EUR')),
  role text not null default 'guest' check (role in ('guest', 'owner')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- She reads and edits only her own row, and only these columns.
drop policy if exists "profiles: read own row" on public.profiles;
create policy "profiles: read own row" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles: update own row" on public.profiles;
create policy "profiles: update own row" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone, locale, currency) on public.profiles to authenticated;

-- Names and phone: the database refuses what the app refuses (lib/auth/rules.ts). The app saves
-- an empty phone as null, so null is the only empty value. char_length counts code points, never
-- more than the app's UTF-16 length, so a value the app accepts is never refused here.
alter table public.profiles drop constraint if exists profiles_first_name_length;
alter table public.profiles add constraint profiles_first_name_length check (char_length(first_name) <= 80);
alter table public.profiles drop constraint if exists profiles_last_name_length;
alter table public.profiles add constraint profiles_last_name_length check (char_length(last_name) <= 80);
alter table public.profiles drop constraint if exists profiles_phone_shape;
alter table public.profiles add constraint profiles_phone_shape check (phone is null or phone ~ '^\+?[0-9]{6,15}$');

-- Confirmed auth user -> profile row. An address that was never confirmed has no profile. The owner
-- email gets role owner, and only here, where the email is confirmed.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is not null and new.email_confirmed_at is not null then
    insert into public.profiles (id, email, role)
    values (
      new.id,
      lower(new.email),
      case when lower(new.email) = 'maria@almarprivatejourney.com' then 'owner' else 'guest' end
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- The link was clicked: the email is now confirmed, so the profile is made now.
drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_auth_user();

-- Her sign-in email changes -> profiles.email follows. The role never changes here.
create or replace function public.handle_auth_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email and new.email is not null)
  execute function public.handle_auth_email_change();

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.handle_auth_email_change() from public, anon, authenticated;

-- Users that existed before this migration (the owner, plan 02-01). Confirmed ones only.
insert into public.profiles (id, email, role)
select
  u.id,
  lower(u.email),
  case when lower(u.email) = 'maria@almarprivatejourney.com' then 'owner' else 'guest' end
from auth.users u
where u.email is not null and u.email_confirmed_at is not null
on conflict (id) do nothing;

-- Site settings: a singleton. Nobody but the service role writes it.
create table if not exists public.site_settings (
  id int primary key default 1 check (id = 1),
  teal text,
  charcoal text,
  gold text,
  ivory text,
  white text,
  title_face text default 'Questa',
  body_face text default 'Lato',
  vat_percent numeric(5, 2),
  deposit_percent numeric(5, 2),
  maintenance boolean not null default false,
  logo_bytes bytea,
  logo_type text
);

alter table public.site_settings enable row level security;
revoke all on public.site_settings from public, anon, authenticated;

create or replace view public.site_settings_public
with (security_invoker = false) as
  select teal, charcoal, gold, ivory, white, title_face, body_face, vat_percent, deposit_percent, maintenance
  from public.site_settings;

-- Supabase's default privileges grant ALL on new views; a simple view is writable through its
-- owner, so everything is revoked first and only select is given back.
revoke all on public.site_settings_public from public, anon, authenticated;
grant select on public.site_settings_public to anon, authenticated;

-- touchword handoff (plan 02-04): hash only, single use, five minutes.
create table if not exists public.host_handoff (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table public.host_handoff enable row level security;
revoke all on public.host_handoff from public, anon, authenticated;

-- Sign-in email limits (plan 02-23). Only hashes are stored. Only the service role calls the function.
create table if not exists public.auth_link_requests (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_link_requests_email_idx on public.auth_link_requests (email_hash, created_at);
create index if not exists auth_link_requests_ip_idx on public.auth_link_requests (ip_hash, created_at);

alter table public.auth_link_requests enable row level security;
revoke all on public.auth_link_requests from public, anon, authenticated;

-- True when a link may be sent and the request is counted; false when over a limit:
-- one per email per 60 seconds, five per email per hour, twenty per IP per hour.
create or replace function public.claim_link_slot(p_email_hash text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_email_hash, 0));

  delete from public.auth_link_requests where created_at < now() - interval '1 day';

  if exists (
    select 1 from public.auth_link_requests
    where email_hash = p_email_hash and created_at > now() - interval '60 seconds'
  ) then
    return false;
  end if;

  if (
    select count(*) from public.auth_link_requests
    where email_hash = p_email_hash and created_at > now() - interval '1 hour'
  ) >= 5 then
    return false;
  end if;

  if (
    select count(*) from public.auth_link_requests
    where ip_hash = p_ip_hash and created_at > now() - interval '1 hour'
  ) >= 20 then
    return false;
  end if;

  insert into public.auth_link_requests (email_hash, ip_hash) values (p_email_hash, p_ip_hash);
  return true;
end;
$$;

revoke execute on function public.claim_link_slot(text, text) from public, anon, authenticated;
grant execute on function public.claim_link_slot(text, text) to service_role;
