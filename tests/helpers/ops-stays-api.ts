import { expect, type Browser, type Page, type Route } from "@playwright/test";
import type { CatalogSummary, DestinationSummary, Locale3, MediaRef, StayDetail, StaySummary, StayText } from "../../components/ops/api-types";
import { openDashboard, refusal, type Reply } from "./ops-catalog-api";

// The owner API behind Catalog -> Stays (plan 03.2-07), answered from fixtures shaped like contract §5.1, §5.2, §5.6 and
// §5.9, for the behaviour block of tests/ops-stays.spec.ts. A small store keeps what a save sent (a key not sent is left
// alone, contract §1.2), so the reads after a save are the saved ones. Every call is recorded; no network, no database.
// Bracket data only: no rate, no fee value, no person.

export { refusal, type Reply };
export const STAY_NEW_ID = "00000000-0000-4000-8000-0000000000aa";
const AT = "2026-10-17T00:00:00Z";
const photo = (id: string): MediaRef => ({ id, key: `test/${id}.webp`, url: "https://media.almarprivatejourney.com/test/photo.webp", width: 1600, height: 1067, alt_en: "A test photo" });

type Status = "published" | "draft";
const text = (title: string, status: Status, amenities: string[] = ["[Pool]", "[Wifi]"]): StayText & { status: Status } => ({
  title,
  tagline: `${title} tagline`,
  neighborhood: null,
  guests_label: null,
  bathrooms_label: null,
  beds_label: null,
  price_label: null,
  price_note: null,
  description: [`${title} description`],
  amenities,
  inclusions: [],
  policy_headings: [],
  status,
});

const stay = (id: string, slug: string, position: number, destination: string, published: boolean, title: string, patch: Partial<StayDetail> = {}): StayDetail => ({
  id,
  slug,
  destination_id: destination,
  is_published: published,
  position,
  max_guests: 4,
  min_guests: 1,
  bedrooms: 2,
  bathrooms: 2,
  min_nights: 2,
  pets_rule: "not_allowed",
  pets_fee_aed: null,
  infants_count: false,
  base_nightly_rate_aed: null,
  hero_media_id: `h-${id}`,
  hero: photo(`h-${id}`),
  gallery: [photo(`g1-${id}`), photo(`g2-${id}`)],
  experience_ids: [],
  service_ids: [],
  has_access: false,
  translations: {
    en: text(`[${title}]`, published ? "published" : "draft"),
    ar: text(`[${title} AR]`, published ? "published" : "draft", ["[ar 1]", "[ar 2]"]),
    es: text(`[${title} ES]`, published ? "published" : "draft", ["[es 1]", "[es 2]"]),
  },
  translation_state: { en: published ? "published" : "draft", ar: published ? "published" : "draft", es: published ? "published" : "draft" },
  updated_at: AT,
  ...patch,
});

const catalogRow = (id: string, kind: "experience" | "service", position: number, name: string, destinations: string[]): CatalogSummary => ({
  id,
  slug: id,
  kind,
  unit: "person",
  price_aed: null,
  is_uae: false,
  is_home_pickup: false,
  name_en: name,
  is_published: true,
  position,
  image: null,
  destination_ids: destinations,
  stay_count: 0,
  translation_state: { en: "published", ar: "published", es: "published" },
  updated_at: AT,
});

const destinationRow = (id: string, name: string, position: number, published: boolean): DestinationSummary => ({
  id,
  slug: id,
  name_en: name,
  name_ar: null,
  name_es: null,
  is_published: published,
  position,
  stay_count: 0,
  published_stay_count: 0,
  hero: null,
  translation_state: { en: "published", ar: "published", es: "published" },
  updated_at: AT,
});

function freshStore() {
  return {
    stays: [
      // Published, no base rate: on the site, not bookable (the no-rate warning).
      stay("s1", "casa-uno", 1, "d1", true, "Casa Uno", { experience_ids: ["e1"] }),
      // A draft with two experiences and a service connected, in that order.
      stay("s2", "casa-dos", 2, "d1", false, "Casa Dos", { experience_ids: ["e1", "e2"], service_ids: ["v1"] }),
      stay("s3", "finca-tres", 3, "d2", false, "Finca Tres"),
    ],
    catalog: [
      catalogRow("e1", "experience", 1, "[Experience 1]", []),
      catalogRow("e2", "experience", 2, "[Experience 2]", []),
      catalogRow("e3", "experience", 3, "[Experience 3]", ["d1"]),
      catalogRow("v1", "service", 1, "[Service 1]", []),
      catalogRow("v2", "service", 2, "[Service 2]", []),
    ],
    destinations: [destinationRow("d1", "[Destination 1]", 1, true), destinationRow("d2", "[Destination 2]", 2, false)],
  };
}

type Store = ReturnType<typeof freshStore>;

function summary(s: StayDetail, destinations: DestinationSummary[]): StaySummary {
  return {
    id: s.id,
    slug: s.slug,
    title_en: s.translations.en?.title ?? "",
    destination_id: s.destination_id,
    destination_name_en: destinations.find((d) => d.id === s.destination_id)?.name_en ?? "",
    is_published: s.is_published,
    position: s.position,
    base_nightly_rate_aed: s.base_nightly_rate_aed,
    bookable: s.is_published && s.base_nightly_rate_aed !== null,
    hero: s.hero,
    translation_state: s.translation_state,
    updated_at: s.updated_at,
  };
}

export type StaysApi = {
  gets: URL[];
  /** Every POST body by endpoint ("stays", "publish", "translate"), in order. */
  posts: { path: string; body: Record<string, unknown> }[];
  of: (path: string) => Record<string, unknown>[];
  store: Store;
};

/** Answers every /api/ops/* the stays screen calls. `answer` overrides one POST (by path and body) with a refusal. */
export async function mockStaysApi(page: Page, answer: (path: string, body: Record<string, unknown>) => Reply | null = () => null): Promise<StaysApi> {
  const store: Store = freshStore();
  const api: StaysApi = { gets: [], posts: [], of: (path) => api.posts.filter((post) => post.path === path).map((post) => post.body), store };
  const reply = (route: Route, status: number, json: unknown) =>
    route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(json) });

  await page.route(/\/api\/ops\/(destinations|stays|catalog|publish|translate)(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split("/").pop() ?? "";
    if (request.method() === "GET") {
      api.gets.push(url);
      const id = url.searchParams.get("id");
      if (path === "stays") {
        if (id) {
          const found = store.stays.find((s) => s.id === id);
          return found ? reply(route, 200, { ok: true, item: found }) : reply(route, 404, refusal(404, "not_found").json);
        }
        return reply(route, 200, { ok: true, items: [...store.stays].sort((a, b) => a.position - b.position).map((s) => summary(s, store.destinations)) });
      }
      if (path === "catalog") return reply(route, 200, { ok: true, items: store.catalog });
      if (path === "destinations") return reply(route, 200, { ok: true, items: store.destinations });
      return reply(route, 404, refusal(404, "not_found").json);
    }

    const body = request.postDataJSON() as Record<string, unknown>;
    api.posts.push({ path, body });
    const override = answer(path, body);
    if (override) return reply(route, override.status, override.json);

    if (path === "translate") {
      const sent = body as { target: string; fields: Record<string, string | string[]> };
      const tag = `[${sent.target.toUpperCase()}]`;
      const fields = Object.fromEntries(
        Object.entries(sent.fields).map(([k, v]) => [k, Array.isArray(v) ? v.map((line) => `${tag} ${line}`) : `${tag} ${v}`]),
      );
      return reply(route, 200, { ok: true, target: sent.target, fields });
    }
    if (path === "publish") {
      const target = store.stays.find((s) => s.id === body.id);
      if (target) target.is_published = body.published === true;
      const warnings = target && target.is_published && target.base_nightly_rate_aed === null ? [{ code: "no_base_rate" }] : [];
      return reply(route, 200, { ok: true, id: body.id, is_published: body.published, affects_site: true, warnings });
    }
    if (body.action === "reorder") {
      (body.ids as string[]).forEach((id, at) => {
        const row = store.stays.find((s) => s.id === id);
        if (row) row.position = at + 1;
      });
      return reply(route, 200, { ok: true, affects_site: true });
    }
    if (body.action === "delete") {
      const at = store.stays.findIndex((s) => s.id === body.id);
      if (at >= 0) store.stays.splice(at, 1);
      return reply(route, 200, { ok: true, id: body.id, affects_site: false });
    }
    // save: merge what was sent into the stored detail.
    const sent = body.item as Record<string, unknown>;
    const id = (sent.id as string | undefined) ?? STAY_NEW_ID;
    let stored = store.stays.find((s) => s.id === id);
    if (!stored) {
      stored = stay(id, "", store.stays.length + 1, "", false, "", { translations: { en: null, ar: null, es: null }, gallery: [], hero: null, hero_media_id: null });
      store.stays.push(stored);
    }
    const target = stored as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(sent)) {
      if (key === "id" || key === "connections" || key === "gallery_media_ids" || key === "translations") continue;
      target[key] = value;
    }
    if ("hero_media_id" in sent) stored.hero = sent.hero_media_id ? photo(sent.hero_media_id as string) : null;
    if (Array.isArray(sent.gallery_media_ids)) stored.gallery = (sent.gallery_media_ids as string[]).map(photo);
    const connections = sent.connections as { experience_ids: string[]; service_ids: string[] } | undefined;
    if (connections) {
      stored.experience_ids = [...connections.experience_ids];
      stored.service_ids = [...connections.service_ids];
    }
    if (sent.translations && typeof sent.translations === "object") {
      for (const [locale, record] of Object.entries(sent.translations as Record<string, unknown>)) {
        stored.translations[locale as Locale3] = record as never;
      }
    }
    return reply(route, 200, { ok: true, id, affects_site: stored.is_published });
  });
  return api;
}

/** Waits for `count` POSTs to `path` and hands back every body sent there (as ops-catalog-api's postsTo). */
export async function postsTo(api: StaysApi, path: string, count = 1) {
  await expect.poll(() => api.of(path).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(count);
  return api.of(path);
}

/** Opens the page once before the block, so `next dev` compiles it outside a test's budget (as 03.2-06's warmDashboard). */
export async function warmStays(browser: Browser, path: string, baseURL: string | undefined, heading: string) {
  const page = await browser.newPage({ baseURL });
  try {
    await mockStaysApi(page);
    await openDashboard(page, path, "desktop", "en", baseURL, heading);
  } finally {
    await page.close();
  }
}
