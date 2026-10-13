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

-- One Settings save is one transaction (PR #14 review): the settings row and the owner's own language and currency
-- commit together or not at all. Only the service role calls it (the owner API, after its owner check). It validates
-- every input the way lib/settings/validate.ts and lib/settings/handlers.ts do (the contrast gate stays in the app,
-- before the call); any refusal raises, so nothing is written.
create or replace function public.save_site_settings(
  p_owner_id uuid,
  p_teal text,
  p_charcoal text,
  p_gold text,
  p_ivory text,
  p_white text,
  p_title_face text,
  p_body_face text,
  p_vat_percent numeric,
  p_deposit_percent numeric,
  p_maintenance boolean,
  p_logo_media_id uuid,
  p_locale text,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_colour text;
begin
  foreach v_colour in array array[p_teal, p_charcoal, p_gold, p_ivory, p_white] loop
    if v_colour is not null and v_colour !~ '^#[0-9a-f]{6}$' then
      raise exception 'save_site_settings: a colour is not #rrggbb' using errcode = '22023';
    end if;
  end loop;
  if p_title_face is distinct from 'Questa' or p_body_face is distinct from 'Lato' then
    raise exception 'save_site_settings: a face is not the design system''s' using errcode = '22023';
  end if;
  if p_vat_percent is not null and (p_vat_percent < 0 or p_vat_percent > 100 or p_vat_percent <> round(p_vat_percent, 2)) then
    raise exception 'save_site_settings: VAT is not a percent with two places' using errcode = '22023';
  end if;
  if p_deposit_percent is not null and (p_deposit_percent < 0 or p_deposit_percent > 100 or p_deposit_percent <> round(p_deposit_percent, 2)) then
    raise exception 'save_site_settings: the deposit is not a percent with two places' using errcode = '22023';
  end if;
  if p_maintenance is null then
    raise exception 'save_site_settings: maintenance is required' using errcode = '22023';
  end if;
  if p_locale is null or p_locale not in ('en', 'ar', 'es') or p_currency is null or p_currency not in ('AED', 'USD', 'EUR') then
    raise exception 'save_site_settings: language or currency is not allowed' using errcode = '22023';
  end if;
  if p_logo_media_id is not null and not exists (
    select 1 from public.media m
     where m.id = p_logo_media_id
       and m.content_type in ('image/png', 'image/jpeg', 'image/webp')
       and m.bytes is not null and m.bytes <= 1048576
  ) then
    raise exception 'save_site_settings: the logo is not a PNG, JPEG or WebP up to 1 MB' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_owner_id and p.role = 'owner') then
    raise exception 'save_site_settings: not the owner' using errcode = '42501';
  end if;

  update public.site_settings
     set teal = p_teal, charcoal = p_charcoal, gold = p_gold, ivory = p_ivory, white = p_white,
         title_face = p_title_face, body_face = p_body_face,
         vat_percent = p_vat_percent, deposit_percent = p_deposit_percent,
         maintenance = p_maintenance, logo_media_id = p_logo_media_id
   where id = 1;
  if not found then
    raise exception 'save_site_settings: the settings row is missing' using errcode = 'P0002';
  end if;

  update public.profiles set locale = p_locale, currency = p_currency where id = p_owner_id;
end;
$$;

revoke execute on function public.save_site_settings(uuid, text, text, text, text, text, text, text, numeric, numeric, boolean, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.save_site_settings(uuid, text, text, text, text, text, text, text, numeric, numeric, boolean, uuid, text, text)
  to service_role;
