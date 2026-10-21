-- STAY-05 (owner, 2026-10-21): the guest sees each stay's pets rule on the stay page.
-- Additive: two columns granted to anon (the fee is a flat amount the owner types for the guest to read; it is not a
-- nightly rate, which stays unreadable, C-04) and appended to api_stays. Every other column, grant and the view's
-- filter are as in 20261005100000_catalog_and_team.sql. No data is written.

grant select (pets_rule, pets_fee_aed) on public.stays to anon;

create or replace view public.api_stays with (security_invoker = on) as
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
    where l.stay_id = s.id and c.kind = 'experience' and c.is_published and not c.is_home_pickup
  ), '{}'::uuid[]) as experience_ids,
  coalesce((
    select array_agg(l.item_id order by l.position, c.slug)
    from public.catalog_item_stays l join public.catalog_items c on c.id = l.item_id
    where l.stay_id = s.id and c.kind = 'service' and c.is_published and not c.is_home_pickup
  ), '{}'::uuid[]) as service_ids,
  case when hm.id is null then null::json
    else json_build_object('id', hm.id, 'media_key', hm.key, 'width', hm.width, 'height', hm.height, 'position', 0) end as hero_image,
  coalesce((
    select json_agg(json_build_object('id', gm.id, 'media_key', gm.key, 'width', gm.width, 'height', gm.height, 'position', g.position) order by g.position, gm.key)
    from public.stay_gallery g join public.media gm on gm.id = g.media_id
    where g.stay_id = s.id
  ), '[]'::json) as gallery,
  s.is_published, s.position,
  s.pets_rule, s.pets_fee_aed
from public.stays s
left join public.media hm on hm.id = s.hero_media_id
where s.is_published
order by s.position, s.slug;
