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
  assert.match(source, /\.\.\.stayTabSections\(\{ stayId: stay\?\.id \?\? null, locale, onDirtyChange: onCardDirty/);
  assert.match(source, /const dirty = [^;]*Object\.values\(cardsDirty\)\.some\(Boolean\)/);
  // After the stay's own settings: the last own card is Stay rules.
  assert.ok(source.indexOf('key: "rules"') < source.indexOf("...stayTabSections("), "the cards follow the stay's own");
});

test("names: the two Edit translations controls on a stay have different accessible names that start with the words shown", async () => {
  const { controlName } = await loadTs("components/ops/control-name.ts");
  const { OPS_KIT_COPY: KIT } = await loadTs("lib/copy/ops-kit.ts");
  const { OPS_STAYS_COPY: STAYS } = await loadTs("lib/copy/ops-stays.ts");
  assert.equal(controlName("en", "Edit translations", "Text"), "Edit translations, Text");
  assert.equal(controlName("es", "Editar traducciones", "Texto"), "Editar traducciones, Texto");
  assert.equal(controlName("ar", "تعديل الترجمات", "النص"), "تعديل الترجمات، النص");
  for (const locale of ["en", "ar", "es"]) {
    for (const words of [KIT[locale].editor.editTranslations, KIT[locale].editor.hideTranslations]) {
      const text = controlName(locale, words, STAYS[locale].sectionText);
      const access = controlName(locale, words, COPY[locale].access.translationsName);
      assert.notEqual(text, access, `${locale}: ${text}`);
      assert.ok(text.startsWith(words) && access.startsWith(words), `${locale}: label in name`);
    }
  }
  // Wired: the stay editor names its Text card, the Access card names itself; the kit adds the name only when given.
  const editor = readFileSync(`${DIR}stay-editor.tsx`, "utf8");
  assert.match(editor, /key: "text",[^\n]*translatable: true, translationsName: copy\.sectionText/);
  const access = readFileSync(`${DIR}stay-access-section.tsx`, "utf8");
  assert.match(access, /aria-label=\{controlName\(\s*locale,[\s\S]{0,160}copy\.access\.translationsName,?\s*\)\}/);
  const kit = readFileSync("components/ops/edit-page.tsx", "utf8");
  assert.match(kit, /aria-label=\{name \? controlName\(locale, words, name\) : undefined\}/);
});
