-- Phase 6 plan 06-01 Task 3: the one Phase 6 migration (contract: .planning/phases/06-site-and-rest-of-cms/06-01-PLAN.md,
-- "Interfaces for 06-02…06-07"). Number 20261025120000 reserved by the controller (2026-10-25), after Phase 4's
-- 20261019160000 and 20261019170000. No later Phase 6 plan writes a migration: 06-02…06-07 call what is here.
--
-- A work session never applies this file: only the controller applies it to the live project "Almar"
-- (jkdkaldgeiowkhlfmsft), on the owner's word, after the wave 2-4 pictures are signed (a schema change from those
-- signatures folds into this same file first). Local apply is `node tests/helpers/local-supabase.mjs reset`.
-- pgTAP: supabase/tests/site_cms.test.sql (written, not run: owner, no test).
--
-- What is in it, part by part, and why each part is safe on live data:
--   1. The translation lock (I18N-04, F-14): locked_fields on the seven existing translation tables and notes_locked on
--      stay_access; catalog_save_translations, catalog_gaps, ops_save_image_alts and ops_save_stay_access replaced.
--      Safe: additive columns with a '{}' default (every existing row passes the new checks), function replacements with
--      the same signatures and grants; no row is rewritten.
--   2. Helpers: the page-section slot list (the SQL copy of MEDIA_SLOTS in lib/data/page-sections.ts), the request
--      payload check, a uuid-list reader. Safe: new functions only.
--   3. New tables (pages and About cards, header/footer links, posts and blocks, legal pages and blocks, requests, the
--      consultation calendar, saved stays, package legs and add-ons), their indexes and triggers; seeds: the six legal
--      pages with no text (F-07: no legal text is written by us) and the consultation settings singleton of nulls (F-04:
--      null means closed). Safe: new empty tables, two seeds with `on conflict do nothing`.
--   4. Row-level security, grants and anon policies of the new tables; saved_stays for signed-in guests; the media
--      policy "media: anon reads" dropped and recreated with today's clauses plus the new references. Safe: no existing
--      grant is removed; the media policy only gains clauses.
--   5. Public views (anon, build time). Safe: new views only; api_journey_tiers and every 3.2 view are unchanged.
--   6. Functions: catalog_entity_meta, ops_publish, ops_delete, ops_reorder, ops_list, ops_get, ops_save_journey_tier,
--      catalog_media_uses and catalog_media_live replaced (every existing branch kept as it was, new branches added);
--      new save, list, request, consultation, saved-stay, booking-terms and import functions. Safe: same signatures and
--      grants for every replacement; nothing deleted.
--
-- The replaced bodies are the newest ones on the base: catalog_entity_meta, catalog_save_translations, catalog_gaps,
-- ops_get, ops_list, ops_publish, ops_delete, ops_reorder, ops_save_journey_tier, ops_save_image_alts,
-- catalog_media_uses, catalog_media_live and the policy "media: anon reads" from 20261005100000_catalog_and_team.sql;
-- ops_save_stay_access from 20261019140000_stay_access_notes_i18n.sql. "media: anon reads the site logo"
-- (20261013120000) is a separate policy and is not touched.
--
-- Rules the whole file follows (those of 20261005100000):
--   * Every new table: RLS on, every privilege revoked from public, anon and authenticated; anon gets column-level
--     selects (exactly the columns its views and the media policy read, never locked_fields) and a `for select to anon`
--     policy that follows the parent's shown / published flag. site_requests, consult_* and saved_stays get nothing for
--     anon; saved_stays gets select, insert, delete for authenticated on its own rows.
--   * Every new function: search_path '', schema-qualified names, execute revoked from public, anon and authenticated
--     and granted to service_role, except stay_is_published (authenticated, for the saved_stays insert policy).
--   * Refusals are SQLSTATE P0001, message 'almar:<code>' (public.catalog_fail / public.catalog_invalid).
--   * Public views: security_invoker = on, everything revoked, then select to anon; explicit columns; image objects with
--     json_build_object in the fixture key order (id, media_key, width, height, position).

-- ============================================================================================================
-- 1. The translation lock (I18N-04, F-14)
-- ============================================================================================================

-- A field the owner typed by hand in Arabic or Spanish is listed in that record's locked_fields; Save skips it when
-- the English changes. English is never locked.
alter table public.destination_translations
  add column locked_fields text[] not null default '{}',
  add constraint destination_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0);
alter table public.stay_translations
  add column locked_fields text[] not null default '{}',
  add constraint stay_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0);
alter table public.catalog_translations
  add column locked_fields text[] not null default '{}',
  add constraint catalog_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0);
alter table public.journey_tier_translations
  add column locked_fields text[] not null default '{}',
  add constraint journey_tier_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0);
alter table public.team_member_translations
  add column locked_fields text[] not null default '{}',
  add constraint team_member_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0);
alter table public.inclusion_translations
  add column locked_fields text[] not null default '{}',
  add constraint inclusion_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0);
-- An alt text has one field: the value is {alt} or {}.
alter table public.image_translations
  add column locked_fields text[] not null default '{}',
  add constraint image_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0),
  add constraint image_translations_locked_fields_alt check (locked_fields <@ array['alt']::text[]);

-- The stay's private access notes: the languages whose notes the owner fixed by hand (C-14: still never granted).
alter table public.stay_access
  add column notes_locked text[] not null default '{}' check (notes_locked <@ array['ar', 'es']::text[]);

-- Saves the translation records of one entity from {en: {...}, ar: {...}|null, es: ...} (contract 1.2): a language
-- absent leaves its record alone, null deletes it (never en), a present object upserts it and, inside it, a key
-- absent leaves that field alone. Text is trimmed and empty becomes null. p_need_en: the English record must exist
-- afterwards (a new row).
-- Phase 6 (I18N-04): inside a language object the key locked_fields is handled like status (present: set; absent:
-- kept). It is a json array of distinct names of this entity's own translated columns; any name on en, or an unknown
-- name, refuses translations.<loc>.locked_fields. The names are compared with the fixed list, never used as identifiers.
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
  v_cols text[];
  v_locked text[];
begin
  select * into m from public.catalog_entity_meta(p_entity);
  if not found then
    perform public.catalog_invalid('entity');
  end if;
  v_cols := array(select split_part(c, ':', 1) from unnest(m.cols) as c);

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
    v_sql := format('insert into public.%1$I as t (%2$I, locale, status, locked_fields%3$s) ', m.tr_tbl, m.fk, v_names)
      || format('values ($1, $2, coalesce(nullif($3 ->> ''status'', ''''), ''draft''), $4%s) ', v_vals)
      || format('on conflict (%1$I, locale) do update set status = case when $3 ? ''status'' then excluded.status else t.status end, '
        || 'locked_fields = case when $3 ? ''locked_fields'' then excluded.locked_fields else t.locked_fields end%2$s', m.fk, v_sets);

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
      v_locked := '{}'::text[];
      if v_obj ? 'locked_fields' then
        if jsonb_typeof(v_obj -> 'locked_fields') <> 'array'
           or exists (select 1 from jsonb_array_elements(v_obj -> 'locked_fields') as e where jsonb_typeof(e.value) <> 'string') then
          perform public.catalog_invalid('translations.' || v_loc || '.locked_fields', v_loc);
        end if;
        v_locked := array(
          select e.value from jsonb_array_elements_text(v_obj -> 'locked_fields') with ordinality as e(value, ord) order by e.ord
        );
        if (v_loc = 'en' and cardinality(v_locked) > 0)
           or cardinality(v_locked) <> (select count(distinct x) from unnest(v_locked) as x)
           or exists (select 1 from unnest(v_locked) as x where x <> all (v_cols)) then
          perform public.catalog_invalid('translations.' || v_loc || '.locked_fields', v_loc);
        end if;
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
      execute v_sql using p_id, v_loc, v_obj, v_locked;
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

-- Contract 5.9. Every text field filled in English must be filled in this language too (arrays: same length, no empty
-- item); p_req names the fields that must be filled even in English. Returns [{locale, field}, ...].
-- Phase 6: locked_fields is skipped like status (a lock never makes or hides a gap).
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
    if v_key = 'status' or v_key = 'locked_fields' or v_key = any (coalesce(p_req, '{}'::text[])) then
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

-- p = {id, alt: {en?, ar?, es?}, status: {ar?, es?}, locked?: {ar?, es?}}. A language in alt is set (null deletes it,
-- never en); a language only in status changes that record's status. Typed English is published, Arabic and Spanish
-- default draft. affects_site: a published row references the photo.
-- Phase 6 (I18N-04): locked.<ar|es> true stores {alt} on that record, false stores {}; absent keeps the lock; en, an
-- unknown language or a value that is not a boolean refuses locked.<loc>. Applied after the alt texts, to the records
-- that exist then.
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
  v_key text;
begin
  if v_id is null or not exists (select 1 from public.media m where m.id = v_id) then
    perform public.catalog_fail('not_found');
  end if;
  if p ? 'locked' then
    if jsonb_typeof(p -> 'locked') <> 'object' then
      perform public.catalog_invalid('locked');
    end if;
    for v_key in select k from jsonb_object_keys(p -> 'locked') as k loop
      if v_key not in ('ar', 'es') then
        perform public.catalog_invalid('locked.' || v_key, case when v_key = 'en' then 'en' end);
      end if;
      if jsonb_typeof(p -> 'locked' -> v_key) <> 'boolean' then
        perform public.catalog_invalid('locked.' || v_key, v_key);
      end if;
    end loop;
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
  if jsonb_typeof(p -> 'locked') = 'object' then
    update public.image_translations it
    set locked_fields = case when (p -> 'locked' ->> it.locale)::boolean then array['alt']::text[] else '{}'::text[] end
    where it.image_id = v_id and (p -> 'locked') ? it.locale;
  end if;
  return jsonb_build_object('id', v_id, 'affects_site', public.catalog_media_live(v_id));
end;
$$;

revoke execute on function public.ops_save_image_alts(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_image_alts(jsonb) to service_role;

-- p = {stay_id, access: {address, wifi_name, wifi_password, door_code, notes, notes_ar, notes_es, notes_locked}} (the
-- fields may also sit at the top level). A field absent is left alone; present, it is set (empty becomes null). Never
-- logged, never in a view. Same signature, search_path and security as 20261019140000_stay_access_notes_i18n.sql.
-- Phase 6 (I18N-04): notes_locked is a json array of distinct languages among ar, es (the notes the owner fixed by
-- hand); anything else refuses notes_locked. Absent keeps it.
create or replace function public.ops_save_stay_access(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_stay uuid := nullif(p ->> 'stay_id', '')::uuid;
  a jsonb := case when jsonb_typeof(p -> 'access') = 'object' then p -> 'access' else p end;
  v_locked text[] := '{}'::text[];
begin
  if v_stay is null or not exists (select 1 from public.stays s where s.id = v_stay) then
    perform public.catalog_fail('not_found');
  end if;
  if a ? 'notes_locked' then
    if jsonb_typeof(a -> 'notes_locked') <> 'array'
       or exists (select 1 from jsonb_array_elements(a -> 'notes_locked') as e
                  where jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') not in ('ar', 'es')) then
      perform public.catalog_invalid('notes_locked');
    end if;
    v_locked := array(select e.value from jsonb_array_elements_text(a -> 'notes_locked') as e(value));
    if cardinality(v_locked) <> (select count(distinct x) from unnest(v_locked) as x) then
      perform public.catalog_invalid('notes_locked');
    end if;
  end if;
  insert into public.stay_access as t (stay_id, address, wifi_name, wifi_password, door_code, notes, notes_ar, notes_es, notes_locked)
  values (
    v_stay, public.catalog_txt(a, 'address'), public.catalog_txt(a, 'wifi_name'), public.catalog_raw(a, 'wifi_password'),
    public.catalog_raw(a, 'door_code'), public.catalog_txt(a, 'notes'), public.catalog_txt(a, 'notes_ar'),
    public.catalog_txt(a, 'notes_es'), v_locked
  )
  on conflict (stay_id) do update set
    address = case when a ? 'address' then excluded.address else t.address end,
    wifi_name = case when a ? 'wifi_name' then excluded.wifi_name else t.wifi_name end,
    wifi_password = case when a ? 'wifi_password' then excluded.wifi_password else t.wifi_password end,
    door_code = case when a ? 'door_code' then excluded.door_code else t.door_code end,
    notes = case when a ? 'notes' then excluded.notes else t.notes end,
    notes_ar = case when a ? 'notes_ar' then excluded.notes_ar else t.notes_ar end,
    notes_es = case when a ? 'notes_es' then excluded.notes_es else t.notes_es end,
    notes_locked = case when a ? 'notes_locked' then excluded.notes_locked else t.notes_locked end;
  return jsonb_build_object('stay_id', v_stay);
end;
$$;

revoke execute on function public.ops_save_stay_access(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_stay_access(jsonb) to service_role;

-- ============================================================================================================
-- 2. Helpers
-- ============================================================================================================

-- The page sections and their media slots: the SQL copy of PAGE_SECTIONS / MEDIA_SLOTS in lib/data/page-sections.ts
-- (written in the same commit; change both together). One row per slot; a section with no photo has one row with a
-- null slot. ord = the section's fixed place on its page (F-09: section order is fixed in code). has_video = the
-- section takes an https video URL (every hero, F-09). many = the slot takes a list; decorative = its pictures are
-- alt="" in every language. A fixed list: nothing a caller sends is ever used as an identifier. 06-02 adds no slot.
create or replace function public.page_section_slots()
returns table (page text, section text, ord int, has_video boolean, slot text, many boolean, decorative boolean)
language sql
immutable
set search_path = ''
as $$
  select v.page, v.section, v.ord, v.has_video, v.slot, v.many, v.decorative
  from (values
    ('home', 'hero', 1, true, 'poster'::text, false, false),
    ('home', 'stays', 2, false, null, null, null),
    ('home', 'services', 3, false, null, null, null),
    ('home', 'moments', 4, false, null, null, null),
    ('home', 'welcome', 5, false, 'signature', false, false),
    ('home', 'welcome', 5, false, 'images', true, false),
    ('home', 'journeys', 6, false, null, null, null),
    ('home', 'stories', 7, false, null, null, null),
    ('home', 'gallery', 8, false, 'images', true, false),
    ('home', 'begin', 9, true, 'poster', false, false),
    ('home', 'team', 10, false, null, null, null),
    ('about', 'hero', 1, true, 'image', false, false),
    ('about', 'intro', 2, false, 'images', true, true),
    ('about', 'intro', 2, false, 'still', false, true),
    ('about', 'story', 3, false, null, null, null),
    ('about', 'values', 4, false, null, null, null),
    ('about', 'team', 5, false, null, null, null),
    ('about', 'get_in_touch', 6, false, 'cta_image', false, true),
    ('destinations', 'hero', 1, true, 'images', true, false),
    ('experiences', 'hero', 1, true, 'image', false, false),
    ('contact', 'title', 1, true, 'image', false, false),
    ('contact', 'confidence', 2, false, null, null, null),
    ('contact', 'team', 3, false, null, null, null)
  ) as v(page, section, ord, has_video, slot, many, decorative)
$$;

revoke execute on function public.page_section_slots() from public, anon, authenticated;
grant execute on function public.page_section_slots() to service_role;

-- The sections that hold About cards (page_items).
create or replace function public.page_section_has_items(p_page text, p_section text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_page = 'about' and p_section in ('story', 'values'), false)
$$;

revoke execute on function public.page_section_has_items(text, text) from public, anon, authenticated;
grant execute on function public.page_section_has_items(text, text) to service_role;

-- A json array of distinct uuid strings, at most p_max of them, as uuid[] (in the order given); anything else refuses
-- p_field. A json null is the empty list.
create or replace function public.site_uuid_list(p jsonb, p_field text, p_max int)
returns uuid[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v uuid[];
begin
  if p is null or jsonb_typeof(p) = 'null' then
    return '{}'::uuid[];
  end if;
  if jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > p_max
     or exists (select 1 from jsonb_array_elements(p) as e
                where jsonb_typeof(e.value) <> 'string'
                   or (e.value #>> '{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    perform public.catalog_invalid(p_field);
  end if;
  v := public.catalog_uuid_array(p);
  if cardinality(v) <> (select count(distinct x) from unnest(v) as x) then
    perform public.catalog_invalid(p_field);
  end if;
  return v;
end;
$$;

revoke execute on function public.site_uuid_list(jsonb, text, int) from public, anon, authenticated;
grant execute on function public.site_uuid_list(jsonb, text, int) to service_role;

-- One optional or required text value of a request payload: absent or json null is fine unless required; otherwise a
-- json string whose trimmed length is within [p_min, p_max].
create or replace function public.site_request_text_ok(p jsonb, p_key text, p_min int, p_max int, p_required boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when not (p ? p_key) or jsonb_typeof(p -> p_key) = 'null' then not p_required
    when jsonb_typeof(p -> p_key) <> 'string' then false
    else char_length(btrim(p ->> p_key, E' \t\r\n')) between p_min and p_max
  end
$$;

revoke execute on function public.site_request_text_ok(jsonb, text, int, int, boolean) from public, anon, authenticated;
grant execute on function public.site_request_text_ok(jsonb, text, int, int, boolean) to service_role;

-- An optional date of a request payload: absent or json null, or a 'YYYY-MM-DD' string that is a real date.
create or replace function public.site_request_date_ok(v jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if v is null or jsonb_typeof(v) = 'null' then
    return true;
  end if;
  if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    return false;
  end if;
  perform (v #>> '{}')::date;
  return true;
exception when others then
  return false;
end;
$$;

revoke execute on function public.site_request_date_ok(jsonb) from public, anon, authenticated;
grant execute on function public.site_request_date_ok(jsonb) to service_role;

-- The table check of site_requests.payload (06-05, 06-06; the same caps are SITE_REQUEST_CAPS in
-- lib/site-requests/types.ts, written in the same commit). An object whose keys are only those of its kind:
--   every kind   name (required, 1..120), email (required, <= 254, an @ and a dot after it), phone (optional,
--                ^\+?[0-9 ()-]{7,20}$), notes (optional, <= 2000)
--   plan         destination <= 120, from / to 'YYYY-MM-DD' with from < to when both are present, guests 1..99,
--                budget <= 120 (the guest's own words), airport <= 80; all optional
--   list         property_type 1..80, city 1..120, message 1..2000; all three required
--   package      tier_slug (required, the slug rule, <= 80), from / to, guests, cities (<= 6 strings, each 1..120)
--   consultation slot_start (required, ISO 8601 with a Z or an offset), time_zone (required, an IANA-style name <= 64)
-- An optional key may be absent or json null. Lengths are counted on the trimmed text.
create or replace function public.site_request_payload_ok(p_kind text, p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_keys text[];
  v_guests numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return false;
  end if;
  v_keys := case p_kind
    when 'plan' then array['name', 'email', 'phone', 'notes', 'destination', 'from', 'to', 'guests', 'budget', 'airport']
    when 'list' then array['name', 'email', 'phone', 'notes', 'property_type', 'city', 'message']
    when 'package' then array['name', 'email', 'phone', 'notes', 'tier_slug', 'from', 'to', 'guests', 'cities']
    when 'consultation' then array['name', 'email', 'phone', 'notes', 'slot_start', 'time_zone']
  end;
  if v_keys is null or exists (select 1 from jsonb_object_keys(p) as k where k <> all (v_keys)) then
    return false;
  end if;

  -- Every kind.
  if not public.site_request_text_ok(p, 'name', 1, 120, true)
     or not public.site_request_text_ok(p, 'notes', 0, 2000, false) then
    return false;
  end if;
  if jsonb_typeof(p -> 'email') is distinct from 'string'
     or char_length(p ->> 'email') > 254
     or (p ->> 'email') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return false;
  end if;
  if p ? 'phone' and jsonb_typeof(p -> 'phone') <> 'null'
     and (jsonb_typeof(p -> 'phone') <> 'string' or (p ->> 'phone') !~ '^\+?[0-9 ()-]{7,20}$') then
    return false;
  end if;

  -- Dates and guests (plan, package).
  if p_kind in ('plan', 'package') then
    if not public.site_request_date_ok(p -> 'from') or not public.site_request_date_ok(p -> 'to') then
      return false;
    end if;
    if jsonb_typeof(p -> 'from') = 'string' and jsonb_typeof(p -> 'to') = 'string'
       and (p ->> 'from')::date >= (p ->> 'to')::date then
      return false;
    end if;
    if p ? 'guests' and jsonb_typeof(p -> 'guests') <> 'null' then
      if jsonb_typeof(p -> 'guests') <> 'number' then
        return false;
      end if;
      v_guests := (p ->> 'guests')::numeric;
      if v_guests <> trunc(v_guests) or v_guests < 1 or v_guests > 99 then
        return false;
      end if;
    end if;
  end if;

  if p_kind = 'plan' then
    return public.site_request_text_ok(p, 'destination', 0, 120, false)
      and public.site_request_text_ok(p, 'budget', 0, 120, false)
      and public.site_request_text_ok(p, 'airport', 0, 80, false);
  elsif p_kind = 'list' then
    return public.site_request_text_ok(p, 'property_type', 1, 80, true)
      and public.site_request_text_ok(p, 'city', 1, 120, true)
      and public.site_request_text_ok(p, 'message', 1, 2000, true);
  elsif p_kind = 'package' then
    if jsonb_typeof(p -> 'tier_slug') is distinct from 'string'
       or char_length(p ->> 'tier_slug') > 80
       or (p ->> 'tier_slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      return false;
    end if;
    if p ? 'cities' and jsonb_typeof(p -> 'cities') <> 'null' then
      if jsonb_typeof(p -> 'cities') <> 'array' or jsonb_array_length(p -> 'cities') > 6
         or exists (select 1 from jsonb_array_elements(p -> 'cities') as e
                    where jsonb_typeof(e.value) <> 'string'
                       or char_length(btrim(e.value #>> '{}', E' \t\r\n')) not between 1 and 120) then
        return false;
      end if;
    end if;
    return true;
  else
    -- consultation
    if jsonb_typeof(p -> 'slot_start') is distinct from 'string'
       or (p ->> 'slot_start') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}(:?[0-9]{2})?)$' then
      return false;
    end if;
    if jsonb_typeof(p -> 'time_zone') is distinct from 'string'
       or char_length(p ->> 'time_zone') > 64
       or (p ->> 'time_zone') !~ '^[A-Za-z][A-Za-z0-9_+/-]*$' then
      return false;
    end if;
    -- The text carries its own offset, so the value does not depend on the session time zone.
    perform (p ->> 'slot_start')::timestamptz;
    return true;
  end if;
exception when others then
  return false;
end;
$$;

revoke execute on function public.site_request_payload_ok(text, jsonb) from public, anon, authenticated;
grant execute on function public.site_request_payload_ok(text, jsonb) to service_role;

-- ============================================================================================================
-- 3. Tables, in foreign-key order
-- ============================================================================================================

-- Pages (CMS-07, F-09): one row per section of the five public pages; rows come from import_site_content (no seed).
-- The order of sections is fixed in code (page_section_slots), so there is no position.
create table public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page text not null check (page in ('home', 'about', 'destinations', 'experiences', 'contact')),
  section text not null check (section ~ '^[a-z]+(_[a-z]+)*$' and char_length(section) <= 40),
  is_shown boolean not null default true,
  video_url text check (char_length(video_url) <= 500 and video_url ~ '^https://[^[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page, section)
);

create table public.page_section_translations (
  section_id uuid not null references public.page_sections (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  locked_fields text[] not null default '{}',
  kicker text check (char_length(kicker) <= 300),
  heading text check (char_length(heading) <= 300),
  headline text check (char_length(headline) <= 300),
  intro text check (char_length(intro) <= 5000),
  body text check (char_length(body) <= 5000),
  statement text check (char_length(statement) <= 5000),
  salutation text check (char_length(salutation) <= 300),
  paragraphs text[] not null default '{}' check (cardinality(paragraphs) <= 20),
  sign_off text check (char_length(sign_off) <= 300),
  signer text check (char_length(signer) <= 300),
  signer_role text check (char_length(signer_role) <= 300),
  cta_label text check (char_length(cta_label) <= 300),
  primary key (section_id, locale),
  constraint page_section_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0)
);

-- The pictures of a section, per slot (single slots at position 0; lists in the order shown). Alt text is the
-- picture's own (image_translations); a decorative slot is alt="" in every language.
create table public.page_section_media (
  section_id uuid not null references public.page_sections (id) on delete cascade,
  slot text not null check (slot ~ '^[a-z]+(_[a-z]+)*$' and char_length(slot) <= 40),
  position int not null check (position >= 0),
  media_id uuid not null references public.media (id) on delete restrict,
  is_decorative boolean not null default false,
  primary key (section_id, slot, position)
);

-- About cards (the story and values sections).
create table public.page_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.page_sections (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  media_id uuid references public.media (id) on delete restrict,
  is_shown boolean not null default true,
  position int not null default 0,
  is_sample boolean not null default false,
  sample_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint page_items_sample_fields check (is_sample = (cardinality(sample_fields) > 0))
);

create table public.page_item_translations (
  item_id uuid not null references public.page_items (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  locked_fields text[] not null default '{}',
  title text not null check (char_length(title) <= 300),
  body text check (char_length(body) <= 5000),
  primary key (item_id, locale),
  constraint page_item_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0)
);

-- Header and footer links (CMS-09, F-15). Login is fixed in code, always last, never a row. An internal target is a
-- page key of lib/site-nav.ts (e.g. destinations, plan-with-us, legal-privacy, journey:<slug>); an external one is an
-- https URL (CMS-06).
create table public.nav_links (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('header', 'footer')),
  position int not null default 0,
  is_shown boolean not null default true,
  link_kind text not null check (link_kind in ('internal', 'external')),
  target text not null check (lower(target) <> 'login'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nav_links_target check (
    case link_kind
      when 'internal' then char_length(target) <= 120 and target ~ '^[a-z0-9]+(-[a-z0-9]+)*(:[a-z0-9]+(-[a-z0-9]+)*)?$'
      else char_length(target) <= 500 and target ~ '^https://[^[:space:]]+$'
    end
  )
);

create table public.nav_link_translations (
  link_id uuid not null references public.nav_links (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  locked_fields text[] not null default '{}',
  label text not null check (char_length(label) <= 80),
  primary key (link_id, locale),
  constraint nav_link_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0)
);

-- Blog (SITE-10, F-08). The slug locks once published. Ordered by date on the site; no position.
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  cover_media_id uuid references public.media (id) on delete restrict,
  published_at timestamptz,
  destination_id uuid references public.destinations (id) on delete set null,
  featured_stay_id uuid references public.stays (id) on delete set null,
  featured_experience_id uuid references public.catalog_items (id) on delete set null,
  is_published boolean not null default false,
  is_sample boolean not null default false,
  sample_fields text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_sample_fields check (is_sample = (cardinality(sample_fields) > 0))
);

create table public.post_translations (
  post_id uuid not null references public.posts (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  locked_fields text[] not null default '{}',
  title text not null check (char_length(title) <= 300),
  excerpt text not null check (char_length(excerpt) <= 1000),
  seo_title text check (char_length(seo_title) <= 300),
  seo_description text check (char_length(seo_description) <= 1000),
  primary key (post_id, locale),
  constraint post_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0)
);

-- A post's body: heading, paragraph and quote carry text per language; a photo carries a picture (its alt is the
-- picture's own) and no text.
create table public.post_blocks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('heading', 'paragraph', 'photo', 'quote')),
  media_id uuid references public.media (id) on delete restrict,
  constraint post_blocks_photo_media check ((kind = 'photo') = (media_id is not null))
);

create table public.post_block_translations (
  block_id uuid not null references public.post_blocks (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  locked_fields text[] not null default '{}',
  text text check (char_length(text) <= 20000),
  primary key (block_id, locale),
  constraint post_block_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0)
);

-- Legal pages (SITE-09, F-07) and the cookie banner copy (SITE-07, F-05). Six rows, seeded below with no text: no
-- legal text is written by us. The four banner columns are for cookie_banner only (ops_save_legal_page refuses them
-- on every other kind).
create table public.legal_pages (
  id uuid primary key default gen_random_uuid(),
  kind text not null unique check (kind in ('privacy', 'terms', 'booking_terms', 'waiver', 'disclaimer', 'cookie_banner')),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.legal_page_translations (
  page_id uuid not null references public.legal_pages (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  locked_fields text[] not null default '{}',
  title text not null check (char_length(title) <= 300),
  seo_title text check (char_length(seo_title) <= 300),
  seo_description text check (char_length(seo_description) <= 1000),
  necessary_label text check (char_length(necessary_label) <= 300),
  necessary_body text check (char_length(necessary_body) <= 5000),
  analytics_label text check (char_length(analytics_label) <= 300),
  analytics_body text check (char_length(analytics_body) <= 5000),
  primary key (page_id, locale),
  constraint legal_page_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0)
);

create table public.legal_blocks (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.legal_pages (id) on delete cascade,
  position int not null,
  kind text not null check (kind in ('heading', 'paragraph', 'quote'))
);

create table public.legal_block_translations (
  block_id uuid not null references public.legal_blocks (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  locked_fields text[] not null default '{}',
  text text check (char_length(text) <= 20000),
  primary key (block_id, locale),
  constraint legal_block_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0)
);

-- Requests (SITE-04, SITE-05, SITE-06, F-01, F-10): Plan with us, List with us, a package request, a consultation.
-- Written only by submit_site_request / book_consultation (service role). name and email are copied out of the payload
-- (which keeps every key the guest sent, checked per kind) for the owner's list.
create table public.site_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('plan', 'list', 'package', 'consultation')),
  locale text not null check (locale in ('en', 'ar', 'es')),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254 and email = lower(email)),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid,
  constraint site_requests_payload check (public.site_request_payload_ok(kind, payload)),
  constraint site_requests_handled check (handled_by is null or handled_at is not null)
);

-- Consultation (SITE-06, F-04): weekly hours in Asia/Dubai (no daylight saving), days off, settings, bookings.
create table public.consult_hours (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 1 and 7),
  starts time not null,
  ends time not null,
  constraint consult_hours_order check (starts < ends),
  constraint consult_hours_half_hours check (
    extract(minute from starts) in (0, 30) and extract(second from starts) = 0
    and extract(minute from ends) in (0, 30) and extract(second from ends) = 0
  ),
  constraint consult_hours_no_overlap exclude using gist (
    weekday with =,
    (int4range((extract(hour from starts) * 60 + extract(minute from starts))::int,
               (extract(hour from ends) * 60 + extract(minute from ends))::int)) with &&
  )
);

create table public.consult_days_off (
  day date primary key
);

-- Singleton. notice_hours and horizon_days are null until the owner types them (F-04); null = the calendar is closed.
create table public.consult_settings (
  id int primary key default 1 check (id = 1),
  notice_hours int check (notice_hours between 0 and 720),
  horizon_days int check (horizon_days between 1 and 365),
  slot_minutes int not null default 30 check (slot_minutes = 30),
  updated_at timestamptz not null default now()
);

insert into public.consult_settings (id, notice_hours, horizon_days, slot_minutes) values (1, null, null, 30)
on conflict do nothing;

-- One row per booked slot. A slot is taken once while booked (partial unique index below); a cancelled slot can be
-- booked again.
create table public.consult_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_start timestamptz not null check (extract(epoch from slot_start) % 1800 = 0),
  request_id uuid not null references public.site_requests (id) on delete restrict,
  status text not null default 'booked' check (status in ('booked', 'cancelled')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consult_bookings_cancelled check ((status = 'cancelled') = (cancelled_at is not null))
);

-- Saved stays (BOOK-07, F-12): a signed-in guest's own list.
create table public.saved_stays (
  user_id uuid not null references auth.users (id) on delete cascade,
  stay_id uuid not null references public.stays (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, stay_id)
);

-- Packages (CMS-03, ADDN-03, F-02): the legs of a journey tier and its included add-ons.
create table public.journey_tier_legs (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references public.journey_tiers (id) on delete cascade,
  position int not null,
  destination_id uuid not null references public.destinations (id) on delete restrict,
  -- The suggested stay, optional; it belongs to the leg's destination (ops_save_journey_tier).
  stay_id uuid references public.stays (id) on delete set null
);

create table public.journey_tier_leg_translations (
  leg_id uuid not null references public.journey_tier_legs (id) on delete cascade,
  locale text not null check (locale in ('en', 'ar', 'es')),
  status text not null default 'draft' check (status in ('published', 'draft')),
  updated_at timestamptz not null default now(),
  locked_fields text[] not null default '{}',
  nights_label text check (char_length(nights_label) <= 120),
  primary key (leg_id, locale),
  constraint journey_tier_leg_translations_locked_fields_en check (locale <> 'en' or cardinality(locked_fields) = 0)
);

create table public.journey_tier_addons (
  tier_id uuid not null references public.journey_tiers (id) on delete cascade,
  item_id uuid not null references public.catalog_items (id) on delete cascade,
  position int not null,
  primary key (tier_id, item_id)
);

-- The six legal pages, unpublished and empty.
insert into public.legal_pages (kind) values
  ('privacy'),
  ('terms'),
  ('booking_terms'),
  ('waiver'),
  ('disclaimer'),
  ('cookie_banner')
on conflict (kind) do nothing;

-- ------------------------------------------------------------------------------------------------------------
-- Indexes (every foreign key column that no primary key already leads with)
-- ------------------------------------------------------------------------------------------------------------

create index page_section_media_media_idx on public.page_section_media (media_id);
create index page_items_section_idx on public.page_items (section_id);
create index page_items_media_idx on public.page_items (media_id);
create index nav_links_area_idx on public.nav_links (area, position);
create index posts_cover_media_idx on public.posts (cover_media_id);
create index posts_destination_idx on public.posts (destination_id);
create index posts_featured_stay_idx on public.posts (featured_stay_id);
create index posts_featured_experience_idx on public.posts (featured_experience_id);
create index post_blocks_post_idx on public.post_blocks (post_id, position);
create index post_blocks_media_idx on public.post_blocks (media_id);
create index legal_blocks_page_idx on public.legal_blocks (page_id, position);
create index site_requests_kind_created_idx on public.site_requests (kind, created_at desc);
create index site_requests_handled_idx on public.site_requests (handled_at);
create unique index consult_bookings_booked_slot_uidx on public.consult_bookings (slot_start) where status = 'booked';
create index consult_bookings_request_idx on public.consult_bookings (request_id);
create index saved_stays_stay_idx on public.saved_stays (stay_id);
create index journey_tier_legs_tier_idx on public.journey_tier_legs (tier_id, position);
create index journey_tier_legs_destination_idx on public.journey_tier_legs (destination_id);
create index journey_tier_legs_stay_idx on public.journey_tier_legs (stay_id);
create index journey_tier_addons_item_idx on public.journey_tier_addons (item_id);

-- ------------------------------------------------------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------------------------------------------------------

create trigger page_sections_set_updated_at before update on public.page_sections for each row execute function public.catalog_set_updated_at();
create trigger page_section_translations_set_updated_at before update on public.page_section_translations for each row execute function public.catalog_set_updated_at();
create trigger page_items_set_updated_at before update on public.page_items for each row execute function public.catalog_set_updated_at();
create trigger page_item_translations_set_updated_at before update on public.page_item_translations for each row execute function public.catalog_set_updated_at();
create trigger nav_links_set_updated_at before update on public.nav_links for each row execute function public.catalog_set_updated_at();
create trigger nav_link_translations_set_updated_at before update on public.nav_link_translations for each row execute function public.catalog_set_updated_at();
create trigger posts_set_updated_at before update on public.posts for each row execute function public.catalog_set_updated_at();
create trigger post_translations_set_updated_at before update on public.post_translations for each row execute function public.catalog_set_updated_at();
create trigger post_block_translations_set_updated_at before update on public.post_block_translations for each row execute function public.catalog_set_updated_at();
create trigger legal_pages_set_updated_at before update on public.legal_pages for each row execute function public.catalog_set_updated_at();
create trigger legal_page_translations_set_updated_at before update on public.legal_page_translations for each row execute function public.catalog_set_updated_at();
create trigger legal_block_translations_set_updated_at before update on public.legal_block_translations for each row execute function public.catalog_set_updated_at();
create trigger consult_settings_set_updated_at before update on public.consult_settings for each row execute function public.catalog_set_updated_at();
create trigger journey_tier_leg_translations_set_updated_at before update on public.journey_tier_leg_translations for each row execute function public.catalog_set_updated_at();

-- ============================================================================================================
-- 4. Row-level security, grants, policies
-- ============================================================================================================

alter table public.page_sections enable row level security;
alter table public.page_section_translations enable row level security;
alter table public.page_section_media enable row level security;
alter table public.page_items enable row level security;
alter table public.page_item_translations enable row level security;
alter table public.nav_links enable row level security;
alter table public.nav_link_translations enable row level security;
alter table public.posts enable row level security;
alter table public.post_translations enable row level security;
alter table public.post_blocks enable row level security;
alter table public.post_block_translations enable row level security;
alter table public.legal_pages enable row level security;
alter table public.legal_page_translations enable row level security;
alter table public.legal_blocks enable row level security;
alter table public.legal_block_translations enable row level security;
alter table public.site_requests enable row level security;
alter table public.consult_hours enable row level security;
alter table public.consult_days_off enable row level security;
alter table public.consult_settings enable row level security;
alter table public.consult_bookings enable row level security;
alter table public.saved_stays enable row level security;
alter table public.journey_tier_legs enable row level security;
alter table public.journey_tier_leg_translations enable row level security;
alter table public.journey_tier_addons enable row level security;

revoke all on public.page_sections from public, anon, authenticated;
revoke all on public.page_section_translations from public, anon, authenticated;
revoke all on public.page_section_media from public, anon, authenticated;
revoke all on public.page_items from public, anon, authenticated;
revoke all on public.page_item_translations from public, anon, authenticated;
revoke all on public.nav_links from public, anon, authenticated;
revoke all on public.nav_link_translations from public, anon, authenticated;
revoke all on public.posts from public, anon, authenticated;
revoke all on public.post_translations from public, anon, authenticated;
revoke all on public.post_blocks from public, anon, authenticated;
revoke all on public.post_block_translations from public, anon, authenticated;
revoke all on public.legal_pages from public, anon, authenticated;
revoke all on public.legal_page_translations from public, anon, authenticated;
revoke all on public.legal_blocks from public, anon, authenticated;
revoke all on public.legal_block_translations from public, anon, authenticated;
revoke all on public.site_requests from public, anon, authenticated;
revoke all on public.consult_hours from public, anon, authenticated;
revoke all on public.consult_days_off from public, anon, authenticated;
revoke all on public.consult_settings from public, anon, authenticated;
revoke all on public.consult_bookings from public, anon, authenticated;
revoke all on public.saved_stays from public, anon, authenticated;
revoke all on public.journey_tier_legs from public, anon, authenticated;
revoke all on public.journey_tier_leg_translations from public, anon, authenticated;
revoke all on public.journey_tier_addons from public, anon, authenticated;

-- Column-level selects for anon: the columns the api_* views and the media policy read. Never granted: locked_fields,
-- created_at / updated_at of translation rows, anything of site_requests, consult_* and saved_stays.
grant select (id, page, section, is_shown, video_url) on public.page_sections to anon;
grant select (section_id, locale, status, kicker, heading, headline, intro, body, statement, salutation, paragraphs,
  sign_off, signer, signer_role, cta_label)
  on public.page_section_translations to anon;
grant select (section_id, slot, position, media_id, is_decorative) on public.page_section_media to anon;
grant select (id, section_id, slug, media_id, is_shown, position, is_sample, sample_fields, created_at, updated_at)
  on public.page_items to anon;
grant select (item_id, locale, status, title, body) on public.page_item_translations to anon;
grant select (id, area, position, is_shown, link_kind, target) on public.nav_links to anon;
grant select (link_id, locale, status, label) on public.nav_link_translations to anon;
grant select (id, slug, cover_media_id, published_at, destination_id, featured_stay_id, featured_experience_id,
  is_published, is_sample, sample_fields, created_at, updated_at)
  on public.posts to anon;
grant select (post_id, locale, status, title, excerpt, seo_title, seo_description) on public.post_translations to anon;
grant select (id, post_id, position, kind, media_id) on public.post_blocks to anon;
grant select (block_id, locale, status, text) on public.post_block_translations to anon;
grant select (id, kind, is_published, updated_at) on public.legal_pages to anon;
grant select (page_id, locale, status, title, seo_title, seo_description, necessary_label, necessary_body,
  analytics_label, analytics_body)
  on public.legal_page_translations to anon;
grant select (id, page_id, position, kind) on public.legal_blocks to anon;
grant select (block_id, locale, status, text) on public.legal_block_translations to anon;
grant select (id, tier_id, position, destination_id, stay_id) on public.journey_tier_legs to anon;
grant select (leg_id, locale, status, nights_label) on public.journey_tier_leg_translations to anon;
grant select (tier_id, item_id, position) on public.journey_tier_addons to anon;

-- A signed-in guest's own saved stays (06-07). The table only: no view, no anon.
grant select, insert, delete on public.saved_stays to authenticated;

-- Policies: shown or published rows only; a translation, media or child row follows its parent's flag.
create policy "page_sections: anon reads shown" on public.page_sections
  for select to anon using (is_shown);
create policy "page_section_translations: anon reads shown" on public.page_section_translations
  for select to anon using (exists (select 1 from public.page_sections p where p.id = section_id and p.is_shown));
create policy "page_section_media: anon reads shown" on public.page_section_media
  for select to anon using (exists (select 1 from public.page_sections p where p.id = section_id and p.is_shown));
create policy "page_items: anon reads shown" on public.page_items
  for select to anon using (is_shown and exists (select 1 from public.page_sections p where p.id = section_id and p.is_shown));
create policy "page_item_translations: anon reads shown" on public.page_item_translations
  for select to anon using (exists (
    select 1 from public.page_items i join public.page_sections p on p.id = i.section_id
    where i.id = item_id and i.is_shown and p.is_shown));
create policy "nav_links: anon reads shown" on public.nav_links
  for select to anon using (is_shown);
create policy "nav_link_translations: anon reads shown" on public.nav_link_translations
  for select to anon using (exists (select 1 from public.nav_links p where p.id = link_id and p.is_shown));
create policy "posts: anon reads published" on public.posts
  for select to anon using (is_published);
create policy "post_translations: anon reads published" on public.post_translations
  for select to anon using (exists (select 1 from public.posts p where p.id = post_id and p.is_published));
create policy "post_blocks: anon reads published" on public.post_blocks
  for select to anon using (exists (select 1 from public.posts p where p.id = post_id and p.is_published));
create policy "post_block_translations: anon reads published" on public.post_block_translations
  for select to anon using (exists (
    select 1 from public.post_blocks b join public.posts p on p.id = b.post_id
    where b.id = block_id and p.is_published));
create policy "legal_pages: anon reads published" on public.legal_pages
  for select to anon using (is_published);
create policy "legal_page_translations: anon reads published" on public.legal_page_translations
  for select to anon using (exists (select 1 from public.legal_pages p where p.id = page_id and p.is_published));
create policy "legal_blocks: anon reads published" on public.legal_blocks
  for select to anon using (exists (select 1 from public.legal_pages p where p.id = page_id and p.is_published));
create policy "legal_block_translations: anon reads published" on public.legal_block_translations
  for select to anon using (exists (
    select 1 from public.legal_blocks b join public.legal_pages p on p.id = b.page_id
    where b.id = block_id and p.is_published));
create policy "journey_tier_legs: anon reads published" on public.journey_tier_legs
  for select to anon using (exists (select 1 from public.journey_tiers p where p.id = tier_id and p.is_published));
create policy "journey_tier_leg_translations: anon reads published" on public.journey_tier_leg_translations
  for select to anon using (exists (
    select 1 from public.journey_tier_legs l join public.journey_tiers p on p.id = l.tier_id
    where l.id = leg_id and p.is_published));
create policy "journey_tier_addons: anon reads published" on public.journey_tier_addons
  for select to anon using (exists (select 1 from public.journey_tiers p where p.id = tier_id and p.is_published));

-- The saved_stays insert policy needs to know that a stay is published, and authenticated has no select on stays
-- (20261005100000 revoked it): a subquery on stays would see no row and refuse every save. This definer function
-- answers one boolean about a flag the public views already show. The one function in this file authenticated may call.
create or replace function public.stay_is_published(p_stay uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.stays s where s.id = p_stay and s.is_published)
$$;

revoke execute on function public.stay_is_published(uuid) from public, anon;
grant execute on function public.stay_is_published(uuid) to authenticated, service_role;

create policy "saved_stays: own rows" on public.saved_stays
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "saved_stays: save a published stay" on public.saved_stays
  for insert to authenticated with check ((select auth.uid()) = user_id and public.stay_is_published(stay_id));
create policy "saved_stays: remove own rows" on public.saved_stays
  for delete to authenticated using ((select auth.uid()) = user_id);

-- The media policy of 20261005100000 with the Phase 6 references added: a picture of a shown page section or a shown
-- About card (in a shown section), a published post's cover and the photos of a published post's body. The clauses of
-- 20261005100000 are kept as they were. "media: anon reads the site logo" (20261013120000) is a separate policy.
drop policy if exists "media: anon reads" on public.media;
create policy "media: anon reads" on public.media
  for select to anon using (
    source = 'import'
    or exists (select 1 from public.destinations d
      where d.is_published and media.id in (d.hero_media_id, d.inset_media_id))
    or exists (select 1 from public.stays s
      where s.is_published and s.hero_media_id = media.id)
    or exists (select 1 from public.stay_gallery g join public.stays s on s.id = g.stay_id
      where s.is_published and g.media_id = media.id)
    or exists (select 1 from public.catalog_items c
      where c.is_published and c.media_id = media.id)
    or exists (select 1 from public.journey_tiers j
      where j.is_published and j.media_id = media.id)
    or exists (select 1 from public.team_members t
      where t.is_published and t.photo_media_id = media.id)
    or exists (select 1 from public.page_section_media sm join public.page_sections ps on ps.id = sm.section_id
      where ps.is_shown and sm.media_id = media.id)
    or exists (select 1 from public.page_items pi join public.page_sections ps on ps.id = pi.section_id
      where pi.is_shown and ps.is_shown and pi.media_id = media.id)
    or exists (select 1 from public.posts po
      where po.is_published and po.cover_media_id = media.id)
    or exists (select 1 from public.post_blocks pb join public.posts po on po.id = pb.post_id
      where po.is_published and pb.media_id = media.id)
  );

-- ============================================================================================================
-- 5. Public views (build time, anon key). security_invoker = on: RLS and the column grants above apply, and each
-- view filters the shown / published flags itself. Explicit columns; the build serialises rows into client props, so
-- the column order reaches the HTML bytes. Image objects use json_build_object (key order of the fixtures).
-- ============================================================================================================

create view public.api_page_sections with (security_invoker = on) as
select s.id, s.page, s.section, s.video_url
from public.page_sections s
where s.is_shown
order by s.page, s.section;

create view public.api_page_section_translations with (security_invoker = on) as
select
  t.section_id, t.locale, t.status, t.kicker, t.heading, t.headline, t.intro, t.body, t.statement, t.salutation,
  t.paragraphs, t.sign_off, t.signer, t.signer_role, t.cta_label
from public.page_section_translations t
join public.page_sections s on s.id = t.section_id
where s.is_shown
order by s.page, s.section, t.locale;

create view public.api_page_section_media with (security_invoker = on) as
select
  sm.section_id, sm.slot, sm.position, sm.is_decorative,
  json_build_object('id', m.id, 'media_key', m.key, 'width', m.width, 'height', m.height, 'position', sm.position) as image
from public.page_section_media sm
join public.page_sections s on s.id = sm.section_id
join public.media m on m.id = sm.media_id
where s.is_shown
order by s.page, s.section, sm.slot, sm.position;

-- About cards (about.json "cards"): is_published is the card's shown flag; section is the parent section's key.
create view public.api_page_items with (security_invoker = on) as
select
  i.id, i.created_at, i.updated_at, i.is_sample, i.sample_fields, i.slug,
  s.section,
  case when m.id is null then null::json
    else json_build_object('id', m.id, 'media_key', m.key, 'width', m.width, 'height', m.height, 'position', 0) end as image,
  i.is_shown as is_published,
  i.position
from public.page_items i
join public.page_sections s on s.id = i.section_id
left join public.media m on m.id = i.media_id
where i.is_shown and s.is_shown
order by s.section, i.position, i.slug;

create view public.api_page_item_translations with (security_invoker = on) as
select t.item_id as card_id, t.locale, t.status, t.title, t.body
from public.page_item_translations t
join public.page_items i on i.id = t.item_id
join public.page_sections s on s.id = i.section_id
where i.is_shown and s.is_shown
order by s.section, i.position, i.slug, t.locale;

-- posts.json column order. A featured destination, stay or experience that is not published reads as null (the build
-- never links to a page that does not exist; under anon RLS the join sees published rows only anyway).
create view public.api_posts with (security_invoker = on) as
select
  p.id, p.slug, p.created_at, p.updated_at, p.is_sample, p.sample_fields,
  d.id as destination_id,
  st.id as featured_stay_id,
  ex.id as featured_experience_id,
  case when m.id is null then null::json
    else json_build_object('id', m.id, 'media_key', m.key, 'width', m.width, 'height', m.height, 'position', 0) end as cover_image,
  p.published_at, p.is_published
from public.posts p
left join public.media m on m.id = p.cover_media_id
left join public.destinations d on d.id = p.destination_id and d.is_published
left join public.stays st on st.id = p.featured_stay_id and st.is_published
left join public.catalog_items ex on ex.id = p.featured_experience_id and ex.is_published and not ex.is_home_pickup
where p.is_published
order by p.published_at desc nulls last, p.slug;

-- post-translations.json column order. body = the post's blocks in position order: {type, text} with this language's
-- text for heading / paragraph / quote, {type: "photo", image} for a photo (image position = the block's position).
create view public.api_post_translations with (security_invoker = on) as
select
  t.post_id, t.locale, t.title, t.excerpt,
  coalesce((
    select json_agg(
      case when b.kind = 'photo' then
        json_build_object('type', 'photo', 'image',
          case when bm.id is null then null::json
            else json_build_object('id', bm.id, 'media_key', bm.key, 'width', bm.width, 'height', bm.height, 'position', b.position) end)
      else json_build_object('type', b.kind, 'text', bt.text) end
      order by b.position, b.id)
    from public.post_blocks b
    left join public.post_block_translations bt on bt.block_id = b.id and bt.locale = t.locale
    left join public.media bm on bm.id = b.media_id
    where b.post_id = t.post_id
  ), '[]'::json) as body,
  t.seo_title, t.seo_description, t.status
from public.post_translations t
join public.posts p on p.id = t.post_id
where p.is_published
order by p.published_at desc nulls last, p.slug, t.locale;

create view public.api_nav_links with (security_invoker = on) as
select l.id, l.area, l.position, l.link_kind, l.target
from public.nav_links l
where l.is_shown
order by l.area, l.position, l.id;

create view public.api_nav_link_translations with (security_invoker = on) as
select t.link_id, t.locale, t.status, t.label
from public.nav_link_translations t
join public.nav_links l on l.id = t.link_id
where l.is_shown
order by l.area, l.position, l.id, t.locale;

create view public.api_legal_pages with (security_invoker = on) as
select l.id, l.kind, l.updated_at
from public.legal_pages l
where l.is_published
order by l.kind;

create view public.api_legal_page_translations with (security_invoker = on) as
select
  t.page_id, t.locale, t.status, t.title, t.seo_title, t.seo_description,
  t.necessary_label, t.necessary_body, t.analytics_label, t.analytics_body,
  coalesce((
    select json_agg(json_build_object('type', b.kind, 'text', bt.text) order by b.position, b.id)
    from public.legal_blocks b
    left join public.legal_block_translations bt on bt.block_id = b.id and bt.locale = t.locale
    where b.page_id = t.page_id
  ), '[]'::json) as body
from public.legal_page_translations t
join public.legal_pages l on l.id = t.page_id
where l.is_published
order by l.kind, t.locale;

-- Package legs of published tiers in published destinations; a suggested stay that is not published reads as null.
create view public.api_journey_tier_legs with (security_invoker = on) as
select l.id, l.tier_id, l.position, l.destination_id, s.id as stay_id
from public.journey_tier_legs l
join public.journey_tiers j on j.id = l.tier_id
join public.destinations d on d.id = l.destination_id
left join public.stays s on s.id = l.stay_id and s.is_published
where j.is_published and d.is_published
order by j.position, j.slug, l.position, l.id;

create view public.api_journey_tier_leg_translations with (security_invoker = on) as
select t.leg_id, t.locale, t.status, t.nights_label
from public.journey_tier_leg_translations t
join public.journey_tier_legs l on l.id = t.leg_id
join public.journey_tiers j on j.id = l.tier_id
join public.destinations d on d.id = l.destination_id
where j.is_published and d.is_published
order by j.position, j.slug, l.position, l.id, t.locale;

-- Included add-ons (ADDN-03): published items only, never the home pickup.
create view public.api_journey_tier_addons with (security_invoker = on) as
select a.tier_id, a.item_id, a.position
from public.journey_tier_addons a
join public.journey_tiers j on j.id = a.tier_id
join public.catalog_items c on c.id = a.item_id
where j.is_published and c.is_published and not c.is_home_pickup
order by j.position, j.slug, a.position, a.item_id;

revoke all on public.api_page_sections from public, anon, authenticated;
revoke all on public.api_page_section_translations from public, anon, authenticated;
revoke all on public.api_page_section_media from public, anon, authenticated;
revoke all on public.api_page_items from public, anon, authenticated;
revoke all on public.api_page_item_translations from public, anon, authenticated;
revoke all on public.api_posts from public, anon, authenticated;
revoke all on public.api_post_translations from public, anon, authenticated;
revoke all on public.api_nav_links from public, anon, authenticated;
revoke all on public.api_nav_link_translations from public, anon, authenticated;
revoke all on public.api_legal_pages from public, anon, authenticated;
revoke all on public.api_legal_page_translations from public, anon, authenticated;
revoke all on public.api_journey_tier_legs from public, anon, authenticated;
revoke all on public.api_journey_tier_leg_translations from public, anon, authenticated;
revoke all on public.api_journey_tier_addons from public, anon, authenticated;

grant select on public.api_page_sections to anon;
grant select on public.api_page_section_translations to anon;
grant select on public.api_page_section_media to anon;
grant select on public.api_page_items to anon;
grant select on public.api_page_item_translations to anon;
grant select on public.api_posts to anon;
grant select on public.api_post_translations to anon;
grant select on public.api_nav_links to anon;
grant select on public.api_nav_link_translations to anon;
grant select on public.api_legal_pages to anon;
grant select on public.api_legal_page_translations to anon;
grant select on public.api_journey_tier_legs to anon;
grant select on public.api_journey_tier_leg_translations to anon;
grant select on public.api_journey_tier_addons to anon;

-- ============================================================================================================
-- 6. Functions (service_role only unless said). Same signatures and grants for every replacement.
-- ============================================================================================================

-- The entities the owner edits: base table, translation table, its foreign key, the translated columns
-- ('name:t' = text, 'name:a' = text array) and the columns that must be filled in every language to publish.
-- A fixed list: nothing a caller sends is ever used as an identifier.
-- Phase 6 adds page_section, page_item, nav_link, post, post_block, legal_page, legal_block and journey_tier_leg; the
-- five entities of 20261005100000 are as they were.
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
      array['name:t', 'price_label:t', 'tagline:t', 'duration_label:t', 'ideal_for_label:t', 'ideal_for:t', 'body:t'], array['name', 'price_label']),
    ('page_section', 'page_sections', 'page_section_translations', 'section_id',
      array['kicker:t', 'heading:t', 'headline:t', 'intro:t', 'body:t', 'statement:t', 'salutation:t', 'paragraphs:a',
            'sign_off:t', 'signer:t', 'signer_role:t', 'cta_label:t'], '{}'::text[]),
    ('page_item', 'page_items', 'page_item_translations', 'item_id',
      array['title:t', 'body:t'], array['title']),
    ('nav_link', 'nav_links', 'nav_link_translations', 'link_id',
      array['label:t'], array['label']),
    ('post', 'posts', 'post_translations', 'post_id',
      array['title:t', 'excerpt:t', 'seo_title:t', 'seo_description:t'], array['title', 'excerpt']),
    ('post_block', 'post_blocks', 'post_block_translations', 'block_id',
      array['text:t'], '{}'::text[]),
    ('legal_page', 'legal_pages', 'legal_page_translations', 'page_id',
      array['title:t', 'seo_title:t', 'seo_description:t', 'necessary_label:t', 'necessary_body:t', 'analytics_label:t', 'analytics_body:t'], array['title']),
    ('legal_block', 'legal_blocks', 'legal_block_translations', 'block_id',
      array['text:t'], '{}'::text[]),
    ('journey_tier_leg', 'journey_tier_legs', 'journey_tier_leg_translations', 'leg_id',
      array['nights_label:t'], '{}'::text[])
  ) as v(entity, base_tbl, tr_tbl, fk, cols, req)
  where v.entity = p_entity
$$;

revoke execute on function public.catalog_entity_meta(text) from public, anon, authenticated;
grant execute on function public.catalog_entity_meta(text) to service_role;

-- The entities with an is_published flag (ops_publish; ops_delete refuses a published row of these).
create or replace function public.catalog_entity_publishable(p_entity text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_entity in ('destination', 'stay', 'catalog_item', 'team_member', 'journey_tier', 'post', 'legal_page'), false)
$$;

revoke execute on function public.catalog_entity_publishable(text) from public, anon, authenticated;
grant execute on function public.catalog_entity_publishable(text) to service_role;

-- Rows of any table, published or not, that reference the photo. Phase 6 adds page sections, About cards, post covers
-- and post photos.
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
    + (select count(*) from public.page_section_media sm where sm.media_id = p_id)
    + (select count(*) from public.page_items pi where pi.media_id = p_id)
    + (select count(*) from public.posts po where po.cover_media_id = p_id)
    + (select count(*) from public.post_blocks pb where pb.media_id = p_id)
  )::int
$$;

revoke execute on function public.catalog_media_uses(uuid) from public, anon, authenticated;
grant execute on function public.catalog_media_uses(uuid) to service_role;

-- True when a published row references the photo (a change to its alt text reaches the public site). Phase 6 adds a
-- shown section, a shown About card in a shown section, a published post's cover and its body photos.
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
    or exists (select 1 from public.page_section_media sm join public.page_sections ps on ps.id = sm.section_id
      where ps.is_shown and sm.media_id = p_id)
    or exists (select 1 from public.page_items pi join public.page_sections ps on ps.id = pi.section_id
      where pi.is_shown and ps.is_shown and pi.media_id = p_id)
    or exists (select 1 from public.posts po where po.is_published and po.cover_media_id = p_id)
    or exists (select 1 from public.post_blocks pb join public.posts po on po.id = pb.post_id where po.is_published and pb.media_id = p_id)
$$;

revoke execute on function public.catalog_media_live(uuid) from public, anon, authenticated;
grant execute on function public.catalog_media_live(uuid) to service_role;

-- A published row is never deleted (unpublish first); a foreign key in use refuses with 23503 (the route says in_use).
-- Phase 6: an unpublished journey tier may be deleted now (owner-created packages, F-02); page sections and legal
-- pages are never deleted (their rows are fixed), nor are blocks and legs (they are saved with their parent). About
-- cards and links have no publish flag: they are deleted as they are, and the answer adds affects_site (was shown).
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
  if not found or p_entity in ('page_section', 'legal_page', 'post_block', 'legal_block', 'journey_tier_leg') then
    perform public.catalog_invalid('entity');
  end if;
  execute format('select exists (select 1 from public.%I where id = $1)', m.base_tbl) into v_found using p_id;
  if not v_found then
    perform public.catalog_fail('not_found');
  end if;
  if public.catalog_entity_publishable(p_entity) then
    execute format('select is_published from public.%I where id = $1', m.base_tbl) into v_pub using p_id;
    if v_pub then
      perform public.catalog_fail('published');
    end if;
    execute format('delete from public.%I where id = $1', m.base_tbl) using p_id;
    return jsonb_build_object('id', p_id);
  end if;
  execute format('select is_shown from public.%I where id = $1', m.base_tbl) into v_pub using p_id;
  execute format('delete from public.%I where id = $1', m.base_tbl) using p_id;
  return jsonb_build_object('id', p_id, 'affects_site', coalesce(v_pub, false));
end;
$$;

revoke execute on function public.ops_delete(text, uuid) from public, anon, authenticated;
grant execute on function public.ops_delete(text, uuid) to service_role;

-- position = 1, 2, 3, ... in the order of p_ids. affects_site: any of them is published.
-- Phase 6: About cards and links reorder too (affects_site: any of them is shown); page sections (order fixed in
-- code), posts (ordered by date), legal pages, blocks and legs (order saved with their parent) are refused.
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
  if not found or p_entity not in ('destination', 'stay', 'catalog_item', 'team_member', 'journey_tier', 'page_item', 'nav_link') then
    perform public.catalog_invalid('entity');
  end if;
  execute format(
    'with o as (select u.id, u.ord from unnest($1) with ordinality as u(id, ord)) '
    || 'update public.%I t set position = o.ord from o where t.id = o.id', m.base_tbl)
    using p_ids;
  if public.catalog_entity_publishable(p_entity) then
    execute format('select coalesce(bool_or(is_published), false) from public.%I where id = any ($1)', m.base_tbl) into v_live using p_ids;
  else
    execute format('select coalesce(bool_or(is_shown), false) from public.%I where id = any ($1)', m.base_tbl) into v_live using p_ids;
  end if;
  return jsonb_build_object('affects_site', v_live);
end;
$$;

revoke execute on function public.ops_reorder(text, uuid[]) from public, anon, authenticated;
grant execute on function public.ops_reorder(text, uuid[]) to service_role;

-- Contract 5.9. A refusal does not raise: it returns {ok: false, code, missing, warnings, is_published}.
-- Publish needs: every text field filled in English filled in Arabic and Spanish too (arrays of the same length, no
-- empty item), the per-entity required fields, a published destination for a stay. Unpublish is always allowed,
-- except a destination that still has published stays. The caller (03.2-05) requests the site rebuild.
-- Phase 6: an entity without a publish flag is refused (invalid entity). A post needs its cover photo and every text
-- block filled in the three languages (field blocks.<index>.text, index from 0 in position order); its date is set to
-- now when it has none. A legal page needs at least one block, each filled in the three languages; the cookie banner
-- needs instead its title and both labels (necessary_label, analytics_label) in English, then in Arabic and Spanish.
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
  if not found or not public.catalog_entity_publishable(p_entity) then
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
  elsif p_entity = 'post' then
    if (select po.cover_media_id from public.posts po where po.id = p_id) is null then
      v_missing := v_missing || jsonb_build_array(jsonb_build_object('locale', null, 'field', 'cover_media_id'));
    end if;
    v_missing := v_missing || coalesce((
      select jsonb_agg(jsonb_build_object('locale', g.locale, 'field', 'blocks.' || (b.idx - 1) || '.text') order by b.idx, g.ord)
      from (select x.id, x.kind, row_number() over (order by x.position, x.id) as idx
            from public.post_blocks x where x.post_id = p_id) b
      cross join unnest(array['en', 'ar', 'es']) with ordinality as g(locale, ord)
      left join public.post_block_translations bt on bt.block_id = b.id and bt.locale = g.locale
      where b.kind <> 'photo' and (bt.text is null or btrim(bt.text, E' \t\r\n') = '')
    ), '[]'::jsonb);
  elsif p_entity = 'legal_page' then
    if (select l.kind from public.legal_pages l where l.id = p_id) = 'cookie_banner' then
      if public.catalog_blank(v_en -> 'necessary_label') then
        v_missing := v_missing || jsonb_build_array(jsonb_build_object('locale', 'en', 'field', 'necessary_label'));
      end if;
      if public.catalog_blank(v_en -> 'analytics_label') then
        v_missing := v_missing || jsonb_build_array(jsonb_build_object('locale', 'en', 'field', 'analytics_label'));
      end if;
    else
      if not exists (select 1 from public.legal_blocks lb where lb.page_id = p_id) then
        v_missing := v_missing || jsonb_build_array(jsonb_build_object('locale', null, 'field', 'blocks'));
      end if;
      v_missing := v_missing || coalesce((
        select jsonb_agg(jsonb_build_object('locale', g.locale, 'field', 'blocks.' || (b.idx - 1) || '.text') order by b.idx, g.ord)
        from (select x.id, row_number() over (order by x.position, x.id) as idx
              from public.legal_blocks x where x.page_id = p_id) b
        cross join unnest(array['en', 'ar', 'es']) with ordinality as g(locale, ord)
        left join public.legal_block_translations bt on bt.block_id = b.id and bt.locale = g.locale
        where bt.text is null or btrim(bt.text, E' \t\r\n') = ''
      ), '[]'::jsonb);
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
  if p_entity = 'post' then
    update public.posts po set published_at = now() where po.id = p_id and po.published_at is null;
  end if;
  return jsonb_build_object('ok', true, 'is_published', true, 'missing', '[]'::jsonb, 'warnings', v_warnings);
end;
$$;

revoke execute on function public.ops_publish(text, uuid, boolean) from public, anon, authenticated;
grant execute on function public.ops_publish(text, uuid, boolean) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Lists and details for the screens (contract 5). Money is a decimal string ("1250.00"). MediaRef carries the key:
-- the route adds `url` with mediaUrl().
-- ------------------------------------------------------------------------------------------------------------

-- The slots of one section as the screens need them: [{slot, many, decorative}] in the fixed order.
create or replace function public.page_section_slot_list(p_page text, p_section text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('slot', x.slot, 'many', x.many, 'decorative', x.decorative) order by x.n), '[]'::jsonb)
  from (select s.slot, s.many, s.decorative, row_number() over () as n
        from public.page_section_slots() s
        where s.page = p_page and s.section = p_section and s.slot is not null) x
$$;

revoke execute on function public.page_section_slot_list(text, text) from public, anon, authenticated;
grant execute on function public.page_section_slot_list(text, text) to service_role;

-- The pictures of one section: {slot: [MediaRef + position + is_decorative], ...}.
create or replace function public.page_section_media_refs(p_section uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(x.slot, x.refs), '{}'::jsonb)
  from (
    select sm.slot,
      jsonb_agg(public.catalog_media_ref(sm.media_id) || jsonb_build_object('position', sm.position, 'is_decorative', sm.is_decorative)
        order by sm.position) as refs
    from public.page_section_media sm
    where sm.section_id = p_section
    group by sm.slot
  ) x
$$;

revoke execute on function public.page_section_media_refs(uuid) from public, anon, authenticated;
grant execute on function public.page_section_media_refs(uuid) to service_role;

-- Phase 6 adds page_section (every section of the five pages; one page's sections: ops_list_page), page_item,
-- nav_link, post and legal_page. The branches of 20261005100000 are as they were.
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
  elsif p_entity = 'page_section' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'page', s.page, 'section', s.section,
      'is_shown', s.is_shown, 'video_url', s.video_url,
      'has_video', coalesce(k.has_video, false),
      'translation_state', public.catalog_tr_state('page_section', s.id),
      'updated_at', s.updated_at
    ) order by array_position(array['home', 'about', 'destinations', 'experiences', 'contact'], s.page), k.ord nulls last, s.section), '[]'::jsonb)
    into v_out
    from public.page_sections s
    left join lateral (
      select min(x.ord) as ord, bool_or(x.has_video) as has_video
      from public.page_section_slots() x where x.page = s.page and x.section = s.section
    ) k on true;
  elsif p_entity = 'page_item' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'slug', i.slug, 'section_id', i.section_id, 'page', s.page, 'section', s.section,
      'title_en', (select x.title from public.page_item_translations x where x.item_id = i.id and x.locale = 'en'),
      'is_shown', i.is_shown, 'position', i.position,
      'image', public.catalog_media_ref(i.media_id),
      'translation_state', public.catalog_tr_state('page_item', i.id),
      'updated_at', i.updated_at
    ) order by s.page, s.section, i.position, i.slug), '[]'::jsonb)
    into v_out from public.page_items i join public.page_sections s on s.id = i.section_id;
  elsif p_entity = 'nav_link' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'area', l.area, 'position', l.position, 'is_shown', l.is_shown,
      'link_kind', l.link_kind, 'target', l.target,
      'label_en', (select x.label from public.nav_link_translations x where x.link_id = l.id and x.locale = 'en'),
      'translations', public.catalog_tr_all('nav_link', l.id),
      'translation_state', public.catalog_tr_state('nav_link', l.id),
      'updated_at', l.updated_at
    ) order by l.area, l.position, l.id), '[]'::jsonb)
    into v_out from public.nav_links l;
  elsif p_entity = 'post' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', po.id, 'slug', po.slug,
      'title_en', (select x.title from public.post_translations x where x.post_id = po.id and x.locale = 'en'),
      'published_at', po.published_at, 'is_published', po.is_published,
      'cover', public.catalog_media_ref(po.cover_media_id),
      'block_count', (select count(*) from public.post_blocks b where b.post_id = po.id),
      'translation_state', public.catalog_tr_state('post', po.id),
      'updated_at', po.updated_at
    ) order by po.published_at desc nulls first, po.created_at desc, po.id), '[]'::jsonb)
    into v_out from public.posts po;
  elsif p_entity = 'legal_page' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', l.id, 'kind', l.kind,
      'title_en', (select x.title from public.legal_page_translations x where x.page_id = l.id and x.locale = 'en'),
      'is_published', l.is_published,
      'block_count', (select count(*) from public.legal_blocks b where b.page_id = l.id),
      'translation_state', public.catalog_tr_state('legal_page', l.id),
      'updated_at', l.updated_at
    ) order by array_position(array['privacy', 'terms', 'booking_terms', 'waiver', 'disclaimer', 'cookie_banner'], l.kind)), '[]'::jsonb)
    into v_out from public.legal_pages l;
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

-- The sections of one page, in the fixed code order (06-02, GET /api/ops/pages?page=): {page, sections: [...]}, each
-- section exactly as ops_get('page_section', id) answers it (slots, pictures, video flag, About cards, translations).
create or replace function public.ops_list_page(p_page text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if p_page is null or p_page not in ('home', 'about', 'destinations', 'experiences', 'contact') then
    perform public.catalog_invalid('page');
  end if;
  select coalesce(jsonb_agg(public.ops_get('page_section', s.id) order by k.ord nulls last, s.section), '[]'::jsonb)
  into v_out
  from public.page_sections s
  left join lateral (
    select min(x.ord) as ord
    from public.page_section_slots() x where x.page = s.page and x.section = s.section
  ) k on true
  where s.page = p_page;
  return jsonb_build_object('page', p_page, 'sections', v_out);
end;
$$;

revoke execute on function public.ops_list_page(text) from public, anon, authenticated;
grant execute on function public.ops_list_page(text) to service_role;

-- Phase 6 adds page_section, page_item, nav_link, post (with its blocks and their translations) and legal_page (with
-- its blocks); journey_tier gains legs (with translations) and addon_ids. The other branches are as they were.
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
        'translation_state', public.catalog_tr_state('journey_tier', j.id),
        'legs', coalesce((select jsonb_agg(jsonb_build_object(
            'id', l.id, 'position', l.position, 'destination_id', l.destination_id, 'stay_id', l.stay_id,
            'translations', public.catalog_tr_all('journey_tier_leg', l.id),
            'translation_state', public.catalog_tr_state('journey_tier_leg', l.id)) order by l.position, l.id)
          from public.journey_tier_legs l where l.tier_id = j.id), '[]'::jsonb),
        'addon_ids', coalesce((select jsonb_agg(a.item_id order by a.position, a.item_id)
          from public.journey_tier_addons a where a.tier_id = j.id), '[]'::jsonb))
    into v_out from public.journey_tiers j where j.id = p_id;
  elsif p_entity = 'page_section' then
    select to_jsonb(s) - 'created_at'
      || jsonb_build_object(
        'has_video', coalesce((select bool_or(x.has_video) from public.page_section_slots() x where x.page = s.page and x.section = s.section), false),
        'slots', public.page_section_slot_list(s.page, s.section),
        'media', public.page_section_media_refs(s.id),
        'has_items', public.page_section_has_items(s.page, s.section),
        'items', coalesce((select jsonb_agg(
            to_jsonb(i) - 'is_sample' - 'sample_fields' - 'created_at'
            || jsonb_build_object(
              'image', public.catalog_media_ref(i.media_id),
              'translations', public.catalog_tr_all('page_item', i.id),
              'translation_state', public.catalog_tr_state('page_item', i.id)) order by i.position, i.slug)
          from public.page_items i where i.section_id = s.id), '[]'::jsonb),
        'translations', public.catalog_tr_all('page_section', s.id),
        'translation_state', public.catalog_tr_state('page_section', s.id))
    into v_out from public.page_sections s where s.id = p_id;
  elsif p_entity = 'page_item' then
    select to_jsonb(i) - 'is_sample' - 'sample_fields' - 'created_at'
      || jsonb_build_object(
        'page', s.page, 'section', s.section,
        'image', public.catalog_media_ref(i.media_id),
        'translations', public.catalog_tr_all('page_item', i.id),
        'translation_state', public.catalog_tr_state('page_item', i.id))
    into v_out from public.page_items i join public.page_sections s on s.id = i.section_id where i.id = p_id;
  elsif p_entity = 'nav_link' then
    select to_jsonb(l) - 'created_at'
      || jsonb_build_object(
        'translations', public.catalog_tr_all('nav_link', l.id),
        'translation_state', public.catalog_tr_state('nav_link', l.id))
    into v_out from public.nav_links l where l.id = p_id;
  elsif p_entity = 'post' then
    select to_jsonb(po) - 'is_sample' - 'sample_fields' - 'created_at'
      || jsonb_build_object(
        'cover', public.catalog_media_ref(po.cover_media_id),
        'blocks', coalesce((select jsonb_agg(jsonb_build_object(
            'id', b.id, 'position', b.position, 'kind', b.kind,
            'media_id', b.media_id,
            'image', public.catalog_media_ref(b.media_id),
            'translations', public.catalog_tr_all('post_block', b.id),
            'translation_state', public.catalog_tr_state('post_block', b.id)) order by b.position, b.id)
          from public.post_blocks b where b.post_id = po.id), '[]'::jsonb),
        'translations', public.catalog_tr_all('post', po.id),
        'translation_state', public.catalog_tr_state('post', po.id))
    into v_out from public.posts po where po.id = p_id;
  elsif p_entity = 'legal_page' then
    select to_jsonb(l) - 'created_at'
      || jsonb_build_object(
        'blocks', coalesce((select jsonb_agg(jsonb_build_object(
            'id', b.id, 'position', b.position, 'kind', b.kind,
            'translations', public.catalog_tr_all('legal_block', b.id),
            'translation_state', public.catalog_tr_state('legal_block', b.id)) order by b.position, b.id)
          from public.legal_blocks b where b.page_id = l.id), '[]'::jsonb),
        'translations', public.catalog_tr_all('legal_page', l.id),
        'translation_state', public.catalog_tr_state('legal_page', l.id))
    into v_out from public.legal_pages l where l.id = p_id;
  else
    perform public.catalog_invalid('entity');
  end if;
  return v_out;
end;
$$;

revoke execute on function public.ops_get(text, uuid) from public, anon, authenticated;
grant execute on function public.ops_get(text, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Saves (contract 1.2 semantics: a key absent leaves that column or list alone; a key present, null and [] included,
-- sets it; a list is replaced whole when its key is present). Every save returns {id, affects_site}.
-- ------------------------------------------------------------------------------------------------------------

-- p = {id, is_shown?, video_url?, media?: {<slot>: uuid[]}, translations?} (06-02). The rows exist (import). A media
-- key must be a slot of that section in page_section_slots, a single slot takes at most one id, every id is a photo of
-- the library: else almar:invalid media.<slot>. video_url (https only, <= 500; null or blank clears it) only on a
-- section that takes a video: else almar:invalid video_url. A list keeps its first position (so an unchanged save keeps
-- the published positions); a single slot is at position 0. affects_site is always true (every section is read by a
-- build).
create or replace function public.ops_save_page_section(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_page text;
  v_section text;
  v_video boolean;
  v_url text;
  v_slot text;
  v_spec record;
  v_ids uuid[];
  v_base int;
begin
  if p is null or jsonb_typeof(p) <> 'object' or v_id is null then
    perform public.catalog_invalid('id');
  end if;
  select s.page, s.section into v_page, v_section from public.page_sections s where s.id = v_id for update;
  if not found then
    perform public.catalog_fail('not_found');
  end if;
  v_video := coalesce((select bool_or(x.has_video) from public.page_section_slots() x
    where x.page = v_page and x.section = v_section), false);

  if p ? 'is_shown' and jsonb_typeof(p -> 'is_shown') <> 'boolean' then
    perform public.catalog_invalid('is_shown');
  end if;
  if p ? 'video_url' then
    if not v_video then
      perform public.catalog_invalid('video_url');
    end if;
    if jsonb_typeof(p -> 'video_url') not in ('string', 'null') then
      perform public.catalog_invalid('video_url');
    end if;
    v_url := public.catalog_txt(p, 'video_url');
    if v_url is not null and (char_length(v_url) > 500 or v_url !~ '^https://[^[:space:]]+$') then
      perform public.catalog_invalid('video_url');
    end if;
  end if;
  -- Every slot is checked before anything is written.
  if p ? 'media' then
    if jsonb_typeof(p -> 'media') <> 'object' then
      perform public.catalog_invalid('media');
    end if;
    for v_slot in select k from jsonb_object_keys(p -> 'media') as k loop
      select x.slot, x.many, x.decorative into v_spec from public.page_section_slots() x
      where x.page = v_page and x.section = v_section and x.slot = v_slot;
      if not found then
        perform public.catalog_invalid('media.' || v_slot);
      end if;
      v_ids := public.site_uuid_list(p -> 'media' -> v_slot, 'media.' || v_slot, 50);
      if (not v_spec.many and cardinality(v_ids) > 1)
         or (select count(*) from public.media m where m.id = any (v_ids)) <> cardinality(v_ids) then
        perform public.catalog_invalid('media.' || v_slot);
      end if;
    end loop;
  end if;

  update public.page_sections s set
    is_shown = case when p ? 'is_shown' then (p ->> 'is_shown')::boolean else s.is_shown end,
    video_url = case when p ? 'video_url' then v_url else s.video_url end
  where s.id = v_id;

  if p ? 'media' then
    for v_slot in select k from jsonb_object_keys(p -> 'media') as k loop
      select x.slot, x.many, x.decorative into v_spec from public.page_section_slots() x
      where x.page = v_page and x.section = v_section and x.slot = v_slot;
      v_ids := public.site_uuid_list(p -> 'media' -> v_slot, 'media.' || v_slot, 50);
      v_base := case when v_spec.many
        then coalesce((select min(sm.position) from public.page_section_media sm where sm.section_id = v_id and sm.slot = v_slot), 1)
        else 0 end;
      delete from public.page_section_media sm where sm.section_id = v_id and sm.slot = v_slot;
      insert into public.page_section_media (section_id, slot, position, media_id, is_decorative)
      select v_id, v_slot, v_base + (u.ord - 1)::int, u.id, v_spec.decorative
      from unnest(v_ids) with ordinality as u(id, ord);
    end loop;
  end if;

  perform public.catalog_save_translations('page_section', v_id, p -> 'translations', false);
  return jsonb_build_object('id', v_id, 'affects_site', true);
end;
$$;

revoke execute on function public.ops_save_page_section(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_page_section(jsonb) to service_role;

-- p = {id?, section_id?, slug?, media_id?, is_shown?, translations?} (06-02): an About card. Create (no id) needs the
-- slug, a section that holds cards (about story or values) and the English title; it goes to the end of its section
-- and is hidden unless is_shown is sent. Delete and reorder: ops_delete / ops_reorder('page_item', ...).
create or replace function public.ops_save_page_item(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_create boolean := nullif(p ->> 'id', '') is null;
  v_section uuid;
  v_old_section uuid;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('item');
  end if;
  if p ? 'media_id' then
    perform public.catalog_need_media((p ->> 'media_id')::uuid, 'media_id');
  end if;
  if p ? 'is_shown' and jsonb_typeof(p -> 'is_shown') <> 'boolean' then
    perform public.catalog_invalid('is_shown');
  end if;
  if p ? 'section_id' then
    v_section := nullif(p ->> 'section_id', '')::uuid;
    if v_section is null or not exists (
      select 1 from public.page_sections s where s.id = v_section and public.page_section_has_items(s.page, s.section)
    ) then
      perform public.catalog_invalid('section_id');
    end if;
  end if;

  if v_create then
    if public.catalog_txt(p, 'slug') is null then
      perform public.catalog_invalid('slug');
    end if;
    if v_section is null then
      perform public.catalog_invalid('section_id');
    end if;
    insert into public.page_items (section_id, slug, media_id, is_shown, position)
    values (
      v_section, public.catalog_txt(p, 'slug'), (p ->> 'media_id')::uuid, coalesce((p ->> 'is_shown')::boolean, false),
      coalesce((select max(i.position) from public.page_items i where i.section_id = v_section), 0) + 1
    )
    returning id into v_id;
  else
    select i.section_id into v_old_section from public.page_items i where i.id = v_id for update;
    if not found then
      perform public.catalog_fail('not_found');
    end if;
    update public.page_items i set
      section_id = case when p ? 'section_id' then v_section else i.section_id end,
      position = case when p ? 'section_id' and v_section <> v_old_section
        then coalesce((select max(x.position) from public.page_items x where x.section_id = v_section), 0) + 1
        else i.position end,
      slug = case when p ? 'slug' then public.catalog_txt(p, 'slug') else i.slug end,
      media_id = case when p ? 'media_id' then (p ->> 'media_id')::uuid else i.media_id end,
      is_shown = case when p ? 'is_shown' then (p ->> 'is_shown')::boolean else i.is_shown end
    where i.id = v_id;
  end if;

  perform public.catalog_save_translations('page_item', v_id, p -> 'translations', v_create);
  return jsonb_build_object('id', v_id, 'affects_site', true);
end;
$$;

revoke execute on function public.ops_save_page_item(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_page_item(jsonb) to service_role;

-- Replaces one area's links in one go (06-02, CMS-09). p_links = [{id?, link_kind, target, is_shown?, translations?}]
-- (at most 20), in the order shown: a link with an id of this area is updated, one without an id is created (English
-- label required), and every other link of the area is deleted. Login is never a row (it is fixed in code, always last).
-- Returns {area, ids (in order), affects_site: true}.
create or replace function public.ops_save_nav(p_area text, p_links jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_ord bigint;
  v_lid uuid;
  v_kind text;
  v_target text;
  v_keep uuid[] := '{}'::uuid[];
  v_ids uuid[] := '{}'::uuid[];
  v_path text;
begin
  if p_area is null or p_area not in ('header', 'footer') then
    perform public.catalog_invalid('area');
  end if;
  if p_links is null or jsonb_typeof(p_links) <> 'array' or jsonb_array_length(p_links) > 20 then
    perform public.catalog_invalid('links');
  end if;
  -- Every link is checked before anything is written.
  for v_item, v_ord in select e.value, e.ord from jsonb_array_elements(p_links) with ordinality as e(value, ord) loop
    v_path := 'links.' || (v_ord - 1);
    if jsonb_typeof(v_item) <> 'object' then
      perform public.catalog_invalid(v_path);
    end if;
    v_lid := nullif(v_item ->> 'id', '')::uuid;
    if v_lid is not null then
      if v_lid = any (v_keep) or not exists (select 1 from public.nav_links l where l.id = v_lid and l.area = p_area) then
        perform public.catalog_invalid(v_path || '.id');
      end if;
      v_keep := v_keep || v_lid;
    end if;
    v_kind := public.catalog_txt(v_item, 'link_kind');
    v_target := public.catalog_txt(v_item, 'target');
    if v_kind is null or v_kind not in ('internal', 'external') then
      perform public.catalog_invalid(v_path || '.link_kind');
    end if;
    if v_target is null or lower(v_target) = 'login'
       or (v_kind = 'internal' and (char_length(v_target) > 120
           or v_target !~ '^[a-z0-9]+(-[a-z0-9]+)*(:[a-z0-9]+(-[a-z0-9]+)*)?$'))
       or (v_kind = 'external' and (char_length(v_target) > 500 or v_target !~ '^https://[^[:space:]]+$')) then
      perform public.catalog_invalid(v_path || '.target');
    end if;
    if v_item ? 'is_shown' and jsonb_typeof(v_item -> 'is_shown') <> 'boolean' then
      perform public.catalog_invalid(v_path || '.is_shown');
    end if;
  end loop;

  delete from public.nav_links l where l.area = p_area and l.id <> all (v_keep);

  for v_item, v_ord in select e.value, e.ord from jsonb_array_elements(p_links) with ordinality as e(value, ord) loop
    v_lid := nullif(v_item ->> 'id', '')::uuid;
    if v_lid is null then
      insert into public.nav_links (area, position, is_shown, link_kind, target)
      values (p_area, v_ord::int, coalesce((v_item ->> 'is_shown')::boolean, true),
        public.catalog_txt(v_item, 'link_kind'), public.catalog_txt(v_item, 'target'))
      returning id into v_lid;
      perform public.catalog_save_translations('nav_link', v_lid, v_item -> 'translations', true);
    else
      update public.nav_links l set
        position = v_ord::int,
        link_kind = public.catalog_txt(v_item, 'link_kind'),
        target = public.catalog_txt(v_item, 'target'),
        is_shown = case when v_item ? 'is_shown' then (v_item ->> 'is_shown')::boolean else l.is_shown end
      where l.id = v_lid;
      perform public.catalog_save_translations('nav_link', v_lid, v_item -> 'translations', false);
    end if;
    v_ids := v_ids || v_lid;
  end loop;

  return jsonb_build_object('area', p_area, 'ids', to_jsonb(v_ids), 'affects_site', true);
end;
$$;

revoke execute on function public.ops_save_nav(text, jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_nav(text, jsonb) to service_role;

-- p = {id?, slug?, cover_media_id?, published_at?, destination_id?, featured_stay_id?, featured_experience_id?,
-- blocks?: [{kind, media_id?, translations?}], translations?} (06-03, F-08). Create (no id) needs the slug and the
-- English title and excerpt. A published post keeps its slug, its cover and its date. blocks (at most 100) is
-- replaced whole when present, in the order given: heading / paragraph / quote carry translations (English text
-- required) and no media_id; a photo carries a media_id and no translations. Refusals name blocks.<index>.<field>.
create or replace function public.ops_save_post(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_create boolean := nullif(p ->> 'id', '') is null;
  v_pub boolean;
  v_slug text;
  v_blocks jsonb;
  v_b jsonb;
  v_ord bigint;
  v_kind text;
  v_media uuid;
  v_bid uuid;
  v_path text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('item');
  end if;
  if p ? 'cover_media_id' then
    perform public.catalog_need_media((p ->> 'cover_media_id')::uuid, 'cover_media_id');
  end if;
  if nullif(p ->> 'destination_id', '') is not null
     and not exists (select 1 from public.destinations d where d.id = (p ->> 'destination_id')::uuid) then
    perform public.catalog_invalid('destination_id');
  end if;
  if nullif(p ->> 'featured_stay_id', '') is not null
     and not exists (select 1 from public.stays s where s.id = (p ->> 'featured_stay_id')::uuid) then
    perform public.catalog_invalid('featured_stay_id');
  end if;
  if nullif(p ->> 'featured_experience_id', '') is not null
     and not exists (select 1 from public.catalog_items c where c.id = (p ->> 'featured_experience_id')::uuid and c.kind = 'experience') then
    perform public.catalog_invalid('featured_experience_id');
  end if;
  -- Blocks are checked before anything is written.
  if p ? 'blocks' then
    v_blocks := coalesce(nullif(p -> 'blocks', 'null'::jsonb), '[]'::jsonb);
    if jsonb_typeof(v_blocks) <> 'array' or jsonb_array_length(v_blocks) > 100 then
      perform public.catalog_invalid('blocks');
    end if;
    for v_b, v_ord in select e.value, e.ord from jsonb_array_elements(v_blocks) with ordinality as e(value, ord) loop
      v_path := 'blocks.' || (v_ord - 1);
      if jsonb_typeof(v_b) <> 'object' then
        perform public.catalog_invalid(v_path);
      end if;
      v_kind := public.catalog_txt(v_b, 'kind');
      if v_kind is null or v_kind not in ('heading', 'paragraph', 'photo', 'quote') then
        perform public.catalog_invalid(v_path || '.kind');
      end if;
      v_media := nullif(v_b ->> 'media_id', '')::uuid;
      if v_kind = 'photo' then
        if v_media is null or not exists (select 1 from public.media m where m.id = v_media) then
          perform public.catalog_invalid(v_path || '.media_id');
        end if;
        if v_b ? 'translations' and jsonb_typeof(v_b -> 'translations') <> 'null' then
          perform public.catalog_invalid(v_path || '.translations');
        end if;
      elsif v_media is not null then
        perform public.catalog_invalid(v_path || '.media_id');
      elsif jsonb_typeof(v_b -> 'translations' -> 'en') is distinct from 'object'
         or public.catalog_txt(v_b -> 'translations' -> 'en', 'text') is null then
        perform public.catalog_invalid(v_path || '.translations.en.text', 'en');
      end if;
    end loop;
  end if;

  if v_create then
    if public.catalog_txt(p, 'slug') is null then
      perform public.catalog_invalid('slug');
    end if;
    insert into public.posts (slug, cover_media_id, published_at, destination_id, featured_stay_id, featured_experience_id)
    values (
      public.catalog_txt(p, 'slug'), (p ->> 'cover_media_id')::uuid, nullif(p ->> 'published_at', '')::timestamptz,
      nullif(p ->> 'destination_id', '')::uuid, nullif(p ->> 'featured_stay_id', '')::uuid,
      nullif(p ->> 'featured_experience_id', '')::uuid
    )
    returning id into v_id;
  else
    select po.is_published, po.slug into v_pub, v_slug from public.posts po where po.id = v_id for update;
    if not found then
      perform public.catalog_fail('not_found');
    end if;
    if v_pub and p ? 'slug' and public.catalog_txt(p, 'slug') is distinct from v_slug then
      perform public.catalog_invalid('slug');
    end if;
    update public.posts po set
      slug = case when p ? 'slug' then public.catalog_txt(p, 'slug') else po.slug end,
      cover_media_id = case when p ? 'cover_media_id' then (p ->> 'cover_media_id')::uuid else po.cover_media_id end,
      published_at = case when p ? 'published_at' then nullif(p ->> 'published_at', '')::timestamptz else po.published_at end,
      destination_id = case when p ? 'destination_id' then nullif(p ->> 'destination_id', '')::uuid else po.destination_id end,
      featured_stay_id = case when p ? 'featured_stay_id' then nullif(p ->> 'featured_stay_id', '')::uuid else po.featured_stay_id end,
      featured_experience_id = case when p ? 'featured_experience_id' then nullif(p ->> 'featured_experience_id', '')::uuid else po.featured_experience_id end
    where po.id = v_id;
  end if;

  perform public.catalog_save_translations('post', v_id, p -> 'translations', v_create);

  if p ? 'blocks' then
    delete from public.post_blocks b where b.post_id = v_id;
    for v_b, v_ord in select e.value, e.ord from jsonb_array_elements(v_blocks) with ordinality as e(value, ord) loop
      v_kind := public.catalog_txt(v_b, 'kind');
      insert into public.post_blocks (post_id, position, kind, media_id)
      values (v_id, v_ord::int, v_kind, case when v_kind = 'photo' then (v_b ->> 'media_id')::uuid end)
      returning id into v_bid;
      if v_kind <> 'photo' then
        perform public.catalog_save_translations('post_block', v_bid, v_b -> 'translations', true);
      end if;
    end loop;
  end if;

  select po.is_published into v_pub from public.posts po where po.id = v_id;
  -- A published post keeps what ops_publish required of it (its cover) and the date it is shown with.
  if v_pub and (select po.cover_media_id from public.posts po where po.id = v_id) is null then
    perform public.catalog_invalid('cover_media_id');
  end if;
  if v_pub and (select po.published_at from public.posts po where po.id = v_id) is null then
    perform public.catalog_invalid('published_at');
  end if;
  return jsonb_build_object('id', v_id, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_post(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_post(jsonb) to service_role;

-- p = {kind, translations?, blocks?: [{kind, translations}]} (06-04, F-07). The six rows exist. The banner columns
-- (necessary_*, analytics_*) are refused on every kind but cookie_banner, and the banner takes no blocks. blocks (at
-- most 300) is replaced whole when present: heading / paragraph / quote with the English text required. A published
-- page keeps at least one block; a published banner keeps its English labels. Nothing is written by us (F-07).
create or replace function public.ops_save_legal_page(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_kind text := public.catalog_txt(p, 'kind');
  v_id uuid;
  v_pub boolean;
  v_loc text;
  v_col text;
  v_blocks jsonb;
  v_b jsonb;
  v_ord bigint;
  v_bkind text;
  v_bid uuid;
  v_path text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('item');
  end if;
  if v_kind is null or v_kind not in ('privacy', 'terms', 'booking_terms', 'waiver', 'disclaimer', 'cookie_banner') then
    perform public.catalog_invalid('kind');
  end if;
  select l.id, l.is_published into v_id, v_pub from public.legal_pages l where l.kind = v_kind for update;
  if not found then
    perform public.catalog_fail('not_found');
  end if;

  if v_kind <> 'cookie_banner' and jsonb_typeof(p -> 'translations') = 'object' then
    for v_loc in select k from jsonb_object_keys(p -> 'translations') as k loop
      if jsonb_typeof(p -> 'translations' -> v_loc) = 'object' then
        foreach v_col in array array['necessary_label', 'necessary_body', 'analytics_label', 'analytics_body'] loop
          if (p -> 'translations' -> v_loc) ? v_col
             or coalesce((p -> 'translations' -> v_loc -> 'locked_fields') ? v_col, false) then
            perform public.catalog_invalid('translations.' || v_loc || '.' || v_col, v_loc);
          end if;
        end loop;
      end if;
    end loop;
  end if;
  if p ? 'blocks' then
    if v_kind = 'cookie_banner' then
      perform public.catalog_invalid('blocks');
    end if;
    v_blocks := coalesce(nullif(p -> 'blocks', 'null'::jsonb), '[]'::jsonb);
    if jsonb_typeof(v_blocks) <> 'array' or jsonb_array_length(v_blocks) > 300 then
      perform public.catalog_invalid('blocks');
    end if;
    for v_b, v_ord in select e.value, e.ord from jsonb_array_elements(v_blocks) with ordinality as e(value, ord) loop
      v_path := 'blocks.' || (v_ord - 1);
      if jsonb_typeof(v_b) <> 'object' then
        perform public.catalog_invalid(v_path);
      end if;
      v_bkind := public.catalog_txt(v_b, 'kind');
      if v_bkind is null or v_bkind not in ('heading', 'paragraph', 'quote') then
        perform public.catalog_invalid(v_path || '.kind');
      end if;
      if jsonb_typeof(v_b -> 'translations' -> 'en') is distinct from 'object'
         or public.catalog_txt(v_b -> 'translations' -> 'en', 'text') is null then
        perform public.catalog_invalid(v_path || '.translations.en.text', 'en');
      end if;
    end loop;
  end if;

  perform public.catalog_save_translations('legal_page', v_id, p -> 'translations', false);

  if p ? 'blocks' then
    delete from public.legal_blocks b where b.page_id = v_id;
    for v_b, v_ord in select e.value, e.ord from jsonb_array_elements(v_blocks) with ordinality as e(value, ord) loop
      insert into public.legal_blocks (page_id, position, kind)
      values (v_id, v_ord::int, public.catalog_txt(v_b, 'kind'))
      returning id into v_bid;
      perform public.catalog_save_translations('legal_block', v_bid, v_b -> 'translations', true);
    end loop;
  end if;

  if v_pub and v_kind <> 'cookie_banner' and not exists (select 1 from public.legal_blocks b where b.page_id = v_id) then
    perform public.catalog_invalid('blocks');
  end if;
  if v_pub and v_kind = 'cookie_banner' then
    if public.catalog_blank(public.catalog_tr_json('legal_page', v_id, 'en') -> 'necessary_label') then
      perform public.catalog_invalid('translations.en.necessary_label', 'en');
    end if;
    if public.catalog_blank(public.catalog_tr_json('legal_page', v_id, 'en') -> 'analytics_label') then
      perform public.catalog_invalid('translations.en.analytics_label', 'en');
    end if;
  end if;
  return jsonb_build_object('id', v_id, 'kind', v_kind, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_legal_page(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_legal_page(jsonb) to service_role;

-- Packages (06-06, F-02). The update of 20261005100000 is kept as it was; Phase 6 adds:
--   * create (no id): slug required (the stay slug rule), the English name and price label required; it goes to the
--     end of the list, unpublished. A published tier keeps its slug (like stays); an unpublished one may change it.
--   * legs? = [{destination_id, stay_id?, translations?}] (at most 12), replaced whole when present, in the order given;
--     a leg's stay belongs to its destination.
--   * addon_ids? = uuid[] (at most 30), replaced whole when present: catalog items, never the home pickup.
-- The structured prices come from the route, which parses them from the English price_label; they are set only when
-- their keys are present.
create or replace function public.ops_save_journey_tier(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_create boolean := nullif(p ->> 'id', '') is null;
  v_pub boolean;
  v_slug text;
  v_legs jsonb;
  v_leg jsonb;
  v_ord bigint;
  v_dest uuid;
  v_stay uuid;
  v_leg_id uuid;
  v_ids uuid[];
  v_path text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('id');
  end if;
  if p ? 'media_id' then
    perform public.catalog_need_media((p ->> 'media_id')::uuid, 'media_id');
  end if;
  -- Legs and add-ons are checked before anything is written.
  if p ? 'legs' then
    v_legs := coalesce(nullif(p -> 'legs', 'null'::jsonb), '[]'::jsonb);
    if jsonb_typeof(v_legs) <> 'array' or jsonb_array_length(v_legs) > 12 then
      perform public.catalog_invalid('legs');
    end if;
    for v_leg, v_ord in select e.value, e.ord from jsonb_array_elements(v_legs) with ordinality as e(value, ord) loop
      v_path := 'legs.' || (v_ord - 1);
      if jsonb_typeof(v_leg) <> 'object' then
        perform public.catalog_invalid(v_path);
      end if;
      v_dest := nullif(v_leg ->> 'destination_id', '')::uuid;
      if v_dest is null or not exists (select 1 from public.destinations d where d.id = v_dest) then
        perform public.catalog_invalid(v_path || '.destination_id');
      end if;
      v_stay := nullif(v_leg ->> 'stay_id', '')::uuid;
      if v_stay is not null and not exists (select 1 from public.stays s where s.id = v_stay and s.destination_id = v_dest) then
        perform public.catalog_invalid(v_path || '.stay_id');
      end if;
    end loop;
  end if;
  if p ? 'addon_ids' then
    v_ids := public.site_uuid_list(p -> 'addon_ids', 'addon_ids', 30);
    if (select count(*) from public.catalog_items c where c.id = any (v_ids) and not c.is_home_pickup) <> cardinality(v_ids) then
      perform public.catalog_invalid('addon_ids');
    end if;
  end if;

  if v_create then
    if public.catalog_txt(p, 'slug') is null then
      perform public.catalog_invalid('slug');
    end if;
    insert into public.journey_tiers (slug, is_featured, media_id, price_from_amount, price_from_currency, est_low, est_high,
      est_open_ended, position)
    values (
      public.catalog_txt(p, 'slug'), coalesce((p ->> 'is_featured')::boolean, false), (p ->> 'media_id')::uuid,
      (p ->> 'price_from_amount')::numeric, public.catalog_txt(p, 'price_from_currency'),
      (p ->> 'est_low')::numeric, (p ->> 'est_high')::numeric, (p ->> 'est_open_ended')::boolean,
      coalesce((select max(j.position) from public.journey_tiers j), 0) + 1
    )
    returning id into v_id;
  else
    select j.is_published, j.slug into v_pub, v_slug from public.journey_tiers j where j.id = v_id for update;
    if not found then
      perform public.catalog_fail('not_found');
    end if;
    if v_pub and p ? 'slug' and public.catalog_txt(p, 'slug') is distinct from v_slug then
      perform public.catalog_invalid('slug');
    end if;
    update public.journey_tiers j set
      slug = case when p ? 'slug' then public.catalog_txt(p, 'slug') else j.slug end,
      is_featured = case when p ? 'is_featured' then (p ->> 'is_featured')::boolean else j.is_featured end,
      media_id = case when p ? 'media_id' then (p ->> 'media_id')::uuid else j.media_id end,
      price_from_amount = case when p ? 'price_from_amount' then (p ->> 'price_from_amount')::numeric else j.price_from_amount end,
      price_from_currency = case when p ? 'price_from_currency' then public.catalog_txt(p, 'price_from_currency') else j.price_from_currency end,
      est_low = case when p ? 'est_low' then (p ->> 'est_low')::numeric else j.est_low end,
      est_high = case when p ? 'est_high' then (p ->> 'est_high')::numeric else j.est_high end,
      est_open_ended = case when p ? 'est_open_ended' then (p ->> 'est_open_ended')::boolean else j.est_open_ended end
    where j.id = v_id;
  end if;
  perform public.catalog_save_translations('journey_tier', v_id, p -> 'translations', v_create);

  if p ? 'legs' then
    delete from public.journey_tier_legs l where l.tier_id = v_id;
    for v_leg, v_ord in select e.value, e.ord from jsonb_array_elements(v_legs) with ordinality as e(value, ord) loop
      insert into public.journey_tier_legs (tier_id, position, destination_id, stay_id)
      values (v_id, v_ord::int, (v_leg ->> 'destination_id')::uuid, nullif(v_leg ->> 'stay_id', '')::uuid)
      returning id into v_leg_id;
      perform public.catalog_save_translations('journey_tier_leg', v_leg_id, v_leg -> 'translations', false);
    end loop;
  end if;
  if p ? 'addon_ids' then
    delete from public.journey_tier_addons a where a.tier_id = v_id;
    insert into public.journey_tier_addons (tier_id, item_id, position)
    select v_id, u.id, u.ord::int from unnest(v_ids) with ordinality as u(id, ord);
  end if;

  select j.is_published into v_pub from public.journey_tiers j where j.id = v_id;
  return jsonb_build_object('id', v_id, 'affects_site', v_pub);
end;
$$;

revoke execute on function public.ops_save_journey_tier(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_journey_tier(jsonb) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Requests (06-05, 06-06). Written by the public Worker `almar` with the service role, after its honeypot and rate
-- limit; never callable by anon or authenticated. Definer rights (as the Phase 4 guest functions), search_path ''.
-- ------------------------------------------------------------------------------------------------------------

-- p_kind plan | list | package (a consultation goes through book_consultation). The payload is checked per kind
-- (site_request_payload_ok, also the table check); name and email are copied out (trimmed; email lower-case).
-- A package request names a published package: otherwise almar:invalid tier_slug, before anything is written.
-- Returns {id}.
create or replace function public.submit_site_request(p_kind text, p_locale text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_kind is null or p_kind not in ('plan', 'list', 'package') then
    perform public.catalog_invalid('kind');
  end if;
  if p_locale is null or p_locale not in ('en', 'ar', 'es') then
    perform public.catalog_invalid('locale');
  end if;
  if p_kind = 'package' and not exists (
    select 1 from public.journey_tiers j where j.slug = p_payload ->> 'tier_slug' and j.is_published
  ) then
    perform public.catalog_invalid('tier_slug');
  end if;
  if not public.site_request_payload_ok(p_kind, p_payload) then
    perform public.catalog_invalid('payload');
  end if;
  insert into public.site_requests (kind, locale, name, email, payload)
  values (p_kind, p_locale, btrim(p_payload ->> 'name', E' \t\r\n'), lower(p_payload ->> 'email'), p_payload)
  returning id into v_id;
  return jsonb_build_object('id', v_id);
end;
$$;

revoke execute on function public.submit_site_request(text, text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_site_request(text, text, jsonb) to service_role;

-- The owner's Requests list (06-05): p_kind null = every kind; p_handled null = both. Newest first, at most 500.
-- A consultation carries its booking (slot and status).
create or replace function public.ops_list_requests(p_kind text, p_handled boolean)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  if p_kind is not null and p_kind not in ('plan', 'list', 'package', 'consultation') then
    perform public.catalog_invalid('kind');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'kind', r.kind, 'locale', r.locale, 'name', r.name, 'email', r.email, 'payload', r.payload,
    'created_at', to_char(r.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'handled_at', to_char(r.handled_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'handled_by', r.handled_by,
    'consultation', (
      select jsonb_build_object('booking_id', b.id, 'status', b.status,
        'slot_start', to_char(b.slot_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      from public.consult_bookings b where b.request_id = r.id
      order by b.created_at desc limit 1)
  ) order by r.created_at desc, r.id), '[]'::jsonb)
  into v_out
  from (
    select x.* from public.site_requests x
    where (p_kind is null or x.kind = p_kind)
      and (p_handled is null or (x.handled_at is not null) = p_handled)
    order by x.created_at desc, x.id
    limit 500
  ) r;
  return v_out;
end;
$$;

revoke execute on function public.ops_list_requests(text, boolean) from public, anon, authenticated;
grant execute on function public.ops_list_requests(text, boolean) to service_role;

-- Handled on / off (T-06-08: who and when). p_actor must be an owner (public.booking_assert_owner, 20261019160000).
create or replace function public.ops_set_request_handled(p_id uuid, p_handled boolean, p_actor uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_at timestamptz;
  v_by uuid;
begin
  perform public.booking_assert_owner(p_actor);
  if p_handled is null then
    perform public.catalog_invalid('handled');
  end if;
  update public.site_requests r set
    handled_at = case when p_handled then coalesce(r.handled_at, now()) end,
    handled_by = case when p_handled then coalesce(r.handled_by, p_actor) end
  where r.id = p_id
  returning r.handled_at, r.handled_by into v_at, v_by;
  if not found then
    perform public.catalog_fail('not_found');
  end if;
  return jsonb_build_object('id', p_id,
    'handled_at', to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'handled_by', v_by, 'affects_site', false);
end;
$$;

revoke execute on function public.ops_set_request_handled(uuid, boolean, uuid) from public, anon, authenticated;
grant execute on function public.ops_set_request_handled(uuid, boolean, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Consultation (06-05, SITE-06, F-04). Hours and days off are Asia/Dubai (UTC+4, no daylight saving); slots are 30
-- minutes. Closed while notice_hours or horizon_days is null.
-- ------------------------------------------------------------------------------------------------------------

-- Why a slot cannot be booked at p_now, or null when it can, in the order book_consultation refuses: consult_closed
-- (settings unset), slot_outside_hours (not on a 30-minute boundary, outside a weekly range of its Dubai weekday, or on
-- a day off), slot_too_soon (before p_now + notice), slot_too_far (after p_now + horizon), slot_taken (a booked row on
-- that start). consult_slots and book_consultation both use it, so they always agree.
create or replace function public.consult_slot_refusal(p_slot timestamptz, p_now timestamptz)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  c record;
  v_local timestamp := p_slot at time zone 'Asia/Dubai';
  v_min int;
begin
  select s.notice_hours, s.horizon_days, s.slot_minutes into c from public.consult_settings s where s.id = 1;
  if not found or c.notice_hours is null or c.horizon_days is null then
    return 'consult_closed';
  end if;
  v_min := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;
  if p_slot is null
     or extract(epoch from p_slot) % (c.slot_minutes * 60) <> 0
     or exists (select 1 from public.consult_days_off o where o.day = v_local::date)
     or not exists (
       select 1 from public.consult_hours h
       where h.weekday = extract(isodow from v_local)::int
         and (extract(hour from h.starts) * 60 + extract(minute from h.starts))::int <= v_min
         and v_min + c.slot_minutes <= (extract(hour from h.ends) * 60 + extract(minute from h.ends))::int
     ) then
    return 'slot_outside_hours';
  end if;
  if p_slot < p_now + make_interval(hours => c.notice_hours) then
    return 'slot_too_soon';
  end if;
  if p_slot > p_now + make_interval(days => c.horizon_days) then
    return 'slot_too_far';
  end if;
  if exists (select 1 from public.consult_bookings b where b.slot_start = p_slot and b.status = 'booked') then
    return 'slot_taken';
  end if;
  return null;
end;
$$;

revoke execute on function public.consult_slot_refusal(timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.consult_slot_refusal(timestamptz, timestamptz) to service_role;

-- The free starts between two Dubai dates (both included, at most 62 days apart), exactly those book_consultation
-- would accept at p_now. Empty while the calendar is closed.
create or replace function public.consult_slots(p_from date, p_to date, p_now timestamptz default now())
returns table (slot_start timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_step int;
begin
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 62 then
    perform public.catalog_invalid('range');
  end if;
  select s.slot_minutes into v_step from public.consult_settings s
  where s.id = 1 and s.notice_hours is not null and s.horizon_days is not null;
  if v_step is null then
    return;
  end if;
  return query
    select x.s
    from (
      select (g.d + make_interval(mins => m.n)) at time zone 'Asia/Dubai' as s
      from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') as g(d)
      join public.consult_hours h on h.weekday = extract(isodow from g.d)::int
      cross join lateral generate_series(
        (extract(hour from h.starts) * 60 + extract(minute from h.starts))::int,
        (extract(hour from h.ends) * 60 + extract(minute from h.ends))::int - v_step,
        v_step) as m(n)
    ) x
    where public.consult_slot_refusal(x.s, p_now) is null
    order by x.s;
end;
$$;

revoke execute on function public.consult_slots(date, date, timestamptz) from public, anon, authenticated;
grant execute on function public.consult_slots(date, date, timestamptz) to service_role;

-- Books one slot (T-06-03): the payload is a consultation request (slot_start, time_zone, name, email, phone?,
-- notes?); an advisory lock on the slot's epoch serialises two guests on the same start; then the refusals of
-- consult_slot_refusal at now(); then the request and the booking in this transaction (a unique violation from the
-- partial index is slot_taken too). Returns {request_id, booking_id, slot_start (ISO UTC)}.
create or replace function public.book_consultation(p_locale text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slot timestamptz;
  v_code text;
  v_request uuid;
  v_booking uuid;
begin
  if p_locale is null or p_locale not in ('en', 'ar', 'es') then
    perform public.catalog_invalid('locale');
  end if;
  if not public.site_request_payload_ok('consultation', p_payload) then
    perform public.catalog_invalid('payload');
  end if;
  v_slot := (p_payload ->> 'slot_start')::timestamptz;
  perform pg_advisory_xact_lock(hashtextextended('almar-consult:' || floor(extract(epoch from v_slot))::bigint::text, 0));
  v_code := public.consult_slot_refusal(v_slot, now());
  if v_code is not null then
    perform public.catalog_fail(v_code);
  end if;
  begin
    insert into public.site_requests (kind, locale, name, email, payload)
    values ('consultation', p_locale, btrim(p_payload ->> 'name', E' \t\r\n'), lower(p_payload ->> 'email'), p_payload)
    returning id into v_request;
    insert into public.consult_bookings (slot_start, request_id)
    values (v_slot, v_request)
    returning id into v_booking;
  exception when unique_violation then
    perform public.catalog_fail('slot_taken');
  end;
  return jsonb_build_object('request_id', v_request, 'booking_id', v_booking,
    'slot_start', to_char(v_slot at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end;
$$;

revoke execute on function public.book_consultation(text, jsonb) from public, anon, authenticated;
grant execute on function public.book_consultation(text, jsonb) to service_role;

-- The owner's consultation setup (06-05): weekly hours, days off, notice, horizon, and the upcoming bookings.
create or replace function public.ops_get_consult()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'notice_hours', s.notice_hours,
    'horizon_days', s.horizon_days,
    'slot_minutes', s.slot_minutes,
    'open', s.notice_hours is not null and s.horizon_days is not null,
    'hours', coalesce((select jsonb_agg(jsonb_build_object(
        'id', h.id, 'weekday', h.weekday, 'starts', to_char(h.starts, 'HH24:MI'), 'ends', to_char(h.ends, 'HH24:MI'))
        order by h.weekday, h.starts)
      from public.consult_hours h), '[]'::jsonb),
    'days_off', coalesce((select jsonb_agg(to_char(o.day, 'YYYY-MM-DD') order by o.day) from public.consult_days_off o), '[]'::jsonb),
    'upcoming', coalesce((select jsonb_agg(jsonb_build_object(
        'booking_id', b.id, 'request_id', b.request_id,
        'slot_start', to_char(b.slot_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'name', r.name, 'email', r.email, 'locale', r.locale, 'time_zone', r.payload ->> 'time_zone')
        order by b.slot_start)
      from public.consult_bookings b join public.site_requests r on r.id = b.request_id
      where b.status = 'booked'
        and b.slot_start >= (date_trunc('day', now() at time zone 'Asia/Dubai') at time zone 'Asia/Dubai')), '[]'::jsonb)
  )
  from public.consult_settings s
  where s.id = 1
$$;

revoke execute on function public.ops_get_consult() from public, anon, authenticated;
grant execute on function public.ops_get_consult() to service_role;

-- p = {hours?: [{weekday 1..7, starts 'HH:MM', ends 'HH:MM'}] (replaced whole; :00 or :30; ends may be 24:00; no
-- overlap within a weekday), days_off?: ['YYYY-MM-DD'] (replaced whole), notice_hours? (null or 0..720),
-- horizon_days? (null or 1..365)}. Returns ops_get_consult(). Nothing here is read by a build.
create or replace function public.ops_save_consult(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_item jsonb;
  v_ord bigint;
  v_path text;
  v_n numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object'
     or exists (select 1 from jsonb_object_keys(p) as k where k not in ('hours', 'days_off', 'notice_hours', 'horizon_days')) then
    perform public.catalog_invalid('consult');
  end if;
  if p ? 'notice_hours' and jsonb_typeof(p -> 'notice_hours') <> 'null' then
    if jsonb_typeof(p -> 'notice_hours') <> 'number' then
      perform public.catalog_invalid('notice_hours');
    end if;
    v_n := (p ->> 'notice_hours')::numeric;
    if v_n <> trunc(v_n) or v_n < 0 or v_n > 720 then
      perform public.catalog_invalid('notice_hours');
    end if;
  end if;
  if p ? 'horizon_days' and jsonb_typeof(p -> 'horizon_days') <> 'null' then
    if jsonb_typeof(p -> 'horizon_days') <> 'number' then
      perform public.catalog_invalid('horizon_days');
    end if;
    v_n := (p ->> 'horizon_days')::numeric;
    if v_n <> trunc(v_n) or v_n < 1 or v_n > 365 then
      perform public.catalog_invalid('horizon_days');
    end if;
  end if;

  if p ? 'hours' then
    if jsonb_typeof(p -> 'hours') <> 'array' or jsonb_array_length(p -> 'hours') > 70 then
      perform public.catalog_invalid('hours');
    end if;
    for v_item, v_ord in select e.value, e.ord from jsonb_array_elements(p -> 'hours') with ordinality as e(value, ord) loop
      v_path := 'hours.' || (v_ord - 1);
      if jsonb_typeof(v_item) <> 'object'
         or jsonb_typeof(v_item -> 'weekday') is distinct from 'number'
         or (v_item ->> 'weekday') !~ '^[1-7]$'
         or coalesce(v_item ->> 'starts', '') !~ '^([01][0-9]|2[0-3]):(00|30)$'
         or coalesce(v_item ->> 'ends', '') !~ '^(([01][0-9]|2[0-3]):(00|30)|24:00)$'
         or (v_item ->> 'starts')::time >= (v_item ->> 'ends')::time then
        perform public.catalog_invalid(v_path);
      end if;
    end loop;
    delete from public.consult_hours h where h.id is not null;
    begin
      insert into public.consult_hours (weekday, starts, ends)
      select (e.value ->> 'weekday')::int, (e.value ->> 'starts')::time, (e.value ->> 'ends')::time
      from jsonb_array_elements(p -> 'hours') as e;
    exception when exclusion_violation then
      perform public.catalog_invalid('hours');
    end;
  end if;

  if p ? 'days_off' then
    if jsonb_typeof(p -> 'days_off') <> 'array' or jsonb_array_length(p -> 'days_off') > 400
       or exists (select 1 from jsonb_array_elements(p -> 'days_off') as e where not public.site_request_date_ok(e.value)
                  or jsonb_typeof(e.value) <> 'string')
       or (select count(*) from jsonb_array_elements_text(p -> 'days_off'))
          <> (select count(distinct e.value) from jsonb_array_elements_text(p -> 'days_off') as e(value)) then
      perform public.catalog_invalid('days_off');
    end if;
    delete from public.consult_days_off o where o.day is not null;
    insert into public.consult_days_off (day)
    select e.value::date from jsonb_array_elements_text(p -> 'days_off') as e(value);
  end if;

  update public.consult_settings s set
    notice_hours = case when p ? 'notice_hours' then (p ->> 'notice_hours')::int else s.notice_hours end,
    horizon_days = case when p ? 'horizon_days' then (p ->> 'horizon_days')::int else s.horizon_days end
  where s.id = 1;
  return public.ops_get_consult();
end;
$$;

revoke execute on function public.ops_save_consult(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_consult(jsonb) to service_role;

-- The owner cancels a booked consultation (guests cancel by replying to the email, F-04). The slot can be booked
-- again. Already cancelled: answered as it is. p_actor must be an owner.
create or replace function public.ops_cancel_consultation(p_id uuid, p_actor uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_at timestamptz;
begin
  perform public.booking_assert_owner(p_actor);
  select b.status into v_status from public.consult_bookings b where b.id = p_id for update;
  if not found then
    perform public.catalog_fail('not_found');
  end if;
  if v_status = 'booked' then
    update public.consult_bookings b set status = 'cancelled', cancelled_at = now() where b.id = p_id;
  end if;
  select b.cancelled_at into v_at from public.consult_bookings b where b.id = p_id;
  return jsonb_build_object('id', p_id, 'status', 'cancelled',
    'cancelled_at', to_char(v_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'affects_site', false);
end;
$$;

revoke execute on function public.ops_cancel_consultation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ops_cancel_consultation(uuid, uuid) to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Booking terms (06-04 "Booking terms contract" step 2; Phase 4's bookingTermsGate calls it).
-- ------------------------------------------------------------------------------------------------------------

-- {published: false} unless the booking_terms page is published AND its en, ar and es translations are all published;
-- then {published: true, version: 'cms-' + the first 16 hex characters of sha256(the title and every block text in
-- position order, en then ar then es, joined by U+001F)}. The version changes exactly when that text changes.
-- Built-ins only (sha256, convert_to, encode).
create or replace function public.booking_terms_current()
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_page uuid;
  v_text text;
begin
  select l.id into v_page from public.legal_pages l where l.kind = 'booking_terms' and l.is_published;
  if v_page is null then
    return jsonb_build_object('published', false);
  end if;
  if (select count(*) from public.legal_page_translations t
      where t.page_id = v_page and t.locale in ('en', 'ar', 'es') and t.status = 'published') <> 3 then
    return jsonb_build_object('published', false);
  end if;
  select string_agg(x.part, chr(31) order by x.loc_ord, x.part_ord, x.pos, x.block_id) into v_text
  from (
    select g.ord as loc_ord, 0 as part_ord, 0 as pos, null::uuid as block_id, coalesce(t.title, '') as part
    from unnest(array['en', 'ar', 'es']) with ordinality as g(locale, ord)
    join public.legal_page_translations t on t.page_id = v_page and t.locale = g.locale
    union all
    select g.ord, 1, b.position, b.id, coalesce(bt.text, '')
    from unnest(array['en', 'ar', 'es']) with ordinality as g(locale, ord)
    cross join public.legal_blocks b
    left join public.legal_block_translations bt on bt.block_id = b.id and bt.locale = g.locale
    where b.page_id = v_page
  ) x;
  return jsonb_build_object('published', true,
    'version', 'cms-' || left(encode(sha256(convert_to(coalesce(v_text, ''), 'UTF8')), 'hex'), 16));
end;
$$;

revoke all on function public.booking_terms_current() from public, anon, authenticated;
grant execute on function public.booking_terms_current() to service_role;

-- ------------------------------------------------------------------------------------------------------------
-- Import of today's page blocks, posts and links (06-01 Task 4, 06-02), service role only, called by
-- scripts/import-site-content.mjs --apply. p holds one array per table, each row's keys the table's own column names
-- (created_at / updated_at optional). Every row is inserted in foreign-key order with `on conflict do nothing`, so a
-- second call writes nothing new. A row with is_sample true is refused (C-16), and so is a picture id the library does
-- not hold (pictures come from the 3.2 import; none is created here). Returns the rows actually inserted per key.
-- ------------------------------------------------------------------------------------------------------------

create or replace function public.import_site_content(p jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_counts jsonb := '{}'::jsonb;
  v_n bigint;
  v_key text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    perform public.catalog_invalid('payload');
  end if;
  for v_key in select k from jsonb_object_keys(p) as k loop
    if v_key not in ('page_sections', 'page_section_translations', 'page_section_media', 'page_items', 'page_item_translations',
        'posts', 'post_translations', 'post_blocks', 'post_block_translations', 'nav_links', 'nav_link_translations') then
      perform public.catalog_invalid('payload.' || v_key);
    end if;
    if jsonb_typeof(p -> v_key) <> 'array' then
      perform public.catalog_invalid(v_key);
    end if;
  end loop;

  -- C-16: no sample row is imported.
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'page_items', '[]'::jsonb)) as e where (e.value ->> 'is_sample')::boolean) then
    perform public.catalog_invalid('page_items.is_sample');
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'posts', '[]'::jsonb)) as e where (e.value ->> 'is_sample')::boolean) then
    perform public.catalog_invalid('posts.is_sample');
  end if;
  -- Pictures must already be in the library.
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'page_section_media', '[]'::jsonb)) as e
             where not exists (select 1 from public.media m where m.id = nullif(e.value ->> 'media_id', '')::uuid)) then
    perform public.catalog_invalid('page_section_media.media_id');
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'page_items', '[]'::jsonb)) as e
             where nullif(e.value ->> 'media_id', '') is not null
               and not exists (select 1 from public.media m where m.id = (e.value ->> 'media_id')::uuid)) then
    perform public.catalog_invalid('page_items.media_id');
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'posts', '[]'::jsonb)) as e
             where nullif(e.value ->> 'cover_media_id', '') is not null
               and not exists (select 1 from public.media m where m.id = (e.value ->> 'cover_media_id')::uuid)) then
    perform public.catalog_invalid('posts.cover_media_id');
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p -> 'post_blocks', '[]'::jsonb)) as e
             where nullif(e.value ->> 'media_id', '') is not null
               and not exists (select 1 from public.media m where m.id = (e.value ->> 'media_id')::uuid)) then
    perform public.catalog_invalid('post_blocks.media_id');
  end if;

  insert into public.page_sections (id, page, section, is_shown, video_url, created_at, updated_at)
  select coalesce(r.id, gen_random_uuid()), r.page, r.section, coalesce(r.is_shown, true), r.video_url,
    coalesce(r.created_at, now()), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.page_sections, coalesce(p -> 'page_sections', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('page_sections', v_n);

  insert into public.page_section_translations (section_id, locale, status, updated_at, locked_fields, kicker, heading, headline,
    intro, body, statement, salutation, paragraphs, sign_off, signer, signer_role, cta_label)
  select r.section_id, r.locale, coalesce(r.status, 'draft'), coalesce(r.updated_at, now()), coalesce(r.locked_fields, '{}'::text[]),
    r.kicker, r.heading, r.headline, r.intro, r.body, r.statement, r.salutation, coalesce(r.paragraphs, '{}'::text[]),
    r.sign_off, r.signer, r.signer_role, r.cta_label
  from jsonb_populate_recordset(null::public.page_section_translations, coalesce(p -> 'page_section_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('page_section_translations', v_n);

  insert into public.page_section_media (section_id, slot, position, media_id, is_decorative)
  select r.section_id, r.slot, r.position, r.media_id, coalesce(r.is_decorative, false)
  from jsonb_populate_recordset(null::public.page_section_media, coalesce(p -> 'page_section_media', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('page_section_media', v_n);

  insert into public.page_items (id, section_id, slug, media_id, is_shown, position, is_sample, sample_fields, created_at, updated_at)
  select coalesce(r.id, gen_random_uuid()), r.section_id, r.slug, r.media_id, coalesce(r.is_shown, true), coalesce(r.position, 0),
    false, '{}'::text[], coalesce(r.created_at, now()), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.page_items, coalesce(p -> 'page_items', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('page_items', v_n);

  insert into public.page_item_translations (item_id, locale, status, updated_at, locked_fields, title, body)
  select r.item_id, r.locale, coalesce(r.status, 'draft'), coalesce(r.updated_at, now()), coalesce(r.locked_fields, '{}'::text[]),
    r.title, r.body
  from jsonb_populate_recordset(null::public.page_item_translations, coalesce(p -> 'page_item_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('page_item_translations', v_n);

  insert into public.posts (id, slug, cover_media_id, published_at, destination_id, featured_stay_id, featured_experience_id,
    is_published, is_sample, sample_fields, created_at, updated_at)
  select coalesce(r.id, gen_random_uuid()), r.slug, r.cover_media_id, r.published_at, r.destination_id, r.featured_stay_id,
    r.featured_experience_id, coalesce(r.is_published, false), false, '{}'::text[], coalesce(r.created_at, now()), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.posts, coalesce(p -> 'posts', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('posts', v_n);

  insert into public.post_translations (post_id, locale, status, updated_at, locked_fields, title, excerpt, seo_title, seo_description)
  select r.post_id, r.locale, coalesce(r.status, 'draft'), coalesce(r.updated_at, now()), coalesce(r.locked_fields, '{}'::text[]),
    r.title, r.excerpt, r.seo_title, r.seo_description
  from jsonb_populate_recordset(null::public.post_translations, coalesce(p -> 'post_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('post_translations', v_n);

  insert into public.post_blocks (id, post_id, position, kind, media_id)
  select coalesce(r.id, gen_random_uuid()), r.post_id, r.position, r.kind, r.media_id
  from jsonb_populate_recordset(null::public.post_blocks, coalesce(p -> 'post_blocks', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('post_blocks', v_n);

  insert into public.post_block_translations (block_id, locale, status, updated_at, locked_fields, text)
  select r.block_id, r.locale, coalesce(r.status, 'draft'), coalesce(r.updated_at, now()), coalesce(r.locked_fields, '{}'::text[]),
    r.text
  from jsonb_populate_recordset(null::public.post_block_translations, coalesce(p -> 'post_block_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('post_block_translations', v_n);

  insert into public.nav_links (id, area, position, is_shown, link_kind, target, created_at, updated_at)
  select coalesce(r.id, gen_random_uuid()), r.area, coalesce(r.position, 0), coalesce(r.is_shown, true), r.link_kind, r.target,
    coalesce(r.created_at, now()), coalesce(r.updated_at, now())
  from jsonb_populate_recordset(null::public.nav_links, coalesce(p -> 'nav_links', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('nav_links', v_n);

  insert into public.nav_link_translations (link_id, locale, status, updated_at, locked_fields, label)
  select r.link_id, r.locale, coalesce(r.status, 'draft'), coalesce(r.updated_at, now()), coalesce(r.locked_fields, '{}'::text[]),
    r.label
  from jsonb_populate_recordset(null::public.nav_link_translations, coalesce(p -> 'nav_link_translations', '[]'::jsonb)) as r
  on conflict do nothing;
  get diagnostics v_n = row_count;
  v_counts := v_counts || jsonb_build_object('nav_link_translations', v_n);

  return v_counts;
end;
$$;

revoke execute on function public.import_site_content(jsonb) from public, anon, authenticated;
grant execute on function public.import_site_content(jsonb) to service_role;
