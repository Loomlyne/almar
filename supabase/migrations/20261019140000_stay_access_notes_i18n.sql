-- Plan 03.2-15 (owner, 2026-10-15 02:56): the stay's private access Notes are written in English and the AI fills Arabic
-- and Spanish on Save (kit auto-translate), so the guest reads them in their language after the booking is confirmed.
-- Additive and safe on live rows: two nullable columns with the same 2,000-character check as notes, no default, no
-- backfill. stay_access stays ungranted to anon and authenticated (C-14): no grant, no policy, no view, never in a
-- build, never in the public translations tables.

alter table public.stay_access
  add column notes_ar text check (char_length(notes_ar) <= 2000),
  add column notes_es text check (char_length(notes_es) <= 2000);

-- p = {stay_id, access: {address, wifi_name, wifi_password, door_code, notes, notes_ar, notes_es}} (the fields may also
-- sit at the top level). A field absent is left alone; present, it is set (empty becomes null). Never logged, never in
-- a view. Same signature, search_path and security as 20261005100000_catalog_and_team.sql; only the two notes added.
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
  insert into public.stay_access as t (stay_id, address, wifi_name, wifi_password, door_code, notes, notes_ar, notes_es)
  values (
    v_stay, public.catalog_txt(a, 'address'), public.catalog_txt(a, 'wifi_name'), public.catalog_raw(a, 'wifi_password'),
    public.catalog_raw(a, 'door_code'), public.catalog_txt(a, 'notes'), public.catalog_txt(a, 'notes_ar'),
    public.catalog_txt(a, 'notes_es')
  )
  on conflict (stay_id) do update set
    address = case when a ? 'address' then excluded.address else t.address end,
    wifi_name = case when a ? 'wifi_name' then excluded.wifi_name else t.wifi_name end,
    wifi_password = case when a ? 'wifi_password' then excluded.wifi_password else t.wifi_password end,
    door_code = case when a ? 'door_code' then excluded.door_code else t.door_code end,
    notes = case when a ? 'notes' then excluded.notes else t.notes end,
    notes_ar = case when a ? 'notes_ar' then excluded.notes_ar else t.notes_ar end,
    notes_es = case when a ? 'notes_es' then excluded.notes_es else t.notes_es end;
  return jsonb_build_object('stay_id', v_stay);
end;
$$;

revoke execute on function public.ops_save_stay_access(jsonb) from public, anon, authenticated;
grant execute on function public.ops_save_stay_access(jsonb) to service_role;
