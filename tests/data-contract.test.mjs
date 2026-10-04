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

test("getTeam returns [] and home blocks carry hero, welcome (5 photos), 8 gallery images, 3 tiers, 3 stories", async () => {
  assert.deepEqual(await teamMod.getTeam("en"), []);
  const h = await homeMod.getHomeBlocks("en");
  assert.equal(h.hero.headline, "Colombia, Privately Yours");
  assert.equal(h.hero.video_url, null);
  assert.ok(h.hero.poster.url.endsWith("/home/hero/poster.webp"));
  assert.equal(h.welcome.paragraphs.length, 3);
  assert.equal(h.welcome.images.length, 5);
  assert.ok(h.welcome.images.every((i) => i.alt.length > 0));
  assert.equal(h.gallery.images.length, 8);
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

test("job 11: Welcome photos split from the gallery, Begin still, video keys, destination insets", async () => {
  for (const locale of ["en", "ar", "es"]) {
    const h = await homeMod.getHomeBlocks(locale);
    const keys = (list) => list.map((i) => i.url.slice(mediaMod.MEDIA_BASE_URL.length + 1));
    assert.deepEqual(keys(h.welcome.images), [1, 2, 3, 4, 5].map((n) => `home/gallery/0${n}.webp`), locale);
    assert.ok(h.welcome.images.every((i) => i.alt.trim().length > 0), `${locale} welcome alts`);
    assert.deepEqual(keys(h.gallery.images), [6, 7, 8, 9, 10, 11, 12, 13].map((n) => `home/gallery/${String(n).padStart(2, "0")}.webp`), locale);
    assert.equal(h.hero.video_url, null);
    assert.equal(h.begin.video_url, null);
    assert.ok(h.begin.poster.url.startsWith(mediaMod.MEDIA_BASE_URL) && h.begin.poster.url.endsWith("home/begin/poster.webp"));
    assert.ok(h.begin.poster.alt.trim().length > 0, `${locale} begin poster alt`);
    const dests = await destMod.getDestinations(locale);
    for (const slug of ["cartagena", "medellin"]) {
      const d = dests.find((x) => x.slug === slug);
      assert.ok(d.inset_image.url.startsWith(mediaMod.MEDIA_BASE_URL) && d.inset_image.url.endsWith(`destinations/${slug}/inset.webp`), `${locale} ${slug} inset`);
      assert.ok(d.inset_image.alt.trim().length > 0);
    }
  }
  const en = await destMod.getDestinations("en");
  assert.equal(en.find((d) => d.slug === "cartagena").inset_image.alt, "Cartagena, Colombia");
  assert.equal(en.find((d) => d.slug === "medellin").inset_image.alt, "Antioquia, Colombia");
});

test("job 11: the two 40px arrow icons are gone from every fixture and from the manifest", () => {
  for (const f of ["home.json", "image-translations.json", "../media-manifest.json"]) {
    const text = readFileSync(join("lib/data/fixtures", f), "utf8");
    assert.ok(!/gallery\/1[45]\.webp/.test(text), `${f} still names gallery 14 or 15`);
  }
  const ids = ["ba67281f-3ec9-5ee8-a449-4bb77b0c71d2", "9828e26f-0e7c-59fb-aac8-cd9f57e7c366"];
  const alts = readFileSync("lib/data/fixtures/image-translations.json", "utf8");
  for (const id of ids) assert.ok(!alts.includes(id), `alt records of ${id} remain`);
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

// ---- plan 03.3-30: posts (one data door for the blog; the home stories read from it) ----
const postsMod = await loadTs("lib/data/posts.ts");
const POST_SLUGS = [
  "discovering-cartagenas-hidden-colonial-courtyards",
  "why-medellin-is-redefining-luxury-travel",
  "colombias-coffee-triangle-eje-cafetero",
];
// Published EN text (the live post pages' text at 84deec2), kept as literals so this survives the route deletion.
const LIVE_EN = {
  [POST_SLUGS[0]]: {
    body: "Beyond the bustling plazas of the walled city lie Cartagena’s hidden colonial courtyards — flower-filled patios, private plazas, and centuries of quiet history. ALMAR opens doors that stay closed to most travelers, with private access and expert local guides who know every stone and story.",
    seo_title: "Discovering Cartagena’s Hidden Colonial Courtyards",
    seo_description: "Step beyond the walls into Cartagena’s hidden colonial courtyards — private plazas, flower-filled patios, and centuries of quiet history.",
  },
  [POST_SLUGS[1]]: {
    body: "From design hotels in El Poblado to mountain escapes minutes from the city, Medellín is redefining luxury travel in Colombia. Discover world-class dining, private art collections, and hillside villas — with ALMAR’s private drivers, bilingual guides, and concierge on call.",
    seo_title: "Why Medellín Is Redefining Luxury Travel",
    seo_description: "Why Medellín is redefining luxury travel — design hotels, world-class dining, and mountain escapes just minutes from the city.",
  },
  [POST_SLUGS[2]]: {
    body: "Colombia’s Coffee Triangle — Eje Cafetero — is a landscape of rolling fincas, misty valleys, and award-winning growers. ALMAR arranges private tastings, barista workshops, and stays among the plantations — fully vetted lodges with mountain views and private chefs.",
    seo_title: "Colombia’s Coffee Triangle — Eje Cafetero",
    seo_description: "Eje Cafetero: Colombia’s coffee triangle — rolling fincas, tastings with award-winning growers, and private stays among the plantations.",
  },
};

test("posts: getPostSlugs and getPosts('en') return the three posts newest first, every field present", async () => {
  assert.deepEqual(await postsMod.getPostSlugs(), POST_SLUGS);
  const posts = await postsMod.getPosts("en");
  assert.deepEqual(posts.map((p) => p.slug), POST_SLUGS);
  assert.deepEqual(posts.map((p) => p.published_at.slice(0, 10)), ["2025-06-01", "2025-05-28", "2025-05-24"]);
  assert.deepEqual(posts.map((p) => p.date_label), ["Jun 1, 2025", "May 28, 2025", "May 24, 2025"]);
  assert.deepEqual((await postsMod.getPosts("en", { limit: 2 })).map((p) => p.slug), POST_SLUGS.slice(0, 2));
  for (const p of posts) {
    for (const k of ["id", "created_at", "updated_at", "locale", "translation_status", "is_sample", "sample_fields", "slug", "title", "excerpt", "body", "seo_title", "seo_description", "published_at", "date_label", "reading_minutes", "destination_id", "destination_slug", "destination_name", "featured_stay_slug", "featured_experience_slug", "cover_image", "is_published"]) {
      assert.ok(k in p, `${p.slug} lacks ${k}`);
    }
    for (const k of ["featured_stay_id", "featured_experience_id", "translations", "status", "post_id"]) assert.equal(k in p, false);
    assert.equal(p.translation_status, "published");
    assert.equal(p.reading_minutes, 1);
    assert.equal(p.is_sample, false);
    assert.deepEqual(p.sample_fields, []);
    assert.ok(p.cover_image.url.startsWith(`${mediaMod.MEDIA_BASE_URL}/home/stories/`) && p.cover_image.alt.length > 0);
    assert.deepEqual(p.body.map((b) => b.type), ["paragraph"]);
  }
  assert.deepEqual(posts.map((p) => p.id), ["9616c101-0b63-58c5-a525-9eb1c910765a", "544d5a28-0412-53ca-8822-5ab420600aac", "26cb9d6c-202e-518e-8892-281f854eff5c"]);
});

test("posts: AR and ES are drafts with the drafted body; title and excerpt equal the home story drafts", async () => {
  const fx = JSON.parse(readFileSync(join(process.cwd(), "lib/data/fixtures/post-translations.json"), "utf8"));
  for (const locale of ["ar", "es"]) {
    const posts = await postsMod.getPosts(locale);
    const stories = (await homeMod.getHomeBlocks(locale)).stories;
    for (const [i, p] of posts.entries()) {
      assert.equal(p.translation_status, "draft");
      assert.equal(p.locale, locale);
      assert.equal(p.title, stories[i].title);
      assert.equal(p.excerpt, stories[i].excerpt);
      assert.equal(p.body[0].text, fx.find((r) => r.post_id === p.id && r.locale === locale).body[0].text);
    }
  }
  assert.ok((await postsMod.getPost("ar", POST_SLUGS[0])).body[0].text.startsWith("خلف الساحات الصاخبة في المدينة المسوّرة"));
  assert.ok((await postsMod.getPost("es", POST_SLUGS[2])).body[0].text.startsWith("El Triángulo del Café de Colombia, el Eje Cafetero"));
});

test("posts: getPost by slug in each locale; unknown slug is null", async () => {
  assert.equal(await postsMod.getPost("en", "no-such-post"), null);
  for (const l of ["en", "ar", "es"]) for (const s of POST_SLUGS) assert.equal((await postsMod.getPost(l, s)).slug, s);
});

test("posts: joins to destination, featured stay and featured experience (coffee post has none)", async () => {
  const [c, m, k] = await postsMod.getPosts("en");
  assert.deepEqual([c.destination_slug, c.destination_name, c.featured_stay_slug, c.featured_experience_slug],
    ["cartagena", (await destMod.getDestination("en", "cartagena")).name, "getsemani-colonial-house", "cartagena-heritage-tours"]);
  assert.deepEqual([m.destination_slug, m.featured_stay_slug, m.featured_experience_slug],
    ["medellin", "santa-fe-farm-antioquia", "medellin-discovery-tours"]);
  assert.deepEqual([k.destination_id, k.destination_slug, k.destination_name, k.featured_stay_slug, k.featured_experience_slug],
    [null, null, null, null, null]);
  const ar = await postsMod.getPost("ar", POST_SLUGS[0]);
  assert.equal(ar.destination_name, (await destMod.getDestination("ar", "cartagena")).name);
});

test("posts: related excludes the asked slug, newest first, limit honoured", async () => {
  assert.deepEqual((await postsMod.getRelatedPosts("en", POST_SLUGS[0])).map((p) => p.slug), POST_SLUGS.slice(1));
  assert.equal((await postsMod.getRelatedPosts("en", POST_SLUGS[0], { limit: 1 })).length, 1);
  for (const s of POST_SLUGS) assert.ok(!(await postsMod.getRelatedPosts("en", s)).some((p) => p.slug === s));
});

test("posts: a future or unpublished post is not live", () => {
  const now = new Date("2026-10-05T00:00:00Z");
  assert.equal(postsMod.isLive({ is_published: true, published_at: "2025-06-01T00:00:00+00:00" }, now), true);
  assert.equal(postsMod.isLive({ is_published: true, published_at: "2027-01-01T00:00:00+00:00" }, now), false);
  assert.equal(postsMod.isLive({ is_published: false, published_at: "2025-06-01T00:00:00+00:00" }, now), false);
});

test("posts: EN body, seo_title and seo_description equal the live text", async () => {
  for (const s of POST_SLUGS) {
    const p = await postsMod.getPost("en", s);
    assert.equal(p.body[0].text, LIVE_EN[s].body);
    assert.equal(p.seo_title, LIVE_EN[s].seo_title);
    assert.equal(p.seo_description, LIVE_EN[s].seo_description);
    const file = join(process.cwd(), "app", "blog", s, "route.ts");
    let src = null;
    try { src = readFileSync(file, "utf8"); } catch { /* route removed by plan 32: the literals above stand */ }
    if (src) {
      const html = JSON.parse(src.match(/const HTML = (".*");\n/)[1]);
      assert.equal(html.match(/<title>(.*?)<\/title>/)[1], `${p.seo_title} | ALMAR`);
      assert.equal(html.match(/<meta name="description" content="(.*?)"/)[1], `${p.seo_description} | ALMAR`);
      assert.ok(html.includes(p.body[0].text));
    }
  }
});
