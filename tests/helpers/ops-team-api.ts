import { expect, type Browser, type Page, type Route } from "@playwright/test";
import type { JourneyDetail, JourneySummary, Locale3, MediaRef, TeamDetail, TeamSummary } from "../../components/ops/api-types";
import { parseTierPrice } from "../../lib/ops/journey-price";
import { NEW_ID, openDashboard, refusal, type Reply } from "./ops-catalog-api";

// The owner API of plan 03.2-08 answered from fixtures shaped exactly like contract §5.7, §5.8, §5.9 and §5.11, for the
// behaviour blocks of tests/ops-team.spec.ts and tests/ops-journeys.spec.ts. A small store keeps what a save sent, so the
// detail read after a save is the saved one. Every call is recorded; no network, no database. Bracket names only: no
// real or invented person.

export { NEW_ID, refusal };

const PHOTO_URL = "https://media.almarprivatejourney.com/test/photo.webp";
const photo = (id: string): MediaRef => ({ id, key: `test/${id}.webp`, url: PHOTO_URL, width: 1600, height: 1067, alt_en: "A test photo" });
const AT = "2026-10-17T00:00:00Z";

type Status = "published" | "draft";
type TeamRecord = { name: string; role: string | null; bio: string | null; status: Status };
type JourneyRecord = { name: string; price_label: string; tagline: string | null; duration_label: string | null; ideal_for_label: string | null; ideal_for: string | null; body: string | null; status: Status };

export const member = (id: string, position: number, name: string, opts: { published?: boolean; email?: string | null; slug?: string; ar?: boolean } = {}): TeamDetail => {
  const published = opts.published ?? false;
  const other = (tag: string): TeamRecord | null => (opts.ar === false ? null : { name: `${tag} ${name}`, role: `${tag} [Role]`, bio: null, status: published ? "published" : "draft" });
  return {
    id,
    slug: opts.slug ?? `member-${position}`,
    photo_media_id: null,
    photo: null,
    email: opts.email === undefined ? null : opts.email,
    links: [{ label: "Instagram", url: "https://www.instagram.com/account" }],
    is_published: published,
    position,
    translations: { en: { name, role: "[Role]", bio: null, status: "published" }, ar: other("[AR]"), es: other("[ES]") },
    translation_state: { en: "published", ar: published ? "published" : "draft", es: published ? "published" : "draft" },
    updated_at: AT,
  } as TeamDetail;
};

const tier = (id: string, position: number, name: string, priceLabel: string, opts: { published?: boolean; media?: boolean } = {}): JourneyDetail => {
  const published = opts.published ?? true;
  const record = (tag: string, label: string): JourneyRecord => ({
    name: `${tag}${name}`,
    price_label: `${tag}${label}`,
    tagline: `${tag}[Tagline]`,
    duration_label: null,
    ideal_for_label: null,
    ideal_for: null,
    body: null,
    status: published ? "published" : "draft",
  });
  return {
    id,
    slug: `journey-${position}`,
    is_featured: position === 2,
    media_id: opts.media === false ? null : `m-${id}`,
    image: opts.media === false ? null : photo(`m-${id}`),
    ...readPrice(priceLabel),
    is_published: published,
    position,
    translations: { en: { ...record("", priceLabel), status: "published" }, ar: record("[AR] ", priceLabel), es: record("[ES] ", priceLabel) },
    translation_state: { en: "published", ar: published ? "published" : "draft", es: published ? "published" : "draft" },
    updated_at: AT,
  } as JourneyDetail;
};

/** The server's own reading of the English line (lib/ops/journey-price.ts), as the API answers it (amounts as strings). */
function readPrice(label: string): Pick<JourneyDetail, "price_from" | "price_estimate"> {
  const { price_from, price_estimate } = parseTierPrice(label);
  const money = (n: number) => `${n}.00`;
  return {
    price_from: price_from ? { amount: money(price_from.amount), currency: price_from.currency } : null,
    price_estimate: price_estimate
      ? { low: money(price_estimate.low), high: price_estimate.high === null ? null : money(price_estimate.high), currency: "AED", open_ended: price_estimate.open_ended }
      : null,
  };
}

type Store = { team: TeamDetail[]; journeys: JourneyDetail[] };

function freshStore(team: "empty" | "some"): Store {
  return {
    team:
      team === "empty"
        ? []
        : [
            member("t1", 1, "[Member 1]", { published: true, slug: "member-one", email: "one@example.com" }),
            member("t2", 2, "[Member 2]", { slug: "member-two" }),
            member("t3", 3, "[Member 3]", { slug: "member-three" }),
          ],
    journeys: [
      tier("j1", 1, "[Journey 1]", "From USD 1,000 per person"),
      tier("j2", 2, "[Journey 2]", "From USD 2,000 per person"),
      tier("j3", 3, "[Journey 3]", "[Price on request]", { published: false }),
    ],
  };
}

const teamSummary = (t: TeamDetail): TeamSummary => ({
  id: t.id,
  slug: t.slug,
  name_en: t.translations.en?.name ?? "",
  role_en: t.translations.en?.role ?? null,
  is_published: t.is_published,
  position: t.position,
  photo: t.photo,
  translation_state: t.translation_state,
  updated_at: t.updated_at,
});

const journeySummary = (j: JourneyDetail): JourneySummary => ({
  id: j.id,
  slug: j.slug,
  name_en: j.translations.en?.name ?? "",
  price_label_en: j.translations.en?.price_label ?? "",
  is_featured: j.is_featured,
  is_published: j.is_published,
  position: j.position,
  image: j.image,
  translation_state: j.translation_state,
  updated_at: j.updated_at,
});

/** A save's translations into a stored record set: a locale sent is replaced (null removes it), others stay. */
function merge(was: Record<Locale3, unknown>, sent: unknown): Record<Locale3, unknown> {
  const out = { ...was };
  if (sent && typeof sent === "object") {
    for (const [locale, record] of Object.entries(sent as Record<string, unknown>)) {
      out[locale as Locale3] = record === null ? null : { ...((was[locale as Locale3] as object | null) ?? {}), ...(record as object) };
    }
  }
  return out;
}

export type TeamApi = {
  gets: URL[];
  /** Every POST body, by endpoint ("team", "journeys", "publish", "translate"), in order. */
  posts: { path: string; body: Record<string, unknown> }[];
  of: (path: string) => Record<string, unknown>[];
  store: Store;
};

/**
 * Answers every /api/ops/* the two screens call. `answer` overrides one POST (by path and body) with a refusal;
 * `answerGet` one GET (by path and query). `team` starts the member list empty (D-57) or with three bracket members.
 */
export async function mockTeamApi(
  page: Page,
  {
    team = "some",
    answer = () => null,
    answerGet = () => null,
  }: {
    team?: "empty" | "some";
    answer?: (path: string, body: Record<string, unknown>) => Reply | null;
    answerGet?: (path: string, query: URLSearchParams) => Reply | null;
  } = {},
): Promise<TeamApi> {
  const store = freshStore(team);
  const api: TeamApi = { gets: [], posts: [], of: (path) => api.posts.filter((post) => post.path === path).map((post) => post.body), store };
  const reply = (route: Route, status: number, json: unknown) =>
    route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(json) });

  // An ops-mode page reads the site status on mount; unanswered, the dev server says 401 and the page goes to /sign-in.
  await page.route("**/api/ops/site-status", (route) =>
    reply(route, 200, {
      ok: true,
      site: { state: "up_to_date", requested_seq: 1, live_seq: 1, requested_at: AT, built_at: AT, last_hook_at: AT, last_hook_result: "ok" },
    }),
  );
  await page.route(/\/api\/ops\/(team|journeys|publish|translate)(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split("/").pop() ?? "";
    if (request.method() === "GET") {
      api.gets.push(url);
      const override = answerGet(path, url.searchParams);
      if (override) return reply(route, override.status, override.json);
      const id = url.searchParams.get("id");
      const list = path === "team" ? store.team : store.journeys;
      if (id) {
        const found = (list as { id: string }[]).find((row) => row.id === id);
        return found ? reply(route, 200, { ok: true, item: found }) : reply(route, 404, refusal(404, "not_found").json);
      }
      const items = path === "team" ? store.team.map(teamSummary) : store.journeys.map(journeySummary);
      return reply(route, 200, { ok: true, items });
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
      const list = body.entity === "team_member" ? store.team : store.journeys;
      const target = (list as { id: string; is_published: boolean }[]).find((row) => row.id === body.id);
      if (target) target.is_published = body.published === true;
      return reply(route, 200, { ok: true, id: body.id, is_published: body.published, affects_site: true, warnings: [] });
    }
    const list = (path === "team" ? store.team : store.journeys) as unknown as Record<string, unknown>[];
    if (body.action === "reorder") {
      (body.ids as string[]).forEach((id, at) => {
        const row = list.find((r) => r.id === id);
        if (row) row.position = at + 1;
      });
      return reply(route, 200, { ok: true, affects_site: true });
    }
    if (body.action === "delete") {
      const at = list.findIndex((row) => row.id === body.id);
      if (at >= 0) list.splice(at, 1);
      return reply(route, 200, { ok: true, id: body.id, affects_site: false });
    }
    // save: merge what was sent into the stored detail (a key not sent is left alone, contract §1.2).
    const sent = body.item as Record<string, unknown>;
    const id = (sent.id as string | undefined) ?? NEW_ID;
    let stored = list.find((row) => row.id === id);
    if (!stored) {
      stored = { ...member(id, list.length + 1, ""), translations: { en: null, ar: null, es: null } } as unknown as Record<string, unknown>;
      list.push(stored);
    }
    for (const [key, value] of Object.entries(sent)) {
      if (key === "id") continue;
      if (key === "translations") stored.translations = merge(stored.translations as Record<Locale3, unknown>, value);
      else stored[key] = value;
    }
    if ("photo_media_id" in sent) stored.photo = sent.photo_media_id ? photo(sent.photo_media_id as string) : null;
    if ("media_id" in sent) stored.image = sent.media_id ? photo(sent.media_id as string) : null;
    if (path === "journeys") {
      const en = (stored.translations as Record<Locale3, { price_label?: string } | null>).en;
      Object.assign(stored, readPrice(en?.price_label ?? ""));
    }
    return reply(route, 200, { ok: true, id, affects_site: Boolean(stored.is_published) });
  });
  return api;
}

/** Opens the page once before a behaviour block, so `next dev` compiles it outside a test's budget (as warmDashboard). */
export async function warmTeamDashboard(browser: Browser, path: string, baseURL: string | undefined, heading: string) {
  const page = await browser.newPage({ baseURL });
  try {
    await mockTeamApi(page);
    await openDashboard(page, path, "desktop", "en", baseURL, heading);
  } finally {
    await page.close();
  }
}

/** Waits until `count` POSTs to `path` were made (as postsTo in ops-catalog-api, for this store). */
export async function teamPostsTo(api: TeamApi, path: string, count = 1) {
  await expect.poll(() => api.of(path).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(count);
  return api.of(path);
}
