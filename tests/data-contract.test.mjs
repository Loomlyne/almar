// Contract tests for lib/data (plan 03.3-01): resolver, media helper, locale-first reads, one media host.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const resolveMod = await loadTs("lib/data/resolve.ts");
const mediaMod = await loadTs("lib/data/media.ts");

test("resolveRow: exact locale gives its own status, flattened, with no translations array", () => {
  const base = { id: "s1", slug: "x" };
  const rows = [
    { stay_id: "s1", locale: "en", title: "Title", status: "published" },
    { stay_id: "s1", locale: "ar", title: "عنوان", status: "draft" },
  ];
  const ar = resolveMod.resolveRow(base, rows, "ar");
  assert.equal(ar.title, "عنوان");
  assert.equal(ar.locale, "ar");
  assert.equal(ar.translation_status, "draft");
  assert.equal(ar.slug, "x");
  assert.equal("stay_id" in ar, false);
  assert.equal("status" in ar, false);
  assert.equal("translations" in ar, false);
  const en = resolveMod.resolveRow(base, rows, "en");
  assert.equal(en.translation_status, "published");
});

test("resolveRow: a missing locale falls back to English and says so", () => {
  const rows = [{ stay_id: "s1", locale: "en", title: "Title", status: "published" }];
  const es = resolveMod.resolveRow({ id: "s1" }, rows, "es");
  assert.equal(es.title, "Title");
  assert.equal(es.locale, "en");
  assert.equal(es.translation_status, "fallback");
});

test("resolveRow: no en and no locale record is an error, not a silent empty row", () => {
  assert.throws(() => resolveMod.resolveRow({ id: "s1" }, [], "ar"));
});

test("resolveImage: url through mediaUrl, alt with the English fallback", () => {
  const raw = { id: "i1", media_key: "stays/x/hero.webp", width: 10, height: 20, position: 0 };
  const alts = [
    { image_id: "i1", locale: "en", alt: "EN alt", status: "published" },
    { image_id: "i1", locale: "ar", alt: "AR alt", status: "draft" },
  ];
  const ar = resolveMod.resolveImage(raw, alts, "ar");
  assert.equal(ar.alt, "AR alt");
  assert.equal(ar.url, `${mediaMod.MEDIA_BASE_URL}/stays/x/hero.webp`);
  assert.equal(resolveMod.resolveImage(raw, alts, "es").alt, "EN alt");
  assert.equal(resolveMod.resolveImage(null, alts, "en"), null);
  assert.deepEqual(Object.keys(ar).sort(), ["alt", "height", "id", "position", "url", "width"]);
});

test("mediaUrl joins a key onto the base and rejects traversal and host injection", () => {
  assert.equal(mediaMod.mediaUrl("stays/x/hero.webp"), `${mediaMod.MEDIA_BASE_URL}/stays/x/hero.webp`);
  for (const bad of ["https://evil.example/x.webp", "a/../b.webp", "/abs.webp", "a\\b.webp", "", "//host/x.webp"]) {
    assert.throws(() => mediaMod.mediaUrl(bad), undefined, `should reject ${JSON.stringify(bad)}`);
  }
});

test("the media base is the pending placeholder while the flag is true, and a real https origin once the controller flips it", () => {
  const url = mediaMod.MEDIA_BASE_URL;
  if (mediaMod.MEDIA_BASE_URL_IS_PLACEHOLDER) {
    assert.equal(url, "https://media-pending.invalid");
  } else {
    const u = new URL(url);
    assert.equal(u.protocol, "https:");
    assert.equal(u.origin, url, "a bare origin: no path, no trailing slash");
    assert.ok(!u.hostname.endsWith(".invalid"));
  }
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "worktrees" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

test("the media host literal appears in exactly one source file: lib/data/media.ts", () => {
  const host = new URL(mediaMod.MEDIA_BASE_URL).hostname; // the placeholder now, the real R2 host after the flip
  const hits = [];
  for (const root of ["lib", "app", "components"]) {
    for (const f of walk(root)) {
      if (readFileSync(f, "utf8").includes(host)) hits.push(f.replaceAll("\\", "/"));
    }
  }
  assert.deepEqual(hits, ["lib/data/media.ts"]);
});

const staysMod = await loadTs("lib/data/stays.ts");
const filterMod = await loadTs("lib/data/stay-filter.ts");
const destMod = await loadTs("lib/data/destinations.ts");
const expMod = await loadTs("lib/data/experiences.ts");
const teamMod = await loadTs("lib/data/team.ts");
const homeMod = await loadTs("lib/data/home.ts");
const ratesMod = await loadTs("lib/data/rates.ts");

const homeCopy = await loadTs("lib/copy/home.ts");

test("every exported read in lib/data takes `locale: Locale` first, except the *Slugs functions", () => {
  const dir = "lib/data";
  const skip = new Set(["resolve.ts", "media.ts", "types.ts", "stay-filter.ts"]);
  let reads = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".ts") || skip.has(name)) continue;
    const src = readFileSync(join(dir, name), "utf8");
    for (const m of src.matchAll(/export async function (get\w+)\(([^)]*)/g)) {
      const [, fn, params] = m;
      if (fn.endsWith("Slugs") || fn === "getRates" || fn === "getBlockedDates") continue;
      reads++;
      assert.match(params.trim(), /^locale: Locale\b/, `${name}: ${fn} must take locale first`);
    }
  }
  assert.ok(reads >= 10, `expected at least 10 locale-first reads, saw ${reads}`);
});

test("stay-filter.ts is pure: no fs, no import but types", () => {
  const src = readFileSync("lib/data/stay-filter.ts", "utf8");
  const imports = [...src.matchAll(/^import\s+(.*?)\s+from\s+["']([^"']+)["']/gm)];
  for (const [, what, from] of imports) {
    assert.match(what, /^type\b/, `stay-filter imports a value from ${from}`);
    assert.equal(from, "./types");
  }
  assert.doesNotMatch(src, /node:fs|require\(|readFileSync/);
});

test("getStays: 12 published stays in position order, English", async () => {
  const stays = await staysMod.getStays("en");
  assert.equal(stays.length, 12);
  assert.deepEqual(
    stays.slice(0, 3).map((s) => s.slug),
    ["getsemani-colonial-house", "getsemani-courtyard-residence", "cartagena-historic-center-house"],
  );
  assert.deepEqual(stays.map((s) => s.position), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const s of stays) {
    assert.equal(s.locale, "en");
    assert.equal(s.translation_status, "published");
    assert.equal(s.nightly_rate_aed, null);
    assert.equal(s.min_nights, null);
    assert.ok(s.hero_image.url.startsWith(mediaMod.MEDIA_BASE_URL + "/stays/"));
    assert.ok(s.description.length >= 3);
  }
});

test("getStays: destination, guests, bedrooms and accent-insensitive query filters", async () => {
  assert.equal((await staysMod.getStays("en", { destination: "medellin" })).length, 2);
  assert.equal((await staysMod.getStays("en", { destination: "cartagena" })).length, 10);
  const big = await staysMod.getStays("en", { guests: 20 });
  assert.deepEqual(big.map((s) => s.slug).sort(), ["private-island-cartagena", "private-island-estate-cartagena"]);
  for (const s of await staysMod.getStays("en", { guests: 17 })) assert.ok(s.max_guests >= 17);
  const mid = await staysMod.getStays("en", { bedroomsMin: 5, bedroomsMax: 8 });
  assert.ok(mid.length > 0 && mid.every((s) => s.bedrooms >= 5 && s.bedrooms <= 8));
  const q = await staysMod.getStays("en", { query: "getsemani" });
  assert.deepEqual(q.map((s) => s.slug), ["getsemani-colonial-house", "getsemani-courtyard-residence"]);
  assert.equal((await staysMod.getStays("en", { query: "MEDELLIN" })).length, 2);
  assert.equal((await staysMod.getStays("en", { query: "zzzz-no-such" })).length, 0);
});

test("foldText and matchesStayFilter: null capacity is kept only when guests is unset", () => {
  assert.equal(filterMod.foldText("Getsemaní MEDELLÍN"), "getsemani medellin");
  const noCap = { destination_slug: "x", destination_name: "X", title: "T", neighborhood: null, max_guests: null, bedrooms: null };
  assert.equal(filterMod.matchesStayFilter(noCap, {}), true);
  assert.equal(filterMod.matchesStayFilter(noCap, { guests: 2 }), false);
  assert.equal(filterMod.matchesStayFilter(noCap, { bedroomsMin: 1 }), false);
});

test("toStayQuery and parseStayQuery round-trip and reject bad input", () => {
  const q = filterMod.toStayQuery({ destination: "cartagena", from: "2026-10-12", to: "2026-10-17", guests: 2 });
  assert.equal(q, "destination=cartagena&from=2026-10-12&to=2026-10-17&guests=2");
  assert.deepEqual(filterMod.parseStayQuery(new URLSearchParams(q)), {
    destination: "cartagena", guests: 2, from: "2026-10-12", to: "2026-10-17",
  });
  assert.equal(filterMod.toStayQuery({}), "");
  assert.equal(filterMod.toStayQuery({ destination: "medellin", guests: 0 }), "destination=medellin");
  const bad = filterMod.parseStayQuery(new URLSearchParams("destination=../x&guests=-3&from=2026-13-40&to=nope"));
  assert.deepEqual(bad, {});
  assert.deepEqual(filterMod.parseStayQuery(new URLSearchParams("guests=2.5")), {});
  assert.deepEqual(filterMod.parseStayQuery(new URLSearchParams("destination=atlantis"), { destinations: ["cartagena"] }), {});
  assert.deepEqual(filterMod.parseStayQuery(new URLSearchParams("destination=cartagena"), { destinations: ["cartagena"] }), { destination: "cartagena" });
});

test("getRelatedStays excludes the stay itself, prefers its destination, honours the limit", async () => {
  const rel = await staysMod.getRelatedStays("en", "getsemani-colonial-house");
  assert.equal(rel.length, 3);
  assert.ok(!rel.some((s) => s.slug === "getsemani-colonial-house"));
  assert.ok(rel.every((s) => s.destination_slug === "cartagena"));
  const med = await staysMod.getRelatedStays("en", "santa-fe-farm-antioquia", { limit: 2 });
  assert.equal(med[0].slug, "sopetran-country-estate");
  assert.equal(med.length, 2);
});

test("Arabic: draft status, and the home stay's title is the lib/copy/home.ts string", async () => {
  const ar = await staysMod.getStay("ar", "getsemani-colonial-house");
  assert.equal(ar.locale, "ar");
  assert.equal(ar.translation_status, "draft");
  assert.equal(ar.title, homeCopy.HOME_COPY.ar.stays[0].name);
  assert.ok(/[؀-ۿ]/.test(ar.description[0]));
  const es = await staysMod.getStay("es", "cartagena-historic-center-house");
  assert.equal(es.title, homeCopy.HOME_COPY.es.stays[2].name);
  assert.equal(await staysMod.getStay("en", "baru-house"), null);
  assert.equal(await staysMod.getStay("en", "no-such-stay"), null);
});

test("getStaySlugs and getBlockedDates", async () => {
  const slugs = await staysMod.getStaySlugs();
  assert.equal(slugs.length, 12);
  assert.ok(!slugs.some((s) => ["baru-house", "corona-island", "yury-house-cartagena"].includes(s)));
  const dates = await staysMod.getBlockedDates("getsemani-colonial-house");
  assert.ok(dates.length >= 4 && dates.length <= 8);
  assert.ok(dates.every((d) => /^2026-1[0-2]-\d\d$/.test(d)));
  assert.deepEqual(await staysMod.getBlockedDates("no-such-stay"), []);
});

test("destinations: cartagena and medellin, only those with a published stay unless includeEmpty", async () => {
  const d = await destMod.getDestinations("en");
  assert.deepEqual(d.map((x) => x.slug), ["cartagena", "medellin"]);
  assert.equal(d[0].nights_label, "3–7 nights");
  assert.equal(d[1].name, "Medellín");
  assert.equal((await destMod.getDestinations("ar", { includeEmpty: true })).length, 2);
  assert.equal((await destMod.getDestination("es", "medellin")).translation_status, "draft");
  assert.equal(await destMod.getDestination("en", "atlantis"), null);
  assert.deepEqual(await destMod.getDestinationSlugs(), ["cartagena", "medellin"]);
});

test("catalogue: 3 services, 7 experiences, split per stay, every item has an image", async () => {
  const all = await expMod.getCatalogItems("en");
  assert.equal(all.filter((c) => c.kind === "service").length, 3);
  assert.equal(all.filter((c) => c.kind === "experience").length, 7);
  assert.ok(all.every((c) => c.image && c.image.url && c.image.alt && c.price_aed === null));
  assert.deepEqual(
    (await expMod.getCatalogItems("en", { kind: "service" })).map((c) => c.slug),
    ["24-7-private-concierge", "luxury-ground-transport", "vip-airport-meet-greet"],
  );
  const forStay = await expMod.getCatalogForStay("en", "santa-fe-farm-antioquia");
  assert.deepEqual(forStay.experiences.map((c) => c.slug), ["welcome-cocktail", "medellin-renaissance", "medellin-discovery-tours"]);
  assert.equal(forStay.services.length, 3);
  assert.deepEqual(await expMod.getCatalogForStay("en", "no-such-stay"), { experiences: [], services: [] });
  assert.equal((await expMod.getCatalogItems("en", { query: "yacht" })).length, 1);
  const med = await expMod.getCatalogItems("en", { destinationSlug: "medellin", kind: "experience" });
  assert.ok(med.some((c) => c.slug === "medellin-renaissance") && med.some((c) => c.slug === "welcome-cocktail"));
  assert.equal((await expMod.getCatalogItem("ar", "welcome-cocktail")).translation_status, "draft");
});

test("getTeam returns [] and home blocks carry hero, welcome, 15 gallery images, 3 tiers, 3 stories", async () => {
  assert.deepEqual(await teamMod.getTeam("en"), []);
  const h = await homeMod.getHomeBlocks("en");
  assert.equal(h.hero.headline, "Colombia, Privately Yours");
  assert.equal(h.hero.video_url, null);
  assert.ok(h.hero.poster.url.endsWith("/home/hero/poster.webp"));
  assert.equal(h.welcome.paragraphs.length, 3);
  assert.equal(h.gallery.images.length, 15);
  assert.ok(h.gallery.images.every((i) => i.alt.length > 0));
  assert.equal(h.tiers.length, 3);
  assert.equal(h.tiers.filter((t) => t.is_featured).map((t) => t.name).join(), "The Resident");
  assert.deepEqual(h.tiers[2].price_estimate, { low: 200000, high: 250000, currency: "AED", open_ended: true });
  assert.equal(h.tiers[0].ideal_for, "First-time visitors, couples, and small groups seeking an authentic introduction to Colombia");
  assert.equal(h.stories.length, 3);
  assert.deepEqual(h.stories.map((s) => s.slug), [
    "discovering-cartagenas-hidden-colonial-courtyards",
    "why-medellin-is-redefining-luxury-travel",
    "colombias-coffee-triangle-eje-cafetero",
  ]);
  assert.deepEqual(h.stories.map((s) => s.date_label), ["Jun 1, 2025", "May 28, 2025", "May 24, 2025"]);
  for (const s of h.stories) assert.ok(s.image.url.startsWith(`${mediaMod.MEDIA_BASE_URL}/home/stories/`) && s.image.alt && s.excerpt);
  const ar = await homeMod.getHomeBlocks("ar");
  assert.equal(ar.hero.headline, homeCopy.HOME_COPY.ar.heroTitle);
  assert.equal(ar.stories[0].translation_status, "draft");
  assert.deepEqual((await homeMod.getJourneyTiers("es")).map((t) => t.name), ["The Explorer", "The Resident", "The Sovereign"]);
});

test("getRates returns null, not a throw, when the feed fails", async () => {
  const real = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    assert.equal(await ratesMod.getRates(), null);
  } finally {
    globalThis.fetch = real;
  }
});

test("no image in any read result carries a locale-keyed alt map or a raw media_key", async () => {
  const stay = await staysMod.getStay("ar", "bocagrande-beach-house");
  for (const img of [stay.hero_image, ...stay.gallery]) {
    assert.deepEqual(Object.keys(img).sort(), ["alt", "height", "id", "position", "url", "width"]);
    assert.equal(typeof img.alt, "string");
  }
  assert.equal("translations" in stay, false);
  assert.equal("status" in stay, false);
  assert.equal("stay_id" in stay, false);
});
