// The /private-stays list uses ONE StayFilter implementation (lib/data/stay-filter.ts) on the server and in the
// browser. This test proves the server read and the client filter agree over a fixed matrix in all three
// locales, pins the facts plan 03.3-01 measured, and proves the list's state mapping and the hero-bar handoff.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";
import { STAYS_LIST_COPY } from "../lib/copy/stays-list.ts";
import { JOURNEY_COPY } from "../lib/copy/journey.ts";
import { STAY_DETAIL_COPY } from "../lib/copy/stay-detail.ts";

const staysMod = await loadTs("lib/data/stays.ts");
const destinationsMod = await loadTs("lib/data/destinations.ts");
const filterMod = await loadTs("lib/data/stay-filter.ts");
const stateMod = await loadTs("components/pages/private-stays/filter-state.ts");

const { getStays } = staysMod;
const { getDestinations } = destinationsMod;
const { filterStays, parseStayQuery, toStayQuery } = filterMod;
const { BEDROOM_BUCKETS, EMPTY_STATE, isFiltered, listQuery, stateFromQuery, toStayFilter } = stateMod;

const LOCALES = ["en", "ar", "es"];
const slugs = (list) => list.map((s) => s.slug);

const destinationSlugs = (await getDestinations("en")).map((d) => d.slug);
const maxGuests = Math.max(...(await getStays("en")).map((s) => s.max_guests ?? 0));

// Three ranges for the Dates filter (plan 46): one that clears a blocked day, one that ends on one, one wide.
const DATE_RANGES = [
  ["2026-10-14", "2026-10-17"],
  ["2026-10-12", "2026-10-15"],
  ["2026-11-01", "2026-12-15"],
];

// The fixed matrix of filters (plan 05 Task 2).
const MATRIX = [
  { name: "none", filter: {} },
  ...destinationSlugs.map((d) => ({ name: `destination ${d}`, filter: { destination: d } })),
  ...[1, 10, 11, 20, 21, 30, 31].map((g) => ({ name: `guests ${g}`, filter: { guests: g } })),
  ...Object.entries(BEDROOM_BUCKETS).map(([b, f]) => ({ name: `bedrooms ${b}`, filter: { ...f } })),
  ...["getsemani", "GETSEMANÍ", "cartagena", "zzzz"].map((q) => ({ name: `query ${q}`, filter: { query: q } })),
  { name: "medellin + guests 20", filter: { destination: "medellin", guests: 20 } },
  ...DATE_RANGES.map(([from, to]) => ({ name: `dates ${from}..${to}`, filter: { from, to } })),
  ...DATE_RANGES.flatMap(([from, to]) =>
    destinationSlugs.flatMap((destination) =>
      [0, 6].map((guests) => ({
        name: `dates ${from}..${to} + ${destination} + guests ${guests}`,
        filter: { from, to, destination, ...(guests ? { guests } : {}) },
      })),
    ),
  ),
  { name: "cartagena + bedrooms 5-8 + query casa", filter: { destination: "cartagena", ...BEDROOM_BUCKETS["5-8"], query: "casa" } },
];

for (const locale of LOCALES) {
  test(`server and client agree on every filter in the matrix (${locale})`, async () => {
    const all = await getStays(locale);
    assert.equal(all.length, 12, `${locale}: 12 published stays`);
    for (const { name, filter } of MATRIX) {
      const server = slugs(await getStays(locale, filter));
      const client = slugs(filterStays(all, filter));
      assert.deepEqual(client, server, `${locale} / ${name}: the client list differs from the server read`);
    }
  });

  test(`the list's own state maps to the same filter the server read takes (${locale})`, async () => {
    const all = await getStays(locale);
    const states = [
      { query: "getsemani", destination: "", guests: 0, bedrooms: "any" },
      { query: "", destination: "medellin", guests: 0, bedrooms: "any" },
      { query: "", destination: "", guests: 20, bedrooms: "any" },
      { query: "", destination: "", guests: 0, bedrooms: "5-8" },
      { query: "casa", destination: "cartagena", guests: 6, bedrooms: "5-8" },
      { query: "", destination: "", guests: 0, bedrooms: "9+" },
      { query: "", destination: "", guests: 0, bedrooms: "any", from: "2026-10-14", to: "2026-10-17" },
      { query: "", destination: "cartagena", guests: 2, bedrooms: "any", from: "2026-10-12", to: "2026-10-15" },
      { query: "", destination: "medellin", guests: 0, bedrooms: "any", from: "2026-11-02", to: "2026-11-09" },
    ];
    for (const state of states.map((x) => ({ from: "", to: "", ...x }))) {
      const filter = toStayFilter(state);
      assert.deepEqual(slugs(filterStays(all, filter)), slugs(await getStays(locale, filter)), JSON.stringify(state));
    }
  });
}

test("pinned facts from plan 03.3-01 (en)", async () => {
  const all = await getStays("en");
  assert.equal(all.length, 12);
  assert.deepEqual(slugs(all).slice(0, 3), [
    "getsemani-colonial-house",
    "getsemani-courtyard-residence",
    "cartagena-historic-center-house",
  ]);
  assert.deepEqual(
    all.map((s) => s.position),
    [...all.map((s) => s.position)].sort((a, b) => a - b),
    "position order",
  );
  assert.equal(filterStays(all, { destination: "medellin" }).length, 2);
  assert.deepEqual(slugs(filterStays(all, { guests: 20 })).sort(), [
    "private-island-cartagena",
    "private-island-estate-cartagena",
  ]);
  const getsemani = ["getsemani-colonial-house", "getsemani-courtyard-residence"];
  assert.deepEqual(slugs(filterStays(all, { query: "getsemani" })), getsemani);
  assert.deepEqual(slugs(filterStays(all, { query: "GETSEMANÍ" })), getsemani);
});

test("the three hidden stays are in no locale's list", async () => {
  for (const locale of LOCALES) {
    const found = slugs(await getStays(locale));
    for (const hidden of ["baru-house", "corona-island", "yury-house-cartagena"]) {
      assert.equal(found.includes(hidden), false, `${locale}: ${hidden}`);
    }
  }
});

test("only destinations with a published stay are offered: cartagena then medellin", () => {
  assert.deepEqual(destinationSlugs, ["cartagena", "medellin"]);
  assert.equal(maxGuests, 30);
});

test("BEDROOM_BUCKETS are 1-4, 5-8 and 9+ with an open top", () => {
  assert.deepEqual(BEDROOM_BUCKETS, {
    "1-4": { bedroomsMin: 1, bedroomsMax: 4 },
    "5-8": { bedroomsMin: 5, bedroomsMax: 8 },
    "9+": { bedroomsMin: 9 },
  });
});

test("toStayFilter omits every empty key and trims the query", () => {
  assert.deepEqual(toStayFilter(EMPTY_STATE), {});
  assert.deepEqual(toStayFilter({ ...EMPTY_STATE, query: "   " }), {});
  assert.deepEqual(toStayFilter({ ...EMPTY_STATE, query: "  getsemani " }), { query: "getsemani" });
  assert.deepEqual(toStayFilter({ ...EMPTY_STATE, destination: "medellin", guests: 3 }), {
    destination: "medellin",
    guests: 3,
  });
  assert.deepEqual(toStayFilter({ ...EMPTY_STATE, bedrooms: "9+" }), { bedroomsMin: 9 });
  assert.deepEqual(toStayFilter({ ...EMPTY_STATE, bedrooms: "1-4" }), { bedroomsMin: 1, bedroomsMax: 4 });
  assert.deepEqual(EMPTY_STATE, { query: "", destination: "", guests: 0, bedrooms: "any", from: "", to: "" });
});

test("toStayFilter adds from and to only when both are set", () => {
  assert.deepEqual(toStayFilter({ ...EMPTY_STATE, from: "2026-10-12", to: "2026-10-15" }), {
    from: "2026-10-12",
    to: "2026-10-15",
  });
  assert.deepEqual(toStayFilter({ ...EMPTY_STATE, from: "2026-10-12" }), {});
  assert.deepEqual(toStayFilter({ ...EMPTY_STATE, to: "2026-10-15" }), {});
});

test("isFiltered is true for each single filter and false for the empty state", () => {
  assert.equal(isFiltered(EMPTY_STATE), false);
  assert.equal(isFiltered({ ...EMPTY_STATE, query: " " }), false, "a blank query is not a filter");
  assert.equal(isFiltered({ ...EMPTY_STATE, query: "x" }), true);
  assert.equal(isFiltered({ ...EMPTY_STATE, destination: "cartagena" }), true);
  assert.equal(isFiltered({ ...EMPTY_STATE, guests: 1 }), true);
  assert.equal(isFiltered({ ...EMPTY_STATE, bedrooms: "5-8" }), true);
  assert.equal(isFiltered({ ...EMPTY_STATE, from: "2026-10-12", to: "2026-10-15" }), true, "dates alone");
});

test("handoff: the home Search's URL sets destination, guests and dates", () => {
  const parsed = parseStayQuery(
    new URLSearchParams("destination=cartagena&from=2026-10-12&to=2026-10-15&guests=2"),
  );
  const { state } = stateFromQuery(parsed, destinationSlugs, maxGuests);
  assert.deepEqual(state, {
    query: "",
    destination: "cartagena",
    guests: 2,
    bedrooms: "any",
    from: "2026-10-12",
    to: "2026-10-15",
  });
});

test("handoff: an unknown destination, a bad guests value and a bad date are ignored, never an error", () => {
  const parsed = parseStayQuery(new URLSearchParams("destination=bogota&guests=-1&from=2026-13-40"));
  const { state } = stateFromQuery(parsed, destinationSlugs, maxGuests);
  assert.deepEqual(state, EMPTY_STATE);
  for (const q of [
    "guests=abc",
    "guests=0",
    "guests=1.5",
    "destination=../../x",
    "destination=CARTAGENA",
    "from=nope&to=2026-02-30",
    "from=2026-10-15&to=2026-10-12",
    "from=2026-10-12&to=2026-10-12",
    "from=2026-10-12",
    "to=2026-10-15",
    "",
  ]) {
    const out = stateFromQuery(parseStayQuery(new URLSearchParams(q)), destinationSlugs, maxGuests);
    assert.deepEqual(out.state, EMPTY_STATE, q);
  }
});

test("handoff: guests above the largest capacity are clamped to it", () => {
  const parsed = parseStayQuery(new URLSearchParams("guests=99"));
  assert.equal(stateFromQuery(parsed, destinationSlugs, maxGuests).state.guests, maxGuests);
  assert.equal(stateFromQuery({ guests: 5 }, destinationSlugs, maxGuests).state.guests, 5);
});

test("stateFromQuery keeps a destination only if it is a rendered chip", () => {
  assert.equal(stateFromQuery({ destination: "medellin" }, destinationSlugs, maxGuests).state.destination, "medellin");
  assert.equal(stateFromQuery({ destination: "bogota" }, destinationSlugs, maxGuests).state.destination, "");
  assert.equal(stateFromQuery({ destination: "bogota" }, [], maxGuests).state.destination, "");
});

test("stateFromQuery maps bedrooms only on an exact bucket match, and keeps a query", () => {
  const map = (f) => stateFromQuery(f, destinationSlugs, maxGuests).state;
  assert.equal(map({ bedroomsMin: 1, bedroomsMax: 4 }).bedrooms, "1-4");
  assert.equal(map({ bedroomsMin: 5, bedroomsMax: 8 }).bedrooms, "5-8");
  assert.equal(map({ bedroomsMin: 9 }).bedrooms, "9+");
  assert.equal(map({ bedroomsMin: 2, bedroomsMax: 3 }).bedrooms, "any");
  assert.equal(map({ bedroomsMin: 1 }).bedrooms, "any");
  assert.equal(map({ query: "getsemani" }).query, "getsemani");
});

test("listQuery writes destination, dates and guests in toStayQuery order; search and bedrooms never reach the URL", () => {
  assert.equal(listQuery(EMPTY_STATE), "");
  assert.equal(
    listQuery({
      query: "x",
      destination: "cartagena",
      guests: 2,
      bedrooms: "5-8",
      from: "2026-10-12",
      to: "2026-10-17",
    }),
    "destination=cartagena&from=2026-10-12&to=2026-10-17&guests=2",
  );
  assert.equal(listQuery({ ...EMPTY_STATE, guests: 3 }), "guests=3");
  assert.equal(listQuery({ ...EMPTY_STATE, from: "2026-10-12", to: "2026-10-15" }), "from=2026-10-12&to=2026-10-15");
  assert.equal(listQuery({ ...EMPTY_STATE, from: "2026-10-12" }), "", "a one-sided range is never written");
  assert.equal(listQuery({ ...EMPTY_STATE, query: "getsemani", bedrooms: "9+" }), "");
  assert.equal(
    listQuery({ ...EMPTY_STATE, destination: "medellin", guests: 2, from: "2026-10-12", to: "2026-10-17" }),
    toStayQuery({ destination: "medellin", guests: 2, from: "2026-10-12", to: "2026-10-17" }),
  );
});

test("the URL the list writes reads back to the same state", () => {
  const state = {
    query: "",
    destination: "medellin",
    guests: 4,
    bedrooms: "any",
    from: "2026-10-12",
    to: "2026-10-17",
  };
  const back = stateFromQuery(parseStayQuery(new URLSearchParams(listQuery(state))), destinationSlugs, maxGuests);
  assert.deepEqual(back.state, state);
});

// ---- the static HTML of the list (what a visitor with JavaScript off sees, and what hydration must match) ----

/** Bundles StayBrowser with React and renders it on the server, as `next build` does for the static page. */
async function loadRenderer() {
  const out = await build({
    stdin: {
      contents: `
        import { createElement } from "react";
        import { renderToString } from "react-dom/server";
        import { StayBrowser } from "./components/pages/private-stays/stay-browser";
        export const render = (props) => renderToString(createElement(StayBrowser, props));
      `,
      resolveDir: process.cwd(),
      loader: "tsx",
    },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    jsx: "automatic",
    logLevel: "silent",
  });
  const file = join(mkdtempSync(join(tmpdir(), "almar-stay-browser-")), "render.cjs");
  writeFileSync(file, out.outputFiles[0].text);
  return createRequire(file)(file).render;
}

const render = await loadRenderer();

async function listProps(locale, mutate = (x) => x) {
  const all = await getStays(locale);
  const stays = all.map((s) =>
    mutate({
      slug: s.slug,
      title: s.title,
      neighborhood: s.neighborhood,
      guests_label: s.guests_label,
      price_label: s.price_label,
      max_guests: s.max_guests,
      bedrooms: s.bedrooms,
      destination_slug: s.destination_slug,
      destination_name: s.destination_name,
      blocked_dates: s.blocked_dates,
      image: s.hero_image ? { src: s.hero_image.url, alt: s.hero_image.alt } : null,
    }),
  );
  return {
    locale,
    stays,
    destinations: (await getDestinations(locale)).map((d) => ({ slug: d.slug, name: d.name })),
    hrefs: Object.fromEntries(all.map((s) => [s.slug, `/private-stays/${s.slug}`])),
    basePath: "/private-stays",
    copy: STAYS_LIST_COPY[locale],
    journeyCopy: JOURNEY_COPY[locale],
    datesNote: STAY_DETAIL_COPY[locale].sampleDatesNote,
    all,
  };
}

for (const locale of LOCALES) {
  test(`the served list is the 12 linked cards in position order, unfiltered (${locale})`, async () => {
    const { all, ...props } = await listProps(locale);
    const html = render(props);
    const hrefs = [...html.matchAll(/<a href="(\/private-stays\/[a-z0-9-]+)"/g)].map((m) => m[1]);
    assert.deepEqual(hrefs, all.map((s) => `/private-stays/${s.slug}`));
    for (const hidden of ["baru-house", "corona-island", "yury-house-cartagena"]) {
      assert.equal(html.includes(hidden), false, hidden);
    }
    assert.match(html, /aria-live="polite"/);
    assert.ok(html.includes(props.copy.search.label), "search label is in the served HTML");
    assert.ok(html.includes("data-stay-filters"), "the noscript rule has something to hide");
    assert.equal(html.includes("<form"), false, "no form");
    assert.equal(html.includes('type="submit"'), false, "no submit");
    assert.equal(html.includes(props.copy.clear), false, "no Clear filters while nothing is filtered");
    assert.equal(/\b(AED|USD|EUR|COP)\b|[$€£]/.test(html), false, "no currency on the page");
  });
}

test("a stay with no hero picture renders no <img> and no placeholder URL, but is still a link", async () => {
  const { all, ...props } = await listProps("en", (s) =>
    s.slug === "casa-jardin-san-diego" ? { ...s, image: null } : s,
  );
  const html = render(props);
  const card = html.match(/<a href="\/private-stays\/casa-jardin-san-diego"[^>]*>.*?<\/a>/s)?.[0] ?? "";
  assert.ok(card.length > 0, "the card is still a link");
  assert.equal(card.includes("<img"), false);
  assert.equal(html.match(/<img /g)?.length, all.length - 1);
  assert.equal(/<img [^>]*src=""/.test(html), false, "no empty src");
});

test("every served card image comes from the stay's own hero_image url", async () => {
  const { all, ...props } = await listProps("en");
  const html = render(props);
  const srcs = [...html.matchAll(/<img[^>]* src="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(srcs, all.map((s) => s.hero_image.url));
});
