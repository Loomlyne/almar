-- Phase 3.2 plan 01: the catalogue and team database (contract: .planning/phases/03.2-real-catalog-and-team-inserted/
-- 03.2-API-CONTRACT.md section 2). Number 20261005100000 reserved by the controller (board "Reserved numbers").
--
-- A work session never applies this file: only the controller applies it to the live project, after job 02's
-- 20260925120000_platform_spine.sql, on the owner's word. Local apply is `node tests/helpers/local-supabase.mjs reset`.
--
-- What is in it: media, destinations, stays (details, gallery, rates by date range, availability blocks, private
-- access), experiences and services, the three home journeys, team, the seven inclusions, the publish singleton;
-- RLS on every table with column-level anon grants; security_invoker api_* views that return the 3.3 fixture shapes
-- (column order = fixture key order); the owner write functions (ops_*), the rate and block read helpers, the site
-- publish helpers and import_catalog. Functions are callable by service_role only.
--
-- Phase 4's 20261005110000_bookings_and_ops.sql may `create or replace` api_stay_blocked_days (same two columns,
-- same grants) and ops_add_block (same signature and result); nothing else here is edited by a later plan.
--
-- Known and not this file's job: job 02's site_settings_public is still `security_invoker = false` (Supabase lint
-- 0010, research section 4.1). Flagged to the controller.

create extension if not exists btree_gist with schema extensions;

-- updated_at follows every update (insert keeps the value given, so the import keeps the fixtures' timestamps).
create or replace function public.catalog_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.catalog_set_updated_at() from public, anon, authenticated;
grant execute on function public.catalog_set_updated_at() to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Tables, in foreign-key order
-- ------------------------------------------------------------------------------------------------------------

-- One row per fixture image id (id = that id): one file can carry two image ids, each with its own alt text, so an
-- imported key may repeat; an uploaded key is unique.
create table public.media (
  id uuid primary key default gen_random_uuid(),
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]*(/[a-z0-9][a-z0-9_.-]*)*\.(webp|jpg|png)$'),
  width int check (width > 0),
  height int check (height > 0),
  bytes int check (bytes > 0),
  content_type text check (content_type in ('image/webp', 'image/jpeg', 'image/png')),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  source text not null default 'upload' check (source in ('import', 'upload')),
  created_at timestamptz not null default now()
);

create table public.image_translations (
  image_id uuid not null references public.media (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  alt text not null,
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  primary key (image_id, locale)
);

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  hero_media_id uuid references public.media (id) on delete restrict,
  inset_media_id uuid references public.media (id) on delete restrict,
  is_published boolean not null default false,
  position int not null default 0,
  is_sample boolean not null default false,
  sample_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destinations_sample_fields check (is_sample = (cardinality(sample_fields) > 0))
);

create table public.destination_translations (
  destination_id uuid not null references public.destinations (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  name text not null,
  short_line text,
  region text,
  summary text,
  nights_label text,
  primary key (destination_id, locale)
);

create table public.stays (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  destination_id uuid not null references public.destinations (id) on delete restrict,
  max_guests int check (max_guests >= 0),
  min_guests int check (min_guests >= 0),
  bedrooms int check (bedrooms >= 0),
  bathrooms int check (bathrooms >= 0),
  -- C-12: null = not bookable (STAY-03). Never invented, never imported. Never readable by anon.
  base_nightly_rate_aed numeric(12, 2) check (base_nightly_rate_aed > 0),
  -- STAY-06: default 1, no maximum.
  min_nights int not null default 1 check (min_nights >= 1),
  -- STAY-05: null = not set; a fee needs the fee amount and nothing else may carry one.
  pets_rule text check (pets_rule in ('allowed', 'not_allowed', 'fee')),
  pets_fee_aed numeric(12, 2) check (pets_fee_aed > 0),
  -- C-13: null = not set.
  infants_count boolean,
  hero_media_id uuid references public.media (id) on delete restrict,
  is_published boolean not null default false,
  position int not null default 0,
  is_sample boolean not null default false,
  sample_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stays_sample_fields check (is_sample = (cardinality(sample_fields) > 0)),
  constraint stays_pets_fee check (
    case
      when pets_rule is null then pets_fee_aed is null
      when pets_rule = 'fee' then pets_fee_aed is not null
      else pets_fee_aed is null
    end
  )
);

create table public.stay_gallery (
  stay_id uuid not null references public.stays (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete restrict,
  position int not null,
  primary key (stay_id, media_id)
);

create table public.stay_translations (
  stay_id uuid not null references public.stays (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  title text not null,
  tagline text,
  neighborhood text,
  guests_label text,
  bathrooms_label text,
  beds_label text,
  price_label text,
  price_note text,
  description text[] not null default '{}',
  amenities text[] not null default '{}',
  -- The stay's own published text lines ("1 housekeeper"), not the seven journey inclusions below.
  inclusions text[] not null default '{}',
  policy_headings text[] not null default '{}',
  primary key (stay_id, locale)
);

-- C-11: one base rate on the stay plus any number of date ranges. The shortest range covering a night wins; two ranges
-- of the same length may never share a night, so the shortest covering range is always unique.
create table public.stay_rates (
  id uuid primary key default gen_random_uuid(),
  stay_id uuid not null references public.stays (id) on delete cascade,
  nights daterange not null,
  nightly_rate_aed numeric(12, 2) not null check (nightly_rate_aed > 0),
  span_days int generated always as (upper(nights) - lower(nights)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stay_rates_nights_bounded check (not isempty(nights) and not lower_inf(nights) and not upper_inf(nights)),
  constraint stay_rates_same_length_no_overlap exclude using gist (stay_id with =, span_days with =, nights with &&)
);

-- C-13, D-87: whole days blocked by the owner for one stay, one destination or everything. ends_on is inclusive.
create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('all', 'destination', 'stay')),
  destination_id uuid references public.destinations (id) on delete cascade,
  stay_id uuid references public.stays (id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid,
  constraint availability_blocks_dates check (ends_on >= starts_on),
  constraint availability_blocks_scope_target check (
    (scope = 'all' and destination_id is null and stay_id is null)
    or (scope = 'destination' and destination_id is not null and stay_id is null)
    or (scope = 'stay' and stay_id is not null and destination_id is null)
  )
);

-- C-14: exact address, wifi, door code. No grant to anon or authenticated, no view, never in a build.
create table public.stay_access (
  stay_id uuid primary key references public.stays (id) on delete cascade,
  address text check (char_length(address) <= 2000),
  wifi_name text check (char_length(wifi_name) <= 2000),
  wifi_password text check (char_length(wifi_password) <= 2000),
  door_code text check (char_length(door_code) <= 2000),
  notes text check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now()
);

-- D-89: experiences and services are one list.
create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  kind text not null check (kind in ('experience', 'service')),
  unit text not null check (unit in ('person', 'night', 'trip')),
  price_aed numeric(12, 2) check (price_aed >= 0),
  is_uae boolean not null default false,
  -- At most one row: the UAE home-pickup add-on that Phase 4 starts added (B-11, D-48). api_catalog does not return it.
  is_home_pickup boolean not null default false,
  media_id uuid references public.media (id) on delete restrict,
  is_published boolean not null default false,
  position int not null default 0,
  is_sample boolean not null default false,
  sample_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_items_sample_fields check (is_sample = (cardinality(sample_fields) > 0))
);

create unique index catalog_items_one_home_pickup on public.catalog_items ((true)) where is_home_pickup;

create table public.catalog_translations (
  item_id uuid not null references public.catalog_items (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  name text not null,
  summary text,
  duration_label text,
  primary key (item_id, locale)
);

create table public.catalog_item_destinations (
  item_id uuid not null references public.catalog_items (id) on delete cascade,
  destination_id uuid not null references public.destinations (id) on delete cascade,
  primary key (item_id, destination_id)
);

-- position = the order inside the stay's own experience list or service list (0, 1, 2, ...).
create table public.catalog_item_stays (
  item_id uuid not null references public.catalog_items (id) on delete cascade,
  stay_id uuid not null references public.stays (id) on delete cascade,
  position int not null,
  primary key (item_id, stay_id)
);

-- C-15: the three home journeys. Structured prices are parsed from the owner's English price_label, null when
-- unparsable, never computed from anything else.
create table public.journey_tiers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  is_featured boolean not null default false,
  media_id uuid references public.media (id) on delete restrict,
  price_from_amount numeric(12, 2),
  price_from_currency text check (price_from_currency in ('USD', 'AED')),
  est_low numeric(12, 2),
  est_high numeric(12, 2),
  est_open_ended boolean,
  is_published boolean not null default false,
  position int not null default 0,
  is_sample boolean not null default false,
  sample_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journey_tiers_sample_fields check (is_sample = (cardinality(sample_fields) > 0))
);

create table public.journey_tier_translations (
  tier_id uuid not null references public.journey_tiers (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  name text not null,
  price_label text not null,
  tagline text,
  duration_label text,
  ideal_for_label text,
  ideal_for text,
  body text,
  primary key (tier_id, locale)
);

-- C-17: imports empty; the owner publishes the real members. email is never in a view.
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  photo_media_id uuid references public.media (id) on delete restrict,
  email text check (char_length(email) <= 254),
  links jsonb not null default '[]' check (jsonb_typeof(links) = 'array'),
  is_published boolean not null default false,
  position int not null default 0,
  is_sample boolean not null default false,
  sample_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_sample_fields check (is_sample = (cardinality(sample_fields) > 0))
);

create table public.team_member_translations (
  member_id uuid not null references public.team_members (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  name text not null,
  role text,
  bio text,
  primary key (member_id, locale)
);

-- C-22, D-49: the seven journey inclusions, seeded below; no editor in v1.
create table public.inclusions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  position int not null,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inclusion_translations (
  inclusion_id uuid not null references public.inclusions (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  label text not null,
  primary key (inclusion_id, locale)
);

-- Singleton for plan 03.2-05 (rebuild the public site on Publish).
create table public.site_publish (
  id int primary key default 1 check (id = 1),
  requested_seq bigint not null default 0,
  requested_at timestamptz,
  last_hook_at timestamptz,
  last_hook_result text,
  last_build_uuid text
);

insert into public.site_publish (id) values (1) on conflict do nothing;

-- ------------------------------------------------------------------------------------------------------------
-- Indexes (every foreign key column that no primary key already leads with)
-- ------------------------------------------------------------------------------------------------------------

create index media_key_idx on public.media (key);
create unique index media_upload_key_uidx on public.media (key) where source = 'upload';
create index destinations_hero_media_idx on public.destinations (hero_media_id);
create index destinations_inset_media_idx on public.destinations (inset_media_id);
create index stays_destination_idx on public.stays (destination_id);
create index stays_hero_media_idx on public.stays (hero_media_id);
create index stay_gallery_media_idx on public.stay_gallery (media_id);
create index stay_rates_stay_idx on public.stay_rates (stay_id);
create index availability_blocks_destination_idx on public.availability_blocks (destination_id);
create index availability_blocks_stay_idx on public.availability_blocks (stay_id);
create index availability_blocks_dates_idx on public.availability_blocks (starts_on, ends_on);
create index catalog_items_media_idx on public.catalog_items (media_id);
create index catalog_item_destinations_destination_idx on public.catalog_item_destinations (destination_id);
create index catalog_item_stays_stay_idx on public.catalog_item_stays (stay_id);
create index journey_tiers_media_idx on public.journey_tiers (media_id);
create index team_members_photo_idx on public.team_members (photo_media_id);

-- ------------------------------------------------------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------------------------------------------------------

create trigger image_translations_set_updated_at before update on public.image_translations for each row execute function public.catalog_set_updated_at();
create trigger destinations_set_updated_at before update on public.destinations for each row execute function public.catalog_set_updated_at();
create trigger destination_translations_set_updated_at before update on public.destination_translations for each row execute function public.catalog_set_updated_at();
create trigger stays_set_updated_at before update on public.stays for each row execute function public.catalog_set_updated_at();
create trigger stay_translations_set_updated_at before update on public.stay_translations for each row execute function public.catalog_set_updated_at();
create trigger stay_rates_set_updated_at before update on public.stay_rates for each row execute function public.catalog_set_updated_at();
create trigger stay_access_set_updated_at before update on public.stay_access for each row execute function public.catalog_set_updated_at();
create trigger catalog_items_set_updated_at before update on public.catalog_items for each row execute function public.catalog_set_updated_at();
create trigger catalog_translations_set_updated_at before update on public.catalog_translations for each row execute function public.catalog_set_updated_at();
create trigger journey_tiers_set_updated_at before update on public.journey_tiers for each row execute function public.catalog_set_updated_at();
create trigger journey_tier_translations_set_updated_at before update on public.journey_tier_translations for each row execute function public.catalog_set_updated_at();
create trigger team_members_set_updated_at before update on public.team_members for each row execute function public.catalog_set_updated_at();
create trigger team_member_translations_set_updated_at before update on public.team_member_translations for each row execute function public.catalog_set_updated_at();
create trigger inclusions_set_updated_at before update on public.inclusions for each row execute function public.catalog_set_updated_at();
create trigger inclusion_translations_set_updated_at before update on public.inclusion_translations for each row execute function public.catalog_set_updated_at();

-- ------------------------------------------------------------------------------------------------------------
-- Seed: the seven inclusions (contract 2.1; source .planning/design/2026-09-29-system/generator/journey.mjs)
-- English published, Arabic and Spanish draft until the owner reviews them.
-- ------------------------------------------------------------------------------------------------------------

insert into public.inclusions (slug, position) values
  ('airport-meet', 1),
  ('transfer-in-colombia', 2),
  ('your-stay', 3),
  ('private-guide', 4),
  ('security', 5),
  ('insurance', 6),
  ('return', 7)
on conflict (slug) do nothing;

insert into public.inclusion_translations (inclusion_id, locale, status, label)
select i.id, v.locale, v.status, v.label
from (values
  ('airport-meet', 'en', 'published', 'Airport meet'),
  ('airport-meet', 'ar', 'draft', 'استقبال المطار'),
  ('airport-meet', 'es', 'draft', 'Recibimiento en el aeropuerto'),
  ('transfer-in-colombia', 'en', 'published', 'Transfer in Colombia'),
  ('transfer-in-colombia', 'ar', 'draft', 'التنقل داخل كولومبيا'),
  ('transfer-in-colombia', 'es', 'draft', 'Traslado en Colombia'),
  ('your-stay', 'en', 'published', 'Your stay'),
  ('your-stay', 'ar', 'draft', 'إقامتك'),
  ('your-stay', 'es', 'draft', 'Tu estancia'),
  ('private-guide', 'en', 'published', 'Private guide'),
  ('private-guide', 'ar', 'draft', 'مرشد خاص'),
  ('private-guide', 'es', 'draft', 'Guía privado'),
  ('security', 'en', 'published', 'Security'),
  ('security', 'ar', 'draft', 'الأمن'),
  ('security', 'es', 'draft', 'Seguridad'),
  ('insurance', 'en', 'published', 'Insurance'),
  ('insurance', 'ar', 'draft', 'التأمين'),
  ('insurance', 'es', 'draft', 'Seguro'),
  ('return', 'en', 'published', 'Return'),
  ('return', 'ar', 'draft', 'العودة'),
  ('return', 'es', 'draft', 'Regreso')
) as v(slug, locale, status, label)
join public.inclusions i on i.slug = v.slug
on conflict (inclusion_id, locale) do nothing;

-- ------------------------------------------------------------------------------------------------------------
-- Row-level security: on for every table. Nothing is granted to anon or authenticated except the column-level
-- selects below, which are exactly the columns the api_* views read. Never granted at all: stay_rates, stay_access,
-- stays.base_nightly_rate_aed / pets_rule / pets_fee_aed / infants_count, team_members.email,
-- availability_blocks.reason / created_by, media.bytes / sha256 / content_type / source, site_publish internals.
-- service_role keeps Supabase's default rights and bypasses RLS.
-- ------------------------------------------------------------------------------------------------------------

alter table public.media enable row level security;
alter table public.image_translations enable row level security;
alter table public.destinations enable row level security;
alter table public.destination_translations enable row level security;
alter table public.stays enable row level security;
alter table public.stay_gallery enable row level security;
alter table public.stay_translations enable row level security;
alter table public.stay_rates enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.stay_access enable row level security;
alter table public.catalog_items enable row level security;
alter table public.catalog_translations enable row level security;
alter table public.catalog_item_destinations enable row level security;
alter table public.catalog_item_stays enable row level security;
alter table public.journey_tiers enable row level security;
alter table public.journey_tier_translations enable row level security;
alter table public.team_members enable row level security;
alter table public.team_member_translations enable row level security;
alter table public.inclusions enable row level security;
alter table public.inclusion_translations enable row level security;
alter table public.site_publish enable row level security;

revoke all on public.media from public, anon, authenticated;
revoke all on public.image_translations from public, anon, authenticated;
revoke all on public.destinations from public, anon, authenticated;
revoke all on public.destination_translations from public, anon, authenticated;
revoke all on public.stays from public, anon, authenticated;
revoke all on public.stay_gallery from public, anon, authenticated;
revoke all on public.stay_translations from public, anon, authenticated;
revoke all on public.stay_rates from public, anon, authenticated;
revoke all on public.availability_blocks from public, anon, authenticated;
revoke all on public.stay_access from public, anon, authenticated;
revoke all on public.catalog_items from public, anon, authenticated;
revoke all on public.catalog_translations from public, anon, authenticated;
revoke all on public.catalog_item_destinations from public, anon, authenticated;
revoke all on public.catalog_item_stays from public, anon, authenticated;
revoke all on public.journey_tiers from public, anon, authenticated;
revoke all on public.journey_tier_translations from public, anon, authenticated;
revoke all on public.team_members from public, anon, authenticated;
revoke all on public.team_member_translations from public, anon, authenticated;
revoke all on public.inclusions from public, anon, authenticated;
revoke all on public.inclusion_translations from public, anon, authenticated;
revoke all on public.site_publish from public, anon, authenticated;

-- Column-level selects for anon (the views run as the caller: security_invoker).
grant select (id, key, width, height) on public.media to anon;
grant select (image_id, locale, alt, status) on public.image_translations to anon;
grant select (id, slug, hero_media_id, inset_media_id, is_published, position, is_sample, sample_fields, created_at, updated_at)
  on public.destinations to anon;
grant select (destination_id, locale, status, name, short_line, region, summary, nights_label)
  on public.destination_translations to anon;
grant select (id, slug, destination_id, max_guests, min_guests, bedrooms, bathrooms, min_nights, hero_media_id,
  is_published, position, is_sample, sample_fields, created_at, updated_at)
  on public.stays to anon;
grant select (stay_id, media_id, position) on public.stay_gallery to anon;
grant select (stay_id, locale, status, title, tagline, neighborhood, guests_label, bathrooms_label, beds_label,
  price_label, price_note, description, amenities, inclusions, policy_headings)
  on public.stay_translations to anon;
grant select (scope, destination_id, stay_id, starts_on, ends_on) on public.availability_blocks to anon;
grant select (id, slug, kind, unit, price_aed, is_uae, is_home_pickup, media_id, is_published, position, is_sample,
  sample_fields, created_at, updated_at)
  on public.catalog_items to anon;
grant select (item_id, locale, status, name, summary, duration_label) on public.catalog_translations to anon;
grant select (item_id, destination_id) on public.catalog_item_destinations to anon;
grant select (item_id, stay_id, position) on public.catalog_item_stays to anon;
grant select (id, slug, is_featured, media_id, price_from_amount, price_from_currency, est_low, est_high,
  est_open_ended, is_published, position, is_sample, sample_fields, created_at, updated_at)
  on public.journey_tiers to anon;
grant select (tier_id, locale, status, name, price_label, tagline, duration_label, ideal_for_label, ideal_for, body)
  on public.journey_tier_translations to anon;
grant select (id, slug, photo_media_id, links, is_published, position, is_sample, sample_fields, created_at, updated_at)
  on public.team_members to anon;
grant select (member_id, locale, status, name, role, bio) on public.team_member_translations to anon;
grant select (id, slug, position, is_published) on public.inclusions to anon;
grant select (inclusion_id, locale, status, label) on public.inclusion_translations to anon;
grant select (requested_seq) on public.site_publish to anon;

-- Policies: published rows only; a translation or link row follows its parent.
create policy "media: anon reads" on public.media
  for select to anon using (true);
create policy "image_translations: anon reads" on public.image_translations
  for select to anon using (true);
create policy "destinations: anon reads published" on public.destinations
  for select to anon using (is_published);
create policy "destination_translations: anon reads published" on public.destination_translations
  for select to anon using (exists (select 1 from public.destinations p where p.id = destination_id and p.is_published));
create policy "stays: anon reads published" on public.stays
  for select to anon using (is_published);
create policy "stay_gallery: anon reads published" on public.stay_gallery
  for select to anon using (exists (select 1 from public.stays p where p.id = stay_id and p.is_published));
create policy "stay_translations: anon reads published" on public.stay_translations
  for select to anon using (exists (select 1 from public.stays p where p.id = stay_id and p.is_published));
-- Blocked days are baked into the stay pages as hints (C-04); the reason and the author are not granted.
create policy "availability_blocks: anon reads dates" on public.availability_blocks
  for select to anon using (true);
create policy "catalog_items: anon reads published" on public.catalog_items
  for select to anon using (is_published);
create policy "catalog_translations: anon reads published" on public.catalog_translations
  for select to anon using (exists (select 1 from public.catalog_items p where p.id = item_id and p.is_published));
create policy "catalog_item_destinations: anon reads published" on public.catalog_item_destinations
  for select to anon using (exists (select 1 from public.catalog_items p where p.id = item_id and p.is_published));
create policy "catalog_item_stays: anon reads published" on public.catalog_item_stays
  for select to anon using (exists (select 1 from public.catalog_items p where p.id = item_id and p.is_published));
create policy "journey_tiers: anon reads published" on public.journey_tiers
  for select to anon using (is_published);
create policy "journey_tier_translations: anon reads published" on public.journey_tier_translations
  for select to anon using (exists (select 1 from public.journey_tiers p where p.id = tier_id and p.is_published));
create policy "team_members: anon reads published" on public.team_members
  for select to anon using (is_published);
create policy "team_member_translations: anon reads published" on public.team_member_translations
  for select to anon using (exists (select 1 from public.team_members p where p.id = member_id and p.is_published));
create policy "inclusions: anon reads published" on public.inclusions
  for select to anon using (is_published);
create policy "inclusion_translations: anon reads published" on public.inclusion_translations
  for select to anon using (exists (select 1 from public.inclusions p where p.id = inclusion_id and p.is_published));
create policy "site_publish: anon reads the sequence" on public.site_publish
  for select to anon using (true);

-- ------------------------------------------------------------------------------------------------------------
-- Public views (build time, anon key). security_invoker = on: each runs with the caller's rights, so RLS and the
-- column grants above apply, and each also filters is_published itself. Supabase grants ALL on a new view by
-- default: everything is revoked first, then select goes back to anon only.
-- Column order is the fixture's key order: the build serialises rows into client props, so it reaches the HTML bytes.
-- Image objects use json_build_object (not jsonb) so their keys keep the fixture order too.
-- ------------------------------------------------------------------------------------------------------------

create view public.api_destinations with (security_invoker = on) as
select
  d.id, d.created_at, d.updated_at, d.is_sample, d.sample_fields, d.slug,
  case when hm.id is null then null::json
    else json_build_object('id', hm.id, 'media_key', hm.key, 'width', hm.width, 'height', hm.height, 'position', 0) end as hero_image,
  case when im.id is null then null::json
    else json_build_object('id', im.id, 'media_key', im.key, 'width', im.width, 'height', im.height, 'position', 0) end as inset_image,
  d.is_published, d.position
from public.destinations d
left join public.media hm on hm.id = d.hero_media_id
left join public.media im on im.id = d.inset_media_id
where d.is_published
order by d.position, d.slug;

create view public.api_destination_translations with (security_invoker = on) as
select t.destination_id, t.locale, t.name, t.short_line, t.region, t.summary, t.nights_label, t.status
from public.destination_translations t
join public.destinations d on d.id = t.destination_id
where d.is_published
order by d.position, d.slug, t.locale;

-- Blocked nights of every published stay: ops blocks of scope stay, the stay's destination and all, expanded to days,
-- from today for 540 days. No reason. Phase 4 replaces this view (same two columns, same grants) with a union of the
-- nights of paid / confirmed / completed bookings and of hand-made holds still in force.
create view public.api_stay_blocked_days with (security_invoker = on) as
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
where s.is_published;

create view public.api_stays with (security_invoker = on) as
select
  s.id, s.created_at, s.updated_at, s.is_sample, s.sample_fields, s.slug, s.destination_id,
  s.max_guests, s.min_guests, s.bedrooms, s.bathrooms,
  -- C-04: money is read live by the booking path; the build never carries a rate.
  null::numeric as nightly_rate_aed,
  s.min_nights,
  coalesce((select array_agg(b.day order by b.day) from public.api_stay_blocked_days b where b.stay_id = s.id), '{}'::date[]) as blocked_dates,
  coalesce((
    select array_agg(l.item_id order by l.position, c.slug)
    from public.catalog_item_stays l join public.catalog_items c on c.id = l.item_id
    where l.stay_id = s.id and c.kind = 'experience' and c.is_published
  ), '{}'::uuid[]) as experience_ids,
  coalesce((
    select array_agg(l.item_id order by l.position, c.slug)
    from public.catalog_item_stays l join public.catalog_items c on c.id = l.item_id
    where l.stay_id = s.id and c.kind = 'service' and c.is_published
  ), '{}'::uuid[]) as service_ids,
  case when hm.id is null then null::json
    else json_build_object('id', hm.id, 'media_key', hm.key, 'width', hm.width, 'height', hm.height, 'position', 0) end as hero_image,
  coalesce((
    select json_agg(json_build_object('id', gm.id, 'media_key', gm.key, 'width', gm.width, 'height', gm.height, 'position', g.position) order by g.position, gm.key)
    from public.stay_gallery g join public.media gm on gm.id = g.media_id
    where g.stay_id = s.id
  ), '[]'::json) as gallery,
  s.is_published, s.position
from public.stays s
left join public.media hm on hm.id = s.hero_media_id
where s.is_published
order by s.position, s.slug;

create view public.api_stay_translations with (security_invoker = on) as
select
  t.stay_id, t.locale, t.title, t.tagline, t.neighborhood, t.guests_label, t.bathrooms_label, t.beds_label,
  t.price_label, t.price_note, t.description, t.amenities, t.inclusions, t.policy_headings, t.status
from public.stay_translations t
join public.stays s on s.id = t.stay_id
where s.is_published
order by s.position, s.slug, t.locale;

create view public.api_catalog with (security_invoker = on) as
select
  c.id, c.created_at, c.updated_at, c.is_sample, c.sample_fields, c.slug, c.kind, c.unit, c.price_aed, c.is_uae,
  case when m.id is null then null::json
    else json_build_object('id', m.id, 'media_key', m.key, 'width', m.width, 'height', m.height, 'position', 0) end as image,
  coalesce((
    select array_agg(cd.destination_id order by d.position, d.slug)
    from public.catalog_item_destinations cd join public.destinations d on d.id = cd.destination_id
    where cd.item_id = c.id and d.is_published
  ), '{}'::uuid[]) as destination_ids,
  coalesce((
    select array_agg(cs.stay_id order by s.position, s.slug)
    from public.catalog_item_stays cs join public.stays s on s.id = cs.stay_id
    where cs.item_id = c.id and s.is_published
  ), '{}'::uuid[]) as stay_ids,
  c.is_published, c.position
from public.catalog_items c
left join public.media m on m.id = c.media_id
where c.is_published
order by c.position, c.slug;

create view public.api_catalog_translations with (security_invoker = on) as
select t.item_id, t.locale, t.name, t.summary, t.duration_label, t.status
from public.catalog_translations t
join public.catalog_items c on c.id = t.item_id
where c.is_published
order by c.position, c.slug, t.locale;

create view public.api_journey_tiers with (security_invoker = on) as
select
  j.id, j.created_at, j.updated_at, j.is_sample, j.sample_fields, j.slug,
  case when j.price_from_amount is null or j.price_from_currency is null then null::json
    else json_build_object('amount', trim_scale(j.price_from_amount), 'currency', j.price_from_currency) end as price_from,
  case when j.est_low is null then null::json
    else json_build_object('low', trim_scale(j.est_low), 'high', trim_scale(j.est_high), 'currency', 'AED', 'open_ended', coalesce(j.est_open_ended, false)) end as price_estimate,
  j.is_featured,
  case when m.id is null then null::json
    else json_build_object('id', m.id, 'media_key', m.key, 'width', m.width, 'height', m.height, 'position', 0) end as image,
  j.is_published, j.position
from public.journey_tiers j
left join public.media m on m.id = j.media_id
where j.is_published
order by j.position, j.slug;

create view public.api_journey_tier_translations with (security_invoker = on) as
select t.tier_id, t.locale, t.name, t.price_label, t.tagline, t.duration_label, t.ideal_for_label, t.ideal_for, t.body, t.status
from public.journey_tier_translations t
join public.journey_tiers j on j.id = t.tier_id
where j.is_published
order by j.position, j.slug, t.locale;

-- No email: it is never granted to anon.
create view public.api_team with (security_invoker = on) as
select
  t.id, t.created_at, t.updated_at, t.is_sample, t.sample_fields, t.slug,
  case when m.id is null then null::json
    else json_build_object('id', m.id, 'media_key', m.key, 'width', m.width, 'height', m.height, 'position', 0) end as photo,
  t.links,
  t.is_published, t.position
from public.team_members t
left join public.media m on m.id = t.photo_media_id
where t.is_published
order by t.position, t.slug;

create view public.api_team_translations with (security_invoker = on) as
select tt.member_id, tt.locale, tt.name, tt.role, tt.bio, tt.status
from public.team_member_translations tt
join public.team_members t on t.id = tt.member_id
where t.is_published
order by t.position, t.slug, tt.locale;

create view public.api_image_translations with (security_invoker = on) as
select it.image_id, it.locale, it.alt, it.status
from public.image_translations it
order by it.image_id, it.locale;

-- Phase 4's step "Included in your journey": one row per inclusion per language.
create view public.api_inclusions with (security_invoker = on) as
select t.inclusion_id, t.locale, t.status, t.label, i.position, i.slug
from public.inclusions i
join public.inclusion_translations t on t.inclusion_id = i.id
where i.is_published
order by i.position, t.locale;

-- For scripts/build-live.mjs (03.2-05): the sequence the build was started for.
create view public.api_site_version with (security_invoker = on) as
select requested_seq from public.site_publish limit 1;

revoke all on public.api_destinations from public, anon, authenticated;
revoke all on public.api_destination_translations from public, anon, authenticated;
revoke all on public.api_stay_blocked_days from public, anon, authenticated;
revoke all on public.api_stays from public, anon, authenticated;
revoke all on public.api_stay_translations from public, anon, authenticated;
revoke all on public.api_catalog from public, anon, authenticated;
revoke all on public.api_catalog_translations from public, anon, authenticated;
revoke all on public.api_journey_tiers from public, anon, authenticated;
revoke all on public.api_journey_tier_translations from public, anon, authenticated;
revoke all on public.api_team from public, anon, authenticated;
revoke all on public.api_team_translations from public, anon, authenticated;
revoke all on public.api_image_translations from public, anon, authenticated;
revoke all on public.api_inclusions from public, anon, authenticated;
revoke all on public.api_site_version from public, anon, authenticated;

grant select on public.api_destinations to anon;
grant select on public.api_destination_translations to anon;
grant select on public.api_stay_blocked_days to anon;
grant select on public.api_stays to anon;
grant select on public.api_stay_translations to anon;
grant select on public.api_catalog to anon;
grant select on public.api_catalog_translations to anon;
grant select on public.api_journey_tiers to anon;
grant select on public.api_journey_tier_translations to anon;
grant select on public.api_team to anon;
grant select on public.api_team_translations to anon;
grant select on public.api_image_translations to anon;
grant select on public.api_inclusions to anon;
grant select on public.api_site_version to anon;

-- ------------------------------------------------------------------------------------------------------------
-- Functions. Every one is security invoker with an empty search_path (names are fully qualified) and executable by
-- service_role only: the revoke / grant pair follows each definition. service_role already has table rights.
-- Business refusals are raised as SQLSTATE P0001, message 'almar:<code>', detail = json text (contract 2.3).
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.catalog_fail(p_code text, p_detail jsonb default '{}'::jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = 'almar:' || p_code, detail = p_detail::text;
end;
$$;

revoke execute on function public.catalog_fail(text, jsonb) from public, anon, authenticated;
grant execute on function public.catalog_fail(text, jsonb) to service_role;

-- almar:invalid with the first bad field (dotted path) and the language when it is per language.
create or replace function public.catalog_invalid(p_field text, p_locale text default null)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform public.catalog_fail('invalid', jsonb_build_object('field', p_field, 'locale', p_locale));
end;
$$;

revoke execute on function public.catalog_invalid(text, text) from public, anon, authenticated;
grant execute on function public.catalog_invalid(text, text) to service_role;

-- A trimmed text value of a json object; empty becomes null.
create or replace function public.catalog_txt(p jsonb, p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(p ->> p_key, E' \t\r\n'), '')
$$;

revoke execute on function public.catalog_txt(jsonb, text) from public, anon, authenticated;
grant execute on function public.catalog_txt(jsonb, text) to service_role;

-- An exact text value (passwords and door codes are not trimmed); empty becomes null.
create or replace function public.catalog_raw(p jsonb, p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(p ->> p_key, '')
$$;

revoke execute on function public.catalog_raw(jsonb, text) from public, anon, authenticated;
grant execute on function public.catalog_raw(jsonb, text) to service_role;

-- True for a missing value, a json null and a blank string.
create or replace function public.catalog_blank(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select j is null
    or jsonb_typeof(j) = 'null'
    or (jsonb_typeof(j) = 'string' and btrim(j #>> '{}', E' \t\r\n') = '')
$$;

revoke execute on function public.catalog_blank(jsonb) from public, anon, authenticated;
grant execute on function public.catalog_blank(jsonb) to service_role;

-- A json array of strings as a trimmed text[] (anything else is the empty array).
create or replace function public.catalog_txt_array(p jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array(
    select btrim(e.value, E' \t\r\n')
    from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality as e(value, ord)
    order by e.ord
  )
$$;

revoke execute on function public.catalog_txt_array(jsonb) from public, anon, authenticated;
grant execute on function public.catalog_txt_array(jsonb) to service_role;

create or replace function public.catalog_uuid_array(p jsonb)
returns uuid[]
language sql
immutable
set search_path = ''
as $$
  select array(
    select e.value::uuid
    from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality as e(value, ord)
    order by e.ord
  )
$$;

revoke execute on function public.catalog_uuid_array(jsonb) from public, anon, authenticated;
grant execute on function public.catalog_uuid_array(jsonb) to service_role;

create or replace function public.catalog_need_media(p_id uuid, p_field text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_id is not null and not exists (select 1 from public.media m where m.id = p_id) then
    perform public.catalog_invalid(p_field);
  end if;
end;
$$;

revoke execute on function public.catalog_need_media(uuid, text) from public, anon, authenticated;
grant execute on function public.catalog_need_media(uuid, text) to service_role;

-- The five entities the owner edits: base table, translation table, its foreign key, the translated columns
-- ('name:t' = text, 'name:a' = text array) and the columns that must be filled in every language to publish.
-- A fixed list: nothing a caller sends is ever used as an identifier.
create or replace function public.catalog_entity_meta(p_entity text)
returns table (base_tbl text, tr_tbl text, fk text, cols text[], req text[])
language sql
immutable
set search_path = ''
as $$
  select v.base_tbl, v.tr_tbl, v.fk, v.cols, v.req
  from (values
    ('destination', 'destinations', 'destination_translations', 'destination_id',
      array['name:t', 'short_line:t', 'region:t', 'summary:t', 'nights_label:t'], array['name']),
    ('stay', 'stays', 'stay_translations', 'stay_id',
      array['title:t', 'tagline:t', 'neighborhood:t', 'guests_label:t', 'bathrooms_label:t', 'beds_label:t', 'price_label:t', 'price_note:t',
            'description:a', 'amenities:a', 'inclusions:a', 'policy_headings:a'], array['title']),
    ('catalog_item', 'catalog_items', 'catalog_translations', 'item_id',
      array['name:t', 'summary:t', 'duration_label:t'], array['name']),
    ('team_member', 'team_members', 'team_member_translations', 'member_id',
      array['name:t', 'role:t', 'bio:t'], array['name']),
    ('journey_tier', 'journey_tiers', 'journey_tier_translations', 'tier_id',
      array['name:t', 'price_label:t', 'tagline:t', 'duration_label:t', 'ideal_for_label:t', 'ideal_for:t', 'body:t'], array['name', 'price_label'])
  ) as v(entity, base_tbl, tr_tbl, fk, cols, req)
  where v.entity = p_entity
$$;

revoke execute on function public.catalog_entity_meta(text) from public, anon, authenticated;
grant execute on function public.catalog_entity_meta(text) to service_role;

-- Saves the translation records of one entity from {en: {...}, ar: {...}|null, es: ...} (contract 1.2): a language
-- absent leaves its record alone, null deletes it (never en), a present object upserts it and, inside it, a key
-- absent leaves that field alone. Text is trimmed and empty becomes null. p_need_en: the English record must exist
-- afterwards (a new row).
create or replace function public.catalog_save_translations(p_entity text, p_id uuid, p_tr jsonb, p_need_en boolean default false)
returns void
language plpgsql
set search_path = ''
as $$
declare
  m record;
  v_loc text;
  v_obj jsonb;
  v_col text;
  v_spec text;
  v_names text := '';
  v_vals text := '';
  v_sets text := '';
  v_sql text;
  v_exists boolean;
begin
  select * into m from public.catalog_entity_meta(p_entity);
  if not found then
    perform public.catalog_invalid('entity');
  end if;

  if p_tr is not null and jsonb_typeof(p_tr) <> 'null' then
    if jsonb_typeof(p_tr) <> 'object' then
      perform public.catalog_invalid('translations');
    end if;
    for v_loc in select k from jsonb_object_keys(p_tr) as k loop
      if v_loc not in ('en', 'ar', 'es') then
        perform public.catalog_invalid('translations.' || v_loc);
      end if;
    end loop;

    foreach v_spec in array m.cols loop
      v_col := split_part(v_spec, ':', 1);
      v_names := v_names || format(', %I', v_col);
      -- A required (not null) column absent from p keeps the value the record already holds: the row is proposed to
      -- the insert first, and a null there would fail before `on conflict` can turn it into an update.
      v_vals := v_vals || case
        when split_part(v_spec, ':', 2) = 'a'
          then format(', public.catalog_txt_array($3 -> %L)', v_col)
        when v_col = any (m.req)
          then format(', coalesce(public.catalog_txt($3, %1$L), (select x.%1$I from public.%2$I x where x.%3$I = $1 and x.locale = $2))', v_col, m.tr_tbl, m.fk)
        else format(', public.catalog_txt($3, %L)', v_col) end;
      v_sets := v_sets || format(', %1$I = case when $3 ? %1$L then excluded.%1$I else t.%1$I end', v_col);
    end loop;
    v_sql := format('insert into public.%1$I as t (%2$I, locale, status%3$s) ', m.tr_tbl, m.fk, v_names)
      || format('values ($1, $2, coalesce(nullif($3 ->> ''status'', ''''), ''draft'')%s) ', v_vals)
      || format('on conflict (%1$I, locale) do update set status = case when $3 ? ''status'' then excluded.status else t.status end%2$s', m.fk, v_sets);

    foreach v_loc in array array['en', 'ar', 'es'] loop
      if not (p_tr ? v_loc) then
        continue;
      end if;
      v_obj := p_tr -> v_loc;
      if jsonb_typeof(v_obj) = 'null' then
        if v_loc = 'en' then
          perform public.catalog_invalid('translations.en', 'en');
        end if;
        execute format('delete from public.%I where %I = $1 and locale = $2', m.tr_tbl, m.fk) using p_id, v_loc;
        continue;
      end if;
      if jsonb_typeof(v_obj) <> 'object' then
        perform public.catalog_invalid('translations.' || v_loc, v_loc);
      end if;
      execute format('select exists (select 1 from public.%I where %I = $1 and locale = $2)', m.tr_tbl, m.fk) into v_exists using p_id, v_loc;
      foreach v_col in array m.req loop
        if v_obj ? v_col then
          if public.catalog_txt(v_obj, v_col) is null then
            perform public.catalog_invalid('translations.' || v_loc || '.' || v_col, v_loc);
          end if;
        elsif not v_exists then
          perform public.catalog_invalid('translations.' || v_loc || '.' || v_col, v_loc);
        end if;
      end loop;
      execute v_sql using p_id, v_loc, v_obj;
    end loop;
  end if;

  if p_need_en then
    execute format('select exists (select 1 from public.%I where %I = $1 and locale = ''en'')', m.tr_tbl, m.fk) into v_exists using p_id;
    if not v_exists then
      perform public.catalog_invalid('translations.en', 'en');
    end if;
  end if;
end;
$$;

revoke execute on function public.catalog_save_translations(text, uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.catalog_save_translations(text, uuid, jsonb, boolean) to service_role;

-- One translation record as json (text columns and status; no key, locale or timestamp), or null.
create or replace function public.catalog_tr_json(p_entity text, p_id uuid, p_locale text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  m record;
  v jsonb;
begin
  select * into m from public.catalog_entity_meta(p_entity);
  if not found then
    perform public.catalog_invalid('entity');
  end if;
  execute format('select to_jsonb(t) - %L - ''locale'' - ''updated_at'' from public.%I t where t.%I = $1 and t.locale = $2', m.fk, m.tr_tbl, m.fk)
    into v using p_id, p_locale;
  return v;
end;
$$;

revoke execute on function public.catalog_tr_json(text, uuid, text) from public, anon, authenticated;
grant execute on function public.catalog_tr_json(text, uuid, text) to service_role;

create or replace function public.catalog_tr_all(p_entity text, p_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'en', public.catalog_tr_json(p_entity, p_id, 'en'),
    'ar', public.catalog_tr_json(p_entity, p_id, 'ar'),
    'es', public.catalog_tr_json(p_entity, p_id, 'es')
  )
$$;

revoke execute on function public.catalog_tr_all(text, uuid) from public, anon, authenticated;
grant execute on function public.catalog_tr_all(text, uuid) to service_role;

-- {en: 'published'|'draft'|'missing', ar: ..., es: ...}
create or replace function public.catalog_tr_state(p_entity text, p_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  m record;
  v jsonb;
begin
  select * into m from public.catalog_entity_meta(p_entity);
  if not found then
    perform public.catalog_invalid('entity');
  end if;
  execute format(
    'select jsonb_build_object(''en'', coalesce(max(status) filter (where locale = ''en''), ''missing''), '
    || '''ar'', coalesce(max(status) filter (where locale = ''ar''), ''missing''), '
    || '''es'', coalesce(max(status) filter (where locale = ''es''), ''missing'')) from public.%I where %I = $1', m.tr_tbl, m.fk)
    into v using p_id;
  return v;
end;
$$;

revoke execute on function public.catalog_tr_state(text, uuid) from public, anon, authenticated;
grant execute on function public.catalog_tr_state(text, uuid) to service_role;

-- Contract 5.9. Every text field filled in English must be filled in this language too (arrays: same length, no empty
-- item); p_req names the fields that must be filled even in English. Returns [{locale, field}, ...].
create or replace function public.catalog_gaps(p_en jsonb, p_rec jsonb, p_locale text, p_req text[])
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_key text;
  v_en_val jsonb;
  v_val jsonb;
  v_gap boolean;
begin
  foreach v_key in array coalesce(p_req, '{}'::text[]) loop
    if public.catalog_blank(p_rec -> v_key) then
      v_out := v_out || jsonb_build_array(jsonb_build_object('locale', p_locale, 'field', v_key));
    end if;
  end loop;
  if p_locale = 'en' or p_en is null then
    return v_out;
  end if;
  for v_key, v_en_val in select e.key, e.value from jsonb_each(p_en) as e loop
    if v_key = 'status' or v_key = any (coalesce(p_req, '{}'::text[])) then
      continue;
    end if;
    v_val := p_rec -> v_key;
    v_gap := false;
    if jsonb_typeof(v_en_val) = 'array' then
      if jsonb_array_length(v_en_val) > 0 then
        v_gap := v_val is null
          or jsonb_typeof(v_val) <> 'array'
          or jsonb_array_length(v_val) <> jsonb_array_length(v_en_val)
          or exists (select 1 from jsonb_array_elements_text(v_val) as x(value) where btrim(x.value, E' \t\r\n') = '');
      end if;
    elsif not public.catalog_blank(v_en_val) then
      v_gap := public.catalog_blank(v_val);
    end if;
    if v_gap then
      v_out := v_out || jsonb_build_array(jsonb_build_object('locale', p_locale, 'field', v_key));
    end if;
  end loop;
  return v_out;
end;
$$;

revoke execute on function public.catalog_gaps(jsonb, jsonb, text, text[]) from public, anon, authenticated;
grant execute on function public.catalog_gaps(jsonb, jsonb, text, text[]) to service_role;

-- A photo as the screens need it. The route adds `url` with mediaUrl(): the database only knows the key.
create or replace function public.catalog_media_ref(p_media uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', m.id, 'key', m.key, 'width', m.width, 'height', m.height,
    'alt_en', (select it.alt from public.image_translations it where it.image_id = m.id and it.locale = 'en')
  )
  from public.media m
  where m.id = p_media
$$;

revoke execute on function public.catalog_media_ref(uuid) from public, anon, authenticated;
grant execute on function public.catalog_media_ref(uuid) to service_role;

-- Rows of any table, published or not, that reference the photo.
create or replace function public.catalog_media_uses(p_id uuid)
returns int
language sql
stable
set search_path = ''
as $$
  select (
    (select count(*) from public.destinations d where d.hero_media_id = p_id or d.inset_media_id = p_id)
    + (select count(*) from public.stays s where s.hero_media_id = p_id)
    + (select count(*) from public.stay_gallery g where g.media_id = p_id)
    + (select count(*) from public.catalog_items c where c.media_id = p_id)
    + (select count(*) from public.journey_tiers j where j.media_id = p_id)
    + (select count(*) from public.team_members t where t.photo_media_id = p_id)
  )::int
$$;

revoke execute on function public.catalog_media_uses(uuid) from public, anon, authenticated;
grant execute on function public.catalog_media_uses(uuid) to service_role;

-- True when a published row references the photo (a change to its alt text reaches the public site).
create or replace function public.catalog_media_live(p_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.destinations d where d.is_published and (d.hero_media_id = p_id or d.inset_media_id = p_id))
    or exists (select 1 from public.stays s where s.is_published and s.hero_media_id = p_id)
    or exists (select 1 from public.stay_gallery g join public.stays s on s.id = g.stay_id where s.is_published and g.media_id = p_id)
    or exists (select 1 from public.catalog_items c where c.is_published and c.media_id = p_id)
    or exists (select 1 from public.journey_tiers j where j.is_published and j.media_id = p_id)
    or exists (select 1 from public.team_members t where t.is_published and t.photo_media_id = p_id)
$$;

revoke execute on function public.catalog_media_live(uuid) from public, anon, authenticated;
grant execute on function public.catalog_media_live(uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- ops_save_*: create (no id) or update. Save semantics (contract 1.2): a key absent from p leaves that column or join
-- set alone; a key present, null and [] included, sets it; a join set is replaced only when its key is present; on
-- create, absent keys take the database default. is_published and position are never set here (ops_publish,
-- ops_reorder). A published row keeps its slug (public URLs depend on it).
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.ops_save_destination(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_create boolean := nullif(p ->> 'id', '') is null;
  v_pub boolean;
  v_slug text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('item');
  end if;
  if p ? 'hero_media_id' then
    perform public.catalog_need_media((p ->> 'hero_media_id')::uuid, 'hero_media_id');
  end if;
  if p ? 'inset_media_id' then
    perform public.catalog_need_media((p ->> 'inset_media_id')::uuid, 'inset_media_id');
  end if;

  if v_create then
    if public.catalog_txt(p, 'slug') is null then
      perform public.catalog_invalid('slug');
    end if;
    insert into public.destinations (slug, hero_media_id, inset_media_id, position)
    values (
      public.catalog_txt(p, 'slug'), (p ->> 'hero_media_id')::uuid, (p ->> 'inset_media_id')::uuid,
      coalesce((select max(d.position) from public.destinations d), 0) + 1
    )
    returning id into v_id;
  else
    select d.is_published, d.slug into v_pub, v_slug from public.destinations d where d.id = v_id for update;
    if not found then
      perform public.catalog_fail('not_found');
    end if;
    if v_pub and p ? 'slug' and public.catalog_txt(p, 'slug') is distinct from v_slug then
      perform public.catalog_invalid('slug');
    end if;
    update public.destinations d set
      slug = case when p ? 'slug' then public.catalog_txt(p, 'slug') else d.slug end,
      hero_media_id = case when p ? 'hero_media_id' then (p ->> 'hero_media_id')::uuid else d.hero_media_id end,
      inset_media_id = case when p ? 'inset_media_id' then (p ->> 'inset_media_id')::uuid else d.inset_media_id end
    where d.id = v_id;
  end if;

  perform public.catalog_save_translations('destination', v_id, p -> 'translations', v_create);
  select d.is_published into v_pub from public.destinations d where d.id = v_id;
  return jsonb_build_object('id', v_id, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_destination(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_destination(jsonb) to service_role;

create or replace function public.ops_save_stay(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_create boolean := nullif(p ->> 'id', '') is null;
  v_pub boolean;
  v_slug text;
  v_dest uuid;
  v_ids uuid[];
  v_kind text;
  v_conn jsonb;
  v_en_count int;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('item');
  end if;
  if p ? 'hero_media_id' then
    perform public.catalog_need_media((p ->> 'hero_media_id')::uuid, 'hero_media_id');
  end if;
  if p ? 'destination_id' and (public.catalog_txt(p, 'destination_id') is null
      or not exists (select 1 from public.destinations d where d.id = (p ->> 'destination_id')::uuid)) then
    perform public.catalog_invalid('destination_id');
  end if;

  if v_create then
    if public.catalog_txt(p, 'slug') is null then
      perform public.catalog_invalid('slug');
    end if;
    if not p ? 'destination_id' then
      perform public.catalog_invalid('destination_id');
    end if;
    insert into public.stays (
      slug, destination_id, max_guests, min_guests, bedrooms, bathrooms, min_nights,
      pets_rule, pets_fee_aed, infants_count, hero_media_id, position
    )
    values (
      public.catalog_txt(p, 'slug'), (p ->> 'destination_id')::uuid,
      (p ->> 'max_guests')::int, (p ->> 'min_guests')::int, (p ->> 'bedrooms')::int, (p ->> 'bathrooms')::int,
      coalesce((p ->> 'min_nights')::int, 1),
      public.catalog_txt(p, 'pets_rule'), (p ->> 'pets_fee_aed')::numeric, (p ->> 'infants_count')::boolean,
      (p ->> 'hero_media_id')::uuid,
      coalesce((select max(s.position) from public.stays s), 0) + 1
    )
    returning id into v_id;
  else
    select s.is_published, s.slug, s.destination_id into v_pub, v_slug, v_dest from public.stays s where s.id = v_id for update;
    if not found then
      perform public.catalog_fail('not_found');
    end if;
    if v_pub and p ? 'slug' and public.catalog_txt(p, 'slug') is distinct from v_slug then
      perform public.catalog_invalid('slug');
    end if;
    -- A published stay moved to an unpublished destination would break the public build.
    if v_pub and p ? 'destination_id' and (p ->> 'destination_id')::uuid <> v_dest
       and not exists (select 1 from public.destinations d where d.id = (p ->> 'destination_id')::uuid and d.is_published) then
      perform public.catalog_fail('parent_unpublished', jsonb_build_object('field', 'destination_id'));
    end if;
    update public.stays s set
      slug = case when p ? 'slug' then public.catalog_txt(p, 'slug') else s.slug end,
      destination_id = case when p ? 'destination_id' then (p ->> 'destination_id')::uuid else s.destination_id end,
      max_guests = case when p ? 'max_guests' then (p ->> 'max_guests')::int else s.max_guests end,
      min_guests = case when p ? 'min_guests' then (p ->> 'min_guests')::int else s.min_guests end,
      bedrooms = case when p ? 'bedrooms' then (p ->> 'bedrooms')::int else s.bedrooms end,
      bathrooms = case when p ? 'bathrooms' then (p ->> 'bathrooms')::int else s.bathrooms end,
      min_nights = case when p ? 'min_nights' then (p ->> 'min_nights')::int else s.min_nights end,
      pets_rule = case when p ? 'pets_rule' then public.catalog_txt(p, 'pets_rule') else s.pets_rule end,
      pets_fee_aed = case when p ? 'pets_fee_aed' then (p ->> 'pets_fee_aed')::numeric else s.pets_fee_aed end,
      infants_count = case when p ? 'infants_count' then (p ->> 'infants_count')::boolean else s.infants_count end,
      hero_media_id = case when p ? 'hero_media_id' then (p ->> 'hero_media_id')::uuid else s.hero_media_id end
    where s.id = v_id;
  end if;

  perform public.catalog_save_translations('stay', v_id, p -> 'translations', v_create);

  -- The gallery, in the order given (positions 1, 2, 3, ...), replaced only when the key is present.
  if p ? 'gallery_media_ids' then
    v_ids := public.catalog_uuid_array(p -> 'gallery_media_ids');
    if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as x)
       or (select count(*) from public.media m where m.id = any (v_ids)) <> cardinality(v_ids) then
      perform public.catalog_invalid('gallery_media_ids');
    end if;
    delete from public.stay_gallery g where g.stay_id = v_id and g.media_id <> all (v_ids);
    insert into public.stay_gallery (stay_id, media_id, position)
    select v_id, u.id, u.ord from unnest(v_ids) with ordinality as u(id, ord)
    on conflict (stay_id, media_id) do update set position = excluded.position;
  end if;

  -- Connections: each list replaces that kind's links of this stay, in the order given (positions 0, 1, 2, ...).
  if p ? 'connections' then
    v_conn := coalesce(nullif(p -> 'connections', 'null'::jsonb), '{"experience_ids": [], "service_ids": []}'::jsonb);
    if jsonb_typeof(v_conn) <> 'object' then
      perform public.catalog_invalid('connections');
    end if;
    foreach v_kind in array array['experience', 'service'] loop
      if v_conn ? (v_kind || '_ids') then
        v_ids := public.catalog_uuid_array(v_conn -> (v_kind || '_ids'));
        if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as x)
           or (select count(*) from public.catalog_items c where c.id = any (v_ids) and c.kind = v_kind) <> cardinality(v_ids) then
          perform public.catalog_invalid('connections.' || v_kind || '_ids');
        end if;
        delete from public.catalog_item_stays cs using public.catalog_items ci
        where cs.stay_id = v_id and ci.id = cs.item_id and ci.kind = v_kind;
        insert into public.catalog_item_stays (item_id, stay_id, position)
        select u.id, v_id, (u.ord - 1)::int from unnest(v_ids) with ordinality as u(id, ord);
      end if;
    end loop;
  end if;

  select s.is_published into v_pub from public.stays s where s.id = v_id;

  -- The public build throws when a language's amenities differ in length from English. Enforced on every save of a
  -- published stay, and on a draft whenever that language already holds a list (an empty list is a draft in progress;
  -- ops_publish refuses it).
  select cardinality(t.amenities) into v_en_count from public.stay_translations t where t.stay_id = v_id and t.locale = 'en';
  if found and exists (
    select 1 from public.stay_translations t
    where t.stay_id = v_id and t.locale in ('ar', 'es') and cardinality(t.amenities) <> v_en_count
      and (v_pub or cardinality(t.amenities) > 0)
  ) then
    perform public.catalog_fail('amenities_mismatch', jsonb_build_object('field', 'amenities'));
  end if;

  return jsonb_build_object('id', v_id, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_stay(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_stay(jsonb) to service_role;

create or replace function public.ops_save_catalog_item(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_create boolean := nullif(p ->> 'id', '') is null;
  v_pub boolean;
  v_slug text;
  v_kind text;
  v_ids uuid[];
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('item');
  end if;
  if p ? 'media_id' then
    perform public.catalog_need_media((p ->> 'media_id')::uuid, 'media_id');
  end if;

  if v_create then
    if public.catalog_txt(p, 'slug') is null then
      perform public.catalog_invalid('slug');
    end if;
    if public.catalog_txt(p, 'kind') is null then
      perform public.catalog_invalid('kind');
    end if;
    if public.catalog_txt(p, 'unit') is null then
      perform public.catalog_invalid('unit');
    end if;
    insert into public.catalog_items (slug, kind, unit, price_aed, is_uae, is_home_pickup, media_id, position)
    values (
      public.catalog_txt(p, 'slug'), public.catalog_txt(p, 'kind'), public.catalog_txt(p, 'unit'),
      (p ->> 'price_aed')::numeric, coalesce((p ->> 'is_uae')::boolean, false), coalesce((p ->> 'is_home_pickup')::boolean, false),
      (p ->> 'media_id')::uuid,
      coalesce((select max(c.position) from public.catalog_items c), 0) + 1
    )
    returning id into v_id;
  else
    select c.is_published, c.slug into v_pub, v_slug from public.catalog_items c where c.id = v_id for update;
    if not found then
      perform public.catalog_fail('not_found');
    end if;
    if v_pub and p ? 'slug' and public.catalog_txt(p, 'slug') is distinct from v_slug then
      perform public.catalog_invalid('slug');
    end if;
    update public.catalog_items c set
      slug = case when p ? 'slug' then public.catalog_txt(p, 'slug') else c.slug end,
      kind = case when p ? 'kind' then public.catalog_txt(p, 'kind') else c.kind end,
      unit = case when p ? 'unit' then public.catalog_txt(p, 'unit') else c.unit end,
      price_aed = case when p ? 'price_aed' then (p ->> 'price_aed')::numeric else c.price_aed end,
      is_uae = case when p ? 'is_uae' then (p ->> 'is_uae')::boolean else c.is_uae end,
      is_home_pickup = case when p ? 'is_home_pickup' then (p ->> 'is_home_pickup')::boolean else c.is_home_pickup end,
      media_id = case when p ? 'media_id' then (p ->> 'media_id')::uuid else c.media_id end
    where c.id = v_id;
  end if;

  perform public.catalog_save_translations('catalog_item', v_id, p -> 'translations', v_create);

  if p ? 'destination_ids' then
    v_ids := public.catalog_uuid_array(p -> 'destination_ids');
    if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as x)
       or (select count(*) from public.destinations d where d.id = any (v_ids)) <> cardinality(v_ids) then
      perform public.catalog_invalid('destination_ids');
    end if;
    delete from public.catalog_item_destinations cd where cd.item_id = v_id and cd.destination_id <> all (v_ids);
    insert into public.catalog_item_destinations (item_id, destination_id)
    select v_id, u from unnest(v_ids) as u
    on conflict do nothing;
  end if;

  -- Stay links: kept pairs keep their position, new pairs go to the end of that stay's list of this kind.
  if p ? 'stay_ids' then
    select c.kind into v_kind from public.catalog_items c where c.id = v_id;
    v_ids := public.catalog_uuid_array(p -> 'stay_ids');
    if cardinality(v_ids) <> (select count(distinct x) from unnest(v_ids) as x)
       or (select count(*) from public.stays s where s.id = any (v_ids)) <> cardinality(v_ids) then
      perform public.catalog_invalid('stay_ids');
    end if;
    delete from public.catalog_item_stays cs where cs.item_id = v_id and cs.stay_id <> all (v_ids);
    insert into public.catalog_item_stays (item_id, stay_id, position)
    select v_id, s.id, coalesce((
      select max(x.position) + 1
      from public.catalog_item_stays x join public.catalog_items ci on ci.id = x.item_id
      where x.stay_id = s.id and ci.kind = v_kind
    ), 0)
    from public.stays s
    where s.id = any (v_ids)
      and not exists (select 1 from public.catalog_item_stays k where k.item_id = v_id and k.stay_id = s.id);
  end if;

  select c.is_published into v_pub from public.catalog_items c where c.id = v_id;
  return jsonb_build_object('id', v_id, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_catalog_item(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_catalog_item(jsonb) to service_role;

create or replace function public.ops_save_team_member(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_create boolean := nullif(p ->> 'id', '') is null;
  v_pub boolean;
  v_slug text;
  v_links jsonb;
  v_norm jsonb := '[]'::jsonb;
  v_item jsonb;
  v_label text;
  v_url text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('item');
  end if;
  if p ? 'photo_media_id' then
    perform public.catalog_need_media((p ->> 'photo_media_id')::uuid, 'photo_media_id');
  end if;
  -- links: at most 8 of {label <= 40 characters, url https only <= 300}.
  if p ? 'links' then
    v_links := coalesce(nullif(p -> 'links', 'null'::jsonb), '[]'::jsonb);
    if jsonb_typeof(v_links) <> 'array' or jsonb_array_length(v_links) > 8 then
      perform public.catalog_invalid('links');
    end if;
    for v_item in select e.value from jsonb_array_elements(v_links) as e loop
      v_label := public.catalog_txt(v_item, 'label');
      v_url := public.catalog_txt(v_item, 'url');
      if jsonb_typeof(v_item) <> 'object' or v_label is null or char_length(v_label) > 40
         or v_url is null or char_length(v_url) > 300 or v_url !~ '^https://[^[:space:]]+$' then
        perform public.catalog_invalid('links');
      end if;
      v_norm := v_norm || jsonb_build_array(jsonb_build_object('label', v_label, 'url', v_url));
    end loop;
  end if;

  if v_create then
    if public.catalog_txt(p, 'slug') is null then
      perform public.catalog_invalid('slug');
    end if;
    insert into public.team_members (slug, photo_media_id, email, links, position)
    values (
      public.catalog_txt(p, 'slug'), (p ->> 'photo_media_id')::uuid, public.catalog_txt(p, 'email'), v_norm,
      coalesce((select max(t.position) from public.team_members t), 0) + 1
    )
    returning id into v_id;
  else
    select t.is_published, t.slug into v_pub, v_slug from public.team_members t where t.id = v_id for update;
    if not found then
      perform public.catalog_fail('not_found');
    end if;
    if v_pub and p ? 'slug' and public.catalog_txt(p, 'slug') is distinct from v_slug then
      perform public.catalog_invalid('slug');
    end if;
    update public.team_members t set
      slug = case when p ? 'slug' then public.catalog_txt(p, 'slug') else t.slug end,
      photo_media_id = case when p ? 'photo_media_id' then (p ->> 'photo_media_id')::uuid else t.photo_media_id end,
      email = case when p ? 'email' then public.catalog_txt(p, 'email') else t.email end,
      links = case when p ? 'links' then v_norm else t.links end
    where t.id = v_id;
  end if;

  perform public.catalog_save_translations('team_member', v_id, p -> 'translations', v_create);
  select t.is_published into v_pub from public.team_members t where t.id = v_id;
  return jsonb_build_object('id', v_id, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_team_member(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_team_member(jsonb) to service_role;

-- The three home journeys: existing rows only (C-15: no create, no delete in v1). The structured prices come from the
-- route, which parses them from the English price_label; they are set only when their keys are present.
create or replace function public.ops_save_journey_tier(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_pub boolean;
begin
  if p is null or jsonb_typeof(p) <> 'object' or v_id is null then
    perform public.catalog_invalid('id');
  end if;
  if p ? 'media_id' then
    perform public.catalog_need_media((p ->> 'media_id')::uuid, 'media_id');
  end if;
  perform 1 from public.journey_tiers j where j.id = v_id for update;
  if not found then
    perform public.catalog_fail('not_found');
  end if;
  update public.journey_tiers j set
    is_featured = case when p ? 'is_featured' then (p ->> 'is_featured')::boolean else j.is_featured end,
    media_id = case when p ? 'media_id' then (p ->> 'media_id')::uuid else j.media_id end,
    price_from_amount = case when p ? 'price_from_amount' then (p ->> 'price_from_amount')::numeric else j.price_from_amount end,
    price_from_currency = case when p ? 'price_from_currency' then public.catalog_txt(p, 'price_from_currency') else j.price_from_currency end,
    est_low = case when p ? 'est_low' then (p ->> 'est_low')::numeric else j.est_low end,
    est_high = case when p ? 'est_high' then (p ->> 'est_high')::numeric else j.est_high end,
    est_open_ended = case when p ? 'est_open_ended' then (p ->> 'est_open_ended')::boolean else j.est_open_ended end
  where j.id = v_id;
  perform public.catalog_save_translations('journey_tier', v_id, p -> 'translations', false);
  select j.is_published into v_pub from public.journey_tiers j where j.id = v_id;
  return jsonb_build_object('id', v_id, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_journey_tier(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_journey_tier(jsonb) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Delete, reorder, publish
-- ------------------------------------------------------------------------------------------------------------

-- A published row is never deleted (unpublish first); a foreign key in use refuses with 23503 (the route says in_use).
-- The three home journeys cannot be deleted in v1 (C-15).
create or replace function public.ops_delete(p_entity text, p_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  m record;
  v_found boolean;
  v_pub boolean;
begin
  select * into m from public.catalog_entity_meta(p_entity);
  if not found or p_entity = 'journey_tier' then
    perform public.catalog_invalid('entity');
  end if;
  execute format('select exists (select 1 from public.%I where id = $1)', m.base_tbl) into v_found using p_id;
  if not v_found then
    perform public.catalog_fail('not_found');
  end if;
  execute format('select is_published from public.%I where id = $1', m.base_tbl) into v_pub using p_id;
  if v_pub then
    perform public.catalog_fail('published');
  end if;
  execute format('delete from public.%I where id = $1', m.base_tbl) using p_id;
  return jsonb_build_object('id', p_id);
end;
$$;

revoke execute on function public.ops_delete(text, uuid) from public, anon, authenticated;
grant execute on function public.ops_delete(text, uuid) to service_role;

-- position = 1, 2, 3, ... in the order of p_ids. affects_site: any of them is published.
create or replace function public.ops_reorder(p_entity text, p_ids uuid[])
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  m record;
  v_live boolean;
begin
  select * into m from public.catalog_entity_meta(p_entity);
  if not found then
    perform public.catalog_invalid('entity');
  end if;
  execute format(
    'with o as (select u.id, u.ord from unnest($1) with ordinality as u(id, ord)) '
    || 'update public.%I t set position = o.ord from o where t.id = o.id', m.base_tbl)
    using p_ids;
  execute format('select coalesce(bool_or(is_published), false) from public.%I where id = any ($1)', m.base_tbl) into v_live using p_ids;
  return jsonb_build_object('affects_site', v_live);
end;
$$;

revoke execute on function public.ops_reorder(text, uuid[]) from public, anon, authenticated;
grant execute on function public.ops_reorder(text, uuid[]) to service_role;

-- Contract 5.9. A refusal does not raise: it returns {ok: false, code, missing, warnings, is_published}.
-- Publish needs: every text field filled in English filled in Arabic and Spanish too (arrays of the same length, no
-- empty item), the per-entity required fields, a published destination for a stay. Unpublish is always allowed,
-- except a destination that still has published stays. The caller (03.2-05) requests the site rebuild.
create or replace function public.ops_publish(p_entity text, p_id uuid, p_published boolean)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  m record;
  v_found boolean;
  v_is_pub boolean;
  v_missing jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_en jsonb;
  v_rec jsonb;
  v_loc text;
  v_code text;
  v_parent boolean := false;
begin
  select * into m from public.catalog_entity_meta(p_entity);
  if not found then
    perform public.catalog_invalid('entity');
  end if;
  execute format('select exists (select 1 from public.%I where id = $1)', m.base_tbl) into v_found using p_id;
  if not v_found then
    perform public.catalog_fail('not_found');
  end if;
  execute format('select is_published from public.%I where id = $1 for update', m.base_tbl) into v_is_pub using p_id;

  if not p_published then
    if p_entity = 'destination' and exists (select 1 from public.stays s where s.destination_id = p_id and s.is_published) then
      return jsonb_build_object('ok', false, 'code', 'has_published_stays', 'missing', '[]'::jsonb, 'warnings', '[]'::jsonb, 'is_published', v_is_pub);
    end if;
    execute format('update public.%I set is_published = false where id = $1', m.base_tbl) using p_id;
    return jsonb_build_object('ok', true, 'is_published', false, 'missing', '[]'::jsonb, 'warnings', '[]'::jsonb);
  end if;

  v_en := public.catalog_tr_json(p_entity, p_id, 'en');
  foreach v_loc in array array['en', 'ar', 'es'] loop
    v_rec := public.catalog_tr_json(p_entity, p_id, v_loc);
    v_missing := v_missing || public.catalog_gaps(v_en, v_rec, v_loc, m.req);
  end loop;

  if p_entity = 'destination' then
    if (select d.hero_media_id from public.destinations d where d.id = p_id) is null then
      v_missing := v_missing || jsonb_build_array(jsonb_build_object('locale', null, 'field', 'hero_media_id'));
    end if;
  elsif p_entity = 'stay' then
    if (select s.hero_media_id from public.stays s where s.id = p_id) is null then
      v_missing := v_missing || jsonb_build_array(jsonb_build_object('locale', null, 'field', 'hero_media_id'));
    end if;
    v_parent := not exists (
      select 1 from public.stays s join public.destinations d on d.id = s.destination_id
      where s.id = p_id and d.is_published
    );
    if (select s.base_nightly_rate_aed from public.stays s where s.id = p_id) is null then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code', 'no_base_rate'));
    end if;
  elsif p_entity = 'catalog_item' then
    if (select c.media_id from public.catalog_items c where c.id = p_id) is null then
      v_missing := v_missing || jsonb_build_array(jsonb_build_object('locale', null, 'field', 'media_id'));
    end if;
    if not exists (select 1 from public.catalog_item_destinations cd where cd.item_id = p_id) then
      v_missing := v_missing || jsonb_build_array(jsonb_build_object('locale', null, 'field', 'destination_ids'));
    end if;
    if (select c.price_aed from public.catalog_items c where c.id = p_id) is null then
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object('code', 'no_price'));
    end if;
  elsif p_entity = 'journey_tier' then
    if (select j.media_id from public.journey_tiers j where j.id = p_id) is null then
      v_missing := v_missing || jsonb_build_array(jsonb_build_object('locale', null, 'field', 'media_id'));
    end if;
  end if;

  -- The code: parent first; any gap but amenities is publish_incomplete; amenities alone is amenities_mismatch.
  if v_parent then
    v_code := 'parent_unpublished';
  elsif exists (select 1 from jsonb_array_elements(v_missing) as e where e.value ->> 'field' is distinct from 'amenities') then
    v_code := 'publish_incomplete';
  elsif jsonb_array_length(v_missing) > 0 then
    v_code := 'amenities_mismatch';
  end if;
  if v_code is not null then
    return jsonb_build_object('ok', false, 'code', v_code, 'missing', v_missing, 'warnings', v_warnings, 'is_published', v_is_pub);
  end if;

  execute format('update public.%I set is_published = true where id = $1', m.base_tbl) using p_id;
  return jsonb_build_object('ok', true, 'is_published', true, 'missing', '[]'::jsonb, 'warnings', v_warnings);
end;
$$;

revoke execute on function public.ops_publish(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.ops_publish(text, uuid, boolean) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Lists and details for the screens (contract 5). Money is a decimal string ("1250.00"). MediaRef carries the key:
-- the route adds `url` with mediaUrl().
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.ops_list(p_entity text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if p_entity = 'destination' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'slug', d.slug,
      'name_en', (select t.name from public.destination_translations t where t.destination_id = d.id and t.locale = 'en'),
      'is_published', d.is_published, 'position', d.position,
      'stay_count', (select count(*) from public.stays s where s.destination_id = d.id),
      'published_stay_count', (select count(*) from public.stays s where s.destination_id = d.id and s.is_published),
      'hero', public.catalog_media_ref(d.hero_media_id),
      'translation_state', public.catalog_tr_state('destination', d.id),
      'updated_at', d.updated_at
    ) order by d.position, d.slug), '[]'::jsonb)
    into v_out from public.destinations d;
  elsif p_entity = 'stay' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'slug', s.slug,
      'title_en', (select t.title from public.stay_translations t where t.stay_id = s.id and t.locale = 'en'),
      'destination_id', s.destination_id,
      'destination_name_en', (select t.name from public.destination_translations t where t.destination_id = s.destination_id and t.locale = 'en'),
      'is_published', s.is_published, 'position', s.position,
      'base_nightly_rate_aed', s.base_nightly_rate_aed::text,
      'bookable', s.is_published and s.base_nightly_rate_aed is not null,
      'hero', public.catalog_media_ref(s.hero_media_id),
      'translation_state', public.catalog_tr_state('stay', s.id),
      'updated_at', s.updated_at
    ) order by s.position, s.slug), '[]'::jsonb)
    into v_out from public.stays s;
  elsif p_entity = 'catalog_item' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'kind', c.kind, 'unit', c.unit,
      'price_aed', c.price_aed::text, 'is_uae', c.is_uae, 'is_home_pickup', c.is_home_pickup,
      'name_en', (select t.name from public.catalog_translations t where t.item_id = c.id and t.locale = 'en'),
      'is_published', c.is_published, 'position', c.position,
      'image', public.catalog_media_ref(c.media_id),
      'destination_ids', coalesce((select jsonb_agg(cd.destination_id order by d.position, d.slug)
        from public.catalog_item_destinations cd join public.destinations d on d.id = cd.destination_id where cd.item_id = c.id), '[]'::jsonb),
      'stay_count', (select count(*) from public.catalog_item_stays cs where cs.item_id = c.id),
      'translation_state', public.catalog_tr_state('catalog_item', c.id),
      'updated_at', c.updated_at
    ) order by c.position, c.slug), '[]'::jsonb)
    into v_out from public.catalog_items c;
  elsif p_entity = 'team_member' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'slug', t.slug,
      'name_en', (select x.name from public.team_member_translations x where x.member_id = t.id and x.locale = 'en'),
      'role_en', (select x.role from public.team_member_translations x where x.member_id = t.id and x.locale = 'en'),
      'is_published', t.is_published, 'position', t.position,
      'photo', public.catalog_media_ref(t.photo_media_id),
      'translation_state', public.catalog_tr_state('team_member', t.id),
      'updated_at', t.updated_at
    ) order by t.position, t.slug), '[]'::jsonb)
    into v_out from public.team_members t;
  elsif p_entity = 'journey_tier' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', j.id, 'slug', j.slug,
      'name_en', (select x.name from public.journey_tier_translations x where x.tier_id = j.id and x.locale = 'en'),
      'price_label_en', (select x.price_label from public.journey_tier_translations x where x.tier_id = j.id and x.locale = 'en'),
      'is_featured', j.is_featured, 'is_published', j.is_published, 'position', j.position,
      'image', public.catalog_media_ref(j.media_id),
      'translation_state', public.catalog_tr_state('journey_tier', j.id),
      'updated_at', j.updated_at
    ) order by j.position, j.slug), '[]'::jsonb)
    into v_out from public.journey_tiers j;
  elsif p_entity = 'media' then
    -- used_by counts rows of the database only; a photo kept by a page block that stays in the fixtures shows 0.
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'key', m.key, 'width', m.width, 'height', m.height, 'content_type', m.content_type, 'source', m.source,
      'alt', jsonb_build_object(
        'en', (select it.alt from public.image_translations it where it.image_id = m.id and it.locale = 'en'),
        'ar', (select it.alt from public.image_translations it where it.image_id = m.id and it.locale = 'ar'),
        'es', (select it.alt from public.image_translations it where it.image_id = m.id and it.locale = 'es')),
      'alt_status', jsonb_build_object(
        'en', coalesce((select it.status from public.image_translations it where it.image_id = m.id and it.locale = 'en'), 'missing'),
        'ar', coalesce((select it.status from public.image_translations it where it.image_id = m.id and it.locale = 'ar'), 'missing'),
        'es', coalesce((select it.status from public.image_translations it where it.image_id = m.id and it.locale = 'es'), 'missing')),
      'used_by', public.catalog_media_uses(m.id)
    ) order by m.key, m.id), '[]'::jsonb)
    into v_out from public.media m;
  else
    perform public.catalog_invalid('entity');
  end if;
  return v_out;
end;
$$;

revoke execute on function public.ops_list(text) from public, anon, authenticated;
grant execute on function public.ops_list(text) to service_role;

create or replace function public.ops_get(p_entity text, p_id uuid)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if p_entity = 'destination' then
    select to_jsonb(d) - 'is_sample' - 'sample_fields' - 'created_at'
      || jsonb_build_object(
        'hero', public.catalog_media_ref(d.hero_media_id),
        'inset', public.catalog_media_ref(d.inset_media_id),
        'translations', public.catalog_tr_all('destination', d.id),
        'translation_state', public.catalog_tr_state('destination', d.id))
    into v_out from public.destinations d where d.id = p_id;
  elsif p_entity = 'stay' then
    select to_jsonb(s) - 'is_sample' - 'sample_fields' - 'created_at'
      || jsonb_build_object(
        'base_nightly_rate_aed', s.base_nightly_rate_aed::text,
        'pets_fee_aed', s.pets_fee_aed::text,
        'hero', public.catalog_media_ref(s.hero_media_id),
        'gallery', coalesce((select jsonb_agg(public.catalog_media_ref(g.media_id) order by g.position)
          from public.stay_gallery g where g.stay_id = s.id), '[]'::jsonb),
        'experience_ids', coalesce((select jsonb_agg(l.item_id order by l.position)
          from public.catalog_item_stays l join public.catalog_items c on c.id = l.item_id
          where l.stay_id = s.id and c.kind = 'experience'), '[]'::jsonb),
        'service_ids', coalesce((select jsonb_agg(l.item_id order by l.position)
          from public.catalog_item_stays l join public.catalog_items c on c.id = l.item_id
          where l.stay_id = s.id and c.kind = 'service'), '[]'::jsonb),
        'has_access', exists (select 1 from public.stay_access a where a.stay_id = s.id),
        'translations', public.catalog_tr_all('stay', s.id),
        'translation_state', public.catalog_tr_state('stay', s.id))
    into v_out from public.stays s where s.id = p_id;
  elsif p_entity = 'catalog_item' then
    select to_jsonb(c) - 'is_sample' - 'sample_fields' - 'created_at'
      || jsonb_build_object(
        'price_aed', c.price_aed::text,
        'image', public.catalog_media_ref(c.media_id),
        'destination_ids', coalesce((select jsonb_agg(cd.destination_id order by d.position, d.slug)
          from public.catalog_item_destinations cd join public.destinations d on d.id = cd.destination_id
          where cd.item_id = c.id), '[]'::jsonb),
        'stay_ids', coalesce((select jsonb_agg(cs.stay_id order by s.position, s.slug)
          from public.catalog_item_stays cs join public.stays s on s.id = cs.stay_id
          where cs.item_id = c.id), '[]'::jsonb),
        'translations', public.catalog_tr_all('catalog_item', c.id),
        'translation_state', public.catalog_tr_state('catalog_item', c.id))
    into v_out from public.catalog_items c where c.id = p_id;
  elsif p_entity = 'team_member' then
    select to_jsonb(t) - 'is_sample' - 'sample_fields' - 'created_at'
      || jsonb_build_object(
        'photo', public.catalog_media_ref(t.photo_media_id),
        'translations', public.catalog_tr_all('team_member', t.id),
        'translation_state', public.catalog_tr_state('team_member', t.id))
    into v_out from public.team_members t where t.id = p_id;
  elsif p_entity = 'journey_tier' then
    select to_jsonb(j) - 'is_sample' - 'sample_fields' - 'created_at'
        - 'price_from_amount' - 'price_from_currency' - 'est_low' - 'est_high' - 'est_open_ended'
      || jsonb_build_object(
        'image', public.catalog_media_ref(j.media_id),
        'price_from', case when j.price_from_amount is null or j.price_from_currency is null then null
          else jsonb_build_object('amount', trim_scale(j.price_from_amount), 'currency', j.price_from_currency) end,
        'price_estimate', case when j.est_low is null then null
          else jsonb_build_object('low', trim_scale(j.est_low), 'high', trim_scale(j.est_high), 'currency', 'AED',
            'open_ended', coalesce(j.est_open_ended, false)) end,
        'translations', public.catalog_tr_all('journey_tier', j.id),
        'translation_state', public.catalog_tr_state('journey_tier', j.id))
    into v_out from public.journey_tiers j where j.id = p_id;
  else
    perform public.catalog_invalid('entity');
  end if;
  return v_out;
end;
$$;

revoke execute on function public.ops_get(text, uuid) from public, anon, authenticated;
grant execute on function public.ops_get(text, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Rates (C-11), blocks (C-13), private access (C-14). None of these reaches the public build except blocks.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.ops_set_base_rate(p_stay uuid, p_rate numeric)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_rate numeric;
begin
  update public.stays s set base_nightly_rate_aed = p_rate where s.id = p_stay returning s.base_nightly_rate_aed into v_rate;
  if not found then
    perform public.catalog_fail('not_found');
  end if;
  return jsonb_build_object('stay_id', p_stay, 'base_nightly_rate_aed', v_rate::text);
end;
$$;

revoke execute on function public.ops_set_base_rate(uuid, numeric) from public, anon, authenticated;
grant execute on function public.ops_set_base_rate(uuid, numeric) to service_role;

-- p = {id?, stay_id, first_night, last_night, nightly_rate_aed}; last_night is inclusive (stored daterange(first, last + 1)).
-- Two ranges of the same length that share a night raise 23P01 'almar:rate_overlap' with detail {conflict_id}.
create or replace function public.ops_save_stay_rate(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_stay uuid := nullif(p ->> 'stay_id', '')::uuid;
  v_first date := (p ->> 'first_night')::date;
  v_last date := (p ->> 'last_night')::date;
  v_rate numeric := (p ->> 'nightly_rate_aed')::numeric;
  v_range daterange;
  v_conflict uuid;
begin
  if v_stay is null or not exists (select 1 from public.stays s where s.id = v_stay) then
    perform public.catalog_fail('not_found');
  end if;
  if v_first is null then
    perform public.catalog_invalid('range.first_night');
  end if;
  if v_last is null or v_last < v_first or v_last - v_first >= 730 then
    perform public.catalog_invalid('range.last_night');
  end if;
  if v_rate is null or v_rate <= 0 then
    perform public.catalog_invalid('range.nightly_rate_aed');
  end if;
  v_range := daterange(v_first, v_last + 1, '[)');
  begin
    if v_id is null then
      insert into public.stay_rates (stay_id, nights, nightly_rate_aed) values (v_stay, v_range, v_rate) returning id into v_id;
    else
      update public.stay_rates r set nights = v_range, nightly_rate_aed = v_rate where r.id = v_id and r.stay_id = v_stay;
      if not found then
        perform public.catalog_fail('not_found');
      end if;
    end if;
  exception when exclusion_violation then
    select r.id into v_conflict from public.stay_rates r
    where r.stay_id = v_stay and r.span_days = (v_last + 1 - v_first) and r.nights && v_range and r.id is distinct from v_id
    limit 1;
    raise exception using errcode = '23P01', message = 'almar:rate_overlap',
      detail = jsonb_build_object('conflict_id', v_conflict)::text;
  end;
  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function public.ops_save_stay_rate(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_stay_rate(jsonb) to service_role;

create or replace function public.ops_delete_stay_rate(p_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  delete from public.stay_rates r where r.id = p_id;
  if not found then
    perform public.catalog_fail('not_found');
  end if;
  return jsonb_build_object('id', p_id);
end;
$$;

revoke execute on function public.ops_delete_stay_rate(uuid) from public, anon, authenticated;
grant execute on function public.ops_delete_stay_rate(uuid) to service_role;

-- p = {scope, destination_id?, stay_id?, starts_on, ends_on (inclusive), reason?, created_by?}.
-- overlapping_bookings is 0 until Phase 4: its migration replaces this function (same signature and result) with the
-- per-stay advisory lock and the real count.
create or replace function public.ops_add_block(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_scope text := public.catalog_txt(p, 'scope');
  v_dest uuid := nullif(p ->> 'destination_id', '')::uuid;
  v_stay uuid := nullif(p ->> 'stay_id', '')::uuid;
  v_from date := (p ->> 'starts_on')::date;
  v_to date := (p ->> 'ends_on')::date;
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
  insert into public.availability_blocks (scope, destination_id, stay_id, starts_on, ends_on, reason, created_by)
  values (
    v_scope,
    case when v_scope = 'destination' then v_dest end,
    case when v_scope = 'stay' then v_stay end,
    v_from, v_to, public.catalog_txt(p, 'reason'), nullif(p ->> 'created_by', '')::uuid
  )
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'overlapping_bookings', 0);
end;
$$;

revoke execute on function public.ops_add_block(jsonb) from public, anon, authenticated;
grant execute on function public.ops_add_block(jsonb) to service_role;

create or replace function public.ops_delete_block(p_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  delete from public.availability_blocks b where b.id = p_id;
  if not found then
    perform public.catalog_fail('not_found');
  end if;
  return jsonb_build_object('id', p_id);
end;
$$;

revoke execute on function public.ops_delete_block(uuid) from public, anon, authenticated;
grant execute on function public.ops_delete_block(uuid) to service_role;

-- p = {stay_id, access: {address, wifi_name, wifi_password, door_code, notes}} (the fields may also sit at the top
-- level). A field absent is left alone; present, it is set (empty becomes null). Never logged, never in a view.
create or replace function public.ops_save_stay_access(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_stay uuid := nullif(p ->> 'stay_id', '')::uuid;
  a jsonb := case when jsonb_typeof(p -> 'access') = 'object' then p -> 'access' else p end;
begin
  if v_stay is null or not exists (select 1 from public.stays s where s.id = v_stay) then
    perform public.catalog_fail('not_found');
  end if;
  insert into public.stay_access as t (stay_id, address, wifi_name, wifi_password, door_code, notes)
  values (
    v_stay, public.catalog_txt(a, 'address'), public.catalog_txt(a, 'wifi_name'), public.catalog_raw(a, 'wifi_password'),
    public.catalog_raw(a, 'door_code'), public.catalog_txt(a, 'notes')
  )
  on conflict (stay_id) do update set
    address = case when a ? 'address' then excluded.address else t.address end,
    wifi_name = case when a ? 'wifi_name' then excluded.wifi_name else t.wifi_name end,
    wifi_password = case when a ? 'wifi_password' then excluded.wifi_password else t.wifi_password end,
    door_code = case when a ? 'door_code' then excluded.door_code else t.door_code end,
    notes = case when a ? 'notes' then excluded.notes else t.notes end;
  return jsonb_build_object('stay_id', v_stay);
end;
$$;

revoke execute on function public.ops_save_stay_access(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_stay_access(jsonb) to service_role;

-- The rate of each night in [p_from, p_to): the shortest range covering it, else the base rate, else null.
create or replace function public.stay_night_rates(p_stay uuid, p_from date, p_to date)
returns table (night date, nightly_rate_aed numeric, source text, rate_id uuid)
language sql
stable
set search_path = ''
as $$
  select g.d::date,
    coalesce(r.rate, s.base_nightly_rate_aed),
    case when r.id is not null then 'range' when s.base_nightly_rate_aed is not null then 'base' end,
    r.id
  from public.stays s
  cross join lateral generate_series(p_from::timestamp, (p_to - 1)::timestamp, interval '1 day') as g(d)
  left join lateral (
    select x.id, x.nightly_rate_aed as rate
    from public.stay_rates x
    where x.stay_id = s.id and x.nights @> g.d::date
    order by x.span_days, x.id
    limit 1
  ) r on true
  where s.id = p_stay
  order by 1
$$;

revoke execute on function public.stay_night_rates(uuid, date, date) from public, anon, authenticated;
grant execute on function public.stay_night_rates(uuid, date, date) to service_role;

-- The ops-blocked days of one stay in [p_from, p_to), all three scopes (for Phase 4's hold and quote).
create or replace function public.stay_ops_blocked_days(p_stay uuid, p_from date, p_to date)
returns setof date
language sql
stable
set search_path = ''
as $$
  select distinct g.d::date
  from public.stays s
  join public.availability_blocks b
    on b.scope = 'all'
    or (b.scope = 'destination' and b.destination_id = s.destination_id)
    or (b.scope = 'stay' and b.stay_id = s.id)
  cross join lateral generate_series(greatest(b.starts_on, p_from)::timestamp, least(b.ends_on, p_to - 1)::timestamp, interval '1 day') as g(d)
  where s.id = p_stay
  order by 1
$$;

revoke execute on function public.stay_ops_blocked_days(uuid, date, date) from public, anon, authenticated;
grant execute on function public.stay_ops_blocked_days(uuid, date, date) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Photos (C-10): the library, upload records and alt texts
-- ------------------------------------------------------------------------------------------------------------

-- p = {key, width, height, bytes, content_type, sha256, alt_en}. An upload whose key exists returns that row.
create or replace function public.ops_save_media(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_alt text;
begin
  if public.catalog_txt(p, 'key') is null then
    perform public.catalog_invalid('key');
  end if;
  select m.id into v_id from public.media m where m.key = (p ->> 'key') and m.source = 'upload';
  if found then
    return jsonb_build_object('id', v_id, 'created', false);
  end if;
  v_alt := public.catalog_txt(p, 'alt_en');
  if v_alt is null then
    perform public.catalog_invalid('alt_en');
  end if;
  insert into public.media (key, width, height, bytes, content_type, sha256, source)
  values (
    p ->> 'key', (p ->> 'width')::int, (p ->> 'height')::int, (p ->> 'bytes')::int,
    public.catalog_txt(p, 'content_type'), public.catalog_txt(p, 'sha256'), 'upload'
  )
  returning id into v_id;
  insert into public.image_translations (image_id, locale, alt, status) values (v_id, 'en', v_alt, 'published');
  return jsonb_build_object('id', v_id, 'created', true);
end;
$$;

revoke execute on function public.ops_save_media(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_media(jsonb) to service_role;

-- p = {id, alt: {en?, ar?, es?}, status: {ar?, es?}}. A language in alt is set (null deletes it, never en); a
-- language only in status changes that record's status. Typed English is published, Arabic and Spanish default draft.
-- affects_site: a published row references the photo.
create or replace function public.ops_save_image_alts(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_loc text;
  v_alt jsonb;
  v_status text;
begin
  if v_id is null or not exists (select 1 from public.media m where m.id = v_id) then
    perform public.catalog_fail('not_found');
  end if;
  foreach v_loc in array array['en', 'ar', 'es'] loop
    v_status := nullif(p -> 'status' ->> v_loc, '');
    if jsonb_typeof(p -> 'alt') = 'object' and (p -> 'alt') ? v_loc then
      v_alt := p -> 'alt' -> v_loc;
      if jsonb_typeof(v_alt) = 'null' then
        if v_loc = 'en' then
          perform public.catalog_invalid('alt.en', 'en');
        end if;
        delete from public.image_translations it where it.image_id = v_id and it.locale = v_loc;
      elsif jsonb_typeof(v_alt) = 'string' then
        insert into public.image_translations as t (image_id, locale, alt, status)
        values (v_id, v_loc, btrim(v_alt #>> '{}', E' \t\r\n'), coalesce(v_status, case when v_loc = 'en' then 'published' else 'draft' end))
        on conflict (image_id, locale) do update set alt = excluded.alt, status = excluded.status;
      else
        perform public.catalog_invalid('alt.' || v_loc, v_loc);
      end if;
    elsif v_status is not null then
      update public.image_translations it set status = v_status where it.image_id = v_id and it.locale = v_loc;
    end if;
  end loop;
  return jsonb_build_object('id', v_id, 'affects_site', public.catalog_media_live(v_id));
end;
$$;

revoke execute on function public.ops_save_image_alts(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_image_alts(jsonb) to service_role;

-- A photo still used refuses with 23503 (the route says in_use). So does an imported photo: pages the dashboard does
-- not edit (home, about, contact, blog) keep their images by key and their alt text by image id, and the database
-- cannot see those references.
create or replace function public.ops_delete_media(p_id uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_source text;
begin
  select m.source into v_source from public.media m where m.id = p_id;
  if not found then
    perform public.catalog_fail('not_found');
  end if;
  if v_source = 'import' then
    raise exception using errcode = '23503', message = 'almar:in_use', detail = jsonb_build_object('reason', 'imported')::text;
  end if;
  delete from public.media m where m.id = p_id;
  return jsonb_build_object('id', p_id);
end;
$$;

revoke execute on function public.ops_delete_media(uuid) from public, anon, authenticated;
grant execute on function public.ops_delete_media(uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Import of today's published content (C-16), service role only, called once by scripts/import-catalog.mjs --apply.
-- p holds one array per table; every row is inserted in foreign-key order with `on conflict do nothing`, so a second
-- call writes nothing new. Money is never imported: base_nightly_rate_aed, pets_*, price_aed are left null whatever
-- the payload says (C-12: the owner types real rates). Returns the rows actually inserted per table.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.import_catalog(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n bigint;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('payload');
  end if;

  insert into public.media (id, key, width, height, bytes, content_type, sha256, source, created_at)
  select coalesce(r.id, gen_random_uuid()), r.key, r.width, r.height, r.bytes, r.content_type, r.sha256,
    coalesce(r.source, 'import'), coalesce(r.created_at, now())
  from jsonb_populate_recordset(null::public.media, coalesce(p -> 'media', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('media', v_n);

  insert into public.image_translations (image_id, locale, alt, status, updated_at)
  select r.image_id, r.locale, r.alt, coalesce(r.status, 'draft'), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.image_translations, coalesce(p -> 'image_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('image_translations', v_n);

  insert into public.destinations (id, slug, hero_media_id, inset_media_id, is_published, position, is_sample, sample_fields, created_at, updated_at)
  select coalesce(r.id, gen_random_uuid()), r.slug, r.hero_media_id, r.inset_media_id, coalesce(r.is_published, false), coalesce(r.position, 0),
    coalesce(r.is_sample, false), coalesce(r.sample_fields, '{}'::text[]), coalesce(r.created_at, now()), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.destinations, coalesce(p -> 'destinations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('destinations', v_n);

  insert into public.destination_translations (destination_id, locale, status, name, short_line, region, summary, nights_label, updated_at)
  select r.destination_id, r.locale, coalesce(r.status, 'draft'), r.name, r.short_line, r.region, r.summary, r.nights_label, coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.destination_translations, coalesce(p -> 'destination_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('destination_translations', v_n);

  insert into public.stays (id, slug, destination_id, max_guests, min_guests, bedrooms, bathrooms, min_nights, infants_count,
    hero_media_id, is_published, position, is_sample, sample_fields, created_at, updated_at)
  select coalesce(r.id, gen_random_uuid()), r.slug, r.destination_id, r.max_guests, r.min_guests, r.bedrooms, r.bathrooms,
    coalesce(r.min_nights, 1), r.infants_count, r.hero_media_id, coalesce(r.is_published, false), coalesce(r.position, 0),
    coalesce(r.is_sample, false), coalesce(r.sample_fields, '{}'::text[]), coalesce(r.created_at, now()), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.stays, coalesce(p -> 'stays', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('stays', v_n);

  insert into public.stay_gallery (stay_id, media_id, position)
  select r.stay_id, r.media_id, r.position
  from jsonb_populate_recordset(null::public.stay_gallery, coalesce(p -> 'stay_gallery', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('stay_gallery', v_n);

  insert into public.stay_translations (stay_id, locale, status, title, tagline, neighborhood, guests_label, bathrooms_label, beds_label,
    price_label, price_note, description, amenities, inclusions, policy_headings, updated_at)
  select r.stay_id, r.locale, coalesce(r.status, 'draft'), r.title, r.tagline, r.neighborhood, r.guests_label, r.bathrooms_label, r.beds_label,
    r.price_label, r.price_note, coalesce(r.description, '{}'::text[]), coalesce(r.amenities, '{}'::text[]),
    coalesce(r.inclusions, '{}'::text[]), coalesce(r.policy_headings, '{}'::text[]), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.stay_translations, coalesce(p -> 'stay_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('stay_translations', v_n);

  insert into public.catalog_items (id, slug, kind, unit, is_uae, is_home_pickup, media_id, is_published, position, is_sample, sample_fields, created_at, updated_at)
  select coalesce(r.id, gen_random_uuid()), r.slug, r.kind, r.unit, coalesce(r.is_uae, false), coalesce(r.is_home_pickup, false), r.media_id,
    coalesce(r.is_published, false), coalesce(r.position, 0), coalesce(r.is_sample, false), coalesce(r.sample_fields, '{}'::text[]),
    coalesce(r.created_at, now()), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.catalog_items, coalesce(p -> 'catalog_items', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('catalog_items', v_n);

  insert into public.catalog_translations (item_id, locale, status, name, summary, duration_label, updated_at)
  select r.item_id, r.locale, coalesce(r.status, 'draft'), r.name, r.summary, r.duration_label, coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.catalog_translations, coalesce(p -> 'catalog_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('catalog_translations', v_n);

  insert into public.catalog_item_destinations (item_id, destination_id)
  select r.item_id, r.destination_id
  from jsonb_populate_recordset(null::public.catalog_item_destinations, coalesce(p -> 'catalog_item_destinations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('catalog_item_destinations', v_n);

  insert into public.catalog_item_stays (item_id, stay_id, position)
  select r.item_id, r.stay_id, r.position
  from jsonb_populate_recordset(null::public.catalog_item_stays, coalesce(p -> 'catalog_item_stays', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('catalog_item_stays', v_n);

  insert into public.journey_tiers (id, slug, is_featured, media_id, price_from_amount, price_from_currency, est_low, est_high, est_open_ended,
    is_published, position, is_sample, sample_fields, created_at, updated_at)
  select coalesce(r.id, gen_random_uuid()), r.slug, coalesce(r.is_featured, false), r.media_id, r.price_from_amount, r.price_from_currency,
    r.est_low, r.est_high, r.est_open_ended, coalesce(r.is_published, false), coalesce(r.position, 0), coalesce(r.is_sample, false),
    coalesce(r.sample_fields, '{}'::text[]), coalesce(r.created_at, now()), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.journey_tiers, coalesce(p -> 'journey_tiers', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('journey_tiers', v_n);

  insert into public.journey_tier_translations (tier_id, locale, status, name, price_label, tagline, duration_label, ideal_for_label, ideal_for, body, updated_at)
  select r.tier_id, r.locale, coalesce(r.status, 'draft'), r.name, r.price_label, r.tagline, r.duration_label, r.ideal_for_label, r.ideal_for, r.body,
    coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.journey_tier_translations, coalesce(p -> 'journey_tier_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('journey_tier_translations', v_n);

  insert into public.team_members (id, slug, photo_media_id, email, links, is_published, position, is_sample, sample_fields, created_at, updated_at)
  select coalesce(r.id, gen_random_uuid()), r.slug, r.photo_media_id, r.email, coalesce(r.links, '[]'::jsonb), coalesce(r.is_published, false),
    coalesce(r.position, 0), coalesce(r.is_sample, false), coalesce(r.sample_fields, '{}'::text[]), coalesce(r.created_at, now()), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.team_members, coalesce(p -> 'team_members', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('team_members', v_n);

  insert into public.team_member_translations (member_id, locale, status, name, role, bio, updated_at)
  select r.member_id, r.locale, coalesce(r.status, 'draft'), r.name, r.role, r.bio, coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.team_member_translations, coalesce(p -> 'team_member_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('team_member_translations', v_n);

  return v_counts;
end;
$$;

revoke execute on function public.import_catalog(jsonb) from public, anon, authenticated;
grant execute on function public.import_catalog(jsonb) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Site publish helpers for plan 03.2-05 (the rebuild after Publish)
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.site_request_update()
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_seq bigint;
  v_at timestamptz;
begin
  update public.site_publish s set requested_seq = s.requested_seq + 1, requested_at = now()
  where s.id = 1
  returning s.requested_seq, s.requested_at into v_seq, v_at;
  return jsonb_build_object('requested_seq', v_seq, 'requested_at', v_at);
end;
$$;

revoke execute on function public.site_request_update() from public, anon, authenticated;
grant execute on function public.site_request_update() to service_role;

create or replace function public.site_record_hook(p_result text, p_build_uuid text)
returns void
language sql
set search_path = ''
as $$
  update public.site_publish set last_hook_at = now(), last_hook_result = p_result, last_build_uuid = p_build_uuid where id = 1
$$;

revoke execute on function public.site_record_hook(text, text) from public, anon, authenticated;
grant execute on function public.site_record_hook(text, text) to service_role;

create or replace function public.site_publish_state()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select to_jsonb(s) from public.site_publish s where s.id = 1
$$;

revoke execute on function public.site_publish_state() from public, anon, authenticated;
grant execute on function public.site_publish_state() to service_role;
