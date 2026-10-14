-- Job 03.2-09b (review of PR #4, finding 3): one page of the photo library, searched and paged in SQL.
-- GET /api/ops/media used to read every row of ops_list('media') (1,127+) and filter in the Worker on each search
-- keystroke. ops_list_media returns one page only, in the same shape and order as before, so the Worker maps at most
-- 60 rows. Additive: two new functions; ops_list('media') is unchanged. Safe on live data (no table is touched).

-- Case- and accent-folded text for search: NFD, combining marks removed, lower case (the Worker's old fold()).
-- The marks are the Latin and Arabic combining ranges (written as \u escapes), not every Unicode mark: the library's
-- keys and English alt text are Latin.
create or replace function public.media_fold(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(
    normalize(coalesce(p, ''), nfd),
    '[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]',
    '', 'g'))
$$;

revoke execute on function public.media_fold(text) from public, anon, authenticated;
grant execute on function public.media_fold(text) to service_role;

-- p_q: text searched in the key and the English alt (folded; null or empty = none; at most 100 characters).
-- p_after: the last key of the previous page (null = from the start). p_limit: 1..60.
-- Key order is byte order (collate "C"), then id, the order the cursor compares in. An imported key may carry two
-- image ids: a page never ends between two rows of one key, so `after` never skips one.
-- Returns {items: [ops_list('media') rows], next: the page's last key, or null when nothing follows}.
create or replace function public.ops_list_media(p_q text default null, p_after text default null, p_limit int default 60)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_needle text;
  v_items jsonb;
  v_next text;
begin
  if p_limit is null or p_limit < 1 or p_limit > 60 then
    perform public.catalog_invalid('limit');
  end if;
  if p_q is not null and char_length(p_q) > 100 then
    perform public.catalog_invalid('q');
  end if;
  if p_after is not null and (char_length(p_after) > 300 or p_after !~ '^[a-z0-9][a-z0-9_-]*(/[a-z0-9][a-z0-9_.-]*)*\.(webp|jpg|png)$') then
    perform public.catalog_invalid('after');
  end if;
  v_needle := nullif(public.media_fold(btrim(coalesce(p_q, ''))), '');

  with matching as (
    select m.id, m.key collate "C" as key
    from public.media m
    where (p_after is null or m.key collate "C" > p_after collate "C")
      and (
        v_needle is null
        or strpos(public.media_fold(m.key), v_needle) > 0
        or strpos(public.media_fold((select it.alt from public.image_translations it where it.image_id = m.id and it.locale = 'en')), v_needle) > 0
      )
  ),
  -- The key of the p_limit-th row: the page takes every row up to and including that key.
  cut as (
    select x.key from matching x order by x.key, x.id offset p_limit - 1 limit 1
  )
  select
    (select c.key from cut c where exists (select 1 from matching y where y.key > c.key)),
    coalesce((
      select jsonb_agg(jsonb_build_object(
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
      ) order by x.key, x.id)
      from matching x
      join public.media m on m.id = x.id
      where not exists (select 1 from cut) or x.key <= (select c.key from cut c)
    ), '[]'::jsonb)
  into v_next, v_items;

  return jsonb_build_object('items', v_items, 'next', v_next);
end;
$$;

revoke execute on function public.ops_list_media(text, text, int) from public, anon, authenticated;
grant execute on function public.ops_list_media(text, text, int) to service_role;
