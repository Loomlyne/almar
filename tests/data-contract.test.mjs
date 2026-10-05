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

test("catalog-filter.ts is pure: type-only imports from ./types plus foldText from ./stay-filter", () => {
  const src = readFileSync("lib/data/catalog-filter.ts", "utf8");
  const imports = [...src.matchAll(/^import\s+(.*?)\s+from\s+["']([^"']+)["']/gm)];
  assert.ok(imports.length >= 2);
  for (const [, what, from] of imports) {
    if (from === "./stay-filter") assert.equal(what, "{ foldText }");
    else {
      assert.equal(from, "./types");
      assert.match(what, /^type\b/, `catalog-filter imports a value from ${from}`);
    }
  }
  assert.doesNotMatch(src, /node:fs|require\(|readFileSync|window|document/);
});

test("every catalogue item carries destination_slugs and stay_slugs joined in id order", async () => {
  const dSlug = new Map(JSON.parse(readFileSync("lib/data/fixtures/destinations.json", "utf8")).map((d) => [d.id, d.slug]));
  const sSlug = new Map(JSON.parse(readFileSync("lib/data/fixtures/stays.json", "utf8")).map((s) => [s.id, s.slug]));
  const rows = JSON.parse(readFileSync("lib/data/fixtures/catalog.json", "utf8"));
  const expMod = await loadTs("lib/data/experiences.ts");
  for (const l of ["en", "ar", "es"]) {
    for (const i of await expMod.getCatalogItems(l)) {
      const row = rows.find((r) => r.slug === i.slug);
      assert.deepEqual(i.destination_slugs, row.destination_ids.map((x) => dSlug.get(x)));
      assert.deepEqual(i.stay_slugs, row.stay_ids.map((x) => sSlug.get(x)));
    }
  }
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

test("destinations: five on the board; the default read is still cartagena and medellin (those with a published stay)", async () => {
  for (const l of ["en", "ar", "es"]) {
    assert.deepEqual((await destMod.getDestinations(l)).map((x) => x.slug), ["cartagena", "medellin"], l);
  }
  const d = await destMod.getDestinations("en");
  assert.equal(d[0].nights_label, "3–7 nights");
  assert.equal(d[1].name, "Medellín");
  const FIVE = ["cartagena", "medellin", "bogota", "san-andres", "cocora-valley"];
  assert.deepEqual((await destMod.getDestinations("ar", { includeEmpty: true })).map((x) => x.slug), FIVE);
  assert.deepEqual(await destMod.getDestinationSlugs(), FIVE);
  assert.equal((await destMod.getDestination("es", "medellin")).translation_status, "draft");
  assert.equal(await destMod.getDestination("en", "atlantis"), null);
  assert.equal(await destMod.getDestination("en", "eje-cafetero"), null);
  const bogota = await destMod.getDestination("en", "bogota");
  assert.equal(bogota.name, "Bogotá");
  assert.equal(bogota.region, "Andes");
  assert.equal(bogota.summary, null);
  assert.equal(bogota.nights_label, null);
  assert.equal(bogota.short_line, null);
  assert.equal(bogota.hero_image.alt, "Bogotá");
  assert.equal(bogota.translation_status, "published");
  const cocora = await destMod.getDestination("es", "cocora-valley");
  assert.equal(cocora.name, "Valle de Cocora");
  assert.equal(cocora.translation_status, "draft");
  assert.equal((await destMod.getDestination("en", "san-andres")).region, "Caribbean");
});

test("catalogue: 35 experiences then 10 services in the live page order, split per stay, every item has an image", async () => {
  const all = await expMod.getCatalogItems("en");
  assert.equal(all.length, 45);
  assert.equal(all.filter((c) => c.kind === "service").length, 10);
  assert.equal(all.filter((c) => c.kind === "experience").length, 35);
  for (const l of ["en", "ar", "es"]) {
    const items = await expMod.getCatalogItems(l);
    assert.ok(items.every((c) => c.image && c.image.url && c.image.alt && c.price_aed === null), l);
    assert.deepEqual(items.map((c) => c.position), Array.from({ length: 45 }, (_, i) => i + 1), l);
  }
  assert.deepEqual(
    (await expMod.getCatalogItems("en", { kind: "service" })).map((c) => c.slug),
    ["24-7-private-concierge", "luxury-ground-transport", "helicopter-transfers", "vip-airport-meet-greet", "in-villa-private-chef", "wellness-spa-coordination", "personal-security-detail", "pop-up-bar-experiences", "pop-up-cinema-at-your-villa", "private-city-guides"],
  );
  assert.deepEqual(
    (await expMod.getCatalogItems("en", { kind: "experience" })).slice(0, 5).map((c) => c.slug),
    ["private-ceremony-colombia", "welcome-cocktail", "wellness-yoga-retreat", "cartagena-night-experience", "coffee-region-immersion"],
  );
  const forStay = await expMod.getCatalogForStay("en", "santa-fe-farm-antioquia");
  assert.deepEqual(forStay.experiences.map((c) => c.slug), ["welcome-cocktail", "medellin-renaissance", "medellin-discovery-tours"]);
  assert.equal(forStay.services.length, 3);
  assert.deepEqual(await expMod.getCatalogForStay("en", "no-such-stay"), { experiences: [], services: [] });
  assert.deepEqual((await expMod.getCatalogItems("en", { query: "yacht" })).map((c) => c.slug), ["yacht-island-charters", "pop-up-bar-experiences"]);
  const med = await expMod.getCatalogItems("en", { destinationSlug: "medellin", kind: "experience" });
  assert.ok(med.some((c) => c.slug === "medellin-renaissance") && med.some((c) => c.slug === "welcome-cocktail"));
  assert.equal((await expMod.getCatalogItem("ar", "welcome-cocktail")).translation_status, "draft");
  const guides = await expMod.getCatalogItem("en", "private-city-guides");
  assert.deepEqual(guides.destination_slugs, ["cartagena", "medellin", "bogota"]);
  assert.deepEqual(guides.stay_slugs, []);
  assert.equal((await expMod.getCatalogItem("en", "helicopter-transfers")).duration_label, null);
  assert.match((await expMod.getCatalogItem("en", "traditional-cooking-classes")).summary, /\u2014/);
});

test("slice-1 catalogue rows are unchanged except position", () => {
  const SLICE1 = new Map([
  ["24-7-private-concierge", { id: "0d2a7249-64d9-5035-8996-f3b002d307f0", image: "0f28d1c4-47c9-5251-a4fc-696dc90caa77", key: "catalog/24-7-private-concierge.webp", destinations: 2, stays: 12, position: 36 }],
  ["luxury-ground-transport", { id: "36f0cbfa-61c7-53e1-85b8-a380296aa654", image: "2144b93b-a5c6-5671-893e-5aae8ef47cb8", key: "catalog/luxury-ground-transport.webp", destinations: 2, stays: 12, position: 37 }],
  ["vip-airport-meet-greet", { id: "0a1e9bbb-a744-5c57-ad6e-a34116dfe1e9", image: "667fc851-be00-5640-93a2-fa3d89658c29", key: "catalog/vip-airport-meet-greet.webp", destinations: 2, stays: 12, position: 39 }],
  ["welcome-cocktail", { id: "f9f2fa01-8a29-5343-a1a1-8de64593212b", image: "8974aa01-5eed-570c-9a95-ab2381f8004b", key: "catalog/welcome-cocktail.webp", destinations: 2, stays: 12, position: 2 }],
  ["cartagena-night-experience", { id: "d4cc2412-6db6-5e58-8108-610b391a2cb6", image: "857186c3-85a9-59d8-8e88-aa046c00438d", key: "catalog/cartagena-night-experience.webp", destinations: 1, stays: 7, position: 4 }],
  ["cartagena-heritage-tours", { id: "8736a8de-7744-53f9-8cb2-3028d9d309d9", image: "d7c9d68a-5697-5a17-9530-16250f5a2280", key: "catalog/cartagena-heritage-tours.webp", destinations: 1, stays: 7, position: 13 }],
  ["rosario-islands-escape", { id: "9f31a21f-e3f0-5f1d-ae06-71da428e3abd", image: "421aa8d8-678f-5607-b708-810365bc1266", key: "catalog/rosario-islands-escape.webp", destinations: 1, stays: 3, position: 15 }],
  ["yacht-island-charters", { id: "18d491a4-8c28-569a-9587-ff21bc5aeeba", image: "1e02db5a-5ac1-5415-a05f-66c9b7d81cae", key: "catalog/yacht-island-charters.webp", destinations: 1, stays: 3, position: 11 }],
  ["medellin-renaissance", { id: "0eb443e0-f11d-58ef-93db-40d370d85c31", image: "49a20a34-c831-544d-b6d2-a1bb80e602a0", key: "catalog/medellin-renaissance.webp", destinations: 1, stays: 2, position: 9 }],
  ["medellin-discovery-tours", { id: "feb9b4e7-6a66-5a31-b1d0-603fe49f04ea", image: "09dde168-3631-5fb2-aade-99ced23244cf", key: "catalog/medellin-discovery-tours.webp", destinations: 1, stays: 2, position: 14 }],
  ]);
  const rows = JSON.parse(readFileSync("lib/data/fixtures/catalog.json", "utf8"));
  for (const [slug, want] of SLICE1) {
    const r = rows.find((x) => x.slug === slug);
    assert.ok(r, slug);
    assert.equal(r.id, want.id, slug);
    assert.equal(r.image.id, want.image, slug);
    assert.equal(r.image.media_key, want.key, slug);
    assert.equal(r.destination_ids.length, want.destinations, slug);
    assert.equal(r.stay_ids.length, want.stays, slug);
    assert.equal(r.position, want.position, slug);
  }
});

// Base 118 manifest entries at origin/gsd/phase-3.3-slice-1 b698507 (job 11 merged: +3 -2 against slice 1's 117),
// catalog/ 10, destinations/ 4 (two heroes + job 11's two insets) + slice-2 delta 40 / 35 / 5 (S2-18, S2-27).
const NEW_KEYS = [
  ["destinations/bogota/hero.webp", "/assets/img/b62ee6b7553e89fa.webp", "8f446e7f-412f-537c-9910-1135dadd421c"],
  ["destinations/san-andres/hero.webp", "/assets/img/6ef3dad90b2d2f3c.webp", "9b70fbde-8d84-5cba-bf16-c5690f6c1607"],
  ["destinations/cocora-valley/hero.webp", "/assets/img/25a959b694257d53.webp", "37171873-91c7-5acc-8d67-6a616202fa2d"],
  ["catalog/private-ceremony-colombia.webp", "/assets/img/4f10e90754c6e7a3.webp", "e729a194-7184-56f0-b4cf-d95a36954183"],
  ["catalog/wellness-yoga-retreat.webp", "/assets/img/e6194c17eba0cb30.webp", "22a5cb76-0f95-59ff-a366-00aa3c4ac782"],
  ["catalog/coffee-region-immersion.webp", "/assets/img/e79f428834abad39.webp", "5370ee79-d25c-5951-bf83-25ef3c2d799f"],
  ["catalog/amazon-rainforest-expedition.webp", "/assets/img/0b8402d7d069dc80.webp", "26e90245-4cf2-52bd-8e40-cceb65a49c2e"],
  ["catalog/tayrona-coastal-escape.webp", "/assets/img/20ec0195691731a5.webp", "be4d9730-a424-5f8a-a49d-2b3d44a4c992"],
  ["catalog/bogota-art-gastronomy.webp", "/assets/img/ef1c2b0ec161f78b.webp", "899a9f64-ca80-59e6-90c6-8e105d01bcd7"],
  ["catalog/san-andres-diving-escape.webp", "/assets/img/c146260c2e6aed1f.webp", "56ad01ed-e8b2-586b-93c9-40a295cb1264"],
  ["catalog/coffee-hacienda-experiences.webp", "/assets/img/a4595bea0f3781e2.webp", "a67a5c6b-f9ce-53a7-80fb-ba8138c8b9ac"],
  ["catalog/hot-air-balloon-coffee-region.webp", "/assets/img/23bb36239242c7b9.webp", "75656474-2766-5611-b976-7edcd5a8e66b"],
  ["catalog/helicopter-city-tours.webp", "/assets/img/788c34e919c05909.webp", "09b5d681-c441-54aa-a731-a75c5b6c95ab"],
  ["catalog/private-beach-experiences.webp", "/assets/img/54482d988b8f11b3.webp", "82ed8ded-7436-5513-9941-1722ce27c09d"],
  ["catalog/vip-cultural-access.webp", "/assets/img/b67a57e844f55d59.webp", "507cf0e4-9a22-5027-8eeb-11671eb6b365"],
  ["catalog/gourmet-food-tours.webp", "/assets/img/8d72e5577734778a.webp", "740d56d4-3b0f-551b-81f7-0ec412b76b9c"],
  ["catalog/private-picnic-experiences.webp", "/assets/img/62741bd08bc3d3b8.webp", "3ed3bc9b-f2e3-576e-bf43-4082c5d3722f"],
  ["catalog/pastry-dessert-masterclass.webp", "/assets/img/7638152d7ba4b292.webp", "181877b6-7f58-5751-b3c7-bc1660ec69e2"],
  ["catalog/artisan-workshop-experiences.webp", "/assets/img/e65a20ddba325ddc.webp", "5aa59d3e-a728-597d-b700-f178975f7e38"],
  ["catalog/private-surfing-lessons.webp", "/assets/img/831cc67e4504b2bd.webp", "c44a7622-1ed8-5538-9719-06514bbac2ec"],
  ["catalog/private-museum-experiences.webp", "/assets/img/eea0e804555322ec.webp", "cd8835ba-43f7-527e-878b-a90977b467a0"],
  ["catalog/scuba-diving-expeditions.webp", "/assets/img/fe94d42b01c05e8b.webp", "300a8259-248b-542f-8384-749bc576ac1f"],
  ["catalog/snorkeling-adventures.webp", "/assets/img/783f0f9f85c684dc.webp", "bf43c23b-f11f-59d1-9281-074417acbe6a"],
  ["catalog/mountain-adventure-excursions.webp", "/assets/img/7aa519add59d9fe8.webp", "42674d7e-5e9c-5e2a-9560-c2dbae36328e"],
  ["catalog/highland-trekking-experiences.webp", "/assets/img/b0cbdcbce3dc33f7.webp", "e06c0eff-47f2-53bb-883c-9f706358e028"],
  ["catalog/traditional-cooking-classes.webp", "/assets/img/81840f01e4039621.webp", "73ace5b5-6ee2-5205-8463-8c47e227d871"],
  ["catalog/truffle-foraging-experiences.webp", "/assets/img/2146dba8218b821e.webp", "17dd525c-ca98-536b-8f3b-0f56504581fe"],
  ["catalog/vip-dinner-show-experiences.webp", "/assets/img/fe15633f305e7835.webp", "cb362bd6-8caa-57c0-9e58-83eefac5fc37"],
  ["catalog/rural-farm-nature-visits.webp", "/assets/img/5e9e2253799ba09c.webp", "17295fac-2a78-54de-8688-fcf2fbd4f4cb"],
  ["catalog/wine-spirits-tastings.webp", "/assets/img/efe24e8c8dbeb887.webp", "23bab7b0-ca4c-55df-bfa8-1690c7078b12"],
  ["catalog/sunrise-yoga-wellness-retreats.webp", "/assets/img/35de84d1af4e18e3.webp", "f914b9b5-fb7c-5cfd-a7eb-4cd5415a6adc"],
  ["catalog/helicopter-transfers.webp", "/assets/img/55229fe2762f7af5.webp", "b9829c3b-ae85-555d-abdd-dd67b9c3416c"],
  ["catalog/in-villa-private-chef.webp", "/assets/img/57b0dca8aa1b756b.webp", "8fb2ad20-d3bb-5e72-a1a6-a2e155c91149"],
  ["catalog/wellness-spa-coordination.webp", "/assets/img/82f63c1afddf14b2.webp", "d9e34371-f3b0-58f3-80fd-fbfc3aa2648e"],
  ["catalog/personal-security-detail.webp", "/assets/img/efca5e84cc63a331.webp", "d19a07c5-e0c1-5b7c-8532-9b501156feb9"],
  ["catalog/pop-up-bar-experiences.webp", "/assets/img/708e2b953e00972f.webp", "918770ab-81d2-56fa-b783-98c1e3396fcf"],
  ["catalog/pop-up-cinema-at-your-villa.webp", "/assets/img/a9effc190987855f.webp", "a797a911-e2d9-5686-b963-1e3190e2c6b4"],
  ["catalog/private-city-guides.webp", "/assets/img/0c19280f3db2c897.webp", "0e237e8d-800b-548c-b1ac-418c534c1942"],
  ["destinations/page/hero-2.webp", "/assets/img/63ab3e6e8d9dec4a.webp", "destinations-page:hero"],
  ["destinations/page/hero-3.webp", "/assets/img/0ecaa27f3bc3940e.webp", "destinations-page:hero"],
];

test("slice-2 media: base 118 + 40 entries, catalog/ 10 + 35, destinations/ 4 + 5", () => {
  const manifest = JSON.parse(readFileSync("lib/data/media-manifest.json", "utf8"));
  assert.equal(manifest.length, 158);
  assert.equal(manifest.filter((e) => e.key.startsWith("catalog/")).length, 45);
  assert.equal(manifest.filter((e) => e.key.startsWith("destinations/")).length, 9);
  assert.equal(NEW_KEYS.length, 40);
  for (const [key, source, usedBy] of NEW_KEYS) {
    const e = manifest.find((x) => x.key === key);
    assert.ok(e, key);
    assert.equal(e.source, source, key);
    assert.equal(e.source_kind, "local", key);
    assert.deepEqual(e.used_by, [usedBy], key);
  }
  const g = manifest.find((e) => e.source === "/assets/img/4d62ca4792adaf59.webp");
  assert.equal(g.key, "home/gallery/03.webp");
  assert.deepEqual(g.image_ids, ["7c106731-d85f-50a4-9800-4538dcd69ead", "bf7b9a70-9beb-51d1-bf9e-a7dbc25082d3"]);
  assert.deepEqual(g.used_by, ["destinations-page:hero", "home:welcome"]);
  assert.equal(g.sha256, "ebffc193fdcd01ba66b4e1ff94dc78ea2119f4efd825d19855d83f922d11ccd1");
});

test("getDestinationsPageHero: three images, the home gallery's file first", async () => {
  const HERO_IDS = ["bf7b9a70-9beb-51d1-bf9e-a7dbc25082d3", "c2d5f871-6ce2-5486-88a9-ea8a09b2deeb", "338e83be-3378-55e2-851c-c0a741183b2e"];
  const EN = ["Minimalist living room inside a Mediterranean villa", "Black marble bathroom with a freestanding bathtub and a sea view", "Arched hallway inside a Mediterranean modern hotel"];
  const AR = [null, "حمّام من الرخام الأسود مع حوض استحمام قائم بذاته وإطلالة على البحر", "ممر مقوّس داخل فندق متوسطي حديث"];
  const ES = [null, "Baño de mármol negro con bañera exenta y vista al mar", "Pasillo arqueado dentro de un hotel mediterráneo moderno"];
  const { MEDIA_BASE_URL } = mediaMod;
  const alts = JSON.parse(readFileSync("lib/data/fixtures/image-translations.json", "utf8"));
  const gallery = (locale) => alts.find((a) => a.image_id === "7c106731-d85f-50a4-9800-4538dcd69ead" && a.locale === locale).alt;
  for (const l of ["en", "ar", "es"]) {
    const hero = await destMod.getDestinationsPageHero(l);
    assert.equal(hero.length, 3, l);
    for (const h of hero) assert.deepEqual(Object.keys(h).sort(), ["alt", "height", "id", "position", "url", "width"]);
    assert.deepEqual(hero.map((h) => h.position), [1, 2, 3]);
    assert.deepEqual(hero.map((h) => h.url), [
      MEDIA_BASE_URL + "/home/gallery/03.webp",
      MEDIA_BASE_URL + "/destinations/page/hero-2.webp",
      MEDIA_BASE_URL + "/destinations/page/hero-3.webp",
    ]);
    assert.deepEqual(hero.map((h) => h.id), HERO_IDS);
    assert.ok(hero.every((h) => h.width === 1820 && h.height === 1024));
    const want = l === "en" ? EN : l === "ar" ? [gallery("ar"), AR[1], AR[2]] : [gallery("es"), ES[1], ES[2]];
    assert.deepEqual(hero.map((h) => h.alt), want, l);
    if (l === "ar") assert.ok(hero.every((h) => /[\u0600-\u06FF]/.test(h.alt)));
    for (const h of hero) assert.doesNotMatch(h.alt, /wooden door|infinity/i);
  }
  assert.notEqual(HERO_IDS[0], "7c106731-d85f-50a4-9800-4538dcd69ead");
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
