// Places of the 35 slice-2 catalogue rows (design 3.4, owner answer 3, 2026-10-03: "you decide ... after
// verifying"). A row is filed under a destination only when one of that destination's keywords is in the row's
// own English name or summary, as a whole phrase; and every keyword hit must be filed. The 10 slice-1 rows
// are frozen by literal and exempt from the keyword rule.
//
// Two literal outcomes the owner may want to see: Helicopter Transfers says "coffee country" and Rural Farm &
// Nature Visits says "coffee farms". Neither is a listed keyword, so neither is filed under Cocora Valley
// (design Appendix A agrees).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const ROOT = resolve(process.env.ALMAR_DATA_ROOT ?? process.cwd());
const { foldText } = await loadTs("lib/data/stay-filter.ts");
const fixture = (name) => JSON.parse(readFileSync(join(ROOT, "lib", "data", "fixtures", `${name}.json`), "utf8"));

// Design 3.4, verbatim.
export const KEYWORDS = {
  cartagena: ["Cartagena", "Getsemaní", "Walled City", "Rosario", "Barú", "Playa Blanca"],
  medellin: ["Medellín", "Comuna 13", "Guatapé"],
  bogota: ["Bogotá", "Monserrate", "Gold Museum"],
  "san-andres": ["San Andrés"],
  "cocora-valley": ["Coffee Triangle", "coffee heartland", "coffee hills", "Salento", "Armenia"],
};
export const SLICE1_EXEMPT = [
  "24-7-private-concierge",
  "luxury-ground-transport",
  "vip-airport-meet-greet",
  "welcome-cocktail",
  "cartagena-night-experience",
  "cartagena-heritage-tours",
  "rosario-islands-escape",
  "yacht-island-charters",
  "medellin-renaissance",
  "medellin-discovery-tours",
];
const FROZEN = {
  "24-7-private-concierge": ["cartagena", "medellin"],
  "luxury-ground-transport": ["cartagena", "medellin"],
  "vip-airport-meet-greet": ["cartagena", "medellin"],
  "welcome-cocktail": ["cartagena", "medellin"],
  "cartagena-night-experience": ["cartagena"],
  "cartagena-heritage-tours": ["cartagena"],
  "rosario-islands-escape": ["cartagena"],
  "yacht-island-charters": ["cartagena"],
  "medellin-renaissance": ["medellin"],
  "medellin-discovery-tours": ["medellin"],
};

function phrase(text, keyword) {
  const k = foldText(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${k}(?:$|[^a-z0-9])`).test(foldText(text));
}

/** Every place problem in the catalogue rows that are not slice-1 exempt, as strings. */
export function placeProblems(catalog, translations, destinations) {
  const problems = [];
  const byId = new Map(destinations.map((d) => [d.id, d]));
  const ordered = [...destinations].sort((a, b) => a.position - b.position);
  for (const row of catalog) {
    if (SLICE1_EXEMPT.includes(row.slug)) continue;
    const en = translations.find((t) => t.item_id === row.id && t.locale === "en");
    if (!en) {
      problems.push(`${row.slug}: no EN record`);
      continue;
    }
    const text = `${en.name} ${en.summary ?? ""}`;
    const derived = ordered.filter((d) => (KEYWORDS[d.slug] ?? []).some((k) => phrase(text, k))).map((d) => d.slug);
    const filed = [];
    for (const id of row.destination_ids) {
      const d = byId.get(id);
      if (!d) problems.push(`${row.slug}: unknown destination ${id}`);
      else filed.push(d.slug);
    }
    for (const s of derived) if (!filed.includes(s)) problems.push(`${row.slug}: text names ${s}, not filed under it`);
    for (const s of filed) if (!derived.includes(s)) problems.push(`${row.slug}: filed under ${s}, text names none of its keywords`);
  }
  return problems;
}

test("placeProblems flags each kind of violation (red cases)", () => {
  const dests = ["cartagena", "medellin", "bogota", "san-andres", "cocora-valley"].map((slug, i) => ({ id: `d-${slug}`, slug, position: i + 1 }));
  const row = (slug, ids) => ({ id: `r-${slug}`, slug, destination_ids: ids });
  const en = (slug, summary, name = "N") => ({ item_id: `r-${slug}`, locale: "en", name, summary });
  const one = (r, t) => placeProblems([r], [t], dests);
  const a = one(row("a", []), en("a", "A hacienda in Salento."));
  assert.equal(a.length, 1);
  assert.match(a[0], /cocora-valley/);
  const b = one(row("b", ["d-bogota"]), en("b", "A walk in the hills."));
  assert.equal(b.length, 1);
  assert.match(b[0], /bogota/);
  assert.deepEqual(one(row("c", ["d-cartagena"]), en("c", "Cartagena's walled city, at dusk.")), []);
  assert.deepEqual(one(row("d", []), en("d", "Armenian cuisine, taught by a chef.")), []);
  assert.equal(placeProblems([row("e", ["d-nope"])], [en("e", "x")], dests).length >= 1, true);
  assert.equal(placeProblems([row("f", [])], [], dests).length, 1);
});

test("real tree: every one of the 35 new rows is filed under exactly the places its own words name", () => {
  const catalog = fixture("catalog");
  assert.equal(catalog.filter((r) => !SLICE1_EXEMPT.includes(r.slug)).length, 35);
  assert.equal(catalog.length, 45);
  assert.deepEqual(placeProblems(catalog, fixture("catalog-translations"), fixture("destinations")), []);
});

test("real tree: slice-1 places are frozen, counts per destination, no eje-cafetero, ids in position order", () => {
  const catalog = fixture("catalog");
  const dests = fixture("destinations");
  const slugOf = new Map(dests.map((d) => [d.id, d.slug]));
  const posOf = new Map(dests.map((d) => [d.id, d.position]));
  for (const [slug, places] of Object.entries(FROZEN)) {
    const row = catalog.find((r) => r.slug === slug);
    assert.deepEqual(row.destination_ids.map((id) => slugOf.get(id)), places, slug);
  }
  const count = (s) => catalog.filter((r) => r.destination_ids.some((id) => slugOf.get(id) === s)).length;
  assert.deepEqual(
    { cartagena: count("cartagena"), medellin: count("medellin"), bogota: count("bogota"), "san-andres": count("san-andres"), "cocora-valley": count("cocora-valley") },
    { cartagena: 14, medellin: 11, bogota: 3, "san-andres": 1, "cocora-valley": 4 },
  );
  assert.equal(catalog.filter((r) => r.destination_ids.length === 0).length, 24);
  assert.equal(dests.some((d) => d.slug === "eje-cafetero"), false);
  assert.doesNotMatch(JSON.stringify(catalog), /eje-cafetero/);
  for (const r of catalog) {
    const positions = r.destination_ids.map((id) => posOf.get(id));
    assert.deepEqual(positions, [...positions].sort((x, y) => x - y), `${r.slug}: destination_ids out of position order`);
  }
});
