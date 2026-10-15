import { expect, type Page, type Route } from "@playwright/test";
import type {
  CatalogDetail,
  CatalogSummary,
  DestinationDetail,
  DestinationSummary,
  Locale3,
  MediaRef,
  StaySummary,
} from "../../components/ops/api-types";
import { VIEWPORTS, type Viewport } from "../journey/matrix";

// The owner API of plan 03.2-06 answered from fixtures shaped exactly like contract §5.1, §5.2, §5.6, §5.9 and §5.11,
// for the behaviour blocks of tests/ops-destinations.spec.ts and tests/ops-catalog-items.spec.ts. A small store keeps
// what a save sent, so the detail read after a save is the saved one. Every call is recorded; no network, no database.

export const PHOTO_URL = "https://media.almarprivatejourney.com/test/photo.webp";
const photo = (id: string): MediaRef => ({ id, key: `test/${id}.webp`, url: PHOTO_URL, width: 1600, height: 1067, alt_en: "A test photo" });
const AT = "2026-10-15T00:00:00Z";
export const NEW_ID = "00000000-0000-4000-8000-0000000000ff";

type Text = Record<string, string | null>;
type Record3<T> = Record<Locale3, (T & { status: "published" | "draft" }) | null>;

const destination = (id: string, slug: string, position: number, published: boolean, en: string, opts: { ar?: string; es?: string } = {}): DestinationDetail => ({
  id,
  slug,
  is_published: published,
  position,
  hero_media_id: `h-${id}`,
  inset_media_id: null,
  hero: photo(`h-${id}`),
  inset: null,
  translations: {
    en: { name: en, short_line: `${en} line`, region: null, summary: null, nights_label: null, status: "published" },
    ar: opts.ar ? { name: opts.ar, short_line: `${opts.ar} line`, region: null, summary: null, nights_label: null, status: published ? "published" : "draft" } : null,
    es: opts.es ? { name: opts.es, short_line: `${opts.es} line`, region: null, summary: null, nights_label: null, status: published ? "published" : "draft" } : null,
  },
  translation_state: { en: "published", ar: opts.ar ? (published ? "published" : "draft") : "missing", es: opts.es ? (published ? "published" : "draft") : "missing" },
  updated_at: AT,
});

const item = (
  id: string,
  slug: string,
  position: number,
  kind: "experience" | "service",
  en: string,
  facts: { published?: boolean; price?: string | null; destinations?: string[]; stays?: string[]; media?: boolean; ar?: string; es?: string } = {},
): CatalogDetail => ({
  id,
  slug,
  kind,
  unit: kind === "service" ? "trip" : "person",
  price_aed: facts.price === undefined ? "1250.00" : facts.price,
  is_uae: false,
  is_home_pickup: false,
  media_id: facts.media === false ? null : `m-${id}`,
  image: facts.media === false ? null : photo(`m-${id}`),
  destination_ids: facts.destinations ?? [],
  stay_ids: facts.stays ?? [],
  is_published: facts.published ?? false,
  position,
  translations: {
    en: { name: en, summary: `${en} summary`, duration_label: null, status: "published" },
    ar: facts.ar ? { name: facts.ar, summary: `${facts.ar} summary`, duration_label: null, status: facts.published ? "published" : "draft" } : null,
    es: facts.es ? { name: facts.es, summary: `${facts.es} summary`, duration_label: null, status: facts.published ? "published" : "draft" } : null,
  },
  translation_state: { en: "published", ar: facts.ar ? "draft" : "missing", es: facts.es ? "draft" : "missing" },
  updated_at: AT,
});

export const STAYS: StaySummary[] = [
  { id: "s1", slug: "casa-1", title_en: "Casa Uno", destination_id: "d1", destination_name_en: "Cartagena", is_published: true, position: 1, base_nightly_rate_aed: null, bookable: false, hero: null, translation_state: { en: "published", ar: "missing", es: "missing" }, updated_at: AT },
  { id: "s2", slug: "casa-2", title_en: "Casa Dos", destination_id: "d1", destination_name_en: "Cartagena", is_published: false, position: 2, base_nightly_rate_aed: null, bookable: false, hero: null, translation_state: { en: "published", ar: "missing", es: "missing" }, updated_at: AT },
  { id: "s3", slug: "finca-3", title_en: "Finca Tres", destination_id: "d3", destination_name_en: "Salento", is_published: false, position: 3, base_nightly_rate_aed: null, bookable: false, hero: null, translation_state: { en: "published", ar: "missing", es: "missing" }, updated_at: AT },
];

function freshStore() {
  return {
    destinations: [
      destination("d1", "cartagena", 1, true, "Cartagena", { ar: "قرطاجنة", es: "Cartagena ES" }),
      destination("d2", "medellin", 2, false, "Medellin"),
      destination("d3", "salento", 3, false, "Salento"),
    ],
    items: [
      item("c1", "coffee-farm", 1, "experience", "Coffee farm", { published: true, destinations: ["d1"], stays: ["s1"], ar: "مزرعة البن", es: "Finca de café" }),
      item("c2", "airport-transfer", 2, "service", "Airport transfer", { destinations: ["d2"], stays: ["s3"] }),
      item("c3", "chef-dinner", 3, "experience", "Chef dinner", { price: null, media: false }),
    ],
  };
}

type Store = ReturnType<typeof freshStore>;

const stayCount = (id: string) => STAYS.filter((stay) => stay.destination_id === id).length;

function destinationSummary(d: DestinationDetail): DestinationSummary {
  return {
    id: d.id,
    slug: d.slug,
    name_en: d.translations.en?.name ?? "",
    is_published: d.is_published,
    position: d.position,
    stay_count: stayCount(d.id),
    published_stay_count: STAYS.filter((stay) => stay.destination_id === d.id && stay.is_published).length,
    hero: d.hero,
    translation_state: d.translation_state,
    updated_at: d.updated_at,
  };
}

function itemSummary(c: CatalogDetail): CatalogSummary {
  return {
    id: c.id,
    slug: c.slug,
    kind: c.kind,
    unit: c.unit,
    price_aed: c.price_aed,
    is_uae: c.is_uae,
    is_home_pickup: c.is_home_pickup,
    name_en: c.translations.en?.name ?? "",
    is_published: c.is_published,
    position: c.position,
    image: c.image,
    destination_ids: c.destination_ids,
    stay_count: c.stay_ids.length,
    translation_state: c.translation_state,
    updated_at: c.updated_at,
  };
}

/** A save's translations into a stored record set: a locale sent is replaced (null removes it), others stay. */
function mergeTranslations<T extends Text>(was: Record3<T>, sent: unknown): Record3<T> {
  const out = { ...was };
  if (sent && typeof sent === "object") {
    for (const [locale, record] of Object.entries(sent as Record<string, unknown>)) {
      out[locale as Locale3] = (record === null ? null : { ...(was[locale as Locale3] ?? {}), ...(record as object) }) as never;
    }
  }
  return out;
}

export type Reply = { status: number; json: unknown };
export const refusal = (status: number, code: string, field: string | null = null, detail: unknown = null): Reply => ({
  status,
  json: { ok: false, error: { code, field, locale: null, detail } },
});

export type Api = {
  gets: URL[];
  /** Every POST body, by endpoint ("destinations", "stays", "catalog", "publish", "translate"), in order. */
  posts: { path: string; body: Record<string, unknown> }[];
  of: (path: string) => Record<string, unknown>[];
  /** The fixtures as stored now: a test changes a row here to stand for a change made elsewhere. */
  store: Store;
};

/**
 * Answers every /api/ops/* the two screens call. `answer` overrides one POST (by path and body) with a refusal;
 * `answerGet` one GET (by path and query).
 */
export async function mockCatalogApi(
  page: Page,
  answer: (path: string, body: Record<string, unknown>) => Reply | null = () => null,
  answerGet: (path: string, query: URLSearchParams) => Reply | null = () => null,
): Promise<Api> {
  const store: Store = freshStore();
  const api: Api = { gets: [], posts: [], of: (path) => api.posts.filter((post) => post.path === path).map((post) => post.body), store };
  const reply = (route: Route, status: number, json: unknown) =>
    route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(json) });

  await page.route(/\/api\/ops\/(destinations|stays|catalog|publish|translate)(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split("/").pop() ?? "";
    if (request.method() === "GET") {
      api.gets.push(url);
      const id = url.searchParams.get("id");
      const override = answerGet(path, url.searchParams);
      if (override) return reply(route, override.status, override.json);
      if (path === "stays" && id) {
        // StayDetail: only what the screens read here (its experiences and services, from the items' stays).
        const stay = STAYS.find((s) => s.id === id);
        if (!stay) return reply(route, 404, refusal(404, "not_found").json);
        const linked = store.items.filter((c) => c.stay_ids.includes(id));
        return reply(route, 200, {
          ok: true,
          item: {
            id,
            slug: stay.slug,
            destination_id: stay.destination_id,
            is_published: stay.is_published,
            experience_ids: linked.filter((c) => c.kind === "experience").map((c) => c.id),
            service_ids: linked.filter((c) => c.kind === "service").map((c) => c.id),
          },
        });
      }
      if (path === "stays") return reply(route, 200, { ok: true, items: STAYS });
      if (path === "destinations") {
        if (id) {
          const found = store.destinations.find((d) => d.id === id);
          return found ? reply(route, 200, { ok: true, item: found }) : reply(route, 404, refusal(404, "not_found").json);
        }
        return reply(route, 200, { ok: true, items: store.destinations.map(destinationSummary) });
      }
      if (id) {
        const found = store.items.find((c) => c.id === id);
        return found ? reply(route, 200, { ok: true, item: found }) : reply(route, 404, refusal(404, "not_found").json);
      }
      return reply(route, 200, { ok: true, items: store.items.map(itemSummary) });
    }

    const body = request.postDataJSON() as Record<string, unknown>;
    api.posts.push({ path, body });
    const override = answer(path, body);
    if (override) return reply(route, override.status, override.json);

    if (path === "translate") {
      const sent = body as { target: string; fields: Record<string, string> };
      const tag = `[${sent.target.toUpperCase()}]`;
      return reply(route, 200, { ok: true, target: sent.target, fields: Object.fromEntries(Object.entries(sent.fields).map(([k, v]) => [k, `${tag} ${v}`])) });
    }
    if (path === "publish") {
      const list = body.entity === "destination" ? store.destinations : store.items;
      const target = (list as { id: string; is_published: boolean }[]).find((row) => row.id === body.id);
      if (target) target.is_published = body.published === true;
      return reply(route, 200, { ok: true, id: body.id, is_published: body.published, affects_site: true, warnings: [] });
    }
    const list = path === "destinations" ? store.destinations : store.items;
    if (body.action === "reorder") {
      (body.ids as string[]).forEach((id, at) => {
        const row = (list as { id: string; position: number }[]).find((r) => r.id === id);
        if (row) row.position = at + 1;
      });
      return reply(route, 200, { ok: true, affects_site: true });
    }
    if (body.action === "delete") {
      const at = (list as { id: string }[]).findIndex((row) => row.id === body.id);
      if (at >= 0) list.splice(at, 1);
      return reply(route, 200, { ok: true, id: body.id, affects_site: false });
    }
    // save: merge what was sent into the stored detail (a key not sent is left alone, contract §1.2).
    const sent = body.item as Record<string, unknown>;
    const id = (sent.id as string | undefined) ?? NEW_ID;
    let stored = (list as { id: string }[]).find((row) => row.id === id) as Record<string, unknown> | undefined;
    if (!stored) {
      stored =
        path === "destinations"
          ? ({ ...destination(id, "new", list.length + 1, false, ""), translations: { en: null, ar: null, es: null } } as unknown as Record<string, unknown>)
          : ({ ...item(id, "new", list.length + 1, "experience", ""), translations: { en: null, ar: null, es: null } } as unknown as Record<string, unknown>);
      (list as unknown[]).push(stored);
    }
    for (const [key, value] of Object.entries(sent)) {
      if (key === "id") continue;
      if (key === "translations") stored.translations = mergeTranslations(stored.translations as Record3<Text>, value);
      else stored[key] = value;
    }
    if ("media_id" in sent) stored.image = sent.media_id ? photo(sent.media_id as string) : null;
    if ("hero_media_id" in sent) stored.hero = sent.hero_media_id ? photo(sent.hero_media_id as string) : null;
    return reply(route, 200, { ok: true, id, affects_site: true });
  });
  return api;
}

/** Opens a real dashboard page (next dev, the API mocked) in one language at one width. */
export async function openDashboard(page: Page, path: string, viewport: Viewport, locale: Locale3, baseURL: string | undefined, heading: string) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: baseURL ?? "http://127.0.0.1:3010" }]);
  await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible({ timeout: 20_000 });
}

/** The row (desktop table) or card (phone) button that opens an item by its name. */
export const openRow = (page: Page, name: string) => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

/** Waits until `count` POSTs to `path` were made. */
export async function postsTo(api: Api, path: string, count = 1) {
  await expect.poll(() => api.of(path).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(count);
  return api.of(path);
}

/**
 * Holds the next POST to `path` that `match` accepts until `release` is called with the reply to give; other requests go
 * on to the mock. Register after mockCatalogApi (the last route registered runs first).
 */
export async function holdPost(page: Page, path: string, match: (body: Record<string, unknown>) => boolean) {
  let release: (reply: Reply) => void = () => undefined;
  const answer = new Promise<Reply>((resolve) => (release = resolve));
  let markSeen: () => void = () => undefined;
  const seen = new Promise<void>((resolve) => (markSeen = resolve));
  let held = false;
  await page.route(new RegExp(`/api/ops/${path}$`), async (route) => {
    const request = route.request();
    const body = request.method() === "POST" ? (request.postDataJSON() as Record<string, unknown>) : null;
    if (held || !body || !match(body)) return route.fallback();
    held = true;
    markSeen();
    const reply = await answer;
    await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.json) });
  });
  return { seen, release: (reply: Reply) => release(reply) };
}
