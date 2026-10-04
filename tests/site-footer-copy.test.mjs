import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { FRAMER_SOURCE_COPY } from "../lib/copy/framer-source.ts";
import { HOME_COPY } from "../lib/copy/home.ts";
import { HOME_PAGE_COPY } from "../lib/copy/home-page.ts";
import { SITE_FOOTER_COPY } from "../lib/copy/site-footer.ts";
import { STAYS_LIST_COPY } from "../lib/copy/stays-list.ts";
import { STAY_DETAIL_COPY } from "../lib/copy/stay-detail.ts";

// 3.3 integration fix f: the footer's strings live in ONE table (lib/copy/site-footer.ts) that the home, the
// stays list and the stay page all read. Before, each page file carried its own copy and the Arabic drifted.

const LOCALES = ["en", "ar", "es"];
const KEYS = ["brand", "contact", "copyright", "instagram", "language", "madeBy", "newTab", "pages"];
const LIVE_COPYRIGHT = "© 2026 ALMAR Private Journeys. All rights reserved.";

test("one table, three locales, the same eight non-empty strings in each", () => {
  assert.deepEqual(Object.keys(SITE_FOOTER_COPY).sort(), ["ar", "en", "es"]);
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(SITE_FOOTER_COPY[locale]).sort(), KEYS, locale);
    for (const key of KEYS) assert.ok(SITE_FOOTER_COPY[locale][key].trim() !== "", `${locale}.${key}`);
  }
});

test("the words are the approved lines: pages, contact and language from lib/copy/home.ts, the copyright from the live footer", () => {
  for (const locale of LOCALES) {
    const footer = SITE_FOOTER_COPY[locale];
    assert.equal(footer.pages, HOME_COPY[locale].pages, `${locale} pages`);
    assert.equal(footer.contact, HOME_COPY[locale].nav.contact, `${locale} contact`);
    assert.equal(footer.language, HOME_COPY[locale].nav.language, `${locale} language`);
    assert.equal(footer.copyright, FRAMER_SOURCE_COPY[locale][LIVE_COPYRIGHT], `${locale} copyright`);
    assert.equal(footer.instagram, "Instagram", `${locale} instagram: the brand name, as the live footer prints it`);
  }
  assert.equal(SITE_FOOTER_COPY.en.copyright, LIVE_COPYRIGHT);
});

test("plan 41 keys: brand (the wordmark's alt) and madeBy; the English is the live footer's, AR and ES are marked drafts", () => {
  assert.equal(SITE_FOOTER_COPY.en.brand, "ALMAR Private Journeys");
  assert.equal(SITE_FOOTER_COPY.en.madeBy, "Made by");
  assert.equal(SITE_FOOTER_COPY.ar.madeBy, "صُمّم بواسطة");
  assert.equal(SITE_FOOTER_COPY.es.madeBy, "Hecho por");
  const header = readFileSync("lib/copy/site-footer.ts", "utf8").split("export type")[0];
  assert.match(header, /brand/);
  assert.match(header, /madeBy/);
  assert.match(header, /draft/i);
});

test("no page copy file has a footer of its own any more", () => {
  for (const [name, table] of [["home-page", HOME_PAGE_COPY], ["stays-list", STAYS_LIST_COPY], ["stay-detail", STAY_DETAIL_COPY]]) {
    for (const locale of LOCALES) {
      assert.equal("footer" in table[locale] || "frame" in table[locale], false, `lib/copy/${name}.ts [${locale}] still has a footer`);
    }
    const source = readFileSync(`lib/copy/${name}.ts`, "utf8");
    assert.equal(/\bcopyright\b|rights reserved|opens in a new tab/i.test(source), false, `lib/copy/${name}.ts still names a footer string`);
  }
});

test("every React page reads the table for its footer, and none writes a footer string itself", () => {
  const pages = {
    "components/pages/home-page.tsx": /footerCopy=\{SITE_FOOTER_COPY\[locale\]\}/,
    "components/pages/private-stays-page.tsx": /footerCopy=\{SITE_FOOTER_COPY\[locale\]\}/,
    "components/pages/stay-detail-page.tsx": /footerCopy=\{SITE_FOOTER_COPY\[locale\]\}/,
  };
  for (const [file, reads] of Object.entries(pages)) {
    const source = readFileSync(file, "utf8");
    assert.match(source, reads, file);
    assert.match(source, /from "\.\.\/\.\.\/lib\/copy\/site-footer"/, file);
  }
  // Under components/pages and components/site, only the table and the UI footer know these strings.
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path, out);
      else if (/\.tsx?$/.test(name)) out.push(path);
    }
    return out;
  };
  for (const file of [...walk("components/pages"), ...walk("components/site")]) {
    const source = readFileSync(file, "utf8");
    assert.equal(/newTab:|copyright:|All rights reserved|Todos los derechos/.test(source), false, `${file} writes a footer string`);
  }
});
