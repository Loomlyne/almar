// Plan 03.3-40: every stay amenity has an icon key (a data fact, not a component choice), derived from the English
// label by ordered keyword rules. The table below is written out literally: it is the mapping, not a re-run of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const iconMod = await loadTs("lib/data/amenity-icon.ts");
const staysMod = await loadTs("lib/data/stays.ts");
const { amenityIcon, AMENITY_ICON_RULES } = iconMod;
const { getStays } = staysMod;

const TABLE = {
  "Private pool": "pool",
  "Air conditioning": "air",
  TV: "tv",
  "Hot water": "water",
  WiFi: "wifi",
  Internet: "wifi",
  Kitchen: "kitchen",
  Jacuzzi: "pool",
  "BBQ area": "grill",
  "Rooftop terrace": "outdoor",
  "Living room": "lounge",
  "Dining room": "lounge",
  "Living room terrace": "outdoor",
  "Rooftop with jacuzzi and barbecue": "pool",
  "Private patio": "outdoor",
  "Pool table": "lounge",
  "Private lounge": "lounge",
  "Speaker system": "lounge",
  "Private pool: Multi-level infinity": "pool",
  "Private chef and full-time butler": "kitchen",
  "Monumental gazebo": "outdoor",
  "Private dock and parking": "parking",
  "Designer social area": "lounge",
  "24/7 security (12 guards)": "security",
  "Private pool: Resort-style": "pool",
  "Gas and barrel BBQ area": "grill",
  "Children's bounce house with luxury lighting": "lounge",
  "Expansive green areas with Cauca River views": "outdoor",
  "Gazebo with hammocks": "outdoor",
  "Spacious Parking & Secure Gated Community": "security",
  "Private pool, Adults and children": "pool",
  "Green area": "outdoor",
};

test("amenityIcon maps every English amenity in the fixtures as the table says", () => {
  for (const [label, icon] of Object.entries(TABLE)) {
    assert.equal(amenityIcon(label), icon, label);
    assert.equal(amenityIcon(label.toUpperCase()), icon, `${label} (upper case)`);
  }
});

test("the table covers every English amenity in the fixtures", () => {
  const t = JSON.parse(readFileSync("lib/data/fixtures/stay-translations.json", "utf8"));
  const labels = new Set(t.filter((r) => r.locale === "en").flatMap((r) => r.amenities));
  const missing = [...labels].filter((l) => !(l in TABLE));
  assert.deepEqual(missing, [], "an English amenity has no row in the table");
});

test("rules are ordered, first match wins, and the fallback is check", () => {
  assert.equal(AMENITY_ICON_RULES.length, 13, "thirteen keyword rules, then the fallback");
  assert.equal(amenityIcon("Telescope"), "check");
  assert.equal(amenityIcon("Pool table"), "lounge", "rule 1 beats the pool rule");
});

for (const locale of ["en", "ar", "es"]) {
  test(`every stay has one icon per amenity, four policy headings and no policy bodies (${locale})`, async () => {
    const stays = await getStays(locale);
    assert.equal(stays.length, 12);
    for (const s of stays) {
      assert.equal(s.amenity_icons.length, s.amenities.length, `${locale} ${s.slug}`);
      assert.equal(s.policy_headings.length, 4, `${locale} ${s.slug}`);
      // Owner, 2026-10-04: headings only, nothing opens, until real text is written in the dashboard.
      assert.equal(s.policy_bodies, null, `${locale} ${s.slug}`);
      assert.doesNotMatch(JSON.stringify(s), /PRIVADA|CAMARERA/, `${locale} ${s.slug} placeholder text`);
    }
  });
}

test("English amenity_icons equal the mapping of the English labels", async () => {
  for (const s of await getStays("en")) {
    assert.deepEqual(s.amenity_icons, s.amenities.map((a) => TABLE[a]), s.slug);
  }
});
