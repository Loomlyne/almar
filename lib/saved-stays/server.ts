// Plan 06-07: saved stays on Supabase. Server only. Her rows only through her session client, so RLS (06-01: own rows; the insert
// policy also asks stay_is_published) is the one owner filter and no user id ever comes from the client. Slugs, titles and photos
// only through an anon client on the published views, so an unpublished stay drops out by the view itself. Never the service role;
// never lib/data's loadSource or readSource, which are build-time reads.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SavedStayCard } from "../../components/site/saved-stays-list";
import { mediaUrl } from "../data/media";
import type { Locale } from "../locale-path";
import type { SavedSession } from "./route";
import { stayReturnPath } from "./rules";

/** The public settings of lib/supabase/clients.ts, no cookies: what any visitor may read. Null when they are not set. */
export function createSupabaseAnon(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

// The SQLSTATE of an RLS refusal. On a save it means the stay stopped being published after the slug was read.
const RLS_REFUSED = "42501";

/** Her saved stay ids, newest first. */
async function ownStayIds(supabase: SupabaseClient): Promise<string[]> {
  const { data, error } = await supabase.from("saved_stays").select("stay_id, created_at").order("created_at", { ascending: false });
  if (error) throw new Error("saved_stays read failed");
  return ((data ?? []) as Array<{ stay_id: string }>).map((row) => row.stay_id);
}

/** A published stay's id, or null. */
async function publishedStayId(anon: SupabaseClient, slug: string): Promise<string | null> {
  const { data, error } = await anon.from("api_stays").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error("api_stays read failed");
  return (data as { id: string } | null)?.id ?? null;
}

export function savedSession(supabase: SupabaseClient, userId: string, anon: SupabaseClient): SavedSession {
  return {
    async list() {
      const ids = await ownStayIds(supabase);
      if (ids.length === 0) return [];
      const { data, error } = await anon.from("api_stays").select("id, slug").in("id", ids);
      if (error) throw new Error("api_stays read failed");
      const slugs = new Map(((data ?? []) as Array<{ id: string; slug: string }>).map((row) => [row.id, row.slug]));
      return ids.flatMap((id) => slugs.get(id) ?? []);
    },
    async save(slug) {
      const stayId = await publishedStayId(anon, slug);
      if (!stayId) return "not_found";
      // On conflict do nothing: a second save of the same stay is a save, and needs the insert privilege only.
      const { error } = await supabase
        .from("saved_stays")
        .upsert({ user_id: userId, stay_id: stayId }, { onConflict: "user_id,stay_id", ignoreDuplicates: true });
      if (error?.code === RLS_REFUSED) return "not_found";
      if (error) throw new Error("saved_stays insert failed");
      return "saved";
    },
    async remove(slug) {
      const stayId = await publishedStayId(anon, slug);
      if (!stayId) return;
      const { error } = await supabase.from("saved_stays").delete().eq("stay_id", stayId);
      if (error) throw new Error("saved_stays delete failed");
    },
  };
}

type StayRow = { id: string; slug: string; destination_id: string; hero_image: { id: string; media_key: string } | null };
type Localized = { locale: string };

/** This language's record, else the English one: the fallback of lib/data/resolve.ts. */
function pick<T extends Localized>(records: readonly T[], locale: Locale): T | undefined {
  return records.find((record) => record.locale === locale) ?? records.find((record) => record.locale === "en");
}

function grouped<T>(rows: readonly T[], keyOf: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    out.set(key, [...(out.get(key) ?? []), row]);
  }
  return out;
}

/** Account's list: her saved, published stays in this language, newest first. */
export async function savedStayCards(supabase: SupabaseClient, anon: SupabaseClient, locale: Locale): Promise<SavedStayCard[]> {
  const ids = await ownStayIds(supabase);
  if (ids.length === 0) return [];

  const stays = await anon.from("api_stays").select("id, slug, destination_id, hero_image").in("id", ids);
  if (stays.error) throw new Error("api_stays read failed");
  const rows = (stays.data ?? []) as StayRow[];
  if (rows.length === 0) return [];

  const languages = [...new Set([locale, "en"])];
  const imageIds = rows.flatMap((row) => row.hero_image?.id ?? []);
  const [titles, names, alts] = await Promise.all([
    anon.from("api_stay_translations").select("stay_id, locale, title").in("stay_id", rows.map((row) => row.id)).in("locale", languages),
    anon.from("api_destination_translations").select("destination_id, locale, name").in("destination_id", rows.map((row) => row.destination_id)).in("locale", languages),
    imageIds.length > 0
      ? anon.from("api_image_translations").select("image_id, locale, alt").in("image_id", imageIds).in("locale", languages)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (titles.error || names.error || alts.error) throw new Error("saved stay text read failed");

  const titlesOf = grouped((titles.data ?? []) as Array<Localized & { stay_id: string; title: string }>, (row) => row.stay_id);
  const namesOf = grouped((names.data ?? []) as Array<Localized & { destination_id: string; name: string }>, (row) => row.destination_id);
  const altsOf = grouped((alts.data ?? []) as Array<Localized & { image_id: string; alt: string }>, (row) => row.image_id);
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ids.flatMap((id): SavedStayCard[] => {
    const row = byId.get(id);
    const href = row ? stayReturnPath(locale, row.slug) : null;
    const title = row ? pick(titlesOf.get(row.id) ?? [], locale)?.title : undefined;
    if (!row || !href || !title) return [];
    const hero = row.hero_image;
    return [
      {
        slug: row.slug,
        title,
        destination: pick(namesOf.get(row.destination_id) ?? [], locale)?.name ?? "",
        href,
        image: hero ? { src: mediaUrl(hero.media_key), alt: pick(altsOf.get(hero.id) ?? [], locale)?.alt ?? "" } : null,
      },
    ];
  });
}
