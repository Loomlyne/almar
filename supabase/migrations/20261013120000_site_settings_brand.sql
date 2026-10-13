-- Plan 02-06: Settings on the ops host. Brand, maintenance and the logo reach the public site at the next publish
-- rebuild (owner, 2026-10-13); the build reads them through api_site_settings with the anon key.
--
-- Safe on live data: it adds one nullable column, adds checks that the live row already meets (every brand column is
-- null on live, VAT 5.00 and deposit 30.00, faces Questa and Lato), drops two columns nothing ever wrote (logo_bytes,
-- logo_type: the logo is an R2 media row, owner 2026-10-13) and drops job 02's site_settings_public view, which nothing
-- reads and which showed VAT and deposit to anon through a security-definer view (the lint 20261005100000 noted).
-- The singleton row exists (20261005110000 inserts it); this file inserts it again with `on conflict do nothing`.

alter table public.site_settings
  drop column if exists logo_bytes,
  drop column if exists logo_type,
  add column if not exists logo_media_id uuid references public.media (id) on delete restrict;

-- A colour is null (the design system's token) or #rrggbb in lower case, as the save route writes it.
alter table public.site_settings
  add constraint site_settings_teal_hex check (teal ~ '^#[0-9a-f]{6}$'),
  add constraint site_settings_charcoal_hex check (charcoal ~ '^#[0-9a-f]{6}$'),
  add constraint site_settings_gold_hex check (gold ~ '^#[0-9a-f]{6}$'),
  add constraint site_settings_ivory_hex check (ivory ~ '^#[0-9a-f]{6}$'),
  add constraint site_settings_white_hex check (white ~ '^#[0-9a-f]{6}$'),
  -- The faces are the design system's (D-115): Questa for titles and Lato for body. Arabic stays Noto (D-123).
  add constraint site_settings_title_face check (title_face in ('Questa')),
  add constraint site_settings_body_face check (body_face in ('Lato')),
  -- Percents with two places (numeric(5,2) already); empty allowed, 0 allowed (D-107, D-160, D-165, D-168).
  add constraint site_settings_vat_range check (vat_percent between 0 and 100),
  add constraint site_settings_deposit_range check (deposit_percent between 0 and 100);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

drop view if exists public.site_settings_public;

-- What the public build may read: maintenance and brand only. No VAT, deposit, balance days or anything of the owner.
-- security_invoker: the view runs as anon, so anon gets column grants on exactly these columns and an RLS policy.
create or replace view public.api_site_settings
with (security_invoker = true) as
  select s.maintenance, s.teal, s.charcoal, s.gold, s.ivory, s.white, s.title_face, s.body_face,
         m.key as logo_key
    from public.site_settings s
    left join public.media m on m.id = s.logo_media_id
   where s.id = 1;

revoke all on public.api_site_settings from public, anon, authenticated;
grant select on public.api_site_settings to anon;

grant select (id, maintenance, teal, charcoal, gold, ivory, white, title_face, body_face, logo_media_id)
  on public.site_settings to anon;

create policy "site_settings: anon reads the singleton" on public.site_settings
  for select to anon using (id = 1);

-- The saved logo is public (the site shows it), so anon may read its media row, like a published row's photo.
create policy "media: anon reads the site logo" on public.media
  for select to anon using (
    exists (select 1 from public.site_settings s where s.id = 1 and s.logo_media_id = media.id)
  );
