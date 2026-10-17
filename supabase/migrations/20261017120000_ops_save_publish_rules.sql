-- Follow-up 7 (PR #18 review, 2026-10-15): a Save must not take a published row out of the publish rules.
-- ops_publish refuses a destination without its hero photo and a catalog item without its photo or without at least
-- one destination; ops_save_destination and ops_save_catalog_item did not check them again, so a published row could
-- be saved without them and stay live (03.2-06 blocks it in the dashboard; the server refuses it too now).
--
-- Both functions are the ones of 20261005100000_catalog_and_team.sql, unchanged but for one check at the end, after
-- every write of the save: on a row that is published, a missing photo is almar:invalid `hero_media_id` / `media_id`
-- and no destination is almar:invalid `destination_ids` (409 invalid with that field, as a slug change on a published
-- row is). The whole save rolls back. A draft row is never checked here: ops_publish checks it when it is published.
-- Translations are not part of this: catalog_save_translations refuses an emptied required text, but a whole Arabic
-- or Spanish record sent as null is still deleted on a published row (left as a follow-up, not in this item).
-- Safe on live data: two function replacements, no table or row change; the grants are stated again as they were.

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
  -- A published destination keeps what ops_publish required of it: its hero photo.
  if v_pub and (select d.hero_media_id from public.destinations d where d.id = v_id) is null then
    perform public.catalog_invalid('hero_media_id');
  end if;
  return jsonb_build_object('id', v_id, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_destination(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_destination(jsonb) to service_role;

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
  -- A published item keeps what ops_publish required of it: its photo and at least one destination.
  if v_pub and (select c.media_id from public.catalog_items c where c.id = v_id) is null then
    perform public.catalog_invalid('media_id');
  end if;
  if v_pub and not exists (select 1 from public.catalog_item_destinations cd where cd.item_id = v_id) then
    perform public.catalog_invalid('destination_ids');
  end if;
  return jsonb_build_object('id', v_id, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_catalog_item(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_catalog_item(jsonb) to service_role;
