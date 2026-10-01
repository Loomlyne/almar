-- Phase 2 platform spine (plans 02-02 and 02-04). Number confirmed from the repo on 2026-10-01:
-- no migration exists yet and this name is the one reserved in plans 02-02 and 02-04. The Mac
-- control session confirms it again before applying. Cloud threads never apply SQL.
--
-- The owner email is maria@almarprivatejourney.com. Her auth user was created in the Supabase
-- dashboard (plan 02-01), not by this file. No storage schema, no bucket, no password column.

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

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (first_name, last_name, phone, locale, currency) on public.profiles to authenticated;

-- New auth user -> profile row. The owner email gets role owner.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    lower(new.email),
    case when lower(new.email) = 'maria@almarprivatejourney.com' then 'owner' else 'guest' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Users that existed before this migration (the owner, plan 02-01).
insert into public.profiles (id, email, role)
select
  u.id,
  lower(u.email),
  case when lower(u.email) = 'maria@almarprivatejourney.com' then 'owner' else 'guest' end
from auth.users u
where u.email is not null
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
revoke all on public.site_settings from anon, authenticated;

create or replace view public.site_settings_public
with (security_invoker = false) as
  select teal, charcoal, gold, ivory, white, title_face, body_face, vat_percent, deposit_percent, maintenance
  from public.site_settings;

grant select on public.site_settings_public to anon, authenticated;

-- touchword handoff (plan 02-04): hash only, single use, five minutes.
create table if not exists public.host_handoff (
  token_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table public.host_handoff enable row level security;
revoke all on public.host_handoff from anon, authenticated;
