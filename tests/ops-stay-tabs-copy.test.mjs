// Phase 3.2 plan 15: the copy and the source rules of the stay editor's Rates, Availability and Access cards. No server,
// no port. The browser behaviour is tests/ops-stay-tabs.spec.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { OPS_STAY_TABS_COPY: COPY } = await loadTs("lib/copy/ops-stay-tabs.ts");

const DIR = "app/dashboard/(ops)/catalog/stays/";
const SECTIONS = ["stay-rates-section.tsx", "stay-availability-section.tsx", "stay-access-section.tsx", "stay-tab-sections.tsx"];

/** Every leaf of the copy as [path, value]. */
function leaves(value, path = "") {
  if (typeof value === "string") return [[path, value]];
  return Object.entries(value).flatMap(([key, inner]) => leaves(inner, path ? `${path}.${key}` : key));
}

test("copy: the same keys in en, ar and es; every string real and non-empty", () => {
  const keys = (locale) => leaves(COPY[locale]).map(([path]) => path);
  assert.deepEqual(keys("ar"), keys("en"));
  assert.deepEqual(keys("es"), keys("en"));
  for (const locale of ["en", "ar", "es"]) {
    for (const [path, text] of leaves(COPY[locale])) {
      assert.equal(typeof text, "string", `${locale}.${path}`);
      assert.ok(text.trim().length > 0, `${locale}.${path} is empty`);
      assert.doesNotMatch(text, /\[object|undefined|NaN/, `${locale}.${path}`);
    }
  }
});

test("copy: no amount, no rate and no currency figure in any string (the owner types every rate)", () => {
  for (const locale of ["en", "ar", "es"]) {
    for (const [path, text] of leaves(COPY[locale])) {
      // The money hint shows the format with one example; nothing else may carry a figure next to AED.
      if (path === "rates.moneyError") continue;
      assert.doesNotMatch(text, /AED\s*[\d٠-٩]|[\d٠-٩]\s*(AED|درهم)/, `${locale}.${path}`);
    }
  }
});

test("copy: the canvas words are verbatim, the Arabic Availability line as the owner corrected it (2026-10-15)", () => {
  assert.equal(COPY.en.availability.intro, "Blocked and booked dates for this stay. Blocks are set in the Calendar.");
  assert.equal(COPY.ar.availability.intro, "التواريخ المحجوبة والمحجوزة لهذه الإقامة. تُضبط التواريخ المحجوبة من التقويم.");
  assert.equal(COPY.es.availability.intro, "Fechas bloqueadas y reservadas de esta estancia. Los bloqueos se definen en el Calendario.");
  assert.deepEqual(COPY.en.availability.weekdays, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert.equal(COPY.en.rates.title, "Rates");
  assert.equal(COPY.en.access.title, "Access");
});

test("sources: requests only through the kit client; no console, no fetch(, no default rate", () => {
  for (const file of SECTIONS) {
    const source = readFileSync(DIR + file, "utf8");
    assert.doesNotMatch(source, /\bfetch\(/, `${file} calls fetch directly`);
    assert.doesNotMatch(source, /console\./, `${file} logs`);
    // No amount typed into the code: a rate only ever comes from the owner's typing or the server's reply.
    assert.doesNotMatch(source, /["'`]\d+(\.\d{1,2})?["'`]/, `${file} holds a literal amount`);
  }
});

test("sections: Rates and Availability in the main column, Access in the side; none on a new stay", () => {
  const source = readFileSync(DIR + "stay-tab-sections.tsx", "utf8");
  const columnOf = (key) => new RegExp(`key: "${key}",[\\s\\S]*?column: "(main|side)"`).exec(source)?.[1];
  assert.equal(columnOf("rates"), "main");
  assert.equal(columnOf("availability"), "main");
  assert.equal(columnOf("access"), "side");
  assert.match(source, /if \(stayId === null\) return \[\];/);
});

test("wiring: 03.2-07's stay editor spreads the cards after its own and ORs their unsaved typing into dirty", () => {
  const source = readFileSync(DIR + "stay-editor.tsx", "utf8");
  assert.match(source, /\.\.\.stayTabSections\(\{ stayId: stay\?\.id \?\? null, locale, onDirtyChange: onCardDirty, onBaseSaved: onBaseRate \}\)/);
  assert.match(source, /const dirty = [^;]*Object\.values\(cardsDirty\)\.some\(Boolean\)/);
  // After the stay's own settings: the last own card is Stay rules.
  assert.ok(source.indexOf('key: "rules"') < source.indexOf("...stayTabSections("), "the cards follow the stay's own");
  // PR #23 review: a saved price updates only the stay's price and the list, never the form or its saved copy.
  const screen = readFileSync(DIR + "stays-screen.tsx", "utf8");
  assert.match(screen, /function onBaseRate\(base: string \| null\) \{\s*setStay\(\(was\) => withBaseRate\(was, base\)\);\s*void load\(\);\s*\}/);
  assert.match(screen, /onBaseRate=\{onBaseRate\}/);
  assert.doesNotMatch(screen, /function reload\(|reload=\{/, "no reload of the open stay");
  assert.doesNotMatch(source, /\breload\b/, "the editor has no reload prop");
});

test("availability: a month reply that is not for the month last asked for is dropped (PR #23 review)", () => {
  const source = readFileSync(DIR + "stay-availability-section.tsx", "utf8");
  assert.match(source, /const key = `\$\{stayId\} \$\{from\} \$\{to\}`;\s*asked\.current = key;/);
  assert.match(source, /await opsFetch<BlocksView>\("\/api\/ops\/blocks", \{ from, to, stay_id: stayId \}\);\s*if \(asked\.current !== key\) return;/);
});

test("names: the Access card's Edit translations control is named for its field from signed strings only; the kit's keeps its words", async () => {
  const access = readFileSync(`${DIR}stay-access-section.tsx`, "utf8");
  // "Edit translations: Notes" / "Hide translations: Notes" (controller 2026-10-19): the words on screen first.
  assert.match(access, /aria-label=\{`\$\{showTranslations \? kit\.editor\.hideTranslations : kit\.editor\.editTranslations\}: \$\{copy\.access\.notes\}`\}/);
  const { OPS_KIT_COPY: KIT } = await loadTs("lib/copy/ops-kit.ts");
  for (const locale of ["en", "ar", "es"]) {
    const name = `${KIT[locale].editor.editTranslations}: ${COPY[locale].access.notes}`;
    assert.notEqual(name, KIT[locale].editor.editTranslations, locale);
    assert.ok(name.startsWith(KIT[locale].editor.editTranslations), `${locale}: label in name`);
  }
  assert.equal(`${(await loadTs("lib/copy/ops-kit.ts")).OPS_KIT_COPY.ar.editor.editTranslations}: ${COPY.ar.access.notes}`, "تعديل الترجمات: ملاحظات");
});
